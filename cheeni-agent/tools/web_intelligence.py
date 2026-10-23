"""
Cheeni Desktop Agent -- Web Intelligence & Live Scraping (Phase 7)

Provides real-time web search, news aggregation, and text extraction:
- Use duckduckgo-search for live queries and latest news.
- Use beautifulsoup4 to extract clean, readable text from a URL for LLM context.
"""

import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urlparse
from typing import Dict, Any
from utils.logging import logger

try:
    from ddgs import DDGS
    DDGS_AVAILABLE = True
except ImportError:
    try:
        from duckduckgo_search import DDGS
        DDGS_AVAILABLE = True
    except ImportError:
        DDGS_AVAILABLE = False

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False


# ── Web Search & News ────────────────────────────────────────────────────────

def search_web(query: str, max_results: int = 5) -> Dict[str, Any]:
    """Perform a live web search using DuckDuckGo."""
    if not DDGS_AVAILABLE:
        return {"success": False, "error": "duckduckgo-search is not installed"}

    try:
        results = []
        with DDGS() as ddgs:
            for r in ddgs.text(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("href", ""),
                    "snippet": r.get("body", ""),
                })

        return {
            "success": True,
            "action": "search_web",
            "query": query,
            "results": results,
            "count": len(results),
        }
    except Exception as e:
        logger.error(f"Web search error: {e}")
        return {"success": False, "error": str(e)}


def get_latest_news(topic: str = None, max_results: int = 5) -> Dict[str, Any]:
    """Fetch latest news articles, optionally filtered by a topic."""
    if not DDGS_AVAILABLE:
        return {"success": False, "error": "duckduckgo-search is not installed"}

    try:
        results = []
        query = topic if topic else "world news"
        
        with DDGS() as ddgs:
            for r in ddgs.news(query, max_results=max_results):
                results.append({
                    "title": r.get("title", ""),
                    "url": r.get("url", ""),
                    "source": r.get("source", ""),
                    "date": r.get("date", ""),
                    "snippet": r.get("body", ""),
                })

        return {
            "success": True,
            "action": "get_news",
            "topic": topic or "general",
            "results": results,
            "count": len(results),
        }
    except Exception as e:
        logger.error(f"News fetch error: {e}")
        return {"success": False, "error": str(e)}


# ── Content Extraction ───────────────────────────────────────────────────────

MAX_PAGE_BYTES = 2 * 1024 * 1024

def _resolve_public_addresses(url: str):
    if not isinstance(url, str) or len(url) > 2048:
        return None
    try:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            return None
        if parsed.port not in (None, 80, 443):
            return None
        try:
            addresses = [ipaddress.ip_address(parsed.hostname)]
        except ValueError:
            records = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == "https" else 80), type=socket.SOCK_STREAM)
            addresses = [ipaddress.ip_address(record[4][0]) for record in records]
        if not addresses or not all(address.is_global for address in addresses):
            return None
        return parsed, list(dict.fromkeys(str(address) for address in addresses))
    except (ValueError, OSError):
        return None


def _validate_public_http_url(url: str) -> bool:
    return _resolve_public_addresses(url) is not None


def _open_pinned_response(url: str, resolved=None):
    """Connect directly to a validated IP while preserving HTTP Host and TLS SNI."""
    resolved = resolved or _resolve_public_addresses(url)
    if resolved is None:
        raise ValueError("Only public HTTP(S) pages on standard web ports can be fetched")
    parsed, addresses = resolved
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    path = parsed.path or "/"
    if parsed.query:
        path = f"{path}?{parsed.query}"
    last_error = None

    for address in addresses:
        class PinnedHTTPConnection(http.client.HTTPConnection):
            def connect(self):
                self.sock = socket.create_connection((address, port), self.timeout, self.source_address)

        class PinnedHTTPSConnection(http.client.HTTPSConnection):
            def connect(self):
                raw_socket = socket.create_connection((address, port), self.timeout, self.source_address)
                self.sock = self._context.wrap_socket(raw_socket, server_hostname=parsed.hostname)

        if parsed.scheme == "https":
            connection = PinnedHTTPSConnection(
                parsed.hostname,
                port=port,
                timeout=8,
                context=ssl.create_default_context(),
            )
        else:
            connection = PinnedHTTPConnection(
                parsed.hostname,
                port=port,
                timeout=8,
            )
        try:
            connection.request("GET", path, headers={
                "User-Agent": "CheeniPublicPageReader/1.0",
                "Accept": "text/html,application/xhtml+xml",
                "Connection": "close",
            })
            return connection, connection.getresponse()
        except (OSError, http.client.HTTPException, ssl.SSLError) as error:
            last_error = error
            connection.close()

    raise OSError("Could not connect to a validated public address") from last_error

def scrape_webpage(url: str, max_chars: int = 8000) -> Dict[str, Any]:
    """Fetch a bounded public HTML page without following redirects."""
    if not BS4_AVAILABLE:
        return {"success": False, "error": "beautifulsoup4 is not installed"}
    resolved = _resolve_public_addresses(url)
    if resolved is None:
        return {"success": False, "error": "Only public HTTP(S) pages on standard web ports can be fetched"}
    if not isinstance(max_chars, int) or max_chars < 1 or max_chars > 20000:
        return {"success": False, "error": "max_chars must be between 1 and 20000"}

    connection = None
    try:
        connection, response = _open_pinned_response(url, resolved)
        if 300 <= response.status < 400:
            return {"success": False, "error": "Redirects are not followed by the safe page reader"}
        content_type = response.headers.get("Content-Type", "").lower()
        if "text/html" not in content_type and "application/xhtml+xml" not in content_type:
            return {"success": False, "error": "The page did not return HTML content"}
        declared_size = response.headers.get("Content-Length")
        if declared_size:
            try:
                if int(declared_size) > MAX_PAGE_BYTES:
                    return {"success": False, "error": "Page exceeds the 2 MB fetch limit"}
            except ValueError:
                return {"success": False, "error": "The page returned an invalid content length"}
        if response.status < 200 or response.status >= 300:
            return {"success": False, "error": f"The page returned HTTP {response.status}"}
        content = bytearray()
        while True:
            chunk = response.read(16384)
            if not chunk:
                break
            content.extend(chunk)
            if len(content) > MAX_PAGE_BYTES:
                return {"success": False, "error": "Page exceeds the 2 MB fetch limit"}

        soup = BeautifulSoup(bytes(content), "html.parser")

        # Remove scripts, styles, and non-content elements
        for element in soup(["script", "style", "noscript", "header", "footer", "nav", "aside"]):
            element.decompose()

        # Extract text and collapse whitespace
        text = soup.get_text(separator="\n")
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        clean_text = "\n".join(chunk for chunk in chunks if chunk)

        truncated = False
        if len(clean_text) > max_chars:
            clean_text = clean_text[:max_chars]
            truncated = True

        return {
            "success": True,
            "action": "scrape_webpage",
            "url": url,
            "title": soup.title.string.strip() if soup.title and soup.title.string else "",
            "content": clean_text,
            "truncated": truncated,
        }
    except (OSError, http.client.HTTPException, ssl.SSLError, ValueError) as error:
        logger.error("Public page fetch failed: %s", type(error).__name__)
        return {"success": False, "error": "Failed to fetch the public webpage"}
    except Exception as error:
        logger.error("Public page extraction failed: %s", type(error).__name__)
        return {"success": False, "error": "Failed to extract webpage content"}
    finally:
        if connection is not None:
            connection.close()

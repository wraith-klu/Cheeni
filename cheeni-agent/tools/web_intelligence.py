"""
Cheeni Desktop Agent -- Web Intelligence & Live Scraping (Phase 7)

Provides real-time web search, news aggregation, and text extraction:
- Use duckduckgo-search for live queries and latest news.
- Use beautifulsoup4 to extract clean, readable text from a URL for LLM context.
"""

import requests
from typing import Dict, Any
from utils.logging import logger

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

def scrape_webpage(url: str, max_chars: int = 8000) -> Dict[str, Any]:
    """Fetch HTML from a URL and extract clean, readable text."""
    if not BS4_AVAILABLE:
        return {"success": False, "error": "beautifulsoup4 is not installed"}

    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(url, headers=headers, timeout=10)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.content, "html.parser")

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
    except requests.RequestException as re:
        logger.error(f"HTTP request failed for {url}: {re}")
        return {"success": False, "error": f"Failed to fetch webpage: {re}"}
    except Exception as e:
        logger.error(f"Scraping error: {e}")
        return {"success": False, "error": str(e)}

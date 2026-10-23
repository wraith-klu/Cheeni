"""
Cheeni Desktop Agent -- Cloud Connectors (V18)
OAuth-based connectors for Gmail, Google Calendar, Slack, Notion, and Outlook.

Tokens are stored locally under cheeni-agent/data/connectors/<service>.json
No cloud storage -- fully local-first.

Usage:
    from tools.connectors import ConnectorRegistry
    reg = ConnectorRegistry()
    await reg.connect("gdrive")         # opens browser OAuth flow
    emails = await reg.gmail_unread()   # fetch unread emails
    events = await reg.calendar_today() # fetch today's events
"""

import os
import json
import time
import asyncio
import webbrowser
from pathlib import Path
from typing import Any
from utils.logging import logger

# ── Storage paths ──────────────────────────────────────────────────────────────
_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "connectors"
_DATA_DIR.mkdir(parents=True, exist_ok=True)

# ── Optional deps (graceful fallback) ─────────────────────────────────────────
try:
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build as _gapi_build
    GOOGLE_OK = True
except ImportError:
    GOOGLE_OK = False
    logger.warning("[Connectors] google-api-python-client not installed. Gmail/Calendar disabled.")
    logger.warning("  pip install google-api-python-client google-auth-oauthlib")

try:
    import slack_sdk
    from slack_sdk.web.async_client import AsyncWebClient as SlackClient
    SLACK_OK = True
except ImportError:
    SLACK_OK = False

try:
    import httpx
    HTTPX_OK = True
except ImportError:
    HTTPX_OK = False


# ── Google OAuth scopes ────────────────────────────────────────────────────────
GDRIVE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/tasks.readonly",
]

GOOGLE_CREDS_PATH = Path(
    os.getenv("GOOGLE_CREDENTIALS_JSON", str(_DATA_DIR / "google_credentials.json"))
)
GOOGLE_TOKEN_PATH = _DATA_DIR / "google_token.json"


# ── Connector Registry ─────────────────────────────────────────────────────────

class ConnectorRegistry:
    """
    Central registry for all cloud connectors.
    Handles OAuth flows, token persistence, and API calls.
    """

    SUPPORTED = ["gdrive", "gmail", "gcalendar", "slack", "notion", "outlook"]

    def __init__(self):
        self._google_creds: Any = None
        self._slack_client: Any = None

    # ── Connect / Auth ─────────────────────────────────────────────────────────

    async def connect(self, service: str) -> dict:
        """Initiate OAuth flow for a connector service."""
        service = service.lower().strip()
        if service not in self.SUPPORTED:
            return {"ok": False, "error": f"Unknown service '{service}'. Supported: {self.SUPPORTED}"}

        if service in ("gdrive", "gmail", "gcalendar"):
            return await self._connect_google()
        elif service == "slack":
            return await self._connect_slack()
        elif service == "notion":
            return await self._connect_notion()
        elif service == "outlook":
            return await self._connect_outlook()
        return {"ok": False, "error": "Not implemented"}

    async def _connect_google(self) -> dict:
        """Run Google OAuth2 installed-app flow and persist token."""
        if not GOOGLE_OK:
            return {"ok": False, "error": "google-api-python-client not installed"}
        if not GOOGLE_CREDS_PATH.exists():
            return {
                "ok": False,
                "error": (
                    f"Google credentials file not found at {GOOGLE_CREDS_PATH}. "
                    "Download your OAuth2 client_secret JSON from Google Cloud Console "
                    "and save it as: cheeni-agent/data/connectors/google_credentials.json"
                )
            }
        try:
            flow = InstalledAppFlow.from_client_secrets_file(
                str(GOOGLE_CREDS_PATH), GDRIVE_SCOPES
            )
            creds = flow.run_local_server(port=0, open_browser=True)
            # Persist token
            GOOGLE_TOKEN_PATH.write_text(creds.to_json())
            self._google_creds = creds
            logger.info("[Connectors] Google OAuth complete. Token saved.")
            return {"ok": True, "service": "gdrive", "scopes": GDRIVE_SCOPES}
        except Exception as e:
            logger.error(f"[Connectors] Google OAuth failed: {e}")
            return {"ok": False, "error": str(e)}

    async def _connect_slack(self) -> dict:
        """Save Slack bot token from env / prompt user."""
        token = os.getenv("SLACK_BOT_TOKEN", "")
        if not token:
            return {
                "ok": False,
                "error": "Set SLACK_BOT_TOKEN in cheeni-agent/.env with your Slack Bot Token."
            }
        token_file = _DATA_DIR / "slack_token.json"
        token_file.write_text(json.dumps({"token": token, "saved_at": time.time()}))
        logger.info("[Connectors] Slack token saved.")
        return {"ok": True, "service": "slack"}

    async def _connect_notion(self) -> dict:
        """Save Notion integration token."""
        token = os.getenv("NOTION_TOKEN", "")
        if not token:
            return {
                "ok": False,
                "error": "Set NOTION_TOKEN in cheeni-agent/.env with your Notion integration secret."
            }
        token_file = _DATA_DIR / "notion_token.json"
        token_file.write_text(json.dumps({"token": token, "saved_at": time.time()}))
        return {"ok": True, "service": "notion"}

    async def _connect_outlook(self) -> dict:
        """Guide user to Outlook OAuth (MSAL)."""
        return {
            "ok": False,
            "error": (
                "Outlook connector requires Azure app registration. "
                "Set OUTLOOK_CLIENT_ID and OUTLOOK_CLIENT_SECRET in .env, "
                "then retry. See: aka.ms/msal-python"
            )
        }

    # ── List / Status ──────────────────────────────────────────────────────────

    def list_connected(self) -> list[dict]:
        """Return all connected (token-present) services."""
        connected = []
        # Google
        if GOOGLE_TOKEN_PATH.exists():
            try:
                data = json.loads(GOOGLE_TOKEN_PATH.read_text())
                expiry = data.get("expiry", "unknown")
                connected.append({"service": "gdrive", "status": "connected", "expiry": expiry})
            except Exception:
                connected.append({"service": "gdrive", "status": "token_corrupt"})
        # Slack
        slack_file = _DATA_DIR / "slack_token.json"
        if slack_file.exists():
            connected.append({"service": "slack", "status": "connected"})
        # Notion
        notion_file = _DATA_DIR / "notion_token.json"
        if notion_file.exists():
            connected.append({"service": "notion", "status": "connected"})
        return connected

    # ── Google API helpers ─────────────────────────────────────────────────────

    def _get_google_creds(self) -> Any:
        """Load or refresh Google credentials from stored token."""
        if not GOOGLE_OK:
            return None
        if self._google_creds and self._google_creds.valid:
            return self._google_creds
        if GOOGLE_TOKEN_PATH.exists():
            try:
                creds = Credentials.from_authorized_user_file(
                    str(GOOGLE_TOKEN_PATH), GDRIVE_SCOPES
                )
                if creds.expired and creds.refresh_token:
                    from google.auth.transport.requests import Request
                    creds.refresh(Request())
                    GOOGLE_TOKEN_PATH.write_text(creds.to_json())
                self._google_creds = creds
                return creds
            except Exception as e:
                logger.error(f"[Connectors] Failed to load Google token: {e}")
        return None

    # ── Gmail ──────────────────────────────────────────────────────────────────

    async def gmail_unread(self, max_results: int = 10) -> list[dict]:
        """Fetch unread emails from Gmail."""
        creds = self._get_google_creds()
        if not creds:
            return [{"error": "Not connected to Gmail. Run: connect gdrive"}]
        try:
            service = _gapi_build("gmail", "v1", credentials=creds)
            results = service.users().messages().list(
                userId="me", q="is:unread", maxResults=max_results
            ).execute()
            messages = results.get("messages", [])
            emails = []
            for msg in messages[:max_results]:
                detail = service.users().messages().get(
                    userId="me", id=msg["id"], format="metadata",
                    metadataHeaders=["Subject", "From", "Date"]
                ).execute()
                headers = {h["name"]: h["value"] for h in detail.get("payload", {}).get("headers", [])}
                emails.append({
                    "id": msg["id"],
                    "subject": headers.get("Subject", "(no subject)"),
                    "from": headers.get("From", "unknown"),
                    "date": headers.get("Date", ""),
                    "snippet": detail.get("snippet", ""),
                })
            logger.info(f"[Connectors] Gmail: fetched {len(emails)} unread emails")
            return emails
        except Exception as e:
            logger.error(f"[Connectors] Gmail fetch error: {e}")
            return [{"error": str(e)}]

    # ── Google Calendar ────────────────────────────────────────────────────────

    async def calendar_today(self) -> list[dict]:
        """Fetch today's calendar events."""
        import datetime as dt
        creds = self._get_google_creds()
        if not creds:
            return [{"error": "Not connected to Calendar. Run: connect gdrive"}]
        try:
            service = _gapi_build("calendar", "v3", credentials=creds)
            now = dt.datetime.utcnow()
            start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat() + "Z"
            end = now.replace(hour=23, minute=59, second=59).isoformat() + "Z"
            result = service.events().list(
                calendarId="primary",
                timeMin=start,
                timeMax=end,
                singleEvents=True,
                orderBy="startTime",
            ).execute()
            events = []
            for e in result.get("items", []):
                start_info = e.get("start", {})
                events.append({
                    "summary": e.get("summary", "(untitled)"),
                    "start": start_info.get("dateTime", start_info.get("date", "")),
                    "location": e.get("location", ""),
                    "description": (e.get("description", "") or "")[:200],
                })
            logger.info(f"[Connectors] Calendar: fetched {len(events)} events for today")
            return events
        except Exception as e:
            logger.error(f"[Connectors] Calendar fetch error: {e}")
            return [{"error": str(e)}]

    # ── Slack ──────────────────────────────────────────────────────────────────

    async def slack_unread(self, channel: str | None = None, limit: int = 5) -> list[dict]:
        """Fetch recent Slack messages from DMs or a channel."""
        if not SLACK_OK:
            return [{"error": "slack-sdk not installed. pip install slack-sdk"}]
        slack_file = _DATA_DIR / "slack_token.json"
        if not slack_file.exists():
            return [{"error": "Not connected to Slack. Run: connect slack"}]
        token = json.loads(slack_file.read_text()).get("token")
        try:
            client = SlackClient(token=token)
            if channel:
                response = await client.conversations_history(channel=channel, limit=limit)
                messages = response.get("messages", [])
            else:
                # Get IMs
                ims = await client.conversations_list(types="im", limit=10)
                messages = []
                for ch in (ims.get("channels") or [])[:3]:
                    hist = await client.conversations_history(channel=ch["id"], limit=limit)
                    messages.extend(hist.get("messages", []))
            return [{"text": m.get("text", ""), "ts": m.get("ts", "")} for m in messages[:limit]]
        except Exception as e:
            logger.error(f"[Connectors] Slack error: {e}")
            return [{"error": str(e)}]

    # ── Notion ─────────────────────────────────────────────────────────────────

    async def notion_search(self, query: str = "", limit: int = 5) -> list[dict]:
        """Search Notion workspace for recent pages/blocks."""
        if not HTTPX_OK:
            return [{"error": "httpx not installed"}]
        notion_file = _DATA_DIR / "notion_token.json"
        if not notion_file.exists():
            return [{"error": "Not connected to Notion. Run: connect notion"}]
        token = json.loads(notion_file.read_text()).get("token")
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(
                    "https://api.notion.com/v1/search",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "Notion-Version": "2022-06-28",
                    },
                    json={"query": query, "page_size": limit},
                )
                if resp.status_code == 200:
                    results = resp.json().get("results", [])
                    pages = []
                    for r in results:
                        title = ""
                        props = r.get("properties", {})
                        for p in props.values():
                            if p.get("type") == "title":
                                parts = p.get("title", [])
                                title = "".join(t.get("plain_text", "") for t in parts)
                                break
                        if not title:
                            title = r.get("url", "")
                        pages.append({"title": title, "url": r.get("url", ""), "type": r.get("object", "")})
                    return pages
        except Exception as e:
            logger.error(f"[Connectors] Notion error: {e}")
            return [{"error": str(e)}]
        return []


# ── Module-level singleton ─────────────────────────────────────────────────────
_registry: ConnectorRegistry | None = None


def get_connector_registry() -> ConnectorRegistry:
    global _registry
    if _registry is None:
        _registry = ConnectorRegistry()
    return _registry

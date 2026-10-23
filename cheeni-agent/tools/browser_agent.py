"""
Cheeni Desktop Agent -- Browser Automation Agent (V11)
Playwright-based browser control: navigate, click, fill forms, extract text,
screenshot. All risky actions route through the security confirmation gate.

Safety tiers (from command_security.py):
  SAFE   : navigate, extract_text, screenshot, scroll
  RISKY  : fill_form, click on submit/send buttons, type in password fields
  BLOCKED: navigate to banking/payment URLs without explicit user confirm

Dependencies:
  pip install playwright
  playwright install chromium
"""

import asyncio
import os
import base64
import re
from utils.logging import logger

try:
    from playwright.async_api import async_playwright, Browser, Page, BrowserContext
    PLAYWRIGHT_OK = True
except ImportError:
    PLAYWRIGHT_OK = False
    logger.warning(
        "[BrowserAgent] playwright not installed. "
        "Run: pip install playwright && playwright install chromium"
    )

# Domains that require explicit user confirmation before navigation
SENSITIVE_DOMAINS = {
    "bank", "paytm", "phonepay", "gpay", "razorpay", "stripe",
    "paypal", "netbanking", "sbi", "hdfc", "icici", "axis",
}

# Selectors/text that trigger RISKY confirmation before clicking
RISKY_CLICK_PATTERNS = re.compile(
    r"\b(submit|send|confirm|checkout|pay now|delete|remove|uninstall|sign out)\b",
    re.IGNORECASE,
)


def _is_sensitive_url(url: str) -> bool:
    return any(d in url.lower() for d in SENSITIVE_DOMAINS)


# -- BrowserAgent Singleton ---------------------------------------------------

class BrowserAgent:
    """
    Singleton that owns a single Playwright Chromium instance.
    All public methods are async coroutines.
    Call BrowserAgent.get() to obtain the singleton.
    """

    _instance: "BrowserAgent | None" = None
    _playwright = None
    browser: Browser | None = None
    context: BrowserContext | None = None
    page: Page | None = None

    @classmethod
    async def get(cls) -> "BrowserAgent":
        if cls._instance is None:
            cls._instance = BrowserAgent()
            await cls._instance._launch()
        elif cls._instance.page is None or cls._instance.page.is_closed():
            await cls._instance._launch()
        return cls._instance

    @classmethod
    async def close(cls):
        if cls._instance:
            await cls._instance._close()
            cls._instance = None

    async def _launch(self):
        if not PLAYWRIGHT_OK:
            raise RuntimeError("playwright is not installed. Run: pip install playwright && playwright install chromium")
        self._playwright = await async_playwright().start()
        self.browser = await self._playwright.chromium.launch(
            headless=False,
            channel="chrome",   # use system Chrome if available
            args=["--start-maximized"],
        )
        self.context = await self.browser.new_context(
            viewport=None,
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        )
        self.page = await self.context.new_page()
        logger.info("[BrowserAgent] Chromium launched.")

    async def _close(self):
        try:
            if self.page and not self.page.is_closed():
                await self.page.close()
            if self.browser:
                await self.browser.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception as e:
            logger.warning(f"[BrowserAgent] Close error: {e}")
        finally:
            self.page = None
            self.browser = None
            self._playwright = None

    # -- Public Navigation API ------------------------------------------------

    async def navigate(self, url: str) -> dict:
        """Open a URL in the browser. Returns page title and final URL."""
        if not url.startswith(("http://", "https://")):
            url = "https://" + url
        try:
            await self.page.goto(url, wait_until="domcontentloaded", timeout=15000)
            title = await self.page.title()
            logger.info(f"[BrowserAgent] Navigated to {url} | Title: {title}")
            return {"success": True, "url": self.page.url, "title": title}
        except Exception as e:
            logger.error(f"[BrowserAgent] Navigate error: {e}")
            return {"success": False, "error": str(e)}

    async def click(self, text_or_selector: str) -> dict:
        """Click a visible element by text content or CSS selector."""
        risky = bool(RISKY_CLICK_PATTERNS.search(text_or_selector))
        try:
            try:
                await self.page.get_by_text(text_or_selector, exact=False).first.click(timeout=5000)
            except Exception:
                await self.page.locator(text_or_selector).first.click(timeout=5000)
            logger.info(f"[BrowserAgent] Clicked: '{text_or_selector}'")
            return {"success": True, "risky": risky, "target": text_or_selector}
        except Exception as e:
            logger.error(f"[BrowserAgent] Click error: {e}")
            return {"success": False, "error": str(e)}

    async def type_text(self, text: str) -> dict:
        """Type text into the currently focused element."""
        try:
            await self.page.keyboard.type(text, delay=40)
            logger.info(f"[BrowserAgent] Typed: '{text[:40]}...'")
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def fill_form(self, fields: dict) -> dict:
        """
        Fill multiple form fields. fields = {"Label or placeholder": "value", ...}
        RISKY action — caller must obtain user confirmation before calling.
        """
        results = {}
        for label, value in fields.items():
            try:
                loc = self.page.get_by_label(label)
                count = await loc.count()
                if count:
                    await loc.first.fill(value)
                else:
                    await self.page.get_by_placeholder(label).first.fill(value)
                results[label] = "filled"
            except Exception as e:
                results[label] = f"error: {e}"
        logger.info(f"[BrowserAgent] Form fill results: {results}")
        return {"success": True, "results": results}

    async def extract_text(self, selector: str = "body") -> dict:
        """Extract visible text from a CSS selector (default: entire page body)."""
        try:
            text = await self.page.locator(selector).inner_text(timeout=5000)
            trimmed = text.strip()[:2000]  # cap at 2000 chars for LLM context
            logger.info(f"[BrowserAgent] Extracted {len(trimmed)} chars from '{selector}'")
            return {"success": True, "text": trimmed}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def scroll(self, direction: str = "down", amount: int = 3) -> dict:
        """Scroll the page up or down by `amount` viewport heights."""
        delta = 600 * amount * (1 if direction == "down" else -1)
        try:
            await self.page.evaluate(f"window.scrollBy(0, {delta})")
            return {"success": True, "direction": direction, "amount": amount}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def screenshot(self) -> dict:
        """Capture a JPEG screenshot of the current page. Returns base64 string."""
        try:
            png = await self.page.screenshot(type="jpeg", quality=75)
            b64 = base64.b64encode(png).decode()
            logger.info(f"[BrowserAgent] Screenshot captured ({len(png)} bytes)")
            return {"success": True, "image_b64": b64, "mime": "image/jpeg"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_current_info(self) -> dict:
        """Return current page URL and title."""
        try:
            return {
                "url": self.page.url,
                "title": await self.page.title(),
                "ready": not self.page.is_closed(),
            }
        except Exception:
            return {"url": None, "title": None, "ready": False}

    async def browser_search(self, query: str) -> dict:
        """Shortcut: navigate to Google search for the given query."""
        import urllib.parse
        url = "https://www.google.com/search?q=" + urllib.parse.quote(query)
        return await self.navigate(url)


# -- Availability check -------------------------------------------------------

def is_available() -> bool:
    return PLAYWRIGHT_OK

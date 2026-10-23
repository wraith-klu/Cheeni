"""
Cheeni Desktop Agent -- Morning Digest Agent (V17)
Reads Gmail, Calendar, Slack and generates a JARVIS-style spoken morning brief.

Features:
  - Summarises unread emails (who's waiting, what matters)
  - Lists today's calendar events
  - Pulls Slack DMs if connected
  - Speaks the digest using the active TTS engine
  - Scheduler: run daily at a cron-like time (e.g. "07:00")

Usage (API):
    POST /api/digest/now          -> build + speak brief immediately
    POST /api/digest/text         -> build brief, return text only
    POST /api/digest/schedule     -> set daily schedule (body: {"time": "07:00"})
    DELETE /api/digest/schedule   -> cancel schedule
    GET  /api/digest/status       -> current schedule + last run info
"""

import os
import asyncio
import threading
from datetime import datetime, timezone
from utils.logging import logger

# Internal deps
from tools.connectors import get_connector_registry
from core.llm_router import call_llm

# ── Config from env ────────────────────────────────────────────────────────────
AGENT_NAME = os.getenv("AGENT_NAME", "Sam")
DIGEST_TIMEZONE = os.getenv("DIGEST_TIMEZONE", "Asia/Kolkata")
DIGEST_HONORIFIC = os.getenv("DIGEST_HONORIFIC", "sir")
DIGEST_SECTIONS = os.getenv("DIGEST_SECTIONS", "calendar,gmail").split(",")


# ── DigestAgent ────────────────────────────────────────────────────────────────

class DigestAgent:
    """
    Morning brief agent: gathers data from connectors and narrates a summary.
    """

    def __init__(self):
        self._schedule_task: asyncio.Task | None = None
        self._schedule_time: str | None = None          # "HH:MM" 24-hour
        self._last_run: str | None = None
        self._last_digest: str | None = None
        self._running = False

    # ── Public API ─────────────────────────────────────────────────────────────

    async def build_digest(self, text_only: bool = False) -> dict:
        """
        Build the morning digest.
        Returns {"text": "...", "spoken": True/False}
        """
        logger.info("[DigestAgent] Building morning digest...")
        self._running = True

        sections = []

        # Greeting
        hour = datetime.now().hour
        greeting = (
            "Good morning" if hour < 12
            else "Good afternoon" if hour < 17
            else "Good evening"
        )
        sections.append(f"{greeting}, {DIGEST_HONORIFIC}. This is your briefing.")

        reg = get_connector_registry()

        # ── Calendar section ───────────────────────────────────────────────────
        if "calendar" in DIGEST_SECTIONS:
            events = await reg.calendar_today()
            if events and "error" not in events[0]:
                if events:
                    event_lines = []
                    for e in events[:5]:
                        start = e.get("start", "")
                        if "T" in start:
                            start = start.split("T")[1][:5]  # HH:MM
                        event_lines.append(f"  - {start}: {e['summary']}")
                    sections.append(
                        f"Today's calendar has {len(events)} event(s):\n" + "\n".join(event_lines)
                    )
                else:
                    sections.append("Your calendar is clear for today.")
            else:
                sections.append("Calendar not connected — run: connect gdrive")

        # ── Gmail section ──────────────────────────────────────────────────────
        if "gmail" in DIGEST_SECTIONS:
            emails = await reg.gmail_unread(max_results=20)
            if emails and "error" not in emails[0]:
                count = len(emails)
                # Build LLM summary of emails
                email_summary_input = "\n".join(
                    f"From: {e['from']} | Subject: {e['subject']} | {e['snippet'][:80]}"
                    for e in emails[:10]
                )
                llm_prompt = (
                    f"Summarize these {count} unread emails in 3-5 sentences. "
                    f"Highlight anything urgent, who's waiting for a reply, and what can be ignored.\n\n"
                    f"{email_summary_input}"
                )
                summary = await call_llm(
                    messages=[{"role": "user", "content": llm_prompt}],
                    system=f"You are {AGENT_NAME}, a concise personal AI assistant.",
                    max_tokens=200,
                )
                if summary:
                    sections.append(f"You have {count} unread emails. {summary}")
                else:
                    sections.append(f"You have {count} unread emails.")
            else:
                sections.append("Gmail not connected — run: connect gdrive")

        # ── Slack section ──────────────────────────────────────────────────────
        if "slack" in DIGEST_SECTIONS:
            messages = await reg.slack_unread(limit=5)
            if messages and "error" not in messages[0]:
                sections.append(f"Slack: {len(messages)} new direct messages pending.")
            # Silently skip if not connected

        # ── Closing ───────────────────────────────────────────────────────────
        sections.append(f"That's your briefing, {DIGEST_HONORIFIC}. Have a productive day.")

        digest_text = "\n\n".join(sections)
        self._last_digest = digest_text
        self._last_run = datetime.now(timezone.utc).isoformat()
        self._running = False

        logger.info("[DigestAgent] Digest ready.")

        # Speak if not text_only
        spoken = False
        if not text_only:
            spoken = await self._speak(digest_text)

        return {"text": digest_text, "spoken": spoken}

    async def _speak(self, text: str) -> bool:
        """Dispatch to the active TTS engine (Kokoro > EdgeTTS > pyttsx3)."""
        try:
            # Try Kokoro first
            from voice.kokoro_speaker import get_kokoro_speaker
            kokoro = get_kokoro_speaker()
            if kokoro.available:
                kokoro.speak(text)
                return True
        except ImportError:
            pass

        try:
            # Try EdgeTTS
            from voice.edge_speaker import get_edge_speaker
            edge = get_edge_speaker()
            await edge.speak_async(text)
            return True
        except Exception:
            pass

        try:
            # Fallback to pyttsx3
            from voice.speaker import get_speaker
            spk = get_speaker()
            if spk._running:
                spk.speak(text)
                return True
        except Exception:
            pass

        logger.warning("[DigestAgent] No TTS engine available for speaking digest.")
        return False

    # ── Scheduler ─────────────────────────────────────────────────────────────

    def set_schedule(self, time_str: str):
        """
        Schedule daily digest at HH:MM (24-hour, local time).
        e.g. set_schedule("07:00")
        """
        self._schedule_time = time_str
        if self._schedule_task and not self._schedule_task.done():
            self._schedule_task.cancel()
        # Start the scheduler coroutine
        try:
            loop = asyncio.get_event_loop()
            self._schedule_task = loop.create_task(self._daily_loop(time_str))
            logger.info(f"[DigestAgent] Scheduled daily digest at {time_str}")
        except RuntimeError:
            # No running loop — start in thread
            threading.Thread(
                target=asyncio.run,
                args=(self._daily_loop(time_str),),
                daemon=True,
                name="DigestScheduler",
            ).start()

    def cancel_schedule(self):
        """Cancel the daily digest schedule."""
        self._schedule_time = None
        if self._schedule_task and not self._schedule_task.done():
            self._schedule_task.cancel()
            self._schedule_task = None
        logger.info("[DigestAgent] Schedule cancelled.")

    async def _daily_loop(self, time_str: str):
        """Async loop: wait until HH:MM, run digest, repeat."""
        while self._schedule_time == time_str:
            now = datetime.now()
            target_h, target_m = map(int, time_str.split(":"))
            target = now.replace(hour=target_h, minute=target_m, second=0, microsecond=0)
            if target <= now:
                import datetime as dt
                target += dt.timedelta(days=1)
            wait_secs = (target - now).total_seconds()
            logger.info(f"[DigestAgent] Next digest in {wait_secs/3600:.1f}h at {time_str}")
            await asyncio.sleep(wait_secs)
            try:
                await self.build_digest(text_only=False)
            except Exception as e:
                logger.error(f"[DigestAgent] Scheduled run failed: {e}")

    def get_status(self) -> dict:
        return {
            "scheduled": self._schedule_time is not None,
            "schedule_time": self._schedule_time,
            "last_run": self._last_run,
            "running": self._running,
            "sections": DIGEST_SECTIONS,
            "honorific": DIGEST_HONORIFIC,
            "timezone": DIGEST_TIMEZONE,
        }


# ── Module-level singleton ─────────────────────────────────────────────────────
_digest_agent: DigestAgent | None = None


def get_digest_agent() -> DigestAgent:
    global _digest_agent
    if _digest_agent is None:
        _digest_agent = DigestAgent()
    return _digest_agent

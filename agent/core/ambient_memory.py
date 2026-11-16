"""
Capability 14 — Ambient Working Memory (Active Window & Clipboard Context)
--------------------------------------------------------------------------
Passively observes the active application title, window state, and
clipboard history in an ephemeral local cache — nothing is uploaded
to the cloud.

STATUS: Stub — full implementation in sprint 2.
"""

import logging

logger = logging.getLogger("cheeni.ambient_memory")


class AmbientMemory:
    """
    Passive context observer.

    Planned stack:
        Active window : pygetwindow (Windows) / ewmh (Linux)
        Clipboard     : pyperclip (polling) + win32clipboard hook
        Storage       : In-memory ring buffer (last 20 entries, never persisted)
        Privacy       : Zero network calls, ephemeral only, cleared on shutdown
    """

    def __init__(self):
        self._ring: list[dict] = []
        logger.info("👁️ AmbientMemory stub initialised — passive monitoring not yet active")

    @property
    def active_window(self) -> str | None:
        """Return the title of the currently focused window."""
        try:
            import pygetwindow as gw  # type: ignore
            w = gw.getActiveWindow()
            return w.title if w else None
        except Exception:
            return None

    @property
    def clipboard(self) -> str | None:
        """Return the current clipboard text."""
        try:
            import pyperclip  # type: ignore
            return pyperclip.paste()
        except Exception:
            return None

    def snapshot(self) -> dict:
        """Return a context dict with the current window + clipboard."""
        snap = {
            "active_window": self.active_window,
            "clipboard_preview": (self.clipboard or "")[:500],
        }
        self._ring.append(snap)
        if len(self._ring) > 20:
            self._ring.pop(0)
        return snap

    def recent(self, n: int = 5) -> list[dict]:
        """Return the last n context snapshots."""
        return self._ring[-n:]

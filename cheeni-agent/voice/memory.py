"""
Cheeni Desktop Agent -- Conversation Session Memory
Stores the rolling chat history (user + assistant turns) for an active voice session.
Memory is injected into every LLM call for context-aware, multi-turn conversations.
Cleared automatically when the session ends (goodbye / timeout).
"""

import threading
import time
from utils.logging import logger


class ConversationMemory:
    """
    Thread-safe in-memory store for a single conversation session.

    Stores turns as:  {"role": "user"|"assistant", "content": str, "ts": float}

    Usage:
        memory = ConversationMemory(max_turns=10)
        memory.add("user", "What's the battery level?")
        memory.add("assistant", "Your battery is at 74%.")
        context = memory.get_context()   # list[dict] ready for LLM API
        memory.clear()                   # called on session end
    """

    def __init__(self, max_turns: int = 10):
        self._max_turns = max_turns
        self._turns: list[dict] = []
        self._lock = threading.Lock()
        self._session_start: float | None = None

    # ── Public API ─────────────────────────────────────────────────────────────

    def add(self, role: str, content: str) -> None:
        """
        Append a new turn to memory.
        role must be 'user' or 'assistant'.
        Automatically trims to max_turns (oldest removed first).
        """
        if not content or not content.strip():
            return
        with self._lock:
            if self._session_start is None:
                self._session_start = time.time()
            self._turns.append({
                "role": role,
                "content": content.strip(),
                "ts": time.time(),
            })
            # Keep only the last max_turns turns (trim oldest)
            if len(self._turns) > self._max_turns * 2:
                self._turns = self._turns[-(self._max_turns * 2):]
            logger.debug(f"[Memory] +{role}: {content[:60]}... ({len(self._turns)} total turns)")

    def get_context(self, max_turns: int | None = None) -> list[dict]:
        """
        Return turns formatted for LLM API injection.
        Only includes {role, content} -- strips internal timestamp.
        Limited to the last `max_turns` *pairs* (default: self._max_turns).
        """
        with self._lock:
            limit = (max_turns or self._max_turns) * 2   # each pair = 2 entries
            recent = self._turns[-limit:] if len(self._turns) > limit else self._turns[:]
            return [{"role": t["role"], "content": t["content"]} for t in recent]

    def clear(self) -> None:
        """Reset memory -- called on session end (goodbye / timeout)."""
        with self._lock:
            count = len(self._turns)
            self._turns.clear()
            self._session_start = None
            logger.info(f"[Memory] Session cleared. {count} turns discarded.")

    @property
    def turn_count(self) -> int:
        """Total individual turns stored (user + assistant combined)."""
        with self._lock:
            return len(self._turns)

    @property
    def session_duration_sec(self) -> float:
        """How long the current session has been active, in seconds."""
        with self._lock:
            if self._session_start is None:
                return 0.0
            return time.time() - self._session_start

    def summary(self) -> str:
        """Human-readable summary for logs/API response."""
        pairs = len(self._turns) // 2
        dur = self.session_duration_sec
        return f"{pairs} conversation pairs | {len(self._turns)} turns | {dur:.0f}s session"

    def last_user_message(self) -> str | None:
        """Return the most recent user message, or None."""
        with self._lock:
            for t in reversed(self._turns):
                if t["role"] == "user":
                    return t["content"]
            return None

    def last_assistant_message(self) -> str | None:
        """Return the most recent assistant reply, or None."""
        with self._lock:
            for t in reversed(self._turns):
                if t["role"] == "assistant":
                    return t["content"]
            return None


# ── Module-level singleton (shared across the conversation loop) ───────────────
_memory: ConversationMemory | None = None


def get_memory(max_turns: int = 10) -> ConversationMemory:
    global _memory
    if _memory is None:
        _memory = ConversationMemory(max_turns=max_turns)
    return _memory

"""
Cheeni Desktop Agent -- Voice Session State Manager (Step 5, Updated Phase 8)
Manages the hands-free conversation lifecycle:

  IDLE        : Waiting for wake word
  ACTIVATED   : Wake word heard, greeting spoken, waiting for command
  LISTENING   : Microphone is actively recording user speech
  PROCESSING  : Query sent to Cheeni, awaiting AI response
  SPEAKING    : Cheeni is speaking the response via native TTS
  COOLDOWN    : Brief pause after response before looping back to LISTENING

Termination phrases: "goodbye", "bye cheeni", "go to sleep", "stop listening"
Auto-timeout: returns to IDLE after SESSION_TIMEOUT_SEC of silence.
"""

import time
import threading
from enum import Enum
from utils.logging import logger


class VoiceState(str, Enum):
    IDLE        = "idle"
    ACTIVATED   = "activated"
    LISTENING   = "listening"
    PROCESSING  = "processing"
    SPEAKING    = "speaking"    # Cheeni is speaking the reply via native TTS
    COOLDOWN    = "cooldown"


# Phrases that end a voice session
TERMINATION_PHRASES = [
    "goodbye", "bye cheeni", "bye", "go to sleep",
    "stop listening", "sleep", "that's all", "thank you cheeni",
    "thanks cheeni", "exit", "quiet",
]

SESSION_TIMEOUT_SEC  = 30   # Return to IDLE after 30s of inactivity (extended for 2-way chat)
ACTIVATED_TIMEOUT_SEC = 8   # If no speech after wake, go back to IDLE in 8s


class VoiceSessionManager:
    """
    Thread-safe voice session state machine.
    Notifies listeners via on_state_change(new_state: VoiceState).
    """

    def __init__(self, on_state_change=None):
        self._state = VoiceState.IDLE
        self._lock = threading.Lock()
        self._on_state_change = on_state_change or (lambda s: None)
        self._timeout_timer: threading.Timer | None = None

    # ── Public Properties ──────────────────────────────────────────────────────

    @property
    def state(self) -> VoiceState:
        return self._state

    @property
    def is_active(self) -> bool:
        return self._state != VoiceState.IDLE

    # ── State Transitions ──────────────────────────────────────────────────────

    def on_wake_word(self):
        """Called when wake word engine detects 'Hey Cheeni'."""
        with self._lock:
            if self._state == VoiceState.IDLE:
                self._set_state(VoiceState.ACTIVATED)
                self._start_timeout(ACTIVATED_TIMEOUT_SEC, self._timeout_to_idle)
                logger.info("Session ACTIVATED -- waiting for command")

    def on_listening_start(self):
        """Called when microphone opens to capture user speech."""
        with self._lock:
            self._cancel_timeout()
            self._set_state(VoiceState.LISTENING)
            logger.info("Session LISTENING")

    def on_listening_end(self, transcript: str = ""):
        """
        Called when speech recognition returns a transcript.
        Checks for termination phrases; otherwise moves to PROCESSING.
        """
        with self._lock:
            if self._is_termination(transcript):
                logger.info(f"Termination phrase heard: '{transcript}'. Going to IDLE.")
                self._set_state(VoiceState.IDLE)
                return False  # signal: session ended
            self._set_state(VoiceState.PROCESSING)
            logger.info(f"Session PROCESSING: '{transcript}'")
            return True  # signal: continue to AI

    def on_speaking_start(self):
        """Called when Cheeni's TTS starts speaking the response."""
        with self._lock:
            self._cancel_timeout()
            self._set_state(VoiceState.SPEAKING)
            logger.info("Session SPEAKING")

    def on_speaking_end(self):
        """Called when Cheeni's TTS finishes speaking. Alias: on_response_complete."""
        self.on_response_complete()

    def on_response_complete(self):
        """Called after Cheeni finishes speaking the response."""
        with self._lock:
            self._set_state(VoiceState.COOLDOWN)
            # After a short cooldown, go back to ACTIVATED (ready for next command)
            self._start_timeout(1.5, self._return_to_activated)

    def on_error(self):
        """Called on network/AI error -- return to IDLE."""
        with self._lock:
            self._cancel_timeout()
            self._set_state(VoiceState.IDLE)
            logger.warning("Session reset to IDLE due to error.")

    def force_idle(self):
        """Manually force session back to IDLE (e.g. user pressed stop button)."""
        with self._lock:
            self._cancel_timeout()
            self._set_state(VoiceState.IDLE)
            logger.info("Session force-reset to IDLE.")

    def get_status(self) -> dict:
        return {
            "state": self._state.value,
            "is_active": self.is_active,
            "termination_phrases": TERMINATION_PHRASES,
            "session_timeout_sec": SESSION_TIMEOUT_SEC,
        }

    # ── Internal ───────────────────────────────────────────────────────────────

    def _set_state(self, new_state: VoiceState):
        """Internal state transition. Also callable by ConversationLoop for fine-grained control."""
        if self._state != new_state:
            old = self._state
            self._state = new_state
            logger.debug(f"Voice state: {old} -> {new_state}")
            try:
                self._on_state_change(new_state)
            except Exception as e:
                logger.error(f"State change callback error: {e}")

    def _start_timeout(self, seconds: float, callback):
        self._cancel_timeout()
        self._timeout_timer = threading.Timer(seconds, callback)
        self._timeout_timer.daemon = True
        self._timeout_timer.start()

    def _cancel_timeout(self):
        if self._timeout_timer and self._timeout_timer.is_alive():
            self._timeout_timer.cancel()
        self._timeout_timer = None

    def _timeout_to_idle(self):
        with self._lock:
            if self._state in (VoiceState.ACTIVATED, VoiceState.COOLDOWN, VoiceState.LISTENING):
                logger.info("Session timeout -- returning to IDLE.")
                self._set_state(VoiceState.IDLE)

    def _return_to_activated(self):
        with self._lock:
            if self._state == VoiceState.COOLDOWN:
                self._set_state(VoiceState.ACTIVATED)
                self._start_timeout(SESSION_TIMEOUT_SEC, self._timeout_to_idle)

    @staticmethod
    def _is_termination(text: str) -> bool:
        t = (text or "").lower().strip()
        return any(phrase in t for phrase in TERMINATION_PHRASES)


# ── Module-level singleton ──────────────────────────────────────────────────────
_session: VoiceSessionManager | None = None


def get_session() -> VoiceSessionManager:
    global _session
    if _session is None:
        _session = VoiceSessionManager()
    return _session

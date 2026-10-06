"""
Cheeni Desktop Agent -- Interactive Confirmation Loop (Step 8)

Handles the full RISKY command confirmation flow:

  1. Cheeni speaks the warning prompt:
     "This will [action]. Are you sure you want to proceed?"
  2. Waits up to CONFIRM_TIMEOUT_SEC for user voice/text response.
  3. If confirmed -> returns True (caller executes the command).
  4. If cancelled / timed out -> returns False (command is abandoned).

The confirmation state is exposed over the WebSocket so the frontend
can render a confirmation dialog UI in parallel with the voice prompt.
"""

import asyncio
import threading
import time
from typing import Callable, Optional
from utils.logging import logger
from security.command_security import is_confirmation, is_cancellation

CONFIRM_TIMEOUT_SEC = 15   # How long to wait for a yes/no response


class ConfirmationManager:
    """
    Manages a single pending confirmation.
    Thread-safe: voice thread sets the answer, async caller awaits it.
    """

    def __init__(self):
        self._pending: Optional[asyncio.Future] = None
        self._loop:    Optional[asyncio.AbstractEventLoop] = None
        self._lock = threading.Lock()
        self._command_label: str = ""

    # ── Public API ──────────────────────────────────────────────────────────────

    async def request_confirmation(
        self,
        command_label: str,
        speak_fn: Optional[Callable[[str], None]] = None,
        broadcast_fn: Optional[Callable] = None,
    ) -> bool:
        """
        Asks the user to confirm a risky command.

        Args:
            command_label : Short description of the risky action.
            speak_fn      : Optional callable to speak the prompt natively.
            broadcast_fn  : Optional async callable to notify WebSocket clients.

        Returns:
            True  -> user confirmed, proceed.
            False -> user cancelled or timed out, abort.
        """
        self._loop = asyncio.get_event_loop()
        prompt = (
            f"Hold on! This will {command_label}. "
            f"Are you sure you want to proceed? "
            f"Say yes to confirm, or no to cancel."
        )

        # Speak the warning natively
        if speak_fn:
            speak_fn(prompt)

        # Notify frontend via WebSocket
        if broadcast_fn:
            await broadcast_fn({
                "event":         "confirmation_required",
                "command_label": command_label,
                "prompt":        prompt,
                "timeout_sec":   CONFIRM_TIMEOUT_SEC,
            })

        # Create a future the answer will be resolved into
        with self._lock:
            self._pending = self._loop.create_future()
            self._command_label = command_label

        logger.info(f"[CONFIRM] Waiting for confirmation: '{command_label}' (timeout={CONFIRM_TIMEOUT_SEC}s)")

        # Wait for answer or timeout
        try:
            result = await asyncio.wait_for(
                asyncio.shield(self._pending),
                timeout=CONFIRM_TIMEOUT_SEC,
            )
        except asyncio.TimeoutError:
            logger.warning(f"[CONFIRM] Timed out waiting for confirmation of '{command_label}'. Aborting.")
            result = False
            if speak_fn:
                speak_fn("No response received. I'll cancel that action to keep you safe.")
        finally:
            with self._lock:
                self._pending = None
                self._command_label = ""

        if broadcast_fn:
            await broadcast_fn({
                "event":   "confirmation_resolved",
                "result":  result,
                "command": command_label,
            })

        return result

    def submit_answer(self, text: str) -> bool:
        """
        Called from the voice thread or HTTP handler when user speaks/types
        their yes/no response.

        Returns True if the answer was accepted (a confirmation was pending),
        False if no confirmation is currently awaited.
        """
        with self._lock:
            if self._pending is None or self._pending.done():
                return False  # no pending confirmation

            confirmed = is_confirmation(text)
            cancelled = is_cancellation(text)

            if confirmed:
                logger.info(f"[CONFIRM] Confirmed: '{text}'")
                self._loop.call_soon_threadsafe(self._pending.set_result, True)
                return True
            elif cancelled:
                logger.info(f"[CONFIRM] Cancelled: '{text}'")
                self._loop.call_soon_threadsafe(self._pending.set_result, False)
                return True
            else:
                logger.debug(f"[CONFIRM] Ambiguous response ignored: '{text}'")
                return False  # not a clear yes/no — keep waiting

    @property
    def is_pending(self) -> bool:
        with self._lock:
            return self._pending is not None and not self._pending.done()

    @property
    def pending_command(self) -> str:
        with self._lock:
            return self._command_label


# ── Module-level singleton ──────────────────────────────────────────────────────
_manager: Optional[ConfirmationManager] = None


def get_confirmation_manager() -> ConfirmationManager:
    global _manager
    if _manager is None:
        _manager = ConfirmationManager()
    return _manager

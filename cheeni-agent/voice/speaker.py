"""
Cheeni Desktop Agent -- Native Windows Speaker Pipeline (Step 6)
Uses pyttsx3 (Windows SAPI / Microsoft voices) to speak responses
natively on the OS -- works even when the browser is closed.

Voice priority: Microsoft Zira (US female) > Hazel (UK) > any female > first available
"""

import threading
import queue
import time
from utils.logging import logger

try:
    import pyttsx3
    PYTTSX3_OK = True
except ImportError:
    PYTTSX3_OK = False
    logger.warning("pyttsx3 not installed. Native speaker disabled. Run: pip install pyttsx3")


# ── Speaker ─────────────────────────────────────────────────────────────────────

class NativeSpeaker:
    """
    Thread-safe TTS speaker that queues utterances and plays them sequentially.
    Runs pyttsx3 in its own dedicated thread (required because pyttsx3 is not
    thread-safe and must run from the thread that initialised it).
    """

    PREFERRED_VOICES = [
        "zira",       # Microsoft Zira -- US English female (Win 10/11)
        "hazel",      # Microsoft Hazel -- UK English female
        "susan",
        "helen",
        "female",
        "woman",
    ]

    def __init__(self, rate: int = 175, pitch_factor: float = 1.0, volume: float = 1.0):
        self._rate = rate
        self._pitch_factor = pitch_factor
        self._volume = volume
        self._engine = None
        self._speech_queue: queue.Queue = queue.Queue()
        self._is_speaking = False
        self._running = False
        self._thread: threading.Thread | None = None
        self._selected_voice_name: str | None = None
        self._available_voices: list[dict] = []

    # ── Public API ───────────────────────────────────────────────────────────────

    def start(self):
        """Start the speaker thread."""
        if not PYTTSX3_OK:
            logger.error("pyttsx3 unavailable -- NativeSpeaker cannot start.")
            return
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True, name="SpeakerThread")
        self._thread.start()
        logger.info("NativeSpeaker started.")

    def stop(self):
        """Stop the speaker thread."""
        self._running = False
        self._speech_queue.put(None)  # sentinel to unblock queue.get()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)

    def speak(self, text: str, interrupt: bool = True):
        """
        Queue text for speaking.
        If interrupt=True, clears the current queue before adding.
        """
        if not PYTTSX3_OK or not self._running:
            return
        if not text or not text.strip():
            return

        clean = self._clean_for_speech(text)
        if interrupt:
            self._clear_queue()
        self._speech_queue.put(clean)
        logger.debug(f"Queued speech: {clean[:60]}...")

    def stop_speaking(self):
        """Interrupt current speech and clear the queue."""
        self._clear_queue()
        if self._engine:
            try:
                self._engine.stop()
            except Exception:
                pass
        self._is_speaking = False

    def set_rate(self, rate: int):
        self._rate = max(80, min(300, rate))

    def set_volume(self, volume: float):
        self._volume = max(0.0, min(1.0, volume))

    def get_voices(self) -> list[dict]:
        return self._available_voices

    def get_status(self) -> dict:
        return {
            "available": PYTTSX3_OK and self._running,
            "is_speaking": self._is_speaking,
            "selected_voice": self._selected_voice_name,
            "rate": self._rate,
            "volume": self._volume,
            "queue_size": self._speech_queue.qsize(),
        }

    # ── Internal ─────────────────────────────────────────────────────────────────

    def _run(self):
        """Speaker thread main loop -- owns the pyttsx3 engine."""
        try:
            try:
                import pythoncom
                pythoncom.CoInitialize()
            except Exception:
                pass
            self._engine = pyttsx3.init()
        except Exception as e:
            logger.error(f"pyttsx3 init failed: {e}")
            self._running = False
            return

        self._load_voices()
        self._apply_settings()

        logger.info(f"Speaker ready. Voice: {self._selected_voice_name} | Rate: {self._rate}")

        while self._running:
            try:
                text = self._speech_queue.get(timeout=0.5)
                if text is None:
                    break  # stop sentinel
                self._is_speaking = True
                try:
                    self._apply_settings()
                    self._engine.say(text)
                    self._engine.runAndWait()
                except Exception as e:
                    logger.error(f"Speech error: {e}")
                finally:
                    self._is_speaking = False
            except queue.Empty:
                pass
            except Exception as e:
                logger.error(f"Speaker loop error: {e}")
                time.sleep(0.5)

    def _load_voices(self):
        """Find and set the best available female voice."""
        try:
            voices = self._engine.getProperty("voices")
            self._available_voices = [
                {"id": v.id, "name": v.name, "lang": v.languages}
                for v in voices
            ]

            # Try preferred voices in order
            for pref in self.PREFERRED_VOICES:
                for v in voices:
                    if pref.lower() in v.name.lower():
                        self._engine.setProperty("voice", v.id)
                        self._selected_voice_name = v.name
                        return

            # Fallback: first voice
            if voices:
                self._engine.setProperty("voice", voices[0].id)
                self._selected_voice_name = voices[0].name
        except Exception as e:
            logger.error(f"Voice loading error: {e}")

    def _apply_settings(self):
        try:
            self._engine.setProperty("rate", self._rate)
            self._engine.setProperty("volume", self._volume)
        except Exception:
            pass

    def _clear_queue(self):
        while not self._speech_queue.empty():
            try:
                self._speech_queue.get_nowait()
            except queue.Empty:
                break

    @staticmethod
    def _clean_for_speech(text: str) -> str:
        """Strip markdown, JSON artifacts, and backslashes before speaking."""
        import re, json
        if not text:
            return ""

        # If text starts with JSON wrapper, extract speechText
        if text.strip().startswith("{") and ("speechText" in text or "textResponse" in text):
            try:
                p = json.loads(text)
                text = p.get("speechText") or p.get("textResponse") or text
            except Exception:
                m = re.search(r'"speechText"\s*:\s*"([^"]+)"', text)
                if m:
                    text = m.group(1)

        # Strip literal escaped backslashes (e.g. \n \r \t)
        text = text.replace(r"\n", " ").replace(r"\r", " ").replace(r"\t", " ").replace(r'\"', '"')
        text = re.sub(r"```[\s\S]*?```", "Code is shown on screen.", text)
        text = re.sub(r"`([^`]+)`", r"\1", text)
        text = re.sub(r"https?://\S+", "link", text)
        text = re.sub(r"^\s*#{1,6}\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\s*[-*]\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"^\s*\d+\.\s+", "", text, flags=re.MULTILINE)
        text = re.sub(r"[*_~|>]", "", text)
        text = re.sub(r"\\", "", text)
        text = re.sub(r"\n{2,}", ". ", text)
        text = re.sub(r"\n", " ", text)
        text = re.sub(r"\.{2,}", ".", text)
        text = re.sub(r"\s{2,}", " ", text)
        return text.strip()


# ── Module-level singleton ──────────────────────────────────────────────────────
_speaker: NativeSpeaker | None = None


def get_speaker() -> NativeSpeaker:
    global _speaker
    if _speaker is None:
        _speaker = NativeSpeaker(rate=170, volume=1.0)
    return _speaker

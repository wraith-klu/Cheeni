"""
Cheeni Desktop Agent -- Kokoro TTS Speaker (V19)
Local, free, high-quality neural TTS via the `kokoro` library.
Voice: bm_george (British male) -- closest to JARVIS.

Install: pip install kokoro sounddevice

Falls back gracefully if kokoro is not installed.
"""

import os
import io
import queue
import threading
from utils.logging import logger

# ── Env config ─────────────────────────────────────────────────────────────────
KOKORO_VOICE   = os.getenv("KOKORO_VOICE", "bm_george")
KOKORO_SPEED   = float(os.getenv("KOKORO_SPEED", "1.0"))
KOKORO_LANG    = os.getenv("KOKORO_LANG", "en-gb")
KOKORO_ENABLED = os.getenv("KOKORO_ENABLED", "true").lower() != "false"

# ── Optional deps ──────────────────────────────────────────────────────────────
try:
    from kokoro import KPipeline
    KOKORO_OK = True
except ImportError:
    KOKORO_OK = False
    logger.warning("[KokoroTTS] kokoro not installed. Run: pip install kokoro")

try:
    import sounddevice as sd
    import numpy as np
    SOUNDDEVICE_OK = True
except ImportError:
    SOUNDDEVICE_OK = False
    logger.warning("[KokoroTTS] sounddevice not installed. Run: pip install sounddevice")


class KokoroSpeaker:
    """
    Thread-safe local neural TTS using Kokoro.
    Queues utterances and plays them via sounddevice.
    """

    def __init__(
        self,
        voice: str = KOKORO_VOICE,
        speed: float = KOKORO_SPEED,
        lang: str = KOKORO_LANG,
    ):
        self._voice = voice
        self._speed = speed
        self._lang = lang
        self._pipeline = None
        self._speech_queue: queue.Queue = queue.Queue()
        self._running = False
        self._thread: threading.Thread | None = None
        self._is_speaking = False

    @property
    def available(self) -> bool:
        return KOKORO_OK and SOUNDDEVICE_OK and KOKORO_ENABLED and self._running

    def start(self):
        """Load the Kokoro pipeline and start the speaker thread."""
        if not KOKORO_OK or not SOUNDDEVICE_OK:
            logger.error("[KokoroTTS] Cannot start -- missing dependencies.")
            return
        if not KOKORO_ENABLED:
            logger.info("[KokoroTTS] Disabled via KOKORO_ENABLED=false")
            return
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(
            target=self._run, daemon=True, name="KokoroSpeakerThread"
        )
        self._thread.start()
        logger.info(f"[KokoroTTS] Started. Voice: {self._voice} | Speed: {self._speed}")

    def stop(self):
        """Stop the speaker thread."""
        self._running = False
        self._speech_queue.put(None)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)

    def speak(self, text: str, interrupt: bool = True):
        """Queue text for speaking."""
        if not self.available:
            logger.warning("[KokoroTTS] Not available, skipping speech.")
            return
        if not text or not text.strip():
            return
        if interrupt:
            self._clear_queue()
        self._speech_queue.put(text.strip())
        logger.debug(f"[KokoroTTS] Queued: {text[:60]}...")

    def stop_speaking(self):
        """Stop current speech and clear queue."""
        self._clear_queue()
        self._is_speaking = False

    def set_voice(self, voice: str):
        self._voice = voice
        logger.info(f"[KokoroTTS] Voice changed to: {voice}")

    def set_speed(self, speed: float):
        self._speed = max(0.5, min(2.0, speed))

    def get_status(self) -> dict:
        return {
            "available": self.available,
            "voice": self._voice,
            "speed": self._speed,
            "lang": self._lang,
            "is_speaking": self._is_speaking,
            "queue_size": self._speech_queue.qsize(),
            "kokoro_installed": KOKORO_OK,
            "sounddevice_installed": SOUNDDEVICE_OK,
        }

    # ── Internal ───────────────────────────────────────────────────────────────

    def _run(self):
        """Speaker thread: loads pipeline and processes speech queue."""
        try:
            logger.info(f"[KokoroTTS] Loading pipeline for lang='{self._lang}'...")
            self._pipeline = KPipeline(lang_code=self._lang)
            logger.info("[KokoroTTS] Pipeline ready.")
        except Exception as e:
            logger.error(f"[KokoroTTS] Pipeline load failed: {e}")
            self._running = False
            return

        while self._running:
            try:
                text = self._speech_queue.get(timeout=0.5)
                if text is None:
                    break
                self._is_speaking = True
                try:
                    self._synthesize_and_play(text)
                except Exception as e:
                    logger.error(f"[KokoroTTS] Synthesis error: {e}")
                finally:
                    self._is_speaking = False
            except queue.Empty:
                pass

    def _synthesize_and_play(self, text: str):
        """Generate audio and play it."""
        import numpy as np

        all_audio = []
        generator = self._pipeline(
            text,
            voice=self._voice,
            speed=self._speed,
            split_pattern=r"\n+",
        )
        for _, _, audio in generator:
            if audio is not None:
                all_audio.append(audio)

        if not all_audio:
            return

        combined = np.concatenate(all_audio)
        # Kokoro outputs at 24000 Hz
        sample_rate = 24000
        logger.info(f"[KokoroTTS] Playing {len(combined)/sample_rate:.1f}s of audio...")
        sd.play(combined, samplerate=sample_rate)
        sd.wait()
        logger.debug("[KokoroTTS] Playback complete.")

    def _clear_queue(self):
        while not self._speech_queue.empty():
            try:
                self._speech_queue.get_nowait()
            except queue.Empty:
                break


# ── Voice presets ──────────────────────────────────────────────────────────────
KOKORO_VOICE_PRESETS = {
    "jarvis":     "bm_george",   # British male -- closest to JARVIS
    "female_us":  "af_sarah",    # US female
    "female_uk":  "bf_emma",     # British female
    "male_us":    "am_adam",     # US male
    "male_uk":    "bm_george",   # British male
}


def list_voice_presets() -> dict:
    return KOKORO_VOICE_PRESETS


# ── Module-level singleton ─────────────────────────────────────────────────────
_kokoro_speaker: KokoroSpeaker | None = None


def get_kokoro_speaker() -> KokoroSpeaker:
    global _kokoro_speaker
    if _kokoro_speaker is None:
        _kokoro_speaker = KokoroSpeaker()
        if KOKORO_ENABLED:
            _kokoro_speaker.start()
    return _kokoro_speaker

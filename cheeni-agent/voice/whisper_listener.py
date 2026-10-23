"""
Cheeni Desktop Agent -- Whisper STT Listener (V10)
Replaces Google SR cloud STT with faster-whisper local transformer inference.

Features:
  - Fully offline -- no internet needed for transcription
  - 30x faster than openai-whisper; uses CTranslate2 runtime
  - Falls back to SpeechRecognition (Google STT) if faster-whisper is unavailable
  - Model loaded once at startup, reused across all calls
  - Configurable via .env:
        WHISPER_MODEL_SIZE=base   (tiny|base|small|medium|large-v3)
        WHISPER_DEVICE=cpu        (cpu|cuda)
        WHISPER_COMPUTE_TYPE=int8 (int8|float16|float32)
        WHISPER_LANGUAGE=en       (ISO 639-1 code, e.g. en, hi, te)
"""

import os
import io
import time
import struct
from utils.logging import logger

# -- faster-whisper availability
try:
    from faster_whisper import WhisperModel as _WhisperModel
    WHISPER_OK = True
except ImportError:
    WHISPER_OK = False
    logger.warning(
        "[WhisperSTT] faster-whisper not installed. "
        "Run: pip install faster-whisper  (falls back to Google SR)"
    )

# -- SpeechRecognition fallback
try:
    import speech_recognition as sr
    SR_OK = True
except ImportError:
    SR_OK = False

# -- Constants (read from .env)
SAMPLE_RATE    = 16000
MODEL_SIZE     = os.getenv("WHISPER_MODEL_SIZE", "base")
DEVICE         = os.getenv("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE   = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
LANGUAGE       = os.getenv("WHISPER_LANGUAGE", "en")
BEAM_SIZE      = int(os.getenv("WHISPER_BEAM_SIZE", "5"))


def _pcm_to_wav_bytes(pcm_bytes: bytes, sample_rate: int = SAMPLE_RATE, channels: int = 1, sample_width: int = 2) -> bytes:
    """Wrap raw PCM (int16, mono) bytes into an in-memory WAV container."""
    buf = io.BytesIO()
    data_size = len(pcm_bytes)
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<H", channels))
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * channels * sample_width))
    buf.write(struct.pack("<H", channels * sample_width))
    buf.write(struct.pack("<H", sample_width * 8))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_bytes)
    buf.seek(0)
    return buf.read()


class WhisperListener:
    """
    Transcribes raw PCM audio bytes using faster-whisper local inference.
    Falls back to Google SR if faster-whisper is unavailable.
    """

    def __init__(self):
        self._model = None
        self._load_error: str | None = None
        self._load_time: float | None = None

    def load_model(self) -> bool:
        """Explicitly load the Whisper model (also called lazily on first transcribe)."""
        if not WHISPER_OK:
            self._load_error = "faster-whisper package not installed"
            return False
        if self._model is not None:
            return True
        t0 = time.time()
        try:
            logger.info(f"[WhisperSTT] Loading model '{MODEL_SIZE}' on {DEVICE} ({COMPUTE_TYPE})...")
            self._model = _WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
            self._load_time = round(time.time() - t0, 2)
            logger.info(f"[WhisperSTT] Model loaded in {self._load_time}s")
            return True
        except Exception as e:
            self._load_error = str(e)
            logger.error(f"[WhisperSTT] Model load failed: {e}")
            return False

    def transcribe(self, pcm_bytes: bytes, language: str = LANGUAGE) -> str | None:
        """
        Transcribe raw PCM (int16, 16kHz, mono) bytes.
        Returns transcribed string or None.
        """
        if not pcm_bytes:
            return None
        if self._model is None:
            if not self.load_model():
                logger.warning("[WhisperSTT] Model unavailable -- falling back to Google SR")
                return self._fallback_sr(pcm_bytes)
        try:
            t0 = time.time()
            wav_io = io.BytesIO(_pcm_to_wav_bytes(pcm_bytes))
            segments, info = self._model.transcribe(
                wav_io,
                language=language,
                beam_size=BEAM_SIZE,
                vad_filter=True,
                vad_parameters={"min_silence_duration_ms": 300, "speech_pad_ms": 100},
                word_timestamps=False,
            )
            text = " ".join(seg.text.strip() for seg in segments).strip()
            latency = round(time.time() - t0, 2)
            if text:
                logger.info(f"[WhisperSTT] '{text}' ({latency}s, lang={info.language})")
                return text
            logger.debug(f"[WhisperSTT] Empty transcript after {latency}s")
            return None
        except Exception as e:
            logger.error(f"[WhisperSTT] Transcription error: {e}")
            return self._fallback_sr(pcm_bytes)

    def get_status(self) -> dict:
        return {
            "backend": "faster-whisper" if self._model else "unavailable",
            "model": MODEL_SIZE if self._model else None,
            "device": DEVICE,
            "compute_type": COMPUTE_TYPE,
            "language": LANGUAGE,
            "load_time_sec": self._load_time,
            "load_error": self._load_error,
            "ok": self._model is not None,
        }

    def _fallback_sr(self, pcm_bytes: bytes) -> str | None:
        """Fallback to Google Cloud STT via SpeechRecognition."""
        if not SR_OK:
            logger.error("[WhisperSTT] Fallback SR also unavailable.")
            return None
        try:
            recognizer = sr.Recognizer()
            audio_data = sr.AudioData(pcm_bytes, SAMPLE_RATE, 2)
            text = recognizer.recognize_google(audio_data, language="en-IN").strip()
            if text:
                logger.info(f"[WhisperSTT][FallbackSR] '{text}'")
            return text or None
        except Exception as e:
            logger.warning(f"[WhisperSTT] Fallback SR failed: {e}")
            return None


# -- Module-level singleton
_whisper_listener: WhisperListener | None = None


def get_whisper_listener() -> WhisperListener:
    global _whisper_listener
    if _whisper_listener is None:
        _whisper_listener = WhisperListener()
    return _whisper_listener

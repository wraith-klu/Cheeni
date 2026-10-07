"""
Cheeni Desktop Agent -- Microphone Listener with Voice Activity Detection (VAD)
Captures a single utterance from the microphone after the wake word fires.

Strategy:
  - Uses webrtcvad (Google's WebRTC VAD) for accurate speech boundary detection
  - Falls back to speech_recognition's built-in energy-based silence detection
  - Returns a transcript string, or None on timeout / no speech / STT failure

Used exclusively by conversation.py's ConversationLoop.
"""

import threading
import time
import queue
import collections
from utils.logging import logger

# ── Availability flags ────────────────────────────────────────────────────────
try:
    import sounddevice as sd
    SOUNDDEVICE_OK = True
except ImportError:
    SOUNDDEVICE_OK = False

try:
    import importlib
    webrtcvad = importlib.import_module("webrtcvad")
    VAD_OK = True
except Exception:
    webrtcvad = None
    VAD_OK = False

try:
    import speech_recognition as sr
    SR_OK = True
except ImportError:
    SR_OK = False
    logger.error("[Listener] SpeechRecognition not installed. pip install SpeechRecognition")

try:
    import numpy as np
    NUMPY_OK = True
except ImportError:
    NUMPY_OK = False

# ── Constants ─────────────────────────────────────────────────────────────────
SAMPLE_RATE      = 16000    # Hz -- required by webrtcvad
FRAME_DURATION   = 30       # ms -- 10, 20, or 30 allowed by webrtcvad
FRAME_SIZE       = int(SAMPLE_RATE * FRAME_DURATION / 1000)  # samples per frame
VAD_AGGRESSIVENESS = 2      # 0=least aggressive, 3=most aggressive
SILENCE_FRAMES_TO_STOP = 20 # ~600ms of silence after speech ends (was 25 = ~750ms)
MAX_RECORD_SECS  = 10       # hard cap -- won't listen longer than this


class MicrophoneListener:
    """
    Opens the microphone and listens for a single complete utterance.
    Returns the transcript as a string, or None on failure/timeout.

    Usage:
        listener = MicrophoneListener()
        text = listener.listen_once(timeout_sec=8)
        if text:
            print(f"User said: {text}")
    """

    def __init__(self):
        self._cancel_event = threading.Event()

    def cancel(self):
        """Signal any active listen_once() call to abort immediately."""
        self._cancel_event.set()

    def listen_once(self, timeout_sec: float = 8.0) -> str | None:
        """
        Block until the user speaks and pauses, then return the STT transcript.
        Uses SpeechRecognition's calibrated microphone stream as primary for
        consistent recognition matching the wake-word engine.
        """
        self._cancel_event.clear()

        # Prioritize SpeechRecognition's calibrated acoustic stream
        if SR_OK:
            text = self._capture_with_sr(timeout_sec)
            if text:
                return text

        if VAD_OK and SOUNDDEVICE_OK and NUMPY_OK:
            raw = self._capture_with_vad(timeout_sec)
            if raw and not self._cancel_event.is_set():
                return self._transcribe(raw)

        return None

    # ── VAD-based capture (primary) ────────────────────────────────────────────

    def _capture_with_vad(self, timeout_sec: float) -> bytes | None:
        """
        Capture audio using WebRTC VAD for precise speech boundary detection.
        Returns raw PCM bytes of the utterance, or None.
        """
        vad = webrtcvad.Vad(VAD_AGGRESSIVENESS)
        audio_buf = queue.Queue()

        def _audio_callback(indata, frames, time_info, status):
            audio_buf.put(bytes(indata))

        frames_spoken: list[bytes] = []
        ring_buffer = collections.deque(maxlen=15)  # ~450ms pre-speech buffer
        triggered = False
        silence_count = 0
        start_time = time.time()
        speech_started_at: float | None = None

        try:
            with sd.RawInputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="int16",
                blocksize=FRAME_SIZE,
                callback=_audio_callback,
            ):
                logger.debug("[Listener] VAD listening...")
                while not self._cancel_event.is_set():
                    elapsed = time.time() - start_time
                    if elapsed > timeout_sec and not triggered:
                        logger.debug("[Listener] Timeout waiting for speech.")
                        return None
                    if triggered and (time.time() - speech_started_at) > MAX_RECORD_SECS:
                        logger.debug("[Listener] Max record duration hit.")
                        break

                    try:
                        frame = audio_buf.get(timeout=0.1)
                    except queue.Empty:
                        continue

                    # Pad/trim to exact frame size (VAD is strict about this)
                    if len(frame) < FRAME_SIZE * 2:
                        frame = frame + b"\x00" * (FRAME_SIZE * 2 - len(frame))
                    frame = frame[:FRAME_SIZE * 2]

                    try:
                        is_speech = vad.is_speech(frame, SAMPLE_RATE)
                    except Exception:
                        is_speech = False

                    if not triggered:
                        ring_buffer.append((frame, is_speech))
                        num_voiced = sum(1 for _, s in ring_buffer if s)
                        if num_voiced > 0.7 * ring_buffer.maxlen:
                            triggered = True
                            speech_started_at = time.time()
                            frames_spoken.extend(f for f, _ in ring_buffer)
                            logger.debug("[Listener] Speech start detected.")
                    else:
                        frames_spoken.append(frame)
                        ring_buffer.append((frame, is_speech))
                        num_unvoiced = sum(1 for _, s in ring_buffer if not s)
                        if num_unvoiced > 0.85 * ring_buffer.maxlen:
                            silence_count += 1
                            if silence_count >= SILENCE_FRAMES_TO_STOP:
                                logger.debug("[Listener] Speech end detected (silence).")
                                break
                        else:
                            silence_count = 0

        except Exception as e:
            logger.error(f"[Listener] VAD capture error: {e}")
            return None

        if not frames_spoken:
            return None

        return b"".join(frames_spoken)

    # ── SR-based capture (fallback) ────────────────────────────────────────────

    def _capture_with_sr(self, timeout_sec: float) -> str | None:
        """
        Fallback: use SpeechRecognition's built-in energy VAD + Google STT.
        Returns transcript directly (skips _transcribe).
        """
        if not SR_OK:
            return None
        recognizer = sr.Recognizer()
        recognizer.dynamic_energy_threshold = True
        recognizer.pause_threshold = 0.6   # 0.6s silence = end of utterance (snappier than 0.8)
        recognizer.non_speaking_duration = 0.4
        mic = sr.Microphone(sample_rate=SAMPLE_RATE)

        try:
            with mic as source:
                # Quick ambient calibration (100ms is enough in conversation context)
                recognizer.adjust_for_ambient_noise(source, duration=0.15)
                try:
                    audio = recognizer.listen(source, timeout=timeout_sec, phrase_time_limit=MAX_RECORD_SECS)
                except sr.WaitTimeoutError:
                    logger.debug("[Listener] SR: No speech in timeout window.")
                    return None
            text = recognizer.recognize_google(audio, language="en-IN").strip()
            if text:
                logger.info(f"[Listener] SR transcript: '{text}'")
                return text
            return None
        except sr.UnknownValueError:
            logger.debug("[Listener] SR: Could not understand audio.")
            return None
        except sr.RequestError as e:
            logger.warning(f"[Listener] SR network error: {e}")
            return None
        except Exception as e:
            logger.error(f"[Listener] SR fallback error: {e}")
            return None

    # ── STT Transcription ──────────────────────────────────────────────────────

    def _transcribe(self, raw_pcm: bytes) -> str | None:
        """
        Convert raw PCM bytes to text using Google STT via SpeechRecognition.
        """
        if not SR_OK:
            logger.error("[Listener] SpeechRecognition unavailable for transcription.")
            return None
        try:
            recognizer = sr.Recognizer()
            audio_data = sr.AudioData(raw_pcm, SAMPLE_RATE, 2)  # 2 bytes = int16
            text = recognizer.recognize_google(audio_data, language="en-IN").strip()
            logger.info(f"[Listener] Transcript: '{text}'")
            return text if text else None
        except sr.UnknownValueError:
            logger.debug("[Listener] STT: Could not understand audio.")
            return None
        except sr.RequestError as e:
            logger.warning(f"[Listener] STT network error: {e}")
            return None
        except Exception as e:
            logger.error(f"[Listener] Transcription error: {e}")
            return None


# ── Module-level singleton ─────────────────────────────────────────────────────
_listener: MicrophoneListener | None = None


def get_listener() -> MicrophoneListener:
    global _listener
    if _listener is None:
        _listener = MicrophoneListener()
    return _listener

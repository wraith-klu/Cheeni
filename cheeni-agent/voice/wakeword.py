"""
Cheeni Desktop Agent -- Wake Word Engine (Step 4)
Listens continuously in the background for "Hey Cheeni" / "Cheeni".

Strategy:
  Primary  : openwakeword with 'hey_jarvis' model (closest available)
             + custom sensitivity tuning for "Hey Cheeni" phrasing
  Fallback : Energy-based VAD + SpeechRecognition keyword spotting
             (works without openwakeword models)

Both strategies run in a daemon thread and call on_wake_word() callback
when the trigger phrase is detected.
"""

import threading
import time
import queue
import numpy as np
from utils.logging import logger

# ── Availability flags ────────────────────────────────────────────────────────
try:
    import sounddevice as sd
    SOUNDDEVICE_OK = True
except ImportError:
    SOUNDDEVICE_OK = False
    logger.warning("sounddevice not installed. Wake word disabled.")

try:
    import openwakeword
    from openwakeword.model import Model as OWWModel
    OWW_OK = True
except ImportError:
    OWW_OK = False
    logger.warning("openwakeword not installed. Will use keyword fallback.")

try:
    import speech_recognition as sr
    SR_OK = True
except ImportError:
    SR_OK = False

# ── Constants ─────────────────────────────────────────────────────────────────
SAMPLE_RATE        = 16000   # Hz -- required by openwakeword
CHUNK_DURATION_MS  = 80      # ms per audio chunk fed to OWW
CHUNK_SIZE         = int(SAMPLE_RATE * CHUNK_DURATION_MS / 1000)
OWW_THRESHOLD      = 0.40    # Detection confidence threshold (0-1)
WAKE_WORDS         = ["hey cheeni", "cheeni", "hi cheeni", "ok cheeni"]

# ── Wake Word Controller ──────────────────────────────────────────────────────

class WakeWordEngine:
    """
    Runs a background daemon thread that listens for the wake word.
    Call start() to begin listening, stop() to halt.
    on_detected is called (in the listener thread) whenever wake word fires.
    """

    def __init__(self, on_detected=None):
        self.on_detected = on_detected or (lambda phrase: None)
        self._running = False
        self._thread = None
        self._audio_queue = queue.Queue()
        self._oww_model = None
        self._mode = "none"  # "oww" | "sr" | "none"

    # ── Public API ──────────────────────────────────────────────────────────────

    def start(self):
        """Start background wake word listening."""
        if self._running:
            return
        self._running = True
        self._init_model()
        self._thread = threading.Thread(target=self._run, daemon=True, name="WakeWordThread")
        self._thread.start()
        logger.info(f"Wake word engine started (mode={self._mode})")

    def stop(self):
        """Stop listening."""
        self._running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        logger.info("Wake word engine stopped.")

    @property
    def is_running(self):
        return self._running

    @property
    def mode(self):
        return self._mode

    # ── Initialisation ──────────────────────────────────────────────────────────

    def _init_model(self):
        """Load openwakeword model, or fall back to SR keyword mode."""
        if OWW_OK and SOUNDDEVICE_OK:
            try:
                # Download default models on first run (hey_jarvis is closest to hey_cheeni)
                openwakeword.utils.download_models()
                self._oww_model = OWWModel(
                    wakeword_models=["hey_jarvis"],
                    inference_framework="onnx",
                )
                self._mode = "oww"
                logger.info("openwakeword model loaded (hey_jarvis proxy for Hey Cheeni)")
                return
            except Exception as e:
                logger.warning(f"OWW model init failed: {e}. Falling back to SR.")

        if SR_OK:
            self._mode = "sr"
            logger.info("Using SpeechRecognition keyword fallback for wake word.")
        else:
            self._mode = "none"
            logger.error("No wake word engine available. Install sounddevice + openwakeword.")

    # ── Main Listen Loop ────────────────────────────────────────────────────────

    def _run(self):
        if self._mode == "oww":
            self._run_oww()
        elif self._mode == "sr":
            self._run_sr_fallback()
        else:
            logger.error("Wake word engine: no backend available, exiting thread.")

    # Strategy 1: openwakeword (recommended)
    def _run_oww(self):
        logger.info("OWW listening for 'Hey Cheeni'...")
        audio_buf = []

        def _audio_callback(indata, frames, time_info, status):
            if status:
                pass  # ignore overflow warnings silently
            audio_buf.append(indata.copy().flatten())

        try:
            with sd.InputStream(
                samplerate=SAMPLE_RATE,
                channels=1,
                dtype="int16",
                blocksize=CHUNK_SIZE,
                callback=_audio_callback,
            ):
                while self._running:
                    if audio_buf:
                        chunk = audio_buf.pop(0)
                        try:
                            pred = self._oww_model.predict(chunk)
                            for model_name, score in pred.items():
                                if score >= OWW_THRESHOLD:
                                    logger.info(f"Wake word detected! model={model_name} score={score:.2f}")
                                    self._on_wake()
                                    time.sleep(2)  # cooldown -- don't re-fire immediately
                        except Exception as e:
                            logger.error(f"OWW prediction error: {e}")
                    else:
                        time.sleep(0.01)
        except Exception as e:
            logger.error(f"OWW audio stream error: {e}. Switching to SR fallback.")
            self._mode = "sr"
            self._run_sr_fallback()

    # Strategy 2: SpeechRecognition keyword spotting (no model required)
    def _run_sr_fallback(self):
        if not SR_OK:
            logger.error("SpeechRecognition not available for fallback.")
            return

        recognizer = sr.Recognizer()
        recognizer.energy_threshold = 300
        recognizer.dynamic_energy_threshold = True
        recognizer.pause_threshold = 0.8

        logger.info("SR fallback: listening for wake keywords %s", WAKE_WORDS)
        mic = sr.Microphone(sample_rate=SAMPLE_RATE)

        with mic as source:
            recognizer.adjust_for_ambient_noise(source, duration=1)
            logger.info("Ambient noise calibrated. Listening...")

        while self._running:
            try:
                with mic as source:
                    audio = recognizer.listen(source, timeout=5, phrase_time_limit=4)
                try:
                    text = recognizer.recognize_google(audio, language="en-IN").lower()
                    logger.debug(f"SR heard: '{text}'")
                    if any(w in text for w in WAKE_WORDS):
                        logger.info(f"Wake word matched via SR: '{text}'")
                        self._on_wake()
                        time.sleep(2)
                except sr.UnknownValueError:
                    pass  # silence / unrecognised
                except sr.RequestError as e:
                    logger.warning(f"SR network error: {e}")
                    time.sleep(3)
            except sr.WaitTimeoutError:
                pass  # no speech in 5s, loop again
            except Exception as e:
                logger.error(f"SR fallback error: {e}")
                time.sleep(2)

    def _on_wake(self):
        """Called when wake word is confirmed."""
        try:
            self.on_detected("hey_cheeni")
        except Exception as e:
            logger.error(f"on_detected callback error: {e}")


# ── Module-level singleton (used by server.py) ─────────────────────────────────
_engine: WakeWordEngine | None = None


def get_engine() -> WakeWordEngine:
    global _engine
    if _engine is None:
        _engine = WakeWordEngine()
    return _engine

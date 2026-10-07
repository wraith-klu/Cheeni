"""
Cheeni Desktop Agent -- Wake Word Engine (Step 4, Updated Phase 9)
Listens continuously in the background for the agent's wake phrase.

Wake phrases are built dynamically from settings.AGENT_NAME so the engine
automatically responds to whatever name the agent is given (Cheeni, Khushi, etc.).
Example phrases for name 'Khushi':
  'hey khushi', 'hi khushi', 'hello khushi', 'ok khushi', 'khushi'

Strategy:
  Primary  : openwakeword with 'hey_jarvis' model (closest available)
             + custom sensitivity tuning
  Fallback : Energy-based VAD + SpeechRecognition keyword spotting
             (works without openwakeword models, handles any name)

Both strategies run in a daemon thread and call on_wake_word() callback
when the trigger phrase is detected.
"""

import threading
import time
import queue
import re
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

# ── Dynamic wake word builder ─────────────────────────────────────────────────
# Default phrases (used when settings can't be loaded)
_DEFAULT_AGENT_NAME = "cheeni"

def build_wake_words(agent_name: str | None = None) -> list[str]:
    """
    Build a complete list of wake phrases for any agent name.
    Includes phonetic variations for names (e.g. Sam -> sem, saem; Khushi -> kushi, khusi)
    so Google STT matches consistently regardless of spelling or accent.
    """
    try:
        if agent_name is None:
            from config.settings import settings
            agent_name = settings.AGENT_NAME
    except Exception:
        agent_name = _DEFAULT_AGENT_NAME

    name = agent_name.lower().strip()
    names = [name]

    # Add common phonetic spellings & variations
    # NOTE: Google STT (en-IN locale) frequently mistranscribes names like
    # "Sam" -> "sharma", "shama", "sham", "sab", "saam". We must include all of
    # these so the substring check `w in heard_text` fires correctly.
    if name == "sam":
        names.extend([
            "sem", "saem", "shyam", "shyamji", "sammy",
            "swayam",   # Google STT heard: 'hello swayam'
            "swayamji",
            "sharma",   # most common STT alias: "Hello Sam" -> "sharma you able to"
            "shama",    # "Hi Sam" -> "shama"
            "sham",     # "Hey Sam" -> "sham"
            "saam",     # long-vowel variant
            "sab",      # quick-speech alias
            "some",     # "Sam" -> "some" in fast speech
        ])
    elif name == "khushi":
        names.extend(["kushi", "khusi", "kusi", "kush", "khush", "khushy", "kushii"])
    elif name == "cheeni":
        names.extend(["chini", "cheni", "cheeny", "chinni"])
    elif name == "dev":
        names.extend(["dayv", "daev", "deb", "dave"])
    else:
        # Generic: add the first 3 letters as a partial match for any custom name
        if len(name) >= 3:
            names.append(name[:3])

    prefixes = ["hey", "he", "hi", "hello", "ok", "okay", "wake up",
                "sun", "suno", "yo", "listen", "aye", "a", "oh"]
    words = []
    for n in names:
        for p in prefixes:
            words.append(f"{p} {n}")
        words.append(n)

    # Return unique preserved order
    return list(dict.fromkeys(words))

# Module-level WAKE_WORDS — resolved at import time and refreshed on engine start
WAKE_WORDS = build_wake_words()


def _wake_match(heard_text: str, wake_words: list[str]) -> str | None:
    """
    Check if any wake word appears in heard_text.

    Rules:
    - For short single-word triggers (≤4 chars, e.g. 'sam', 'sem', 'sab'):
      use word-boundary regex so 'sam' doesn't fire inside 'saharsa'.
    - For phrases ('hello sam', 'hey sharma') and longer words ('sharma', 'shyam'):
      plain substring check (they're specific enough to avoid false positives).

    Returns the matched wake word string, or None.
    """
    for w in wake_words:
        if " " not in w and len(w) <= 4:
            # Word-boundary match for short bare names
            if re.search(r'\b' + re.escape(w) + r'\b', heard_text):
                return w
        else:
            # Substring match for phrases and longer aliases
            if w in heard_text:
                return w
    return None


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
        self._paused = False
        self._enabled = True  # Master switch (toggleable from UI Start/Exit buttons)
        self._thread = None
        self._audio_queue = queue.Queue()
        self._oww_model = None
        self._mode = "none"  # "oww" | "sr" | "none"
        # Event to signal the SR loop to immediately stop its current listen() call
        self._pause_event = threading.Event()

    # ── Public API ──────────────────────────────────────────────────────────────

    def start(self):
        """Start background wake word listening."""
        if self._running:
            return
        self._running = True
        self._paused = False
        # Refresh wake words from settings each time we start
        # (picks up any runtime name change e.g. Cheeni -> Khushi)
        global WAKE_WORDS
        WAKE_WORDS = build_wake_words()
        logger.info(f"[WakeWord] Listening for: {WAKE_WORDS}")
        self._init_model()
        self._thread = threading.Thread(target=self._run, daemon=True, name="WakeWordThread")
        self._thread.start()
        logger.info(f"Wake word engine started (mode={self._mode})")

    def stop(self):
        """Stop listening thread completely."""
        self._running = False
        self._paused = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=3)
        logger.info("Wake word engine stopped.")

    def enable(self):
        """Enable wake word listening (Start button in UI)."""
        global WAKE_WORDS
        WAKE_WORDS = build_wake_words()
        self._enabled = True
        self._paused = False
        if not self._running:
            self.start()
        logger.info(f"[WakeWord] Engine ENABLED. Ready for wake words: {WAKE_WORDS}")

    def disable(self):
        """Disable wake word listening (Exit button in UI). Calling wake word will do nothing."""
        self._enabled = False
        logger.info("[WakeWord] Engine DISABLED via Exit button. Wake words will be ignored.")

    def pause(self):
        """Pause wake word detection while conversation loop holds the mic."""
        self._paused = True
        self._pause_event.set()  # Signal any active listen() to abort immediately
        logger.debug("[WakeWord] Engine paused (conversation active). Mic released.")

    def resume(self):
        """Resume wake word detection once conversation loop ends."""
        self._pause_event.clear()  # Clear so next listen() cycle can run
        self._paused = False
        logger.debug("[WakeWord] Engine resumed.")

    @property
    def is_running(self):
        return self._running

    @property
    def is_enabled(self):
        return self._enabled

    @property
    def is_paused(self):
        return self._paused

    @property
    def mode(self):
        return self._mode

    def _init_model(self):
        """Load openwakeword model if default name, or use SR keyword mode for custom agent names."""
        from config.settings import settings
        agent_name = (settings.AGENT_NAME or "").strip().lower()

        # openwakeword pre-trained model only knows 'hey jarvis' (used as a proxy for cheeni).
        # For any custom agent name (e.g. Khushi, Dev, etc.), SpeechRecognition is required
        # so Google STT can accurately recognize 'Hey Khushi', 'Hey Dev', etc.
        is_custom_name = agent_name not in ["cheeni", "jarvis"]

        if not is_custom_name and OWW_OK and SOUNDDEVICE_OK:
            try:
                # Download default models on first run
                openwakeword.utils.download_models()
                self._oww_model = OWWModel(
                    wakeword_models=["hey_jarvis"],
                    inference_framework="onnx",
                )
                self._mode = "oww"
                logger.info(f"openwakeword model loaded (hey_jarvis proxy for {settings.AGENT_NAME})")
                return
            except Exception as e:
                logger.warning(f"OWW model init failed: {e}. Falling back to SR.")

        if SR_OK:
            self._mode = "sr"
            logger.info(f"Using SpeechRecognition keyword mode for wake word (listening for '{settings.AGENT_NAME}').")
        else:
            self._mode = "none"
            logger.error("No wake word engine available. Install speech_recognition / sounddevice.")

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
                    if self._paused:
                        audio_buf.clear()
                        time.sleep(0.1)
                        continue

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

        # NOTE: We use listen_in_background so we can release the mic instantly on pause.
        # The background thread feeds audio into a queue; we drain it when not paused.
        audio_queue: queue.Queue = queue.Queue()

        def _bg_callback(recognizer_ref, audio):
            """Called by listen_in_background when a phrase is captured."""
            if not self._paused and self._enabled:
                audio_queue.put(audio)

        stop_bg = recognizer.listen_in_background(
            mic, _bg_callback, phrase_time_limit=4
        )
        logger.info("[WakeWord] Background listener started.")

        try:
            while self._running:
                if not self._enabled or self._paused:
                    # Drain any queued audio captured while paused
                    while not audio_queue.empty():
                        try:
                            audio_queue.get_nowait()
                        except queue.Empty:
                            break
                    self._pause_event.wait(timeout=0.25)
                    continue

                # Process next queued audio chunk
                try:
                    audio = audio_queue.get(timeout=0.5)
                except queue.Empty:
                    continue

                if not self._enabled or self._paused:
                    continue

                try:
                    text = recognizer.recognize_google(audio, language="en-IN").lower()
                    logger.debug(f"SR heard: '{text}'")
                    matched_word = _wake_match(text, WAKE_WORDS)
                    if self._enabled and not self._paused and matched_word:
                        logger.info(f"Wake word matched '{matched_word}' via SR: '{text}'")
                        self._on_wake(phrase=text)
                        # Brief cooldown: pause ourselves to avoid re-trigger
                        self._pause_event.wait(timeout=2.0)
                except sr.UnknownValueError:
                    pass  # silence / unrecognised
                except sr.RequestError as e:
                    logger.warning(f"SR network error: {e}")
                    time.sleep(3)
                except Exception as e:
                    logger.error(f"SR recognition error: {e}")
        finally:
            stop_bg(wait_for_stop=False)
            logger.info("[WakeWord] Background listener stopped.")

    def _on_wake(self, phrase: str = "wake_word"):
        """Called when wake word is confirmed. Fires on_detected callback if enabled."""
        if not self._enabled:
            logger.debug("[WakeWord] Wake word fired but engine is disabled.")
            return
        try:
            self.on_detected(phrase)
        except Exception as e:
            logger.error(f"on_detected callback error: {e}")


# ── Module-level singleton (used by server.py) ─────────────────────────────────
_engine: WakeWordEngine | None = None


def get_engine() -> WakeWordEngine:
    global _engine
    if _engine is None:
        _engine = WakeWordEngine()
    return _engine

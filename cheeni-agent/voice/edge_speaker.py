"""
Cheeni Desktop Agent -- Edge TTS Speaker (V13)
Replaces flat pyttsx3 with Microsoft Edge TTS (edge-tts) for natural,
expressive, neural-quality speech.

Features:
  - 400+ Microsoft neural voices; sounds human, not robotic
  - Emotion/tone-aware: auto-detects tone from LLM response text
  - Async streaming: does NOT block the conversation loop
  - Falls back to pyttsx3 NativeSpeaker if network unavailable
  - Configurable via .env:
        EDGE_TTS_VOICE=en-IN-NeerjaNeural  (default Sam voice)
        EDGE_TTS_RATE=+0%                  (speed: -50% to +100%)
        EDGE_TTS_VOLUME=+0%               (volume delta)
        EDGE_TTS_ENABLED=true             (set false to always use pyttsx3)

Tone detection: reads keywords in the LLM response and selects
an appropriate prosody preset (excited / stern / calm / neutral).
"""

import asyncio
import os
import re
import tempfile
import subprocess
import threading
import queue
import time
from utils.logging import logger

# -- edge-tts availability
try:
    import edge_tts
    EDGE_TTS_OK = True
except ImportError:
    EDGE_TTS_OK = False
    logger.warning("[EdgeTTS] edge-tts not installed. Run: pip install edge-tts  (falls back to pyttsx3)")

# -- pyttsx3 fallback
try:
    from voice.speaker import get_speaker as _get_pyttsx3_speaker
    PYTTSX3_OK = True
except Exception:
    PYTTSX3_OK = False

# ── Configuration ─────────────────────────────────────────────────────────────
ENABLED        = os.getenv("EDGE_TTS_ENABLED", "true").lower() != "false"
DEFAULT_VOICE  = os.getenv("EDGE_TTS_VOICE", "en-IN-NeerjaNeural")
DEFAULT_RATE   = os.getenv("EDGE_TTS_RATE", "+0%")
DEFAULT_VOLUME = os.getenv("EDGE_TTS_VOLUME", "+0%")

# ── Voice / Tone Map ──────────────────────────────────────────────────────────
VOICE_MAP = {
    "neutral": "en-IN-NeerjaNeural",     # Sam default -- warm Indian English
    "excited": "en-US-AriaNeural",       # Upbeat, cheerful
    "calm":    "en-GB-SoniaNeural",      # Gentle, measured
    "stern":   "en-US-GuyNeural",        # Firm, authoritative
    "friendly":"en-IN-PrabhatNeural",    # Casual Indian English male
}

RATE_MAP = {
    "neutral": "+0%",
    "excited": "+15%",
    "calm":    "-10%",
    "stern":   "+0%",
    "friendly":"+5%",
}

# ── Tone Inference ────────────────────────────────────────────────────────────

def infer_tone(text: str) -> str:
    """
    Infer TTS tone from LLM response text by keyword matching.
    Returns one of: neutral | excited | calm | stern | friendly
    """
    t = text.lower()
    if any(w in t for w in ["error", "warning", "careful", "blocked", "cannot", "dangerous", "about to delete", "risky"]):
        return "stern"
    if any(w in t for w in ["done", "opened", "completed", "great", "success", "launched", "found"]):
        return "excited"
    if any(w in t for w in ["battery low", "sleep mode", "quiet", "relax", "closing down"]):
        return "calm"
    if any(w in t for w in ["hey", "sure", "of course", "no problem", "happy to"]):
        return "friendly"
    return "neutral"


# ── EdgeSpeaker ───────────────────────────────────────────────────────────────

class EdgeSpeaker:
    """
    Async neural TTS using Microsoft Edge TTS.
    Thread-safe queue-based design identical to NativeSpeaker API
    so conversation.py can swap them with zero changes.
    """

    def __init__(self):
        self._speech_queue: queue.Queue = queue.Queue()
        self._is_speaking = False
        self._running = False
        self._thread: threading.Thread | None = None
        self._loop: asyncio.AbstractEventLoop | None = None
        self._temp_files: list[str] = []

    # ── Public API (mirrors NativeSpeaker) ───────────────────────────────────

    def start(self):
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True, name="EdgeSpeakerThread")
        self._thread.start()
        logger.info("[EdgeTTS] EdgeSpeaker started.")

    def stop(self):
        self._running = False
        self._speech_queue.put(None)
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=5)
        self._cleanup_temp_files()

    def speak(self, text: str, interrupt: bool = True, tone: str | None = None):
        """
        Queue text for speaking with automatic tone detection.
        tone: explicitly pass 'neutral'|'excited'|'calm'|'stern'|'friendly'
              or leave None to auto-detect from text content.
        """
        if not self._running or not text or not text.strip():
            return
        if not EDGE_TTS_OK or not ENABLED:
            self._fallback_speak(text)
            return
        if interrupt:
            self._clear_queue()
        detected_tone = tone or infer_tone(text)
        self._speech_queue.put({"text": text.strip(), "tone": detected_tone})
        logger.debug(f"[EdgeTTS] Queued [{detected_tone}]: {text[:60]}...")

    def stop_speaking(self):
        """Interrupt current speech."""
        self._clear_queue()
        self._is_speaking = False

    def get_status(self) -> dict:
        return {
            "available": EDGE_TTS_OK and self._running,
            "is_speaking": self._is_speaking,
            "backend": "edge-tts" if EDGE_TTS_OK else "pyttsx3-fallback",
            "voice": DEFAULT_VOICE,
            "enabled": ENABLED,
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    def _run(self):
        """Speaker thread -- owns the asyncio event loop."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        while self._running:
            try:
                item = self._speech_queue.get(timeout=0.5)
                if item is None:
                    break
                self._is_speaking = True
                try:
                    self._loop.run_until_complete(self._speak_async(item["text"], item["tone"]))
                except Exception as e:
                    logger.error(f"[EdgeTTS] Speak error: {e}")
                    self._fallback_speak(item["text"])
                finally:
                    self._is_speaking = False
            except queue.Empty:
                pass
            except Exception as e:
                logger.error(f"[EdgeTTS] Loop error: {e}")
                time.sleep(0.5)

    async def _speak_async(self, text: str, tone: str = "neutral"):
        """Core async TTS call: generate MP3 → play via Windows Media Player."""
        voice  = VOICE_MAP.get(tone, DEFAULT_VOICE)
        rate   = RATE_MAP.get(tone, DEFAULT_RATE)
        volume = DEFAULT_VOLUME

        try:
            communicate = edge_tts.Communicate(text, voice=voice, rate=rate, volume=volume)
            with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
                path = f.name
            self._temp_files.append(path)
            await communicate.save(path)
            logger.debug(f"[EdgeTTS] TTS saved to {path} [{tone}, {voice}]")

            # Play using Windows built-in (no extra deps)
            result = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 f"$p=New-Object System.Media.SoundPlayer; Add-Type -AssemblyName presentationCore; "
                 f"$m=[System.Windows.Media.MediaPlayer]::new(); $m.Open([uri]'{path}'); $m.Play(); "
                 f"Start-Sleep -Milliseconds ([int]($m.NaturalDuration.TimeSpan.TotalMilliseconds + 300)); $m.Close()"],
                capture_output=True, timeout=60,
            )
            if result.returncode != 0:
                # Fallback player
                os.startfile(path)
                await asyncio.sleep(2)
        except asyncio.TimeoutError:
            logger.warning("[EdgeTTS] Playback timeout")
        except Exception as e:
            logger.error(f"[EdgeTTS] _speak_async error: {e}")
            raise

    def _fallback_speak(self, text: str):
        """Use pyttsx3 NativeSpeaker as fallback."""
        if PYTTSX3_OK:
            try:
                speaker = _get_pyttsx3_speaker()
                if not speaker._running:
                    speaker.start()
                speaker.speak(text)
            except Exception as e:
                logger.error(f"[EdgeTTS] pyttsx3 fallback error: {e}")

    def _clear_queue(self):
        while not self._speech_queue.empty():
            try:
                self._speech_queue.get_nowait()
            except queue.Empty:
                break

    def _cleanup_temp_files(self):
        for path in self._temp_files:
            try:
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
        self._temp_files.clear()


# ── Module-level singleton ─────────────────────────────────────────────────────
_edge_speaker: EdgeSpeaker | None = None


def get_edge_speaker() -> EdgeSpeaker:
    """
    Returns the singleton EdgeSpeaker.
    If edge-tts is not installed or disabled, returns a wrapper
    that transparently delegates to pyttsx3 NativeSpeaker.
    """
    global _edge_speaker
    if _edge_speaker is None:
        _edge_speaker = EdgeSpeaker()
    return _edge_speaker

"""
Cheeni Voice — Whisper Listener
Speech-to-Text via faster-whisper.
"""

import logging

logger = logging.getLogger("cheeni.stt")


class WhisperListener:
    def __init__(self, model_size="base"):
        self.model_size = model_size
        self.model = None

    def load_model(self):
        try:
            from faster_whisper import WhisperModel
            self.model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
            logger.info(f"Whisper {self.model_size} loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load faster-whisper: {e}")

    def transcribe(self, audio_path: str) -> str:
        if not self.model:
            self.load_model()
        if not self.model:
            return ""
        segments, _ = self.model.transcribe(audio_path)
        return " ".join([s.text for s in segments]).strip()

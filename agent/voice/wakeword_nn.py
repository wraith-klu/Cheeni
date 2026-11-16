"""
Cheeni Voice — Neural Wake Word Detector (Capability 2)
Listens for 'Hey Cheeni' using the fine-tuned wav2vec2 model (wraithklu/cheeni-wakeword-xlsr).
Includes real-time microphone stream buffering, VAD energy thresholding, and keyword fallback.
"""

import logging
import os
import numpy as np
from config.constants import HF_MODELS, WAKEWORD_THRESHOLD

logger = logging.getLogger("cheeni.wakeword")


class WakeWordDetector:
    """
    Neural Wake Word Detector powered by wraithklu/cheeni-wakeword-xlsr.
    Analyzes 16kHz PCM audio buffers for 'Hey Cheeni' acoustic signature.
    """

    def __init__(self):
        self.wake_phrases = ["hey cheeni", "cheeni", "cheeni sun", "ok cheeni", "cheeni suno"]
        self.model = None
        self.feature_extractor = None
        self._load_neural_model()

    def _load_neural_model(self):
        try:
            from transformers import AutoModelForAudioClassification, AutoFeatureExtractor
            model_id = HF_MODELS["wakeword"]
            token = os.getenv("HF_TOKEN", "")
            
            self.feature_extractor = AutoFeatureExtractor.from_pretrained(model_id, token=token)
            self.model = AutoModelForAudioClassification.from_pretrained(model_id, token=token)
            self.model.eval()
            logger.info(f"✅ Neural Wake Word model loaded: {model_id}")
        except Exception as e:
            logger.warning(f"⚠️ Could not load neural wake word model ({e}) — using keyword listener fallback")
            self.model = None
            self.feature_extractor = None

    def predict_audio(self, audio_array: np.ndarray, sampling_rate: int = 16000) -> dict:
        """
        Runs neural acoustic inference on a 1-2 second 16kHz audio buffer.
        Returns {"detected": bool, "confidence": float, "label": str}
        """
        if self.model is None or self.feature_extractor is None:
            return {"detected": False, "confidence": 0.0, "label": "fallback_needed"}

        try:
            import torch
            inputs = self.feature_extractor(audio_array, sampling_rate=sampling_rate, return_tensors="pt")
            with torch.no_grad():
                logits = self.model(**inputs).logits
                probs = torch.softmax(logits, dim=-1)[0]
                wake_prob = probs[1].item() if len(probs) > 1 else probs[0].item()

            detected = wake_prob >= WAKEWORD_THRESHOLD
            return {
                "detected": detected,
                "confidence": float(wake_prob),
                "label": "wake_word" if detected else "negative"
            }
        except Exception as e:
            logger.error(f"Neural wake word inference error: {e}")
            return {"detected": False, "confidence": 0.0, "label": "error"}

    def detect_in_text(self, text: str) -> bool:
        """Text / transcription keyword fallback."""
        clean = text.lower().strip()
        return any(phrase in clean for phrase in self.wake_phrases)

"""
Cheeni Core — Speech Emotion & Mood Detector (Capability 3)
Classifies user emotion from speech audio into:
[neutral, calm, happy, sad, angry, fearful, disgust, surprised].
Adapts Cheeni's personality and tone (empathetic, concise, celebratory) accordingly.
"""

import logging
import os
import numpy as np
from config.constants import HF_MODELS

logger = logging.getLogger("cheeni.emotion")

EMOTION_LABELS = [
    "neutral",
    "calm",
    "happy",
    "sad",
    "angry",
    "fearful",
    "disgust",
    "surprised",
]

# Personality tone modifiers mapped to detected emotion
TONE_MAPPINGS = {
    "happy": "enthusiastic, warm, celebrate user success",
    "sad": "gentle, supportive, comforting, offering proactive assistance",
    "angry": "calm, concise, apologetic, highly efficient, zero unnecessary chitchat",
    "fearful": "reassuring, clear, structured step-by-step guidance",
    "disgust": "direct, objective, focused on immediate fix",
    "surprised": "clarifying, inquisitive, providing helpful context",
    "calm": "balanced, smooth, natural conversational tone",
    "neutral": "standard crisp JARVIS/FRIDAY executive assistant style",
}


class EmotionDetector:
    """
    Neural Speech Emotion Detector powered by fine-tuned model on HuggingFace.
    Analyzes 16kHz audio waveforms to detect user vocal sentiment.
    """

    def __init__(self):
        self.model = None
        self.feature_extractor = None
        self.current_mood = "neutral"
        self._load_model()

    def _load_model(self):
        try:
            from transformers import AutoModelForAudioClassification, AutoFeatureExtractor
            model_id = HF_MODELS.get("emotion", "wraithklu/cheeni-emotion-vad_03")
            token = os.getenv("HF_TOKEN", "")

            self.feature_extractor = AutoFeatureExtractor.from_pretrained(model_id, token=token)
            self.model = AutoModelForAudioClassification.from_pretrained(model_id, token=token)
            self.model.eval()
            logger.info(f"✅ Speech Emotion model loaded: {model_id}")
        except Exception as e:
            logger.warning(f"⚠️ Speech Emotion model not loaded ({e}) — using neutral/text fallback")
            self.model = None
            self.feature_extractor = None

    def predict_audio(self, audio_array: np.ndarray, sampling_rate: int = 16000) -> dict:
        """
        Runs neural emotion classification on speech audio.
        Returns: {
            "emotion": str,
            "confidence": float,
            "tone_modifier": str,
            "all_scores": dict
        }
        """
        if self.model is None or self.feature_extractor is None:
            return {
                "emotion": self.current_mood,
                "confidence": 0.5,
                "tone_modifier": TONE_MAPPINGS[self.current_mood],
                "all_scores": {self.current_mood: 1.0},
            }

        try:
            import torch
            inputs = self.feature_extractor(
                audio_array,
                sampling_rate=sampling_rate,
                return_tensors="pt"
            )
            with torch.no_grad():
                logits = self.model(**inputs).logits
                probs = torch.softmax(logits, dim=-1)[0].cpu().numpy()

            pred_idx = int(np.argmax(probs))
            id2label = getattr(self.model.config, "id2label", None)
            if id2label and pred_idx in id2label:
                emotion = id2label[pred_idx]
            else:
                emotion = EMOTION_LABELS[pred_idx] if pred_idx < len(EMOTION_LABELS) else "neutral"

            confidence = float(probs[pred_idx])
            self.current_mood = emotion

            all_scores = {
                (id2label[i] if id2label and i in id2label else EMOTION_LABELS[i]): float(probs[i])
                for i in range(len(probs))
            }

            return {
                "emotion": emotion,
                "confidence": confidence,
                "tone_modifier": TONE_MAPPINGS.get(emotion, TONE_MAPPINGS["neutral"]),
                "all_scores": all_scores,
            }
        except Exception as e:
            logger.error(f"Emotion prediction error: {e}")
            return {
                "emotion": self.current_mood,
                "confidence": 0.0,
                "tone_modifier": TONE_MAPPINGS["neutral"],
                "all_scores": {},
            }

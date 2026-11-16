"""
Cheeni Core — Speaker Verification & Voice Biometrics (Capability 4)
Authenticates spoken commands using acoustic voice embeddings.
Ensures sensitive tools & OS commands are only executed for the authorized owner.
"""

import logging
import os
from pathlib import Path
import numpy as np
from config.constants import HF_MODELS, SPEAKER_SIMILARITY_THRESHOLD

logger = logging.getLogger("cheeni.speaker")

EMBEDDING_DIR = Path("data/biometrics")
OWNER_PROFILE_PATH = EMBEDDING_DIR / "owner_embedding.npy"


class SpeakerVerifier:
    """
    Neural Voice ID Verifier.
    Extracts L2-normalized acoustic speaker embeddings and computes cosine similarity.
    """

    def __init__(self, threshold: float = SPEAKER_SIMILARITY_THRESHOLD):
        self.threshold = threshold
        self.model = None
        self.feature_extractor = None
        self.owner_embedding = None
        self._load_neural_model()
        self._load_owner_profile()

    def _load_neural_model(self):
        try:
            from transformers import AutoModel, AutoFeatureExtractor
            model_id = HF_MODELS.get("speaker", "wraithklu/cheeni-speaker-verify_04")
            token = os.getenv("HF_TOKEN", "")

            self.feature_extractor = AutoFeatureExtractor.from_pretrained(model_id, token=token)
            self.model = AutoModel.from_pretrained(model_id, token=token)
            self.model.eval()
            logger.info(f"✅ Speaker Verification model loaded: {model_id}")
        except Exception as e:
            logger.warning(f"⚠️ Speaker verification model not loaded ({e}) — biometric gate in permissive mode")
            self.model = None
            self.feature_extractor = None

    def _load_owner_profile(self):
        """Loads enrolled owner voice embedding vector if exists."""
        if OWNER_PROFILE_PATH.exists():
            try:
                self.owner_embedding = np.load(str(OWNER_PROFILE_PATH))
                logger.info(f"✅ Enrolled owner voice profile loaded from {OWNER_PROFILE_PATH}")
            except Exception as e:
                logger.warning(f"Could not load owner embedding: {e}")
                self.owner_embedding = None
        else:
            self.owner_embedding = None

    def extract_embedding(self, audio_array: np.ndarray, sampling_rate: int = 16000) -> np.ndarray:
        """
        Passes audio through transformer encoder to extract a normalized 512D/768D voice embedding.
        """
        if self.model is None or self.feature_extractor is None:
            return np.zeros(512, dtype=np.float32)

        try:
            import torch
            inputs = self.feature_extractor(
                audio_array,
                sampling_rate=sampling_rate,
                return_tensors="pt"
            )
            with torch.no_grad():
                outputs = self.model(**inputs)
                # Mean pooling over temporal dimension to extract speaker embedding
                if hasattr(outputs, "last_hidden_state"):
                    emb = outputs.last_hidden_state.mean(dim=1).squeeze().cpu().numpy()
                elif hasattr(outputs, "embeddings"):
                    emb = outputs.embeddings.squeeze().cpu().numpy()
                else:
                    emb = list(outputs.values())[0].mean(dim=1).squeeze().cpu().numpy()

            norm = np.linalg.norm(emb)
            if norm > 0:
                emb = emb / norm
            return emb
        except Exception as e:
            logger.error(f"Embedding extraction error: {e}")
            return np.zeros(512, dtype=np.float32)

    def verify_speaker(self, audio_array: np.ndarray, sampling_rate: int = 16000) -> dict:
        """
        Compares input audio against registered owner voice embedding using cosine similarity.
        Returns: {
            "is_owner": bool,
            "similarity": float,
            "threshold": float,
            "enrolled": bool
        }
        """
        if self.owner_embedding is None:
            # No owner enrolled yet; pass through with notification
            return {
                "is_owner": True,
                "similarity": 1.0,
                "threshold": self.threshold,
                "enrolled": False,
                "status": "unrestricted_no_owner_enrolled"
            }

        sample_emb = self.extract_embedding(audio_array, sampling_rate)
        # Cosine similarity between two unit vectors = dot product
        similarity = float(np.dot(self.owner_embedding, sample_emb))
        is_owner = similarity >= self.threshold

        return {
            "is_owner": is_owner,
            "similarity": similarity,
            "threshold": self.threshold,
            "enrolled": True,
            "status": "verified" if is_owner else "rejected_imposter"
        }

    def enroll_owner(self, audio_samples: list, sampling_rate: int = 16000) -> bool:
        """
        Enrolls owner by averaging normalized embeddings across 3-5 enrollment phrases.
        """
        embeddings = []
        for sample in audio_samples:
            emb = self.extract_embedding(sample, sampling_rate)
            if np.linalg.norm(emb) > 0:
                embeddings.append(emb)

        if not embeddings:
            return False

        avg_emb = np.mean(embeddings, axis=0)
        avg_emb = avg_emb / np.linalg.norm(avg_emb)

        EMBEDDING_DIR.mkdir(parents=True, exist_ok=True)
        np.save(str(OWNER_PROFILE_PATH), avg_emb)
        self.owner_embedding = avg_emb
        logger.info(f"🎉 Successfully enrolled owner voice biometrics ({len(embeddings)} samples)")
        return True

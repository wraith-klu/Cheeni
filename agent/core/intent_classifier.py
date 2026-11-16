"""
Cheeni — Intent Classifier (Capability 1)
Lazy-loads the DeBERTa/XLM-RoBERTa model on first use, not on startup.
This prevents blocking server boot and surviving hot-reloads during long downloads.
"""

import logging
import os
import threading
from config.constants import HF_MODELS, INTENT_CONFIDENCE_THRESHOLD

logger = logging.getLogger("cheeni.intent")

# Suppress the Windows symlink warning from huggingface_hub
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")


class IntentClassifier:
    """
    Wraps wraithklu/cheeni-intent-deberta_01 for intent classification.
    Loads lazily on first classify() call — server starts instantly.
    If the model isn't cached yet, falls back to Gemini automatically.
    """

    def __init__(self):
        self.pipe = None
        self._loaded = False
        self._loading = False
        self._lock = threading.Lock()
        # Kick off background preload so it's ready sooner
        threading.Thread(target=self._load, daemon=True).start()

    def _load(self):
        with self._lock:
            if self._loaded:
                return
            self._loading = True
        try:
            from transformers import pipeline
            # 1. Instant offline load from local cache if already downloaded
            try:
                self.pipe = pipeline(
                    "text-classification",
                    model=HF_MODELS["intent"],
                    top_k=3,
                    device=-1,
                    model_kwargs={"local_files_only": True},
                )
                self._loaded = True
                self._loading = False
                logger.info(f"✅ Intent classifier loaded from local cache (0 downloads): {HF_MODELS['intent']}")
                return
            except Exception:
                pass

            # 2. Online fetch if cache not populated yet
            logger.info(f"⬇️  Loading intent classifier from cache / HuggingFace: {HF_MODELS['intent']}")
            self.pipe = pipeline(
                "text-classification",
                model=HF_MODELS["intent"],
                token=os.getenv("HF_TOKEN", ""),
                top_k=3,
                device=-1,          # CPU — always safe on Windows laptop
            )
            self._loaded = True
            self._loading = False
            logger.info(f"✅ Intent classifier ready: {HF_MODELS['intent']}")
        except Exception as e:
            logger.warning(f"⚠️  Intent model not yet available ({type(e).__name__}) — using Gemini fallback")
            self.pipe = None
        finally:
            with self._lock:
                self._loaded = True
                self._loading = False

    def classify(self, text: str) -> dict:
        # Still downloading — return fallback immediately, don't block the request
        if not self._loaded or self.pipe is None:
            status = "downloading" if self._loading else "unavailable"
            logger.debug(f"Intent model {status} — routing to LLM fallback")
            return {"intent": "unknown", "confidence": 0.0, "needs_llm_fallback": True, "top3": []}

        try:
            results = self.pipe(text)[0]   # list of top-k predictions
            best = results[0]
            return {
                "intent": best["label"],
                "confidence": best["score"],
                "needs_llm_fallback": best["score"] < INTENT_CONFIDENCE_THRESHOLD,
                "top3": [{"label": r["label"], "score": round(r["score"], 4)} for r in results],
            }
        except Exception as e:
            logger.error(f"Classification error: {e}")
            return {"intent": "unknown", "confidence": 0.0, "needs_llm_fallback": True, "top3": []}

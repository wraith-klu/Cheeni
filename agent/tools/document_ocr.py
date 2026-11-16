"""
Cheeni Tools — Document & Receipt OCR (Capability 6)
Extracts printed text, receipts, invoices, and documents using TrOCR.
"""

import logging
import os
from pathlib import Path
from PIL import Image
from config.constants import HF_MODELS

logger = logging.getLogger("cheeni.ocr")


class DocumentOCRAgent:
    """
    TrOCR Neural Document Text Extractor.
    Processes document and receipt images via ViT + RoBERTa sequence generation.
    """

    def __init__(self):
        self.model = None
        self.processor = None
        self._load_model()

    def _load_model(self):
        try:
            import torch
            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
            model_id = HF_MODELS.get("ocr_printed", "wraithklu/cheeni-ocr-trocr_06")
            token = os.getenv("HF_TOKEN", "")

            self.processor = TrOCRProcessor.from_pretrained(model_id, token=token)
            self.model = VisionEncoderDecoderModel.from_pretrained(model_id, token=token)
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model = self.model.to(device)
            self.model.eval()
            logger.info(f"✅ TrOCR Document OCR model loaded on {device}: {model_id}")
        except Exception as e:
            logger.warning(f"⚠️ TrOCR model not loaded ({e}) — OCR in standby")
            self.model = None
            self.processor = None

    def recognize_text(self, image: Image.Image) -> str:
        """Runs autoregressive text recognition on document or crop."""
        if self.model is None or self.processor is None:
            return ""

        try:
            import torch
            device = next(self.model.parameters()).device
            pixel_values = self.processor(images=image.convert("RGB"), return_tensors="pt").pixel_values.to(device)

            with torch.no_grad():
                generated_ids = self.model.generate(pixel_values, max_new_tokens=128)

            text = self.processor.batch_decode(generated_ids, skip_special_tokens=True)[0]
            return text.strip()
        except Exception as e:
            logger.error(f"OCR recognition error: {e}")
            return ""


_ocr_agent = None

def get_ocr_agent() -> DocumentOCRAgent:
    global _ocr_agent
    if _ocr_agent is None:
        _ocr_agent = DocumentOCRAgent()
    return _ocr_agent


async def handle(intent: str, text: str, image_path: str = None) -> dict:
    """
    Handles document OCR requests:
    Reads text from provided image or active screenshot.
    """
    try:
        agent = get_ocr_agent()
        if image_path and Path(image_path).exists():
            img = Image.open(image_path)
        else:
            # Fallback to screenshot
            import mss
            Path("data").mkdir(parents=True, exist_ok=True)
            temp_path = "data/ocr_temp.png"
            with mss.mss() as sct:
                sct.shot(output=temp_path)
            img = Image.open(temp_path)

        extracted_text = agent.recognize_text(img)
        reply = f"Extracted text: '{extracted_text}'" if extracted_text else "Could not detect readable printed text."

        return {
            "reply": reply,
            "action_taken": "ocr_extraction",
            "data": {"extracted_text": extracted_text}
        }
    except Exception as e:
        logger.error(f"OCR handling failed: {e}")
        return {"reply": f"OCR processing failed: {e}", "action_taken": "error", "data": {}}

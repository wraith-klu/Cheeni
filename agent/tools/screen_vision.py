"""
Cheeni Tools — Screen Vision & UI Grounding (Capability 5)
Captures screenshots and grounds UI element coordinates using Florence-2.
Converts natural language commands ("click the login button") into exact screen coordinates (X, Y).
"""

import logging
import os
from pathlib import Path
import mss
from PIL import Image
from config.constants import HF_MODELS

logger = logging.getLogger("cheeni.screen_vision")


class ScreenGroundingAgent:
    """
    Florence-2 Vision-Language grounding model.
    Predicts bounding boxes [x1, y1, x2, y2] for requested UI targets on screen.
    """

    def __init__(self):
        self.model = None
        self.processor = None
        self._load_vision_model()

    def _load_vision_model(self):
        try:
            import torch
            from transformers.configuration_utils import PretrainedConfig
            PretrainedConfig.forced_bos_token_id = None

            from transformers import Florence2ForConditionalGeneration, AutoProcessor
            model_id = HF_MODELS.get("vision", "wraithklu/cheeni-vision-florence_05")
            token = os.getenv("HF_TOKEN", "")

            self.processor = AutoProcessor.from_pretrained(model_id, token=token)
            self.model = Florence2ForConditionalGeneration.from_pretrained(
                model_id,
                dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                token=token
            )
            device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model = self.model.to(device)
            self.model.eval()
            logger.info(f"✅ Screen Grounding Vision Model loaded on {device}: {model_id}")
        except Exception as e:
            logger.warning(f"⚠️ Florence-2 vision model not loaded ({e}) — visual grounding in standby")
            self.model = None
            self.processor = None

    def ground_ui_element(self, image: Image.Image, target_label: str) -> dict:
        """
        Locates UI element on screenshot image matching target_label.
        Returns: {
            "target": str,
            "found": bool,
            "center": (x, y),
            "bbox": [x1, y1, x2, y2],
            "description": str
        }
        """
        if self.model is None or self.processor is None:
            # Fallback center screen
            w, h = image.size
            return {
                "target": target_label,
                "found": False,
                "center": (w // 2, h // 2),
                "bbox": [0, 0, w, h],
                "description": "Vision model not loaded, returned center screen fallback"
            }

        try:
            import torch
            device = next(self.model.parameters()).device
            task_prompt = "<CAPTION_TO_PHRASE_GROUNDING>"
            prompt = f"{task_prompt} {target_label}"

            inputs = self.processor(text=prompt, images=image, return_tensors="pt")
            inputs = {k: v.to(device) for k, v in inputs.items() if hasattr(v, "to")}

            with torch.no_grad():
                generated_ids = self.model.generate(
                    input_ids=inputs["input_ids"],
                    pixel_values=inputs.get("pixel_values"),
                    max_new_tokens=256,
                    num_beams=3
                )

            generated_text = self.processor.batch_decode(generated_ids, skip_special_tokens=False)[0]
            parsed = self.processor.post_process_generation(
                generated_text,
                task=task_prompt,
                image_size=(image.width, image.height)
            )

            grounding_data = parsed.get(task_prompt, {})
            bboxes = grounding_data.get("bboxes", [])

            if bboxes:
                # Top matching bounding box
                box = bboxes[0]
                cx = int((box[0] + box[2]) / 2)
                cy = int((box[1] + box[3]) / 2)
                return {
                    "target": target_label,
                    "found": True,
                    "center": (cx, cy),
                    "bbox": [int(coord) for coord in box],
                    "description": f"Located '{target_label}' at ({cx}, {cy})"
                }

            return {
                "target": target_label,
                "found": False,
                "center": (image.width // 2, image.height // 2),
                "bbox": [],
                "description": f"Target '{target_label}' not found on active screen"
            }
        except Exception as e:
            logger.error(f"UI grounding error: {e}")
            return {
                "target": target_label,
                "found": False,
                "center": (image.width // 2, image.height // 2),
                "bbox": [],
                "description": f"Grounding failed: {e}"
            }


# Singleton vision agent instance
_vision_agent = None

def get_vision_agent() -> ScreenGroundingAgent:
    global _vision_agent
    if _vision_agent is None:
        _vision_agent = ScreenGroundingAgent()
    return _vision_agent


async def handle(intent: str, text: str) -> dict:
    """
    Handles screen vision requests:
    1. Captures full primary display screenshot
    2. Runs Florence-2 UI grounding or descriptive analysis
    """
    try:
        temp_path = "data/screen_temp.png"
        Path("data").mkdir(parents=True, exist_ok=True)

        with mss.mss() as sct:
            sct.shot(output=temp_path)

        img = Image.open(temp_path)
        agent = get_vision_agent()

        # Extract target object from text if user wants to click or find something
        target = "button"
        for kw in ["click", "find", "locate", "where is", "open"]:
            if kw in text.lower():
                target = text.lower().split(kw)[-1].strip()
                break

        grounding = agent.ground_ui_element(img, target)

        return {
            "reply": f"Analyzed your screen. {grounding['description']}.",
            "action_taken": "screen_grounding",
            "data": {
                "image_path": str(Path(temp_path).resolve()),
                "grounding": grounding
            }
        }
    except Exception as e:
        logger.error(f"Screen vision handling error: {e}")
        return {"reply": f"Screen capture or vision analysis failed: {e}", "action_taken": "error", "data": {}}

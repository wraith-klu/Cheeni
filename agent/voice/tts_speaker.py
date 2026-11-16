"""
Cheeni Voice — Adaptive Dual-Persona Text to Speech Speaker
Synthesizes speech dynamically based on persona archetype:
- 'cute_girl': High-fidelity, bright, energetic companion (Ana / Neerja / Jenny)
- 'male_jarvis': Deep, resonant, crisp British executive butler (Ryan / Guy)
"""

import asyncio
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("cheeni.tts")

PERSONA_VOICES = {
    "cute_girl": {
        "voice": "en-US-AnaNeural",
        "fallback": "en-IN-NeerjaNeural",
        "pitch": "+15Hz",
        "rate": "+2%",
    },
    "male_jarvis": {
        "voice": "en-GB-RyanNeural",
        "fallback": "en-US-GuyNeural",
        "pitch": "-10Hz",
        "rate": "+0%",
    },
}


class TTSSpeaker:
    def __init__(self, default_persona: str = "cute_girl", custom_voice: Optional[str] = None):
        self.default_persona = default_persona if default_persona in PERSONA_VOICES else "cute_girl"
        self.custom_voice = custom_voice

    def get_voice_config(self, persona: Optional[str] = None) -> dict:
        key = persona if persona in PERSONA_VOICES else self.default_persona
        return PERSONA_VOICES[key]

    async def speak(self, text: str, persona: Optional[str] = None, output_path: str = "temp_speech.mp3") -> Optional[str]:
        cfg = self.get_voice_config(persona)
        voice_name = self.custom_voice or cfg["voice"]

        try:
            import edge_tts
            communicate = edge_tts.Communicate(
                text,
                voice=voice_name,
                rate=cfg.get("rate", "+0%"),
                pitch=cfg.get("pitch", "+0Hz")
            )
            await communicate.save(output_path)
            logger.info(f"Synthesized speech [{persona or self.default_persona}] saved to {output_path}")
            return output_path
        except Exception as e:
            logger.warning(f"Primary voice '{voice_name}' failed: {e}. Trying fallback...")
            try:
                import edge_tts
                fallback_voice = cfg.get("fallback", "en-US-JennyNeural")
                communicate = edge_tts.Communicate(text, voice=fallback_voice)
                await communicate.save(output_path)
                return output_path
            except Exception as e2:
                logger.error(f"TTS synthesis error: {e2}")
                return None

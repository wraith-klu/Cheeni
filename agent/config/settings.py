"""
Cheeni Agent — Pydantic Settings
Loads from .env file automatically.
"""

from typing import List
import os
from pathlib import Path

try:
    from dotenv import load_dotenv
    _root_env = Path(__file__).resolve().parent.parent.parent / ".env"
    _agent_env = Path(__file__).resolve().parent.parent / ".env"
    if _root_env.exists():
        load_dotenv(_root_env)
    elif _agent_env.exists():
        load_dotenv(_agent_env)
    else:
        load_dotenv()
except ImportError:
    pass

try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseModel
    class BaseSettings(BaseModel):  # type: ignore
        def __init__(self, **values):
            super().__init__(**values)
            for field_name in getattr(self, "model_fields", {}):
                val = os.getenv(field_name.upper()) or os.getenv(field_name)
                if val is not None:
                    setattr(self, field_name, val)


class Settings(BaseSettings):
    # LLM
    gemini_api_key: str = ""
    groq_api_key: str = ""
    openrouter_api_key: str = ""

    # HuggingFace
    hf_token: str = ""
    hf_repo_prefix: str = "wraithklu/cheeni-"

    # App
    environment: str = "local"
    port: int = 2026
    frontend_url: str = "http://localhost:5173"

    # Ollama (local large models)
    ollama_base_url: str = "http://localhost:11434"
    ollama_code_model: str = "qwen2.5-coder:7b"
    ollama_persona_model: str = "phi3.5:mini"

    @property
    def allowed_origins(self) -> List[str]:
        return [self.frontend_url, "http://localhost:5173", "http://localhost:3000"]

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

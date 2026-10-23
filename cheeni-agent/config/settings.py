import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env if present
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Settings:
    # Server & Bridge
    HOST: str = os.getenv("AGENT_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("AGENT_PORT", "2026"))
    API_TOKEN: str = os.getenv("AGENT_API_TOKEN", "")
    NODE_BACKEND_URL: str = os.getenv("NODE_BACKEND_URL", "http://localhost:2025")
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:2025",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:2025",
    ]

    # Agent Identity
    AGENT_NAME: str = os.getenv("AGENT_NAME", "Cheeni")

    # 2-Way Conversation Settings
    CONVERSATION_MEMORY_TURNS: int = int(os.getenv("CONVERSATION_MEMORY_TURNS", "10"))

    # LLM API Keys (fallback for when Node backend is unavailable)
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "deepseek/deepseek-v3-0324:free")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Security Configuration
    REQUIRE_CONFIRMATION_FOR_RISKY: bool = True
    MAX_FILE_READ_SIZE_MB: int = 15  # Limit PDF/file reading size
    PROTECTED_DIRECTORIES: list = [
        "C:\\Windows",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
    ]

    # Common User Paths
    USER_HOME: Path = Path.home()
    DESKTOP_DIR: Path = USER_HOME / "Desktop"
    DOCUMENTS_DIR: Path = USER_HOME / "Documents"
    DOWNLOADS_DIR: Path = USER_HOME / "Downloads"

    # V10: Whisper STT
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    WHISPER_DEVICE: str = os.getenv("WHISPER_DEVICE", "cpu")
    WHISPER_COMPUTE_TYPE: str = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
    WHISPER_LANGUAGE: str = os.getenv("WHISPER_LANGUAGE", "en")

    # V12: Screen Vision & GUI Grounding Agent
    SCREEN_VISION_MODEL: str = os.getenv("SCREEN_VISION_MODEL", "gemini-3.5-flash")
    SCREEN_AGENT_MAX_STEPS: int = int(os.getenv("SCREEN_AGENT_MAX_STEPS", "8"))
    SCREEN_AGENT_STEP_DELAY: float = float(os.getenv("SCREEN_AGENT_STEP_DELAY", "1.0"))

    # V13: Edge TTS
    EDGE_TTS_ENABLED: bool = os.getenv("EDGE_TTS_ENABLED", "true").lower() != "false"
    EDGE_TTS_VOICE: str = os.getenv("EDGE_TTS_VOICE", "en-IN-NeerjaNeural")
    EDGE_TTS_RATE: str = os.getenv("EDGE_TTS_RATE", "+0%")

    # V14: Ollama Local LLM
    OLLAMA_HOST: str = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "phi3:mini")
    OLLAMA_ENABLED: bool = os.getenv("OLLAMA_ENABLED", "true").lower() != "false"

    # V15: Personal Memory
    MEMORY_EMBED_MODEL: str = os.getenv("MEMORY_EMBED_MODEL", "all-MiniLM-L6-v2")


settings = Settings()

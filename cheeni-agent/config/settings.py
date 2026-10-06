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
    NODE_BACKEND_URL: str = os.getenv("NODE_BACKEND_URL", "http://localhost:2025")
    CORS_ORIGINS: list = [
        "http://localhost:5173",
        "http://localhost:2025",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:2025",
    ]

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

settings = Settings()

"""
Cheeni Desktop Agent -- Entry Point
Run with: python main.py
"""
import uvicorn
import sys
import os

# Force UTF-8 output on Windows to avoid UnicodeEncodeError with emojis
if sys.stdout.encoding != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr.encoding != "utf-8":
    sys.stderr.reconfigure(encoding="utf-8")

# Ensure the cheeni-agent directory is on the Python path
sys.path.insert(0, os.path.dirname(__file__))

from config.settings import settings
from utils.logging import logger
from core.server import app


def ensure_port_available(host: str, port: int):
    """If port is occupied by an orphaned background instance, safely terminate it."""
    import socket
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        in_use = s.connect_ex((host, port)) == 0

    if in_use:
        logger.warning(f"Port {port} is currently in use. Checking for orphaned process...")
        try:
            import psutil
            current_pid = os.getpid()
            for proc in psutil.process_iter(['pid', 'name']):
                try:
                    for conn in proc.net_connections(kind='tcp'):
                        if conn.laddr.port == port and proc.pid != current_pid:
                            logger.warning(f"Freeing port {port} held by PID {proc.pid} ({proc.name()})...")
                            proc.kill()
                            proc.wait(timeout=3)
                            logger.info(f"Port {port} successfully freed.")
                            return
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception as e:
            logger.debug(f"Process check note: {e}")


def main():
    ensure_port_available(settings.HOST, settings.PORT)

    logger.info("=" * 55)
    logger.info("  Cheeni Desktop Agent -- Starting Up")
    logger.info(f"  Listening on http://{settings.HOST}:{settings.PORT}")
    logger.info(f"  Node Backend : {settings.NODE_BACKEND_URL}")
    logger.info(f"  API Docs     : http://{settings.HOST}:{settings.PORT}/docs")
    logger.info("=" * 55)

    uvicorn.run(
        app,
        host=settings.HOST,
        port=settings.PORT,
        log_level="info",
        reload=False,
    )


if __name__ == "__main__":
    main()

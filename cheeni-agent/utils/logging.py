import logging
import sys
from datetime import datetime

def get_logger(name: str = "cheeni-agent") -> logging.Logger:
    """Returns a configured logger for the Cheeni Desktop Agent."""
    logger = logging.getLogger(name)
    if not logger.handlers:
        logger.setLevel(logging.DEBUG)
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.DEBUG)
        fmt = logging.Formatter(
            "[%(asctime)s] %(levelname)s  %(name)s — %(message)s",
            datefmt="%H:%M:%S",
        )
        handler.setFormatter(fmt)
        logger.addHandler(handler)
    return logger

logger = get_logger()

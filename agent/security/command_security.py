"""
Cheeni Security — 3-Tier Command Risk Classifier
Protects system from destructive commands, path traversal, and malicious code execution.
"""

import re
import logging
from typing import Literal

logger = logging.getLogger("cheeni.security")

# Tier 1: BLOCKED commands (Never execute under any circumstances)
BLOCKED_PATTERNS = [
    r"rm\s+-rf\s+[/~]",
    r"format\s+[a-zA-Z]:",
    r"del\s+/[fFqsSQ]*\s+[a-zA-Z]:\\windows",
    r"drop\s+database",
    r":(){ :\|:& };:",  # Fork bomb
    r"chmod\s+-R\s+777\s+/",
    r"mkfs",
    r"dd\s+if=.*of=/dev/",
    r"reg\s+delete\s+hklm",
]

# Tier 2: RISKY commands (Require explicit user confirmation)
RISKY_PATTERNS = [
    r"\b(shut\s*down|shutdown|restart|reboot|log\s*off|sleep)\b",
    r"\b(delete|remove|erase|destroy|wipe)\s+(file|folder|directory|all)\b",
    r"\b(kill|terminate|stop)\s+(process|task|service)\b",
    r"\b(git\s+push\s+--force|git\s+reset\s+--hard)\b",
    r"\b(format\s+drive|clean\s+disk)\b",
]

RiskLevel = Literal["SAFE", "RISKY", "BLOCKED"]


def classify_risk(text: str, intent: str = "") -> RiskLevel:
    """
    Classifies a command or intent into SAFE, RISKY, or BLOCKED.
    """
    clean_text = text.lower().strip()

    # Check BLOCKED
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE):
            logger.warning(f"🚨 BLOCKED command attempted: {clean_text}")
            return "BLOCKED"

    # Check Intent-based risk
    if intent in ("system_shutdown", "system_restart", "file_delete"):
        return "RISKY"

    # Check Regex RISKY
    for pattern in RISKY_PATTERNS:
        if re.search(pattern, clean_text, re.IGNORECASE):
            logger.info(f"⚠️ RISKY command detected (needs confirmation): {clean_text}")
            return "RISKY"

    return "SAFE"

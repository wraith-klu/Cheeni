"""
Cheeni Desktop Agent -- Command Security Classifier (Step 7)

Classifies every incoming command intent into one of 3 security tiers:

  SAFE    -- Harmless read/open operations. Execute immediately, no confirmation.
             Examples: check battery, open YouTube, search Google, read the time,
                       launch Notepad, check CPU, play music, open calculator.

  RISKY   -- Potentially destructive. Requires explicit user confirmation before
             executing.
             Examples: delete a file/folder, kill a process, restart/shutdown
                       the laptop, close unsaved apps, format a drive.

  BLOCKED -- Critically dangerous. Rejected outright with an explanation.
             Examples: deleting System32, modifying the Windows registry,
                       running arbitrary shell/eval code, disabling antivirus,
                       accessing other users' private data.

Usage:
    result = classify(intent_text)
    # result.tier   -> SecurityTier.SAFE | RISKY | BLOCKED
    # result.reason -> human-readable explanation
    # result.action -> the matched rule action label
"""

import re
from enum import Enum
from dataclasses import dataclass
from typing import Optional
from utils.logging import logger


# ── Security Tiers ─────────────────────────────────────────────────────────────

class SecurityTier(str, Enum):
    SAFE    = "safe"
    RISKY   = "risky"
    BLOCKED = "blocked"


@dataclass
class ClassificationResult:
    tier:    SecurityTier
    reason:  str
    action:  Optional[str] = None    # matched rule label, if any
    raw:     Optional[str] = None    # original input text


# ── Rule Tables ────────────────────────────────────────────────────────────────

# BLOCKED: reject immediately — no confirmation possible
BLOCKED_PATTERNS = [
    # OS-critical directories
    (r"system32|syswow64|windows\\system", "Deleting or modifying Windows system files is not allowed."),
    (r"registry|regedit|reg (add|delete|import|export)", "Registry modification is blocked for safety."),
    # Code/shell injection
    (r"eval\s*\(|exec\s*\(|__import__|os\.system|subprocess\.call.*shell=True", "Arbitrary code execution is blocked."),
    (r"(format|wipe|erase)\s+.*(c:|d:|drive|disk)", "Formatting drives is a blocked operation."),
    # Credential theft / privacy
    (r"(steal|harvest|dump)\s+(password|credential|token|cookie)", "Credential harvesting is blocked."),
    (r"access.*(other user|admin password|root password)", "Accessing other users' credentials is blocked."),
    # Antivirus/firewall tampering
    (r"(disable|turn off|kill)\s+(antivirus|firewall|defender|windows security)", "Disabling security software is blocked."),
    # Net abuse
    (r"(scan|brute.?force|dos|ddos|flood)\s+(port|network|server|ip)", "Network attack commands are blocked."),
]

# RISKY: require confirmation before executing
RISKY_PATTERNS = [
    (r"(delete|remove|erase|trash|wipe)\s+(\w+\.\w+|file|folder|directory|all|everything|this\b)", "Deleting files or folders requires your confirmation."),
    (r"(shutdown|restart|reboot|hibernate|log.?off)\s*(the\s+)?(laptop|computer|pc|system)?", "Shutting down or restarting requires your confirmation."),
    (r"(kill|terminate|end|close|force.?quit)\s+(process|task|app|program|application|\w+)", "Killing a running process requires your confirmation."),
    (r"close\s+unsaved", "Closing unsaved work requires your confirmation."),
    (r"(uninstall|remove)\s+(app|application|program|software|package)", "Uninstalling software requires your confirmation."),
    (r"(clear|wipe|delete)\s+(all\s+)?(history|cache|temp|cookies|downloads)", "Clearing stored data requires your confirmation."),
    (r"(move|cut|rename)\s+.+\s+to\s+", "Moving or renaming files requires your confirmation."),
    (r"(empty|clear)\s+(recycle\s*bin|trash)", "Emptying the recycle bin requires your confirmation."),
    (r"(end|close)\s+all\s+(windows|apps|applications|programs)", "Closing all applications requires your confirmation."),
    (r"factory\s+reset|reinstall\s+windows|reset\s+this\s+pc", "Factory resetting requires your confirmation."),
]

# SAFE: execute immediately (explicit allowlist — checked last as catch-all fallthrough)
SAFE_PATTERNS = [
    r"(open|launch|start|go to|show me)\s+\w+",
    r"(search|google|look up|find)\s+",
    r"(play|stream|listen to)\s+",
    r"(what|tell me|check|show)\s+(is\s+)?(the\s+)?(time|date|battery|cpu|ram|volume|weather)",
    r"(set|change|adjust)\s+volume",
    r"(mute|unmute)\s*(the\s+)?(laptop|speaker|mic|microphone)?",
    r"(read|summarize|open)\s+(pdf|doc|docx|txt|file)",
    r"(take|make|create)\s+(a\s+)?(note|reminder|screenshot)",
    r"(minimize|maximize|snap|switch|focus)\s+(window|app)",
    r"(lock|sleep)\s+(the\s+)?(laptop|screen|computer)?",
]


# ── Classifier ─────────────────────────────────────────────────────────────────

def classify(text: str) -> ClassificationResult:
    """
    Classify a natural-language command intent into SAFE / RISKY / BLOCKED.

    Args:
        text: The user's spoken or typed command.

    Returns:
        ClassificationResult with tier, reason, and matched action label.
    """
    if not text:
        return ClassificationResult(tier=SecurityTier.SAFE, reason="Empty input.", raw=text)

    normalized = text.lower().strip()
    normalized = re.sub(r"\s+", " ", normalized)

    # 1. Check BLOCKED first (highest priority)
    for pattern, reason in BLOCKED_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            logger.warning(f"[SECURITY] BLOCKED: '{text[:80]}' matched: {pattern}")
            return ClassificationResult(
                tier=SecurityTier.BLOCKED,
                reason=reason,
                action="blocked",
                raw=text,
            )

    # 2. Check RISKY
    for pattern, reason in RISKY_PATTERNS:
        if re.search(pattern, normalized, re.IGNORECASE):
            logger.info(f"[SECURITY] RISKY: '{text[:80]}' matched: {pattern}")
            return ClassificationResult(
                tier=SecurityTier.RISKY,
                reason=reason,
                action="requires_confirmation",
                raw=text,
            )

    # 3. Default: SAFE
    logger.debug(f"[SECURITY] SAFE: '{text[:80]}'")
    return ClassificationResult(
        tier=SecurityTier.SAFE,
        reason="This command is safe to execute.",
        action="execute",
        raw=text,
    )


def is_confirmation(text: str) -> bool:
    """
    Returns True if the user's response is an affirmative confirmation
    (for use in the RISKY confirmation loop).
    """
    YES = {"yes", "yeah", "yep", "confirm", "proceed", "do it", "go ahead",
           "sure", "ok", "okay", "absolutely", "affirmative", "correct"}
    t = text.lower().strip()
    return any(word in t for word in YES)


def is_cancellation(text: str) -> bool:
    """
    Returns True if the user's response is a cancellation.
    """
    NO = {"no", "nope", "cancel", "stop", "abort", "don't", "do not",
          "negative", "never mind", "nevermind", "skip"}
    t = text.lower().strip()
    return any(word in t for word in NO)

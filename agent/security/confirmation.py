"""
Cheeni Security — Interactive User Confirmation Manager
Handles interactive verification for RISKY commands.
"""

from typing import Dict, Any
import uuid
import time

# Pending confirmations stored in-memory
# { confirmation_id: { "command": str, "intent": str, "created_at": float, "status": "pending" } }
_PENDING_CONFIRMATIONS: Dict[str, Dict[str, Any]] = {}
EXPIRY_SECONDS = 60


def create_confirmation_request(command: str, intent: str) -> dict:
    conf_id = str(uuid.uuid4())[:8]
    _PENDING_CONFIRMATIONS[conf_id] = {
        "command": command,
        "intent": intent,
        "created_at": time.time(),
        "status": "pending"
    }
    return {
        "confirmation_required": True,
        "confirmation_id": conf_id,
        "warning": f"⚠️ This action is potentially destructive: '{command}'. Do you confirm? (Reply YES or NO)",
        "expires_in": EXPIRY_SECONDS
    }


def verify_confirmation(conf_id: str, approved: bool) -> bool:
    if conf_id not in _PENDING_CONFIRMATIONS:
        return False
    
    req = _PENDING_CONFIRMATIONS[conf_id]
    if time.time() - req["created_at"] > EXPIRY_SECONDS:
        del _PENDING_CONFIRMATIONS[conf_id]
        return False
    
    del _PENDING_CONFIRMATIONS[conf_id]
    return approved

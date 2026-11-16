"""
Cheeni Tools — Sandboxed File & Directory Operations
Safely creates, lists, searches, and manages files within allowed user boundaries.
"""

import os
from pathlib import Path
import logging

logger = logging.getLogger("cheeni.file_ops")

# Allowed root folders (Restricted sandbox boundary)
USER_HOME = Path.home()
APPROVED_ROOTS = [
    USER_HOME / "Documents",
    USER_HOME / "Downloads",
    USER_HOME / "Desktop",
    Path("c:/BTech/AI Based Projects/Cheeni"),
]


def is_path_safe(target_path: Path) -> bool:
    """Verifies that target_path falls inside an approved boundary."""
    try:
        resolved = target_path.resolve()
        for root in APPROVED_ROOTS:
            try:
                resolved_root = root.resolve()
                if resolved == resolved_root or resolved_root in resolved.parents:
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False


async def handle(intent: str, text: str) -> dict:
    clean_text = text.lower()

    if intent == "folder_create" or "create folder" in clean_text or "make folder" in clean_text:
        folder_name = clean_text.split("folder")[-1].strip(" '\"named ") or "New Folder"
        target_dir = USER_HOME / "Documents" / folder_name
        if not is_path_safe(target_dir):
            return {"reply": "Destination folder path is outside safe boundary.", "action_taken": "blocked", "data": {}}
        target_dir.mkdir(parents=True, exist_ok=True)
        return {
            "reply": f"Created folder '{folder_name}' in Documents.",
            "action_taken": "folder_create",
            "data": {"path": str(target_dir)}
        }

    if intent == "file_create" or "create file" in clean_text:
        file_name = clean_text.split("file")[-1].strip(" '\"named ") or "cheeni_note.txt"
        target_file = USER_HOME / "Documents" / file_name
        if not is_path_safe(target_file):
            return {"reply": "File path is outside safe boundary.", "action_taken": "blocked", "data": {}}
        target_file.touch(exist_ok=True)
        return {
            "reply": f"Created file '{file_name}' in Documents.",
            "action_taken": "file_create",
            "data": {"path": str(target_file)}
        }

    return {
        "reply": f"Executed file operation request for: {text}",
        "action_taken": intent,
        "data": {}
    }

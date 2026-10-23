"""
Cheeni Desktop Agent -- Filesystem & Document Intelligence (Phase 6)

Provides voice-controlled file management and document parsing:
- Safely search, create, rename, and move files within the user's home directory.
- Extract text from .txt, .pdf (PyPDF2), and .docx (python-docx) files.
"""

import os
import shutil
from pathlib import Path
from typing import List, Dict, Any, Optional
from utils.logging import logger

try:
    import PyPDF2
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False

try:
    import docx
    DOCX_AVAILABLE = True
except ImportError:
    DOCX_AVAILABLE = False

# ── Filesystem Sandbox ────────────────────────────────────────────────────────

def _get_sandbox_root() -> Path:
    """Return the user home path used to derive approved data folders."""
    return Path.home().resolve()

def _get_allowed_roots() -> tuple[Path, ...]:
    home = _get_sandbox_root()
    return tuple((home / name).resolve() for name in ("Desktop", "Documents", "Downloads"))

def _is_safe_path(target_path: str | Path) -> bool:
    """Ensure the target path is within the user's home directory."""
    try:
        target = Path(target_path).expanduser().resolve()
        return any(root == target or root in target.parents for root in _get_allowed_roots())
    except Exception:
        return False

def _resolve_and_verify(target_path: str) -> Optional[Path]:
    """Resolve a path and verify it passes sandbox checks."""
    try:
        p = Path(target_path).expanduser().resolve()
        if _is_safe_path(p):
            return p
        return None
    except Exception:
        return None

# ── File & Folder Operations ──────────────────────────────────────────────────

def search_files(query: str, directory: str = "~/Downloads") -> Dict[str, Any]:
    """Recursively search for files matching a query inside the directory."""
    if not isinstance(query, str) or not query.strip() or len(query) > 120:
        return {"success": False, "error": "Search query must contain 1 to 120 characters"}
    base_dir = _resolve_and_verify(directory)
    if not base_dir or not base_dir.is_dir():
        return {"success": False, "error": "Invalid or unsafe search directory"}

    results = []
    try:
        # Search down to 3 levels deep to avoid massive latency
        q = query.strip().lower()
        for i, path in enumerate(base_dir.rglob("*")):
            if i > 5000:  # limit search space
                break
            if q in path.name.lower():
                results.append(str(path))
                if len(results) >= 20: # return top 20 matches
                    break

        return {
            "success": True,
            "query": query,
            "directory": str(base_dir),
            "matches": results,
            "count": len(results),
        }
    except Exception as e:
        logger.error("Search files failed")
        return {"success": False, "error": str(e)}


def create_folder(folder_path: str) -> Dict[str, Any]:
    """Create a new folder safely."""
    target = _resolve_and_verify(folder_path)
    if not target:
        return {"success": False, "error": "Invalid or unsafe path"}

    try:
        target.mkdir(parents=True, exist_ok=True)
        return {
            "success": True,
            "action": "create_folder",
            "path": str(target),
            "message": f"Folder '{target.name}' created successfully.",
        }
    except Exception as e:
        logger.error("Create folder failed")
        return {"success": False, "error": str(e)}


def rename_file(old_path: str, new_name: str) -> Dict[str, Any]:
    """Rename a file or folder safely."""
    src = _resolve_and_verify(old_path)
    if not src or not src.exists():
        return {"success": False, "error": "Source file not found or unsafe"}

    if (
        not isinstance(new_name, str)
        or not new_name.strip()
        or new_name in {".", ".."}
        or Path(new_name).name != new_name
        or "/" in new_name
        or "\\" in new_name
    ):
        return {"success": False, "error": "New name must be a single file or folder name"}

    dest = src.with_name(new_name.strip())
    if not _is_safe_path(dest):
        return {"success": False, "error": "Destination is unsafe"}

    if dest.exists():
        return {"success": False, "error": "Destination name already exists"}

    try:
        src.rename(dest)
        return {
            "success": True,
            "action": "rename",
            "old_path": str(src),
            "new_path": str(dest),
            "message": f"Renamed to '{new_name}'.",
        }
    except Exception as e:
        logger.error("Rename file failed")
        return {"success": False, "error": str(e)}


def move_file(src_path: str, dest_dir: str) -> Dict[str, Any]:
    """Move a file to a new directory safely."""
    src = _resolve_and_verify(src_path)
    if not src or not src.exists():
        return {"success": False, "error": "Source file not found or unsafe"}

    dest = _resolve_and_verify(dest_dir)
    if not dest:
        return {"success": False, "error": "Destination directory is unsafe"}

    try:
        dest.mkdir(parents=True, exist_ok=True)
        final_dest = dest / src.name
        
        if final_dest.exists():
            return {"success": False, "error": "Destination file already exists"}
            
        shutil.move(str(src), str(final_dest))
        return {
            "success": True,
            "action": "move",
            "src": str(src),
            "dest": str(final_dest),
            "message": f"Moved '{src.name}' to '{dest.name}'.",
        }
    except Exception as e:
        logger.error("Move file failed")
        return {"success": False, "error": str(e)}


# ── Document Intelligence ─────────────────────────────────────────────────────

def read_document(file_path: str, max_chars: int = 5000) -> Dict[str, Any]:
    """Extract text from .txt, .pdf, or .docx files safely."""
    target = _resolve_and_verify(file_path)
    if not target or not target.is_file():
        return {"success": False, "error": "File not found or unsafe"}

    ext = target.suffix.lower()
    text = ""

    try:
        if ext == ".txt" or ext == ".md" or ext == ".csv":
            with open(target, "r", encoding="utf-8", errors="ignore") as f:
                text = f.read(max_chars)
                
        elif ext == ".pdf":
            if not PDF_AVAILABLE:
                return {"success": False, "error": "PyPDF2 is not installed"}
            with open(target, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                for page_number, page in enumerate(reader.pages):
                    if page_number >= 50:
                        break
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
                    if len(text) >= max_chars:
                        break
                text = text[:max_chars]

        elif ext == ".docx":
            if not DOCX_AVAILABLE:
                return {"success": False, "error": "python-docx is not installed"}
            doc = docx.Document(target)
            for para in doc.paragraphs:
                text += para.text + "\n"
                if len(text) >= max_chars:
                    break
            text = text[:max_chars]

        else:
            return {"success": False, "error": f"Unsupported file type: {ext}"}

        return {
            "success": True,
            "action": "read_document",
            "file": target.name,
            "content": text.strip(),
            "truncated": len(text) >= max_chars,
        }

    except Exception as e:
        logger.error("Read document failed")
        return {"success": False, "error": str(e)}

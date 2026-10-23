import hashlib
import json
import os
import secrets
import shutil
import sqlite3
import tempfile
import time
import zipfile
from contextlib import closing
from pathlib import Path
from typing import Any

PREVIEW_TTL_SECONDS = 300
MAX_FILE_BYTES = 500 * 1024 * 1024
MAX_READ_BYTES = 2 * 1024 * 1024
MAX_SEARCH_ENTRIES = 5000
MAX_SEARCH_RESULTS = 20
MAX_SEARCH_DEPTH = 8
SUPPORTED_READ_SUFFIXES = {".txt", ".md", ".csv", ".pdf", ".docx"}


def _get_allowed_roots() -> tuple[Path, ...]:
    home = Path.home()
    return tuple(home / name for name in ("Desktop", "Documents", "Downloads"))


def _database_path() -> Path:
    configured = os.environ.get("CHEENI_FILE_OPS_DB")
    if configured:
        return Path(configured)
    base = Path(os.environ.get("LOCALAPPDATA") or (Path.home() / "AppData" / "Local"))
    return base / "Cheeni" / "file_operations.sqlite3"


def _is_reparse_point(path: Path) -> bool:
    try:
        attributes = getattr(path.lstat(), "st_file_attributes", 0)
        return path.is_symlink() or bool(attributes & 0x400)
    except FileNotFoundError:
        return False
    except OSError:
        return True


def _connect() -> sqlite3.Connection:
    database = _database_path()
    database.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database, timeout=10, isolation_level=None)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute(
        "CREATE TABLE IF NOT EXISTS file_operations ("
        "operation_id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, state TEXT NOT NULL, "
        "created_at REAL NOT NULL, expires_at REAL NOT NULL, plan_json TEXT NOT NULL, result_json TEXT)"
    )
    connection.execute("DELETE FROM file_operations WHERE created_at < ?", (time.time() - 30 * 24 * 60 * 60,))
    return connection


def _root_for(path: Path) -> Path | None:
    for candidate in _get_allowed_roots():
        try:
            root = candidate.resolve(strict=True)
            if _is_reparse_point(candidate) or not root.is_dir():
                continue
            path.relative_to(root)
            return root
        except (OSError, ValueError):
            continue
    return None


def _safe_path(raw_path: Any, *, must_exist: bool, expected: str | None = None) -> Path:
    if not isinstance(raw_path, str) or not raw_path or len(raw_path) > 2048 or "\x00" in raw_path:
        raise ValueError("Path must be an absolute path within Desktop, Documents, or Downloads")
    supplied = Path(raw_path)
    if not supplied.is_absolute() or any(part == ".." for part in supplied.parts):
        raise ValueError("Relative paths and parent traversal are not allowed")
    if os.name == "nt" and (raw_path.startswith(("\\\\", "\\?", "\\.")) or ":" in raw_path[2:]):
        raise ValueError("Network, device, and alternate-stream paths are not allowed")

    lexical = Path(os.path.abspath(supplied))
    root = _root_for(lexical)
    if root is None:
        raise ValueError("Path is outside the approved user folders")

    try:
        relative = lexical.relative_to(root)
    except ValueError as error:
        raise ValueError("Path is outside the approved user folders") from error

    cursor = root
    if _is_reparse_point(root):
        raise ValueError("Redirected or linked approved folders are not supported yet")
    for part in relative.parts:
        cursor = cursor / part
        try:
            if _is_reparse_point(cursor):
                raise ValueError("Symbolic links and reparse points are not supported")
        except OSError as error:
            raise ValueError("Could not safely inspect the path") from error

    try:
        resolved = lexical.resolve(strict=must_exist)
    except (OSError, RuntimeError) as error:
        raise ValueError("Path does not exist or cannot be resolved safely") from error
    resolved_root = _root_for(resolved)
    if resolved_root is None or resolved_root != root:
        raise ValueError("Resolved path is outside its approved folder")
    if expected == "file":
        if not resolved.is_file():
            raise ValueError("Only regular files are supported for this operation")
        if resolved.stat().st_nlink != 1:
            raise ValueError("Files with multiple hard links are not supported")
    if expected == "directory" and not resolved.is_dir():
        raise ValueError("The selected destination must be an existing folder")
    return resolved


def _file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _fingerprint(path: Path) -> dict[str, Any]:
    info = path.stat()
    if path.is_file():
        if info.st_nlink != 1:
            raise ValueError("Files with multiple hard links are not supported")
        if info.st_size > MAX_FILE_BYTES:
            raise ValueError("Files larger than 500 MiB are not supported")
        content_hash = _file_digest(path)
    else:
        content_hash = None
    return {
        "device": info.st_dev,
        "inode": info.st_ino,
        "mode": info.st_mode,
        "size": info.st_size,
        "mtime_ns": info.st_mtime_ns,
        "link_count": info.st_nlink,
        "sha256": content_hash,
    }


def _same_fingerprint(path: Path, expected: dict[str, Any]) -> bool:
    try:
        return _fingerprint(path) == expected
    except (OSError, ValueError):
        return False


def _matches_linked_file(path: Path, expected: dict[str, Any]) -> bool:
    try:
        info = path.stat()
        return (
            info.st_dev == expected["device"]
            and info.st_ino == expected["inode"]
            and info.st_mode == expected["mode"]
            and info.st_size == expected["size"]
            and info.st_mtime_ns == expected["mtime_ns"]
            and _file_digest(path) == expected["sha256"]
        )
    except (OSError, ValueError):
        return False


def _name_is_safe(name: Any) -> str:
    if not isinstance(name, str) or not name.strip() or len(name) > 255:
        raise ValueError("Name must contain 1 to 255 characters")
    value = name.strip()
    if value in {".", ".."} or Path(value).name != value or any(char in value for char in "/\\\x00"):
        raise ValueError("Name must be a single file or folder name")
    if any(ord(char) < 32 for char in value) or value.endswith((".", " ")):
        raise ValueError("Name contains unsupported characters")
    if os.name == "nt" and value.split(".")[0].upper() in {
        "CON", "PRN", "AUX", "NUL", *(f"COM{index}" for index in range(1, 10)), *(f"LPT{index}" for index in range(1, 10))
    }:
        raise ValueError("Reserved Windows device names are not allowed")
    return value


def _build_plan(owner_id: str, request: dict[str, Any]) -> dict[str, Any]:
    kind = request.get("type")
    allowed_fields = {
        "create_folder": {"type", "parent", "name"},
        "rename": {"type", "source", "name"},
        "move": {"type", "source", "destination"},
        "copy": {"type", "source", "destination"},
    }
    if kind not in allowed_fields or set(request) != allowed_fields[kind]:
        raise ValueError("Choose a supported operation with exactly the required fields")

    plan: dict[str, Any] = {"type": kind, "owner_id": owner_id}
    if kind == "create_folder":
        parent = _safe_path(request["parent"], must_exist=True, expected="directory")
        name = _name_is_safe(request["name"])
        target = parent / name
        _safe_path(str(target), must_exist=False)
        if target.exists():
            raise ValueError("The destination already exists")
        plan.update(parent=str(parent), target=str(target), parent_fingerprint=_fingerprint(parent), name=name)
    elif kind == "rename":
        source = _safe_path(request["source"], must_exist=True, expected="file")
        name = _name_is_safe(request["name"])
        target = source.with_name(name)
        _safe_path(str(target), must_exist=False)
        if target.exists():
            raise ValueError("The destination already exists")
        plan.update(source=str(source), target=str(target), source_fingerprint=_fingerprint(source), name=name)
    else:
        source = _safe_path(request["source"], must_exist=True, expected="file")
        destination_dir = _safe_path(request["destination"], must_exist=True, expected="directory")
        if kind == "move" and source.stat().st_dev != destination_dir.stat().st_dev:
            raise ValueError("Moving between different drives is not supported")
        target = destination_dir / source.name
        _safe_path(str(target), must_exist=False)
        if target.exists():
            raise ValueError("The destination already exists")
        plan.update(
            source=str(source), target=str(target), source_fingerprint=_fingerprint(source),
            destination_fingerprint=_fingerprint(destination_dir),
        )
        if kind == "copy":
            plan["available_bytes"] = shutil.disk_usage(destination_dir).free
    return plan


def _public_preview(operation_id: str, state: str, created_at: float, expires_at: float, plan: dict[str, Any]) -> dict[str, Any]:
    source = plan.get("source")
    target = plan.get("target")
    size = plan.get("source_fingerprint", {}).get("size", 0)
    return {
        "operation_id": operation_id,
        "type": plan["type"],
        "state": state,
        "created_at": created_at,
        "expires_at": expires_at,
        "source": source,
        "destination": target,
        "parent": plan.get("parent"),
        "name": plan.get("name"),
        "item_count": 1,
        "estimated_bytes": size,
        "available_bytes": plan.get("available_bytes"),
        "collision_policy": "reject; no overwrite",
        "undo_available": state == "completed" and plan["type"] in {"rename", "move"},
    }


def create_preview(owner_id: str, request: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(owner_id, str) or not owner_id or len(owner_id) > 128:
        raise ValueError("Authenticated owner is invalid")
    plan = _build_plan(owner_id, request)
    now = time.time()
    expires = now + PREVIEW_TTL_SECONDS
    operation_id = secrets.token_urlsafe(32)
    with closing(_connect()) as connection:
        connection.execute(
            "INSERT INTO file_operations(operation_id, owner_id, state, created_at, expires_at, plan_json) VALUES (?, ?, ?, ?, ?, ?)",
            (operation_id, owner_id, "pending", now, expires, json.dumps(plan)),
        )
    return _public_preview(operation_id, "pending", now, expires, plan)


def get_preview(owner_id: str, operation_id: str) -> dict[str, Any]:
    with closing(_connect()) as connection:
        row = connection.execute(
            "SELECT * FROM file_operations WHERE operation_id = ? AND owner_id = ?", (operation_id, owner_id)
        ).fetchone()
    if row is None:
        raise LookupError("Operation was not found")
    plan = json.loads(row["plan_json"])
    state = row["state"]
    if state == "pending" and row["expires_at"] <= time.time():
        with closing(_connect()) as connection:
            connection.execute(
                "UPDATE file_operations SET state = 'expired' WHERE operation_id = ? AND owner_id = ? AND state = 'pending'",
                (operation_id, owner_id),
            )
        state = "expired"
    result = _public_preview(operation_id, state, row["created_at"], row["expires_at"], plan)
    if row["result_json"]:
        result["result"] = json.loads(row["result_json"])
    return result


def cancel_preview(owner_id: str, operation_id: str) -> dict[str, Any]:
    with closing(_connect()) as connection:
        cursor = connection.execute(
            "UPDATE file_operations SET state = 'cancelled' WHERE operation_id = ? AND owner_id = ? AND state = 'pending' AND expires_at > ?",
            (operation_id, owner_id, time.time()),
        )
    if cursor.rowcount != 1:
        raise ValueError("Operation is missing, expired, or no longer pending")
    return get_preview(owner_id, operation_id)


def _execute_plan(plan: dict[str, Any]) -> dict[str, Any]:
    kind = plan["type"]
    if kind == "create_folder":
        parent = _safe_path(plan["parent"], must_exist=True, expected="directory")
        if not _same_fingerprint(parent, plan["parent_fingerprint"]):
            raise ValueError("The parent folder changed after preview; create a new preview")
        target = _safe_path(plan["target"], must_exist=False)
        target.mkdir(exist_ok=False)
        return {"success": True, "state": "completed", "type": kind, "destination": str(target), "undo_available": False}

    source = _safe_path(plan["source"], must_exist=True, expected="file")
    if not _same_fingerprint(source, plan["source_fingerprint"]):
        raise ValueError("The source changed after preview; create a new preview")
    target = _safe_path(plan["target"], must_exist=False)
    if target.exists():
        raise ValueError("The destination appeared after preview; nothing was overwritten")
    if kind in {"move", "rename"}:
        parent = _safe_path(str(target.parent), must_exist=True, expected="directory")
        if kind == "move" and not _same_fingerprint(parent, plan["destination_fingerprint"]):
            raise ValueError("The destination folder changed after preview; create a new preview")
        try:
            os.link(source, target)
            if not _matches_linked_file(target, plan["source_fingerprint"]):
                raise ValueError("The source changed during the operation; create a fresh preview")
            source.unlink()
        except Exception:
            if target.exists() and source.exists() and os.path.samefile(source, target):
                try:
                    target.unlink()
                except OSError:
                    return {"success": False, "state": "recovery_required", "type": kind, "source": str(source), "destination": str(target), "message": "Both paths remain after an interrupted move; inspect them before retrying"}
            raise
        if not _same_fingerprint(target, plan["source_fingerprint"]):
            return {"success": False, "state": "recovery_required", "type": kind, "destination": str(target), "message": "The file moved but its final identity could not be verified; inspect it before retrying"}
        return {"success": True, "state": "completed", "type": kind, "source": str(source), "destination": str(target), "undo_available": True}

    if kind == "copy":
        if shutil.disk_usage(target.parent).free < plan["source_fingerprint"]["size"]:
            raise ValueError("There is not enough free space to complete this copy")
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(prefix=".cheeni-", suffix=".tmp", dir=target.parent, delete=False) as temp:
                temporary = Path(temp.name)
            shutil.copy2(source, temporary)
            if _file_digest(temporary) != plan["source_fingerprint"]["sha256"]:
                raise ValueError("Copied file verification failed")
            os.link(temporary, target)
            try:
                temporary.unlink()
            except OSError:
                pass
            if _file_digest(target) != plan["source_fingerprint"]["sha256"]:
                return {"success": False, "state": "recovery_required", "type": kind, "destination": str(target), "message": "The destination changed during verification; review it manually before retrying"}
            return {"success": True, "state": "completed", "type": kind, "source": str(source), "destination": str(target), "undo_available": False}
        finally:
            if temporary and temporary.exists():
                try:
                    temporary.unlink()
                except OSError:
                    pass
    raise ValueError("Unsupported operation")


def confirm_preview(owner_id: str, operation_id: str) -> dict[str, Any]:
    now = time.time()
    with closing(_connect()) as connection:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT * FROM file_operations WHERE operation_id = ? AND owner_id = ?", (operation_id, owner_id)
        ).fetchone()
        if row is None:
            connection.rollback()
            raise LookupError("Operation was not found")
        if row["state"] != "pending" or row["expires_at"] <= now:
            if row["state"] == "pending":
                connection.execute("UPDATE file_operations SET state = 'expired' WHERE operation_id = ?", (operation_id,))
                connection.commit()
            else:
                connection.rollback()
            raise ValueError("Operation is expired or has already been used")
        connection.execute("UPDATE file_operations SET state = 'executing' WHERE operation_id = ? AND state = 'pending'", (operation_id,))
        connection.commit()

    plan = json.loads(row["plan_json"])
    try:
        result = _execute_plan(plan)
        state = result.get("state", "completed")
    except Exception as error:
        result = {"success": False, "state": "failed", "message": str(error) if isinstance(error, ValueError) else "Filesystem operation failed safely"}
        state = "failed"
    with closing(_connect()) as connection:
        connection.execute(
            "UPDATE file_operations SET state = ?, result_json = ? WHERE operation_id = ? AND owner_id = ? AND state = 'executing'",
            (state, json.dumps(result), operation_id, owner_id),
        )
    response = _public_preview(operation_id, state, row["created_at"], row["expires_at"], plan)
    response["result"] = result
    return response


def prepare_undo_preview(owner_id: str, operation_id: str) -> dict[str, Any]:
    previous = get_preview(owner_id, operation_id)
    if previous["state"] != "completed" or previous["type"] not in {"rename", "move"}:
        raise ValueError("This operation has no safe undo option")
    with closing(_connect()) as connection:
        row = connection.execute(
            "SELECT plan_json FROM file_operations WHERE operation_id = ? AND owner_id = ? AND state = 'completed'",
            (operation_id, owner_id),
        ).fetchone()
    if row is None:
        raise ValueError("This operation has no safe undo option")
    plan = json.loads(row["plan_json"])
    current = _safe_path(plan["target"], must_exist=True, expected="file")
    if not _same_fingerprint(current, plan["source_fingerprint"]):
        raise ValueError("The moved or renamed file changed after the operation; undo is no longer safe")
    if previous["type"] == "rename":
        request = {"type": "rename", "source": plan["target"], "name": Path(plan["source"]).name}
    else:
        request = {"type": "move", "source": plan["target"], "destination": str(Path(plan["source"]).parent)}
    return create_preview(owner_id, request)


def search_approved_files(query: str, root_name: str) -> dict[str, Any]:
    if not isinstance(query, str) or not query.strip() or len(query) > 120:
        raise ValueError("Search query must contain 1 to 120 characters")
    roots = {root.name.lower(): root for root in _get_allowed_roots()}
    base = roots.get(root_name.lower()) if isinstance(root_name, str) else None
    if base is None:
        raise ValueError("Choose Desktop, Documents, or Downloads")
    base = _safe_path(str(base), must_exist=True, expected="directory")
    results = []
    inspected = 0
    truncated = False
    for directory, names, files in os.walk(base, followlinks=False):
        current = Path(directory)
        depth = len(current.relative_to(base).parts)
        if depth >= MAX_SEARCH_DEPTH:
            if names:
                truncated = True
            names[:] = []
        if current != base and _is_reparse_point(current):
            names[:] = []
            continue
        names[:] = [name for name in names if not _is_reparse_point(current / name)]
        files[:] = [name for name in files if not _is_reparse_point(current / name)]
        for name in names + files:
            candidate = current / name
            inspected += 1
            if inspected > MAX_SEARCH_ENTRIES:
                truncated = True
                break
            if query.casefold() in name.casefold():
                results.append({
                    "path": str(candidate),
                    "kind": "folder" if candidate.is_dir() else "file",
                    "size": candidate.stat().st_size if candidate.is_file() else None,
                })
                if len(results) == MAX_SEARCH_RESULTS:
                    truncated = True
                    break
        if inspected > MAX_SEARCH_ENTRIES or len(results) == MAX_SEARCH_RESULTS:
            break
    return {"success": True, "query": query, "directory": str(base), "matches": results, "count": len(results), "truncated": truncated}


def read_approved_document(raw_path: str, max_chars: int = 5000) -> dict[str, Any]:
    target = _safe_path(raw_path, must_exist=True, expected="file")
    if target.suffix.lower() not in SUPPORTED_READ_SUFFIXES:
        raise ValueError("This document type is not supported")
    if target.stat().st_size > MAX_READ_BYTES:
        raise ValueError("Files larger than 2 MiB cannot be read")
    if target.suffix.lower() == ".docx":
        try:
            with zipfile.ZipFile(target) as archive:
                total_size = sum(info.file_size for info in archive.infolist())
                if total_size > 20 * 1024 * 1024 or any(
                    info.compress_size and info.file_size / info.compress_size > 100
                    for info in archive.infolist()
                ):
                    raise ValueError("This document expands beyond the safe reading limit")
        except zipfile.BadZipFile as error:
            raise ValueError("This document is invalid or corrupted") from error
    from tools.filesystem_control import read_document
    return read_document(str(target), max_chars=min(max_chars, 5000))

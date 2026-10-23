from pathlib import Path
import time

import pytest

from tools import file_operations


@pytest.fixture
def file_roots(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    for root in ("Desktop", "Documents", "Downloads"):
        (tmp_path / root).mkdir()
    monkeypatch.setenv("CHEENI_FILE_OPS_DB", str(tmp_path / "cheeni-state" / "operations.sqlite3"))
    return tmp_path


def test_create_folder_requires_preview_and_one_time_owner_confirmation(file_roots):
    parent = file_roots / "Downloads"
    request = {"type": "create_folder", "parent": str(parent), "name": "planned"}
    preview = file_operations.create_preview("user-a", request)

    assert not (parent / "planned").exists()
    assert preview["state"] == "pending"

    result = file_operations.confirm_preview("user-a", preview["operation_id"])
    assert result["state"] == "completed"
    assert (parent / "planned").is_dir()
    with pytest.raises(ValueError):
        file_operations.confirm_preview("user-a", preview["operation_id"])


def test_pending_operation_is_owner_scoped_and_cancel_has_no_effect(file_roots):
    parent = file_roots / "Documents"
    preview = file_operations.create_preview("user-a", {
        "type": "create_folder", "parent": str(parent), "name": "cancel-me"
    })

    with pytest.raises(LookupError):
        file_operations.get_preview("user-b", preview["operation_id"])
    file_operations.cancel_preview("user-a", preview["operation_id"])
    assert not (parent / "cancel-me").exists()
    with pytest.raises(ValueError):
        file_operations.confirm_preview("user-a", preview["operation_id"])


def test_stale_source_fingerprint_prevents_rename(file_roots):
    source = file_roots / "Downloads" / "source.txt"
    source.write_text("original", encoding="utf-8")
    preview = file_operations.create_preview("user-a", {
        "type": "rename", "source": str(source), "name": "renamed.txt"
    })
    source.write_text("changed after preview", encoding="utf-8")

    result = file_operations.confirm_preview("user-a", preview["operation_id"])
    assert result["state"] == "failed"
    assert source.read_text(encoding="utf-8") == "changed after preview"
    assert not source.with_name("renamed.txt").exists()


def test_rename_undo_is_a_separate_confirmed_preview(file_roots):
    source = file_roots / "Downloads" / "source.txt"
    source.write_text("stable", encoding="utf-8")
    original = file_operations.create_preview("user-a", {
        "type": "rename", "source": str(source), "name": "renamed.txt"
    })
    completed = file_operations.confirm_preview("user-a", original["operation_id"])
    assert completed["undo_available"] is True

    undo = file_operations.prepare_undo_preview("user-a", original["operation_id"])
    assert undo["state"] == "pending"
    assert not source.exists()
    undone = file_operations.confirm_preview("user-a", undo["operation_id"])
    assert undone["state"] == "completed"
    assert source.read_text(encoding="utf-8") == "stable"


def test_undo_refuses_file_changed_after_rename(file_roots):
    source = file_roots / "Downloads" / "source.txt"
    source.write_text("stable", encoding="utf-8")
    original = file_operations.create_preview("user-a", {
        "type": "rename", "source": str(source), "name": "renamed.txt"
    })
    file_operations.confirm_preview("user-a", original["operation_id"])
    renamed = source.with_name("renamed.txt")
    renamed.write_text("changed", encoding="utf-8")

    with pytest.raises(ValueError, match="changed after the operation"):
        file_operations.prepare_undo_preview("user-a", original["operation_id"])


def test_expired_preview_cannot_be_confirmed(file_roots, monkeypatch):
    parent = file_roots / "Downloads"
    preview = file_operations.create_preview("user-a", {
        "type": "create_folder", "parent": str(parent), "name": "too-late"
    })
    current_time = time.time()
    monkeypatch.setattr(file_operations.time, "time", lambda: current_time + file_operations.PREVIEW_TTL_SECONDS + 1)

    with pytest.raises(ValueError, match="expired"):
        file_operations.confirm_preview("user-a", preview["operation_id"])
    assert not (parent / "too-late").exists()


def test_copy_verifies_output_and_rejects_collisions(file_roots):
    source = file_roots / "Downloads" / "source.txt"
    destination = file_roots / "Documents"
    source.write_text("copy me", encoding="utf-8")
    preview = file_operations.create_preview("user-a", {
        "type": "copy", "source": str(source), "destination": str(destination)
    })

    result = file_operations.confirm_preview("user-a", preview["operation_id"])
    copied = destination / source.name
    assert result["state"] == "completed"
    assert copied.read_text(encoding="utf-8") == "copy me"
    assert source.read_text(encoding="utf-8") == "copy me"

    with pytest.raises(ValueError, match="already exists"):
        file_operations.create_preview("user-a", {
            "type": "copy", "source": str(source), "destination": str(destination)
        })


def test_paths_and_unexpected_fields_fail_closed(file_roots):
    with pytest.raises(ValueError):
        file_operations.create_preview("user-a", {
            "type": "create_folder", "parent": str(file_roots / "Downloads" / ".." / "Documents"),
            "name": "escape", "confirmed": True
        })
    with pytest.raises(ValueError):
        file_operations.create_preview("user-a", {
            "type": "copy", "source": str(file_roots / "outside.txt"),
            "destination": str(file_roots / "Downloads")
        })


def test_symlink_inside_approved_root_is_rejected(file_roots):
    downloads = file_roots / "Downloads"
    outside = file_roots / "outside.txt"
    outside.write_text("private", encoding="utf-8")
    link = downloads / "linked.txt"
    try:
        link.symlink_to(outside)
    except (OSError, NotImplementedError):
        pytest.skip("Symlink creation is not permitted in this environment")

    with pytest.raises(ValueError, match="Symbolic links"):
        file_operations.create_preview("user-a", {
            "type": "rename", "source": str(link), "name": "renamed.txt"
        })


def test_search_and_read_are_bounded_to_approved_roots(file_roots):
    downloads = file_roots / "Downloads"
    (downloads / "notes.txt").write_text("local content", encoding="utf-8")
    result = file_operations.search_approved_files("notes", "Downloads")
    assert result["count"] == 1

    read = file_operations.read_approved_document(str(downloads / "notes.txt"))
    assert read["content"] == "local content"

    with pytest.raises(ValueError):
        file_operations.read_approved_document(str(file_roots / "outside.txt"))

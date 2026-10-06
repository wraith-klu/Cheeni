import pytest
from pathlib import Path
from tools.filesystem_control import (
    _is_safe_path,
    search_files,
    create_folder,
    rename_file,
    move_file,
    read_document,
)

def test_is_safe_path():
    # Should be safe since it defaults to home directory sandbox
    safe1 = Path.home() / "Documents" / "test.txt"
    safe2 = Path.home() / "Downloads" / "subfolder" / "test.txt"
    assert _is_safe_path(safe1) is True
    assert _is_safe_path(safe2) is True
    
    # Should be unsafe
    unsafe1 = Path("C:/Windows/System32/cmd.exe")
    assert _is_safe_path(unsafe1) is False
    
def test_create_and_rename_and_move_and_search(tmp_path, monkeypatch):
    # Mock home directory to tmp_path for isolated testing
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    
    # 1. Create Folder
    folder_path = str(tmp_path / "cheeni_test_dir")
    res = create_folder(folder_path)
    assert res["success"] is True
    assert Path(folder_path).exists()
    
    # Create a dummy file inside it
    dummy_file = Path(folder_path) / "dummy.txt"
    dummy_file.write_text("Hello Cheeni!")
    
    # 2. Read Document
    res = read_document(str(dummy_file))
    assert res["success"] is True
    assert "Hello Cheeni" in res["content"]
    
    # 3. Rename File
    renamed_file = "renamed_dummy.txt"
    res = rename_file(str(dummy_file), renamed_file)
    assert res["success"] is True
    new_path = Path(folder_path) / renamed_file
    assert new_path.exists()
    
    # 4. Search Files
    res = search_files("renamed_dummy", directory=folder_path)
    assert res["success"] is True
    assert len(res["matches"]) == 1
    assert str(new_path) in res["matches"]
    
    # 5. Move File
    dest_dir = str(tmp_path / "cheeni_dest_dir")
    res = move_file(str(new_path), dest_dir)
    assert res["success"] is True
    moved_path = Path(dest_dir) / renamed_file
    assert moved_path.exists()

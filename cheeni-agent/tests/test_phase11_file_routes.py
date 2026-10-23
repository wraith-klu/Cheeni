from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from config.settings import settings
from core.server import app


@pytest.fixture
def api_client(tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", lambda: tmp_path)
    for root in ("Desktop", "Documents", "Downloads"):
        (tmp_path / root).mkdir()
    monkeypatch.setenv("CHEENI_FILE_OPS_DB", str(tmp_path / "agent-state" / "operations.sqlite3"))
    monkeypatch.setattr(settings, "API_TOKEN", "phase11-test-token-with-more-than-32-chars")
    return TestClient(app), {"Authorization": "Bearer phase11-test-token-with-more-than-32-chars"}, tmp_path


def test_file_agent_routes_require_token_and_disable_direct_mutations(api_client):
    client, auth, _ = api_client
    assert client.post("/api/files/create_folder", json={"path": "x"}).status_code == 401
    assert client.post("/api/files/create_folder", headers=auth, json={"path": "x"}).status_code == 410
    assert client.post("/api/files/rename", headers=auth, json={"old_path": "x", "new_name": "y"}).status_code == 410
    assert client.post("/api/files/move", headers=auth, json={"src_path": "x", "dest_dir": "y"}).status_code == 410
    assert client.post("/api/command", headers=auth, json={"text": "create a folder"}).status_code == 410


def test_api_preview_is_owner_bound_and_confirmed_once(api_client):
    client, auth, home = api_client
    parent = home / "Downloads"
    response = client.post("/api/files/operations/preview", headers=auth, json={
        "owner_id": "authenticated-user", "type": "create_folder", "parent": str(parent), "name": "api-created"
    })
    assert response.status_code == 200
    preview = response.json()["preview"]
    assert not (parent / "api-created").exists()

    wrong_owner = client.get(
        f"/api/files/operations/{preview['operation_id']}?owner_id=other-user", headers=auth
    )
    assert wrong_owner.status_code == 404

    confirm = client.post(
        f"/api/files/operations/{preview['operation_id']}/confirm",
        headers=auth,
        json={"owner_id": "authenticated-user"},
    )
    assert confirm.status_code == 200
    assert confirm.json()["operation"]["state"] == "completed"
    assert (parent / "api-created").is_dir()

    replay = client.post(
        f"/api/files/operations/{preview['operation_id']}/confirm",
        headers=auth,
        json={"owner_id": "authenticated-user"},
    )
    assert replay.status_code == 409


def test_preview_schema_rejects_client_authority_fields(api_client):
    client, auth, home = api_client
    response = client.post("/api/files/operations/preview", headers=auth, json={
        "owner_id": "authenticated-user", "type": "create_folder", "parent": str(home / "Downloads"),
        "name": "should-not-run", "confirmed": True,
    })
    assert response.status_code == 422
    assert not (home / "Downloads" / "should-not-run").exists()

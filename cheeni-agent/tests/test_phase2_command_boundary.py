from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from starlette.websockets import WebSocketDisconnect

from config.settings import settings
from core import server
from voice.wakeword import WakeWordEngine


def test_legacy_conversation_endpoints_require_agent_token(monkeypatch):
    monkeypatch.setattr(settings, "API_TOKEN", "t" * 40)
    client = TestClient(server.app)

    assert client.get("/api/conversation/status").status_code == 401
    assert client.get("/api/conversation/history").status_code == 401
    assert client.post("/api/conversation/start", json={}).status_code == 401
    assert client.post("/api/conversation/stop").status_code == 401


def test_native_voice_start_paths_are_deferred(monkeypatch):
    token = "t" * 40
    monkeypatch.setattr(settings, "API_TOKEN", token)
    client = TestClient(server.app)
    headers = {"Authorization": f"Bearer {token}"}

    assert client.post("/api/voice/start-listening", headers=headers).status_code == 410
    assert client.post("/api/voice/sync-name", headers=headers, json={}).status_code == 410
    assert client.post("/api/voice/wake", headers=headers).status_code == 410
    assert client.post("/api/voice/speak", headers=headers, json={"text": "hello"}).status_code == 410
    assert client.post("/api/voice/session/end", headers=headers).status_code == 410
    assert client.post("/api/conversation/start", headers=headers, json={}).status_code == 410


def test_direct_telemetry_websocket_is_rejected():
    client = TestClient(server.app)

    with pytest.raises(WebSocketDisconnect) as error:
        with client.websocket_connect("/ws"):
            pass

    assert error.value.code == 1008


def test_wake_word_is_disabled_until_explicitly_enabled():
    engine = WakeWordEngine()

    assert engine.is_enabled is False
    assert engine.is_running is False
    engine.start()
    assert engine.is_running is False


def test_disabling_wake_word_stops_the_capture_thread():
    engine = WakeWordEngine()
    engine._enabled = True
    engine._running = True

    engine.disable()

    assert engine.is_enabled is False
    assert engine.is_running is False


def test_agent_lifespan_does_not_start_microphone_or_speaker(monkeypatch):
    speaker = SimpleNamespace(start=Mock(), speak=Mock(), stop_speaking=Mock(), stop=Mock())
    session = SimpleNamespace(state=SimpleNamespace(value="idle"), _on_state_change=None)
    conversation = SimpleNamespace(_loop=None, is_running=False, stop=Mock())
    wake = SimpleNamespace(on_detected=None, start=Mock(), stop=Mock())

    monkeypatch.setattr(server, "get_speaker", lambda: speaker)
    monkeypatch.setattr(server, "get_session", lambda: session)
    monkeypatch.setattr(server, "get_conversation_loop", lambda **_kwargs: conversation)
    monkeypatch.setattr(server, "get_wake_engine", lambda: wake)

    with TestClient(server.app):
        assert wake.start.call_count == 0
        assert speaker.start.call_count == 0
        assert speaker.speak.call_count == 0
        assert wake.on_detected is not None


def test_structured_tool_request_rejects_unknown_top_level_fields():
    with pytest.raises(ValidationError):
        server.StructuredToolRequest.model_validate({
            "name": "open_folder",
            "arguments": {"folder": "documents"},
            "confirmed": True,
        })


def test_structured_tool_request_requires_bounded_tool_name():
    with pytest.raises(ValidationError):
        server.StructuredToolRequest.model_validate({"name": "x" * 81, "arguments": {}})


def test_authenticated_tool_route_dispatches_registered_app_only(monkeypatch):
    from tools import app_control

    token = "t" * 40
    monkeypatch.setattr(settings, "API_TOKEN", token)
    monkeypatch.setattr(app_control, "_resolve_app_entry", lambda _name: {"exe": "notepad.exe"})
    monkeypatch.setattr(server, "launch_app", lambda name: {"success": True, "app": name})
    client = TestClient(server.app)

    response = client.post(
        "/api/agent/tool",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "launch_app", "arguments": {"app_name": "notepad"}},
    )

    assert response.status_code == 200
    assert response.json() == {"success": True, "app": "notepad"}


def test_agent_tool_rejects_extra_tool_arguments_before_dispatch(monkeypatch):
    token = "t" * 40
    monkeypatch.setattr(settings, "API_TOKEN", token)
    launch = Mock()
    monkeypatch.setattr(server, "launch_app", launch)
    client = TestClient(server.app)

    response = client.post(
        "/api/agent/tool",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "launch_app", "arguments": {"app_name": "notepad", "executable": "evil.exe"}},
    )

    assert response.status_code == 400
    launch.assert_not_called()

import asyncio
from types import SimpleNamespace
from unittest.mock import Mock

from tools import desktop_vision


def test_invalid_question_is_rejected_before_capture(monkeypatch):
    capture = Mock(side_effect=AssertionError("capture should not run"))
    monkeypatch.setattr(desktop_vision, "capture_screen_jpeg", capture)

    result = asyncio.run(desktop_vision.analyze_screen_with_gemini("  ", api_key="test-key"))

    assert result["success"] is False
    assert "1 to 500" in result["error"]
    capture.assert_not_called()


def test_missing_provider_key_does_not_capture_screen(monkeypatch):
    capture = Mock(side_effect=AssertionError("capture should not run"))
    monkeypatch.setattr(desktop_vision, "capture_screen_jpeg", capture)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    result = asyncio.run(desktop_vision.analyze_screen_with_gemini("What is on screen?"))

    assert result["success"] is False
    capture.assert_not_called()


def test_missing_provider_library_does_not_capture_screen(monkeypatch):
    capture = Mock(side_effect=AssertionError("capture should not run"))
    monkeypatch.setattr(desktop_vision, "capture_screen_jpeg", capture)
    monkeypatch.setattr(desktop_vision, "genai", None)

    result = asyncio.run(desktop_vision.analyze_screen_with_gemini("What is on screen?", api_key="test-key"))

    assert result == {"success": False, "error": "Screen vision provider is unavailable"}
    capture.assert_not_called()


def test_provider_exception_is_not_returned_to_client(monkeypatch):
    monkeypatch.setattr(desktop_vision, "capture_screen_jpeg", lambda **kwargs: b"image")
    monkeypatch.setattr(desktop_vision, "types", SimpleNamespace(Part=SimpleNamespace(from_bytes=lambda **kwargs: "image-part")))
    monkeypatch.setattr(
        desktop_vision,
        "genai",
        SimpleNamespace(Client=lambda **kwargs: SimpleNamespace(models=SimpleNamespace(generate_content=Mock(side_effect=RuntimeError("secret-provider-detail"))))),
    )

    result = asyncio.run(desktop_vision.analyze_screen_with_gemini("Explain this", api_key="test-key"))

    assert result["success"] is False
    assert "secret-provider-detail" not in result["error"]


def test_capture_parameters_are_bounded():
    for invalid_quality, invalid_dimension in ((0, 1280), (96, 1280), (75, 319), (75, 4097)):
        try:
            desktop_vision.capture_screen_jpeg(quality=invalid_quality, max_dim=invalid_dimension)
        except ValueError:
            continue
        raise AssertionError("invalid screenshot parameters should be rejected")

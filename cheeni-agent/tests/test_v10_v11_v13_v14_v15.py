"""
Comprehensive Automated Test Suite for JARVIS Phases V10, V11, V13, V14, V15.
Validates:
  - V10: Whisper STT Pipeline and PCM WAV formatting
  - V11: Playwright Browser Agent security and URL/action classification
  - V13: Emotion-Aware Edge TTS tone inference and voice presets
  - V14: Offline Local LLM Router fallback priority chain
  - V15: Personal Memory Store preferences, shortcuts, and contacts
"""

import asyncio
from unittest.mock import AsyncMock, Mock, patch
import pytest

# ── V10 Tests: Whisper STT Pipeline ───────────────────────────────────────────
from voice.whisper_listener import WhisperListener, _pcm_to_wav_bytes, WHISPER_OK


def test_v10_pcm_to_wav_formatting():
    """Verify raw PCM bytes are properly packed into a valid WAV header."""
    pcm_data = b"\x00\x00" * 1600  # 0.1s of silence at 16kHz int16
    wav_bytes = _pcm_to_wav_bytes(pcm_data, sample_rate=16000, channels=1, sample_width=2)
    assert wav_bytes.startswith(b"RIFF")
    assert b"WAVE" in wav_bytes
    assert b"fmt " in wav_bytes
    assert b"data" in wav_bytes
    assert len(wav_bytes) == len(pcm_data) + 44  # Standard 44-byte WAV header


def test_v10_whisper_listener_fallback(monkeypatch):
    """Verify WhisperListener falls back cleanly if faster-whisper is not installed or fails."""
    listener = WhisperListener()
    # Force WHISPER_OK to False
    monkeypatch.setattr("voice.whisper_listener.WHISPER_OK", False)
    loaded = listener.load_model()
    assert loaded is False
    assert listener._load_error is not None

    # Transcribing without loaded model falls back to Google SR
    with patch.object(listener, "_fallback_sr", return_value="hello sam"):
        result = listener.transcribe(b"\x00" * 3200)
        assert result == "hello sam"


# ── V11 Tests: Browser Automation Agent ───────────────────────────────────────
from tools.browser_agent import _is_sensitive_url, RISKY_CLICK_PATTERNS


def test_v11_browser_sensitive_domains():
    """Verify security guard identifies banking and payment domains as sensitive."""
    assert _is_sensitive_url("https://netbanking.hdfcbank.com") is True
    assert _is_sensitive_url("https://paytm.com/recharge") is True
    assert _is_sensitive_url("https://paypal.com/signin") is True
    assert _is_sensitive_url("https://github.com/wraith-klu/cheeni") is False
    assert _is_sensitive_url("https://wikipedia.org") is False


def test_v11_browser_risky_click_patterns():
    """Verify security regex identifies risky click targets (checkout, delete, submit)."""
    assert bool(RISKY_CLICK_PATTERNS.search("Submit Order")) is True
    assert bool(RISKY_CLICK_PATTERNS.search("Pay Now")) is True
    assert bool(RISKY_CLICK_PATTERNS.search("Confirm Payment")) is True
    assert bool(RISKY_CLICK_PATTERNS.search("Delete Account")) is True
    assert bool(RISKY_CLICK_PATTERNS.search("Search Google")) is False
    assert bool(RISKY_CLICK_PATTERNS.search("Next Page")) is False


# ── V13 Tests: Emotion-Aware Edge TTS ─────────────────────────────────────────
from voice.edge_speaker import infer_tone, VOICE_MAP, RATE_MAP


def test_v13_infer_tone_mapping():
    """Verify tone inference correctly maps keywords to emotion categories."""
    assert infer_tone("Done! Opened Google Chrome for you.") == "excited"
    assert infer_tone("Warning! Dangerous command blocked.") == "stern"
    assert infer_tone("About to delete system directory, please confirm.") == "stern"
    assert infer_tone("Battery low. Entering sleep mode.") == "calm"
    assert infer_tone("Hey there, happy to help you!") == "friendly"
    assert infer_tone("The current time is 9:30 PM.") == "neutral"


def test_v13_voice_and_rate_presets():
    """Verify all tone presets have corresponding neural voices and prosody rates."""
    tones = ["neutral", "excited", "calm", "stern", "friendly"]
    for t in tones:
        assert t in VOICE_MAP
        assert t in RATE_MAP
        assert VOICE_MAP[t].endswith("Neural")


# ── V14 Tests: Offline Local LLM Router ───────────────────────────────────────
from core.llm_router import call_llm, get_active_backend


@pytest.mark.asyncio
async def test_v14_llm_router_priority_chain(monkeypatch):
    """
    Verify fallback chain:
    Node Backend (fails) -> OpenRouter (fails) -> Gemini (succeeds) -> sets active backend
    """
    # 1. Mock Node backend failure
    monkeypatch.setattr("core.llm_router._call_node_backend", AsyncMock(side_effect=RuntimeError("Node offline")))

    # 2. Mock OpenRouter failure
    monkeypatch.setattr("core.llm_router._call_openrouter", AsyncMock(side_effect=RuntimeError("OpenRouter error")))

    # 3. Mock Gemini success
    monkeypatch.setattr("core.llm_router._call_gemini", AsyncMock(return_value="Hello from Gemini!"))

    messages = [{"role": "user", "content": "hello"}]
    reply = await call_llm(messages)

    assert reply == "Hello from Gemini!"
    assert get_active_backend() == "gemini"


@pytest.mark.asyncio
async def test_v14_llm_router_offline_ollama_fallback(monkeypatch):
    """Verify fallback to local Ollama when all cloud backends fail."""
    monkeypatch.setattr("core.llm_router._call_node_backend", AsyncMock(side_effect=RuntimeError("No network")))
    monkeypatch.setattr("core.llm_router._call_openrouter", AsyncMock(side_effect=RuntimeError("No network")))
    monkeypatch.setattr("core.llm_router._call_gemini", AsyncMock(side_effect=RuntimeError("No network")))
    monkeypatch.setattr("core.llm_router._call_ollama", AsyncMock(return_value="Hello from local Ollama Phi-3!"))

    messages = [{"role": "user", "content": "hello"}]
    reply = await call_llm(messages)

    assert reply == "Hello from local Ollama Phi-3!"
    assert get_active_backend() == "ollama_local"


# ── V15 Tests: Personalization Memory ─────────────────────────────────────────
from core.personal_memory import get_personal_memory


def test_v15_personal_memory_contacts():
    """Verify saving, retrieving, and listing personal contacts."""
    mem = get_personal_memory()
    mem.add_contact("Rahul Sharma", {"email": "rahul@example.com", "phone": "+91 9876543210"})

    contact = mem.get_contact("Rahul Sharma")
    assert contact is not None
    assert contact["email"] == "rahul@example.com"
    assert contact["phone"] == "+91 9876543210"

    contacts = mem.list_contacts()
    assert any(c["name"] == "rahul sharma" for c in contacts)

    mem.delete_contact("Rahul Sharma")
    assert mem.get_contact("Rahul Sharma") is None


def test_v15_memory_stats():
    """Verify memory database returns non-negative record statistics."""
    mem = get_personal_memory()
    stats = mem.get_stats()
    assert "preferences" in stats
    assert "shortcuts" in stats
    assert "contacts" in stats
    assert stats["preferences"] >= 0

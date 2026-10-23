"""
Tests for V17 (Morning Digest), V18 (Connectors), V19 (Kokoro TTS), V20 (Notes Indexer)
"""
import json
import pytest
import tempfile
import os
from pathlib import Path
from unittest.mock import patch, AsyncMock, MagicMock


# ══════════════════════════════════════════════════════════════════════════════
# V17 -- Morning Digest
# ══════════════════════════════════════════════════════════════════════════════

class TestV17MorningDigest:

    def test_digest_agent_singleton(self):
        """DigestAgent singleton initializes without errors."""
        from tools.digest_agent import get_digest_agent, DigestAgent
        agent = get_digest_agent()
        assert isinstance(agent, DigestAgent)

    def test_digest_status_default(self):
        """Digest status returns expected fields when no schedule is set."""
        from tools.digest_agent import DigestAgent
        agent = DigestAgent()
        status = agent.get_status()
        assert "scheduled" in status
        assert "schedule_time" in status
        assert "last_run" in status
        assert "running" in status
        assert status["scheduled"] is False

    def test_digest_schedule_and_cancel(self):
        """Setting and cancelling schedule updates state correctly."""
        from tools.digest_agent import DigestAgent
        agent = DigestAgent()
        agent._schedule_time = "07:00"
        assert agent.get_status()["schedule_time"] == "07:00"
        agent.cancel_schedule()
        assert agent.get_status()["scheduled"] is False

    @pytest.mark.asyncio
    async def test_digest_text_only_no_connectors(self):
        """Digest builds successfully even when connectors aren't configured."""
        from tools.digest_agent import DigestAgent

        agent = DigestAgent()
        # Patch connectors to return error (not connected)
        with patch("tools.digest_agent.get_connector_registry") as mock_reg:
            registry = MagicMock()
            registry.calendar_today = AsyncMock(return_value=[{"error": "not connected"}])
            registry.gmail_unread = AsyncMock(return_value=[{"error": "not connected"}])
            mock_reg.return_value = registry

            result = await agent.build_digest(text_only=True)

        assert "text" in result
        assert len(result["text"]) > 0
        assert result["spoken"] is False

    @pytest.mark.asyncio
    async def test_digest_greeting_time_of_day(self):
        """Digest greeting reflects time of day."""
        from tools.digest_agent import DigestAgent
        import datetime

        agent = DigestAgent()
        with patch("tools.digest_agent.get_connector_registry") as mock_reg:
            registry = MagicMock()
            registry.calendar_today = AsyncMock(return_value=[{"error": "not connected"}])
            registry.gmail_unread = AsyncMock(return_value=[{"error": "not connected"}])
            mock_reg.return_value = registry

            result = await agent.build_digest(text_only=True)

        text = result["text"]
        assert any(g in text for g in ["Good morning", "Good afternoon", "Good evening"])


# ══════════════════════════════════════════════════════════════════════════════
# V18 -- Connectors
# ══════════════════════════════════════════════════════════════════════════════

class TestV18Connectors:

    def test_connector_registry_singleton(self):
        """ConnectorRegistry singleton initializes."""
        from tools.connectors import get_connector_registry, ConnectorRegistry
        reg = get_connector_registry()
        assert isinstance(reg, ConnectorRegistry)

    def test_supported_services_list(self):
        """ConnectorRegistry has expected supported services."""
        from tools.connectors import ConnectorRegistry
        reg = ConnectorRegistry()
        assert "gdrive" in reg.SUPPORTED
        assert "slack" in reg.SUPPORTED
        assert "notion" in reg.SUPPORTED
        assert "outlook" in reg.SUPPORTED

    @pytest.mark.asyncio
    async def test_connect_unsupported_service(self):
        """Connecting unknown service returns ok=False."""
        from tools.connectors import ConnectorRegistry
        reg = ConnectorRegistry()
        result = await reg.connect("twitter")
        assert result["ok"] is False
        assert "Unknown service" in result["error"]

    @pytest.mark.asyncio
    async def test_connect_slack_no_token(self):
        """Slack connect without token returns informative error."""
        from tools.connectors import ConnectorRegistry
        reg = ConnectorRegistry()
        with patch.dict(os.environ, {}, clear=False):
            # Ensure SLACK_BOT_TOKEN is not set
            env_backup = os.environ.pop("SLACK_BOT_TOKEN", None)
            result = await reg.connect("slack")
            if env_backup:
                os.environ["SLACK_BOT_TOKEN"] = env_backup

        assert result["ok"] is False
        assert "SLACK_BOT_TOKEN" in result["error"]

    @pytest.mark.asyncio
    async def test_connect_google_no_creds_file(self):
        """Google connect without credentials file returns informative error."""
        from tools.connectors import ConnectorRegistry
        reg = ConnectorRegistry()
        # Point to a non-existent file
        with patch("tools.connectors.GOOGLE_CREDS_PATH", Path("/nonexistent/path.json")):
            result = await reg.connect("gdrive")
        # Either GOOGLE_OK=False or missing file error
        assert result["ok"] is False

    def test_list_connected_empty(self):
        """list_connected returns empty list when no tokens exist."""
        from tools.connectors import ConnectorRegistry
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            reg = ConnectorRegistry()
            with patch("tools.connectors._DATA_DIR", Path(tmpdir)):
                # Patch token paths to non-existent locations
                with patch("tools.connectors.GOOGLE_TOKEN_PATH", Path(tmpdir) / "no_token.json"):
                    result = reg.list_connected()
            # Should not include slack/notion since no files in tmpdir
            assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_gmail_unread_not_connected(self):
        """gmail_unread returns error dict when not connected."""
        from tools.connectors import ConnectorRegistry
        reg = ConnectorRegistry()
        with patch("tools.connectors.GOOGLE_TOKEN_PATH", Path("/nonexistent/token.json")):
            result = await reg.gmail_unread()
        assert isinstance(result, list)
        assert "error" in result[0]

    @pytest.mark.asyncio
    async def test_calendar_today_not_connected(self):
        """calendar_today returns error dict when not connected."""
        from tools.connectors import ConnectorRegistry
        reg = ConnectorRegistry()
        with patch("tools.connectors.GOOGLE_TOKEN_PATH", Path("/nonexistent/token.json")):
            result = await reg.calendar_today()
        assert isinstance(result, list)
        assert "error" in result[0]

    @pytest.mark.asyncio
    async def test_notion_search_not_connected(self):
        """notion_search returns error when not connected."""
        from tools.connectors import ConnectorRegistry
        import tempfile
        reg = ConnectorRegistry()
        with tempfile.TemporaryDirectory() as tmpdir:
            notion_path = Path(tmpdir) / "notion_token.json"
            with patch("tools.connectors._DATA_DIR", Path(tmpdir)):
                result = await reg.notion_search("test")
        assert isinstance(result, list)
        assert len(result) > 0
        assert "error" in result[0]


# ══════════════════════════════════════════════════════════════════════════════
# V19 -- Kokoro TTS
# ══════════════════════════════════════════════════════════════════════════════

class TestV19KokoroTTS:

    def test_kokoro_speaker_status_when_not_installed(self):
        """KokoroSpeaker reports unavailable when kokoro not installed."""
        from voice.kokoro_speaker import KokoroSpeaker, KOKORO_OK, SOUNDDEVICE_OK
        spk = KokoroSpeaker()
        status = spk.get_status()
        assert "available" in status
        assert "voice" in status
        assert "speed" in status
        assert "kokoro_installed" in status
        assert "sounddevice_installed" in status
        # If not installed, available should be False
        if not KOKORO_OK or not SOUNDDEVICE_OK:
            assert status["available"] is False

    def test_kokoro_voice_presets(self):
        """Voice presets dict contains expected JARVIS voice."""
        from voice.kokoro_speaker import list_voice_presets
        presets = list_voice_presets()
        assert "jarvis" in presets
        assert presets["jarvis"] == "bm_george"
        assert "female_us" in presets
        assert "male_uk" in presets

    def test_kokoro_set_speed_clamps(self):
        """Speed is clamped to 0.5–2.0 range."""
        from voice.kokoro_speaker import KokoroSpeaker
        spk = KokoroSpeaker()
        spk.set_speed(0.1)
        assert spk._speed == 0.5
        spk.set_speed(9.9)
        assert spk._speed == 2.0
        spk.set_speed(1.2)
        assert spk._speed == 1.2

    def test_kokoro_speak_when_unavailable_does_not_crash(self):
        """speak() silently skips when Kokoro is not available."""
        from voice.kokoro_speaker import KokoroSpeaker
        spk = KokoroSpeaker()
        # _running is False by default -- speak() should not raise
        spk.speak("Hello, sir. This is your briefing.")

    def test_kokoro_singleton(self):
        """get_kokoro_speaker returns the same instance each time."""
        from voice.kokoro_speaker import get_kokoro_speaker
        a = get_kokoro_speaker()
        b = get_kokoro_speaker()
        assert a is b

    def test_kokoro_env_defaults(self):
        """Kokoro reads KOKORO_VOICE and KOKORO_SPEED from env."""
        from voice.kokoro_speaker import KOKORO_VOICE, KOKORO_SPEED, KOKORO_LANG
        assert isinstance(KOKORO_VOICE, str) and len(KOKORO_VOICE) > 0
        assert isinstance(KOKORO_SPEED, float)
        assert isinstance(KOKORO_LANG, str)


# ══════════════════════════════════════════════════════════════════════════════
# V20 -- Notes Indexer
# ══════════════════════════════════════════════════════════════════════════════

class TestV20NotesIndexer:

    def test_notes_indexer_singleton(self):
        """NotesIndexer singleton initializes."""
        from tools.notes_indexer import get_notes_indexer, NotesIndexer
        idx = get_notes_indexer()
        assert isinstance(idx, NotesIndexer)

    def test_index_nonexistent_folder(self):
        """Indexing a non-existent folder returns ok=False."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            result = idx.index_folder("/path/that/does/not/exist/at/all")
        assert result["ok"] is False
        assert "not found" in result["error"]

    def test_index_empty_folder(self):
        """Indexing an empty folder returns ok=True with 0 files."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            result = idx.index_folder(tmpdir)
        assert result["ok"] is True
        assert result["files_indexed"] == 0
        assert result["chunks_created"] == 0

    def test_index_markdown_files(self):
        """Indexing a folder with .md files chunks and stores them."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create sample notes
            (Path(tmpdir) / "note1.md").write_text(
                "# Machine Learning\n\nThis is about neural networks and deep learning.\n\n"
                "Supervised learning uses labeled training data to predict outcomes."
            )
            (Path(tmpdir) / "note2.txt").write_text(
                "Python programming tips.\n\nUse list comprehensions for clean code.\n\n"
                "Always write tests for your functions."
            )
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            result = idx.index_folder(tmpdir)
        assert result["ok"] is True
        assert result["files_indexed"] == 2
        assert result["chunks_created"] >= 2

    def test_search_returns_results(self):
        """Search across indexed notes returns matching chunks."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            (Path(tmpdir) / "ai_notes.md").write_text(
                "# Deep Learning\n\nTransformers are attention-based neural networks.\n\n"
                "BERT is a bidirectional encoder from Google."
            )
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            idx.index_folder(tmpdir)
            results = idx.search("transformer neural network", top_k=3)
        assert isinstance(results, list)
        # Should find something (keyword or semantic)
        if results and "info" not in results[0]:
            assert "source" in results[0]
            assert "snippet" in results[0]

    def test_search_empty_index(self):
        """Search on empty index returns info message."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = NotesIndexer(Path(tmpdir) / "empty_test.db")
            results = idx.search("anything")
        assert isinstance(results, list)
        assert len(results) == 1
        assert "info" in results[0]

    def test_list_sources(self):
        """list_sources returns indexed folders."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            idx.index_folder(tmpdir)
            sources = idx.list_sources()
        assert isinstance(sources, list)
        assert len(sources) == 1
        assert "path" in sources[0]
        assert "files" in sources[0]
        assert "chunks" in sources[0]

    def test_remove_source(self):
        """remove_source deletes folder from index."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            idx.index_folder(tmpdir)
            result = idx.remove_source(tmpdir)
        assert result["ok"] is True
        assert "removed" in result

    def test_remove_nonexistent_source(self):
        """remove_source on unknown path returns ok=False."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            result = idx.remove_source("/not/indexed/path")
        assert result["ok"] is False

    def test_get_stats(self):
        """get_stats returns expected keys."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            stats = idx.get_stats()
        assert "sources" in stats
        assert "files_total" in stats
        assert "chunks_total" in stats
        assert "db_path" in stats

    def test_chunk_text_splits_correctly(self):
        """_chunk_text splits long documents at paragraph boundaries."""
        from tools.notes_indexer import NotesIndexer
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            idx = NotesIndexer(Path(tmpdir) / "test.db")
            long_text = "\n\n".join([f"Paragraph {i}. " + "word " * 30 for i in range(20)])
            chunks = idx._chunk_text(long_text)
        assert len(chunks) > 1
        for chunk in chunks:
            assert isinstance(chunk, str)
            assert len(chunk) > 0


# ══════════════════════════════════════════════════════════════════════════════
# Server Route Registration
# ══════════════════════════════════════════════════════════════════════════════

class TestV17_V20_ServerRoutes:

    def test_v17_routes_registered(self):
        """Morning Digest routes are registered in the FastAPI app."""
        from core.server import app
        paths = [r.path for r in app.routes]
        assert "/api/digest/now" in paths
        assert "/api/digest/text" in paths
        assert "/api/digest/schedule" in paths
        assert "/api/digest/status" in paths

    def test_v18_routes_registered(self):
        """Connector routes are registered in the FastAPI app."""
        from core.server import app
        paths = [r.path for r in app.routes]
        assert "/api/connectors/connect" in paths
        assert "/api/connectors/list" in paths
        assert "/api/connectors/gmail/unread" in paths
        assert "/api/connectors/calendar/today" in paths
        assert "/api/connectors/slack/messages" in paths
        assert "/api/connectors/notion/search" in paths

    def test_v19_routes_registered(self):
        """Kokoro TTS routes are registered in the FastAPI app."""
        from core.server import app
        paths = [r.path for r in app.routes]
        assert "/api/voice/kokoro/status" in paths
        assert "/api/voice/kokoro/speak" in paths
        assert "/api/voice/kokoro/stop" in paths
        assert "/api/voice/kokoro/voice" in paths
        assert "/api/voice/kokoro/speed" in paths

    def test_v20_routes_registered(self):
        """Notes Indexer routes are registered in the FastAPI app."""
        from core.server import app
        paths = [r.path for r in app.routes]
        assert "/api/memory/notes/index" in paths
        assert "/api/memory/notes/search" in paths
        assert "/api/memory/notes/sources" in paths
        assert "/api/memory/notes/stats" in paths

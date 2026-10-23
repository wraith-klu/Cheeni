"""
Unit and integration tests for V16 Unified Dashboard, Memory Browser, and Remote Control.
"""

import json
import pytest
from starlette.routing import WebSocketRoute

from core.server import app
from core.personal_memory import get_personal_memory


def test_personal_memory_shortcuts():
    """Verify storing, retrieving, listing, and deleting shortcuts."""
    mem = get_personal_memory()

    test_phrase = "test college portal"
    test_url = "https://test.kluniversity.in"

    # Add shortcut
    mem.add_shortcut(test_phrase, test_url)

    # Lookup
    found_url = mem.get_shortcut(test_phrase)
    assert found_url == test_url

    # List
    all_shortcuts = mem.list_shortcuts()
    assert any(s["phrase"] == test_phrase.lower() for s in all_shortcuts)

    # Delete
    mem.delete_shortcut(test_phrase)
    all_shortcuts_after = mem.list_shortcuts()
    assert not any(s["phrase"] == test_phrase.lower() for s in all_shortcuts_after)


def test_personal_memory_preferences():
    """Verify storing, listing, and forgetting preferences."""
    mem = get_personal_memory()

    cat = "dev_env"
    key = "editor"
    val = "VS Code Insiders"

    # Save
    mem.remember(cat, key, val)

    # List
    all_prefs = mem.list_preferences()
    match = [p for p in all_prefs if p["category"] == cat.lower() and p["key"] == key.lower()]
    assert len(match) == 1
    assert match[0]["value"] == val

    # Forget
    mem.forget(cat, key)
    all_prefs_after = mem.list_preferences()
    assert not any(p["category"] == cat.lower() and p["key"] == key.lower() for p in all_prefs_after)


def test_personal_memory_recall():
    """Verify recall retrieves stored facts."""
    mem = get_personal_memory()
    mem.remember("hobby", "sport", "Badminton")

    results = mem.recall("what sport do I play", top_k=3)
    assert len(results) > 0

    # Cleanup
    mem.forget("hobby", "sport")


def test_v16_routes_registered():
    """Verify all V16 dashboard and remote control endpoints are mounted."""
    route_paths = [r.path for r in app.routes]

    # REST endpoints
    assert "/api/agent/remote/command" in route_paths
    assert "/api/agent/quick-action" in route_paths
    assert "/api/agent/speak" in route_paths
    assert "/api/agent/memory/all" in route_paths
    assert "/api/agent/memory/stats" in route_paths
    assert "/api/agent/memory/preference" in route_paths
    assert "/api/agent/memory/shortcut" in route_paths
    assert "/api/agent/memory/search" in route_paths

    # WebSocket /ws
    ws_routes = [r for r in app.routes if isinstance(r, WebSocketRoute)]
    assert any(r.path == "/ws" for r in ws_routes)

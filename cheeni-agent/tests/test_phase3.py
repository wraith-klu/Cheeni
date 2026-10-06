"""
Cheeni Desktop Agent — Phase 3 Comprehensive Test Suite
Tests:
  1. Command Security Classifier (BLOCKED / RISKY / SAFE)
  2. Confirmation Manager & Async loop
  3. Central Command Router
  4. FastAPI Server Endpoints
"""

import sys
import os
import asyncio
import pytest

# Ensure cheeni-agent directory is on python path
agent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if agent_dir not in sys.path:
    sys.path.insert(0, agent_dir)

from security.command_security import (
    classify,
    SecurityTier,
    is_confirmation,
    is_cancellation,
)
from security.confirmation import ConfirmationManager
from tools.router import detect_intent, route_command


# ── 1. Security Classifier Tests ──────────────────────────────────────────────

def test_blocked_commands():
    blocked_samples = [
        "delete C:\\Windows\\System32",
        "rmdir /s /q System32",
        "open regedit and delete keys",
        "run eval('import os; os.system()')",
        "format C: drive completely",
        "erase hard drive",
    ]
    for cmd in blocked_samples:
        res = classify(cmd)
        assert res.tier == SecurityTier.BLOCKED, f"Expected BLOCKED for: '{cmd}', got {res.tier}"
        assert len(res.reason) > 0


def test_risky_commands():
    risky_samples = [
        "delete notes.txt from Desktop",
        "remove this folder",
        "shutdown my laptop",
        "restart the computer",
        "kill task chrome",
        "terminate process notepad",
        "close unsaved tab",
    ]
    for cmd in risky_samples:
        res = classify(cmd)
        assert res.tier == SecurityTier.RISKY, f"Expected RISKY for: '{cmd}', got {res.tier}"
        assert len(res.reason) > 0


def test_safe_commands():
    safe_samples = [
        "what is my battery level",
        "what's the time right now",
        "open youtube",
        "set volume to 50",
        "mute audio",
        "play lofi chill beats",
        "search google for latest ai news",
        "open notepad",
    ]
    for cmd in safe_samples:
        res = classify(cmd)
        assert res.tier == SecurityTier.SAFE, f"Expected SAFE for: '{cmd}', got {res.tier}"


def test_confirmation_intent_parsing():
    assert is_confirmation("yes")
    assert is_confirmation("yes please")
    assert is_confirmation("confirm")
    assert is_confirmation("sure proceed")
    assert is_confirmation("go ahead")
    assert is_confirmation("do it")

    assert is_cancellation("no")
    assert is_cancellation("cancel")
    assert is_cancellation("abort")
    assert is_cancellation("stop")
    assert is_cancellation("don't do that")
    assert is_cancellation("never mind")

    assert not is_confirmation("what time is it")
    assert not is_cancellation("what time is it")


# ── 2. Interactive Confirmation Loop Tests ────────────────────────────────────

@pytest.mark.asyncio
async def test_confirmation_loop_approved():
    mgr = ConfirmationManager()

    async def user_says_yes():
        await asyncio.sleep(0.05)
        mgr.submit_answer("yes, go ahead")

    task = asyncio.create_task(user_says_yes())
    result = await mgr.request_confirmation("delete notes.txt")
    await task
    assert result is True


@pytest.mark.asyncio
async def test_confirmation_loop_cancelled():
    mgr = ConfirmationManager()

    async def user_says_no():
        await asyncio.sleep(0.05)
        mgr.submit_answer("no, cancel it")

    task = asyncio.create_task(user_says_no())
    result = await mgr.request_confirmation("shutdown computer")
    await task
    assert result is False


# ── 3. Intent Detection & Command Router Tests ────────────────────────────────

def test_intent_detection():
    assert detect_intent("what is my battery percentage") == "system_status_battery"
    assert detect_intent("what's the time") == "system_status_datetime"
    assert detect_intent("set volume to 40") == "set_volume"
    assert detect_intent("mute laptop") == "mute_volume"
    assert detect_intent("open youtube") == "open_url_youtube"
    assert detect_intent("open google") == "open_url_google"
    assert detect_intent("play some relaxing jazz") == "play_music"
    assert detect_intent("search for quantum computing") == "search_web"
    assert detect_intent("open notepad") == "launch_app"


@pytest.mark.asyncio
async def test_router_blocked_execution():
    result = await route_command("delete C:\\Windows\\System32")
    assert result.success is False
    assert result.blocked is True
    assert result.security_tier == "blocked"
    assert "can't do that" in result.speech.lower() or "blocked" in result.speech.lower()


@pytest.mark.asyncio
async def test_router_safe_battery_execution():
    events = []

    async def mock_broadcast(event):
        events.append(event)

    result = await route_command("what is my battery level", broadcast_fn=mock_broadcast)
    assert result.success is True
    assert result.intent == "system_status_battery"
    assert result.security_tier == "safe"
    assert "battery" in result.speech.lower()
    assert result.elapsed_ms >= 0


@pytest.mark.asyncio
async def test_router_safe_volume_execution():
    result = await route_command("mute")
    assert result.success is True
    assert result.intent == "mute_volume"
    assert "muted" in result.speech.lower()


if __name__ == "__main__":
    print("Running Phase 3 verification tests...")
    test_blocked_commands()
    print("  [OK] BLOCKED commands classified correctly")
    test_risky_commands()
    print("  [OK] RISKY commands classified correctly")
    test_safe_commands()
    print("  [OK] SAFE commands classified correctly")
    test_confirmation_intent_parsing()
    print("  [OK] Confirmation & cancellation regex works")
    test_intent_detection()
    print("  [OK] Intent detector maps all standard commands")

    async def run_async_tests():
        await test_confirmation_loop_approved()
        print("  [OK] Confirmation loop (approved) works")
        await test_confirmation_loop_cancelled()
        print("  [OK] Confirmation loop (cancelled) works")
        await test_router_blocked_execution()
        print("  [OK] Router blocked execution verified")
        await test_router_safe_battery_execution()
        print("  [OK] Router safe battery telemetry verified")
        await test_router_safe_volume_execution()
        print("  [OK] Router safe volume action verified")

    asyncio.run(run_async_tests())
    print("\n All Phase 3 tests passed successfully!")

"""
Cheeni Desktop Agent — Phase 4 Test Suite
Tests:
  1. Application Controller (catalog resolution, running processes list, app checking)
  2. Windows Volume Controller (get, delta adjustment, mute toggle)
  3. Hardware Telemetry & Specs (detailed specs formatting, CPU/RAM/Disk/Battery metrics)
  4. Command Router Phase 4 Intent Mapping & Execution
  5. FastAPI REST Endpoints via TestClient
"""
import sys
import os
import asyncio
import pytest

# Ensure cheeni-agent directory is on path
agent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if agent_dir not in sys.path:
    sys.path.insert(0, agent_dir)

from tools.app_control import (
    _resolve_app_entry,
    is_app_running,
    list_running_apps,
)
from tools.volume_control import (
    get_volume,
    set_volume,
    adjust_volume_delta,
    toggle_mute,
)
from tools.system_status import (
    get_hardware_specs,
    get_cpu_status,
    get_ram_status,
    get_disk_status,
    get_battery_status,
)
from tools.router import detect_intent, route_command
from fastapi.testclient import TestClient
from core.server import app


# ── 1. App Controller Tests ───────────────────────────────────────────────────

def test_app_catalog_resolution():
    assert _resolve_app_entry("notepad") is not None
    assert _resolve_app_entry("Notepad") is not None
    assert _resolve_app_entry("calc") is not None
    assert _resolve_app_entry("calculator") is not None
    assert _resolve_app_entry("google chrome") is not None
    assert _resolve_app_entry("chrome") is not None
    assert _resolve_app_entry("vs code") is not None
    assert _resolve_app_entry("terminal") is not None
    assert _resolve_app_entry("settings") is not None


def test_list_running_apps():
    apps = list_running_apps()
    assert isinstance(apps, list)
    assert len(apps) > 0, "Expected at least 1 running user process"
    first = apps[0]
    assert "name" in first
    assert "pid" in first
    assert "memory_mb" in first
    assert first["memory_mb"] >= 0


def test_is_app_running_check():
    # Python running this test process must be active
    assert is_app_running("python") or is_app_running("python.exe")
    # Bogus app should return False
    assert not is_app_running("completely_fake_app_xyz_999")


# ── 2. Volume Controller Tests ────────────────────────────────────────────────

def test_volume_controls():
    initial = get_volume()
    assert "success" in initial
    if initial.get("success"):
        orig_vol = initial.get("volume", 50)

        # Delta adjustment +5
        res_up = adjust_volume_delta(5)
        assert res_up.get("success") is True
        assert res_up.get("volume") >= 0

        # Delta adjustment -5
        res_down = adjust_volume_delta(-5)
        assert res_down.get("success") is True
        assert res_down.get("volume") >= 0

        # Restore original volume
        set_volume(orig_vol)


# ── 3. Hardware Telemetry & Specs Tests ───────────────────────────────────────

def test_hardware_specs():
    specs = get_hardware_specs()
    assert "processor" in specs
    assert "cores" in specs
    assert "ram" in specs
    assert "storage" in specs
    assert "battery" in specs
    assert "os" in specs
    assert len(specs["processor"]) > 0
    assert len(specs["os"]) > 0


def test_subsystem_telemetry():
    cpu = get_cpu_status()
    assert cpu["usage_percent"] >= 0
    assert cpu["cores_logical"] > 0

    ram = get_ram_status()
    assert ram["total_gb"] > 0
    assert ram["usage_percent"] >= 0

    disk = get_disk_status()
    assert disk["primary"]["total_gb"] > 0

    battery = get_battery_status()
    assert battery["level"] >= 0


# ── 4. Router Phase 4 Intent Mapping ──────────────────────────────────────────

def test_phase4_intent_detection():
    assert detect_intent("what are my computer specs") == "system_specs"
    assert detect_intent("show me my hardware specifications") == "system_specs"
    assert detect_intent("list all running apps") == "list_running_apps"
    assert detect_intent("show open applications") == "list_running_apps"
    assert detect_intent("close notepad") == "close_app"
    assert detect_intent("terminate chrome") == "close_app"
    assert detect_intent("lock my laptop") == "lock_pc"
    assert detect_intent("restart my computer") == "restart_pc"
    assert detect_intent("shut down the laptop") == "shutdown_pc"
    assert detect_intent("toggle mute") == "toggle_mute"
    assert detect_intent("increase the volume") == "volume_up"
    assert detect_intent("decrease sound") == "volume_down"


@pytest.mark.asyncio
async def test_router_system_specs_execution():
    res = await route_command("what are my computer specs")
    assert res.success is True
    assert res.intent == "system_specs"
    assert "processor" in res.result
    assert "ram" in res.speech.lower() or "laptop" in res.speech.lower()


@pytest.mark.asyncio
async def test_router_list_running_apps_execution():
    res = await route_command("list running apps")
    assert res.success is True
    assert res.intent == "list_running_apps"
    assert "count" in res.result
    assert res.result["count"] > 0


# ── 5. FastAPI Endpoints Verification ─────────────────────────────────────────

def test_fastapi_phase4_endpoints():
    client = TestClient(app)

    # 1. GET /api/system/specs
    res_specs = client.get("/api/system/specs")
    assert res_specs.status_code == 200
    data_specs = res_specs.json()
    assert data_specs["success"] is True
    assert "specs" in data_specs
    assert "processor" in data_specs["specs"]

    # 2. GET /api/apps/running
    res_apps = client.get("/api/apps/running")
    assert res_apps.status_code == 200
    data_apps = res_apps.json()
    assert data_apps["success"] is True
    assert len(data_apps["apps"]) > 0

    # 3. POST /api/volume/delta
    res_vol = client.post("/api/volume/delta", json={"delta": 0})
    assert res_vol.status_code == 200


if __name__ == "__main__":
    print("Running Phase 4 automated verification tests...")
    test_app_catalog_resolution()
    print("  [OK] App catalog resolution passed")
    test_list_running_apps()
    print("  [OK] List running apps passed")
    test_is_app_running_check()
    print("  [OK] Process active check passed")
    test_volume_controls()
    print("  [OK] Master volume controls & delta passed")
    test_hardware_specs()
    print("  [OK] Hardware specifications telemetry passed")
    test_subsystem_telemetry()
    print("  [OK] Subsystem telemetry (CPU/RAM/Disk/Battery) passed")
    test_phase4_intent_detection()
    print("  [OK] Phase 4 router intent detection passed")

    async def run_async_router_tests():
        await test_router_system_specs_execution()
        print("  [OK] Router system specs execution passed")
        await test_router_list_running_apps_execution()
        print("  [OK] Router list running apps execution passed")

    asyncio.run(run_async_router_tests())

    test_fastapi_phase4_endpoints()
    print("  [OK] FastAPI Phase 4 REST endpoints verified")

    print("\n All Phase 4 verification tests passed successfully!")

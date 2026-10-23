"""
Cheeni Lightweight Edge Daemon (Phase 2)

Runs locally on the user's Windows machine.
Establishes an outbound persistent WebSocket reverse tunnel to the Render Cloud Backend.
Receives JSON-RPC tool dispatch events, executes them locally via Win32 / pycaw / psutil / mss,
and returns observations back to the cloud.

Zero-cost, lightweight, and requires no public IP or port forwarding on the user's laptop.
"""

import sys
import os
import json
import asyncio
import websockets
import subprocess

# Add project root to sys.path to reuse cheeni-agent tools
agent_dir = os.path.dirname(os.path.abspath(__file__))
cheeni_agent_tools = os.path.join(agent_dir, "cheeni-agent")
if cheeni_agent_tools not in sys.path:
    sys.path.append(cheeni_agent_tools)

try:
    from tools.volume_control import set_volume, adjust_volume_delta, mute_volume, unmute_volume, get_volume
    from tools.app_control import launch_app, close_app
    from tools.window_control import minimize_window, maximize_window, restore_window, snap_window, show_desktop
    from tools.system_status import get_full_system_status, get_battery_status, get_datetime_status
except ImportError as e:
    print(f"[EdgeDaemon Warning] Could not import some local tools: {e}")

DEFAULT_CLOUD_WS_URL = os.environ.get("CHEENI_CLOUD_WS_URL", "ws://localhost:2025/ws/edge-bridge")
DEVICE_ID = os.environ.get("CHEENI_DEVICE_ID", "default-laptop")

async def execute_local_tool(tool_name: str, args: dict) -> dict:
    """Executes local OS tool commands directly on Windows."""
    print(f"[EdgeDaemon Action] Invoking: {tool_name} with args: {args}")
    try:
        if tool_name == "launch_app":
            app_name = args.get("app_name", "")
            return launch_app(app_name)
        elif tool_name == "close_app":
            app_name = args.get("app_name", "")
            return close_app(app_name)
        elif tool_name == "control_volume":
            action = args.get("action", "get")
            level = args.get("level", 50)
            if action == "set":
                return set_volume(int(level))
            elif action == "increase":
                return adjust_volume_delta(int(level or 10))
            elif action == "decrease":
                return adjust_volume_delta(-int(level or 10))
            elif action == "mute":
                return mute_volume()
            elif action == "unmute":
                return unmute_volume()
            else:
                return get_volume()
        elif tool_name == "manage_window":
            action = args.get("action", "")
            if action == "minimize":
                return minimize_window()
            elif action == "maximize":
                return maximize_window()
            elif action == "show_desktop":
                return show_desktop()
            elif action.startswith("snap"):
                side = "left" if "left" in action else "right"
                return snap_window(side)
            return {"status": "unsupported window action"}
        elif tool_name == "get_system_telemetry":
            metric = args.get("metric", "battery")
            if metric == "battery":
                return get_battery_status()
            elif metric == "datetime":
                return get_datetime_status()
            return get_full_system_status()
        elif tool_name == "open_url":
            url = args.get("url", "")
            if url:
                os.system(f'start "" "{url}"')
                return {"status": "opened", "url": url}
        return {"status": "tool_executed", "tool": tool_name}
    except Exception as exc:
        return {"error": str(exc)}

async def run_edge_daemon():
    print("=" * 60)
    print("  🍯 Cheeni Lightweight Edge Client Daemon")
    print(f"  Tunneling to Cloud: {DEFAULT_CLOUD_WS_URL}")
    print(f"  Device Identifier: {DEVICE_ID}")
    print("=" * 60)

    while True:
        try:
            print(f"[EdgeDaemon] Connecting to Cloud Control Plane at {DEFAULT_CLOUD_WS_URL}...")
            async with websockets.connect(DEFAULT_CLOUD_WS_URL) as ws:
                # 1. Register device
                reg_payload = {"type": "REGISTER_EDGE_DEVICE", "deviceId": DEVICE_ID}
                await ws.send(json.dumps(reg_payload))
                print("[EdgeDaemon] Connected and Registered with Cloud!")

                async for message in ws:
                    data = json.loads(message)
                    if data.get("type") == "RPC_CALL":
                        request_id = data.get("requestId")
                        tool = data.get("tool")
                        args = data.get("args", {})
                        
                        # Execute local tool
                        res = await execute_local_tool(tool, args)
                        
                        # Return observation back to cloud
                        reply = {
                            "type": "RPC_RESPONSE",
                            "requestId": request_id,
                            "result": res,
                            "error": res.get("error") if isinstance(res, dict) else None
                        }
                        await ws.send(json.dumps(reply))
        except Exception as e:
            print(f"[EdgeDaemon Connection Error] {e}. Reconnecting in 5 seconds...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    try:
        asyncio.run(run_edge_daemon())
    except KeyboardInterrupt:
        print("\n[EdgeDaemon] Terminated by user.")

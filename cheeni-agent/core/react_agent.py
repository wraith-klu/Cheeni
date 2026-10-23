"""
Cheeni Native Realtime & ReAct Tool-Calling Agent Loop (Pillars 1 & 2)

Unifies:
1. Native Tool Calling / ReAct loop (Groq Llama-3.3-70B or Gemini 2.0 Flash)
2. Desktop Vision & GUI Grounding (via tools.desktop_vision)
3. Direct execution of Win32 system tools (Volume, Window, App, Telemetry)
"""

import os
import json
import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

from utils.logging import logger
from tools.desktop_vision import analyze_screen_with_gemini
from tools.volume_control import set_volume, adjust_volume_delta, mute_volume, unmute_volume, get_volume
from tools.app_control import launch_app, close_app
from tools.window_control import minimize_window, maximize_window, restore_window, snap_window, show_desktop
from tools.system_status import get_full_system_status, get_battery_status, get_datetime_status
from tools.web_intelligence import search_web

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None

# ── Function Schemas for Gemini 2.0 Flash Tool Calling ───────────────────────
GEMINI_TOOL_DECLARATIONS = [
    {
        "name": "control_volume",
        "description": "Adjust or query the master system audio volume on Windows.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action": {
                    "type": "STRING",
                    "description": "One of: 'set', 'mute', 'unmute', 'increase', 'decrease', 'get'",
                },
                "level": {
                    "type": "INTEGER",
                    "description": "Volume percentage from 0 to 100",
                },
            },
            "required": ["action"],
        },
    },
    {
        "name": "launch_app",
        "description": "Launch an application installed on Windows (notepad, calculator, chrome, vscode, paint, etc.)",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "app_name": {"type": "STRING", "description": "Application name to open"},
            },
            "required": ["app_name"],
        },
    },
    {
        "name": "close_app",
        "description": "Close or terminate a running desktop application.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "app_name": {"type": "STRING", "description": "Application name to terminate"},
            },
            "required": ["app_name"],
        },
    },
    {
        "name": "manage_window",
        "description": "Control desktop windows (minimize, maximize, restore, snap_left, snap_right, show_desktop).",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "action": {"type": "STRING", "description": "Action: minimize, maximize, restore, snap_left, snap_right, show_desktop"},
            },
            "required": ["action"],
        },
    },
    {
        "name": "get_system_telemetry",
        "description": "Fetch battery level, CPU/RAM usage, hardware specifications, or system clock.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "metric": {"type": "STRING", "description": "battery, datetime, or all"},
            },
            "required": ["metric"],
        },
    },
    {
        "name": "inspect_screen_vision",
        "description": "Capture the user's desktop screen and inspect the active window, error messages, code, or user interface.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "question": {"type": "STRING", "description": "What to look for or analyze on the screen."},
            },
            "required": ["question"],
        },
    },
]

async def dispatch_local_tool(name: str, args: dict) -> Any:
    """Executes local OS tool commands."""
    try:
        if name == "control_volume":
            act = args.get("action", "get")
            lvl = args.get("level", 50)
            if act == "set":
                return set_volume(int(lvl))
            elif act == "increase":
                return adjust_volume_delta(int(lvl or 10))
            elif act == "decrease":
                return adjust_volume_delta(-int(lvl or 10))
            elif act == "mute":
                return mute_volume()
            elif act == "unmute":
                return unmute_volume()
            return get_volume()
            
        elif name == "launch_app":
            return launch_app(args.get("app_name", ""))
            
        elif name == "close_app":
            return close_app(args.get("app_name", ""))
            
        elif name == "manage_window":
            act = args.get("action", "")
            if act == "minimize":
                return minimize_window()
            elif act == "maximize":
                return maximize_window()
            elif act == "show_desktop":
                return show_desktop()
            elif "snap" in act:
                side = "left" if "left" in act else "right"
                return snap_window(side)
            return {"status": "unsupported window action"}
            
        elif name == "get_system_telemetry":
            metric = args.get("metric", "battery")
            if metric == "battery":
                return get_battery_status()
            elif metric == "datetime":
                return get_datetime_status()
            return get_full_system_status()
            
        elif name == "inspect_screen_vision":
            return await analyze_screen_with_gemini(args.get("question", "What is on the screen?"))
            
        return {"status": "unknown_tool", "tool": name}
    except Exception as e:
        return {"error": str(e)}

class CheeniReActAgent:
    """
    Standardized ReAct Agent Loop:
    1. Model receives prompt and declares tool call(s)
    2. Tool executes locally
    3. Tool observation is fed back to model
    4. Model delivers final spoken and textual response
    """
    def __init__(self, gemini_api_key: Optional[str] = None):
        self.api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY")

    async def execute_turn(self, user_prompt: str, history: List[dict] = None) -> Dict[str, Any]:
        if not self.api_key or not genai:
            return {
                "speech": "Gemini API key is not configured for ReAct tool execution.",
                "text": "Please configure GEMINI_API_KEY in cheeni-agent/.env.",
                "tools_executed": []
            }

        client = genai.Client(api_key=self.api_key)

        # 1. Ask Gemini 3.8 Flash with tools schema
        response = client.models.generate_content(
            model="gemini-3.8-flash",
            contents=user_prompt,
            config=types.GenerateContentConfig(
                tools=[{"function_declarations": GEMINI_TOOL_DECLARATIONS}],
                temperature=0.2,
                system_instruction=(
                    "You are Cheeni, an autonomous desktop AI copilot. "
                    "When the user requests an action (volume, apps, windows, battery, looking at screen), "
                    "CALL THE RELEVANT TOOL. Speak back in 1-2 friendly, natural sentences without markdown."
                ),
            ),
        )

        executed_tools = []
        
        # Check if function calls were generated
        function_calls = response.function_calls if hasattr(response, "function_calls") else None
        if not function_calls:
            # Direct conversational reply
            reply_text = response.text or "I am right here with you."
            return {
                "speech": reply_text,
                "text": reply_text,
                "tools_executed": []
            }

        # 2. ReAct Observation Loop
        for call in function_calls:
            tool_name = call.name
            tool_args = dict(call.args) if call.args else {}
            obs = await dispatch_local_tool(tool_name, tool_args)
            executed_tools.append({"tool": tool_name, "args": tool_args, "observation": obs})

        # 3. Follow-up pass to generate voice response incorporating the tool observation
        obs_summary = json.dumps(executed_tools)
        speech_text = "Action completed successfully."
        try:
            followup_prompt = (
                f"User asked: \"{user_prompt}\"\n"
                f"Tools executed: {obs_summary}\n"
                f"Provide a natural, warm, 1-sentence spoken voice response confirming the action."
            )
            final_resp = client.models.generate_content(
                model="gemini-3.8-flash",
                contents=followup_prompt,
                config=types.GenerateContentConfig(temperature=0.3)
            )
            if final_resp.text:
                speech_text = final_resp.text.strip()
        except Exception as e:
            # Fallback deterministic voice response
            if executed_tools:
                first = executed_tools[0]
                t_name = first.get("tool")
                obs = first.get("observation", {})
                if t_name == "get_system_telemetry" and isinstance(obs, dict):
                    pct = obs.get("battery_percent") or obs.get("percent")
                    if pct is not None:
                        speech_text = f"Your battery is currently at {pct}%."
                elif t_name == "control_volume":
                    speech_text = "System volume has been updated."
                elif t_name == "launch_app":
                    speech_text = f"Opened {first.get('args', {}).get('app_name', 'application')}."
                else:
                    speech_text = f"Executed {t_name}."

        return {
            "speech": speech_text,
            "text": speech_text,
            "tools_executed": executed_tools
        }


if __name__ == "__main__":
    agent = CheeniReActAgent()
    print("[ReAct Test Agent Initialized]")

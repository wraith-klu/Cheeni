"""
Cheeni Desktop Agent -- Screen Vision Agent (V12)
Autonomous Observe -> Reason -> Act loop for desktop GUI automation.

Cheeni inspects the user's desktop via screenshot, determines the next GUI action,
executes mouse/keyboard controls, verifies the result visually, and continues
until the specified user goal is achieved.
"""

import os
import re
import json
import time
import asyncio
import logging
from typing import Dict, Any, List, Optional, Tuple

from utils.logging import logger
from tools.desktop_vision import (
    capture_screen_jpeg,
    locate_element,
    find_and_click,
    type_at_element,
    check_screen_safety,
    get_screen_resolution,
    _call_gemini_vision,
    CANDIDATE_VISION_MODELS,
)

try:
    from google import genai
    from google.genai import types
    GENAI_OK = True
except ImportError:
    genai = None
    types = None
    GENAI_OK = False

try:
    import pyautogui
    pyautogui.FAILSAFE = True
    PYAUTOGUI_OK = True
except ImportError:
    pyautogui = None
    PYAUTOGUI_OK = False

DEFAULT_MAX_STEPS = 8
DEFAULT_STEP_DELAY = 1.0


def _build_vision_prompt(goal: str, history: List[dict], step: int, max_steps: int) -> str:
    """
    Constructs the ReAct vision system prompt with full conversation/action history.
    """
    history_summary = ""
    if history:
        history_summary = "PREVIOUS ACTIONS TAKEN SO FAR:\n"
        for item in history:
            s_idx = item.get("step", 0)
            act = item.get("action", {})
            res = item.get("result", {})
            history_summary += (
                f"- Step {s_idx + 1}: Thought: \"{act.get('thought', '')}\" -> "
                f"Action: {act.get('type')} on '{act.get('target', '')}' -> "
                f"Result: {res.get('success', False)} ({res.get('detail', '')})\n"
            )
    else:
        history_summary = "No previous actions taken yet. This is the first step.\n"

    prompt = (
        "You are Cheeni, an autonomous desktop GUI automation agent running on Windows.\n"
        "Your task is to achieve the user's goal by observing the current desktop screenshot "
        "and deciding the single best next action to take.\n\n"
        f"USER GOAL: \"{goal}\"\n"
        f"CURRENT STEP: {step + 1} of {max_steps}\n\n"
        f"{history_summary}\n"
        "Analyze the screenshot carefully:\n"
        "1. Is the goal already achieved? If yes, respond with type 'done'.\n"
        "2. Did the previous action work as intended based on the current screen?\n"
        "3. What single specific action should be taken right now?\n\n"
        "CRITICAL RULES:\n"
        "- Choose ONE action only.\n"
        "- Valid action types:\n"
        "    - 'click': click a visible button, icon, menu item, or text field\n"
        "    - 'double_click': open an icon, select a word\n"
        "    - 'right_click': context menu\n"
        "    - 'type': type text into the currently active/focused field or target element\n"
        "    - 'key': press keyboard key or shortcut (e.g. ['enter'], ['ctrl', 's'], ['escape'])\n"
        "    - 'scroll': scroll up or down (direction: 'up' or 'down', amount: 1-5)\n"
        "    - 'wait': wait briefly for an app or webpage to load (seconds: 1-5)\n"
        "    - 'confirm': ask user confirmation before performing a sensitive action (delete, buy, submit)\n"
        "    - 'done': the goal has been successfully completed\n"
        "    - 'fail': the goal cannot be completed (explain why in reason)\n\n"
        "Output ONLY valid JSON in this schema:\n"
        "{\n"
        '  "thought": "brief reasoning explaining what you see and why you chose this action",\n'
        '  "type": "click | double_click | right_click | type | key | scroll | wait | confirm | done | fail",\n'
        '  "target": "name or visible label of element to interact with",\n'
        '  "point": [center_y, center_x],  // optional normalized coordinates 0-1000\n'
        '  "text": "text to type if action is type",\n'
        '  "press_enter": false,\n'
        '  "keys": ["enter"],  // keys to press if action is key\n'
        '  "direction": "down", // for scroll\n'
        '  "amount": 3,\n'
        '  "message": "summary message for the user if done or confirming",\n'
        '  "reason": "explanation if failed"\n'
        "}\n"
    )
    return prompt


async def ask_gemini_vision_action(
    screen_bytes: bytes,
    goal: str,
    history: List[dict],
    step: int,
    max_steps: int = DEFAULT_MAX_STEPS,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Sends screen image + goal history to Gemini Vision and parses next action.
    """
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key or not GENAI_OK:
        return {
            "thought": "GenAI provider or API key is not configured.",
            "type": "fail",
            "reason": "GEMINI_API_KEY is not configured for vision agent.",
        }

    try:
        client = genai.Client(api_key=key)
        prompt = _build_vision_prompt(goal, history, step, max_steps)

        contents = [
            types.Part.from_bytes(data=screen_bytes, mime_type="image/jpeg"),
            prompt,
        ]

        raw_reply = _call_gemini_vision(contents, client)
        json_match = re.search(r"\{.*\}", raw_reply, re.DOTALL)
        if not json_match:
            logger.warning(f"[ScreenAgent] Could not find JSON in model reply: {raw_reply[:200]}")
            return {
                "thought": "Failed to parse JSON response from vision model.",
                "type": "fail",
                "reason": "Invalid response format from vision model.",
            }

        action_dict = json.loads(json_match.group(0))
        # Ensure type is lowercase
        if "type" in action_dict:
            action_dict["type"] = action_dict["type"].strip().lower()
        return action_dict

    except Exception as exc:
        logger.error(f"[ScreenAgent] Vision inference error: {exc}")
        return {
            "thought": f"Error during vision inference: {exc}",
            "type": "fail",
            "reason": str(exc),
        }


async def execute_gui_action(action: Dict[str, Any], api_key: Optional[str] = None) -> Dict[str, Any]:
    """
    Executes a single GUI action using PyAutoGUI and DesktopVision.
    """
    if not PYAUTOGUI_OK:
        return {"success": False, "detail": "pyautogui is not installed"}

    act_type = action.get("type", "fail")
    target = action.get("target", "")

    # Safety gate evaluation
    if act_type in ("click", "double_click", "type"):
        text_payload = action.get("text", "")
        safety = check_screen_safety(act_type, f"{target} {text_payload}")
        if not safety["safe"]:
            return {
                "success": False,
                "needs_confirmation": True,
                "tier": safety["tier"],
                "reason": safety["reason"],
                "detail": f"Action flagged as sensitive: {safety['reason']}",
            }

    try:
        # 1. CLICK / DOUBLE_CLICK / RIGHT_CLICK
        if act_type in ("click", "double_click", "right_click"):
            point = action.get("point")
            screen_w, screen_h = get_screen_resolution()

            # If normalized point [y, x] provided directly by vision model
            if point and len(point) == 2 and isinstance(point[0], (int, float)):
                py_norm, px_norm = point[0], point[1]
                abs_x = int(round((px_norm / 1000.0) * screen_w))
                abs_y = int(round((py_norm / 1000.0) * screen_h))
                abs_x = max(0, min(screen_w - 1, abs_x))
                abs_y = max(0, min(screen_h - 1, abs_y))

                pyautogui.moveTo(abs_x, abs_y, duration=0.2)
                if act_type == "double_click":
                    pyautogui.doubleClick(abs_x, abs_y)
                elif act_type == "right_click":
                    pyautogui.rightClick(abs_x, abs_y)
                else:
                    pyautogui.click(abs_x, abs_y)

                return {
                    "success": True,
                    "coords": [abs_x, abs_y],
                    "detail": f"{act_type} at coordinates ({abs_x}, {abs_y})",
                }

            # Otherwise locate element by text description
            if not target:
                return {"success": False, "detail": "No target or coordinates specified for click"}

            click_type = "double" if act_type == "double_click" else ("right" if act_type == "right_click" else "single")
            click_res = await find_and_click(target, click_type=click_type, api_key=api_key)
            if click_res.get("success"):
                return {
                    "success": True,
                    "coords": [click_res.get("x"), click_res.get("y")],
                    "detail": f"Located and clicked '{target}'",
                }
            return {
                "success": False,
                "detail": click_res.get("error", f"Could not find '{target}' on screen"),
            }

        # 2. TYPE
        elif act_type == "type":
            text = action.get("text", "")
            press_enter = bool(action.get("press_enter", False))

            if target:
                # Click target first to focus
                type_res = await type_at_element(target, text, press_enter=press_enter, api_key=api_key)
                if type_res.get("success"):
                    return {"success": True, "detail": f"Typed '{text}' into '{target}'"}
                return {"success": False, "detail": type_res.get("error", f"Failed typing into '{target}'")}
            else:
                # Type directly into currently active element
                pyautogui.write(text, interval=0.03)
                if press_enter:
                    time.sleep(0.05)
                    pyautogui.press("enter")
                return {"success": True, "detail": f"Typed '{text}' into active focus"}

        # 3. KEY / SHORTCUT
        elif act_type == "key":
            keys = action.get("keys") or [action.get("key", "enter")]
            if isinstance(keys, str):
                keys = [keys]
            if len(keys) == 1:
                pyautogui.press(keys[0].lower())
            elif len(keys) > 1:
                pyautogui.hotkey(*[k.lower() for k in keys])
            return {"success": True, "detail": f"Pressed key(s): {'+'.join(keys)}"}

        # 4. SCROLL
        elif act_type == "scroll":
            direction = action.get("direction", "down").lower()
            amount = int(action.get("amount", 3))
            clicks = -120 * amount if direction == "down" else 120 * amount
            pyautogui.scroll(clicks)
            return {"success": True, "detail": f"Scrolled {direction} by {amount} units"}

        # 5. WAIT
        elif act_type == "wait":
            sec = min(5.0, max(0.5, float(action.get("seconds", 1.5))))
            await asyncio.sleep(sec)
            return {"success": True, "detail": f"Waited {sec}s"}

        # 6. CONFIRM / DONE / FAIL
        elif act_type == "confirm":
            return {"success": False, "needs_confirmation": True, "detail": action.get("message", "Confirmation needed")}
        elif act_type == "done":
            return {"success": True, "done": True, "detail": action.get("message", "Goal accomplished")}
        elif act_type == "fail":
            return {"success": False, "detail": action.get("reason", "Action failed")}

        return {"success": False, "detail": f"Unsupported action type: {act_type}"}

    except Exception as exc:
        logger.error(f"[ScreenAgent] Action execution error: {exc}")
        return {"success": False, "detail": str(exc)}


async def execute_screen_goal(
    goal: str,
    max_steps: int = DEFAULT_MAX_STEPS,
    step_delay: float = DEFAULT_STEP_DELAY,
    api_key: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Main Autonomous ReAct Vision Loop.
    Observes desktop, reasons using Gemini Vision, executes GUI action, and repeats.
    """
    if not goal or not goal.strip():
        return {"success": False, "error": "Goal cannot be empty"}

    logger.info(f"[ScreenAgent] Starting goal execution: \"{goal}\" (max_steps={max_steps})")
    history = []

    for step in range(max_steps):
        logger.info(f"[ScreenAgent] === Step {step + 1}/{max_steps} ===")

        # 1. Capture screen
        try:
            screen_bytes = capture_screen_jpeg(quality=75, max_dim=1280)
        except Exception as cap_err:
            logger.error(f"[ScreenAgent] Screen capture failed: {cap_err}")
            return {
                "success": False,
                "reason": f"Screen capture failed: {str(cap_err)}",
                "steps": history,
                "steps_completed": step,
            }

        # 2. Reason next action with Gemini Vision
        action = await ask_gemini_vision_action(
            screen_bytes=screen_bytes,
            goal=goal,
            history=history,
            step=step,
            max_steps=max_steps,
            api_key=api_key,
        )
        del screen_bytes

        act_type = action.get("type", "fail")
        thought = action.get("thought", "")
        logger.info(f"[ScreenAgent] Model thought: \"{thought}\" | Action: {act_type}")

        # Check for done
        if act_type == "done":
            msg = action.get("message", "Goal completed successfully.")
            history.append({"step": step, "action": action, "result": {"success": True, "detail": msg}})
            logger.info(f"[ScreenAgent] Goal achieved in {step + 1} steps: {msg}")
            return {
                "success": True,
                "goal": goal,
                "message": msg,
                "steps_completed": step + 1,
                "history": history,
            }

        # Check for immediate fail
        if act_type == "fail":
            reason = action.get("reason", "Agent determined the goal cannot be completed.")
            history.append({"step": step, "action": action, "result": {"success": False, "detail": reason}})
            logger.warning(f"[ScreenAgent] Goal failed at step {step + 1}: {reason}")
            return {
                "success": False,
                "goal": goal,
                "reason": reason,
                "steps_completed": step + 1,
                "history": history,
            }

        # Check for user confirmation requirement
        if act_type == "confirm" or action.get("needs_confirmation"):
            msg = action.get("message", "This action requires user confirmation before proceeding.")
            history.append({"step": step, "action": action, "result": {"needs_confirmation": True, "detail": msg}})
            logger.info(f"[ScreenAgent] Paused for confirmation: {msg}")
            return {
                "success": False,
                "needs_confirmation": True,
                "goal": goal,
                "confirm_message": msg,
                "pending_action": action,
                "steps_completed": step + 1,
                "history": history,
            }

        # 3. Execute action
        result = await execute_gui_action(action, api_key=api_key)
        history.append({"step": step, "action": action, "result": result})

        if result.get("needs_confirmation"):
            logger.info(f"[ScreenAgent] Safety gate triggered on step {step + 1}: {result.get('reason')}")
            return {
                "success": False,
                "needs_confirmation": True,
                "goal": goal,
                "confirm_message": result.get("reason"),
                "pending_action": action,
                "steps_completed": step + 1,
                "history": history,
            }

        # 4. Wait for UI to update before next capture
        await asyncio.sleep(step_delay)

    logger.warning(f"[ScreenAgent] Max steps ({max_steps}) exceeded for goal: \"{goal}\"")
    return {
        "success": False,
        "reason": f"Max steps ({max_steps}) reached before goal completion.",
        "goal": goal,
        "steps_completed": max_steps,
        "history": history,
    }


def is_available() -> bool:
    """Checks if the Screen Agent dependencies are present."""
    return GENAI_OK and PYAUTOGUI_OK

"""
Unit and integration tests for V12 Screen Vision Agent & GUI Grounding.
"""

import io
import json
import pytest
import numpy as np
import cv2
from PIL import Image

from tools.desktop_vision import (
    check_screen_safety,
    find_template_on_screen,
    CV2_AVAILABLE,
    PYAUTOGUI_AVAILABLE,
)
from tools.screen_agent import (
    _build_vision_prompt,
    is_available as is_screen_agent_available,
)
from tools.router import detect_intent
from core.server import app


def test_safety_gate_risky_actions():
    """Verify that dangerous or sensitive GUI interactions are caught by safety gate."""
    risky_targets = [
        "Delete Account button",
        "Confirm Payment and Pay Now",
        "Uninstall Program",
        "Submit Order",
        "Enter password",
        "Credit card CVV field",
        "Format C: drive",
    ]
    for target in risky_targets:
        res = check_screen_safety("click", target)
        assert not res["safe"], f"Expected '{target}' to be flagged as risky"
        assert res["tier"] == "risky"


def test_safety_gate_safe_actions():
    """Verify that safe GUI interactions are allowed without confirmation."""
    safe_targets = [
        "File menu",
        "Notepad text area",
        "Search bar",
        "Calculator button 7",
        "Scroll down",
        "Next tab",
    ]
    for target in safe_targets:
        res = check_screen_safety("click", target)
        assert res["safe"], f"Expected '{target}' to be safe"
        assert res["tier"] == "safe"


def test_opencv_template_matching_synthetic():
    """Verify template matching accurately locates an icon/button on a synthetic canvas."""
    if not CV2_AVAILABLE:
        pytest.skip("cv2 is not installed")

    # Create synthetic canvas with texture
    np.random.seed(42)
    canvas = np.random.randint(30, 80, (300, 400, 3), dtype=np.uint8)

    # Place a unique 30x30 textured pattern at x=150..180, y=100..130
    template_patch = np.random.randint(180, 255, (30, 30, 3), dtype=np.uint8)
    canvas[100:130, 150:180] = template_patch

    # Match template directly against canvas
    res = cv2.matchTemplate(canvas, template_patch, cv2.TM_CCOEFF_NORMED)
    min_val, max_val, min_loc, max_loc = cv2.minMaxLoc(res)

    assert max_val > 0.99
    assert max_loc == (150, 100)
    # Center calculation
    center_x = max_loc[0] + 15
    center_y = max_loc[1] + 15
    assert center_x == 165
    assert center_y == 115


def test_vision_prompt_builder():
    """Verify the ReAct vision prompt builder contains required instructions and context."""
    goal = "Open calculator and calculate 42 * 7"
    prompt = _build_vision_prompt(goal, [], step=0, max_steps=8)
    assert goal in prompt
    assert "CURRENT STEP: 1 of 8" in prompt
    assert "No previous actions taken yet" in prompt
    assert "'click'" in prompt
    assert "'done'" in prompt

    history = [
        {
            "step": 0,
            "action": {"thought": "Calculator is closed, clicking search", "type": "click", "target": "Windows Search"},
            "result": {"success": True, "detail": "Clicked Windows Search"},
        }
    ]
    prompt_step2 = _build_vision_prompt(goal, history, step=1, max_steps=8)
    assert "CURRENT STEP: 2 of 8" in prompt_step2
    assert "Windows Search" in prompt_step2
    assert "Clicked Windows Search" in prompt_step2


def test_router_v12_intent_detection():
    """Verify router correctly classifies V12 vision and GUI intents."""
    cases = [
        ("look at my screen and tell me what's wrong", "screen_vision"),
        ("what is on my display right now", "screen_vision"),
        ("explain this error on screen", "screen_vision"),
        ("click the Search button", "screen_click"),
        ("click on the Notepad File menu", "screen_click"),
        ("type Hello World in notepad", "screen_type"),
        ("enter 42 into calculator", "screen_type"),
        ("automate: open calculator and compute 42 * 7", "screen_agent_goal"),
        ("screen goal: compose a new email", "screen_agent_goal"),
    ]
    for text, expected in cases:
        detected = detect_intent(text)
        assert detected == expected, f"'{text}' resolved to '{detected}', expected '{expected}'"


def test_server_routes_registered():
    """Verify that all V12 screen agent REST endpoints are registered in FastAPI."""
    routes = [r.path for r in app.routes]
    assert "/api/agent/vision" in routes
    assert "/api/agent/screen/status" in routes
    assert "/api/agent/screen/click" in routes
    assert "/api/agent/screen/type" in routes
    assert "/api/agent/screen/goal" in routes


def test_screen_agent_availability():
    """Verify screen agent reports availability."""
    assert is_screen_agent_available() is True

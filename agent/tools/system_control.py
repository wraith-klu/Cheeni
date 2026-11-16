"""
Cheeni Tools — System Control
Controls volume, brightness, battery metrics, power states, and system info.
"""

import os
import platform
import psutil
import logging

logger = logging.getLogger("cheeni.system_control")


async def handle(intent: str, text: str) -> dict:
    clean_text = text.lower()

    # Battery & System metrics
    if "battery" in clean_text or "power" in clean_text:
        battery = psutil.sensors_battery()
        if battery:
            plugged = "plugged in" if battery.power_plugged else "on battery"
            reply = f"Battery is at {battery.percent:.0f}% ({plugged})."
            return {"reply": reply, "action_taken": "battery_check", "data": {"percent": battery.percent, "plugged": battery.power_plugged}}
        return {"reply": "Could not read battery info (desktop system or unsupported driver).", "action_taken": "battery_check", "data": {}}

    # Volume Control
    if "volume" in clean_text or intent == "system_volume":
        if "mute" in clean_text:
            os.system("powershell -c (New-Object -ComObject WScript.Shell).SendKeys([char]173)")
            return {"reply": "Muted system audio.", "action_taken": "mute_volume", "data": {}}
        elif "up" in clean_text or "increase" in clean_text:
            for _ in range(5):
                os.system("powershell -c (New-Object -ComObject WScript.Shell).SendKeys([char]175)")
            return {"reply": "Increased volume.", "action_taken": "volume_up", "data": {}}
        elif "down" in clean_text or "decrease" in clean_text:
            for _ in range(5):
                os.system("powershell -c (New-Object -ComObject WScript.Shell).SendKeys([char]174)")
            return {"reply": "Decreased volume.", "action_taken": "volume_down", "data": {}}

    # Lock screen
    if "lock" in clean_text or intent == "system_lock":
        os.system("rundll32.exe user32.dll,LockWorkStation")
        return {"reply": "Locked your workstation.", "action_taken": "system_lock", "data": {}}

    # Show desktop
    if "desktop" in clean_text or intent == "system_desktop":
        os.system("powershell -c (New-Object -ComObject Shell.Application).MinimizeAll()")
        return {"reply": "Showing desktop.", "action_taken": "show_desktop", "data": {}}

    # Shutdown / Restart (Requires confirmation in router/security)
    if intent == "system_shutdown" or "shutdown" in clean_text or "shut down" in clean_text:
        return {
            "reply": "System shutdown request registered. Please confirm to proceed.",
            "action_taken": "pending_shutdown",
            "data": {"confirmation_required": True}
        }

    return {
        "reply": f"Checked system status for: {text}",
        "action_taken": "system_info",
        "data": {
            "os": platform.platform(),
            "cpu_percent": psutil.cpu_percent(),
            "ram_percent": psutil.virtual_memory().percent
        }
    }

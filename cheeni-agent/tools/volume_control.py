"""
Cheeni Desktop Agent — Windows Audio & Volume Controller (Step 11)
Fine-grained master volume, delta adjustments, mute toggle, and audio telemetry via pycaw.
"""
from utils.logging import logger

try:
    from pycaw.pycaw import AudioUtilities, IAudioEndpointVolume
    from ctypes import cast, POINTER
    from comtypes import CLSCTX_ALL
    PYCAW_AVAILABLE = True
except ImportError:
    PYCAW_AVAILABLE = False
    logger.warning("pycaw not installed — volume control disabled. Run: pip install pycaw comtypes")


def _get_volume_interface():
    """Returns the Windows audio endpoint volume interface."""
    try:
        import comtypes
        comtypes.CoInitialize()
    except Exception:
        pass
    speakers = AudioUtilities.GetSpeakers()
    if hasattr(speakers, "EndpointVolume"):
        return speakers.EndpointVolume
    interface = speakers.Activate(IAudioEndpointVolume._iid_, CLSCTX_ALL, None)
    return cast(interface, POINTER(IAudioEndpointVolume))


def get_volume() -> dict:
    """Returns current master volume level (0-100) and mute status."""
    if not PYCAW_AVAILABLE:
        return {"success": False, "message": "pycaw not installed", "volume": -1, "muted": False}
    try:
        volume = _get_volume_interface()
        current = volume.GetMasterVolumeLevelScalar()
        muted = volume.GetMute()
        level = round(current * 100)

        # Get device name if available
        device_name = "Default Speakers"
        try:
            speakers = AudioUtilities.GetSpeakers()
            if hasattr(speakers, "FriendlyName") and speakers.FriendlyName:
                device_name = speakers.FriendlyName
        except Exception:
            pass

        return {"success": True, "volume": level, "muted": bool(muted), "device": device_name}
    except Exception as e:
        logger.error(f"Get volume error: {e}")
        return {"success": False, "message": str(e), "volume": -1, "muted": False}


def set_volume(level: int) -> dict:
    """
    Sets the master volume to the specified level (0-100).
    Automatically unmutes if volume is set above 0.
    """
    if not PYCAW_AVAILABLE:
        return {"success": False, "message": "pycaw not installed"}
    try:
        clamped = max(0, min(100, int(level)))
        volume = _get_volume_interface()
        volume.SetMasterVolumeLevelScalar(clamped / 100.0, None)
        if clamped > 0 and volume.GetMute():
            volume.SetMute(0, None)
        logger.info(f"Volume set to {clamped}%")
        return {"success": True, "volume": clamped, "message": f"Volume set to {clamped}%"}
    except Exception as e:
        logger.error(f"Set volume error: {e}")
        return {"success": False, "message": str(e)}


def adjust_volume_delta(delta: int) -> dict:
    """
    Adjusts volume up or down by a delta percentage (e.g. +10, -15).
    """
    current_stat = get_volume()
    if not current_stat.get("success"):
        return current_stat

    current = current_stat.get("volume", 50)
    target = max(0, min(100, current + int(delta)))
    return set_volume(target)


def mute_volume() -> dict:
    """Mutes system audio."""
    if not PYCAW_AVAILABLE:
        return {"success": False, "message": "pycaw not installed"}
    try:
        volume = _get_volume_interface()
        volume.SetMute(1, None)
        return {"success": True, "muted": True, "message": "System audio muted."}
    except Exception as e:
        return {"success": False, "message": str(e)}


def unmute_volume() -> dict:
    """Unmutes system audio."""
    if not PYCAW_AVAILABLE:
        return {"success": False, "message": "pycaw not installed"}
    try:
        volume = _get_volume_interface()
        volume.SetMute(0, None)
        return {"success": True, "muted": False, "message": "System audio unmuted."}
    except Exception as e:
        return {"success": False, "message": str(e)}


def toggle_mute() -> dict:
    """Toggles system mute status between on and off."""
    if not PYCAW_AVAILABLE:
        return {"success": False, "message": "pycaw not installed"}
    try:
        volume = _get_volume_interface()
        current_mute = bool(volume.GetMute())
        new_mute = not current_mute
        volume.SetMute(int(new_mute), None)
        state_str = "muted" if new_mute else "unmuted"
        return {"success": True, "muted": new_mute, "message": f"System audio {state_str}."}
    except Exception as e:
        return {"success": False, "message": str(e)}

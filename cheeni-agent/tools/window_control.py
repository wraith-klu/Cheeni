"""
Cheeni Desktop Agent -- Window Management & GUI Automation (Step 13 & 14 / Phase 5)

Controls Windows application windows via Win32 API:
  - Minimize, Maximize, Restore, Close active or specified windows
  - Enumerate visible, active top-level user application windows
  - Snap windows to 50% left/right/top/bottom screen halves respecting the Windows work area
  - Show Desktop (Win + D) toggle
  - Virtual desktop workspace switching (Win + Ctrl + Left / Right)
"""

import time
import ctypes
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

try:
    import win32gui
    import win32con
    import win32process
    import win32api
    WIN32_AVAILABLE = True
except ImportError:
    WIN32_AVAILABLE = False

from utils.logging import logger

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32
WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)


# ── Desktop Attachment Context ───────────────────────────────────────────────

@contextmanager
def _use_default_desktop():
    """
    Switch thread desktop to interactive 'Default' desktop to access real user windows.
    Restores original desktop on exit.
    """
    h_default = user32.OpenDesktopW("Default", 0, False, 0x01FF)
    orig_desk = user32.GetThreadDesktop(kernel32.GetCurrentThreadId())
    switched = False
    if h_default:
        switched = bool(user32.SetThreadDesktop(h_default))
    try:
        yield h_default
    finally:
        if switched and orig_desk:
            user32.SetThreadDesktop(orig_desk)
        if h_default:
            user32.CloseDesktop(h_default)


# ── Internal Helpers ─────────────────────────────────────────────────────────

def _get_work_area() -> tuple[int, int, int, int]:
    """
    Get the primary monitor work area (excluding taskbar).
    Returns (left, top, right, bottom).
    """
    class RECT(ctypes.Structure):
        _fields_ = [
            ("left", ctypes.c_long),
            ("top", ctypes.c_long),
            ("right", ctypes.c_long),
            ("bottom", ctypes.c_long),
        ]
    rect = RECT()
    # SPI_GETWORKAREA = 0x0030
    if user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0):
        return (rect.left, rect.top, rect.right, rect.bottom)
    w = user32.GetSystemMetrics(0)
    h = user32.GetSystemMetrics(1)
    return (0, 0, w, h)


def _get_window_text(hwnd: int) -> str:
    """Safely get title text for a window handle."""
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buf = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buf, length + 1)
        return buf.value.strip()
    return ""


def _enumerate_desktop_windows(h_desktop: Optional[int] = None) -> List[int]:
    """Return all HWNDs on the given or default desktop."""
    hwnds: List[int] = []

    def handler(hwnd, _):
        hwnds.append(hwnd)
        return True

    cb = WNDENUMPROC(handler)

    if h_desktop:
        user32.EnumDesktopWindows(h_desktop, cb, 0)
    else:
        h_default = user32.OpenDesktopW("Default", 0, False, 0x01FF)
        if h_default:
            user32.EnumDesktopWindows(h_default, cb, 0)
            user32.CloseDesktop(h_default)
        elif WIN32_AVAILABLE:
            try:
                win32gui.EnumWindows(lambda h, _: hwnds.append(h) or True, None)
            except Exception:
                pass
    return hwnds


def _resolve_hwnd(target: Optional[str | int] = None, h_desk: Optional[int] = None) -> Optional[int]:
    """
    Resolves an HWND from an integer or by searching open window titles.
    If target is None, returns the current foreground window.
    """
    if isinstance(target, int) and target > 0:
        if user32.IsWindow(target):
            return target

    all_hwnds = _enumerate_desktop_windows(h_desk)

    if isinstance(target, str) and target.strip():
        q = target.lower().strip()
        for hwnd in all_hwnds:
            if user32.IsWindowVisible(hwnd):
                title = _get_window_text(hwnd).lower()
                if title and q in title:
                    return hwnd

    # Default to currently active foreground window on desktop
    fg = user32.GetForegroundWindow()
    if fg and user32.IsWindow(fg) and user32.IsWindowVisible(fg):
        return fg

    # If foreground window is not set (e.g. background service call), pick topmost visible user window
    ignored = {"Default IME", "MSCTFIME UI", "Program Manager", "Settings", "Windows Input Experience"}
    for hwnd in all_hwnds:
        if user32.IsWindowVisible(hwnd):
            t = _get_window_text(hwnd)
            if t and t not in ignored:
                return hwnd

    return None


# ── Step 13: Core Window State Management ────────────────────────────────────

def get_active_window() -> Dict[str, Any]:
    """Return info on the currently focused foreground window."""
    if not WIN32_AVAILABLE:
        return {"success": False, "error": "win32gui not available"}

    with _use_default_desktop() as h_desk:
        hwnd = _resolve_hwnd(None, h_desk)
        if not hwnd:
            return {"success": False, "error": "No active window found"}

        title = _get_window_text(hwnd)
        pid = ctypes.c_ulong()
        user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

        rect = (ctypes.c_long * 4)()
        user32.GetWindowRect(hwnd, ctypes.byref(rect))

        return {
            "success": True,
            "hwnd": hwnd,
            "title": title or "Untitled Window",
            "pid": pid.value,
            "rect": {"left": rect[0], "top": rect[1], "right": rect[2], "bottom": rect[3]},
        }


def minimize_window(target: Optional[str | int] = None) -> Dict[str, Any]:
    """Minimize the active or targeted window."""
    if not WIN32_AVAILABLE:
        return {"success": False, "error": "win32gui not available"}

    with _use_default_desktop() as h_desk:
        hwnd = _resolve_hwnd(target, h_desk)
        if not hwnd:
            return {"success": False, "error": "Target window not found"}

        title = _get_window_text(hwnd) or "Active window"
        user32.ShowWindow(hwnd, win32con.SW_MINIMIZE)
        logger.info(f"Window minimized: {title} (hwnd={hwnd})")

        return {
            "success": True,
            "action": "minimize",
            "hwnd": hwnd,
            "title": title,
            "message": f"Minimized '{title}' successfully",
        }


def maximize_window(target: Optional[str | int] = None) -> Dict[str, Any]:
    """Maximize the active or targeted window."""
    if not WIN32_AVAILABLE:
        return {"success": False, "error": "win32gui not available"}

    with _use_default_desktop() as h_desk:
        hwnd = _resolve_hwnd(target, h_desk)
        if not hwnd:
            return {"success": False, "error": "Target window not found"}

        title = _get_window_text(hwnd) or "Active window"
        user32.ShowWindow(hwnd, win32con.SW_MAXIMIZE)
        logger.info(f"Window maximized: {title} (hwnd={hwnd})")

        return {
            "success": True,
            "action": "maximize",
            "hwnd": hwnd,
            "title": title,
            "message": f"Maximized '{title}' successfully",
        }


def restore_window(target: Optional[str | int] = None) -> Dict[str, Any]:
    """Restore normal window size from minimized or maximized state."""
    if not WIN32_AVAILABLE:
        return {"success": False, "error": "win32gui not available"}

    with _use_default_desktop() as h_desk:
        hwnd = _resolve_hwnd(target, h_desk)
        if not hwnd:
            return {"success": False, "error": "Target window not found"}

        title = _get_window_text(hwnd) or "Active window"
        user32.ShowWindow(hwnd, win32con.SW_RESTORE)
        logger.info(f"Window restored: {title} (hwnd={hwnd})")

        return {
            "success": True,
            "action": "restore",
            "hwnd": hwnd,
            "title": title,
            "message": f"Restored '{title}' to normal size",
        }


def close_window(target: Optional[str | int] = None) -> Dict[str, Any]:
    """Close the active or targeted window gracefully via WM_CLOSE."""
    if not WIN32_AVAILABLE:
        return {"success": False, "error": "win32gui not available"}

    with _use_default_desktop() as h_desk:
        hwnd = _resolve_hwnd(target, h_desk)
        if not hwnd:
            return {"success": False, "error": "Target window not found"}

        title = _get_window_text(hwnd) or "Active window"
        user32.PostMessageW(hwnd, win32con.WM_CLOSE, 0, 0)
        logger.info(f"Sent WM_CLOSE to window: {title} (hwnd={hwnd})")

        return {
            "success": True,
            "action": "close",
            "hwnd": hwnd,
            "title": title,
            "message": f"Closed '{title}'",
        }


def list_open_windows() -> List[Dict[str, Any]]:
    """Enumerate all open, visible user application windows on the desktop."""
    if not WIN32_AVAILABLE:
        return []

    windows = []
    ignored_titles = {
        "", "Default IME", "MSCTFIME UI", "Program Manager", 
        "Windows Input Experience", "Settings", "Task Switching",
        "Setup", "Microsoft Text Input Application"
    }

    with _use_default_desktop() as h_desk:
        all_hwnds = _enumerate_desktop_windows(h_desk)

        for hwnd in all_hwnds:
            if not user32.IsWindowVisible(hwnd):
                continue

            title = _get_window_text(hwnd)
            if not title or title in ignored_titles:
                continue

            rect = (ctypes.c_long * 4)()
            user32.GetWindowRect(hwnd, ctypes.byref(rect))
            left, top, right, bottom = rect[0], rect[1], rect[2], rect[3]
            width = right - left
            height = bottom - top

            # Ignore tiny 0x0 tool windows
            if width <= 50 or height <= 50:
                continue

            pid = ctypes.c_ulong()
            user32.GetWindowThreadProcessId(hwnd, ctypes.byref(pid))

            windows.append({
                "hwnd": hwnd,
                "title": title,
                "pid": pid.value,
                "rect": {"left": left, "top": top, "width": width, "height": height},
                "is_minimized": bool(user32.IsIconic(hwnd)),
            })

    return windows


def focus_window(query: str) -> Dict[str, Any]:
    """Bring a window matching query to the foreground."""
    if not WIN32_AVAILABLE:
        return {"success": False, "error": "win32gui not available"}

    with _use_default_desktop() as h_desk:
        hwnd = _resolve_hwnd(query, h_desk)
        if not hwnd:
            return {"success": False, "error": f"No open window found matching '{query}'"}

        title = _get_window_text(hwnd) or "Window"

        try:
            if user32.IsIconic(hwnd):
                user32.ShowWindow(hwnd, win32con.SW_RESTORE)

            user32.SetForegroundWindow(hwnd)
            user32.BringWindowToTop(hwnd)

            return {"success": True, "hwnd": hwnd, "title": title, "message": f"Focused '{title}'"}
        except Exception as e:
            logger.warning(f"Focus window error: {e}")
            return {"success": False, "error": str(e)}


# ── Step 14: Window Snapping & Workspace Switching ───────────────────────────

def snap_window(position: str = "left", target: Optional[str | int] = None) -> Dict[str, Any]:
    """
    Snap the window to screen halves or quadrants.
    Positions: 'left', 'right', 'top', 'bottom', 'top_left', 'top_right', 'bottom_left', 'bottom_right'
    """
    if not WIN32_AVAILABLE:
        return {"success": False, "error": "win32gui not available"}

    with _use_default_desktop() as h_desk:
        hwnd = _resolve_hwnd(target, h_desk)
        if not hwnd:
            return {"success": False, "error": "Target window not found"}

        # Restore first if maximized or minimized so MoveWindow works properly
        if user32.IsIconic(hwnd) or user32.IsZoomed(hwnd):
            user32.ShowWindow(hwnd, win32con.SW_RESTORE)
            time.sleep(0.08)

        w_left, w_top, w_right, w_bottom = _get_work_area()
        total_w = w_right - w_left
        total_h = w_bottom - w_top

        pos = position.lower().strip()
        x, y, w, h = w_left, w_top, total_w // 2, total_h

        if pos in ("left", "snap_left", "split_left"):
            x = w_left
            y = w_top
            w = total_w // 2
            h = total_h
            desc = "left half"
        elif pos in ("right", "snap_right", "split_right"):
            x = w_left + (total_w // 2)
            y = w_top
            w = total_w - (total_w // 2)
            h = total_h
            desc = "right half"
        elif pos in ("top", "snap_top", "upper"):
            x = w_left
            y = w_top
            w = total_w
            h = total_h // 2
            desc = "top half"
        elif pos in ("bottom", "snap_bottom", "lower"):
            x = w_left
            y = w_top + (total_h // 2)
            w = total_w
            h = total_h - (total_h // 2)
            desc = "bottom half"
        elif pos in ("top_left", "upper_left"):
            x = w_left
            y = w_top
            w = total_w // 2
            h = total_h // 2
            desc = "top-left quadrant"
        elif pos in ("top_right", "upper_right"):
            x = w_left + (total_w // 2)
            y = w_top
            w = total_w - (total_w // 2)
            h = total_h // 2
            desc = "top-right quadrant"
        elif pos in ("bottom_left", "lower_left"):
            x = w_left
            y = w_top + (total_h // 2)
            w = total_w // 2
            h = total_h - (total_h // 2)
            desc = "bottom-left quadrant"
        elif pos in ("bottom_right", "lower_right"):
            x = w_left + (total_w // 2)
            y = w_top + (total_h // 2)
            w = total_w - (total_w // 2)
            h = total_h - (total_h // 2)
            desc = "bottom-right quadrant"
        else:
            x = w_left
            y = w_top
            w = total_w // 2
            h = total_h
            desc = "left half"

        user32.MoveWindow(hwnd, x, y, w, h, True)

        title = _get_window_text(hwnd) or "Window"
        logger.info(f"Snapped window '{title}' to {desc}: pos=({x},{y}) size=({w}x{h})")

        return {
            "success": True,
            "action": "snap",
            "position": pos,
            "description": desc,
            "hwnd": hwnd,
            "title": title,
            "bounds": {"x": x, "y": y, "width": w, "height": h},
            "message": f"Snapped '{title}' to the {desc}",
        }


def show_desktop() -> Dict[str, Any]:
    """Toggle Show Desktop using Win + D keyboard event."""
    VK_LWIN = 0x5B
    VK_D = 0x44
    KEYEVENTF_KEYUP = 0x0002

    try:
        user32.keybd_event(VK_LWIN, 0, 0, 0)
        user32.keybd_event(VK_D, 0, 0, 0)
        time.sleep(0.05)
        user32.keybd_event(VK_D, 0, KEYEVENTF_KEYUP, 0)
        user32.keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0)

        logger.info("Toggled Show Desktop (Win + D)")
        return {
            "success": True,
            "action": "show_desktop",
            "message": "Toggled desktop display",
        }
    except Exception as e:
        logger.error(f"Error showing desktop: {e}")
        return {"success": False, "error": str(e)}


def switch_virtual_desktop(direction: str = "next") -> Dict[str, Any]:
    """
    Switch Windows 10/11 Virtual Desktop.
    direction: 'next' (Win + Ctrl + Right) or 'prev' (Win + Ctrl + Left)
    """
    VK_LWIN = 0x5B
    VK_CONTROL = 0x11
    VK_LEFT = 0x25
    VK_RIGHT = 0x27
    KEYEVENTF_KEYUP = 0x0002

    arrow_key = VK_RIGHT if direction.lower().startswith("next") else VK_LEFT
    desc = "next" if direction.lower().startswith("next") else "previous"

    try:
        user32.keybd_event(VK_LWIN, 0, 0, 0)
        user32.keybd_event(VK_CONTROL, 0, 0, 0)
        user32.keybd_event(arrow_key, 0, 0, 0)
        time.sleep(0.05)
        user32.keybd_event(arrow_key, 0, KEYEVENTF_KEYUP, 0)
        user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
        user32.keybd_event(VK_LWIN, 0, KEYEVENTF_KEYUP, 0)

        logger.info(f"Switched virtual desktop: {desc}")
        return {
            "success": True,
            "action": "switch_desktop",
            "direction": desc,
            "message": f"Switched to {desc} virtual desktop",
        }
    except Exception as e:
        logger.error(f"Error switching virtual desktop: {e}")
        return {"success": False, "error": str(e)}


# ── Step 14.1: Desktop Corner Companion Snapping ────────────────────────────

def snap_corner_companion(
    target: Optional[str | int] = "Cheeni",
    width: int = 420,
    height: int = 740,
    stay_on_top: bool = False,
) -> Dict[str, Any]:
    """
    Snap Cheeni desktop companion window to the top-right corner of the Windows screen.
    Computes coordinates based on current monitor work area.
    """
    if not WIN32_AVAILABLE:
        return {"success": False, "error": "win32gui not available"}

    with _use_default_desktop() as h_desk:
        hwnd = _resolve_hwnd(target, h_desk)

        # Fallback: find any window containing "Cheeni", "5173", or "Vite" if target is Cheeni or None
        if not hwnd and (target in ("Cheeni", None, "")):
            all_hwnds = _enumerate_desktop_windows(h_desk)
            for h in all_hwnds:
                if user32.IsWindowVisible(h):
                    t = _get_window_text(h).lower()
                    if "cheeni" in t or "5173" in t:
                        hwnd = h
                        break

        if not hwnd:
            return {"success": False, "error": "Cheeni window not found"}

        # Restore first if minimized or maximized
        if user32.IsIconic(hwnd) or user32.IsZoomed(hwnd):
            user32.ShowWindow(hwnd, win32con.SW_RESTORE)
            time.sleep(0.08)

        w_left, w_top, w_right, w_bottom = _get_work_area()
        total_w = w_right - w_left
        total_h = w_bottom - w_top

        actual_w = min(width, total_w - 40)
        actual_h = min(height, total_h - 24)

        # Top-right corner with 14px margin
        x = w_right - actual_w - 14
        y = w_top + 14

        user32.MoveWindow(hwnd, x, y, actual_w, actual_h, True)
        user32.SetForegroundWindow(hwnd)
        user32.BringWindowToTop(hwnd)

        if stay_on_top:
            # HWND_TOPMOST = -1, SWP_SHOWWINDOW = 0x0040
            user32.SetWindowPos(hwnd, -1, x, y, actual_w, actual_h, 0x0040)

        title = _get_window_text(hwnd) or "Cheeni Desktop"
        logger.info(f"Snapped '{title}' to top-right corner: ({x}, {y}, {actual_w}x{actual_h})")

        return {
            "success": True,
            "action": "snap_corner",
            "hwnd": hwnd,
            "title": title,
            "bounds": {"x": x, "y": y, "width": actual_w, "height": actual_h},
            "message": f"Cheeni positioned at top-right corner ({x}, {y})",
        }


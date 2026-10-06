"""
Cheeni Desktop Agent — Windows Application Controller (Step 10)
Handles discovery, launching, switching, and graceful/force termination
of Windows desktop applications and URI protocol handlers.
"""
import subprocess
import os
import shutil
import ctypes
from typing import Optional, List, Dict
import psutil
from utils.logging import logger

USER_HOME = os.path.expanduser("~")
PROGRAM_FILES = os.environ.get("ProgramFiles", "C:\\Program Files")
PROGRAM_FILES_X86 = os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")
LOCAL_APPDATA = os.environ.get("LOCALAPPDATA", os.path.join(USER_HOME, "AppData", "Local"))
ROAMING_APPDATA = os.environ.get("APPDATA", os.path.join(USER_HOME, "AppData", "Roaming"))

# ── Application Catalog & Common Windows Binary Paths ─────────────────────────
APP_CATALOG: Dict[str, Dict] = {
    # System Tools
    "notepad": {
        "exe": "notepad.exe",
        "aliases": ["notepad", "text editor"],
        "paths": ["notepad.exe"],
    },
    "calculator": {
        "exe": "calc.exe",
        "aliases": ["calc", "calculator"],
        "uri": "calculator:",
        "paths": ["calc.exe"],
    },
    "paint": {
        "exe": "mspaint.exe",
        "aliases": ["paint", "mspaint"],
        "paths": ["mspaint.exe"],
    },
    "task manager": {
        "exe": "taskmgr.exe",
        "aliases": ["task manager", "taskmgr", "activity monitor"],
        "paths": ["taskmgr.exe"],
    },
    "file explorer": {
        "exe": "explorer.exe",
        "aliases": ["explorer", "file explorer", "files", "my computer"],
        "paths": ["explorer.exe"],
    },
    "cmd": {
        "exe": "cmd.exe",
        "aliases": ["cmd", "command prompt"],
        "paths": ["cmd.exe"],
    },
    "powershell": {
        "exe": "powershell.exe",
        "aliases": ["powershell", "windows powershell"],
        "paths": ["powershell.exe"],
    },
    "terminal": {
        "exe": "wt.exe",
        "aliases": ["terminal", "windows terminal"],
        "paths": ["wt.exe", os.path.join(LOCAL_APPDATA, "Microsoft", "WindowsApps", "wt.exe")],
    },
    "settings": {
        "exe": "SystemSettings.exe",
        "aliases": ["settings", "windows settings", "control panel"],
        "uri": "ms-settings:",
        "paths": ["control.exe"],
    },

    # Browsers
    "chrome": {
        "exe": "chrome.exe",
        "aliases": ["chrome", "google chrome"],
        "paths": [
            os.path.join(PROGRAM_FILES, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(PROGRAM_FILES_X86, "Google", "Chrome", "Application", "chrome.exe"),
            os.path.join(LOCAL_APPDATA, "Google", "Chrome", "Application", "chrome.exe"),
        ],
    },
    "edge": {
        "exe": "msedge.exe",
        "aliases": ["edge", "microsoft edge"],
        "paths": [
            os.path.join(PROGRAM_FILES_X86, "Microsoft", "Edge", "Application", "msedge.exe"),
            os.path.join(PROGRAM_FILES, "Microsoft", "Edge", "Application", "msedge.exe"),
        ],
    },
    "firefox": {
        "exe": "firefox.exe",
        "aliases": ["firefox", "mozilla firefox"],
        "paths": [
            os.path.join(PROGRAM_FILES, "Mozilla Firefox", "firefox.exe"),
            os.path.join(PROGRAM_FILES_X86, "Mozilla Firefox", "firefox.exe"),
        ],
    },
    "brave": {
        "exe": "brave.exe",
        "aliases": ["brave", "brave browser"],
        "paths": [
            os.path.join(PROGRAM_FILES, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
            os.path.join(LOCAL_APPDATA, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
        ],
    },

    # Developer Tools
    "vscode": {
        "exe": "Code.exe",
        "aliases": ["vscode", "vs code", "visual studio code", "code"],
        "paths": [
            os.path.join(LOCAL_APPDATA, "Programs", "Microsoft VS Code", "Code.exe"),
            os.path.join(PROGRAM_FILES, "Microsoft VS Code", "Code.exe"),
            os.path.join(PROGRAM_FILES_X86, "Microsoft VS Code", "Code.exe"),
        ],
    },

    # Media & Communication
    "spotify": {
        "exe": "Spotify.exe",
        "aliases": ["spotify", "music app"],
        "uri": "spotify:",
        "paths": [
            os.path.join(ROAMING_APPDATA, "Spotify", "Spotify.exe"),
        ],
    },
    "discord": {
        "exe": "Discord.exe",
        "aliases": ["discord"],
        "paths": [
            os.path.join(LOCAL_APPDATA, "Discord", "Update.exe"),
        ],
    },

    # Productivity / Office
    "word": {
        "exe": "WINWORD.EXE",
        "aliases": ["word", "microsoft word", "winword"],
        "paths": [
            os.path.join(PROGRAM_FILES, "Microsoft Office", "root", "Office16", "WINWORD.EXE"),
            os.path.join(PROGRAM_FILES_X86, "Microsoft Office", "root", "Office16", "WINWORD.EXE"),
        ],
    },
    "excel": {
        "exe": "EXCEL.EXE",
        "aliases": ["excel", "microsoft excel"],
        "paths": [
            os.path.join(PROGRAM_FILES, "Microsoft Office", "root", "Office16", "EXCEL.EXE"),
            os.path.join(PROGRAM_FILES_X86, "Microsoft Office", "root", "Office16", "EXCEL.EXE"),
        ],
    },
    "powerpoint": {
        "exe": "POWERPNT.EXE",
        "aliases": ["powerpoint", "ppt", "microsoft powerpoint"],
        "paths": [
            os.path.join(PROGRAM_FILES, "Microsoft Office", "root", "Office16", "POWERPNT.EXE"),
            os.path.join(PROGRAM_FILES_X86, "Microsoft Office", "root", "Office16", "POWERPNT.EXE"),
        ],
    },
}


def _resolve_app_entry(query: str) -> Optional[Dict]:
    """Finds matching catalog entry by exact key or alias."""
    q = query.lower().strip()
    if q in APP_CATALOG:
        return APP_CATALOG[q]

    for key, item in APP_CATALOG.items():
        if q == key or q in item.get("aliases", []):
            return item
        for alias in item.get("aliases", []):
            if alias in q or q in alias:
                return item
    return None


# ── Launch Application ─────────────────────────────────────────────────────────

def launch_app(app_name: str) -> dict:
    """
    Launches a Windows desktop application by name or common alias.
    Supports binary paths, system PATH, and Windows URI schemes.
    """
    if not app_name or not app_name.strip():
        return {"success": False, "message": "App name is required."}

    query = app_name.lower().strip()
    entry = _resolve_app_entry(query)

    # 1. Try Windows URI scheme if configured
    if entry and "uri" in entry:
        try:
            os.startfile(entry["uri"])
            logger.info(f"Launched via URI: {entry['uri']}")
            return {"success": True, "message": f"Launched {app_name} successfully!", "app": app_name}
        except Exception as e:
            logger.debug(f"URI launch failed for {entry['uri']}: {e}")

    # 2. Try catalog absolute paths
    if entry and "paths" in entry:
        for p in entry["paths"]:
            if os.path.exists(p):
                try:
                    subprocess.Popen([p], shell=False)
                    logger.info(f"Launched via path: {p}")
                    return {"success": True, "message": f"Launched {app_name} successfully!", "path": p, "app": app_name}
                except Exception as e:
                    logger.error(f"Failed executing {p}: {e}")

    # 3. Try standard executable name via shutil.which (PATH lookup)
    target_exe = entry["exe"] if entry else (query if query.endswith(".exe") else f"{query}.exe")
    found = shutil.which(target_exe) or shutil.which(query)
    if found:
        try:
            subprocess.Popen([found], shell=False)
            logger.info(f"Launched via PATH: {found}")
            return {"success": True, "message": f"Launched {app_name} successfully!", "path": found, "app": app_name}
        except Exception as e:
            logger.error(f"Failed launching {found}: {e}")

    # 4. Fallback: launch via os.startfile or shell
    try:
        os.startfile(query)
        logger.info(f"Launched via os.startfile: {query}")
        return {"success": True, "message": f"Launched {app_name}!", "app": app_name}
    except Exception:
        pass

    try:
        subprocess.Popen(query, shell=True)
        return {"success": True, "message": f"Attempted to launch {app_name}.", "app": app_name}
    except Exception as e:
        return {"success": False, "message": f"Could not find or launch '{app_name}'. Make sure it is installed."}


# ── Terminate / Close Application ──────────────────────────────────────────────

def close_app(app_name: str, force: bool = False) -> dict:
    """
    Closes or terminates running process instances of an application.

    Args:
        app_name : Application name or process identifier.
        force    : If True, uses kill(); if False, sends graceful terminate().

    Returns:
        Result dict with closed_count and status message.
    """
    if not app_name or not app_name.strip():
        return {"success": False, "message": "App name is required to close."}

    query = app_name.lower().strip()
    entry = _resolve_app_entry(query)
    target_names = []

    if entry:
        target_names.append(entry["exe"].lower())
    target_names.append(query if query.endswith(".exe") else f"{query}.exe")
    target_names.append(query)

    closed_count = 0
    errors = []

    for proc in psutil.process_iter(["pid", "name"]):
        try:
            proc_name = proc.info["name"].lower() if proc.info["name"] else ""
            if any(t in proc_name for t in target_names):
                if force:
                    proc.kill()
                else:
                    proc.terminate()
                closed_count += 1
                logger.info(f"Closed process: {proc.info['name']} (PID {proc.info['pid']})")
        except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
            errors.append(str(e))
        except Exception as e:
            errors.append(str(e))

    if closed_count > 0:
        action_verb = "Terminated" if force else "Closed"
        return {
            "success": True,
            "closed_count": closed_count,
            "message": f"{action_verb} {closed_count} window/process instance(s) of {app_name}.",
            "app": app_name,
        }
    else:
        return {
            "success": False,
            "closed_count": 0,
            "message": f"No active process found for '{app_name}'.",
            "app": app_name,
        }


# ── Check If App Is Running ───────────────────────────────────────────────────

def is_app_running(app_name: str) -> bool:
    """Returns True if any process matching app_name is currently running."""
    query = app_name.lower().strip()
    entry = _resolve_app_entry(query)
    targets = [entry["exe"].lower()] if entry else []
    targets.append(query if query.endswith(".exe") else f"{query}.exe")

    for proc in psutil.process_iter(["name"]):
        try:
            pname = proc.info["name"].lower() if proc.info["name"] else ""
            if any(t in pname for t in targets):
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue
    return False


# ── List Active User Applications ─────────────────────────────────────────────

def list_running_apps() -> list:
    """
    Returns a list of active desktop applications currently running.
    Filters out background Windows OS daemons and service hosts.
    """
    IGNORED_SYSTEM = {
        "svchost.exe", "system", "registry", "smss.exe", "csrss.exe", "wininit.exe",
        "services.exe", "lsass.exe", "winlogon.exe", "fontdrvhost.exe", "dwm.exe",
        "dllhost.exe", "conhost.exe", "sihost.exe", "taskhostw.exe", "ctfmon.exe",
        "searchindexer.exe", "runtimebroker.exe", "wlanext.exe", "spoolsv.exe",
    }

    seen = set()
    apps = []

    for proc in psutil.process_iter(["pid", "name", "memory_info", "cpu_percent"]):
        try:
            name = proc.info["name"]
            if not name or name.lower() in IGNORED_SYSTEM:
                continue

            # Group duplicate worker processes (e.g. multi-process Chrome/VS Code)
            base_name = name.lower()
            if base_name in seen:
                continue
            seen.add(base_name)

            mem_mb = round((proc.info["memory_info"].rss if proc.info["memory_info"] else 0) / (1024 * 1024), 1)
            apps.append({
                "name": name,
                "pid": proc.info["pid"],
                "memory_mb": mem_mb,
            })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    # Sort by memory usage descending
    apps.sort(key=lambda x: x["memory_mb"], reverse=True)
    return apps[:25]


# ── Focus / Switch to App Window ──────────────────────────────────────────────

def focus_app(app_name: str) -> dict:
    """
    Brings the window of a running application to the foreground.
    """
    user32 = ctypes.windll.user32
    target_found = [False]
    query = app_name.lower().strip()
    entry = _resolve_app_entry(query)
    match_words = [query]
    if entry:
        match_words.extend(entry.get("aliases", []))

    def enum_windows_callback(hwnd, _):
        if user32.IsWindowVisible(hwnd):
            length = user32.GetWindowTextLengthW(hwnd)
            if length > 0:
                buff = ctypes.create_unicode_buffer(length + 1)
                user32.GetWindowTextW(hwnd, buff, length + 1)
                title = buff.value.lower()
                if any(w in title for w in match_words):
                    user32.ShowWindow(hwnd, 9)  # SW_RESTORE
                    user32.SetForegroundWindow(hwnd)
                    target_found[0] = True
                    return False
        return True

    WNDENUMPROC = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
    cb = WNDENUMPROC(enum_windows_callback)
    user32.EnumWindows(cb, 0)

    if target_found[0]:
        return {"success": True, "message": f"Switched to {app_name}."}
    return {"success": False, "message": f"Could not find an open window for '{app_name}'."}

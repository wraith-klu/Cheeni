"""
Cheeni Desktop Agent -- Central Command Router (Step 9 & Phase 4 Extended)

The single entry point for ALL command execution.

Flow:
  Input text (voice or API)
       |
       v
  [1] Security Classifier   -> BLOCKED? Reject immediately.
       |                        RISKY?   Ask for confirmation first.
       |                        SAFE?    Proceed.
       v
  [2] Intent Detector       -> Which tool module handles this?
       |
       v
  [3] Tool Executor          -> Call the correct tool, capture result + timing.
       |
       v
  [4] Response Builder       -> Return structured { success, result, speech, timing }

Supported intents:
  open_url          -> open a browser URL or web app
  play_music        -> search and open music on YouTube
  search_web        -> Google / YouTube / Wikipedia search
  system_status     -> battery, CPU, RAM, datetime
  system_specs      -> CPU architecture, cores, RAM, disks, OS details
  set_volume        -> set master volume (0-100)
  volume_up         -> delta increase
  volume_down       -> delta decrease
  mute_volume       -> mute system audio
  unmute_volume     -> unmute system audio
  toggle_mute       -> toggle audio mute
  launch_app        -> launch a Windows application
  close_app         -> close/kill a running application
  list_running_apps -> list active user desktop applications
  focus_app         -> switch to an open window
  lock_pc           -> lock the Windows screen
  sleep_pc          -> put PC to sleep
  restart_pc        -> restart Windows
  shutdown_pc       -> shut down Windows
"""

import re
import time
import asyncio
from typing import Optional, Callable
from dataclasses import dataclass, field

from utils.logging import logger
from security.command_security import classify, SecurityTier
from security.confirmation import get_confirmation_manager
from tools.system_status import (
    get_full_system_status,
    get_battery_status,
    get_datetime_status,
    get_hardware_specs,
    lock_workstation,
    sleep_system,
    restart_system,
    shutdown_system,
)
from tools.volume_control import (
    get_volume,
    set_volume,
    adjust_volume_delta,
    mute_volume,
    unmute_volume,
    toggle_mute,
)
from tools.app_control import (
    launch_app,
    close_app,
    is_app_running,
    list_running_apps,
    focus_app,
)
from tools.window_control import (
    get_active_window,
    minimize_window,
    maximize_window,
    restore_window,
    close_window,
    list_open_windows,
    focus_window,
    snap_window,
    show_desktop,
    switch_virtual_desktop,
)
from tools.filesystem_control import (
    search_files,
    create_folder,
    rename_file,
    move_file,
    read_document,
)
from tools.web_intelligence import (
    search_web,
    get_latest_news,
    scrape_webpage,
)


# ── Router Result ──────────────────────────────────────────────────────────────

@dataclass
class RouterResult:
    success:       bool
    intent:        str             = "unknown"
    result:        dict            = field(default_factory=dict)
    speech:        str             = ""         # text for TTS
    security_tier: str             = "safe"
    elapsed_ms:    int             = 0
    blocked:       bool            = False
    needs_confirm: bool            = False
    error:         Optional[str]   = None


# ── Intent Detection Rules ─────────────────────────────────────────────────────

_INTENT_RULES = [
    # Power & Lock (checked early)
    ("lock_pc",               [r"\block\s+(my\s+|the\s+)?(laptop|computer|screen|pc)\b", r"\block\s+workstation\b"]),
    ("sleep_pc",              [r"\b(put to sleep|go to sleep|sleep mode)\b", r"\bhibernate\b"]),
    ("restart_pc",            [r"\b(restart|reboot)\s*(my\s+|the\s+)?(laptop|computer|pc|system)?\b"]),
    ("shutdown_pc",           [r"\b(shutdown|shut down|power off|turn off)\s*(my\s+|the\s+)?(laptop|computer|pc|system)?\b"]),

    # App Control
    ("close_app",             [r"(close|quit|exit|terminate|kill)\s+(app\s+|process\s+|window\s+)?(notepad|calculator|chrome|browser|vscode|vs code|paint|spotify|word|excel|terminal|cmd|edge|firefox|brave|discord|\w[\w.-]+)"]),
    ("list_running_apps",     [r"(list|show|what|display)\s*(all\s+)?(running|open|active)\s*(apps|applications|programs|windows|tasks)?", r"(running|open)\s+(apps|applications|programs)"]),
    ("focus_app",             [r"(switch to|focus|bring up)\s+(app\s+|window\s+)?([a-zA-Z0-9\s]+)", r"show\s+(app|window)\s+([a-zA-Z0-9\s]+)"]),
    ("launch_app",            [r"\b(open|launch|start|run)\s+(notepad|calculator|paint|explorer|chrome|vscode|vs code|terminal|cmd|powershell|word|excel|spotify|discord|slack|edge|firefox|brave|settings)\b"]),

    # System Status & Specs
    ("system_specs",          [r"(specs|specifications|hardware|pc info|system specs|system information)", r"what.*(my specs|my processor|my cpu|my ram|computer specs)"]),
    ("system_status_battery", [r"battery", r"power level", r"charging"]),
    ("system_status_datetime",[r"what.?s? the time", r"current time", r"what.?s? the date", r"today.?s? date"]),
    ("system_status_full",    [r"(cpu|ram|memory|disk|system|hardware)\s*status", r"system info"]),

    # Volume Control
    ("toggle_mute",           [r"toggle\s+(mute|sound|audio)"]),
    ("set_volume",            [r"set.*(volume|sound).*(to\s*\d+)", r"volume.*(to\s*\d+)"]),
    ("volume_up",             [r"(increase|raise|turn up|higher|louder)\s*(the\s+)?(volume|sound)"]),
    ("volume_down",           [r"(decrease|lower|reduce|turn down|quieter)\s*(the\s+)?(volume|sound)"]),
    ("mute_volume",           [r"\bmute\b", r"silence\s*(the\s+)?(laptop|speaker)"]),
    ("unmute_volume",         [r"\bunmute\b", r"turn\s*(the\s+)?sound\s*back\s*on"]),

    # Media & Web Shortcuts
    ("play_music",            [r"\bplay\s+(?!youtube|netflix)", r"\bwatch\s+(?!youtube|netflix)", r"\bstream\s+(?!youtube|netflix)", r"play\s+some\s+music", r"play\s+(lofi|chill|songs|tracks)"]),
    ("open_url_youtube",      [r"\b(open|launch|go to)\s+youtube\b"]),
    ("open_url_google",       [r"\b(open|launch|go to)\s+google\b"]),
    ("open_url_github",       [r"\b(open|launch|go to)\s+github\b"]),
    ("open_url_linkedin",     [r"\b(open|launch|go to)\s+linkedin\b"]),
    ("open_url_whatsapp",     [r"\b(open|launch|go to)\s+whatsapp\b"]),
    ("open_url_leetcode",     [r"\b(open|launch|go to)\s+leetcode\b"]),
    ("open_url_gmail",        [r"\b(open|launch|go to)\s+(gmail|mail|email)\b"]),
    ("open_url_spotify",      [r"\b(open|launch|go to)\s+spotify\b"]),
    ("open_url_netflix",      [r"\b(open|launch|go to)\s+netflix\b"]),
    ("open_url_chatgpt",      [r"\b(open|launch|go to)\s+(chatgpt|openai)\b"]),
    # Window Management & GUI Automation (Step 13 & 14 / Phase 5)
    ("minimize_window",       [r"\bminimize(\s+(this|the|current|active)?\s*window)?\b", r"\bminimize\s+(?P<app>[a-zA-Z0-9\s]+)\b"]),
    ("maximize_window",       [r"\bmaximize(\s+(this|the|current|active)?\s*window)?\b", r"\b(full\s*screen|make\s+full\s*screen)(\s+(this|the)?\s*window)?\b", r"\bmaximize\s+(?P<app>[a-zA-Z0-9\s]+)\b"]),
    ("restore_window",        [r"\brestore(\s+(this|the|current|active)?\s*window)?\b", r"\bunmaximize(\s+(this|the)?\s*window)?\b"]),
    ("close_active_window",   [r"\bclose(\s+(this|the|current|active)?\s*window)\b", r"\bclose\s+active\s+window\b"]),
    ("snap_window_left",      [r"\b(snap|split)(\s+(this|the|current|active)?\s*window)?\s+(to\s+(the\s+)?)?left(\s+half)?\b", r"\bsplit\s+screen\s+left\b"]),
    ("snap_window_right",     [r"\b(snap|split)(\s+(this|the|current|active)?\s*window)?\s+(to\s+(the\s+)?)?right(\s+half)?\b", r"\bsplit\s+screen\s+right\b"]),
    ("snap_window_top",       [r"\b(snap|split)(\s+(this|the|current|active)?\s*window)?\s+(to\s+(the\s+)?)?(top|upper)(\s+half)?\b"]),
    ("snap_window_bottom",    [r"\b(snap|split)(\s+(this|the|current|active)?\s*window)?\s+(to\s+(the\s+)?)?(bottom|lower)(\s+half)?\b"]),
    ("show_desktop",          [r"\bshow\s+(the\s+)?desktop\b", r"\bgo\s+to\s+(the\s+)?desktop\b", r"\bminimize\s+all(\s+windows)?\b"]),
    ("switch_desktop_next",   [r"\b(next\s+desktop|next\s+workspace|switch\s+to\s+next\s+desktop)\b"]),
    ("switch_desktop_prev",   [r"\b(previous|prev)\s+(desktop|workspace)\b", r"\bswitch\s+to\s+(previous|prev)\s+desktop\b"]),
    ("list_open_windows",     [r"\b(what|which)\s+windows\s+are\s+open\b", r"\blist\s+(open|active)?\s*windows\b", r"\bshow\s+open\s+windows\b"]),
    # Filesystem & Document Intelligence (Phase 6)
    ("search_files",          [r"\b(search|find)\s+(for\s+)?(a\s+)?(file|folder)\s+(named|called)?\s*(?P<query>.+)"]),
    ("read_document",         [r"\b(read|summarize|extract)\s+(the\s+)?(document|pdf|text|file)\s*(?P<file>.+)"]),
    ("create_folder",         [r"\b(create|make)\s+(a\s+)?(new\s+)?(folder|directory)(\s+named|\s+called)?\s*(?P<folder>.+)"]),
    ("rename_file",           [r"\brename\s+(the\s+)?(file|folder)\s*(?P<old>.+?)\s+to\s+(?P<new>.+)"]),
    ("move_file",             [r"\bmove\s+(the\s+)?(file|folder)\s*(?P<src>.+?)\s+to\s+(?P<dest>.+)"]),
    # Web Intelligence & Scraping (Phase 7)
    ("web_intelligence_search", [r"\b(search|find)\s+(the\s+)?(web|internet)\s+(for\s+)?(?P<query>.+)"]),
    ("web_intelligence_news",   [r"\b(what.?s?|show\s+me)\s+(the\s+)?(latest\s+)?news(\s+about\s+(?P<topic>.+))?"]),
    ("web_intelligence_scrape", [r"\b(scrape|extract|read)\s+(the\s+)?(website|webpage|page|article)\s*(?P<url>https?://\S+)"]),
    ("search_web",            [r"\b(search|google|look up|find)\s+(for\s+)?.+"]),
]

URL_MAP = {
    "open_url_youtube":   "https://www.youtube.com",
    "open_url_google":    "https://www.google.com",
    "open_url_github":    "https://www.github.com",
    "open_url_linkedin":  "https://www.linkedin.com",
    "open_url_whatsapp":  "https://web.whatsapp.com",
    "open_url_leetcode":  "https://www.leetcode.com",
    "open_url_gmail":     "https://mail.google.com",
    "open_url_spotify":   "https://open.spotify.com",
    "open_url_netflix":   "https://www.netflix.com",
    "open_url_chatgpt":   "https://chat.openai.com",
}


def detect_intent(text: str) -> str:
    normalized = text.lower().strip()
    for intent, patterns in _INTENT_RULES:
        for pat in patterns:
            if re.search(pat, normalized, re.IGNORECASE):
                return intent
    return "unknown"


def _extract_volume_level(text: str) -> Optional[int]:
    m = re.search(r"\b(\d{1,3})\s*(%|percent)?\b", text)
    if m:
        val = int(m.group(1))
        if 0 <= val <= 100:
            return val
    return None


def _extract_search_query(text: str) -> str:
    cleaned = re.sub(
        r"^(search|google|look up|find|search for|google for)\s*",
        "", text, flags=re.IGNORECASE
    ).strip()
    return cleaned or text


def _extract_song_query(text: str) -> str:
    """
    Extract the actual media/song/video query from natural language.
    Handles phrasings like:
      - 'play song of arijit singh' -> 'arijit singh songs'
      - 'play kesariya on youtube' -> 'kesariya'
      - 'play python preparation video on youtube' -> 'python preparation'
      - 'play video related to DSA interview' -> 'DSA interview'
    """
    cleaned = text.strip()
    # Remove leading polite prefix
    cleaned = re.sub(r"^please\s+", "", cleaned, flags=re.IGNORECASE)
    # Remove open/launch/go to youtube prefix
    cleaned = re.sub(r"\b(open|launch|go to)\s+youtube\s*(and|abd|&)?\s*", "", cleaned, flags=re.IGNORECASE)
    # Remove leading action verb (play/stream/watch/listen to)
    cleaned = re.sub(r"^(play|stream|watch|listen\s+to)\s*", "", cleaned, flags=re.IGNORECASE)
    # Remove leading media type words (song, music, video, track, clip)
    cleaned = re.sub(r"^(songs?|music|videos?|tracks?|clip)\s*", "", cleaned, flags=re.IGNORECASE)
    # Remove leading prepositions: "of", "by", "from"
    cleaned = re.sub(r"^(of|by|from)\s+", "", cleaned, flags=re.IGNORECASE)
    # Remove trailing platform qualifiers: "on youtube", "in youtube", "from youtube"
    cleaned = re.sub(r"\s*(?:on|in|from|at|via)\s+youtube\b", "", cleaned, flags=re.IGNORECASE)
    # Strip inline "video(s) related to/about/on" -> keep the subject
    cleaned = re.sub(r"\bvideo(?:s)?\s+(?:related\s+to|about|on)\s+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"\brelated\s+to\b", "", cleaned, flags=re.IGNORECASE)
    # Remove "song by" or "music by" style remnants
    cleaned = re.sub(r"\b(song|music|track)\s*(by|from)\s*", "", cleaned, flags=re.IGNORECASE)
    # Remove trailing filler words
    cleaned = re.sub(r"\s+(?:please|now|for\s+me)\s*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.strip()
    # Return whatever the user specified - do NOT substitute generic beats
    return cleaned if cleaned else "trending music"


def _extract_app_name(text: str) -> str:
    m = re.search(
        r"(open|launch|start|run|close|quit|exit|terminate|kill|switch to|focus|bring up)\s+(app\s+|window\s+)?(.+?)(\s+(for|on|in|please).*)?$",
        text, re.IGNORECASE
    )
    if m:
        return m.group(3).strip()
    return text.strip()


def _extract_file_args(intent: str, text: str) -> dict:
    normalized = text.lower().strip()
    for rule_intent, patterns in _INTENT_RULES:
        if rule_intent == intent:
            for pat in patterns:
                m = re.search(pat, normalized, re.IGNORECASE)
                if m:
                    return m.groupdict()
    return {}


def resolve_youtube_top_video(query: str) -> tuple[str, Optional[str]]:
    """Resolves the first YouTube video URL with autoplay=1 for a given search query."""
    import urllib.request
    import urllib.parse

    target_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}"
    video_id = None
    try:
        req_yt = urllib.request.Request(
            target_url,
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )
        with urllib.request.urlopen(req_yt, timeout=4) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
            video_ids = re.findall(r'watch\?v=([a-zA-Z0-9_-]{11})', html)
            if not video_ids:
                video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            for vid in video_ids:
                if len(vid) == 11 and vid != "results":
                    video_id = vid
                    target_url = f"https://www.youtube.com/watch?v={vid}&autoplay=1"
                    break
    except Exception as e:
        logger.debug(f"Could not resolve direct YouTube video: {e}")
    return target_url, video_id


# ── Tool Executor ──────────────────────────────────────────────────────────────

def _execute_intent(intent: str, raw_text: str) -> dict:
    """Execute the resolved intent and return a structured result dict."""
    import webbrowser

    # ── Power & Lock ──
    if intent == "lock_pc":
        res = lock_workstation()
        return {"type": "system_action", "data": res, "speech": "Locking your laptop now. See you soon!", "ui_action": None}

    if intent == "sleep_pc":
        res = sleep_system()
        return {"type": "system_action", "data": res, "speech": "Putting your laptop to sleep mode now.", "ui_action": None}

    if intent == "restart_pc":
        res = restart_system(delay_sec=5)
        return {"type": "system_action", "data": res, "speech": "Restarting your laptop in 5 seconds.", "ui_action": None}

    if intent == "shutdown_pc":
        res = shutdown_system(delay_sec=5)
        return {"type": "system_action", "data": res, "speech": "Shutting down your laptop in 5 seconds. Goodbye!", "ui_action": None}

    # ── Application Control ──
    if intent == "launch_app":
        app_name = _extract_app_name(raw_text)
        result = launch_app(app_name)
        speech = result.get("message", f"Launched {app_name}.")
        return {"type": "launch_app", "data": result, "speech": speech, "ui_action": {"type": "launch_app", "app": app_name, "label": f"Open {app_name.title()}"}}

    if intent == "close_app":
        app_name = _extract_app_name(raw_text)
        result = close_app(app_name)
        speech = result.get("message", f"Closed {app_name}.")
        return {"type": "close_app", "data": result, "speech": speech, "ui_action": None}

    if intent == "list_running_apps":
        apps = list_running_apps()
        count = len(apps)
        names = [a["name"].replace(".exe", "") for a in apps[:5]]
        speech = f"You have {count} active apps running, including {', '.join(names)}." if names else "No active desktop applications detected."
        return {"type": "list_apps", "data": {"apps": apps, "count": count}, "speech": speech, "ui_action": None}

    if intent == "focus_app":
        app_name = _extract_app_name(raw_text)
        result = focus_app(app_name)
        speech = result.get("message", f"Switched to {app_name}.")
        return {"type": "focus_app", "data": result, "speech": speech, "ui_action": None}

    # ── System Telemetry & Specs ──
    if intent == "system_specs":
        specs = get_hardware_specs()
        speech = (
            f"Your laptop is running an {specs['processor']} with {specs['cores']}. "
            f"You have {specs['ram']} RAM and {specs['storage']}."
        )
        return {"type": "system_specs", "data": specs, "speech": speech, "ui_action": None}

    if intent == "system_status_battery":
        data = get_battery_status()
        return {
            "type": "system_status",
            "data": data,
            "speech": f"Your laptop battery is at {data['level']} percent and is currently {data['charging']}.",
            "ui_action": None,
        }

    if intent == "system_status_datetime":
        data = get_datetime_status()
        return {
            "type": "system_status",
            "data": data,
            "speech": f"It is currently {data['time']} on {data['date']}.",
            "ui_action": None,
        }

    if intent == "system_status_full":
        data = get_full_system_status()
        return {
            "type": "system_status",
            "data": data,
            "speech": (
                f"Your system is running at {data['cpu']['usage_percent']} percent CPU "
                f"and {data['ram']['usage_percent']} percent RAM. "
                f"Battery is at {data['battery']['level']} percent."
            ),
            "ui_action": None,
        }

    # ── Volume Control ──
    if intent == "set_volume":
        level = _extract_volume_level(raw_text)
        if level is None:
            return {"type": "error", "speech": "I couldn't determine the volume level. Try saying 'set volume to 50'."}
        result = set_volume(level)
        return {"type": "volume", "data": result, "speech": f"Volume set to {level} percent.", "ui_action": None}

    if intent == "volume_up":
        result = adjust_volume_delta(+15)
        new_level = result.get("volume", 65)
        return {"type": "volume", "data": result, "speech": f"Volume increased to {new_level} percent.", "ui_action": None}

    if intent == "volume_down":
        result = adjust_volume_delta(-15)
        new_level = result.get("volume", 35)
        return {"type": "volume", "data": result, "speech": f"Volume decreased to {new_level} percent.", "ui_action": None}

    if intent == "mute_volume":
        result = mute_volume()
        return {"type": "volume", "data": result, "speech": "System audio muted.", "ui_action": None}

    if intent == "unmute_volume":
        result = unmute_volume()
        return {"type": "volume", "data": result, "speech": "System audio unmuted.", "ui_action": None}

    # ── Window Control & Snapping (Phase 5) ──
    if intent == "minimize_window":
        target = _extract_app_name(raw_text) if "minimize window" not in raw_text.lower() else None
        res = minimize_window(target)
        speech = res.get("message", "Window minimized.")
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "maximize_window":
        target = _extract_app_name(raw_text) if "maximize window" not in raw_text.lower() else None
        res = maximize_window(target)
        speech = res.get("message", "Window maximized.")
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "restore_window":
        res = restore_window()
        speech = res.get("message", "Window restored.")
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "close_active_window":
        res = close_window()
        speech = res.get("message", "Closed active window.")
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "snap_window_left":
        res = snap_window("left")
        speech = res.get("message", "Snapped window to the left.")
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "snap_window_right":
        res = snap_window("right")
        speech = res.get("message", "Snapped window to the right.")
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "snap_window_top":
        res = snap_window("top")
        speech = res.get("message", "Snapped window to the top.")
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "snap_window_bottom":
        res = snap_window("bottom")
        speech = res.get("message", "Snapped window to the bottom.")
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "show_desktop":
        res = show_desktop()
        speech = "Showing your desktop now."
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "switch_desktop_next":
        res = switch_virtual_desktop("next")
        speech = "Switched to next virtual desktop."
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "switch_desktop_prev":
        res = switch_virtual_desktop("prev")
        speech = "Switched to previous virtual desktop."
        return {"type": "window_control", "data": res, "speech": speech, "ui_action": None}

    if intent == "list_open_windows":
        windows = list_open_windows()
        count = len(windows)
        names = [w["title"][:25] for w in windows[:4]]
        speech = f"You have {count} active windows, including {', '.join(names)}." if names else "No active desktop windows detected."
        return {"type": "list_windows", "data": {"windows": windows, "count": count}, "speech": speech, "ui_action": None}

    # ── Filesystem & Document Intelligence (Phase 6) ──
    if intent == "search_files":
        args = _extract_file_args(intent, raw_text)
        query = args.get("query", "").strip()
        res = search_files(query)
        speech = f"Found {res.get('count', 0)} files matching {query}." if res.get('success') else res.get('error', 'Search failed.')
        return {"type": "file_control", "data": res, "speech": speech, "ui_action": None}
        
    if intent == "read_document":
        args = _extract_file_args(intent, raw_text)
        file_path = args.get("file", "").strip()
        res = read_document(file_path)
        speech = f"Read document {file_path}." if res.get('success') else res.get('error', 'Read failed.')
        return {"type": "file_control", "data": res, "speech": speech, "ui_action": None}
        
    if intent == "create_folder":
        args = _extract_file_args(intent, raw_text)
        folder = args.get("folder", "").strip()
        res = create_folder(folder)
        speech = res.get("message", f"Created folder {folder}.") if res.get('success') else res.get('error', 'Create folder failed.')
        return {"type": "file_control", "data": res, "speech": speech, "ui_action": None}
        
    if intent == "rename_file":
        args = _extract_file_args(intent, raw_text)
        old = args.get("old", "").strip()
        new = args.get("new", "").strip()
        res = rename_file(old, new)
        speech = res.get("message", f"Renamed to {new}.") if res.get('success') else res.get('error', 'Rename failed.')
        return {"type": "file_control", "data": res, "speech": speech, "ui_action": None}
        
    if intent == "move_file":
        args = _extract_file_args(intent, raw_text)
        src = args.get("src", "").strip()
        dest = args.get("dest", "").strip()
        res = move_file(src, dest)
        speech = res.get("message", f"Moved to {dest}.") if res.get('success') else res.get('error', 'Move failed.')
        return {"type": "file_control", "data": res, "speech": speech, "ui_action": None}

    # ── Web Intelligence & Live Scraping (Phase 7) ──
    if intent == "web_intelligence_search":
        args = _extract_file_args(intent, raw_text)
        query = args.get("query", "").strip()
        res = search_web(query)
        speech = f"I found {res.get('count', 0)} results for {query} on the web." if res.get('success') else res.get('error', 'Search failed.')
        return {"type": "web_intelligence", "data": res, "speech": speech, "ui_action": None}
        
    if intent == "web_intelligence_news":
        args = _extract_file_args(intent, raw_text)
        topic = args.get("topic", "").strip()
        res = get_latest_news(topic)
        speech = f"Here are the latest news articles for {topic or 'today'}." if res.get('success') else res.get('error', 'News fetch failed.')
        return {"type": "web_intelligence", "data": res, "speech": speech, "ui_action": None}
        
    if intent == "web_intelligence_scrape":
        args = _extract_file_args(intent, raw_text)
        url = args.get("url", "").strip()
        res = scrape_webpage(url)
        title = res.get('title', 'the webpage')
        speech = f"I've extracted the content from {title}." if res.get('success') else res.get('error', 'Scrape failed.')
        return {"type": "web_intelligence", "data": res, "speech": speech, "ui_action": None}

    # ── Web Shortcuts & Search ──
    if intent in URL_MAP:
        url = URL_MAP[intent]
        name = intent.replace("open_url_", "").title()
        try:
            webbrowser.open(url)
        except Exception:
            pass
        return {
            "type": "open_url",
            "data": {"url": url},
            "speech": f"Opening {name} for you!",
            "ui_action": {"type": "open_url", "url": url, "label": f"Opening {name}"},
        }

    if intent == "open_url_generic":
        m = re.search(r"(open|launch|go to)\s+(\S+)", raw_text, re.IGNORECASE)
        if m:
            domain = m.group(2)
            url = domain if domain.startswith("http") else f"https://{domain}"
            try:
                webbrowser.open(url)
            except Exception:
                pass
            return {
                "type": "open_url",
                "data": {"url": url},
                "speech": f"Opening {domain} right away!",
                "ui_action": {"type": "open_url", "url": url, "label": f"Opening {domain}"},
            }

    if intent == "search_web":
        query = _extract_search_query(raw_text)
        url = f"https://www.google.com/search?q={query.replace(' ', '+')}"
        try:
            webbrowser.open(url)
        except Exception:
            pass
        return {
            "type": "search_web",
            "data": {"query": query, "url": url},
            "speech": f"Searching Google for {query}.",
            "ui_action": {"type": "open_url", "url": url, "label": f'Searching "{query}"'},
        }

    if intent == "play_music":
        song = _extract_song_query(raw_text)
        url, vid = resolve_youtube_top_video(song)
        try:
            webbrowser.open(url)
        except Exception:
            pass
        return {
            "type": "play_music",
            "data": {"query": song, "url": url, "video_id": vid},
            "speech": f"Playing {song} on YouTube now!",
            "ui_action": {"type": "play_music", "url": url, "query": song, "label": f'Playing "{song}"'},
        }

    return {"type": "unknown", "speech": "I'm not sure how to handle that command yet.", "ui_action": None}


# ── Central Router ─────────────────────────────────────────────────────────────

async def route_command(
    text: str,
    speak_fn: Optional[Callable[[str], None]] = None,
    broadcast_fn: Optional[Callable] = None,
) -> RouterResult:
    """
    The main command routing pipeline.

    Args:
        text         : The user command (voice transcript or text input).
        speak_fn     : Optional callable(text) -> None to speak responses natively.
        broadcast_fn : Optional async callable(dict) -> None for WebSocket events.

    Returns:
        RouterResult with success, speech text, ui_action, and timing.
    """
    start = time.time()

    if not text or not text.strip():
        return RouterResult(success=False, error="Empty command.", speech="I didn't catch that.")

    # ── Step 1: Security Classification ───────────────────────────────────────
    sec = classify(text)
    logger.info(f"[ROUTER] '{text[:60]}' -> tier={sec.tier}")

    if sec.tier == SecurityTier.BLOCKED:
        msg = f"I can't do that. {sec.reason}"
        if speak_fn:
            speak_fn(msg)
        return RouterResult(
            success=False,
            blocked=True,
            security_tier="blocked",
            speech=msg,
            elapsed_ms=int((time.time() - start) * 1000),
        )

    if sec.tier == SecurityTier.RISKY:
        # ── Step 2: Confirmation Loop ──────────────────────────────────────────
        manager = get_confirmation_manager()
        confirmed = await manager.request_confirmation(
            command_label=sec.reason,
            speak_fn=speak_fn,
            broadcast_fn=broadcast_fn,
        )
        if not confirmed:
            msg = "Understood. I've cancelled that action."
            if speak_fn:
                speak_fn(msg)
            return RouterResult(
                success=False,
                needs_confirm=True,
                security_tier="risky",
                speech=msg,
                elapsed_ms=int((time.time() - start) * 1000),
            )

    # ── Step 3: Intent Detection + Tool Execution ──────────────────────────────
    intent = detect_intent(text)
    logger.info(f"[ROUTER] intent={intent}")

    try:
        exec_result = _execute_intent(intent, text)
        speech = exec_result.get("speech", "Done!")
        ui_action = exec_result.get("ui_action")

        if speak_fn and speech:
            speak_fn(speech)

        if broadcast_fn and ui_action:
            await broadcast_fn({"event": "agent_action", "action": ui_action})

        elapsed = int((time.time() - start) * 1000)
        logger.info(f"[ROUTER] Executed intent={intent} in {elapsed}ms")

        return RouterResult(
            success=True,
            intent=intent,
            result=exec_result.get("data", {}),
            speech=speech,
            security_tier=sec.tier.value,
            elapsed_ms=elapsed,
        )

    except Exception as e:
        err_msg = f"Something went wrong while executing your command: {str(e)}"
        logger.error(f"[ROUTER] Execution error for intent={intent}: {e}")
        if speak_fn:
            speak_fn(err_msg)
        return RouterResult(
            success=False,
            intent=intent,
            error=str(e),
            speech=err_msg,
            security_tier=sec.tier.value,
            elapsed_ms=int((time.time() - start) * 1000),
        )

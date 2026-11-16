"""
Cheeni Tools — App & Website Launcher
Launches local desktop applications, with intelligent fallback to web browser
when an app is not installed locally on the user's laptop.
"""

import webbrowser
import subprocess
import os
import sys
import shutil
import glob
import platform
import urllib.parse
import logging
from typing import Optional

logger = logging.getLogger("cheeni.app_launcher")

COMMON_APPS = {
    "chrome": "chrome",
    "google chrome": "chrome",
    "vs code": "code",
    "vscode": "code",
    "code": "code",
    "visual studio code": "code",
    "notepad": "notepad",
    "calculator": "calc",
    "calc": "calc",
    "spotify": "spotify",
    "explorer": "explorer",
    "file manager": "explorer",
    "terminal": "wt",
    "cmd": "cmd",
    "powershell": "powershell",
    "whatsapp": "whatsapp",
    "telegram": "telegram",
    "discord": "discord",
    "slack": "slack",
    "teams": "teams",
    "zoom": "zoom",
    "paint": "mspaint",
    "word": "winword",
    "excel": "excel",
    "powerpoint": "powerpnt",
    "youtube": "youtube",
    "netflix": "netflix",
}

APP_WEB_FALLBACKS = {
    "youtube": "https://www.youtube.com",
    "spotify": "https://open.spotify.com",
    "whatsapp": "https://web.whatsapp.com",
    "telegram": "https://web.telegram.org",
    "discord": "https://discord.com/app",
    "slack": "https://app.slack.com",
    "teams": "https://teams.microsoft.com",
    "zoom": "https://zoom.us",
    "netflix": "https://www.netflix.com",
    "prime video": "https://www.primevideo.com",
    "amazon prime": "https://www.primevideo.com",
    "hotstar": "https://www.hotstar.com",
    "disney": "https://www.hotstar.com",
    "instagram": "https://www.instagram.com",
    "twitter": "https://twitter.com",
    "x": "https://x.com",
    "reddit": "https://www.reddit.com",
    "linkedin": "https://www.linkedin.com",
    "github": "https://github.com",
    "chatgpt": "https://chatgpt.com",
    "figma": "https://www.figma.com",
    "notion": "https://www.notion.so",
    "canva": "https://www.canva.com",
    "gmail": "https://mail.google.com",
    "google": "https://www.google.com",
    "calendar": "https://calendar.google.com",
    "amazon": "https://www.amazon.in",
    "flipkart": "https://www.flipkart.com",
    "huggingface": "https://huggingface.co",
}

COMMON_SITES = APP_WEB_FALLBACKS


def get_installed_app(app_key: str) -> Optional[str]:
    """
    Checks if an app is downloaded / installed locally on the user's laptop.
    Searches:
    1. System PATH via shutil.which (.exe, .cmd, .bat)
    2. Windows Registry App Paths (HKCU & HKLM)
    3. Start Menu Shortcuts (.lnk across ProgramData and User AppData)
    4. Common install folders
    Returns the executable command / path if found locally, otherwise None.
    """
    if not app_key:
        return None
    key = app_key.lower().strip()
    target = COMMON_APPS.get(key, key)

    # 1. System PATH
    w = shutil.which(target)
    if w:
        return w
    for ext in (".exe", ".cmd", ".bat"):
        w = shutil.which(f"{target}{ext}")
        if w:
            return w

    # 2. Windows Registry App Paths
    if platform.system() == "Windows":
        try:
            import winreg
            for root in (winreg.HKEY_CURRENT_USER, winreg.HKEY_LOCAL_MACHINE):
                try:
                    with winreg.OpenKey(root, f"Software\\Microsoft\\Windows\\CurrentVersion\\App Paths\\{target}.exe") as k:
                        val, _ = winreg.QueryValueEx(k, "")
                        clean_val = val.strip('\"')
                        if clean_val and os.path.exists(clean_val):
                            return clean_val
                except Exception:
                    pass
        except Exception:
            pass

        # 3. Start Menu Shortcuts (.lnk)
        roots = [
            os.path.join(os.environ.get("PROGRAMDATA", "C:\\ProgramData"), "Microsoft\\Windows\\Start Menu\\Programs"),
            os.path.join(os.environ.get("APPDATA", ""), "Microsoft\\Windows\\Start Menu\\Programs"),
        ]
        clean_target = target.replace(" ", "")
        for r in roots:
            if os.path.exists(r):
                for f in glob.glob(os.path.join(r, "**", "*.lnk"), recursive=True):
                    base = os.path.splitext(os.path.basename(f))[0].lower().replace(" ", "")
                    if clean_target == base or clean_target in base:
                        return f

    return None


def launch_or_open_web(app_name: str) -> dict:
    """
    Attempts to launch the local application.
    If the app isn't installed locally on the user's laptop, automatically
    falls back to opening its web version in the user's browser.
    """
    clean_app = app_name.lower().strip()

    # Identify matching key
    target_key = clean_app
    for k in sorted(COMMON_APPS.keys(), key=len, reverse=True):
        if k in clean_app:
            target_key = k
            break
    for k in sorted(APP_WEB_FALLBACKS.keys(), key=len, reverse=True):
        if k in clean_app:
            target_key = k
            break

    app_display = target_key.title()
    if target_key in ("vscode", "vs code", "code"):
        app_display = "VS Code"
    elif target_key == "youtube":
        app_display = "YouTube"
    elif target_key == "whatsapp":
        app_display = "WhatsApp"
    elif target_key == "chatgpt":
        app_display = "ChatGPT"

    # 1. Check if the app is installed locally
    local_path = get_installed_app(target_key)
    if local_path:
        try:
            if platform.system() == "Windows":
                os.system(f'start "" "{local_path}"')
            else:
                subprocess.Popen([local_path])
            return {
                "reply": f"Launched {app_display} for you, Boss.",
                "action_taken": "launch_app",
                "data": {"app": target_key, "path": local_path}
            }
        except Exception as e:
            logger.warning(f"Could not launch local {local_path}: {e}")

    # 2. Not installed locally -> Fallback to web browser!
    web_url = APP_WEB_FALLBACKS.get(target_key)
    if not web_url:
        web_url = f"https://www.{target_key.replace(' ', '')}.com"

    webbrowser.open(web_url)
    return {
        "reply": f"{app_display} isn't installed locally on your laptop, Wraith, so I've opened {app_display} in your browser for you, Boss!",
        "action_taken": "open_website",
        "data": {"app": target_key, "url": web_url, "fallback": True}
    }


def get_first_youtube_video_url(query: str) -> str:
    """
    Resolves the direct watch URL for the 1st search result on YouTube
    so the video opens and starts playing immediately.

    Strategy (fastest first, robust fallback):
    1. YouTube Innertube API  (internal JSON API — no scraping, low bot-detection)
    2. httpx HTML scrape      (browser headers, parses videoId from page HTML)
    3. yt-dlp subprocess      (ytsearch1, uses system certs)
    4. yt-dlp Python API      (nocheckcertificate)
    5. Graceful fallback      (search results page — user clicks first result)
    """
    import re
    import json
    import urllib.request
    import urllib.parse

    clean_query = query.strip()
    if not clean_query:
        return "https://www.youtube.com"

    search_url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(clean_query)}"

    # ── Strategy 1: YouTube Innertube API (internal, no scraping needed) ──────
    # This is the same API the YouTube web app uses — far more reliable than scraping.
    try:
        payload = json.dumps({
            "query": clean_query,
            "context": {
                "client": {
                    "clientName": "WEB",
                    "clientVersion": "2.20231121.08.00",
                    "hl": "en",
                    "gl": "IN",
                }
            }
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://www.youtube.com/youtubei/v1/search"
            "?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) "
                              "Chrome/120.0.0.0 Safari/537.36",
                "X-YouTube-Client-Name": "1",
                "X-YouTube-Client-Version": "2.20231121.08.00",
                "Origin": "https://www.youtube.com",
                "Referer": "https://www.youtube.com/",
            },
        )
        resp = urllib.request.urlopen(req, timeout=5)
        data = json.loads(resp.read().decode("utf-8"))

        # Walk the response tree to find the first videoRenderer
        contents = (
            data.get("contents", {})
            .get("twoColumnSearchResultsRenderer", {})
            .get("primaryContents", {})
            .get("sectionListRenderer", {})
            .get("contents", [])
        )
        for section in contents:
            items = section.get("itemSectionRenderer", {}).get("contents", [])
            for item in items:
                vid = item.get("videoRenderer", {}).get("videoId", "")
                if vid and len(vid) == 11:
                    logger.info(f"Innertube: found video {vid} for '{clean_query}'")
                    return f"https://www.youtube.com/watch?v={vid}&autoplay=1"
    except Exception as e:
        logger.debug(f"Innertube API: {e}")

    # ── Strategy 2: httpx HTML scrape with real browser headers ──────────────
    try:
        import httpx
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Referer": "https://www.youtube.com/",
            "DNT": "1",
        }
        resp = httpx.get(search_url, headers=headers, follow_redirects=True, timeout=4.0, verify=False)
        if resp.status_code == 200:
            html = resp.text
            video_ids = re.findall(r'"videoId":"([a-zA-Z0-9_-]{11})"', html)
            if not video_ids:
                video_ids = re.findall(r'/watch\?v=([a-zA-Z0-9_-]{11})', html)
            seen: dict = {}
            unique = [v for v in video_ids if not seen.get(v) and not seen.update({v: True})]
            if unique:
                logger.info(f"httpx scrape: found {unique[0]} for '{clean_query}'")
                return f"https://www.youtube.com/watch?v={unique[0]}&autoplay=1"
    except Exception as e:
        logger.debug(f"httpx YouTube scrape: {e}")

    # ── Strategy 3: yt-dlp subprocess ────────────────────────────────────────
    try:
        import subprocess
        result = subprocess.run(
            ["yt-dlp", "--no-playlist", "--flat-playlist", "--print", "id",
             "--no-warnings", "--quiet", f"ytsearch1:{clean_query}"],
            capture_output=True, text=True, timeout=6
        )
        video_id = result.stdout.strip().split("\n")[0].strip()
        if video_id and len(video_id) == 11:
            logger.info(f"yt-dlp subprocess: found {video_id} for '{clean_query}'")
            return f"https://www.youtube.com/watch?v={video_id}&autoplay=1"
    except Exception as e:
        logger.debug(f"yt-dlp subprocess: {e}")

    # ── Strategy 4: yt-dlp Python API ────────────────────────────────────────
    try:
        import yt_dlp
        ydl_opts = {
            "extract_flat": True,
            "quiet": True,
            "skip_download": True,
            "no_warnings": True,
            "socket_timeout": 4,
            "nocheckcertificate": True,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            res = ydl.extract_info(f"ytsearch1:{clean_query}", download=False)
            if res and "entries" in res and res["entries"]:
                first_id = res["entries"][0].get("id", "")
                if first_id:
                    logger.info(f"yt-dlp API: found {first_id} for '{clean_query}'")
                    return f"https://www.youtube.com/watch?v={first_id}&autoplay=1"
    except Exception as e:
        logger.debug(f"yt-dlp Python API: {e}")

    # ── Strategy 5: Graceful fallback ────────────────────────────────────────
    logger.warning(f"All autoplay strategies failed for '{query}' — opening search page")
    return search_url


async def handle(intent: str, text: str) -> dict:
    clean_text = text.lower().strip()

    # ── 1. YouTube & Music Playback ───────────────────────────────────────────
    is_music_intent = intent in (
        "search_youtube", "play_music", "play_radio",
        "play_podcasts", "play_audiobook", "music_query"
    )
    has_youtube = "youtube" in clean_text
    has_play = "play" in clean_text or "chalao" in clean_text or "bajao" in clean_text
    has_music_kw = any(w in clean_text for w in ["song", "music", "video", "track", "audio", "gana", "gaana", "danda"])

    # If it's a Spotify-specific request
    if "spotify" in clean_text:
        if has_play or is_music_intent:
            query = re_extract_query(clean_text, ["play on spotify", "play in spotify", "play spotify", "play song of", "play song", "play"])
            query = query.replace("on spotify", "").replace("in spotify", "").strip(" '\"?.")
            url = f"https://open.spotify.com/search/{urllib.parse.quote(query)}" if query else "https://open.spotify.com"
            webbrowser.open(url)
            return {
                "reply": f"Searching Spotify for '{query}'." if query else "Opening Spotify.",
                "action_taken": "open_website",
                "data": {"query": query, "url": url}
            }
        # Generic Spotify launch -> check if downloaded locally, otherwise open web player
        return launch_or_open_web("spotify")

    # YouTube playback / video / song search
    if is_music_intent or has_youtube or (has_play and (has_music_kw or len(clean_text.split()) > 2)):
        prefixes = [
            "could you please open youtube and play song of",
            "could you please open youtube and play",
            "could you please open youtube and",
            "could you please open youtube",
            "can you please open youtube and play",
            "can you please open youtube and",
            "can you please open youtube",
            "please open youtube and play song of",
            "please open youtube and play",
            "please open youtube and",
            "please open youtube",
            "open youtube and play song of",
            "open youtube and play",
            "open youtube play",
            "open youtube and",
            "open youtube app",
            "open youtube",
            "launch youtube",
            "start youtube",
            "khol youtube",
            "search youtube for",
            "search youtube",
            "play song of",
            "play the song of",
            "play song",
            "play track",
            "play music",
            "play video",
            "play",
            "chalao",
            "bajao",
        ]
        query = re_extract_query(clean_text, prefixes)
        query = query.replace("on youtube", "").replace("in youtube", "").replace("from youtube", "").strip(" '\"?.")

        # Just opening YouTube without a search query -> check local app or open in browser
        is_just_open = not any(w in clean_text for w in ["play", "song", "video", "track", "search", "chalao", "bajao", "watch"])
        if is_just_open or not query or query in ("youtube", "song", "music", "video", "open", "khol", "app", "open youtube", "launch youtube"):
            return launch_or_open_web("youtube")

        # Specific video / song search on YouTube -> resolve direct video link so it autoplays
        import asyncio
        url = await asyncio.to_thread(get_first_youtube_video_url, query)
        webbrowser.open(url)
        return {
            "reply": f"Playing '{query}' on YouTube.",
            "action_taken": "search_youtube",
            "data": {"query": query, "url": url}
        }

    # ── 2. Web Search (Google) ────────────────────────────────────────────────
    if intent == "search_web" or "search" in clean_text or "google" in clean_text:
        query = re_extract_query(clean_text, ["search google for", "search for", "google for", "google", "search"])
        query = query.replace("on google", "").strip(" '\"?.")
        url = f"https://www.google.com/search?q={urllib.parse.quote(query)}"
        webbrowser.open(url)
        return {"reply": f"Searching Google for '{query}'", "action_taken": "search_web", "data": {"query": query, "url": url}}

    # ── 3. App Launch & Website Open (with intelligent local vs web fallback) ──
    if intent in ("website_open", "app_launch") or any(k in clean_text for k in ["open ", "launch ", "start ", "khol"]):
        # Extract target app name
        words = clean_text
        for prefix in ["could you please open", "can you please open", "please open", "open", "launch", "start", "khol", "chalao"]:
            if prefix in words:
                words = words.replace(prefix, "", 1).strip()
                break
        words = words.strip(" '\"?.")

        if words:
            return launch_or_open_web(words)

    # Default fallback
    words = clean_text.replace("open", "").replace("launch", "").replace("start", "").replace("khol", "").replace("chalao", "").strip()
    return launch_or_open_web(words if words else "browser")


def re_extract_query(text: str, prefixes: list[str]) -> str:
    res = text
    # Sort prefixes by length descending so longest matches first
    for p in sorted(prefixes, key=len, reverse=True):
        if p in res:
            res = res.split(p, 1)[1]
            break
    # Clean common polite prefixes and trailing punctuation
    for filler in ["could you please", "can you please", "please", "kindly", "hey cheeni", "cheeni"]:
        res = res.replace(filler, "")
    return res.strip(" '\"?.")


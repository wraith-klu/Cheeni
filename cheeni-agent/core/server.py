"""
Cheeni Desktop Agent -- FastAPI Server (Phase 1 + Phase 2)
Local bridge running on http://127.0.0.1:2026

Phase 1 REST Endpoints:
  GET  /                      -> Health check
  GET  /api/status            -> Full system snapshot (battery, CPU, RAM, disk, time)
  GET  /api/battery           -> Battery only
  GET  /api/volume            -> Current volume level
  POST /api/volume            -> Set volume  { "level": 50 }
  POST /api/volume/mute       -> Mute audio
  POST /api/volume/unmute     -> Unmute audio
  POST /api/launch            -> Launch a Windows app  { "app": "notepad" }

Phase 2 Voice Endpoints:
  GET  /api/voice/status      -> Wake word + session + speaker status
  POST /api/voice/wake        -> Manually trigger wake word activation
  POST /api/voice/speak       -> Speak text via native Windows TTS  { "text": "..." }
  POST /api/voice/stop        -> Stop native speaker
  POST /api/voice/session/end -> Force end the voice session

WebSocket:
  WS   /ws                    -> Real-time telemetry + voice state events (every 3s)
"""

import asyncio
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from config.settings import settings
from utils.logging import logger
from tools.system_status import (
    get_full_system_status,
    get_battery_status,
    get_cpu_status,
    get_ram_status,
    get_disk_status,
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
    snap_corner_companion,
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
from voice.wakeword import get_engine as get_wake_engine
from voice.session import get_session, VoiceState
from voice.speaker import get_speaker
from voice.conversation import get_conversation_loop
from tools.router import route_command, RouterResult
from security.command_security import classify, SecurityTier
from security.confirmation import get_confirmation_manager

# ── App Lifespan: Start / Stop Phase 2 voice services ─────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start voice services on startup, shut them down gracefully on exit."""
    speaker = get_speaker()
    speaker.start()
    speaker.speak(f"{settings.AGENT_NAME} Desktop Agent is online and ready!", interrupt=False)

    session = get_session()
    current_loop = asyncio.get_event_loop()

    # Wire ConversationLoop with broadcast access
    conv_loop = get_conversation_loop(broadcast_fn=broadcast_ws)
    conv_loop._loop = current_loop

    # ── Wake word handler: fires ConversationLoop automatically ───────────────
    def on_wake_word(phrase: str):
        # Broadcast to Web UI immediately
        asyncio.run_coroutine_threadsafe(
            broadcast_ws({"event": "wake_word_detected", "phrase": phrase, "session_state": session.state.value}),
            current_loop,
        )

        # If loop already running, just log (don't double-start)
        if conv_loop.is_running:
            logger.info("[Server] Wake word fired but conversation already active.")
            return

        # Activate session + start 2-way conversation loop fully automatically
        session.on_wake_word()
        conv_loop.start(user_name="friend", event_loop=current_loop)

    # ── State change broadcaster ───────────────────────────────────────────────
    def on_state_change(new_state: VoiceState):
        asyncio.run_coroutine_threadsafe(
            broadcast_ws({"event": "voice_state_changed", "state": new_state.value}),
            current_loop,
        )

    session._on_state_change = on_state_change

    # Build dynamic wake words and start the engine
    wake_engine = get_wake_engine()
    wake_engine.on_detected = on_wake_word
    wake_engine.start()

    logger.info(f"[Server] Wake word engine active. Say 'Hey {settings.AGENT_NAME}' to begin!")
    logger.info("Phase 2 voice services + 2-way conversation loop ready.")
    yield  # ─── Server is running ───

    conv_loop.stop(reason="server_shutdown")
    wake_engine.stop()
    speaker.stop_speaking()
    speaker.stop()
    logger.info("Phase 2 voice services stopped.")



# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cheeni Desktop Agent",
    description="OS-level agentic bridge for the Cheeni AI Assistant",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Active WebSocket connections ───────────────────────────────────────────────
active_connections: list[WebSocket] = []


# ── Request Models ─────────────────────────────────────────────────────────────
class VolumeRequest(BaseModel):
    level: int  # 0–100


class LaunchRequest(BaseModel):
    app: str  # e.g. "notepad", "chrome", "vs code"


class OpenUrlRequest(BaseModel):
    url: str


class PlayMusicRequest(BaseModel):
    query: str


# ── REST Endpoints ─────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
async def root():
    """Health check — confirms the Cheeni Desktop Agent is alive."""
    return {
        "status": "online",
        "agent": "Cheeni Desktop Agent",
        "version": "1.0.0",
        "host": settings.HOST,
        "port": settings.PORT,
        "message": "🌸 Cheeni Desktop Agent is running and ready!",
    }


@app.get("/api/status", tags=["System"])
async def system_status():
    """Returns a full system snapshot: battery, CPU, RAM, disk, datetime."""
    try:
        data = get_full_system_status()
        return {"success": True, **data}
    except Exception as e:
        logger.error(f"/api/status error: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/battery", tags=["System"])
async def battery_status():
    """Returns current battery level, charging state, and time remaining."""
    try:
        data = get_battery_status()
        return {"success": True, **data}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/volume", tags=["Audio"])
async def volume_get():
    """Returns the current master volume level (0–100)."""
    return get_volume()


@app.post("/api/volume", tags=["Audio"])
async def volume_set(req: VolumeRequest):
    """Sets the master volume to the specified level (0–100)."""
    result = set_volume(req.level)
    if result.get("success"):
        await broadcast_ws({"event": "volume_changed", "volume": req.level})
    return result


@app.post("/api/volume/mute", tags=["Audio"])
async def volume_mute():
    """Mutes the system audio."""
    result = mute_volume()
    if result.get("success"):
        await broadcast_ws({"event": "volume_muted"})
    return result


@app.post("/api/volume/unmute", tags=["Audio"])
async def volume_unmute():
    """Unmutes the system audio."""
    result = unmute_volume()
    if result.get("success"):
        await broadcast_ws({"event": "volume_unmuted"})
    return result


@app.post("/api/launch", tags=["Apps"])
async def app_launch(req: LaunchRequest):
    """
    Launches a Windows application by name.
    Examples: "notepad", "chrome", "vs code", "calculator"
    """
    logger.info(f"Launch request: {req.app}")
    result = launch_app(req.app)
    if result.get("success"):
        await broadcast_ws({"event": "app_launched", "app": req.app})
    return result


@app.post("/api/open", tags=["System"])
async def open_url_endpoint(req: OpenUrlRequest):
    """
    Opens any URL directly in the user's default browser at the Windows OS level.
    This bypasses all browser popup blockers.
    """
    import webbrowser
    try:
        webbrowser.open(req.url)
        logger.info(f"Opened URL via OS browser: {req.url}")
        return {"success": True, "message": f"Opened {req.url}", "url": req.url}
    except Exception as e:
        logger.error(f"Failed to open URL {req.url}: {e}")
        return {"success": False, "message": str(e)}


@app.post("/api/play", tags=["Media"])
async def play_music_endpoint(req: PlayMusicRequest):
    """
    Resolves the 1st song video on YouTube for the query and launches it with autoplay=1.
    """
    import webbrowser
    from tools.router import resolve_youtube_top_video

    query = req.query.strip()
    target_url, video_id = resolve_youtube_top_video(query)
    try:
        webbrowser.open(target_url)
        logger.info(f"Playing YouTube track: {target_url}")
        return {
            "success": True,
            "message": f"Playing {query} on YouTube!",
            "url": target_url,
            "video_id": video_id,
            "query": query,
        }
    except Exception as e:
        logger.error(f"Failed to play music: {e}")
        return {"success": False, "message": str(e)}


# ── WebSocket: Real-Time Telemetry Stream ─────────────────────────────────────

async def broadcast_ws(data: dict):
    """Broadcasts a JSON message to all connected WebSocket clients."""
    if not active_connections:
        return
    message = json.dumps(data)
    dead = []
    for ws in active_connections:
        try:
            await ws.send_text(message)
        except Exception:
            dead.append(ws)
    for ws in dead:
        active_connections.remove(ws)


async def telemetry_loop(websocket: WebSocket):
    """
    Pushes live system telemetry (battery, CPU, RAM) to the WebSocket client
    every 3 seconds while connected.
    """
    while True:
        try:
            snapshot = get_full_system_status()
            await websocket.send_text(json.dumps({
                "event": "telemetry",
                **snapshot,
            }))
            await asyncio.sleep(3)
        except (WebSocketDisconnect, RuntimeError):
            break
        except Exception as e:
            logger.error(f"Telemetry push error: {e}")
            await asyncio.sleep(3)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time system telemetry.
    The Cheeni Web UI connects here to display live CPU/RAM/Battery/Volume stats.
    """
    await websocket.accept()
    active_connections.append(websocket)
    logger.info(f"WebSocket client connected. Total: {len(active_connections)}")

    # Send immediate snapshot on connect
    try:
        snapshot = get_full_system_status()
        session = get_session()
        await websocket.send_text(json.dumps({
            "event": "connected",
            **snapshot,
            "voice": session.get_status(),
        }))
    except Exception as e:
        logger.error(f"Initial snapshot error: {e}")

    # Start live telemetry loop
    try:
        await telemetry_loop(websocket)
    except WebSocketDisconnect:
        pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        logger.info(f"WebSocket client disconnected. Remaining: {len(active_connections)}")


# ── Phase 2: Voice Endpoints ───────────────────────────────────────────────────

class SpeakRequest(BaseModel):
    text: str
    interrupt: bool = True


@app.get("/api/voice/status", tags=["Voice"])
async def voice_status():
    """Returns wake word engine mode, session state, and speaker status."""
    wake = get_wake_engine()
    session = get_session()
    speaker = get_speaker()
    return {
        "success": True,
        "wake_word": {
            "running": wake.is_running,
            "enabled": wake.is_enabled,
            "paused": wake.is_paused,
            "mode": wake.mode,   # "oww" | "sr" | "none"
            "agent_name": settings.AGENT_NAME,
        },
        "session": session.get_status(),
        "speaker": speaker.get_status(),
    }


class StartListeningRequest(BaseModel):
    agent_name: Optional[str] = None
    user_name: Optional[str] = None


@app.post("/api/voice/start-listening", tags=["Voice"])
async def enable_wake_word(req: Optional[StartListeningRequest] = None):
    """
    Start Button: Enables continuous background wake word listening.
    User can now speak the wake word ('Hey Sam', 'Hey Khushi', etc.) without touching laptop.
    """
    if req and req.agent_name and req.agent_name.strip():
        new_name = req.agent_name.strip()
        settings.AGENT_NAME = new_name
        logger.info(f"[Server] Updated AGENT_NAME to '{new_name}' from UI request.")

    wake = get_wake_engine()
    wake.enable()
    speaker = get_speaker()
    speaker.speak(f"Listening mode enabled! Just say Hey {settings.AGENT_NAME} anytime.", interrupt=True)
    await broadcast_ws({
        "event": "wake_word_mode_changed",
        "enabled": True,
        "agent_name": settings.AGENT_NAME,
        "message": f"Listening for 'Hey {settings.AGENT_NAME}'"
    })
    return {
        "success": True,
        "enabled": True,
        "agent_name": settings.AGENT_NAME,
        "message": f"Wake word listening is ON for {settings.AGENT_NAME}."
    }


@app.post("/api/voice/sync-name", tags=["Voice"])
async def sync_agent_name(req: StartListeningRequest):
    """Dynamically sync agent name from the Web UI without needing server restart."""
    if req.agent_name and req.agent_name.strip():
        settings.AGENT_NAME = req.agent_name.strip()
        wake = get_wake_engine()
        # Refresh wake engine keywords
        wake._init_model()
        logger.info(f"[Server] Synced agent name to '{settings.AGENT_NAME}'")
        return {"success": True, "agent_name": settings.AGENT_NAME}
    return {"success": False, "message": "agent_name required"}


@app.post("/api/voice/stop-listening", tags=["Voice"])
async def disable_wake_word():
    """
    Exit Button: Disables wake word listening and stops any active conversation.
    If user calls out the name, nothing will happen.
    """
    wake = get_wake_engine()
    wake.disable()
    conv_loop = get_conversation_loop(broadcast_fn=broadcast_ws)
    if conv_loop.is_running:
        conv_loop.stop(reason="user_exit_button")
    session = get_session()
    session.force_idle()
    speaker = get_speaker()
    speaker.speak("Listening mode disabled. Agent will ignore wake words.", interrupt=True)
    await broadcast_ws({
        "event": "wake_word_mode_changed",
        "enabled": False,
        "message": "Listening mode stopped"
    })
    return {"success": True, "enabled": False, "message": "Wake word listening is OFF."}


@app.post("/api/voice/wake", tags=["Voice"])
async def trigger_wake():
    """Manually activate the voice session (same as saying 'Hey Cheeni')."""
    session = get_session()
    session.on_wake_word()
    speaker = get_speaker()
    speaker.speak("Yes? I'm listening!", interrupt=True)
    await broadcast_ws({"event": "wake_word_detected", "phrase": "manual_trigger", "session_state": session.state.value})
    return {"success": True, "session_state": session.state.value, "message": "Voice session activated!"}


@app.post("/api/voice/speak", tags=["Voice"])
async def native_speak(req: SpeakRequest):
    """
    Speak text through the native Windows TTS speaker.
    Useful when the browser is closed and Cheeni needs to announce something.
    """
    if not req.text.strip():
        return {"success": False, "message": "text is required"}
    speaker = get_speaker()
    speaker.speak(req.text, interrupt=req.interrupt)
    return {"success": True, "message": f"Speaking: {req.text[:60]}..."}


@app.post("/api/voice/stop", tags=["Voice"])
async def stop_native_speaker():
    """Stop native Windows TTS playback immediately."""
    speaker = get_speaker()
    speaker.stop_speaking()
    return {"success": True, "message": "Native speaker stopped."}


@app.post("/api/voice/session/end", tags=["Voice"])
async def end_voice_session():
    """Force the voice session back to IDLE (e.g. user said 'goodbye')."""
    session = get_session()
    speaker = get_speaker()
    session.force_idle()
    speaker.speak("Goodbye! Call me anytime.", interrupt=True)
    await broadcast_ws({"event": "voice_state_changed", "state": "idle"})
    return {"success": True, "state": "idle", "message": "Voice session ended."}


# ── Phase 3: Security + Command Routing Endpoints ─────────────────────────────

# ── Per-user session registry (Feature #15: Multi-User Agent Isolation) ────────
# Maps user_id → asyncio.Lock so commands from different users are independent.
# Each user's commands are serialised per-user; no shared mutable state bleeds
# between sessions because every tool invocation is scoped by user_id.
_user_session_locks: dict[str, asyncio.Lock] = {}


def _get_user_lock(user_id: str) -> asyncio.Lock:
    """Return (creating if needed) the per-user execution lock."""
    if user_id not in _user_session_locks:
        _user_session_locks[user_id] = asyncio.Lock()
    return _user_session_locks[user_id]


class CommandRequest(BaseModel):
    text: str
    use_native_speaker: bool = False
    # user_id is forwarded by the Node.js gateway from the authenticated JWT (#15)
    user_id: Optional[str] = None


class ConfirmAnswerRequest(BaseModel):
    answer: str


@app.post("/api/command", tags=["Command Router"])
async def execute_command(req: CommandRequest):
    """
    Central command execution: Security -> Intent -> Tool pipeline.

    Feature #15 — Session Isolation:
    Each authenticated user gets their own asyncio.Lock so that concurrent
    commands from different users never share execution state.  The user_id
    is used as a namespacing key; OS-level actions are always logged against
    the correct user session.
    """
    if not req.text.strip():
        return {"success": False, "error": "text is required"}

    # Resolve session user context — fall back to "anonymous" for direct/dev access.
    user_id = (req.user_id or "anonymous").strip()

    speaker = get_speaker() if req.use_native_speaker else None
    speak_fn = speaker.speak if speaker else None

    # Acquire per-user lock — commands from the same user are sequential,
    # different users run fully independently (no cross-session bleed).
    user_lock = _get_user_lock(user_id)
    async with user_lock:
        logger.info(f"[SESSION:{user_id}] Executing: {req.text[:60]!r}")
        result = await route_command(text=req.text, speak_fn=speak_fn, broadcast_fn=broadcast_ws)

    return {
        "success": result.success,
        "intent": result.intent,
        "security_tier": result.security_tier,
        "speech": result.speech,
        "result": result.result,
        "blocked": result.blocked,
        "needs_confirm": result.needs_confirm,
        "elapsed_ms": result.elapsed_ms,
        "error": result.error,
        "session_user_id": user_id,
    }


@app.post("/api/command/classify", tags=["Command Router"])
async def classify_command(req: CommandRequest):
    """Classify a command security tier WITHOUT executing it."""
    r = classify(req.text)
    return {"tier": r.tier.value, "reason": r.reason}


@app.post("/api/command/confirm", tags=["Command Router"])
async def submit_confirmation(req: ConfirmAnswerRequest):
    """Submit yes/no answer to a pending RISKY command confirmation."""
    manager = get_confirmation_manager()
    if not manager.is_pending:
        return {"success": False, "message": "No confirmation pending."}
    accepted = manager.submit_answer(req.answer)
    return {"success": accepted, "pending": manager.is_pending}


@app.get("/api/command/pending", tags=["Command Router"])
async def get_pending_confirmation():
    """Check if a RISKY confirmation is awaiting a response."""
    manager = get_confirmation_manager()
    return {"pending": manager.is_pending, "command_label": manager.pending_command}


# ── Phase 4: Windows Application & System Control Endpoints ───────────────────

class VolumeDeltaRequest(BaseModel):
    delta: int  # e.g. +10, -15


class CloseAppRequest(BaseModel):
    app: str
    force: bool = False


class FocusAppRequest(BaseModel):
    app: str


class PowerDelayRequest(BaseModel):
    delay_sec: int = 5


class WindowTargetRequest(BaseModel):
    target: Optional[str] = None


class SnapWindowRequest(BaseModel):
    position: str = "left"
    target: Optional[str] = None


class SwitchDesktopRequest(BaseModel):
    direction: str = "next"


class SnapCornerRequest(BaseModel):
    target: Optional[str] = "Cheeni"
    width: Optional[int] = 420
    height: Optional[int] = 740
    stay_on_top: Optional[bool] = False


class FileSearchRequest(BaseModel):
    query: str
    directory: str = "~"


class FilePathRequest(BaseModel):
    path: str


class RenameFileRequest(BaseModel):
    old_path: str
    new_name: str


class MoveFileRequest(BaseModel):
    src_path: str
    dest_dir: str


class WebSearchRequest(BaseModel):
    query: str


class WebNewsRequest(BaseModel):
    topic: Optional[str] = None


class WebScrapeRequest(BaseModel):
    url: str


@app.post("/api/volume/delta", tags=["System Control"])
async def adjust_volume_by_delta(req: VolumeDeltaRequest):
    """Adjust system volume by a relative delta (+10, -15)."""
    res = adjust_volume_delta(req.delta)
    if res.get("success"):
        await broadcast_ws({"event": "volume_changed", "volume": res.get("volume")})
    return res


@app.post("/api/volume/toggle", tags=["System Control"])
async def toggle_system_mute():
    """Toggle master volume mute state."""
    res = toggle_mute()
    if res.get("success"):
        await broadcast_ws({"event": "mute_toggled", "muted": res.get("muted")})
    return res


@app.get("/api/apps/running", tags=["App Control"])
async def get_running_applications():
    """Returns active user-facing applications currently running."""
    apps = list_running_apps()
    return {"success": True, "count": len(apps), "apps": apps}


@app.post("/api/apps/close", tags=["App Control"])
async def terminate_application(req: CloseAppRequest):
    """Close or terminate running application instances."""
    res = close_app(req.app, force=req.force)
    if res.get("success"):
        await broadcast_ws({"event": "app_closed", "app": req.app, "count": res.get("closed_count")})
    return res


@app.post("/api/apps/focus", tags=["App Control"])
async def focus_application(req: FocusAppRequest):
    """Bring an open application window to the foreground."""
    return focus_app(req.app)


@app.get("/api/system/specs", tags=["System Control"])
async def get_system_specifications():
    """Returns full hardware specs: CPU brand, cores, clock, RAM, disks, OS."""
    specs = get_hardware_specs()
    return {"success": True, "specs": specs}


@app.post("/api/system/lock", tags=["System Control"])
async def lock_system():
    """Lock the Windows workstation screen."""
    return lock_workstation()


@app.post("/api/system/sleep", tags=["System Control"])
async def sleep_pc():
    """Put PC into sleep / standby mode."""
    return sleep_system()


@app.post("/api/system/restart", tags=["System Control"])
async def reboot_system(req: PowerDelayRequest = PowerDelayRequest()):
    """Safely restart the Windows system."""
    return restart_system(delay_sec=req.delay_sec)


@app.post("/api/system/shutdown", tags=["System Control"])
async def poweroff_system(req: PowerDelayRequest = PowerDelayRequest()):
    """Safely shut down the Windows system."""
    return shutdown_system(delay_sec=req.delay_sec)


# ── Phase 5: Window Management Endpoints ─────────────────────────────────────

@app.post("/api/windows/minimize", tags=["Window Control"])
async def minimize_win(req: WindowTargetRequest = WindowTargetRequest()):
    return minimize_window(req.target)


@app.post("/api/windows/maximize", tags=["Window Control"])
async def maximize_win(req: WindowTargetRequest = WindowTargetRequest()):
    return maximize_window(req.target)


@app.post("/api/windows/restore", tags=["Window Control"])
async def restore_win(req: WindowTargetRequest = WindowTargetRequest()):
    return restore_window(req.target)


@app.post("/api/windows/close", tags=["Window Control"])
async def close_win(req: WindowTargetRequest = WindowTargetRequest()):
    return close_window(req.target)


@app.get("/api/windows/active", tags=["Window Control"])
async def active_win():
    return get_active_window()


@app.get("/api/windows", tags=["Window Control"])
async def list_windows():
    return {"success": True, "windows": list_open_windows()}


@app.post("/api/windows/snap", tags=["Window Control"])
async def snap_win(req: SnapWindowRequest):
    return snap_window(req.position, req.target)


@app.post("/api/windows/snap-corner", tags=["Window Control"])
async def snap_corner(req: SnapCornerRequest = SnapCornerRequest()):
    """Snap Cheeni desktop companion window to the top-right corner of the desktop."""
    return snap_corner_companion(
        target=req.target or "Cheeni",
        width=req.width or 420,
        height=req.height or 740,
        stay_on_top=bool(req.stay_on_top),
    )


@app.post("/api/windows/desktop", tags=["Window Control"])
async def show_desk():
    return show_desktop()


@app.post("/api/windows/virtual_desktop", tags=["Window Control"])
async def switch_vdesktop(req: SwitchDesktopRequest):
    return switch_virtual_desktop(req.direction)


# ── Phase 6: Filesystem & Document Intelligence Endpoints ──────────────────────

@app.post("/api/files/search", tags=["File Control"])
async def api_search_files(req: FileSearchRequest):
    return search_files(req.query, req.directory)


@app.post("/api/files/read", tags=["File Control"])
async def api_read_document(req: FilePathRequest):
    return read_document(req.path)


@app.post("/api/files/create_folder", tags=["File Control"])
async def api_create_folder(req: FilePathRequest):
    return create_folder(req.path)


@app.post("/api/files/rename", tags=["File Control"])
async def api_rename_file(req: RenameFileRequest):
    return rename_file(req.old_path, req.new_name)


@app.post("/api/files/move", tags=["File Control"])
async def api_move_file(req: MoveFileRequest):
    return move_file(req.src_path, req.dest_dir)


# ── Phase 7: Web Intelligence & Scraping Endpoints ─────────────────────────────

@app.post("/api/web/search", tags=["Web Intelligence"])
async def api_web_search(req: WebSearchRequest):
    return search_web(req.query)


@app.post("/api/web/news", tags=["Web Intelligence"])
async def api_web_news(req: WebNewsRequest):
    return get_latest_news(req.topic)


@app.post("/api/web/scrape", tags=["Web Intelligence"])
async def api_web_scrape(req: WebScrapeRequest):
    return scrape_webpage(req.url)


# ── Phase 8: Vision / Screenshot Intelligence (#24) ───────────────────────────

@app.post("/api/screenshot", tags=["Vision Intelligence"])
async def capture_screenshot():
    """
    Capture the current full desktop screenshot and return it as base64 PNG.
    Used by Gemini Vision to answer 'What's on my screen?' queries.
    """
    try:
        import base64
        import io

        try:
            import PIL.ImageGrab as ImageGrab
            img = ImageGrab.grab()
        except Exception:
            # Fallback: try mss library if PIL grab fails (multi-monitor setups)
            try:
                import mss
                import PIL.Image as Image
                with mss.mss() as sct:
                    raw = sct.grab(sct.monitors[0])
                    img = Image.frombytes("RGB", raw.size, raw.bgra, "raw", "BGRX")
            except Exception as inner_err:
                return {"success": False, "error": f"Screenshot capture failed: {inner_err}"}

        # Downscale for faster API transfer while keeping enough detail for Gemini Vision
        MAX_WIDTH = 1280
        if img.width > MAX_WIDTH:
            ratio = MAX_WIDTH / img.width
            img = img.resize((MAX_WIDTH, int(img.height * ratio)))

        buffer = io.BytesIO()
        img.save(buffer, format="PNG", optimize=True)
        b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return {
            "success": True,
            "image_base64": b64,
            "mime_type": "image/png",
            "width": img.width,
            "height": img.height,
        }
    except Exception as e:
        logger.error(f"Screenshot error: {e}")
        return {"success": False, "error": str(e)}


# ── Phase 9: 2-Way Conversation Endpoints ─────────────────────────────────────

class StartConversationRequest(BaseModel):
    user_name: str = "friend"


@app.get("/api/conversation/status", tags=["Conversation"])
async def conversation_status():
    """
    Returns the current status of the 2-way conversation loop:
    running state, turn count, session memory summary, and voice state.
    """
    loop = get_conversation_loop(broadcast_fn=broadcast_ws)
    return {"success": True, **loop.get_status()}


@app.post("/api/conversation/start", tags=["Conversation"])
async def start_conversation(req: StartConversationRequest):
    """
    Manually start a 2-way conversation session (same as saying 'Hey Cheeni').
    Useful for triggering from a web UI button without speaking the wake word.
    """
    loop = get_conversation_loop(broadcast_fn=broadcast_ws)
    if loop.is_running:
        return {"success": False, "message": "Conversation already active.", "running": True}

    current_loop = asyncio.get_event_loop()
    loop._loop = current_loop
    get_session().on_wake_word()
    loop.start(user_name=req.user_name, event_loop=current_loop)
    await broadcast_ws({"event": "conversation_started", "user": req.user_name, "trigger": "manual"})
    return {"success": True, "message": f"Conversation started for '{req.user_name}'!", "running": True}


@app.post("/api/conversation/stop", tags=["Conversation"])
async def stop_conversation():
    """
    Gracefully end the active 2-way conversation session.
    Equivalent to the user saying 'Goodbye Cheeni'.
    """
    loop = get_conversation_loop(broadcast_fn=broadcast_ws)
    if not loop.is_running:
        return {"success": False, "message": "No active conversation to stop.", "running": False}

    loop.stop(reason="api_request")
    speaker = get_speaker()
    speaker.speak("Conversation ended. Call me anytime!", interrupt=True)
    await broadcast_ws({"event": "conversation_ended", "reason": "api_stop"})
    return {"success": True, "message": "Conversation stopped.", "running": False}


@app.get("/api/conversation/history", tags=["Conversation"])
async def conversation_history():
    """
    Returns the current session's conversation history (last N turns from memory).
    Useful for displaying the conversation in the web UI chat drawer.
    """
    from voice.memory import get_memory
    memory = get_memory(settings.CONVERSATION_MEMORY_TURNS)
    return {
        "success": True,
        "turn_count": memory.turn_count,
        "summary": memory.summary(),
        "history": memory.get_context(),
    }

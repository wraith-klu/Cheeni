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
import hmac
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field
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
from tools.file_operations import (
    cancel_preview as cancel_file_preview,
    confirm_preview as confirm_file_preview,
    create_preview as create_file_preview,
    get_preview as get_file_preview,
    prepare_undo_preview as prepare_file_undo_preview,
    read_approved_document,
    search_approved_files,
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

agent_bearer = HTTPBearer(auto_error=False)

async def require_agent_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(agent_bearer)):
    if len(settings.API_TOKEN) < 32:
        raise HTTPException(status_code=503, detail="Desktop agent API is not configured with AGENT_API_TOKEN")
    if credentials is None or not hmac.compare_digest(credentials.credentials, settings.API_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid or missing desktop agent token")
    return True

# ── App Lifespan: Wire optional voice services without opening the microphone ──
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Prepare callbacks; native listening starts only after an authenticated user action."""
    speaker = get_speaker()
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

    # Configure wake handling without initializing microphone capture.
    wake_engine = get_wake_engine()
    wake_engine.on_detected = on_wake_word

    logger.info("[Server] Native wake-word listening is off; enable it explicitly from the UI.")
    yield  # ─── Server is running ───

    conv_loop.stop(reason="server_shutdown")
    wake_engine.stop()
    speaker.stop_speaking()
    speaker.stop()
    logger.info("Optional voice services stopped.")



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
async def system_status(_authorized: bool = Depends(require_agent_token)):
    """Returns a full system snapshot: battery, CPU, RAM, disk, datetime."""
    try:
        data = get_full_system_status()
        return {"success": True, **data}
    except Exception as e:
        logger.error(f"/api/status error: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/battery", tags=["System"])
async def battery_status(_authorized: bool = Depends(require_agent_token)):
    """Returns current battery level, charging state, and time remaining."""
    try:
        data = get_battery_status()
        return {"success": True, **data}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/volume", tags=["Audio"])
async def volume_get(_authorized: bool = Depends(require_agent_token)):
    """Returns the current master volume level (0–100)."""
    return get_volume()


@app.post("/api/volume", tags=["Audio"])
async def volume_set(req: VolumeRequest, _authorized: bool = Depends(require_agent_token)):
    """Sets the master volume to the specified level (0–100)."""
    result = set_volume(req.level)
    if result.get("success"):
        await broadcast_ws({"event": "volume_changed", "volume": req.level})
    return result


@app.post("/api/volume/mute", tags=["Audio"])
async def volume_mute(_authorized: bool = Depends(require_agent_token)):
    """Mutes the system audio."""
    result = mute_volume()
    if result.get("success"):
        await broadcast_ws({"event": "volume_muted"})
    return result


@app.post("/api/volume/unmute", tags=["Audio"])
async def volume_unmute(_authorized: bool = Depends(require_agent_token)):
    """Unmutes the system audio."""
    result = unmute_volume()
    if result.get("success"):
        await broadcast_ws({"event": "volume_unmuted"})
    return result


@app.post("/api/launch", tags=["Apps"])
async def app_launch(req: LaunchRequest, _authorized: bool = Depends(require_agent_token)):
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
async def open_url_endpoint(req: OpenUrlRequest, _authorized: bool = Depends(require_agent_token)):
    """
    Opens any URL directly in the user's default browser at the Windows OS level.
    This bypasses all browser popup blockers.
    """
    import webbrowser
    from urllib.parse import urlparse
    try:
        parsed = urlparse(req.url)
        if parsed.scheme not in {"https", "http"} or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError("Only valid http or https URLs without embedded credentials can be opened")
        webbrowser.open(req.url)
        logger.info(f"Opened URL via OS browser: {req.url}")
        return {"success": True, "message": f"Opened {req.url}", "url": req.url}
    except Exception as e:
        logger.error(f"Failed to open URL {req.url}: {e}")
        return {"success": False, "message": str(e)}


@app.post("/api/play", tags=["Media"])
async def play_music_endpoint(req: PlayMusicRequest, _authorized: bool = Depends(require_agent_token)):
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
    Pushes live system telemetry (battery, CPU, RAM, volume, voice state)
    to the WebSocket client every 2 seconds while connected.
    """
    while True:
        try:
            snapshot = get_full_system_status()
            session = get_session()
            vol = get_volume()
            await websocket.send_text(json.dumps({
                "event": "telemetry",
                "voice_state": session.state.value,
                "agent_name": settings.AGENT_NAME,
                "volume": vol.get("volume", 50),
                "is_muted": vol.get("muted", False),
                **snapshot,
            }))
            await asyncio.sleep(2)
        except (WebSocketDisconnect, RuntimeError):
            break
        except Exception as e:
            logger.debug(f"Telemetry push loop note: {e}")
            await asyncio.sleep(2)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Unified Live WebSocket stream for Desktop Dashboard (V16).
    Streams telemetry, voice FSM state, and accepts remote commands.
    """
    if len(settings.API_TOKEN) >= 32:
        token = websocket.query_params.get("token")
        if not token:
            auth_header = websocket.headers.get("authorization") or ""
            if auth_header.startswith("Bearer "):
                token = auth_header[7:].strip()
        if not token or not hmac.compare_digest(token, settings.API_TOKEN):
            await websocket.close(code=1008)
            return

    await websocket.accept()
    active_connections.append(websocket)
    logger.info("[WebSocket] Client connected to live telemetry stream.")
    loop_task = asyncio.create_task(telemetry_loop(websocket))
    try:
        session = get_session()
        snapshot = get_full_system_status()
        vol = get_volume()
        await websocket.send_text(json.dumps({
            "event": "connected",
            "agent_name": settings.AGENT_NAME,
            "voice_state": session.state.value,
            "volume": vol.get("volume", 50),
            "is_muted": vol.get("muted", False),
            **snapshot,
        }))

        while True:
            raw_msg = await websocket.receive_text()
            try:
                msg = json.loads(raw_msg)
                msg_type = msg.get("type")

                if msg_type == "command":
                    cmd_text = msg.get("text", "")
                    await broadcast_ws({
                        "event": "tool_executing",
                        "command": cmd_text,
                    })
                    res = await route_command(cmd_text, broadcast_fn=broadcast_ws)
                    await websocket.send_text(json.dumps({
                        "event": "command_result",
                        "success": res.success,
                        "speech": res.speech,
                        "intent": res.intent,
                        "result": res.result,
                        "elapsed_ms": res.elapsed_ms,
                    }))
                    await broadcast_ws({
                        "event": "tool_result",
                        "success": res.success,
                        "speech": res.speech,
                        "intent": res.intent,
                    })

                elif msg_type == "quick_action":
                    act = msg.get("action", "")
                    if act == "lock":
                        lock_workstation()
                    elif act == "mute":
                        toggle_mute()
                    elif act == "desktop":
                        show_desktop()
                    elif act == "sleep":
                        sleep_system()
                    await websocket.send_text(json.dumps({
                        "event": "quick_action_result",
                        "action": act,
                        "success": True,
                    }))

                elif msg_type == "ping":
                    import time
                    await websocket.send_text(json.dumps({"event": "pong", "time": time.time()}))

            except json.JSONDecodeError:
                pass
            except Exception as cmd_err:
                logger.error(f"[WebSocket] Command dispatch error: {cmd_err}")
                await websocket.send_text(json.dumps({
                    "event": "command_result",
                    "success": False,
                    "error": str(cmd_err),
                }))

    except (WebSocketDisconnect, RuntimeError):
        pass
    finally:
        if websocket in active_connections:
            active_connections.remove(websocket)
        loop_task.cancel()
        logger.info("[WebSocket] Client disconnected from telemetry stream.")


# ── Phase 2: Voice Endpoints ───────────────────────────────────────────────────

class SpeakRequest(BaseModel):
    text: str
    interrupt: bool = True


@app.get("/api/voice/status", tags=["Voice"])
async def voice_status(_authorized: bool = Depends(require_agent_token)):
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
async def enable_wake_word(req: Optional[StartListeningRequest] = None, _authorized: bool = Depends(require_agent_token)):
    """Native wake-word listening is intentionally deferred from Phase 3."""
    raise HTTPException(
        status_code=410,
        detail="Native hands-free voice is disabled. Use browser push-to-talk instead.",
    )


@app.post("/api/voice/sync-name", tags=["Voice"])
async def sync_agent_name(req: StartListeningRequest, _authorized: bool = Depends(require_agent_token)):
    """Native wake-word configuration is intentionally deferred from Phase 3."""
    raise HTTPException(
        status_code=410,
        detail="Native hands-free voice is disabled. Use browser push-to-talk instead.",
    )


@app.post("/api/voice/stop-listening", tags=["Voice"])
async def disable_wake_word(_authorized: bool = Depends(require_agent_token)):
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
async def trigger_wake(_authorized: bool = Depends(require_agent_token)):
    """Native wake-word activation is intentionally deferred from Phase 3."""
    raise HTTPException(
        status_code=410,
        detail="Native hands-free voice is disabled. Use browser push-to-talk instead.",
    )


@app.post("/api/voice/speak", tags=["Voice"])
async def native_speak(req: SpeakRequest, _authorized: bool = Depends(require_agent_token)):
    """Native speech output is intentionally deferred from Phase 3."""
    raise HTTPException(
        status_code=410,
        detail="Native voice output is disabled. Use browser speech synthesis instead.",
    )


@app.post("/api/voice/stop", tags=["Voice"])
async def stop_native_speaker(_authorized: bool = Depends(require_agent_token)):
    """Stop native Windows TTS playback immediately."""
    speaker = get_speaker()
    speaker.stop_speaking()
    return {"success": True, "message": "Native speaker stopped."}


@app.post("/api/voice/session/end", tags=["Voice"])
async def end_voice_session(_authorized: bool = Depends(require_agent_token)):
    """Native conversation sessions are intentionally deferred from Phase 3."""
    raise HTTPException(
        status_code=410,
        detail="Native hands-free voice is disabled. Use browser push-to-talk instead.",
    )


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
async def execute_command(req: CommandRequest, _authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="Free-form commands are disabled; file changes require an explicit preview confirmation")


@app.post("/api/command/classify", tags=["Command Router"])
async def classify_command(req: CommandRequest, _authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="Legacy free-form command routing is disabled")


@app.post("/api/command/confirm", tags=["Command Router"])
async def submit_confirmation(req: ConfirmAnswerRequest, _authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="Unbound natural-language confirmations are disabled")


@app.get("/api/command/pending", tags=["Command Router"])
async def get_pending_confirmation(_authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="Legacy command confirmations are disabled")


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
    query: str = Field(min_length=1, max_length=120)
    root: str = Field(default="Downloads", pattern="^(Desktop|Documents|Downloads)$")


class FilePathRequest(BaseModel):
    path: str = Field(min_length=1, max_length=2048)


class RenameFileRequest(BaseModel):
    old_path: str
    new_name: str


class MoveFileRequest(BaseModel):
    src_path: str
    dest_dir: str


class FileOperationPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    owner_id: str = Field(min_length=1, max_length=128)
    type: str = Field(pattern="^(create_folder|rename|move|copy)$")
    parent: Optional[str] = Field(default=None, max_length=2048)
    source: Optional[str] = Field(default=None, max_length=2048)
    destination: Optional[str] = Field(default=None, max_length=2048)
    name: Optional[str] = Field(default=None, max_length=255)


class FileOperationOwnerRequest(BaseModel):
    owner_id: str = Field(min_length=1, max_length=128)


class WebSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    query: str = Field(min_length=1, max_length=240)


class WebNewsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    topic: Optional[str] = Field(default=None, max_length=240)


class WebScrapeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    url: str = Field(min_length=1, max_length=2048)


@app.post("/api/volume/delta", tags=["System Control"])
async def adjust_volume_by_delta(req: VolumeDeltaRequest, _authorized: bool = Depends(require_agent_token)):
    """Adjust system volume by a relative delta (+10, -15)."""
    res = adjust_volume_delta(req.delta)
    if res.get("success"):
        await broadcast_ws({"event": "volume_changed", "volume": res.get("volume")})
    return res


@app.post("/api/volume/toggle", tags=["System Control"])
async def toggle_system_mute(_authorized: bool = Depends(require_agent_token)):
    """Toggle master volume mute state."""
    res = toggle_mute()
    if res.get("success"):
        await broadcast_ws({"event": "mute_toggled", "muted": res.get("muted")})
    return res


@app.get("/api/apps/running", tags=["App Control"])
async def get_running_applications(_authorized: bool = Depends(require_agent_token)):
    """Returns active user-facing applications currently running."""
    apps = list_running_apps()
    return {"success": True, "count": len(apps), "apps": apps}


@app.post("/api/apps/close", tags=["App Control"])
async def terminate_application(req: CloseAppRequest, _authorized: bool = Depends(require_agent_token)):
    """Application termination requires a later action-specific confirmation design."""
    raise HTTPException(status_code=410, detail="Closing applications is disabled until unsaved-work checks and explicit confirmation are implemented")


@app.post("/api/apps/focus", tags=["App Control"])
async def focus_application(req: FocusAppRequest, _authorized: bool = Depends(require_agent_token)):
    """Bring an open application window to the foreground."""
    return focus_app(req.app)


@app.get("/api/system/specs", tags=["System Control"])
async def get_system_specifications(_authorized: bool = Depends(require_agent_token)):
    """Returns full hardware specs: CPU brand, cores, clock, RAM, disks, OS."""
    specs = get_hardware_specs()
    return {"success": True, "specs": specs}


@app.post("/api/system/lock", tags=["System Control"])
async def lock_system(_authorized: bool = Depends(require_agent_token)):
    """Workstation locking requires a later action-specific confirmation design."""
    raise HTTPException(status_code=410, detail="Locking the system is disabled until an action-specific confirmation flow is implemented")


@app.post("/api/system/sleep", tags=["System Control"])
async def sleep_pc(_authorized: bool = Depends(require_agent_token)):
    """Sleep requires a later action-specific confirmation design."""
    raise HTTPException(status_code=410, detail="Sleep is disabled until an action-specific confirmation flow is implemented")


@app.post("/api/system/restart", tags=["System Control"])
async def reboot_system(req: PowerDelayRequest = PowerDelayRequest(), _authorized: bool = Depends(require_agent_token)):
    """Restart requires a later action-specific confirmation design."""
    raise HTTPException(status_code=410, detail="Restart is disabled until an action-specific confirmation and cancel flow are implemented")


@app.post("/api/system/shutdown", tags=["System Control"])
async def poweroff_system(req: PowerDelayRequest = PowerDelayRequest(), _authorized: bool = Depends(require_agent_token)):
    """Shutdown requires a later action-specific confirmation design."""
    raise HTTPException(status_code=410, detail="Shutdown is disabled until an action-specific confirmation and cancel flow are implemented")


# ── Phase 5: Window Management Endpoints ─────────────────────────────────────

@app.post("/api/windows/minimize", tags=["Window Control"])
async def minimize_win(req: WindowTargetRequest = WindowTargetRequest(), _authorized: bool = Depends(require_agent_token)):
    return minimize_window(req.target)


@app.post("/api/windows/maximize", tags=["Window Control"])
async def maximize_win(req: WindowTargetRequest = WindowTargetRequest(), _authorized: bool = Depends(require_agent_token)):
    return maximize_window(req.target)


@app.post("/api/windows/restore", tags=["Window Control"])
async def restore_win(req: WindowTargetRequest = WindowTargetRequest(), _authorized: bool = Depends(require_agent_token)):
    return restore_window(req.target)


@app.post("/api/windows/close", tags=["Window Control"])
async def close_win(req: WindowTargetRequest = WindowTargetRequest(), _authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="Closing windows is disabled until unsaved-work checks and explicit confirmation are implemented")


@app.get("/api/windows/active", tags=["Window Control"])
async def active_win(_authorized: bool = Depends(require_agent_token)):
    return get_active_window()


@app.get("/api/windows", tags=["Window Control"])
async def list_windows(_authorized: bool = Depends(require_agent_token)):
    return {"success": True, "windows": list_open_windows()}


@app.post("/api/windows/snap", tags=["Window Control"])
async def snap_win(req: SnapWindowRequest, _authorized: bool = Depends(require_agent_token)):
    return snap_window(req.position, req.target)


@app.post("/api/windows/snap-corner", tags=["Window Control"])
async def snap_corner(req: SnapCornerRequest = SnapCornerRequest(), _authorized: bool = Depends(require_agent_token)):
    """Snap Cheeni desktop companion window to the top-right corner of the desktop."""
    return snap_corner_companion(
        target=req.target or "Cheeni",
        width=req.width or 420,
        height=req.height or 740,
        stay_on_top=bool(req.stay_on_top),
    )


@app.post("/api/windows/desktop", tags=["Window Control"])
async def show_desk(_authorized: bool = Depends(require_agent_token)):
    return show_desktop()


@app.post("/api/windows/virtual_desktop", tags=["Window Control"])
async def switch_vdesktop(req: SwitchDesktopRequest, _authorized: bool = Depends(require_agent_token)):
    return switch_virtual_desktop(req.direction)


# ── Phase 6: Filesystem & Document Intelligence Endpoints ──────────────────────

@app.post("/api/files/search", tags=["File Control"])
async def api_search_files(req: FileSearchRequest, _authorized: bool = Depends(require_agent_token)):
    try:
        return search_approved_files(req.query, req.root)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/files/read", tags=["File Control"])
async def api_read_document(req: FilePathRequest, _authorized: bool = Depends(require_agent_token)):
    try:
        return read_approved_document(req.path)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.post("/api/files/create_folder", tags=["File Control"])
async def api_create_folder(req: FilePathRequest, _authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="Direct file mutation is disabled; use preview and confirmation")


@app.post("/api/files/rename", tags=["File Control"])
async def api_rename_file(req: RenameFileRequest, _authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="Direct file mutation is disabled; use preview and confirmation")


@app.post("/api/files/move", tags=["File Control"])
async def api_move_file(req: MoveFileRequest, _authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="Direct file mutation is disabled; use preview and confirmation")


@app.post("/api/files/operations/preview", tags=["File Control"])
async def api_preview_file_operation(req: FileOperationPreviewRequest, _authorized: bool = Depends(require_agent_token)):
    operation = req.model_dump(exclude={"owner_id"}, exclude_none=True)
    try:
        return {"success": True, "preview": create_file_preview(req.owner_id, operation)}
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))


@app.get("/api/files/operations/{operation_id}", tags=["File Control"])
async def api_get_file_operation(operation_id: str, owner_id: str, _authorized: bool = Depends(require_agent_token)):
    try:
        return {"success": True, "operation": get_file_preview(owner_id, operation_id)}
    except LookupError:
        raise HTTPException(status_code=404, detail="Operation was not found")


@app.post("/api/files/operations/{operation_id}/cancel", tags=["File Control"])
async def api_cancel_file_operation(operation_id: str, req: FileOperationOwnerRequest, _authorized: bool = Depends(require_agent_token)):
    try:
        return {"success": True, "operation": cancel_file_preview(req.owner_id, operation_id)}
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


@app.post("/api/files/operations/{operation_id}/confirm", tags=["File Control"])
async def api_confirm_file_operation(operation_id: str, req: FileOperationOwnerRequest, _authorized: bool = Depends(require_agent_token)):
    try:
        return {"success": True, "operation": confirm_file_preview(req.owner_id, operation_id)}
    except LookupError:
        raise HTTPException(status_code=404, detail="Operation was not found")
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


@app.post("/api/files/operations/{operation_id}/undo", tags=["File Control"])
async def api_prepare_file_undo(operation_id: str, req: FileOperationOwnerRequest, _authorized: bool = Depends(require_agent_token)):
    try:
        return {"success": True, "preview": prepare_file_undo_preview(req.owner_id, operation_id)}
    except LookupError:
        raise HTTPException(status_code=404, detail="Operation was not found")
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error))


# ── Phase 7: Web Intelligence & Scraping Endpoints ─────────────────────────────

@app.post("/api/web/search", tags=["Web Intelligence"])
async def api_web_search(req: WebSearchRequest, _authorized: bool = Depends(require_agent_token)):
    return search_web(req.query)


@app.post("/api/web/news", tags=["Web Intelligence"])
async def api_web_news(req: WebNewsRequest, _authorized: bool = Depends(require_agent_token)):
    return get_latest_news(req.topic)


@app.post("/api/web/scrape", tags=["Web Intelligence"])
async def api_web_scrape(req: WebScrapeRequest, _authorized: bool = Depends(require_agent_token)):
    return scrape_webpage(req.url)


# ── Phase 8: Vision / Screenshot Intelligence (#24) ───────────────────────────

@app.post("/api/screenshot", tags=["Vision Intelligence"])
async def capture_screenshot(_authorized: bool = Depends(require_agent_token)):
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
async def conversation_status(_authorized: bool = Depends(require_agent_token)):
    """
    Returns the current status of the 2-way conversation loop:
    running state, turn count, session memory summary, and voice state.
    """
    loop = get_conversation_loop(broadcast_fn=broadcast_ws)
    return {"success": True, **loop.get_status()}


@app.post("/api/conversation/start", tags=["Conversation"])
async def start_conversation(req: StartConversationRequest, _authorized: bool = Depends(require_agent_token)):
    """Native conversations are intentionally deferred from Phase 3."""
    raise HTTPException(
        status_code=410,
        detail="Native hands-free voice is disabled. Use browser push-to-talk instead.",
    )


@app.post("/api/conversation/stop", tags=["Conversation"])
async def stop_conversation(_authorized: bool = Depends(require_agent_token)):
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
async def conversation_history(_authorized: bool = Depends(require_agent_token)):
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


# ── Pillar 2 & 3: ReAct & Desktop Vision Endpoints ────────────────────────────

class ReActRequest(BaseModel):
    prompt: str

class VisionRequest(BaseModel):
    question: str = Field(default="What is currently shown on the screen?", min_length=1, max_length=500)

class ScreenClickRequest(BaseModel):
    description: str = Field(min_length=1, max_length=200)
    click_type: str = Field(default="single", pattern="^(single|double|right)$")

class ScreenTypeRequest(BaseModel):
    description: str = Field(default="", max_length=200)
    text: str = Field(min_length=1, max_length=1000)
    press_enter: bool = Field(default=False)

class ScreenGoalRequest(BaseModel):
    goal: str = Field(min_length=3, max_length=500)
    max_steps: int = Field(default=8, ge=1, le=20)

@app.post("/api/agent/react", tags=["Agent"])
async def execute_react_turn(req: ReActRequest, _authorized: bool = Depends(require_agent_token)):
    raise HTTPException(status_code=410, detail="The experimental ReAct endpoint is disabled; use the registered local tool interface")

class StructuredToolRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=80)
    arguments: dict = Field(default_factory=dict)

@app.post("/api/agent/tool", tags=["Agent"])
async def execute_structured_tool(req: StructuredToolRequest, _authorized: bool = Depends(require_agent_token)):
    """Execute only the initial, low-risk registered tools through one local interface."""
    from tools.app_control import _resolve_app_entry
    from urllib.parse import urlparse
    import webbrowser

    args = req.arguments
    if req.name == "launch_app":
        app_name = args.get("app_name")
        if set(args) != {"app_name"} or not isinstance(app_name, str) or not app_name.strip() or len(app_name) > 80:
            raise HTTPException(status_code=400, detail="Invalid app_name")
        approved_apps = {
            "notepad", "calculator", "calc", "paint", "mspaint", "chrome", "google chrome",
            "edge", "microsoft edge", "firefox", "brave", "vscode", "vs code",
            "visual studio code", "spotify", "file explorer", "explorer",
        }
        if app_name.strip().lower() not in approved_apps:
            raise HTTPException(status_code=400, detail="Application is not enabled for the initial command milestone")
        if _resolve_app_entry(app_name.strip().lower()) is None:
            raise HTTPException(status_code=400, detail="Application is not in the approved catalog")
        return launch_app(app_name.strip())

    if req.name == "open_url":
        url = args.get("url")
        if set(args) != {"url"} or not isinstance(url, str) or len(url) > 2048:
            raise HTTPException(status_code=400, detail="Invalid URL")
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
            raise HTTPException(status_code=400, detail="Only valid http or https URLs without embedded credentials can be opened")
        webbrowser.open(url)
        return {"success": True, "url": url, "message": "Opened URL in the default browser"}

    if req.name == "open_folder":
        folder_name = args.get("folder")
        if not isinstance(folder_name, str):
            raise HTTPException(status_code=400, detail="Choose home, desktop, documents, or downloads")
        folders = {
            "home": settings.USER_HOME,
            "desktop": settings.DESKTOP_DIR,
            "documents": settings.DOCUMENTS_DIR,
            "downloads": settings.DOWNLOADS_DIR,
        }
        if set(args) != {"folder"} or folder_name not in folders:
            raise HTTPException(status_code=400, detail="Choose home, desktop, documents, or downloads")
        folder_path = folders[folder_name]
        if not folder_path.is_dir():
            raise HTTPException(status_code=404, detail=f"The {folder_name} folder does not exist")
        import os
        os.startfile(str(folder_path))
        return {"success": True, "folder": folder_name, "path": str(folder_path)}

    if req.name == "get_system_telemetry":
        metric = args.get("metric")
        if set(args) != {"metric"} or not isinstance(metric, str) or metric not in {"battery", "cpu_ram", "specs", "datetime", "all"}:
            raise HTTPException(status_code=400, detail="Invalid telemetry metric")
        if metric == "battery":
            return {"success": True, **get_battery_status()}
        if metric == "datetime":
            from tools.system_status import get_datetime_status
            return {"success": True, **get_datetime_status()}
        if metric == "specs":
            return {"success": True, "specs": get_hardware_specs()}
        if metric == "cpu_ram":
            return {"success": True, "cpu": get_cpu_status(), "ram": get_ram_status()}
        return {"success": True, **get_full_system_status()}

    raise HTTPException(status_code=400, detail="Tool is not enabled")

@app.post("/api/agent/vision", tags=["Agent"])
async def inspect_desktop_vision(req: VisionRequest, _authorized: bool = Depends(require_agent_token)):
    """
    Captures the user's primary monitor screen (<25ms) and sends it to
    Gemini Flash to inspect code, errors, or open windows.
    """
    try:
        from tools.desktop_vision import analyze_screen_with_gemini
        result = await analyze_screen_with_gemini(req.question)
        return result
    except Exception as e:
        logger.error(f"Desktop vision error: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/agent/screen/status", tags=["Screen Agent"])
async def get_screen_agent_status(_authorized: bool = Depends(require_agent_token)):
    """Check availability of screen vision, GUI control, and dependencies."""
    from tools.desktop_vision import CV2_AVAILABLE, PYAUTOGUI_AVAILABLE, get_screen_resolution, CANDIDATE_VISION_MODELS
    from tools.screen_agent import is_available as is_screen_agent_available
    w, h = get_screen_resolution()
    return {
        "success": True,
        "available": is_screen_agent_available(),
        "cv2": CV2_AVAILABLE,
        "pyautogui": PYAUTOGUI_AVAILABLE,
        "resolution": {"width": w, "height": h},
        "model": settings.SCREEN_VISION_MODEL,
        "candidate_models": CANDIDATE_VISION_MODELS,
    }


@app.post("/api/agent/screen/click", tags=["Screen Agent"])
async def screen_click_element(req: ScreenClickRequest, _authorized: bool = Depends(require_agent_token)):
    """Finds an element by natural language description and clicks it."""
    from tools.desktop_vision import find_and_click
    return await find_and_click(req.description, click_type=req.click_type)


@app.post("/api/agent/screen/type", tags=["Screen Agent"])
async def screen_type_element(req: ScreenTypeRequest, _authorized: bool = Depends(require_agent_token)):
    """Finds an element by description (or active focus), clicks to focus, and types text."""
    from tools.desktop_vision import type_at_element
    return await type_at_element(req.description, req.text, press_enter=req.press_enter)


@app.post("/api/agent/screen/goal", tags=["Screen Agent"])
async def screen_execute_goal(req: ScreenGoalRequest, _authorized: bool = Depends(require_agent_token)):
    """Executes a multi-step autonomous screen goal (Observe -> Reason -> Act loop)."""
    from tools.screen_agent import execute_screen_goal
    return await execute_screen_goal(req.goal, max_steps=req.max_steps, step_delay=settings.SCREEN_AGENT_STEP_DELAY)


# ── Phase 16: Unified Dashboard & Remote Control Endpoints ─────────────────────

class RemoteCommandRequest(BaseModel):
    text: str = Field(min_length=1, max_length=500)

class QuickActionRequest(BaseModel):
    action: str = Field(pattern="^(lock|mute|unmute|desktop|sleep|screenshot)$")

class MemoryPreferenceRequest(BaseModel):
    category: str = Field(min_length=1, max_length=50)
    key: str = Field(min_length=1, max_length=50)
    value: str = Field(min_length=1, max_length=500)

class MemoryShortcutRequest(BaseModel):
    phrase: str = Field(min_length=1, max_length=100)
    target: str = Field(min_length=1, max_length=500)

class MemorySearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    top_k: int = Field(default=5, ge=1, le=20)

class SpeakDirectRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


@app.post("/api/agent/remote/command", tags=["Remote Control"])
async def api_remote_command(req: RemoteCommandRequest, _authorized: bool = Depends(require_agent_token)):
    """Executes a command remotely from the browser dashboard without microphone."""
    await broadcast_ws({"event": "tool_executing", "command": req.text})
    res = await route_command(req.text, broadcast_fn=broadcast_ws)
    await broadcast_ws({"event": "tool_result", "success": res.success, "speech": res.speech, "intent": res.intent})
    return {
        "success": res.success,
        "speech": res.speech,
        "intent": res.intent,
        "result": res.result,
        "elapsed_ms": res.elapsed_ms,
    }


@app.post("/api/agent/quick-action", tags=["Remote Control"])
async def api_quick_action(req: QuickActionRequest, _authorized: bool = Depends(require_agent_token)):
    """Executes a system quick action (lock, mute, desktop, sleep, screenshot)."""
    act = req.action
    if act == "lock":
        return lock_workstation()
    elif act == "mute":
        return mute_volume()
    elif act == "unmute":
        return unmute_volume()
    elif act == "desktop":
        return show_desktop()
    elif act == "sleep":
        return sleep_system()
    elif act == "screenshot":
        from tools.desktop_vision import capture_screen_base64
        return {"success": True, "image_base64": capture_screen_base64()}
    return {"success": False, "error": f"Unknown action {act}"}


@app.post("/api/agent/speak", tags=["Remote Control"])
async def api_agent_speak(req: SpeakDirectRequest, _authorized: bool = Depends(require_agent_token)):
    """Speaks text through Sam's native or Edge TTS speaker."""
    speaker = get_speaker()
    speaker.speak(req.text, interrupt=True)
    return {"success": True, "spoken": req.text}


@app.get("/api/agent/memory/all", tags=["Memory Browser"])
async def api_memory_all(_authorized: bool = Depends(require_agent_token)):
    """Returns all stored preferences, shortcuts, contacts, and memory stats."""
    from core.personal_memory import get_personal_memory
    mem = get_personal_memory()
    return {
        "success": True,
        "preferences": mem.list_preferences(),
        "shortcuts": mem.list_shortcuts(),
        "contacts": mem.list_contacts(),
        "stats": mem.get_stats(),
    }


@app.get("/api/agent/memory/stats", tags=["Memory Browser"])
async def api_memory_stats(_authorized: bool = Depends(require_agent_token)):
    """Returns statistics about personal memory items."""
    from core.personal_memory import get_personal_memory
    return {"success": True, "stats": get_personal_memory().get_stats()}


@app.post("/api/agent/memory/preference", tags=["Memory Browser"])
async def api_save_preference(req: MemoryPreferenceRequest, _authorized: bool = Depends(require_agent_token)):
    """Remembers a personal user preference."""
    from core.personal_memory import get_personal_memory
    mem = get_personal_memory()
    mem.remember(req.category, req.key, req.value)
    await broadcast_ws({"event": "memory_update", "type": "preference", "category": req.category, "key": req.key, "value": req.value})
    return {"success": True, "saved": {"category": req.category, "key": req.key, "value": req.value}}


@app.delete("/api/agent/memory/preference", tags=["Memory Browser"])
async def api_delete_preference(category: str, key: str, _authorized: bool = Depends(require_agent_token)):
    """Deletes a stored user preference."""
    from core.personal_memory import get_personal_memory
    mem = get_personal_memory()
    mem.forget(category, key)
    return {"success": True, "deleted": {"category": category, "key": key}}


@app.post("/api/agent/memory/shortcut", tags=["Memory Browser"])
async def api_save_shortcut(req: MemoryShortcutRequest, _authorized: bool = Depends(require_agent_token)):
    """Maps a natural phrase to an app or URL shortcut."""
    from core.personal_memory import get_personal_memory
    mem = get_personal_memory()
    mem.add_shortcut(req.phrase, req.target)
    await broadcast_ws({"event": "memory_update", "type": "shortcut", "phrase": req.phrase, "target": req.target})
    return {"success": True, "saved": {"phrase": req.phrase, "target": req.target}}


@app.delete("/api/agent/memory/shortcut", tags=["Memory Browser"])
async def api_delete_shortcut(phrase: str, _authorized: bool = Depends(require_agent_token)):
    """Deletes a mapped shortcut."""
    from core.personal_memory import get_personal_memory
    mem = get_personal_memory()
    mem.delete_shortcut(phrase)
    return {"success": True, "deleted": phrase}


@app.post("/api/agent/memory/search", tags=["Memory Browser"])
async def api_search_memory(req: MemorySearchRequest, _authorized: bool = Depends(require_agent_token)):
    """Performs semantic recall across personal memory facts."""
    from core.personal_memory import get_personal_memory
    mem = get_personal_memory()
    results = mem.recall(req.query, top_k=req.top_k)
    return {"success": True, "query": req.query, "results": results}


# ══════════════════════════════════════════════════════════════════════════════
# V17 -- Morning Digest
# ══════════════════════════════════════════════════════════════════════════════

class DigestScheduleRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    time: str = Field(..., pattern=r"^\d{2}:\d{2}$", description="HH:MM 24-hour schedule time")

@app.post("/api/digest/now", tags=["Morning Digest"])
async def api_digest_now(_authorized: bool = Depends(require_agent_token)):
    """Build and speak today's morning digest immediately."""
    from tools.digest_agent import get_digest_agent
    result = await get_digest_agent().build_digest(text_only=False)
    return {"success": True, **result}

@app.post("/api/digest/text", tags=["Morning Digest"])
async def api_digest_text(_authorized: bool = Depends(require_agent_token)):
    """Build today's digest and return as text only (no audio)."""
    from tools.digest_agent import get_digest_agent
    result = await get_digest_agent().build_digest(text_only=True)
    return {"success": True, **result}

@app.post("/api/digest/schedule", tags=["Morning Digest"])
async def api_digest_schedule(req: DigestScheduleRequest, _authorized: bool = Depends(require_agent_token)):
    """Schedule daily digest at HH:MM (24-hour local time)."""
    from tools.digest_agent import get_digest_agent
    get_digest_agent().set_schedule(req.time)
    return {"success": True, "scheduled_at": req.time}

@app.delete("/api/digest/schedule", tags=["Morning Digest"])
async def api_digest_cancel_schedule(_authorized: bool = Depends(require_agent_token)):
    """Cancel the daily digest schedule."""
    from tools.digest_agent import get_digest_agent
    get_digest_agent().cancel_schedule()
    return {"success": True, "message": "Digest schedule cancelled"}

@app.get("/api/digest/status", tags=["Morning Digest"])
async def api_digest_status(_authorized: bool = Depends(require_agent_token)):
    """Get current digest schedule and last run info."""
    from tools.digest_agent import get_digest_agent
    return {"success": True, **get_digest_agent().get_status()}


# ══════════════════════════════════════════════════════════════════════════════
# V18 -- Cloud Connectors
# ══════════════════════════════════════════════════════════════════════════════

class ConnectRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    service: str = Field(..., description="Service to connect: gdrive, slack, notion, outlook")

class GmailRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    max_results: int = Field(10, ge=1, le=50)

class SlackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    channel: Optional[str] = None
    limit: int = Field(5, ge=1, le=20)

class NotionSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = ""
    limit: int = Field(5, ge=1, le=20)

@app.post("/api/connectors/connect", tags=["Connectors"])
async def api_connector_connect(req: ConnectRequest, _authorized: bool = Depends(require_agent_token)):
    """Initiate OAuth flow or save API token for a cloud service."""
    from tools.connectors import get_connector_registry
    result = await get_connector_registry().connect(req.service)
    return {"success": result.get("ok", False), **result}

@app.get("/api/connectors/list", tags=["Connectors"])
async def api_connector_list(_authorized: bool = Depends(require_agent_token)):
    """List all connected cloud services."""
    from tools.connectors import get_connector_registry
    return {"success": True, "connected": get_connector_registry().list_connected()}

@app.get("/api/connectors/gmail/unread", tags=["Connectors"])
async def api_gmail_unread(max_results: int = 10, _authorized: bool = Depends(require_agent_token)):
    """Fetch unread Gmail messages."""
    from tools.connectors import get_connector_registry
    emails = await get_connector_registry().gmail_unread(max_results=max_results)
    return {"success": True, "count": len(emails), "emails": emails}

@app.get("/api/connectors/calendar/today", tags=["Connectors"])
async def api_calendar_today(_authorized: bool = Depends(require_agent_token)):
    """Fetch today's Google Calendar events."""
    from tools.connectors import get_connector_registry
    events = await get_connector_registry().calendar_today()
    return {"success": True, "count": len(events), "events": events}

@app.get("/api/connectors/slack/messages", tags=["Connectors"])
async def api_slack_messages(channel: Optional[str] = None, limit: int = 5, _authorized: bool = Depends(require_agent_token)):
    """Fetch recent Slack messages."""
    from tools.connectors import get_connector_registry
    messages = await get_connector_registry().slack_unread(channel=channel, limit=limit)
    return {"success": True, "messages": messages}

@app.post("/api/connectors/notion/search", tags=["Connectors"])
async def api_notion_search(req: NotionSearchRequest, _authorized: bool = Depends(require_agent_token)):
    """Search Notion workspace pages."""
    from tools.connectors import get_connector_registry
    results = await get_connector_registry().notion_search(query=req.query, limit=req.limit)
    return {"success": True, "results": results}


# ══════════════════════════════════════════════════════════════════════════════
# V19 -- Kokoro TTS (local neural voice)
# ══════════════════════════════════════════════════════════════════════════════

class KokoroSpeakRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    text: str = Field(..., min_length=1, max_length=4000)
    interrupt: bool = True

class KokoroVoiceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    voice: str = Field(..., description="Kokoro voice ID, e.g. bm_george, af_sarah")

class KokoroSpeedRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    speed: float = Field(..., ge=0.5, le=2.0)

@app.get("/api/voice/kokoro/status", tags=["Kokoro TTS"])
async def api_kokoro_status(_authorized: bool = Depends(require_agent_token)):
    """Get Kokoro TTS availability and current voice settings."""
    from voice.kokoro_speaker import get_kokoro_speaker, list_voice_presets
    return {
        "success": True,
        **get_kokoro_speaker().get_status(),
        "presets": list_voice_presets(),
    }

@app.post("/api/voice/kokoro/speak", tags=["Kokoro TTS"])
async def api_kokoro_speak(req: KokoroSpeakRequest, _authorized: bool = Depends(require_agent_token)):
    """Speak text using local Kokoro neural TTS."""
    from voice.kokoro_speaker import get_kokoro_speaker
    spk = get_kokoro_speaker()
    if not spk.available:
        raise HTTPException(status_code=503, detail="Kokoro TTS not available. Run: pip install kokoro sounddevice")
    spk.speak(req.text, interrupt=req.interrupt)
    return {"success": True, "queued": req.text[:80]}

@app.post("/api/voice/kokoro/stop", tags=["Kokoro TTS"])
async def api_kokoro_stop(_authorized: bool = Depends(require_agent_token)):
    """Stop current Kokoro speech and clear queue."""
    from voice.kokoro_speaker import get_kokoro_speaker
    get_kokoro_speaker().stop_speaking()
    return {"success": True}

@app.post("/api/voice/kokoro/voice", tags=["Kokoro TTS"])
async def api_kokoro_set_voice(req: KokoroVoiceRequest, _authorized: bool = Depends(require_agent_token)):
    """Change the active Kokoro voice."""
    from voice.kokoro_speaker import get_kokoro_speaker
    get_kokoro_speaker().set_voice(req.voice)
    return {"success": True, "voice": req.voice}

@app.post("/api/voice/kokoro/speed", tags=["Kokoro TTS"])
async def api_kokoro_set_speed(req: KokoroSpeedRequest, _authorized: bool = Depends(require_agent_token)):
    """Set Kokoro speech speed (0.5 – 2.0)."""
    from voice.kokoro_speaker import get_kokoro_speaker
    get_kokoro_speaker().set_speed(req.speed)
    return {"success": True, "speed": req.speed}


# ══════════════════════════════════════════════════════════════════════════════
# V20 -- Notes Memory Indexer
# ══════════════════════════════════════════════════════════════════════════════

class NotesIndexRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    path: str = Field(..., description="Absolute or ~ path to a folder of notes")
    overwrite: bool = True

class NotesSearchRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    query: str = Field(..., min_length=1, max_length=500)
    top_k: int = Field(5, ge=1, le=20)

class NotesRemoveRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    path: str

@app.post("/api/memory/notes/index", tags=["Notes Indexer"])
async def api_notes_index(req: NotesIndexRequest, _authorized: bool = Depends(require_agent_token)):
    """Index a local folder of notes (.md/.txt/.pdf) for semantic search."""
    from tools.notes_indexer import get_notes_indexer
    result = await asyncio.to_thread(get_notes_indexer().index_folder, req.path, req.overwrite)
    return {"success": result.get("ok", False), **result}

@app.post("/api/memory/notes/search", tags=["Notes Indexer"])
async def api_notes_search(req: NotesSearchRequest, _authorized: bool = Depends(require_agent_token)):
    """Semantic search across all indexed notes."""
    from tools.notes_indexer import get_notes_indexer
    results = await asyncio.to_thread(get_notes_indexer().search, req.query, req.top_k)
    return {"success": True, "query": req.query, "results": results}

@app.get("/api/memory/notes/sources", tags=["Notes Indexer"])
async def api_notes_sources(_authorized: bool = Depends(require_agent_token)):
    """List all indexed note folders."""
    from tools.notes_indexer import get_notes_indexer
    return {"success": True, "sources": get_notes_indexer().list_sources()}

@app.delete("/api/memory/notes/source", tags=["Notes Indexer"])
async def api_notes_remove_source(req: NotesRemoveRequest, _authorized: bool = Depends(require_agent_token)):
    """Remove a source folder from the notes index."""
    from tools.notes_indexer import get_notes_indexer
    result = get_notes_indexer().remove_source(req.path)
    return {"success": result.get("ok", False), **result}

@app.get("/api/memory/notes/stats", tags=["Notes Indexer"])
async def api_notes_stats(_authorized: bool = Depends(require_agent_token)):
    """Get notes index statistics."""
    from tools.notes_indexer import get_notes_indexer
    return {"success": True, "stats": get_notes_indexer().get_stats()}

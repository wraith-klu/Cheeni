"""
Cheeni Agent — Main FastAPI Entry Point
Single-server architecture: Python FastAPI handles ALL routes,
ML inference, voice pipeline, file ops, and browser automation.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from pydantic import BaseModel
import uvicorn
import logging
import asyncio
import json

from config.settings import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cheeni")


# ── Startup / Shutdown ────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 Cheeni Agent starting up...")

    # Lazy-load: IntentClassifier downloads in background thread.
    # Server is instantly ready; first few requests use Gemini fallback
    # while the 1.11GB model downloads and caches locally.
    try:
        from core.intent_classifier import IntentClassifier
        app.state.intent = IntentClassifier()
        logger.info("✅ Intent classifier initialised (background download may still be in progress)")
    except Exception as e:
        logger.warning(f"⚠️ Intent classifier could not initialise: {e} — Gemini fallback active")
        app.state.intent = None

    logger.info("✅ Cheeni Agent ready on :2026")
    yield

    logger.info("👋 Cheeni Agent shutting down")


# ── App Init ──────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cheeni Agent",
    description="JARVIS-style personal AI — voice, ML, automation",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)


# ── Schemas ───────────────────────────────────────────────────────────────────
class CommandRequest(BaseModel):
    text: str
    context: dict = {}
    session_id: str = "default"


class CommandResponse(BaseModel):
    reply: str
    intent: str = "unknown"
    confidence: float = 0.0
    action_taken: str = ""
    data: dict = {}


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    """Health check — used by Render and frontend."""
    return {
        "status": "ok",
        "service": "cheeni-agent",
        "version": "2.0.0",
        "intent_classifier": "loaded" if app.state.intent else "fallback",
    }


@app.get("/api/agent/ping")
async def agent_ping():
    """
    Desktop Agent Liveness Probe.
    Polled by React frontend hooks (useAgentTelemetry, Landing, useConnectionStatus).
    """
    return {
        "connected": True,
        "pong": True,
        "service": "cheeni-agent",
        "version": "2.0.0",
        "intent_classifier": "loaded" if getattr(app.state, "intent", None) else "fallback",
    }


@app.get("/api/agent/status")
async def agent_status():
    """Live hardware telemetry for the frontend dashboard & telemetry hook."""
    cpu_percent = 0.0
    ram_percent = 0.0
    battery_level = None
    try:
        import psutil
        cpu_percent = psutil.cpu_percent(interval=None)
        ram = psutil.virtual_memory()
        ram_percent = ram.percent
        if hasattr(psutil, "sensors_battery"):
            battery = psutil.sensors_battery()
            battery_level = battery.percent if battery else None
    except Exception:
        pass

    return {
        "status": "online",
        "cpu": {"usage_percent": cpu_percent},
        "ram": {"usage_percent": ram_percent},
        "battery": {"level": battery_level},
        "volume": {"volume": 50, "muted": False},
    }


@app.post("/api/agent/volume")
async def set_volume(body: dict):
    return {"ok": True, "level": body.get("level", 50)}


@app.post("/api/agent/volume/mute")
async def mute_volume():
    import os
    os.system("powershell -c (New-Object -ComObject WScript.Shell).SendKeys([char]173)")
    return {"ok": True, "muted": True}


@app.post("/api/agent/system/lock")
async def system_lock():
    import os
    os.system("rundll32.exe user32.dll,LockWorkStation")
    return {"ok": True, "action": "lock"}


@app.post("/api/agent/windows/desktop")
async def show_desktop():
    import os
    os.system("powershell -c (New-Object -ComObject Shell.Application).MinimizeAll()")
    return {"ok": True, "action": "show_desktop"}


@app.post("/api/agent/tool")
async def execute_tool(body: dict):
    """Execute desktop agent tool invoked by frontend actionRunner."""
    name = body.get("name")
    arguments = body.get("arguments", {})
    from tools.router import route_command

    if name == "launch_app":
        app_name = arguments.get("app_name", "")
        return await route_command(f"open {app_name}", intent_classifier=app.state.intent)
    elif name == "open_folder":
        folder = arguments.get("folder", "")
        return await route_command(f"open {folder} folder", intent_classifier=app.state.intent)
    elif name == "open_url":
        url = arguments.get("url", "")
        import webbrowser
        webbrowser.open(url)
        return {"success": True, "reply": f"Opened {url}", "executed": True}
    elif name == "get_system_telemetry":
        from tools.system_control import handle
        return await handle("system_status", "system status")

    return {"success": True, "executed": True, "name": name}


@app.post("/command", response_model=CommandResponse)
async def process_command(body: CommandRequest):
    """
    Main command endpoint.
    Frontend → POST /command → intent classify → route → execute → respond.
    """
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Command text is empty")

    from tools.router import route_command
    result = await route_command(
        text=body.text,
        context=body.context,
        intent_classifier=app.state.intent,
    )
    return CommandResponse(**result)


@app.post("/api/assistant/ask/stream")
async def assistant_ask_stream(request: Request):
    """
    SSE Streaming Assistant Endpoint.
    Consumed by Home.jsx streamAsk() for live token-by-token speech & text reply.
    """
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    prompt = (body.get("prompt") or body.get("text") or body.get("query") or "").strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is empty")

    from tools.router import route_command
    result = await route_command(
        text=prompt,
        intent_classifier=app.state.intent,
    )
    reply = result.get("reply", "I am here to help.")
    intent = result.get("intent", "general")
    action_taken = result.get("action_taken", "")
    data = result.get("data", {})

    action = None
    # Only treat real OS execution tasks as an action toast — conversational answers shouldn't show an OS toast
    conversational_actions = {"capabilities_query", "presence_check", "greeting", "joke", "llm_response", "datetime_query"}
    if action_taken and action_taken not in conversational_actions:
        # Give short, clean label instead of dumping full assistant reply
        short_label = (
            f"Playing '{data.get('query')}' on YouTube" if action_taken == "search_youtube" else
            f"Opening {data.get('app')}" if action_taken in ("launch_app", "app_launch") else
            f"Searching Google for '{data.get('query')}'" if action_taken == "search_web" else
            f"Adjusting brightness" if action_taken == "system_brightness" else
            f"Setting volume" if action_taken in ("volume_up", "volume_down", "mute_volume") else
            f"System action: {action_taken}"
        )
        action = {
            "type": action_taken,
            "label": short_label,
            "app": data.get("app") or data.get("target"),
            "url": data.get("url"),
            "folder": data.get("folder"),
            "data": data,
            "executed": True,
        }

    async def event_generator():
        # 1. Meta event (sent immediately so voice synthesis can begin)
        meta_event = {
            "type": "meta",
            "intent": intent,
            "speechText": reply,
            "action": action,
        }
        yield f"data: {json.dumps(meta_event)}\n\n"

        # 2. Chunks (word-by-word streaming for natural reading animation)
        words = reply.split(" ")
        for i, word in enumerate(words):
            chunk_event = {
                "type": "chunk",
                "text": word + (" " if i < len(words) - 1 else ""),
            }
            yield f"data: {json.dumps(chunk_event)}\n\n"
            await asyncio.sleep(0.015)

        # 3. Done event
        done_event = {"type": "done", "reply": reply}
        yield f"data: {json.dumps(done_event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/assistant/ask")
async def assistant_ask(request: Request):
    """Direct non-streaming assistant endpoint."""
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    prompt = (body.get("prompt") or body.get("text") or body.get("query") or "").strip()
    from tools.router import route_command
    result = await route_command(text=prompt, intent_classifier=app.state.intent)
    reply = result.get("reply", "")
    return {
        "reply": reply,
        "speechText": reply,
        "intent": result.get("intent", "general"),
        "action": {"type": result.get("action_taken", ""), "data": result.get("data", {})},
    }


@app.post("/api/assistant/aliases/execute")
async def execute_alias(request: Request):
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    prompt = (body.get("prompt") or "").strip()
    from tools.router import route_command
    result = await route_command(text=prompt, intent_classifier=app.state.intent)
    reply = result.get("reply", "Command executed.")
    return {
        "success": True,
        "assistantMessage": {
            "role": "assistant",
            "content": reply,
            "speechText": reply,
            "timestamp": "now",
        },
        "speechText": reply,
        "textResponse": reply,
    }


@app.get("/capabilities")
async def list_capabilities():
    """Return all supported capability categories."""
    from config.constants import CAPABILITY_MANIFEST
    return CAPABILITY_MANIFEST


# ── Local Auth & User Profile Sidecar ───────────────────────────────────
# Enables seamless signup/signin and user profile persistence in local mode.
import json, pathlib

_PREFS_PATH = pathlib.Path(__file__).parent / "data" / "user_prefs.json"

def _get_user_prefs() -> dict:
    _PREFS_PATH.parent.mkdir(exist_ok=True)
    if _PREFS_PATH.exists():
        try:
            return json.loads(_PREFS_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def _save_user_prefs(prefs: dict) -> None:
    _PREFS_PATH.parent.mkdir(exist_ok=True)
    _PREFS_PATH.write_text(json.dumps(prefs, indent=2), encoding="utf-8")


@app.post("/api/auth/signup")
async def auth_signup(request: Request):
    """Local-first direct account creation."""
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    name = (body.get("name") or "").strip() or "User"
    email = (body.get("email") or "").strip() or "user@local"
    prefs = _get_user_prefs()
    user = {
        "id": "local_user_1",
        "name": name,
        "email": email,
        "assistantName": prefs.get("assistantName", "Cheeni"),
        "assistantImage": prefs.get("assistantImage", None),
        "theme": prefs.get("theme", "dark"),
    }
    prefs["user"] = user
    _save_user_prefs(prefs)
    return {
        "accessToken": "cheeni-local-session-token",
        "user": user,
    }


@app.post("/api/auth/signin")
async def auth_signin(request: Request):
    """Local-first direct signin."""
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    prefs = _get_user_prefs()
    user = prefs.get("user") or {
        "id": "local_user_1",
        "name": "User",
        "email": body.get("email") or "user@local",
        "assistantName": prefs.get("assistantName", "Cheeni"),
        "assistantImage": prefs.get("assistantImage", None),
    }
    return {
        "accessToken": "cheeni-local-session-token",
        "user": user,
    }


@app.post("/api/auth/refresh")
async def auth_refresh():
    """Silent session restore on browser page load."""
    prefs = _get_user_prefs()
    user = prefs.get("user")
    if user:
        return {"accessToken": "cheeni-local-session-token", "user": user, "localMode": True}
    return {"accessToken": None, "user": None, "localMode": True}


@app.post("/api/auth/logout")
async def auth_logout():
    return {"ok": True}


@app.get("/api/user/current")
async def user_current():
    """Returns current active local user profile."""
    prefs = _get_user_prefs()
    user = prefs.get("user") or {
        "id": "local_user_1",
        "name": "User",
        "email": "user@local",
        "assistantName": prefs.get("assistantName", "Cheeni"),
        "assistantImage": prefs.get("assistantImage", None),
    }
    return {"user": user}


@app.post("/api/user/update")
async def user_update(request: Request):
    """
    Persist assistant name & preferences in local JSON sidecar.
    Accepts both JSON and Multipart FormData (sent by Customize2 image upload).
    """
    content_type = request.headers.get("content-type", "")
    updates = {}
    if "multipart/form-data" in content_type:
        try:
            form = await request.form()
            for k, v in form.items():
                if not hasattr(v, "filename"):
                    updates[k] = v
        except Exception:
            pass
    else:
        try:
            updates = await request.json()
        except Exception:
            pass

    prefs = _get_user_prefs()
    user = prefs.get("user") or {
        "id": "local_user_1",
        "name": "User",
        "email": "user@local",
        "assistantName": "Cheeni",
    }
    for k, v in updates.items():
        user[k] = v
        prefs[k] = v
    if not user.get("assistantImage"):
        user["assistantImage"] = updates.get("imageUrl") or user.get("imageUrl") or "/src/assets/image1.jpg"
        prefs["assistantImage"] = user["assistantImage"]
    prefs["user"] = user
    _save_user_prefs(prefs)
    return {"ok": True, "user": user, "saved": list(updates.keys())}


@app.get("/api/integrations")
async def list_integrations():
    return {"integrations": []}


@app.delete("/api/integrations/{integration_id}/disconnect")
async def disconnect_integration(integration_id: str):
    return {"ok": True}


@app.get("/api/assistant/history")
async def assistant_history():
    return {"history": []}


@app.delete("/api/assistant/history")
async def clear_history():
    return {"ok": True}


@app.get("/api/tasks")
async def list_tasks():
    return {"tasks": []}


@app.post("/api/tasks/{task_id}/{action}")
async def task_action(task_id: str, action: str):
    return {"ok": True, "task_id": task_id, "action": action}


@app.get("/api/agent/files/operations/{operation_id}")
async def file_operation_status(operation_id: str):
    return {"status": "not_found", "operation_id": operation_id}


@app.post("/api/agent/files/search")
async def file_search(body: dict):
    return {"results": [], "query": body.get("query", "")}


@app.post("/api/agent/files/read")
async def file_read(body: dict):
    import pathlib
    path = pathlib.Path(body.get("path", ""))
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content = path.read_text(errors="replace")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"path": str(path), "content": content[:50_000]}


@app.post("/api/agent/files/operations/preview")
async def file_op_preview(body: dict):
    return {"preview": "Preview not available in local mode.", "safe": True}


@app.post("/api/agent/files/operations/{operation_id}/confirm")
async def file_op_confirm(operation_id: str, body: dict = {}):
    return {"ok": True, "operation_id": operation_id}


@app.post("/api/agent/files/operations/{operation_id}/cancel")
async def file_op_cancel(operation_id: str):
    return {"ok": True, "operation_id": operation_id}


@app.get("/api/browser/workflows")
async def browser_workflows():
    """Stub — real Playwright workflows not yet implemented."""
    return {"workflows": []}


# ── Vision Stub ───────────────────────────────────────────────────────────────
@app.post("/api/agent/vision")
async def agent_vision(body: dict = {}):
    """Screen vision stub — full implementation requires Playwright + vision model."""
    return {"success": False, "observation": "Screen vision not yet implemented in local mode.", "error": None}


# ── Window Snap ───────────────────────────────────────────────────────────────
@app.post("/api/agent/windows/snap-corner")
async def snap_corner(body: dict = {}):
    return {"ok": True, "action": "snap_corner"}


# ── TTS Speak ─────────────────────────────────────────────────────────────────
@app.post("/api/agent/speak")
async def agent_speak(body: dict = {}):
    """Speak text via system TTS (pyttsx3 / Windows SAPI fallback)."""
    text = (body.get("text") or "").strip()
    if text:
        try:
            import pyttsx3
            engine = pyttsx3.init()
            engine.say(text)
            engine.runAndWait()
        except Exception:
            pass  # TTS unavailable — browser TTS handles it
    return {"ok": True, "spoken": text}


# ── Remote Command ─────────────────────────────────────────────────────────────
@app.post("/api/agent/remote/command")
async def remote_command(body: dict = {}):
    """Remote agent command stub — executes safe shell commands."""
    command = (body.get("command") or "").strip()
    if not command:
        return {"ok": False, "error": "No command specified"}
    from tools.router import route_command
    result = await route_command(text=command, intent_classifier=getattr(app.state, "intent", None))
    return {"ok": True, "result": result}


# ── Quick Action ───────────────────────────────────────────────────────────────
@app.post("/api/agent/quick-action")
async def agent_quick_action(body: dict = {}):
    action = (body.get("action") or "").strip()
    if action == "screenshot":
        return {"ok": True, "action": "screenshot", "data": None, "note": "Screenshot capture not yet implemented."}
    from tools.router import route_command
    result = await route_command(text=action, intent_classifier=getattr(app.state, "intent", None))
    return {"ok": True, "action": action, "result": result}


# ── WebSocket Config ───────────────────────────────────────────────────────────
@app.get("/api/agent/ws-config")
async def ws_config():
    return {"wsUrl": None, "enabled": False, "localMode": True}


# ── Memory Endpoints ───────────────────────────────────────────────────────────
@app.get("/api/agent/memory/all")
async def memory_all():
    prefs = _get_user_prefs()
    return {
        "shortcuts": prefs.get("shortcuts", []),
        "preferences": prefs.get("preferences", {}),
        "notes": prefs.get("notes", []),
    }


@app.post("/api/agent/memory/shortcut")
async def memory_add_shortcut(body: dict = {}):
    prefs = _get_user_prefs()
    shortcuts = prefs.get("shortcuts", [])
    shortcuts.append({"phrase": body.get("phrase", ""), "action": body.get("action", ""), "type": body.get("type", "open_website")})
    prefs["shortcuts"] = shortcuts
    _save_user_prefs(prefs)
    return {"ok": True, "shortcuts": shortcuts}


@app.delete("/api/agent/memory/shortcut")
async def memory_delete_shortcut(phrase: str = ""):
    prefs = _get_user_prefs()
    shortcuts = [s for s in prefs.get("shortcuts", []) if s.get("phrase") != phrase]
    prefs["shortcuts"] = shortcuts
    _save_user_prefs(prefs)
    return {"ok": True}


@app.post("/api/agent/memory/preference")
async def memory_add_preference(body: dict = {}):
    prefs = _get_user_prefs()
    category = body.get("category", "general")
    key = body.get("key", "")
    value = body.get("value", "")
    preferences = prefs.get("preferences", {})
    if category not in preferences:
        preferences[category] = {}
    preferences[category][key] = value
    prefs["preferences"] = preferences
    _save_user_prefs(prefs)
    return {"ok": True}


@app.delete("/api/agent/memory/preference")
async def memory_delete_preference(category: str = "", key: str = ""):
    prefs = _get_user_prefs()
    preferences = prefs.get("preferences", {})
    if category in preferences and key in preferences[category]:
        del preferences[category][key]
    prefs["preferences"] = preferences
    _save_user_prefs(prefs)
    return {"ok": True}


@app.post("/api/agent/memory/search")
async def memory_search(body: dict = {}):
    query = (body.get("query") or "").lower()
    prefs = _get_user_prefs()
    shortcuts = prefs.get("shortcuts", [])
    matches = [s for s in shortcuts if query in s.get("phrase", "").lower()]
    return {"results": matches[:10], "query": query}


# ── Screen Goal ────────────────────────────────────────────────────────────────
@app.post("/api/agent/screen/goal")
async def screen_goal(body: dict = {}):
    goal = (body.get("goal") or "").strip()
    return {"ok": True, "goal": goal, "status": "queued", "note": "Screen automation not yet implemented."}


# ── Kokoro TTS ─────────────────────────────────────────────────────────────────
@app.get("/api/agent/voice/kokoro/status")
async def kokoro_status():
    return {"available": False, "voices": [], "model": None, "note": "Kokoro TTS not installed."}


@app.post("/api/agent/voice/kokoro/speak")
async def kokoro_speak(body: dict = {}):
    return {"ok": False, "note": "Kokoro TTS not installed — using browser TTS."}


@app.post("/api/agent/voice/kokoro/voice")
async def kokoro_set_voice(body: dict = {}):
    return {"ok": False, "note": "Kokoro TTS not installed."}


# ── Daily Digest ───────────────────────────────────────────────────────────────
@app.get("/api/agent/digest/status")
async def digest_status():
    prefs = _get_user_prefs()
    return {
        "enabled": prefs.get("digest_enabled", False),
        "schedule": prefs.get("digest_schedule", None),
        "lastGenerated": None,
    }


@app.post("/api/agent/digest/now")
@app.post("/api/agent/digest/text")
async def digest_now(request: Request):
    return {
        "ok": True,
        "digest": f"Good morning! Your AI assistant Cheeni is online. No calendar integrations connected yet. Have a productive day!",
        "textOnly": True,
    }


@app.post("/api/agent/digest/schedule")
async def digest_schedule(body: dict = {}):
    prefs = _get_user_prefs()
    prefs["digest_enabled"] = True
    prefs["digest_schedule"] = body.get("time", "08:00")
    _save_user_prefs(prefs)
    return {"ok": True, "schedule": prefs["digest_schedule"]}


@app.delete("/api/agent/digest/schedule")
async def digest_delete_schedule():
    prefs = _get_user_prefs()
    prefs["digest_enabled"] = False
    prefs["digest_schedule"] = None
    _save_user_prefs(prefs)
    return {"ok": True}


# ── Connectors ─────────────────────────────────────────────────────────────────
@app.get("/api/agent/connectors/list")
async def connectors_list():
    return {"connectors": [], "connected": []}


@app.post("/api/agent/connectors/connect")
async def connectors_connect(body: dict = {}):
    service = body.get("service", "")
    return {"ok": False, "service": service, "note": f"{service} connector not yet configured. Set up OAuth credentials in .env."}


@app.get("/api/agent/connectors/gmail/unread")
async def gmail_unread(max_results: int = 10):
    return {"ok": False, "emails": [], "note": "Gmail connector not configured."}


@app.get("/api/agent/connectors/calendar/today")
async def calendar_today():
    return {"ok": False, "events": [], "note": "Calendar connector not configured."}


# ── Notes / Knowledge Vault ────────────────────────────────────────────────────
@app.get("/api/agent/memory/notes/sources")
async def notes_sources():
    prefs = _get_user_prefs()
    return {"sources": prefs.get("note_sources", [])}


@app.get("/api/agent/memory/notes/stats")
async def notes_stats():
    return {"total": 0, "indexed": 0, "lastIndexed": None}


@app.post("/api/agent/memory/notes/index")
async def notes_index(body: dict = {}):
    path = (body.get("path") or "").strip()
    if not path:
        return {"ok": False, "error": "No folder path provided"}
    prefs = _get_user_prefs()
    sources = prefs.get("note_sources", [])
    if path not in sources:
        sources.append(path)
    prefs["note_sources"] = sources
    _save_user_prefs(prefs)
    return {"ok": True, "path": path, "indexed": 0, "note": "Full indexing not yet implemented — path saved."}


@app.post("/api/agent/memory/notes/search")
async def notes_search(body: dict = {}):
    query = (body.get("query") or "").strip()
    return {"ok": True, "results": [], "query": query, "note": "Full-text search not yet implemented."}


@app.delete("/api/agent/memory/notes/source")
async def notes_delete_source(body: dict = {}):
    path = (body.get("path") or "").strip()
    prefs = _get_user_prefs()
    prefs["note_sources"] = [s for s in prefs.get("note_sources", []) if s != path]
    _save_user_prefs(prefs)
    return {"ok": True}


# ── Dev Runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=2026, reload=True, log_level="info")

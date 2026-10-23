"""
Cheeni Desktop Agent -- LLM Router (V14)
Tries LLM backends in priority order with automatic fallback:

  1. Node Backend   (has user auth + full conversation memory)
  2. OpenRouter     (cloud, fast, free models)
  3. Gemini API     (Google, direct)
  4. Local Ollama   (fully offline — phi3:mini or mistral:7b)

Usage:
    from core.llm_router import call_llm
    text = await call_llm(messages=[{"role":"user","content":"hello"}], system="You are Sam")

Each backend is tried; on failure the next is attempted.
The active backend is exposed via get_active_backend() for dashboard/telemetry.
"""

import os
import asyncio
import httpx
from utils.logging import logger
from config.settings import settings

# -- Ollama config (read from .env)
OLLAMA_HOST    = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL   = os.getenv("OLLAMA_MODEL", "phi3:mini")
OLLAMA_ENABLED = os.getenv("OLLAMA_ENABLED", "true").lower() != "false"
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT_SEC", "60"))

# Tracks which backend was last used
_last_active_backend: str = "unknown"


def get_active_backend() -> str:
    return _last_active_backend


# ── Public entry point ────────────────────────────────────────────────────────

async def call_llm(
    messages: list[dict],
    system: str = "",
    max_tokens: int = 300,
    temperature: float = 0.75,
    timeout: float = 20.0,
) -> str | None:
    """
    Call the best available LLM backend in priority order.
    Returns the response text, or None if all backends fail.
    """
    global _last_active_backend

    # 1 -- Node Backend
    try:
        result = await _call_node_backend(messages, system, timeout)
        if result:
            _last_active_backend = "node_backend"
            return result
    except Exception as e:
        logger.debug(f"[LLMRouter] Node backend failed: {e}")

    # 2 -- OpenRouter
    try:
        result = await _call_openrouter(messages, system, max_tokens, temperature, timeout)
        if result:
            _last_active_backend = "openrouter"
            return result
    except Exception as e:
        logger.debug(f"[LLMRouter] OpenRouter failed: {e}")

    # 3 -- Gemini API direct
    try:
        result = await _call_gemini(messages, system, max_tokens, timeout)
        if result:
            _last_active_backend = "gemini"
            return result
    except Exception as e:
        logger.debug(f"[LLMRouter] Gemini failed: {e}")

    # 4 -- Local Ollama (offline fallback)
    if OLLAMA_ENABLED:
        try:
            result = await _call_ollama(messages, system)
            if result:
                _last_active_backend = "ollama_local"
                return result
        except Exception as e:
            logger.warning(f"[LLMRouter] Ollama failed: {e}")

    _last_active_backend = "none"
    logger.error("[LLMRouter] All LLM backends exhausted.")
    return None


# ── Backend implementations ───────────────────────────────────────────────────

async def _call_node_backend(messages: list[dict], system: str, timeout: float) -> str | None:
    """Forward to Cheeni Node backend /api/assistant/chat."""
    url = f"{settings.NODE_BACKEND_URL}/api/assistant/chat"
    # Extract last user message as the primary prompt
    user_msg = next(
        (m["content"] for m in reversed(messages) if m.get("role") == "user"), ""
    )
    if not user_msg:
        return None
    history = [m for m in messages if m.get("role") != "system"]
    payload = {
        "message": user_msg,
        "history": history[:-1],
        "agentMode": True,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            text = (
                data.get("speechText")
                or data.get("textResponse")
                or data.get("response")
                or data.get("message")
            )
            return str(text).strip() if text else None
    return None


async def _call_openrouter(
    messages: list[dict],
    system: str,
    max_tokens: int,
    temperature: float,
    timeout: float,
) -> str | None:
    """Call OpenRouter API."""
    api_key = settings.OPENROUTER_API_KEY
    if not api_key:
        return None
    full_messages = (
        [{"role": "system", "content": system}] if system else []
    ) + [m for m in messages if m.get("role") != "system"]
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "HTTP-Referer": "http://localhost:5173",
                "X-Title": "Cheeni AI Agent",
            },
            json={
                "model": settings.OPENROUTER_MODEL,
                "messages": full_messages,
                "max_tokens": max_tokens,
                "temperature": temperature,
            },
        )
        if resp.status_code == 200:
            choices = resp.json().get("choices") or []
            if choices:
                content = (choices[0].get("message") or {}).get("content")
                return str(content).strip() if content else None
    return None


async def _call_gemini(
    messages: list[dict],
    system: str,
    max_tokens: int,
    timeout: float,
) -> str | None:
    """Call Google Gemini REST API directly."""
    api_key = settings.GEMINI_API_KEY
    if not api_key:
        return None
    model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    # Build Gemini content format
    contents = []
    if system:
        contents.append({"role": "user", "parts": [{"text": f"[System]: {system}"}]})
        contents.append({"role": "model", "parts": [{"text": "Understood."}]})
    for m in messages:
        role = "user" if m.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})

    payload = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.75},
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.post(url, json=payload)
        if resp.status_code == 200:
            data = resp.json()
            try:
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                return text.strip() if text else None
            except (KeyError, IndexError):
                pass
    return None


async def _call_ollama(messages: list[dict], system: str) -> str | None:
    """Call local Ollama instance (fully offline)."""
    full_messages = []
    if system:
        full_messages.append({"role": "system", "content": system})
    full_messages.extend(m for m in messages if m.get("role") != "system")

    payload = {
        "model": OLLAMA_MODEL,
        "messages": full_messages,
        "stream": False,
    }
    logger.info(f"[LLMRouter] Trying Ollama ({OLLAMA_MODEL}) at {OLLAMA_HOST}...")
    async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
        resp = await client.post(f"{OLLAMA_HOST}/api/chat", json=payload)
        if resp.status_code == 200:
            content = resp.json().get("message", {}).get("content")
            if content:
                logger.info(f"[LLMRouter] Ollama response: {content[:80]}")
                return content.strip()
    return None


# ── Status endpoint helper ────────────────────────────────────────────────────

async def get_llm_status() -> dict:
    """Check which backends are reachable right now."""
    status = {"active_backend": _last_active_backend}

    # Check Ollama
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{OLLAMA_HOST}/api/tags")
            models = [m["name"] for m in r.json().get("models", [])]
            status["ollama"] = {"reachable": True, "models": models}
    except Exception:
        status["ollama"] = {"reachable": False, "models": []}

    # Check Node backend
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{settings.NODE_BACKEND_URL}/api/health")
            status["node_backend"] = {"reachable": r.status_code < 500}
    except Exception:
        status["node_backend"] = {"reachable": False}

    status["openrouter"] = {"configured": bool(settings.OPENROUTER_API_KEY)}
    status["gemini"] = {"configured": bool(settings.GEMINI_API_KEY)}
    return status

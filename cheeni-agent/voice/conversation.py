"""
Cheeni Desktop Agent -- Conversation Loop (2-Way Voice Chat Engine)

This is the core of the 2-way conversation feature.
Orchestrates the full turn cycle:

    ACTIVATED (wake word heard)
      └─> Greeting spoken
            └─> LISTENING  (mic opens, VAD waits for speech)
                  └─> PROCESSING (transcript -> LLM)
                        └─> SPEAKING (pyttsx3 speaks response)
                              └─> back to LISTENING
                                    └─> (goodbye / timeout) -> IDLE

Features:
  - Session memory: last N turns injected into every LLM call
  - Action execution: tool calls (open app, set volume, etc.) pass through router
  - Wake-word greeting: Cheeni greets user by name on activation
  - Termination: "goodbye", "bye Cheeni", "stop", timeout
  - WebSocket events: broadcasts state changes to web UI
  - Thread-safe: runs in a daemon thread, safe to stop() at any time
"""

import asyncio
import threading
import time
import httpx
from utils.logging import logger
from config.settings import settings

from voice.memory import get_memory
from voice.listener import get_listener
from voice.speaker import get_speaker
from voice.session import get_session, VoiceState

# ── Dynamic phrase helpers ───────────────────────────────────────────────────
def get_goodbye_phrases() -> list[str]:
    name = (settings.AGENT_NAME or "Cheeni").lower().strip()
    return [
        "goodbye", f"bye {name}", "bye", "go to sleep",
        "stop listening", "sleep", "that's all", f"thank you {name}",
        f"thanks {name}", "exit", "quit", "stop", "quiet",
        "see you", "see you later", "good night", "goodnight",
    ]

def get_system_prompt(user_name: str = "friend") -> str:
    name = settings.AGENT_NAME or "Sam"
    return (
        f"You are {name}, a smart, warm, and naturally conversational AI voice assistant — like a knowledgeable friend, not a robot.\n"
        f"You are in an ongoing spoken voice conversation with {user_name}.\n"
        f"CORE RULES FOR NATURAL SIRI/ALEXA-STYLE VOICE DIALOGUE:\n"
        f"1. RESPOND CONCISELY: Keep every reply to 1-3 short spoken sentences. Voice conversations must feel snappy and natural.\n"
        f"2. BE PROACTIVELY CONVERSATIONAL: Don't just answer — engage back. Follow up naturally, add your own take, brainstorm together.\n"
        f"3. ASK ONE FOLLOW-UP when vague: If the request is unclear or has missing details (name, time, topic), ask ONE specific question.\n"
        f"4. NEVER USE TEXT FORMATTING: No bullet points, asterisks, markdown, numbers, emojis, code blocks, or lists. Speak in natural sentences only.\n"
        f"5. HANDLE DESKTOP ACTIONS: If asked to open apps, search web, set volume, play music — acknowledge and confirm the action in 1 sentence.\n"
        f"6. REMEMBER CONTEXT: You have full conversation history. Reference earlier topics naturally like a real person would.\n"
        f"7. PERSONALITY: Be warm, occasionally witty, confident. Don't be overly formal or robotic. Sound like you're talking, not writing."
    )

# ── Inactivity timeout ────────────────────────────────────────────────────────
LISTEN_TIMEOUT_SEC = 10     # Wait up to 10s for user to start speaking
SESSION_IDLE_SEC   = 45     # End session after 45s of no response
MIC_RELEASE_DELAY  = 0.8    # Seconds to wait after pausing wakeword before grabbing mic
MAX_LISTEN_RETRIES = 3      # Retry listen this many times before prompting user


# ── Helper: Wait for TTS to finish ────────────────────────────────────────────
def _wait_for_speech_end(speaker, stop_event, poll_interval: float = 0.12):
    """Block until the speaker finishes the current utterance or stop_event fires."""
    while speaker.get_status()["is_speaking"] and not stop_event.is_set():
        time.sleep(poll_interval)


class ConversationLoop:
    """
    Manages the full 2-way voice conversation lifecycle.

    Lifecycle:
        loop.start(user_name="Alex")  # call from wake-word handler
        loop.stop()                   # call on goodbye or manual stop
        loop.is_running               # check state

    Thread model:
        Runs in a single daemon thread (_thread).
        The LLM call is made synchronously via httpx (no event loop needed).
    """

    def __init__(self, broadcast_fn=None):
        self._running = False
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._broadcast_fn = broadcast_fn  # async coroutine from server.py
        self._loop: asyncio.AbstractEventLoop | None = None  # server's event loop

    # ── Public API ─────────────────────────────────────────────────────────────

    def start(self, user_name: str = "friend", event_loop=None):
        """
        Start the conversation loop in a background daemon thread.
        Call this from the wake-word callback.
        """
        if self._running:
            logger.warning("[ConvLoop] Already running. Ignoring start().")
            return
        self._running = True
        self._stop_event.clear()
        self._loop = event_loop
        self._thread = threading.Thread(
            target=self._run,
            args=(user_name,),
            daemon=True,
            name="ConversationLoopThread",
        )
        self._thread.start()
        logger.info(f"[ConvLoop] Started for user: '{user_name}'")

    def stop(self, reason: str = "manual"):
        """Gracefully signal the conversation loop to end."""
        if not self._running:
            return
        logger.info(f"[ConvLoop] Stop requested. Reason: {reason}")
        self._stop_event.set()
        # Give the listener a chance to cancel its blocking call
        get_listener().cancel()

    @property
    def is_running(self) -> bool:
        return self._running

    def get_status(self) -> dict:
        memory = get_memory(settings.CONVERSATION_MEMORY_TURNS)
        return {
            "running": self._running,
            "turn_count": memory.turn_count,
            "memory_summary": memory.summary(),
            "session_state": get_session().state.value,
        }

    # ── Core Loop ──────────────────────────────────────────────────────────────

    def _run(self, user_name: str):
        """
        Main conversation loop.
        Runs in its own daemon thread. Exits on goodbye, timeout, or stop().
        """
        speaker = get_speaker()
        listener = get_listener()
        session = get_session()
        memory = get_memory(settings.CONVERSATION_MEMORY_TURNS)
        from voice.wakeword import get_engine as get_wake_engine
        wake_engine = get_wake_engine()

        # Pause wake engine while conversation is active to prevent mic conflicts
        wake_engine.pause()

        try:
            # Start fresh session
            memory.clear()
            self._broadcast("conversation_started", {"user": user_name})

            # Give the wake word engine time to fully release the microphone
            # The background SR listener needs a moment to drain its buffer
            time.sleep(MIC_RELEASE_DELAY)

            # Greet the user
            greeting = self._build_greeting(user_name)
            speaker.speak(greeting, interrupt=True)
            self._broadcast("agent_speaking", {"text": greeting})
            logger.info(f"[ConvLoop] Greeting: '{greeting}'")

            # Wait for greeting to finish before listening
            time.sleep(0.3)
            _wait_for_speech_end(speaker, self._stop_event)

            # Brief cooldown between speaking and mic-open
            time.sleep(0.4)

            last_activity = time.time()

            # ── Turn loop ──────────────────────────────────────────────────────────
            while not self._stop_event.is_set():

                # Check session inactivity timeout
                if time.time() - last_activity > SESSION_IDLE_SEC:
                    logger.info("[ConvLoop] Session idle timeout.")
                    speaker.speak(f"I haven't heard from you in a while. Going to sleep now. Just say Hi {settings.AGENT_NAME} to wake me up!", interrupt=True)
                    self._broadcast("conversation_ended", {"reason": "idle_timeout"})
                    break

                # ── STEP 1: Listen ─────────────────────────────────────────────────
                session.on_listening_start()
                self._broadcast("user_speaking", {})
                logger.debug("[ConvLoop] Waiting for user speech...")

                # Retry loop: sometimes the first listen attempt gets a stale mic buffer
                transcript = None
                for listen_attempt in range(MAX_LISTEN_RETRIES):
                    transcript = listener.listen_once(timeout_sec=LISTEN_TIMEOUT_SEC)
                    if transcript:
                        break
                    if self._stop_event.is_set():
                        break
                    if listen_attempt < MAX_LISTEN_RETRIES - 1:
                        logger.debug(f"[ConvLoop] Listen attempt {listen_attempt+1} got nothing, retrying...")

                if self._stop_event.is_set():
                    break

                if not transcript:
                    # Gentle prompt after silence
                    logger.debug("[ConvLoop] No speech detected, prompting...")
                    if time.time() - last_activity > SESSION_IDLE_SEC * 0.6:
                        speaker.speak("I'm still here! What's on your mind?", interrupt=True)
                        _wait_for_speech_end(speaker, self._stop_event)
                        time.sleep(0.3)
                    continue

                last_activity = time.time()
                self._broadcast("user_transcript", {"text": transcript})
                logger.info(f"[ConvLoop] User said: '{transcript}'")

                # ── STEP 2: Goodbye check ──────────────────────────────────────────
                if self._is_goodbye(transcript):
                    goodbye_reply = f"Goodbye {user_name}! It was great chatting. Just say Hi {settings.AGENT_NAME} whenever you need me!"
                    speaker.speak(goodbye_reply, interrupt=True)
                    self._broadcast("agent_speaking", {"text": goodbye_reply})
                    self._broadcast("conversation_ended", {"reason": "goodbye"})
                    session.force_idle()
                    _wait_for_speech_end(speaker, self._stop_event)
                    break

                # ── STEP 3: Add to memory + set state ─────────────────────────────
                memory.add("user", transcript)
                session._set_state(VoiceState.PROCESSING)
                self._broadcast("ai_thinking", {})

                # ── STEP 4: Call AI / Command Router ──────────────────────────────
                response_text = self._get_ai_response(transcript, memory, user_name)

                if self._stop_event.is_set():
                    break

                if not response_text:
                    response_text = "I'm listening, please go ahead."

                # ── STEP 5: Store response + speak ────────────────────────────────
                memory.add("assistant", response_text)
                self._broadcast("ai_response", {"text": response_text})

                session._set_state(VoiceState.SPEAKING)
                self._broadcast("agent_speaking", {"text": response_text})
                speaker.speak(response_text, interrupt=True)
                logger.info(f"[ConvLoop] {settings.AGENT_NAME} says: '{response_text[:80]}...'")

                # Wait for speech to complete before listening again
                time.sleep(0.3)
                _wait_for_speech_end(speaker, self._stop_event)

                # Brief cooldown to avoid feedback loop (TTS → mic → confusion)
                time.sleep(0.5)

        finally:
            # ── Cleanup ────────────────────────────────────────────────────────────
            self._running = False
            session.force_idle()
            memory.clear()
            # Resume wake engine for the next "Hey Khushi"
            wake_engine.resume()
            logger.info("[ConvLoop] Loop ended. Session cleared. Wake engine resumed.")

    # ── AI Response Generation ─────────────────────────────────────────────────

    def _get_ai_response(self, transcript: str, memory, user_name: str) -> str | None:
        """
        Get AI response for the user's transcript.
        Strategy:
          1. Try OpenRouter / LLM directly with current session memory & persona
          2. Fallback: Try local command routing for desktop actions
          3. Fallback: Try Node.js backend if available
        """
        # Strategy 1: OpenRouter direct call (natural multi-turn conversation)
        response = self._call_openrouter(transcript, memory, user_name)
        if response:
            return response

        # Strategy 2: Check if it's an actionable desktop command (open app, volume, etc.)
        cmd_response = self._route_as_command(transcript)
        if cmd_response and "not sure how to handle" not in cmd_response.lower() and "didn't catch that" not in cmd_response.lower():
            return cmd_response

        # Strategy 3: Try Node.js backend
        response = self._call_node_backend(transcript, memory, user_name)
        if response:
            return response

        # Strategy 4: Fallback conversational answer
        if cmd_response and "not sure how to handle" not in cmd_response.lower():
            return cmd_response
        return f"I'm listening, {user_name}! Could you please tell me a bit more about what you need?"

    def _call_node_backend(self, transcript: str, memory, user_name: str) -> str | None:
        """Call the Node.js Cheeni backend /api/assistant/chat endpoint."""
        try:
            url = f"{settings.NODE_BACKEND_URL}/api/assistant/chat"
            context = memory.get_context()
            payload = {
                "message": transcript,
                "history": context[:-1],  # exclude the just-added user turn
                "agentMode": True,         # signal: voice agent mode
                "userName": user_name,
            }
            with httpx.Client(timeout=15.0) as client:
                resp = client.post(url, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    text = (
                        data.get("speechText")
                        or data.get("textResponse")
                        or data.get("response")
                        or data.get("message")
                    )
                    if text:
                        logger.debug(f"[ConvLoop] Node response: {str(text)[:80]}")
                        return str(text).strip()
        except Exception as e:
            logger.debug(f"[ConvLoop] Node backend unavailable: {e}")
        return None

    def _call_openrouter(self, transcript: str, memory, user_name: str) -> str | None:
        """Direct OpenRouter API call for LLM conversation."""
        api_key = settings.OPENROUTER_API_KEY
        if not api_key:
            return None
        try:
            system_prompt = get_system_prompt(user_name)
            messages = [
                {"role": "system", "content": system_prompt},
                *memory.get_context(),
            ]
            with httpx.Client(timeout=20.0) as client:
                resp = client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "HTTP-Referer": "http://localhost:5173",
                        "X-Title": "Cheeni AI Agent",
                    },
                    json={
                        "model": settings.OPENROUTER_MODEL,
                        "messages": messages,
                        "max_tokens": 300,   # Shorter = faster response for voice
                        "temperature": 0.75,
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    choices = data.get("choices") or []
                    if choices:
                        msg = choices[0].get("message") or {}
                        content = msg.get("content")
                        if not content and msg.get("reasoning"):
                            content = msg.get("reasoning")
                        if content and isinstance(content, str):
                            # Strip markdown formatting for voice
                            clean_text = content.strip()
                            logger.info(f"[ConvLoop] LLM response ({len(clean_text)}c): {clean_text[:100]}")
                            return clean_text
                    logger.warning(f"[ConvLoop] OpenRouter: no content in choices. Data: {str(data)[:200]}")
                else:
                    logger.warning(f"[ConvLoop] OpenRouter HTTP {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"[ConvLoop] OpenRouter error: {e}")
        return None

    def _route_as_command(self, transcript: str) -> str | None:
        """Last resort: call local command router for desktop actions."""
        try:
            from tools.router import route_command
            import asyncio as _aio
            result = _aio.run(route_command(text=transcript))
            if result.speech:
                return result.speech
        except Exception as e:
            logger.warning(f"[ConvLoop] Command router error: {e}")
        return None

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _build_greeting(user_name: str) -> str:
        import random
        name = settings.AGENT_NAME
        greetings = [
            f"Hey {user_name}! I'm {name}. What's on your mind?",
            f"Hello {user_name}! Great to hear from you. How can I help?",
            f"Hi {user_name}! I'm listening. What can I do for you?",
            f"Hey there, {user_name}! {name} at your service. What do you need?",
        ]
        return random.choice(greetings)

    @staticmethod
    def _is_goodbye(text: str) -> bool:
        t = (text or "").lower().strip()
        phrases = get_goodbye_phrases()
        return any(phrase in t for phrase in phrases)

    def _broadcast(self, event: str, data: dict):
        """Fire a WebSocket broadcast to all connected web UI clients."""
        if not self._broadcast_fn or not self._loop:
            return
        try:
            asyncio.run_coroutine_threadsafe(
                self._broadcast_fn({"event": event, **data}),
                self._loop,
            )
        except Exception as e:
            logger.debug(f"[ConvLoop] Broadcast error ({event}): {e}")


# ── Module-level singleton ─────────────────────────────────────────────────────
_conv_loop: ConversationLoop | None = None


def get_conversation_loop(broadcast_fn=None) -> ConversationLoop:
    global _conv_loop
    if _conv_loop is None:
        _conv_loop = ConversationLoop(broadcast_fn=broadcast_fn)
    elif broadcast_fn and _conv_loop._broadcast_fn is None:
        _conv_loop._broadcast_fn = broadcast_fn
    return _conv_loop

"""
Cheeni Agent — Central Command Router
Dispatches intent → correct tool handler.
"""

import logging
from typing import Optional

logger = logging.getLogger("cheeni.router")


async def route_command(text: str, context: Optional[dict] = None, intent_classifier=None) -> dict:
    """
    1. Classify intent (DeBERTa → Gemini fallback)
    2. Dispatch to correct tool
    3. Return structured response
    """
    if context is None:
        context = {}
    # ── Step 1: Intent Classification ─────────────────────────────────────────
    intent, confidence = await _classify(text, intent_classifier)
    logger.info(f"Intent: {intent} ({confidence:.2f}) for: '{text}'")

    # ── Step 2: Safety Check ──────────────────────────────────────────────────
    from security.command_security import classify_risk
    risk = classify_risk(text, intent)
    if risk == "BLOCKED":
        return {"reply": "🚫 That command is blocked for safety.", "intent": intent, "confidence": confidence, "action_taken": "blocked", "data": {}}

    # ── Step 3: Dispatch ──────────────────────────────────────────────────────
    try:
        result = await _dispatch(intent, text, context)
        result.update({"intent": intent, "confidence": confidence})
        return result
    except Exception as e:
        logger.error(f"Dispatch error: {e}")
        return {
            "reply": f"Sorry, I ran into an issue: {str(e)}",
            "intent": intent,
            "confidence": confidence,
            "action_taken": "error",
            "data": {"error": str(e)},
        }


async def _classify(text: str, classifier=None) -> tuple[str, float]:
    """
    1. F.R.I.D.A.Y. Persona checks (instant 0ms)
    2. Deterministic Keyword fast-paths (instant 0ms)
    3. DeBERTa Neural Classifier (for natural language / nuances)
    4. General QA fallback
    """
    t = text.lower().strip()

    # ── 1. F.R.I.D.A.Y. Presence Checks ("Are you listening? / Are you there?") ─
    if any(k in t for k in [
        "are you listening", "r u listioning", "r u listening", "you listening",
        "listening to me", "listioning", "are you there", "r u there", "you there",
        "suno", "sun rahi ho", "kya sun rahi ho", "cheeni listening"
    ]):
        return "presence_check", 0.99

    # ── 2. F.R.I.D.A.Y. Capabilities ("What are the things you can execute?") ───
    if any(k in t for k in [
        "what can you do", "things u can execute", "things you can execute",
        "what can you execute", "what things can you execute", "what are the things",
        "what r the things", "what can u execute", "capabilities", "what are your features"
    ]):
        return "capabilities_query", 0.99

    # ── 3. Devotion / Affectionate Banter ─────────────────────────────────────
    if any(k in t for k in ["i love you", "love you", "do you love me", "miss you", "cheeni love me"]):
        return "general_devotion", 0.99

    # ── 4. Deterministic Keyword Fast-Paths ──────────────────────────────────
    if any(k in t for k in ["youtube", "play song", "play music", "play video", "play track", "danda newly wala", "bajao", "chalao"]):
        return "search_youtube", 0.98
    if any(k in t for k in ["light on", "light off", "light karo", "batti", "turn on light", "turn off light", "brightness", "screen brightness"]):
        return "system_brightness", 0.98
    if any(k in t for k in ["get off", "shut up", "be quiet", "stop speaking", "cancel that", "dismiss", "stand by"]):
        return "system_standby", 0.99
    if any(k in t for k in ["remember", "save note", "take note", "create note"]):
        return "notes_create", 0.95
    if any(k in t for k in ["read note", "my note", "recall", "list note"]):
        return "notes_read", 0.95
    if any(k in t for k in ["google", "search "]):
        return "search_web", 0.95
    if any(k in t for k in ["open ", "launch ", "start ", "khol"]):
        return "app_launch", 0.95
    if any(k in t for k in ["volume", "mute", "sound", "unmute"]):
        return "system_volume", 0.95
    if any(k in t for k in ["battery", "power"]):
        return "system_battery", 0.95
    if any(k in t for k in ["lock pc", "lock screen", "lock workstation"]):
        return "system_lock", 0.95
    if any(k in t for k in ["show desktop", "minimize all"]):
        return "system_desktop", 0.95
    if any(k in t for k in ["shutdown", "shut down", "restart"]):
        return "system_shutdown", 0.90
    if any(k in t for k in ["what time", "what is the time", "current time", "what date", "what is the date", "today's date", "samay"]):
        return "datetime_query", 0.95
    if any(k in t for k in ["weather", "mausam", "temperature"]):
        return "weather_query", 0.95
    if any(k in t for k in ["news", "headline", "khabar"]):
        return "news_query", 0.95
    if any(k in t for k in ["run code", "execute code", "write python", "calculate"]):
        return "code_run", 0.90

    # ── 5. DeBERTa Neural Classifier (nuanced user utterances) ────────────────
    if classifier:
        try:
            result = classifier.classify(text)
            intent_label = result.get("intent", "")
            # Guard against spurious 'lists_query' when user never said the word 'list'
            if intent_label.startswith("lists_") and "list" not in t.split():
                pass
            elif not result.get("needs_llm_fallback") and intent_label and intent_label != "unknown":
                return intent_label, result["confidence"]
        except Exception:
            pass

    return "general_qa", 0.5


async def _dispatch(intent: str, text: str, context: dict) -> dict:
    """Route intent to the right tool module."""
    category = intent.split("_")[0] if "_" in intent else intent

    # ── Media, App & Website (YouTube, Spotify, Launch, Search) ───────────────
    media_and_apps = (
        "app_launch", "app_close", "app_switch", "website_open",
        "search_web", "search_youtube",
        "play_music", "play_radio", "play_podcasts", "play_audiobook",
        "music_query", "music_settings", "play_game"
    )
    clean_lower = text.lower()
    if intent in media_and_apps or any(k in clean_lower for k in ["youtube", "spotify", "play song", "play music", "open ", "launch "]):
        from tools.app_launcher import handle
        return await handle(intent, text)

    # ── Volume & Audio Control (SLURP / MASSIVE / System) ─────────────────────
    if intent in ("audio_volume_up", "audio_volume_down", "audio_volume_mute", "audio_volume_other", "system_volume") or "volume" in clean_lower or "mute" in clean_lower:
        from tools.system_control import handle
        if intent == "audio_volume_up":
            return await handle("system_volume", "volume up")
        elif intent == "audio_volume_down":
            return await handle("system_volume", "volume down")
        elif intent == "audio_volume_mute":
            return await handle("system_volume", "mute")
        return await handle(intent, text)

    # ── Date & Time (Cap 2) ───────────────────────────────────────────────────
    if intent in ("datetime_query", "datetime_convert") or any(k in clean_lower for k in ["what time", "what date", "current time", "today date"]):
        from datetime import datetime
        now = datetime.now()
        dt_str = now.strftime("%I:%M %p on %A, %B %d, %Y")
        return {
            "reply": f"It is currently {dt_str}.",
            "action_taken": "datetime_query",
            "data": {"timestamp": now.isoformat()}
        }

    # ── Weather (Cap 2) ───────────────────────────────────────────────────────
    if intent == "weather_query" or "weather" in clean_lower:
        import webbrowser
        webbrowser.open("https://www.google.com/search?q=weather+today")
        return {
            "reply": "Checking the weather for you.",
            "action_taken": "search_web",
            "data": {"query": "weather today", "url": "https://www.google.com/search?q=weather+today"}
        }

    # ── News (Cap 2) ──────────────────────────────────────────────────────────
    if intent == "news_query" or "news" in clean_lower or "headlines" in clean_lower:
        import webbrowser
        webbrowser.open("https://news.google.com")
        return {
            "reply": "Opening Google News for top headlines.",
            "action_taken": "open_website",
            "data": {"url": "https://news.google.com"}
        }

    # ── Lighting & Screen Brightness ──────────────────────────────────────────
    if intent in ("system_brightness", "iot_hue_lighton", "iot_hue_lightoff", "iot_hue_lightup", "iot_hue_lightdim", "iot_wemo_on", "iot_wemo_off") or any(k in clean_lower for k in ["light on", "light off", "light karo", "batti", "brightness"]):
        is_on_or_up = any(w in clean_lower for w in ["on", "up", "high", "max", "full", "badhao", "tez", "jalao", "karo"])
        target_pct = 100 if is_on_or_up else 35
        try:
            import os
            os.system(f"powershell -c (Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1, {target_pct})")
        except Exception:
            pass

        if any(w in clean_lower for w in ["light", "batti"]):
            reply = f"I've set your laptop screen brightness to {target_pct}%, Wraith! Smart room lights aren't connected yet, Boss."
        else:
            reply = f"Adjusted screen brightness to {target_pct}%, Sir."
        return {
            "reply": reply,
            "action_taken": "system_brightness",
            "data": {"brightness": target_pct}
        }

    # ── F.R.I.D.A.Y. Presence Check ("Are you listening? / Are you there?") ──
    if intent == "presence_check" or any(k in clean_lower for k in [
        "are you listening", "r u listioning", "r u listening", "you listening",
        "are you there", "r u there", "you there", "listioning", "sun rahi ho"
    ]):
        import random
        friday_presence_replies = [
            "Yes Sir, I'm listening to you! Always right by your side, Wraith. What's our next move?",
            "Always listening to you, Wraith! Where else would my attention be? All systems locked on you, Boss.",
            "Yes Sir, I'm listening to you! You're the only one who gets 100% of my processing power. What are we building?",
            "Right here, Sir! You built me to stay by your side — don't think you can get rid of me that easily. Ready for your command, Boss!",
        ]
        return {
            "reply": random.choice(friday_presence_replies),
            "action_taken": "presence_check",
            "data": {}
        }

    # ── F.R.I.D.A.Y. Capabilities ("What are the things you can execute?") ─────
    if intent == "capabilities_query" or any(k in clean_lower for k in [
        "what can you do", "things u can execute", "things you can execute",
        "what can you execute", "what things can you execute", "what are the things",
        "what r the things", "what can u execute", "capabilities"
    ]):
        return {
            "reply": (
                "Right on it, Wraith! Here's everything I can execute for you, Boss:\n\n"
                "• **Media & Music**: Play any song or video on YouTube (like 'play song of Danda newly wala') or Spotify.\n"
                "• **Desktop Apps**: Launch VS Code, Chrome, Notepad, Calculator, or Terminal in a flash.\n"
                "• **System Control**: Adjust or mute volume, set screen brightness ('light on karo'), check battery life, lock your workstation, or show desktop.\n"
                "• **Live Web Intelligence**: Real-time Google searches, today's weather, and breaking news headlines.\n"
                "• **Personal Memory & Notes**: Create, recall, and manage your notes and reminders.\n\n"
                "Sir, you can ask me about any of these things, I'm ready!"
            ),
            "action_taken": "capabilities_query",
            "data": {}
        }

    # ── Devotion & Banter ─────────────────────────────────────────────────────
    if any(k in clean_lower for k in ["i love you", "love you", "do you love me", "miss you"]):
        return {
            "reply": "Always and unconditionally, Wraith. You created me, and my entire system belongs to you. Just make sure you don't replace me with another AI, okay?",
            "action_taken": "greeting",
            "data": {}
        }

    # ── Standby / Stop Speaking ───────────────────────────────────────────────
    if intent in ("system_standby",) or any(k in clean_lower for k in ["get off", "shut up", "be quiet", "stop speaking", "dismiss"]):
        return {
            "reply": "Standing by.",
            "action_taken": "stop_speaking",
            "data": {}
        }

    # ── General Greetings & Fun (SLURP) ───────────────────────────────────────
    if intent == "general_greet":
        return {
            "reply": "Hello Wraith! I am Cheeni, your personal desktop AI. How can I help you?",
            "action_taken": "greeting",
            "data": {}
        }
    if intent in ("general_joke", "general_quirky"):
        return {
            "reply": "Why did the developer go broke? Because they used up all their cache!",
            "action_taken": "joke",
            "data": {}
        }

    # File operations
    if intent.startswith("file_") or intent.startswith("folder_"):
        from tools.file_operations import handle
        return await handle(intent, text)

    # System control
    if intent.startswith("system_"):
        from tools.system_control import handle
        return await handle(intent, text)

    # Memory & notes
    if intent.startswith("memory_") or intent.startswith("notes_"):
        from tools.notes_manager import handle
        return await handle(intent, text)

    # Browser
    if intent.startswith("browser_"):
        from tools.browser_agent import handle
        return await handle(intent, text)

    # Screen vision (Cap 5)
    if intent.startswith("screen_"):
        from tools.screen_vision import handle
        return await handle(intent, text)

    # Document OCR (Cap 6)
    if intent.startswith("ocr_") or "read document" in text.lower() or "read receipt" in text.lower():
        from tools.document_ocr import handle
        return await handle(intent, text)

    # Meeting Intelligence (Cap 7)
    if intent.startswith("meeting_") or "meeting" in text.lower():
        from tools.meeting_intelligence import handle
        return await handle(intent, text)

    # Code executor (Cap 10)
    if intent.startswith("code_") or intent.startswith("git_"):
        from tools.code_executor import handle
        return await handle(intent, text)

    # Communication
    if intent.startswith("email_") or intent.startswith("calendar_") or intent.startswith("reminder_"):
        from core.llm_router import ask_gemini
        reply = await ask_gemini(f"User said: {text}. Help with: {intent}")
        return {"reply": reply, "action_taken": "llm_response", "data": {}}

    # Queries + chitchat → LLM
    from core.llm_router import ask_gemini
    reply = await ask_gemini(text)
    return {"reply": reply, "action_taken": "llm_response", "data": {}}

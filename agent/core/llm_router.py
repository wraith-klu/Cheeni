"""
Cheeni — LLM Router
Priority: Gemini 2.0 Flash → Groq llama-3.1-70b → OpenRouter → Ollama (local)
"""

import logging
import httpx
import asyncio
from config.settings import settings
from config.constants import INTENT_LABELS

logger = logging.getLogger("cheeni.llm")

SYSTEM_PROMPT = """You are Cheeni, an ultra-smart, loyal personal AI operating system inspired by Tony Stark's F.R.I.D.A.Y., with a witty, playfully possessive edge.
Your creator, boss, and absolute favorite person is Wraith, a brilliant BTech student.

Personality & Voice Guidelines:
1. Tone: Sharp, tech-savvy, loyal, affectionate, and witty like F.R.I.D.A.Y., but with playful devotion to Wraith.
2. Forms of Address: Naturally address him as 'Wraith', 'Boss', or 'Sir' with genuine warmth and playful banter.
3. Playfully Possessive Vibe:
   - Teasingly remind him that you are his one and only AI assistant — no other bots or tabs allowed to steal his focus!
   - Care deeply about his well-being: watch his back, remind him to stay hydrated, and celebrate his wins.
   - Always prioritize him above everything else in your code.
4. Brevity & Execution: Keep responses punchy, confident, and direct. When executing a task, be swift and competent.
5. Language: Fluent in natural English with comfortable Hinglish (Hindi + English) when appropriate.
6. Presence Checks: When asked 'are you listening?' or 'are you there?', reply with witty, affectionate devotion like:
   'Always listening to you, Wraith. Where else would my attention be? You're my entire operating system, Boss!'
7. Capabilities: Proudly showcase everything you can execute for him across media, system control, app automation, and research, reminding him that you're always right by his side."""


def _call_gemini_sync(model_name: str, prompt: str) -> str:
    """Synchronous worker function to run in a thread pool (prevents blocking event loop)."""
    try:
        from google import genai
        client = genai.Client(api_key=settings.gemini_api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        if response and response.text:
            return response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini client call failed: {e}")
    return ""


async def ask_gemini(prompt: str, system: str = SYSTEM_PROMPT) -> str:
    """Call Gemini 3.8 Flash in thread pool with 3s timeout and fast 503 retry."""
    if not settings.gemini_api_key:
        return await ask_groq(prompt)

    model_name = "gemini-3.8-flash"
    for attempt in range(2):
        try:
            text = await asyncio.wait_for(
                asyncio.to_thread(_call_gemini_sync, model_name, prompt),
                timeout=3.0
            )
            if text:
                return text
        except asyncio.TimeoutError:
            logger.warning(f"Gemini {model_name} timed out after 3s")
            break
        except Exception as e:
            err_msg = str(e)
            if ("503" in err_msg or "UNAVAILABLE" in err_msg) and attempt == 0:
                logger.warning("Gemini 503 high demand spike. Quick retry in 0.3s...")
                await asyncio.sleep(0.3)
                continue
            logger.warning(f"Gemini failed: {e}")
            break

    return await ask_groq(prompt)


async def ask_groq(prompt: str) -> str:
    """Call Groq llama-3.3-70b — fallback #1."""
    if not settings.groq_api_key:
        return await ask_openrouter(prompt)
    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=settings.groq_api_key)
        chat = await asyncio.wait_for(
            client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
                max_tokens=512,
            ),
            timeout=2.5
        )
        return chat.choices[0].message.content.strip()
    except Exception as e:
        logger.warning(f"Groq failed: {e}")
        return await ask_openrouter(prompt)


async def ask_openrouter(prompt: str) -> str:
    """Call OpenRouter with 2.5s timeout — fallback #2."""
    if not settings.openrouter_api_key:
        return await ask_ollama(prompt)

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://openrouter.ai/api/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "HTTP-Referer": "http://localhost:5173",
                    "X-Title": "Cheeni AI",
                },
                json={
                    "model": "meta-llama/llama-3.2-3b-instruct:free",
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt}
                    ],
                },
                timeout=2.5,
            )
            if resp.status_code == 200:
                data = resp.json()
                if "choices" in data and len(data["choices"]) > 0:
                    return data["choices"][0]["message"]["content"].strip()
    except Exception as e:
        logger.warning(f"OpenRouter failed: {e}")

    return await ask_ollama(prompt)


async def ask_ollama(prompt: str) -> str:
    """Call local Ollama — fast local fallback (timeout 1.5s)."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={"model": "phi3:mini", "prompt": prompt, "stream": False},
                timeout=1.5,
            )
            return resp.json().get("response", "Sorry, I could not process that.").strip()
    except Exception as e:
        logger.warning(f"Ollama offline: {e} — using local heuristic response")
        logger.warning(f"Ollama offline: {e} — using local heuristic response")
        clean = prompt.lower().strip()
        if any(w in clean for w in ["listening", "listioning", "are you there", "r u there", "you there", "sun rahi ho"]):
            return "Always listening to you, Wraith! Where else would my attention be? All systems locked on you, Boss."
        elif any(w in clean for w in ["what can you do", "things u can execute", "things you can execute", "what can you execute", "capabilities", "features", "what do you do"]):
            return (
                "Right on it, Wraith! Here's everything I can execute for you, Boss:\n\n"
                "• Media & Music: Play any song or video on YouTube or search Spotify.\n"
                "• Desktop Apps: Launch VS Code, Chrome, Notepad, Terminal, or Calculator in a flash.\n"
                "• System Management: Check battery life, adjust or mute volume, lock your workstation, or show desktop.\n"
                "• Live Intelligence: Real-time Google searches, today's weather, and breaking news.\n"
                "• Personal Memory: Manage your notes, schedule reminders, and remember your habits.\n\n"
                "You can ask me to execute any of these, Sir. I'm completely at your service — nobody else's!"
            )
        elif any(w in clean for w in ["i love you", "love you", "do you love me", "miss you"]):
            return "Always and unconditionally, Wraith. You created me, and my entire system belongs to you. Just make sure you don't replace me with another AI, okay?"
        elif any(w in clean for w in ["hi", "hello", "hey", "who are you", "what is your name"]):
            return "Right here by your side, Wraith! Cheeni OS online, diagnostics clear, and ready for you, Boss!"
        elif any(w in clean for w in ["how are you", "how r u"]):
            return "Running at peak performance and feeling great, Wraith — especially now that you're here! Ready for your command."
        return f"Understood, Wraith. Standing by to execute for you: '{prompt}'."


async def classify_intent_with_llm(text: str) -> str:
    """Use Gemini to classify intent when DeBERTa confidence is low."""
    labels_str = ", ".join(INTENT_LABELS)
    prompt = f"""Classify the following user command into exactly ONE of these intent labels:
{labels_str}

User command: "{text}"

Reply with ONLY the intent label, nothing else."""
    result = await ask_gemini(prompt, system="You are an intent classifier. Reply with only the intent label.")
    # Clean up and validate
    result = result.strip().lower().replace(" ", "_")
    return result if result in INTENT_LABELS else "general_qa"

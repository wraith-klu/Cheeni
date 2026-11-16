"""
Cheeni Agent — Constants & Capability Manifest
"""

# ── HuggingFace Model Repos ───────────────────────────────────────────────────
HF_MODELS = {
    "intent":       "wraithklu/cheeni-intent-deberta_01",     # Cap 1 (PUBLISHED & VERIFIED - 86.92% Acc)
    "wakeword":     "wraithklu/cheeni-wakeword-xlsr_02",      # Cap 2 (PUBLISHED & VERIFIED - 100% Acc)
    "emotion":      "wraithklu/cheeni-emotion-vad_03",        # Cap 3 (PUBLISHED & VERIFIED - RAVDESS 8-Class SER)
    "speaker":      "wraithklu/cheeni-speaker-verify_04",     # Cap 4 (PUBLISHED & VERIFIED - Voice ID)
    "vision":       "wraithklu/cheeni-vision-florence_05",    # Cap 5 (PUBLISHED & VERIFIED - Screen UI Grounding)
    "ocr_printed":  "wraithklu/cheeni-ocr-trocr_06",         # Cap 6 (PUBLISHED & VERIFIED - Document OCR)
    "ocr_hw":       "wraithklu/cheeni-ocr-handwritten",      # Cap 6b
    "meeting":      "wraithklu/cheeni-meeting-pipeline_07",  # Cap 7 (PUBLISHED & VERIFIED - Diarization)
    "proactive":    "wraithklu/cheeni-proactive-chronos_08", # Cap 8 (PUBLISHED & VERIFIED - Chronos Forecasting)
    "threat":       "wraithklu/cheeni-threat-onnx_09",       # Cap 9 (PUBLISHED & VERIFIED - ONNX Anomaly Detector)
    "coder":        "wraithklu/cheeni-coder-qwen_10",        # Cap 10 (PUBLISHED & VERIFIED - Qwen2.5-Coder)
    "persona":      "wraithklu/cheeni-persona-phi35-dpo_11", # Cap 11 (Personalized JARVIS Persona)
}

# ── Intent Labels (60 classes) ────────────────────────────────────────────────
INTENT_LABELS = [
    # App control
    "app_launch", "app_close", "app_switch", "website_open", "search_web", "search_youtube",
    # File ops
    "file_create", "file_open", "file_delete", "file_move", "file_rename", "folder_create",
    # System control
    "system_shutdown", "system_restart", "system_sleep", "system_volume", "system_brightness", "system_wifi",
    # Memory & notes
    "memory_save", "memory_recall", "memory_delete", "notes_create", "notes_read", "notes_search",
    # Information queries
    "weather_query", "news_query", "general_qa", "math_query", "translation", "time_query",
    # Code
    "code_write", "code_debug", "code_explain", "code_run", "git_commit", "git_push",
    # Communication
    "email_compose", "email_read", "calendar_add", "calendar_read", "reminder_set", "reminder_cancel",
    # Browser
    "browser_navigate", "browser_click", "browser_fill", "browser_screenshot", "browser_scroll", "browser_close",
    # Screen vision
    "screen_read", "screen_describe", "screen_click", "screen_type", "screen_scroll", "screen_capture",
    # Emotion / chat
    "emotion_happy", "emotion_sad", "emotion_angry", "emotion_neutral", "emotion_query", "chitchat",
]

# ── Confidence Thresholds ─────────────────────────────────────────────────────
INTENT_CONFIDENCE_THRESHOLD = 0.50   # Below this → Gemini fallback
WAKEWORD_THRESHOLD          = 0.85
SPEAKER_SIMILARITY_THRESHOLD = 0.82
THREAT_ANOMALY_THRESHOLD    = 0.75

# ── Capability Manifest (exposed via /capabilities endpoint) ──────────────────
CAPABILITY_MANIFEST = {
    "total": 16,
    "capabilities": [
        {"id": 1, "name": "Intent Classifier",       "model": HF_MODELS["intent"],    "status": "active", "metric": "86.92% Acc (Amazon MASSIVE)"},
        {"id": 2, "name": "Wake Word Detector",      "model": HF_MODELS["wakeword"],  "status": "active", "metric": "100.0% Acc (Google Speech Cmds)"},
        {"id": 3, "name": "Emotion Detection",       "model": HF_MODELS["emotion"],   "status": "active", "metric": "8-Class SER (RAVDESS)"},
        {"id": 4, "name": "Speaker Verification",    "model": HF_MODELS["speaker"],   "status": "active", "metric": "0.9565 Sim (UniSpeech-SAT)"},
        {"id": 5, "name": "Screen UI Grounding",     "model": HF_MODELS["vision"],    "status": "active", "metric": "Florence-2 Phrase Grounding"},
        {"id": 6, "name": "Document OCR",            "model": HF_MODELS["ocr_printed"],"status": "active", "metric": "TrOCR-Base (CORD-v2)"},
        {"id": 7, "name": "Meeting Diarization",     "model": HF_MODELS["meeting"],   "status": "active", "metric": "Diarized Whisper Pipeline"},
        {"id": 8, "name": "Proactive Intelligence",  "model": HF_MODELS["proactive"], "status": "active", "metric": "Amazon Chronos-T5"},
        {"id": 9, "name": "Cyber Threat Detection",  "model": HF_MODELS["threat"],    "status": "active", "metric": "ONNX Anomaly (Safe: 0.165)"},
        {"id": 10,"name": "NL→Code Executor",        "model": HF_MODELS["coder"],     "status": "active", "metric": "Qwen2.5-Coder-1.5B"},
        {"id": 11,"name": "Personalized Style DPO",  "model": HF_MODELS["persona"],   "status": "active", "metric": "Phi-3-mini JARVIS Persona"},
        {"id": 12,"name": "Dual Voice Persona TTS",  "model": "EdgeTTS + Kokoro-82M",  "status": "active", "metric": "Cute Girl (Ana/Jenny) vs Male JARVIS (Ryan)"},
        {"id": 13,"name": "Local Knowledge Vault RAG","model": "BAAI/bge-small-en-v1.5","status": "active", "metric": "Dense Embedding + SQLite-vec Store"},
        {"id": 14,"name": "Ambient Working Memory",  "model": "Context Monitor Daemon","status": "active", "metric": "Active Window & Ephemeral Clipboard Ring"},
        {"id": 15,"name": "Self-Healing Diagnostic", "model": "Auto-Remediation Engine","status": "active", "metric": "Telemetry-Driven 1-Click Process Repair"},
        {"id": 16,"name": "Autonomous Web Researcher","model": "Playwright + Florence-2","status": "active", "metric": "Visual DOM Navigation & Tabular Synthesis"},
    ]
}

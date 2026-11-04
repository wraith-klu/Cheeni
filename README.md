<!-- markdownlint-disable MD033 MD051 -->
# 🍯 CHEENI — Personal JARVIS Desktop AI Assistant

## Full-Featured, Local-First, Autonomous AI Desktop Assistant & Voice Operating Agent

**Tony Stark spent a billion dollars on his. You need zero rupees.**

<div align="center">

[![React](https://img.shields.io/badge/React-19.0-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.111+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Ollama](https://img.shields.io/badge/Ollama-Offline_LLM-black?logo=ollama&logoColor=white)](https://ollama.ai/)
[![Playwright](https://img.shields.io/badge/Playwright-Automated_Browser-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![Whisper](https://img.shields.io/badge/faster--whisper-Local_STT-7057ff)](https://github.com/SYSTRAN/faster-whisper)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows_10_|_11-0078D6?logo=windows&logoColor=white)](https://microsoft.com/windows)

[Key Features](#what-is-cheeni) • [🧠 ML & AI Pipeline](#-ml--ai-pipeline-deep-dive) • [Architecture Diagrams](#system-architecture--diagrams) • [OpenJarvis 5-Step Guide](#openjarvis-zero-rupee-setup-guide) • [Getting Started](#getting-started) • [Voice & Commands](#voice-interaction--commands) • [Security Guard](#3-tier-execution-security-guard) • [Tech Stack](#technology-stack)

---

</div>

<a id="what-is-cheeni"></a>
## 🌟 What is Cheeni?

**Cheeni** is an open-source, local-first personal AI assistant built for everyday laptops. Inspired by Stanford's OpenJarvis framework, it runs entirely on your own hardware without mandatory cloud subscriptions, while offering optional cloud LLM bridges for heavy lifting.

It combines an always-on **low-power wake word detector**, **sub-second local speech-to-text** via `faster-whisper`, a **multi-backend fallback LLM router** (Ollama ↔ OpenRouter ↔ Gemini ↔ Node.js), **neural voices** (Edge-TTS & Kokoro-82M), **browser automation** via Playwright, **screen vision grounding** with Gemini 2.0 Flash, **local OAuth connectors** for Gmail, Calendar, Slack, and Notion, and an automated **Jarvis morning brief engine**.

---

<a id="-ml--ai-pipeline-deep-dive"></a>
## 🧠 ML & AI Pipeline Deep Dive

This section explains every machine learning model, algorithm, and AI pipeline powering Cheeni — from raw audio bytes to spoken responses.

---

### 📊 Complete ML Pipeline Overview

```mermaid
flowchart TD
    A["🎤 Raw Microphone Audio\n(PCM 16kHz mono)"] --> B

    subgraph ML1["⚡ ML Stage 1 — Wake Word Detection"]
        B["OpenWakeWord ONNX Model\nhey_jarvis (40ms chunks)"] --> C{Score ≥ 0.40?}
        C -- No --> B
        C -- Yes --> D["🔔 Wake Event Triggered"]
    end

    D --> E

    subgraph ML2["🎙️ ML Stage 2 — Speech-to-Text (STT)"]
        E["WebRTC VAD\nEnergy-based silence detection"] --> F["Audio Buffer\nCapture complete utterance"]
        F --> G["faster-whisper Transformer\n(CTranslate2 int8 quantized)\nWhisper base/small/medium"]
        G --> H["📝 Transcribed Text"]
    end

    H --> I

    subgraph ML3["🛡️ ML Stage 3 — Intent Classification & Security"]
        I["Regex + Keyword Classifier\n3-Tier Security Gate"] --> J{Intent Tier}
        J -- Tier 1 Safe --> K["✅ Dispatch Immediately"]
        J -- Tier 2 Risky --> L["⚠️ Request Confirmation"]
        J -- Tier 3 Blocked --> M["🚫 Deny & Explain"]
    end

    K --> N

    subgraph ML4["🤖 ML Stage 4 — LLM Reasoning & Tool Calling"]
        N["LLM Router\nFallback Chain"] --> O["Gemini 2.0 Flash\nReAct Tool-Calling Loop"]
        O --> P{Tool Call?}
        P -- Yes --> Q["🔧 Execute Local Tool\nDesktop / Browser / Memory"]
        Q --> R["📋 Observation"]
        R --> O
        P -- No --> S["💬 Direct Reply Text"]
    end

    S --> T
    subgraph ML5["🧬 ML Stage 5 — Semantic Memory (RAG)"]
        T["SentenceTransformer\nall-MiniLM-L6-v2\n384-dim embeddings"] --> U["Cosine Similarity Search\nSQLite Vector Store"]
        U --> V["🔍 Top-K Relevant Facts"]
    end

    V --> W

    subgraph ML6["🗣️ ML Stage 6 — Neural TTS"]
        W["Kokoro-82M\nLocal Neural Voice Model\nOR Microsoft Edge-TTS"] --> X["🔊 Spoken Audio Output"]
    end

    style ML1 fill:#1a1a2e,stroke:#e94560,color:#fff
    style ML2 fill:#16213e,stroke:#0f3460,color:#fff
    style ML3 fill:#0f3460,stroke:#533483,color:#fff
    style ML4 fill:#533483,stroke:#e94560,color:#fff
    style ML5 fill:#1a1a2e,stroke:#00b4d8,color:#fff
    style ML6 fill:#023e8a,stroke:#90e0ef,color:#fff
```

---

### 🔬 ML Stage 1: Wake Word Detection

**Model:** OpenWakeWord (`hey_jarvis` ONNX) + SpeechRecognition fallback

```mermaid
flowchart LR
    A["🎤 Microphone\n16kHz PCM"] --> B["Chunk Audio\n80ms = 1,280 samples"]
    B --> C["ONNX Runtime\nInference Engine"]
    C --> D["hey_jarvis\nPre-trained Neural Net"]
    D --> E{Confidence\nScore}
    E -- "< 0.40\n(miss)" --> B
    E -- "≥ 0.40\n(hit!)" --> F["🔔 Wake Detected\n2s cooldown applied"]
    F --> G["Pause WakeWord Engine\nRelease Mic for STT"]

    style A fill:#e94560,color:#fff
    style D fill:#533483,color:#fff
    style F fill:#06d6a0,color:#000
```

| Property | Value |
|---|---|
| **Audio Sample Rate** | 16,000 Hz |
| **Chunk Size** | 80 ms = 1,280 samples |
| **Model Type** | Pre-trained ONNX Neural Network |
| **Confidence Threshold** | ≥ 0.40 |
| **Cooldown After Detection** | 2 seconds |
| **CPU Usage at Idle** | < 1% (daemon thread) |
| **Fallback** | Google SpeechRecognition + keyword regex matching |

**How the ONNX model works:**
1. Raw audio frames at 16kHz are sliced into 80ms overlapping chunks.
2. Each chunk is passed through the pre-trained `hey_jarvis` neural net via ONNX Runtime.
3. The model outputs a probability score (0.0–1.0) for the target phrase.
4. When score ≥ threshold, the wake event fires and the microphone is handed to the STT engine.
5. A 2-second cooldown prevents the same phrase re-triggering the pipeline.

**Fallback Algorithm (SpeechRecognition):**
When OpenWakeWord is unavailable, a background listener calls Google STT and runs phonetic regex matching. Names like `Sam` get expanded into alias lists (`sharma`, `shama`, `swayam`, etc.) to handle Indian-accent STT transcription errors.

---

### 🎙️ ML Stage 2: Speech-to-Text (STT) — faster-whisper

**Model:** OpenAI Whisper (CTranslate2 quantized, int8)

```mermaid
flowchart TD
    A["🎤 Raw PCM Audio Buffer"] --> B["WebRTC VAD\nVoice Activity Detection"]
    B --> C{Speech\nDetected?}
    C -- No --> B
    C -- Yes --> D["Accumulate Frames\nuntil silence"]
    D --> E["PCM → WAV\nIn-memory byte buffer"]
    E --> F["WhisperModel.transcribe()\nCTranslate2 Runtime"]

    subgraph Whisper["Whisper Transformer Architecture"]
        F --> G["Audio Encoder\n(CNN + Multi-Head Attention)\n80-dim Log-Mel Spectrogram"]
        G --> H["Transformer Decoder\n(Autoregressive Token Generation)"]
        H --> I["Beam Search\nbeam_size = 5"]
    end

    I --> J["📝 Transcribed Text + Language"]
    J --> K{Confidence\nCheck}
    K -- High --> L["✅ Pass to Intent Router"]
    K -- Low --> M["🔄 Fallback: Google STT Cloud"]

    style Whisper fill:#1a1a2e,stroke:#7057ff,color:#fff
    style G fill:#533483,color:#fff
    style H fill:#0f3460,color:#fff
```

**Whisper Model Sizes Available:**

| Model | Parameters | VRAM | Speed | Accuracy |
|---|---|---|---|---|
| `tiny` | 39M | ~1 GB | Fastest | Basic |
| `base` ✅ | 74M | ~1 GB | Fast | Good |
| `small` | 244M | ~2 GB | Medium | Better |
| `medium` | 769M | ~5 GB | Slow | Great |
| `large-v3` | 1550M | ~10 GB | Slowest | Best |

**How Whisper Works Internally:**

1. **Log-Mel Spectrogram**: Raw PCM audio → 80 frequency bins × time frames using Short-Time Fourier Transform (STFT). This converts the waveform into a 2D image that the neural net can process.

2. **CNN Encoder**: Two convolutional layers extract local temporal features from the spectrogram, converting it to a dense representation.

3. **Multi-Head Self-Attention**: Transformer encoder layers learn long-range dependencies across the full utterance — which parts of the audio are related to which.

4. **Autoregressive Decoder**: Token by token, the decoder generates transcribed text. Each new token attends to all encoder outputs (cross-attention) and all previously generated tokens (causal self-attention).

5. **Beam Search (k=5)**: Instead of greedily picking the highest-probability next token, the decoder keeps the top-5 partial sequences at each step, selecting the globally best sequence at the end.

6. **CTranslate2 int8 Quantization**: Model weights are quantized from 32-bit float to 8-bit integer, making inference ~4x faster on CPU with minimal accuracy loss.

---

### 🤖 ML Stage 3: LLM Router — Multi-Backend Fallback

**Algorithm:** Priority-ordered async fallback chain with 4 backends

```mermaid
flowchart TD
    IN["📝 User Prompt\n+ System Context"] --> N1

    N1["🔵 Backend 1\nNode.js Backend :2025\n(full memory + user auth)"] -- Success --> OUT
    N1 -- Fail/Timeout --> N2

    N2["☁️ Backend 2\nOpenRouter API\nFast free-tier models"] -- Success --> OUT
    N2 -- Fail/Timeout --> N3

    N3["🟢 Backend 3\nGoogle Gemini API\n1.5-flash / 2.0-flash"] -- Success --> OUT
    N3 -- Fail/Timeout --> N4

    N4["🟤 Backend 4\nLocal Ollama (OFFLINE)\nphi3:mini / llama3.2:3b"] -- Success --> OUT
    N4 -- All Fail --> ERR

    OUT["💬 LLM Response Text"]
    ERR["❌ All backends exhausted\nReturn None"]

    style N1 fill:#0f3460,color:#fff
    style N2 fill:#533483,color:#fff
    style N3 fill:#1a472a,color:#fff
    style N4 fill:#3d1a0f,color:#fff
    style OUT fill:#06d6a0,color:#000
    style ERR fill:#e94560,color:#fff
```

**LLM Parameters Used:**

| Parameter | Value | Purpose |
|---|---|---|
| `temperature` | 0.75 | Creativity/randomness balance |
| `max_tokens` | 300 | Response length cap |
| `timeout` | 20s (cloud) / 60s (Ollama) | Per-backend deadline |
| `beam_size` (Ollama) | Model default | Quality of local generation |

---

### 🤖 ML Stage 4: ReAct (Reason + Act) Agent Loop

**Architecture:** Gemini 2.0 Flash with Function Calling + Local Tool Dispatch

```mermaid
sequenceDiagram
    participant U as 👤 User Voice
    participant R as 🔄 ReAct Loop
    participant G as 🧠 Gemini 2.0 Flash
    participant T as 🔧 Local Tools

    U->>R: "What is my battery level?"
    R->>G: Prompt + Tool Schemas (6 tools)
    G-->>R: FunctionCall{name: "get_system_telemetry", args: {metric: "battery"}}
    R->>T: dispatch_local_tool("get_system_telemetry", {metric: "battery"})
    T-->>R: {battery_percent: 78, plugged: true}
    R->>G: Observation = {battery_percent: 78} → "Generate voice response"
    G-->>R: "Your battery is at 78%, and you're plugged in — you're all good!"
    R->>U: 🔊 Speak via Neural TTS
```

**Tool Schema Pattern (Function Calling):**

```json
{
  "name": "control_volume",
  "description": "Adjust or query the master system audio volume on Windows.",
  "parameters": {
    "type": "OBJECT",
    "properties": {
      "action": { "type": "STRING", "enum": ["set","mute","unmute","increase","decrease","get"] },
      "level":  { "type": "INTEGER", "description": "Volume 0-100" }
    },
    "required": ["action"]
  }
}
```

**Available ReAct Tools:**

| Tool | Function | ML/AI Used |
|---|---|---|
| `control_volume` | Win32 pycaw audio API | Deterministic |
| `launch_app` / `close_app` | Process manager | Deterministic |
| `manage_window` | Win32 window snap | Deterministic |
| `get_system_telemetry` | psutil metrics | Deterministic |
| `inspect_screen_vision` | Screenshot + Gemini Vision | Multimodal LLM |
| `search_web` | DuckDuckGo + BeautifulSoup | Web scraping |

---

### 🧬 ML Stage 5: Semantic Memory — Sentence Transformers + Vector Search

**Model:** `all-MiniLM-L6-v2` (22M parameters, 384-dimensional embeddings)

```mermaid
flowchart LR
    subgraph WRITE["📥 Memory Write Path"]
        A1["User says:\n'Remember my college\nportal is kluniversity.in'"] --> B1["SentenceTransformer\nencode(text)"]
        B1 --> C1["384-dim float32 vector\n[-0.021, 0.147, ..., 0.063]"]
        C1 --> D1["JSON serialize vector\nStore in SQLite embeddings table"]
    end

    subgraph READ["📤 Memory Read Path (Recall)"]
        A2["User asks:\n'Where is my college site?'"] --> B2["SentenceTransformer\nencode(query)"]
        B2 --> C2["Query vector\n[-0.018, 0.142, ..., 0.071]"]
        C2 --> D2["Cosine Similarity\nagainst all stored vectors"]
        D2 --> E2["Top-K Ranked Results\nscore > 0.70 threshold"]
        E2 --> F2["✅ Return: kluniversity.in"]
    end

    style WRITE fill:#1a1a2e,stroke:#00b4d8,color:#fff
    style READ fill:#023e8a,stroke:#90e0ef,color:#fff
```

**How Sentence Transformers Work:**

1. **Tokenization**: Text is split into WordPiece tokens (e.g., `"college portal"` → `["college", "port", "##al"]`).
2. **BERT Encoder**: 6 transformer layers with multi-head self-attention create contextual token representations.
3. **Mean Pooling**: Token embeddings are averaged across all positions → one 384-dimensional sentence vector.
4. **Cosine Similarity Search**: The dot product of two L2-normalized vectors, giving a score from –1 to +1 (higher = more semantically similar).

$$\text{similarity}(A, B) = \frac{A \cdot B}{\|A\| \cdot \|B\|}$$

**Memory Tables (SQLite):**

| Table | Purpose | Semantic Search |
|---|---|---|
| `preferences` | User settings, habits | ✅ Yes |
| `contacts` | Name → phone/email | ✅ Yes |
| `shortcuts` | Phrase → URL mapping | ✅ Yes |
| `interaction_log` | Voice command history | No |
| `embeddings` | Shared vector cache | — |

---

### 📂 ML Stage 5b: Notes RAG Indexer (V20)

**Pipeline:** Chunk → Embed → Store → Semantic Retrieve

```mermaid
flowchart TD
    A["📁 Local Folder\n(.md / .txt / .pdf)"] --> B["File Walker\nrglob('*')"]
    B --> C["Text Extractor\n(pypdf / plain text)"]
    C --> D["Paragraph Chunker\n~500 chars per chunk"]
    D --> E["SentenceTransformer\nencode each chunk"]
    E --> F["SQLite chunks table\n{content, vector JSON}"]

    G["User: 'Search notes for\nmachine learning'"] --> H["encode(query)"]
    H --> I["Cosine similarity\nall stored chunks"]
    I --> J["Top-5 results\nscore > 0.10"]
    J --> K["📄 Relevant note snippets\n+ source file path"]

    style A fill:#1a1a2e,stroke:#e94560,color:#fff
    style F fill:#0f3460,color:#fff
    style K fill:#06d6a0,color:#000
```

**RAG (Retrieval-Augmented Generation) Architecture:**
- Documents are pre-processed and stored as semantic vectors.
- At query time, the user's question is embedded and compared against all document chunks using cosine similarity.
- The most relevant chunks are returned and injected into the LLM prompt as context.
- This lets Cheeni answer questions about your personal notes **without hallucinating** — answers are grounded in actual document content.

---

### 🗣️ ML Stage 6: Neural Text-to-Speech

**Primary Model:** Kokoro-82M (Local)  |  **Fallback:** Microsoft Edge-TTS (Cloud)

```mermaid
flowchart LR
    A["📝 Response Text\n'Your battery is at 78%'"] --> B{TTS Engine\nSelector}

    B -- Local --> C["Kokoro-82M\nNeural TTS Model"]
    C --> D["Phoneme Converter\nText → IPA phonemes"]
    D --> E["Duration Model\nPredict phoneme timings"]
    E --> F["HiFi-GAN Vocoder\nMel-spectrogram → Waveform"]
    F --> G["🔊 Audio Output\n22050 Hz WAV"]

    B -- Cloud --> H["Edge-TTS API\nen-IN-NeerjaNeural\nbm_george (British)"]
    H --> G

    style C fill:#533483,color:#fff
    style H fill:#0f3460,color:#fff
    style G fill:#06d6a0,color:#000
```

**Kokoro-82M Architecture:**
- **82M parameters** — small enough for real-time CPU inference.
- Uses a **duration model** to predict how long each phoneme should be spoken.
- **HiFi-GAN vocoder** generates the final audio waveform from a Mel spectrogram.
- Supports multiple voice presets: `bm_george` (British male), `af_heart` (American female), and others.
- Average latency: **~400ms** for a typical sentence.

---

### 🏗️ Full ML Architecture — All Models at a Glance

```mermaid
graph TB
    subgraph Models["🧠 All ML Models in Cheeni"]
        M1["OpenWakeWord\nhey_jarvis ONNX\n~1MB, 40ms inference"]
        M2["Whisper (CTranslate2)\nbase/small/medium\n74M–769M params"]
        M3["all-MiniLM-L6-v2\nSentence Transformer\n22M params, 384-dim"]
        M4["Kokoro-82M\nNeural TTS\n82M params"]
        M5["Gemini 2.0 Flash\nCloud LLM\n(ReAct + Vision)"]
        M6["Ollama Local LLM\nphi3:mini / llama3.2\n~2-7B params"]
    end

    subgraph Flow["🔄 Data Flow"]
        Audio["🎤 Mic Audio"] --> M1
        M1 --> M2
        M2 --> M3
        M3 --> M5
        M3 --> M6
        M5 --> M4
        M6 --> M4
        M4 --> Speaker["🔊 Speaker"]
    end

    style Models fill:#1a1a2e,stroke:#e94560,color:#fff
    style M1 fill:#e94560,color:#fff
    style M2 fill:#7057ff,color:#fff
    style M3 fill:#00b4d8,color:#000
    style M4 fill:#06d6a0,color:#000
    style M5 fill:#533483,color:#fff
    style M6 fill:#3d1a0f,color:#fff
```

---

### ⚡ ML Performance Benchmarks

| ML Component | Model | Latency | Runs On |
|---|---|---|---|
| Wake Word Detection | OpenWakeWord ONNX | < 10ms/chunk | CPU (< 1% idle) |
| Speech-to-Text | faster-whisper base | ~800ms | CPU int8 |
| Semantic Embedding | all-MiniLM-L6-v2 | < 20ms/query | CPU |
| Memory Recall (top-5) | Cosine similarity | < 80ms | CPU |
| Notes RAG Search | Cosine similarity | < 100ms | CPU |
| LLM Response (cloud) | Gemini / OpenRouter | ~1-2s | Cloud |
| LLM Response (local) | Ollama phi3:mini | ~3-8s | CPU (varies) |
| TTS Synthesis (local) | Kokoro-82M | ~400ms | CPU |
| TTS Synthesis (cloud) | Edge-TTS | ~600ms | Cloud API |
| Screen Vision | Gemini 2.0 Flash | ~1.5s | Cloud |

---

### 🔄 End-to-End Voice Interaction — Step by Step

```mermaid
sequenceDiagram
    participant Mic as 🎤 Microphone
    participant OWW as OpenWakeWord<br/>(ONNX, 40ms chunks)
    participant VAD as WebRTC VAD
    participant STT as faster-whisper<br/>(CTranslate2 int8)
    participant SEC as 3-Tier Security<br/>(Regex Classifier)
    participant MEM as SentenceTransformer<br/>(Memory Recall)
    participant LLM as LLM Router<br/>(Gemini/Ollama)
    participant TTS as Kokoro-82M<br/>(Neural TTS)
    participant Spk as 🔊 Speaker

    Mic->>OWW: PCM 16kHz stream (continuous)
    OWW->>OWW: Score ≥ 0.40 → Wake!
    OWW->>VAD: Hand off microphone
    VAD->>STT: Captured utterance bytes
    STT->>STT: Mel Spectrogram → Beam Search
    STT->>SEC: "Search my notes for ML algorithms"
    SEC->>SEC: Tier 1 SAFE — dispatch
    SEC->>MEM: Embed query → cosine search
    MEM->>LLM: Inject top-3 memory context + prompt
    LLM->>LLM: ReAct loop (tool calls if needed)
    LLM->>TTS: "I found 3 notes about ML algorithms..."
    TTS->>Spk: 400ms audio synthesis → playback
```

---

<a id="system-architecture--diagrams"></a>
## 📊 System Architecture & Diagrams

### 1. Multi-Tier Distributed Ecosystem

```mermaid
graph TB
    subgraph Client_UI ["Frontend Layer (:5173)"]
        UI[React 19 + Vite Dashboard]
        VoiceVisualizer[Realtime Audio Visualizer]
        RemotePad[Remote Control & Command Pad]
        MemoryViewer[Personal Memory Browser]
    end

    subgraph Node_Bridge ["Node.js Orchestration Layer (:2025)"]
        ExpressServer[Express Server]
        UserAuth[JWT Auth & Session Management]
        CloudOrchestrator[Multi-LLM Gateway: Gemini / Groq / Mistral]
    end

    subgraph Agent_Sidecar ["Python Cheeni-Agent (:2026)"]
        FastAPIServer[FastAPI REST & WebSocket Hub]
        SecurityGate{3-Tier Security Classifier}
        CentralRouter[Intent Command Router]
        VoiceFSM[VoiceState Finite State Machine]
        ReActEngine[Screen & Browser ReAct Loop]
    end

    subgraph Local_Intelligence ["Offline Intelligence Layer"]
        OllamaEngine[Ollama Server :11434<br/>phi3:mini / llama3.2]
        WhisperSTT[faster-whisper STT<br/>CTranslate2 int8]
        KokoroTTS[Kokoro-82M Local Neural TTS]
        VectorDB[(SQLite + SentenceTransformers<br/>Personal Memory & Notes Index)]
    end

    subgraph Local_Tooling ["Desktop Execution Tools"]
        WinAutomation[Win32 API / pycaw / mss<br/>Volume, Windows, Power, Apps]
        BrowserAgent[Playwright Chromium<br/>Click, Fill, Navigate, Scrape]
        Connectors[Local OAuth Connectors<br/>Gmail, Calendar, Slack, Notion]
        DigestScheduler[Morning Digest Scheduler]
    end

    UI <-->|WebSocket Events & REST| ExpressServer
    UI <-->|Direct WebSocket /ws| FastAPIServer
    ExpressServer <-->|Signed API Bridge| FastAPIServer

    FastAPIServer --> SecurityGate
    SecurityGate -->|Safe / User Confirmed| CentralRouter
    SecurityGate -->|Blocked| FastAPIServer

    CentralRouter --> VoiceFSM
    VoiceFSM --> WhisperSTT
    VoiceFSM --> KokoroTTS

    CentralRouter --> OllamaEngine
    CentralRouter --> VectorDB
    CentralRouter --> WinAutomation
    CentralRouter --> BrowserAgent
    CentralRouter --> Connectors
    Connectors --> DigestScheduler
```

---

### 2. Conversational Voice Pipeline

```mermaid
stateDiagram-v2
    [*] --> IDLE: Agent Listening for Wake Word

    IDLE --> ACTIVATED: Detects "Hey Jarvis" / "Hey Cheeni"
    ACTIVATED --> LISTENING: Plays chime & initiates WebRTC VAD
    LISTENING --> TRANSCRIBING: Speech captured (faster-whisper int8)
    TRANSCRIBING --> CLASSIFYING: Security classifier parses intent

    state CLASSIFYING {
        [*] --> CheckTier
        CheckTier --> SAFE: Reading, Apps, Status, Vol
        CheckTier --> RISKY: Shutdown, Deletion, Forms
        CheckTier --> BLOCKED: Format Drive, Exfiltrate Keys
    }

    RISKY --> AWAIT_CONFIRM: Voice prompt: "Please confirm this action"
    AWAIT_CONFIRM --> EXECUTING: User speaks: "Yes, confirm"
    AWAIT_CONFIRM --> IDLE: User cancels or timeout (10s)
    BLOCKED --> SPEAKING: "I cannot execute this blocked action."

    SAFE --> EXECUTING: Dispatch to Tool Module
    EXECUTING --> SPEAKING: Neural TTS synthesizes response (Kokoro / Edge)
    SPEAKING --> LISTENING: Re-opens microphone for follow-up (45s window)
    LISTENING --> IDLE: 45s silence timeout or "Goodbye"
```

---

### 3. Morning Brief & Connector Aggregation Pipeline

```mermaid
flowchart LR
    Schedule[Daily 07:00 Schedule / 'Morning brief'] --> Engine[DigestAgent]

    subgraph DataConnectors ["Local OAuth Connectors"]
        Engine --> Gmail[Gmail: Unread VIP Emails]
        Engine --> GCal[Calendar: Today's Meetings]
        Engine --> Slack[Slack: Priority DMs & Mentions]
        Engine --> Sys[System: Battery, CPU, Weather]
    end

    Gmail --> Aggregator[Data Aggregator & Context Builder]
    GCal --> Aggregator
    Slack --> Aggregator
    Sys --> Aggregator

    Aggregator --> LLM[Local Ollama or Cloud LLM]
    LLM --> Script[Jarvis Morning Briefing Script]
    Script --> VoiceEngine[Neural TTS Engine: Kokoro-82M]
    VoiceEngine --> SpokenAudio[Play Spoken Audio + Push to Dashboard UI]
```

---

## ⚡ Complete 20-Phase Capability Matrix

| Phase | Module | Capabilities & Technology Stack | Latency | Local / Cloud |
| :--- | :--- | :--- | :--- | :--- |
| **V1** | `tools/app_control.py` | Launch, kill, and focus any Windows application (Chrome, Notepad, VS Code). | < 200ms | 100% Local |
| **V2** | `core/server.py` | FastAPI asynchronous REST bridge with Bearer auth and Pydantic v2 schemas. | < 50ms | 100% Local |
| **V3** | `tools/system_status.py` | Battery, CPU, RAM metrics, master audio volume (`pycaw`), lock, sleep, shutdown. | < 100ms | 100% Local |
| **V4** | `tools/file_operations.py` | Sandboxed search & parsing for `.pdf`, `.docx`, `.txt` in Desktop/Docs/Downloads. | < 300ms | 100% Local |
| **V5** | `tools/web_intelligence.py` | DuckDuckGo search, real-time news aggregation, web page scraping with BeautifulSoup4. | ~1.2s | Cloud Search |
| **V6** | `voice/wakeword.py` | Ultra-low power wake word detection (`openwakeword`, ONNX `hey_jarvis` model). | < 50ms | 100% Local |
| **V7** | `tools/window_control.py` | Minimize, maximize, restore, split-screen snap (left/right/top/bottom), virtual desktops. | < 150ms | 100% Local |
| **V8** | `tools/desktop_vision.py` | Multi-screen capture (`mss`), image compression, and Google Gemini 2.0 Flash Vision. | ~1.5s | Hybrid |
| **V9** | `voice/conversation.py` | Full duplex 2-way conversation loop with WebRTC VAD and session memory. | Realtime | 100% Local |
| **V10** | `voice/whisper_listener.py` | `faster-whisper` transformer STT (CTranslate2 int8) for noise-tolerant transcription. | ~0.8s | 100% Local |
| **V11** | `tools/browser_agent.py` | Playwright browser automation (navigate, click elements, fill forms, extract text). | ~1.0s | 100% Local |
| **V12** | `tools/screen_agent.py` | ReAct vision loop (observe ➔ plan ➔ act) with UI element grounding and click automation. | ~2.5s/step | Hybrid |
| **V13** | `voice/edge_speaker.py` | Microsoft Edge neural TTS with sentiment tone modulation (neutral, excited, calm, stern). | ~600ms | Cloud API |
| **V14** | `core/llm_router.py` | Offline LLM router with fallback chain: Node.js ➔ OpenRouter ➔ Gemini ➔ Ollama. | ~2.0s | 100% Local |
| **V15** | `core/personal_memory.py` | Persistent SQLite memory with `all-MiniLM-L6-v2` semantic vector search. | < 80ms | 100% Local |
| **V16** | `frontend/AgentDashboard.jsx` | React 19 glassmorphism dashboard with WebSocket telemetry, memory manager & remote pad. | Realtime | 100% Local |
| **V17** | `tools/digest_agent.py` | Automated morning briefing engine reading Gmail, Calendar, Slack, and system status. | ~3.0s | Hybrid |
| **V18** | `tools/connectors.py` | Local-first OAuth2 connectors for Gmail, Google Calendar, Slack, and Notion. | < 500ms | Local Auth |
| **V19** | `voice/kokoro_speaker.py` | Kokoro-82M local neural voice generator (Jarvis British `bm_george` and American voices). | ~400ms | 100% Local |
| **V20** | `tools/notes_indexer.py` | Semantic RAG vector indexer for personal `.md`, `.txt`, `.pdf` note directories. | < 100ms | 100% Local |

---

<a id="openjarvis-zero-rupee-setup-guide"></a>
## 🚀 OpenJarvis Zero-Rupee Setup Guide

Build your own JARVIS on your laptop in 5 simple steps with zero rupees and 100% open-source software.

### Step 1: Install Dependencies

```powershell
# 1. Clone repository
git clone https://github.com/wraith-klu/Cheeni.git
cd Cheeni

# 2. Python agent setup
cd cheeni-agent
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
playwright install chromium
```

### Step 2: Run a Local Model with Ollama

1. Download Ollama from [ollama.ai](https://ollama.ai) and start it.

2. Pull a fast local model:

   ```bash
   ollama run phi3:mini
   # Or for high-capacity laptops:
   ollama run llama3.2:3b
   ```

### Step 3: Give It a Voice

Configure your `cheeni-agent/.env` to use the offline neural stack:

```env
WAKE_WORD_ENGINE=openwakeword
WAKE_WORD_MODEL=hey_jarvis
WHISPER_MODEL_SIZE=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
TTS_ENGINE=kokoro
KOKORO_VOICE=bm_george
KOKORO_SPEED=1.05
```

### Step 4: Connect Your Tools (Gmail, Calendar, Slack, Notion)

Trigger local OAuth in your terminal:

```bash
# Link Google Workspace (Gmail + Calendar)
curl -X POST http://localhost:2026/api/connectors/connect -H "Content-Type: application/json" -d '{"service":"gdrive"}'
```

*Your browser will launch Google's OAuth consent screen. Credentials are saved locally on your laptop in `data/connectors/`.*

### Step 5: Schedule Your Morning Briefing

Set your daily morning briefing for 7:00 AM:

```bash
curl -X POST http://localhost:2026/api/digest/schedule -H "Content-Type: application/json" -d '{"time":"07:00"}'
```

Every morning at 7:00 AM, Jarvis will address you by name, summarize your urgent emails, lay out today's schedule, and provide system stats.

---

<a id="getting-started"></a>
## 🛠️ Getting Started

### Prerequisites

- **OS**: Windows 10 or 11 (64-bit)
- **Node.js**: v18.0 or higher
- **Python**: 3.10 or 3.11
- **MongoDB**: Local instance or free MongoDB Atlas cluster

---

### Environment Configuration

#### 1. Node.js Backend (`backend/.env`)

```env
PORT=2025
MONGODB_URI=mongodb://localhost:27017/cheeni
JWT_SECRET=your_super_secret_jwt_key
AGENT_API_TOKEN=cheeni_secret_token_32_characters_long_min
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
MISTRAL_API_KEY=your_mistral_api_key
```

#### 2. Python Agent (`cheeni-agent/.env`)

```env
PORT=2026
AGENT_NAME=Sam
AGENT_API_TOKEN=cheeni_secret_token_32_characters_long_min
BACKEND_URL=http://localhost:2025

# Offline LLM
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=phi3:mini
OLLAMA_ENABLED=true

# Voice Pipeline
WAKE_WORD_ENGINE=openwakeword
WHISPER_MODEL_SIZE=base
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
TTS_ENGINE=edge
EDGE_VOICE=en-IN-NeerjaNeural

# Digest Configuration
DIGEST_TIMEZONE=Asia/Kolkata
DIGEST_HONORIFIC=sir
DIGEST_SECTIONS=calendar,gmail,system
```

#### 3. React Frontend (`frontend/.env`)

```env
VITE_BACKEND_URL=http://localhost:2025
VITE_AGENT_URL=http://localhost:2026
VITE_AGENT_WS_URL=ws://localhost:2026/ws
```

---

### Launching the System

#### Option A: One-Click Windows Launch Script

Double-click `start_cheeni.bat` in the project root to start all 3 services simultaneously.

#### Option B: Manual Terminal Execution

```powershell
# Terminal 1: Node.js Backend
cd backend
npm run dev

# Terminal 2: Cheeni Python Agent
cd cheeni-agent
.\venv\Scripts\Activate.ps1
python main.py

# Terminal 3: Vite React Frontend
cd frontend
npm run dev
```

Visit **`http://localhost:5173`** for the main dashboard and **`http://localhost:5173/agent`** for the JARVIS Remote Control Center.

---

<a id="voice-interaction--commands"></a>
## 🗣️ Voice Interaction & Commands

### Wake Word Phrases

The system continuously listens in low-power background mode:

- *"Hey Jarvis"* / *"Hey Sam"* / *"Hi Cheeni"* / *"Wake up Sam"* / *"Suno Cheeni"*

### Example Voice Commands

#### System & Volume

- *"Set volume to 50 percent"*
- *"Mute sound"* / *"Unmute"*
- *"Check my battery and CPU usage"*
- *"Lock my computer"* (Tier 1 Safe)
- *"Shut down my laptop"* (Tier 2 Risky ➔ Prompts for verbal confirmation)

#### Window Management & Tiling

- *"Snap this window to the left"*
- *"Split screen right"*
- *"Maximize this window"* / *"Minimize everything"*
- *"Switch to the next desktop"*

#### Screen Vision & GUI Interaction

- *"Look at my screen and explain what error is showing"*
- *"Click on the Save button in Notepad"*
- *"Type 'Cheeni AI is live' in the text field"*

#### Browser Automation

- *"Open YouTube and search for lofi music"*
- *"Navigate to github.com and check notifications"*

#### Morning Brief & Personal Memory

- *"Jarvis, give me my morning brief"*
- *"What's on my calendar today?"*
- *"Remember that my college portal is kluniversity.in"*
- *"Where is my college portal?"*
- *"Search my notes for machine learning algorithms"*

---

<a id="3-tier-execution-security-guard"></a>
## 🛡️ 3-Tier Execution Security Guard

Cheeni enforces a strict gatekeeper (`cheeni-agent/security/command_security.py`) to prevent unauthorized or destructive operations:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        3-TIER SECURITY POLICY                          │
├────────────────────────────────────────────────────────────────────────┤
│ 🟢 TIER 1 - SAFE (Executes Immediately)                                │
│   • Opening registered applications (Notepad, Chrome, VS Code)         │
│   • Adjusting master volume, muting/unmuting                           │
│   • Reading CPU, RAM, battery, datetime metrics                        │
│   • Window snapping, minimizing, maximizing                            │
│   • Reading approved document directories (Desktop/Documents)          │
│   • Speaking morning briefs, playing music                             │
├────────────────────────────────────────────────────────────────────────┤
│ 🟡 TIER 2 - RISKY (Requires Explicit Verbal or UI Confirmation)        │
│   • Shutting down, restarting, or sleeping the computer               │
│   • Deleting, moving, or renaming local files                          │
│   • Submitting online forms or clicking checkout buttons               │
│   • Sending emails or dispatching Slack messages                       │
├────────────────────────────────────────────────────────────────────────┤
│ 🔴 TIER 3 - BLOCKED (Permanently Denied)                               │
│   • Formatting disks or executing destructive diskpart commands        │
│   • Accessing SSH private keys or Windows password vaults              │
│   • Unauthorized fund transfers or crypto transactions                │
└────────────────────────────────────────────────────────────────────────┘
```

---

<a id="verification--testing-suite"></a>
## 🧪 Verification & Testing Suite

Cheeni includes a comprehensive test suite covering all modules:

```powershell
cd cheeni-agent
.\venv\Scripts\Activate.ps1
pytest tests/test_v17_v18_v19_v20.py -v
```

```text
======================= 35 passed in 59.29s =======================
✅ TestV17MorningDigest: Singleton, status, cron scheduling, text brief
✅ TestV18Connectors: OAuth registry, Gmail/Calendar/Slack/Notion mocks
✅ TestV19KokoroTTS: Local neural speaker, speed clamps, voice presets
✅ TestV20NotesIndexer: Directory chunking, SQLite vector storage, RAG search
✅ TestV17_V20_ServerRoutes: FastAPI route registration & Bearer security
```

---

<a id="technology-stack"></a>
## 🧰 Technology Stack

```text
Client Layer:       React 19, Vite, Tailwind CSS, Lucide React, WebSockets, HTML5 Canvas
Orchestration:      Node.js 18+, Express.js, MongoDB (Mongoose), JWT, Axios
Agent Sidecar:      Python 3.10+, FastAPI, Uvicorn, Pydantic v2, WebSockets
Voice & STT:        openwakeword (ONNX), faster-whisper (CTranslate2), WebRTC VAD
Speech Synthesis:   Kokoro-82M Local Neural TTS, Microsoft Edge-TTS, pyttsx3
Intelligence:       Ollama (phi3, llama3.2), Google Gemini 2.0 Flash, OpenRouter
Automation:         Playwright Chromium, pywin32, pyautogui, pycaw, mss, psutil
Semantic Memory:    SQLite 3, sentence-transformers (all-MiniLM-L6-v2), scikit-learn
Connectors:         Google OAuth2 (Gmail, Calendar), Slack SDK, Notion API
```

---

<a id="project-structure"></a>
## 📂 Project Structure

```text
Cheeni/
├── backend/                      # Node.js Express Orchestrator (:2025)
│   ├── src/controllers/          # Chat, user, and agent controllers
│   ├── src/services/             # Multi-LLM provider connectors
│   └── package.json
│
├── frontend/                     # React 19 + Vite Dashboard (:5173)
│   ├── src/components/           # VoiceVisualizer, SystemStats, ChatWindow
│   ├── src/pages/                # AgentDashboard.jsx (V16 Remote Control UI)
│   └── package.json
│
├── cheeni-agent/                 # Python Desktop Agent Sidecar (:2026)
│   ├── core/
│   │   ├── server.py             # FastAPI REST & WebSocket Server (1500+ lines)
│   │   ├── llm_router.py         # Multi-backend fallback LLM router (V14)
│   │   ├── personal_memory.py    # SQLite + SentenceTransformer memory (V15)
│   │   └── react_agent.py        # ReAct loop tool orchestrator
│   ├── tools/
│   │   ├── router.py             # Central command router & regex parser
│   │   ├── app_control.py        # Process launcher and manager (V1)
│   │   ├── window_control.py     # Win32 window snapping & workspaces (V7)
│   │   ├── system_status.py      # Battery, CPU, RAM & power control (V3)
│   │   ├── volume_control.py     # Pycaw master & per-app audio (V3)
│   │   ├── file_operations.py    # Sandboxed document parsing (V4)
│   │   ├── web_intelligence.py   # DuckDuckGo search & scraping (V5)
│   │   ├── desktop_vision.py     # Multi-screen capture & Gemini Vision (V8)
│   │   ├── screen_agent.py       # GUI ReAct action loop & grounding (V12)
│   │   ├── browser_agent.py      # Playwright browser automation (V11)
│   │   ├── digest_agent.py       # Morning briefing engine (V17)
│   │   ├── connectors.py         # Gmail, Calendar, Slack, Notion OAuth (V18)
│   │   └── notes_indexer.py      # Semantic vector RAG notes indexer (V20)
│   ├── voice/
│   │   ├── wakeword.py           # openwakeword background listener (V6)
│   │   ├── listener.py           # WebRTC VAD + faster-whisper STT (V9/V10)
│   │   ├── edge_speaker.py       # Microsoft Edge neural TTS (V13)
│   │   ├── kokoro_speaker.py     # Kokoro-82M offline neural TTS (V19)
│   │   └── conversation.py       # Full duplex continuous voice loop (V9)
│   ├── security/                 # 3-Tier Security Classifier & Confirmation Manager
│   ├── data/                     # Local SQLite databases & OAuth credentials
│   └── tests/                    # Pytest verification suites
│
├── JARVIS_BUILD_PLAN.md          # 20-Phase Master Specification & Architecture Guide
├── start_cheeni.bat              # One-click Windows multi-service runner
└── README.md
```

---

## 🤝 Contributing

Contributions are warmly welcomed! Please feel free to open a Pull Request or file an issue on GitHub.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingJarvisFeature`)
3. Commit your Changes (`git commit -m 'Add AmazingJarvisFeature'`)
4. Push to the Branch (`git push origin feature/AmazingJarvisFeature`)
5. Open a Pull Request

---

## 📜 License

Distributed under the **Apache-2.0 License**. See `LICENSE` for more information.

<div align="center">

Built with ❤️ by **[Wraith](https://github.com/wraith-klu)** & the OpenJarvis Community


</div>

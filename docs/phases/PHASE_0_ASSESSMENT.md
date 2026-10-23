# Cheeni Phase 0 — Existing Project Assessment

**Assessment date:** 12 October 2026  
**Scope:** Read-only review of repository structure, docs, code paths, configuration, Git state, and test inventory. No tests or builds were run. No files were deleted or modified for this assessment.

## Executive Summary

Cheeni is an existing multi-part assistant, not a blank project. It combines a React/Vite web interface, an Express/MongoDB account and AI backend, and a Python/FastAPI Windows agent. The repository already contains voice interaction, desktop controls, file/document tools, web search, conversation history, authentication, and safety mechanisms.

The primary issue is architectural overlap: commands can flow through the Python command router, Node AI service, a newer Groq-to-edge bridge, and a native Python ReAct endpoint. The experimental bridge can send tool calls from a cloud backend to a laptop without a visible approval gate. It identifies devices by an unauthenticated client-supplied ID, and the edge daemon opens a received URL through a shell. Separately, local REST endpoints expose powerful laptop operations and appear to rely on loopback binding rather than request authentication. These paths need to be unified and secured before expanding Cheeni’s autonomy.

Recommendation: retain the existing project as the starting point, preserve current local edits, and avoid deleting code during Phase 0. Decide the architecture and permission boundary before choosing one authoritative tool execution path. Stabilize security and tool contracts before expanding capabilities.

## Repository and Git State

### Main components

| Area | Location | Current role |
| --- | --- | --- |
| React/Vite interface | `frontend/` | Dashboard, authentication screens, chat, browser-based speech input/output, settings, telemetry hooks, and history UI. |
| Node/Express backend | `backend/` | Authentication, user settings, MongoDB conversation history, AI providers, agent proxy routes, rate limiting, uploads, and an experimental WebSocket edge bridge. |
| Python Windows agent | `cheeni-agent/` | FastAPI service, voice session, command router, security classifier, desktop controls, filesystem tools, web intelligence, and telemetry. |
| Experimental cloud-to-device bridge | `cheeni_edge_daemon.py`, `backend/services/edgeBridge.service.js` | Persistent WebSocket connection and remote desktop tool dispatch. |
| Project documentation/scripts | Root Markdown, `.bat`, `.vbs`, `.ps1` files | Setup, launch, packaging, legacy plans, and feature descriptions. |

### Working tree

Git reports modified tracked files:

- `README.md`
- `backend/controllers/assistant.controllers.js`
- `backend/index.js`
- `backend/package-lock.json`
- `backend/package.json`
- `cheeni-agent/core/server.py`

Git reports untracked files:

- `CHEENI_BUILD_PLAN.md` (the agreed long-term plan)
- `backend/services/edgeBridge.service.js`
- `backend/services/groqAgent.service.js`
- `backend/services/toolsSchema.js`
- `cheeni-agent/core/react_agent.py`
- `cheeni-agent/tools/desktop_vision.py`
- `cheeni_edge_daemon.py`
- `render.yaml`
- `start_edge_daemon.bat`

The untracked source files are referenced by modified backend/agent code, so they appear to be active experimental work rather than obvious junk. Their authorship and intended status are unknown. Preserve them unless the project owner decides otherwise. No applicable `AGENTS.md` file was found in the workspace scan.

The workspace also contains `.pytest_cache`, installed `node_modules`, frontend `dist`, local `.env` files, and packaged setup ZIPs. Their presence alone does not establish that they should be removed. `.gitignore` covers dependencies, Python cache, builds, and environment files, but the cache directory appears in the working-tree listing; check tracking before cleanup. The actual `.env` contents were not opened or printed.

## Capability Matrix

Statuses are based on source inspection only, not runtime verification.

| Capability | Status | Evidence and limitations |
| --- | --- | --- |
| Web dashboard and accounts | Implemented, unverified | React pages and Express authentication/user routes exist; MongoDB is configured. |
| Typed chat and AI answers | Implemented, overlapping paths | Assistant controller uses the existing AI service unless `GROQ_API_KEY` selects a newly added Groq tool-calling path. The new Groq service fallback is explanatory text, not a real Gemini fallback. |
| Browser microphone input | Implemented, browser-dependent | `useSpeechRecognition.js` uses browser Web Speech APIs; support and recognition quality depend on browser/service. |
| Native wake word and continuous voice | Implemented, unverified | Python wake-word, listener, speaker, session, and conversation modules exist. Listener comments indicate a Google STT path; offline behavior is not established. |
| Speech output | Implemented, unverified | Browser synthesis and Python `pyttsx3` paths both exist; behavior is split across interface/runtime. |
| App launching and window control | Implemented, safety review needed | Python modules and routes exist. `app_control.py` falls back to `subprocess.Popen(query, shell=True)` for unknown names. |
| Audio and system telemetry | Implemented, unverified | Volume and `psutil` status tools plus FastAPI endpoints exist. Several direct endpoints have no route-level authentication. |
| File search/read/create/rename/move | Implemented, limited sandbox | Operations are constrained to the user home directory. No delete tool was found in the inspected filesystem module. Change endpoints do not visibly require confirmation. |
| Destructive action classifier/confirmation | Partially implemented | `route_command` invokes classification and a confirmation manager. New Groq/edge and native ReAct paths do not visibly use that gate. Confirmation appears process-global rather than action/session-bound. |
| Web search and page extraction | Implemented, unverified | DuckDuckGo and extraction tools exist. No browser automation framework/workflow was found. |
| Screen capture and vision | Experimental, privacy-sensitive | Screenshot/Gemini code and a new direct vision endpoint exist. No explicit consent or capture indicator was observed in that path. |
| Browser automation and form filling | Missing | No Playwright/Selenium dependency or implemented browser workflow identified. Opening/searching URLs is present. |
| Multi-step goal planning | Experimental | Node and Python ReAct loops exist separately; their actions are not uniformly policy-checked. |
| External service integrations | Missing or unverified | No integration registry, OAuth flow for calendar/mail, or scoped service connectors identified. |
| Persistent user-controlled memory | Partial | Node stores history in MongoDB; Python voice memory is a short-lived in-memory window cleared at session start. Retention/export controls need review. |
| Proactive reminders/scheduled monitoring | Missing | No scheduler/reminder implementation identified. |

## Architecture and Request Flows

### Local UI-to-agent path

The React client calls the Node backend for authenticated actions. `backend/routes/agent.routes.js` proxies selected requests to `127.0.0.1:2026`; the Python FastAPI agent exposes direct endpoints and a separate telemetry WebSocket. The Python process defaults to loopback, which is useful, but CORS is not authentication and direct local endpoints do not have per-user authorization in the route definitions inspected.

### Python command path

`POST /api/command` → `tools/router.py::route_command` → natural-language security classification → confirmation manager for classified risky commands → local tool. This is the clearest existing policy-aware path, but direct tool REST endpoints can bypass it. Classification is based on natural-language text rather than the final structured operation and exact target.

### Node AI path

Authenticated `/api/assistant/ask` loads history, calls an AI service, and persists messages. An uncommitted change selects Groq tool calling when `GROQ_API_KEY` exists, then dispatches calls through the new edge bridge. The visible flow does not classify each structured action, request user confirmation, validate arguments at the dispatcher boundary, or reliably stop on tool errors before model summarization.

### Direct Python ReAct path

The uncommitted `POST /api/agent/react` endpoint invokes `CheeniReActAgent`, which asks Gemini for tool calls and calls local tools directly. The route does not visibly use the existing classifier or confirmation manager and has no authentication dependency in its definition.

### Cloud-to-device path

The new Node WebSocket server accepts connections and registers a client-supplied `deviceId` without an authentication handshake. The daemon reconnects and executes RPC tool names received from the server. Dispatch uses a hand-coded `if` chain and opens URLs through `os.system`. This crosses a cloud-to-local authority boundary without device proof, per-user ownership checks, or a user approval step.

## High-Priority Findings

These are source-review findings, not a penetration test.

1. **Remote desktop control lacks authenticated device registration.** `backend/services/edgeBridge.service.js` accepts unauthenticated WebSocket connections and client-selected IDs; a connecting client may impersonate or replace a device connection.
2. **Remote tool paths bypass the established safety gate.** Groq dispatch and Python ReAct invoke tools without the shared structured policy/confirmation path.
3. **The edge daemon executes a shell-mediated URL.** Replace `os.system` with validated URL parsing and a non-shell API before enabling this path.
4. **Local HTTP endpoints expose laptop actions without visible route authentication.** Routes include app close, power operations, file changes, and screen capture. Loopback binding reduces network reach but does not provide caller authorization.
5. **Unknown app names reach shell execution.** `app_control.py` uses `shell=True` after lookup fails. Prefer an allowlisted application catalog.
6. **Screen contents are sent to a cloud vision provider.** The vision endpoint captures screen content and calls Gemini; add clear consent, scope, and data-flow disclosure before enabling it.
7. **Natural-language classification is not a sufficient policy boundary.** Policy should evaluate a validated structured action and exact target, then bind approval to that pending action.
8. **Multiple tool-execution paths complicate safety guarantees.** Securing one path does not secure the Python router, Node tool calling, Python ReAct, direct REST endpoints, and frontend action runner together.

## Dependencies and Deployment Observations

- Stack: React/Vite, Express/Node, MongoDB/Mongoose, and Python/FastAPI on Windows.
- Voice and desktop libraries include browser Web Speech, `SpeechRecognition`, `pyttsx3`, VAD, `pyautogui`, `pycaw`, `psutil`, and Windows-specific controls.
- Web search/document parsing dependencies are present; Playwright/Selenium is not listed in inspected manifests.
- `start_cheeni.bat` launches Python, Node, and the frontend dev server. Its shutdown flow terminates processes based on listening ports; review before routine use.
- `backend/.env.example` documents MongoDB, JWT, Cloudinary, OpenRouter, and optional Gemini configuration. Actual `.env` contents were not read.
- `render.yaml` and the edge daemon indicate an experiment with cloud backend plus a persistent laptop tunnel. This conflicts with a strictly local-first model and needs an explicit privacy/deployment decision.
- Setup ZIPs are generated from a limited file list; they may not include the full agent/dependencies. Treat packaging as unverified.

## Documentation and Cleanup Candidates

### Keep and reconcile

- `CHEENI_BUILD_PLAN.md`: current agreed long-term product/build plan.
- `README.md`: useful overview, but claims need verification against current behavior.
- `ROADMAP.md`: legacy roadmap declares every step complete and describes a narrower/older product; reconcile or label historical.
- `implementation_plan.md`: older 20-step plan whose unchecked items conflict with the roadmap completion claims; review provenance before archiving or replacing.
- `README_SETUP.txt`: verify its setup and installer instructions against the actual package.

### Generated/local candidates — do not delete without review

- `.pytest_cache/`
- `backend/node_modules/`, `frontend/node_modules/`
- `frontend/dist/`
- `backend/uploads/` contents, if any
- duplicate setup ZIPs in `backend/public/downloads/` and `frontend/public/downloads/`
- `frontend/public/downloads/install_autostart.bat` if generated from the root installer

These may be regenerable but can represent local state or distribution artifacts. Check Git tracking, build instructions, and desired distribution first. The ZIPs are tracked, so removing them changes the distributable artifact and is not routine cache cleanup.

### Experimental code — decide on it, do not discard by default

- `cheeni_edge_daemon.py`, `start_edge_daemon.bat`, `render.yaml`
- `backend/services/edgeBridge.service.js`, `groqAgent.service.js`, `toolsSchema.js`
- `cheeni-agent/core/react_agent.py`, `cheeni-agent/tools/desktop_vision.py`

These untracked files connect to uncommitted changes and represent active experiments. Decide whether cloud-to-device dispatch and the new ReAct path are intended before consolidating or removing them.

## Recommended Decisions Before Phase 1

1. **Execution topology:** choose local-first direct agent communication or cloud relay. Recommendation: local-first for laptop control. A relay needs authenticated device enrollment, per-user authorization, signed/short-lived requests, a narrow tool allowlist, and explicit confirmations.
2. **One policy authority:** choose one local tool interface; every caller must pass schema validation, policy, confirmation, execution, and result verification.
3. **Agent security:** decide how a local pairing token and per-request authorization protect FastAPI; retain loopback binding by default.
4. **First milestone:** stabilize typed app/site/folder opening and read-only telemetry through one execution path; defer direct vision, destructive actions, and cloud-to-device control until the policy boundary is proven.
5. **Data and providers:** decide whether prompts, history, and screenshots may leave the device, which providers are allowed, retention, and offline requirements.
6. **Cleanup:** review candidates and assign keep, consolidate, archive, or remove status. Preserve all uncommitted work until each file is understood.

## Proposed First Implementation Milestone

**Milestone:** one policy-enforced local command path for typed app/site/folder opening and read-only system status.

Acceptance criteria:

- Exactly one code path executes desktop tools.
- The path accepts registered tools and validated arguments only.
- Model output and app lookup cannot invoke arbitrary shell commands.
- Local agent access is loopback-bound and has an explicit authorization design.
- Every request returns a verified structured result or a clear failure.
- Existing user changes and experimental files remain intact.

## Assessment Limitations

- No unit tests, integration tests, builds, or manual UI actions were run; this is static review only.
- Existing `.env` files were detected but not opened, copied, or printed.
- No live database, deployed service, model account, microphone, or desktop behavior was verified.
- The assessment does not establish who authored untracked files or whether generated artifacts are needed for distribution.

## First Milestone — Implementation Status

The first local command-path slice has been implemented in the working tree:

- Added a bearer-token guard to laptop status, app, volume, window, filesystem, web-intelligence, screenshot, command, and experimental vision/ReAct HTTP routes. The token must be at least 32 characters and is compared with a constant-time check.
- Added `/api/agent/tool` with strict registered actions for launching a small GUI app allowlist, opening standard user folders, opening credential-free HTTP(S) URLs, and reading selected telemetry.
- Connected the Node/Groq tool-call path to that local executor and limited its available schemas to the same initial actions. Tool execution errors now fail the request instead of being described as successful.
- Removed the unauthenticated cloud edge bridge from backend startup and disabled the separate broad ReAct executor route. Kept the experimental source files intact for later review.
- Removed the `shell=True` fallback from application launching and documented the shared local token configuration.

Syntax checks passed for the touched Node and Python files. Automated test suites and runtime behavior were not run.

### Remaining before this slice is usable

- Create `backend/.env` and `cheeni-agent/.env` from their examples and configure the same random `AGENT_API_TOKEN` (at least 32 characters) in each. Existing private `.env` files were not modified.
- Configure `GROQ_API_KEY` if model-driven structured tool calls are desired; the existing non-Groq AI path remains available.
- Direct legacy voice-control endpoints and the telemetry WebSocket are still separate local interfaces; they should be moved behind authenticated Node proxy routes or secured in a follow-up before treating the entire agent API as hardened.
- The legacy natural-language command router remains for existing integrations. The new structured tool endpoint is the only path exposed to the Groq model, but broader consolidation is still needed to make it the sole executor across all Cheeni features.

## Phase 2 — Typed Command Foundation (Implementation Update)

- Recorded the owner's proceed instruction as acceptance of the architecture recommendations for this foundation milestone; detailed future preferences remain reversible defaults.
- Added a Node desktop-tool service for a single authenticated, validated proxy path to the Python agent and connected both streaming and non-streaming assistant requests.
- Prevented the frontend from executing a tool a second time after the server has already executed it. The frontend tool runner now only calls the authenticated Node tool route for the supported starter actions; unsupported legacy action types fail closed.
- Runtime checks on Windows, credential provisioning, and review/consolidation of all legacy voice and WebSocket routes remain outstanding. Do not treat the complete agent surface as hardened until those are addressed.

## Phase 3 — Voice Interaction (Initial Update)

- Kept browser speech recognition and speech synthesis as the first voice interface; native wake-word mode remains opt-in and is not started automatically by the UI.
- Routed wake-word status/start/stop through authenticated Node endpoints. The corresponding Python endpoints now require the shared local agent token.
- Rejected direct WebSocket telemetry connections; the dashboard already has authenticated polling for telemetry.
- Browser confirmation now displays the recognized transcript and lets the user cancel before submission. Polished in-app review and live microphone, TTS, and Windows runtime validation remain before Phase 3 completion.

## Phase 4 — Safe File and System Actions (Initial Update)

- Limited filesystem search/read to resolved paths under Desktop, Documents, or Downloads; bounded search query length, traversal effort, and returned results.
- Node validates read/search request shapes and lengths. Folder creation, rename, and move proxy routes now fail closed until preview, explicit confirmation, and recovery semantics exist. No deletion operation was enabled.
- File contents are not passed to the model as tools, avoiding hidden cloud disclosure. A user-visible file picker and explicit read flow remain future work.

## Phase 5 — Browser Workflows (Initial Update)

- Hardened the existing HTTP page reader against common SSRF paths: only standard-port HTTP(S), public IP destinations, no embedded credentials, no redirects, HTML content only, and a 2 MB response cap.
- Added regression checks for private IPs, private DNS results, invalid schemes/credentials/ports, and redirect rejection.
- Did not add Playwright, signed-in profile access, browser clicking, form submission, or automatic forwarding of page text to a model. Those need an isolated browser-context and data-disclosure design first.

## Phase 6 — Screen Understanding and Personalization (Initial Update)

- Replaced the old screenshot placeholder (which asked a text model to describe an image it never received) with an authenticated Node-to-agent vision request.
- The UI asks permission before capturing/sending the primary-screen image to the configured Google Gemini vision model. The vision endpoint is answer-only; no click/type execution is exposed.
- Screen content is treated as untrusted input; capture failure no longer creates a fake blank image. This flow does not persist screenshot bytes or add durable memory.
- Provider configuration and live Windows capture/analysis remain unverified.

## Phase 7 — Connected Services and Extensible Tools (Initial Update)

- Added a structured integration registry contract and an authenticated `GET /api/integrations` catalog endpoint.
- Registered Google Calendar as a planned read-only integration with a proposed narrow events-readonly scope and data-sharing metadata. It is explicitly not connectable; there is no OAuth, credential storage, or external account access yet.
- Added tests confirming the catalog has no credential values and callers receive copies rather than mutable shared registry state.

## Phase 8 — Multi-Step Goal Planning and Task Coordination (Initial Update)

- Added a plan builder that accepts only registered, schema-valid tools and limits previews to five steps.
- Groq multi-tool responses now return a “not executed” plan preview instead of executing the proposed steps. Invalid/oversized plans fail closed; ordinary single-tool behavior is unchanged.
- Added tests for valid preview state, unsupported steps, and the plan-size bound. Approval, execution, pause/resume, cancellation, and persistence are not implemented yet.

## Phase 9 — Proactive Assistance and Ongoing Improvement (Current Slice)

- Added browser-local one-time, daily, and weekly reminders with add/edit/pause/resume/run-now/dismiss/delete controls. Data is namespaced by user ID in local storage and is not sent to backend/AI services.
- Browser notifications require an explicit enable action; in-app due reminders are the fallback. Missed one-time reminders are surfaced in the reminder list; recurring reminders advance to their next scheduled occurrence.
- Scheduling runs only while the dashboard is open. There is no server-side worker, background guarantee, or automated external/system action.

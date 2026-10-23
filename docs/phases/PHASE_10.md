# Phase 10 — Validate the Foundation and Finish Voice Basics

## Purpose

Validate the capabilities already present in Cheeni before expanding them. Finish the initial browser voice experience so a user can speak English or Hindi, review the recognized text, and receive a response in the language they used. Verify the narrow desktop actions on the target Windows laptop, add user-controlled aliases, and document known limitations.

Phase 10 is a verification-and-foundation phase, not a grant of broad device access. It does not enable arbitrary shell commands, deletion, unrestricted filesystem access, unattended microphone activation, or general screen control.

## User-Visible Outcome

At the end of Phase 10, the user can:

- Select English or Hindi as the browser microphone's recognition language.
- Speak a request, inspect and edit the transcript, then explicitly send or cancel it.
- Receive an AI reply in the language of the latest request, including natural Hindi-English mixing where appropriate.
- Hear the reply through a matching installed browser voice when available, or read the text if speech output is unavailable.
- Launch only supported, allowlisted apps, standard folders, and validated websites.
- Create personal aliases such as “my college portal” or “my notes folder” without granting access outside the existing tool policies.
- See whether the local agent is available and receive a clear error when it is not.
- Stop speech and cancel an unsubmitted transcript.

## Current Baseline

The repository already contains these partial implementations. Phase 10 must verify them rather than reimplementing them blindly:

- Browser-based speech recognition with an English/Hindi locale selector and a locally saved selection.
- Editable voice-transcript review with explicit Send and Cancel actions.
- AI prompts instructing supported providers to follow the latest user's language.
- Hindi-aware local action confirmations and browser TTS locale/voice selection based on Devanagari output.
- A narrow registered desktop tool path for selected app launches, approved folders, validated URLs, and read-only telemetry.
- An authenticated Node-to-local-agent path with a shared `AGENT_API_TOKEN`.
- Browser voice and speech tests, Python agent tests, and a frontend production build.

These implementations have not all been verified on the target Windows machine. Native wake-word recognition, legacy endpoints, and support for arbitrary application aliases are not assumed to be complete.

## Scope

### Included

1. Verify the current browser voice flow and add focused fixes needed for predictable English/Hindi use.
2. Verify language-matched AI responses across configured provider paths and deterministic local confirmations.
3. Verify voice output behavior with and without installed Hindi voices.
4. Verify desktop-agent authentication and connectivity using private local development configuration.
5. Add a user-editable alias registry for app/site/folder names, constrained to existing allowlisted targets.
6. Audit legacy routes and identify which are callable by the frontend, backend, or model; disable unsafe or misleading exposure where this can be done without removing unrelated user features.
7. Document setup, manual verification, supported behaviors, limitations, and results.

### Excluded

- Always-on microphone or a default-enabled wake word.
- Cloud-to-device control relays.
- Arbitrary shell, PowerShell, administrative commands, or dynamic code execution.
- File creation, rename, move, copy, organization, backup, or deletion. These belong to Phase 11.
- Signed-in browser automation, page clicking, form submission, or external actions. These belong to Phase 12.
- Screen clicking or typing. This belongs to Phase 13.
- New connected services, OAuth, or account data access. This belongs to Phase 14.
- Multi-step plan execution. This belongs to Phase 15.
- Background jobs or server-side reminder delivery. This belongs to Phase 16.
- A promise that movie-style omnipotence is possible.

## Decisions and Constraints

- **Voice locale:** The user chooses English (`en-IN`) or Hindi (`hi-IN`) before using browser speech recognition. Browser speech recognition is not assumed to reliably auto-detect between these languages.
- **Response language:** The model follows the latest user message, not merely the selected microphone locale. Hindi messages should receive Hindi responses; English messages should receive English responses; mixed-language messages may receive a natural matching mix.
- **Hindi script:** Hindi responses should use Devanagari unless the user requests Romanized Hindi or another format.
- **Text input:** Typed Hindi and English must use the same language-following behavior.
- **Speech output:** Prefer a voice whose locale matches the response. If no Hindi voice is installed, keep the Hindi text visible and report/use the browser's available fallback behavior rather than silently treating English speech as Hindi.
- **Alias security:** Aliases map user phrases only to known app IDs, approved standard folders, or validated HTTP(S) URLs. They must never become a command string, path expansion mechanism, or arbitrary executable target.
- **Secrets:** Do not place real `.env` files, API keys, or shared tokens in source control, logs, screenshots, or test fixtures. The Node backend and local agent require the same locally configured shared token for desktop calls.
- **Privacy:** Voice recognition may use browser/vendor services depending on browser implementation. State this in setup/help text; do not claim that speech is processed locally unless verified for the selected browser.
- **Account scope:** Store user aliases under the signed-in user or in an explicitly selected local profile. Do not allow one account to inherit another account's aliases.

## Work Breakdown

### 10.1 — Capture Baseline and Environment

- Record repository status before editing and preserve existing changes.
- Record supported Windows version, browser and version, Python and Node versions, and whether the local agent is started.
- Confirm that local development environment files are not tracked. Confirm whether the shared agent token is configured without displaying or copying its value.
- Run the focused existing test suites and production build; record baseline failures separately from new failures.
- Trace typed request and browser voice request through the frontend, Node backend, model provider, tool policy, Python agent, and user-visible result.

**Deliverable:** a brief Phase 10 baseline checklist with versions, commands, pass/fail results, and environment blockers. Never include secret values.

### 10.2 — Verify and Harden English/Hindi Browser Voice

- Verify the locale selector appears in both the main dashboard and corner companion, works on mobile and desktop widths, and persists across reloads for the same user.
- Verify changing locale is disabled or safely handled while recognition is active.
- Verify English recognition uses `en-IN`; Hindi recognition uses `hi-IN`.
- Verify transcript text remains editable before submission and Cancel submits nothing.
- Verify Send submits exactly the edited transcript once, including after recognition stop/silence events.
- Verify microphone permission denial, unsupported browser, no-speech, and network/STT failure show understandable states.
- Verify no microphone starts automatically on page load or after login.
- Add or update automated hook/UI tests for locale selection, transcript review, duplicate submissions, cancellation, permission failure, and unsupported recognition.

**Deliverable:** predictable English/Hindi push-to-talk with visible transcript review and actionable failures.

### 10.3 — Verify Language-Matched AI Replies

- Verify the common AI system instruction is applied to Gemini and OpenRouter paths.
- Verify the Groq desktop-tool path uses the same latest-message language rule for conversational replies, tool results, action confirmations, and plan notices.
- Check Hindi Devanagari prompts, English prompts, and natural Hindi-English mixed prompts.
- Check language switching within one conversation: a new English message after Hindi should get English, and vice versa.
- Verify tool schemas, argument validation, and permission decisions remain language-independent; translating the request must not widen allowed actions.
- Verify deterministic preflight confirmations and offline messages do not unexpectedly switch Hindi requests to English.
- Keep error and status messages truthful even when localized; never translate a failed action into a claimed success.

**Deliverable:** provider-level tests or reproducible manual cases demonstrating same-language replies and unchanged tool safety behavior.

### 10.4 — Verify Speech Output

- Verify English text uses an English voice where available.
- Verify Devanagari text sets Hindi speech locale and chooses an installed Hindi voice when available.
- Verify a missing Hindi voice does not force an unrelated English voice while labeling it Hindi.
- Verify text remains available when speech synthesis is unsupported, muted, interrupted, or fails.
- Verify Stop cancels queued speech and does not allow stale speech chunks to resume.
- Record the Windows/browser steps for installing or enabling a Hindi voice; do not bundle or install voices without explicit approval.

**Deliverable:** automated locale/voice selection checks and a target-device spoken-output checklist.

### 10.5 — Verify the Safe Desktop Starter Tool Path

- Configure the shared local agent token privately in the backend and Python agent development environments. Do not output the value or commit either `.env` file.
- Start the local agent on loopback and verify its health/status from the authenticated dashboard path.
- Verify unauthenticated calls to protected agent endpoints fail; the browser must never receive the shared token.
- Verify authenticated requests can launch only registered apps, open only supported standard folders, and open only valid HTTP(S) URLs.
- Verify malformed, unknown, or unsupported tool calls fail closed and do not fall through to shell execution.
- Verify timeout, agent-offline, and invalid-token cases produce clear errors and do not report success.
- Do not test destructive actions, shutdown, restart, admin commands, or unaudited legacy routes as if they were supported AI features.

**Deliverable:** a target-Windows manual verification report and focused automated security/regression results.

### 10.6 — Add User-Configurable Safe Aliases

- Define a small alias data model with a stable user-scoped key, display phrase, target type, and validated target ID/value.
- Support mappings only to:
  - An app ID already in the agent allowlist.
  - A standard folder ID already supported by the file boundary.
  - A syntactically valid HTTP(S) URL that passes current validation.
- Normalize phrases consistently and reject empty, excessively long, duplicate-conflicting, or ambiguous aliases.
- Provide create, list, edit, and delete UI; show what target each alias resolves to.
- Require explicit user selection when a phrase maps ambiguously; never silently select a more privileged target.
- Keep alias resolution separate from shell commands and avoid interpolating alias text into command lines or filesystem paths.
- Add storage isolation tests and tests that aliases cannot target arbitrary executables, arbitrary paths, internal URLs, or unsupported schemes.

**Deliverable:** manageable personal aliases constrained by the existing allowlists. If account sync is not ready, use local per-user storage and document that it is device/browser-specific.

### 10.7 — Audit Legacy Routes and Capability Claims

- Enumerate agent routes, Node proxy routes, frontend callers, model tool schemas, and direct desktop execution paths.
- For each path, record authentication, input validation, impact tier, user confirmation, whether a model can invoke it, and whether it is tested.
- Keep the registered tool list as the authority for model-driven execution.
- Disable or narrow any path that bypasses the registry or exposes consequential operations without the required approval, while avoiding unrelated cleanup.
- Update the README and build plan so statements such as “full browser control,” “file management,” or “autonomous agent” are not presented as implemented when they are not.

**Deliverable:** a route/tool capability matrix and focused fixes for any unsafe or misleading exposure found.

#### Phase 10 route and capability matrix

| Entry point | Authentication / validation | Impact and model access | Phase 10 status |
|---|---|---|---|
| `POST /api/agent/tool` (Node) → `POST /api/agent/tool` (Python) | App session at Node; shared bearer token at the loopback agent; both validate registered tool names and arguments | Low-impact launch app, open standard folder, open HTTP(S) URL, and read-only telemetry; only these four tool schemas are exposed to model-driven actions | Retained as the sole model-driven desktop execution path; app IDs now match the approved allowlist |
| `POST /api/assistant/aliases/execute` | App session, rate limit, server-side tool schema validation | User-created exact-phrase alias; only the same three safe launch tools, no model interpretation | Added; alias definitions are browser-local and scoped by signed-in user ID, with a local fallback |
| `POST /api/agent/command*`, `/launch`, `/open`, `/play` (Node legacy) | App session, then HTTP 410 | Free-form/legacy action path; not an approved model tool | Disabled at the Node boundary; no action is forwarded |
| `POST /api/agent/apps/close`, `/windows/close`, `/system/sleep`, `/system/restart`, `/system/shutdown` (Node) | App session, then HTTP 410 | Potentially disruptive or destructive; not an approved model tool | Disabled pending explicit confirmation/recovery design |
| Authenticated status, volume, lock, window-layout, voice, and screen-Q&A Node proxy routes | App session; route-specific input validation varies; shared bearer token is injected server-side | Direct UI features only, not included in model tool schemas; lock and layout can affect the device, screen Q&A captures screen content after UI consent | Existing UI paths retained; target-device and consent behavior still require manual verification |
| Authenticated file search/read and legacy file mutation routes | App session; Python agent has path checks for file operations | Direct routes, not model tools; file mutation does not yet have preview/undo flow | Capability remains limited/unfinished; do not describe as safe general file management |
| Agent health ping/download routes | No app session | Health metadata and installer download; no desktop action | Public availability retained; verify deployment exposure separately |

The Python agent contains additional legacy endpoints behind its bearer-token dependency. The Node web app does not proxy the disabled Node legacy command routes to them. The structured tool endpoint is the only path used by the model-facing tool runner. This audit does not claim that every authenticated direct-UI route has a uniform confirmation UX; routes outside the structured tool registry remain outside model-driven execution and need separate phase-specific review before expansion.

## Test Strategy

### Automated Checks

- Frontend browser speech recognition tests: supported locales, start/stop, transcript handling, permission errors, unsupported browser, cancellation, and single submission.
- Frontend speech synthesis tests: English/Hindi locale, matching voice selection, missing-Hindi-voice fallback, mute, stop, and interruption.
- Backend language behavior tests: Hindi, English, mixed-language, and language switching for common prompt builders and local confirmations.
- Tool-policy tests: valid and invalid aliases, allowlist enforcement, URL validation, and rejection of arbitrary paths/executables.
- Agent-boundary tests: missing/invalid bearer token, malformed tool payload, unsupported tool, and safe failure behavior.
- Run the frontend production build and relevant Python/backend tests after each code slice.
- Keep unrelated baseline lint/test failures documented; do not silently expand Phase 10 to fix unrelated defects.

### Manual Target-Device Checks

1. Open Cheeni in the supported browser and confirm the agent status is visible.
2. Select English; say a simple greeting and a safe app-launch request; inspect transcript, edit it, then send.
3. Select Hindi; say a simple Hindi greeting and a safe request; confirm the transcript is readable/editable and the response is Hindi.
4. Switch language between consecutive requests and verify the response follows the latest request.
5. Test with a Hindi system voice installed and then with no Hindi voice available; confirm text remains correct in both cases.
6. Cancel one transcript and confirm no user message/action is created.
7. Deny mic permission and confirm the UI explains recovery; verify no background mic activation.
8. Disconnect/stop the local agent and confirm the UI reports unavailable instead of claiming an action succeeded.
9. Try unknown app, malformed URL, and unsupported tool requests; confirm fail-closed behavior.
10. Create aliases only for safe registered targets and verify each alias resolves to its displayed target.

Use non-sensitive sample prompts and disposable test accounts/files. Do not test on private content or perform destructive actions during this phase.

## Acceptance Criteria

Phase 10 is complete only when all of the following are true:

- Automated tests and production build pass for the changed Phase 10 code.
- Manual English and Hindi voice checks pass on the target Windows/browser setup, or a specific external blocker is documented without overstating support.
- Language switching within one conversation is verified.
- Transcript edits and cancellation work and do not accidentally invoke tools.
- Speech output uses a matching installed locale when available and keeps readable text as a fallback.
- The local agent's token stays out of the browser; protected endpoints reject unauthenticated requests.
- Starter desktop actions remain restricted to validated tools; unknown actions fail closed.
- User aliases cannot expand tool permissions or reference arbitrary executables/paths.
- Legacy route/tool exposure is documented and unsafe model access is closed.
- README and roadmap claims match verified behavior.
- A short Phase 10 test report lists commands, results, manual checks, and unresolved blockers.

## Known Dependencies and Blockers

- Target Windows laptop and supported browser are required for live microphone, voice selection, and desktop-agent tests.
- Hindi STT/TTS quality depends on the browser's speech service and the system's installed voices. The current browser STT path requires selecting a locale; it is not reliable automatic language identification.
- Local desktop API verification requires a privately configured matching `AGENT_API_TOKEN` in backend and agent environments.
- Live AI language-quality checks require a configured provider key/account. Never place real keys in the repository or test output.
- Native wake-word and Python microphone recognition are separate from the browser locale selector and may need a later distinct language-support milestone.
- If a required external account or device is unavailable, leave that test marked blocked/unverified and do not mark the phase complete.

## Completion Record

| Check | Result | Evidence / Notes |
|---|---|---|
| Frontend tests | Pass | `frontend`: `npm.cmd test -- --run` — 3 files, 20 tests passed, including alias storage/matching and English/Hindi speech hooks. |
| Backend tests | Pass | `backend`: `npm.cmd test` — 5 files, 26 tests passed, including tool allowlist and legacy-route safety. |
| Python agent tests | Pass | `cheeni-agent`: `python -m pytest tests/test_phase6.py tests/test_phase7_security.py -q` — 6 passed; one upstream PyPDF2 deprecation warning. |
| Production build | Pass with warning | `frontend`: `npm.cmd run build` — Vite build succeeded; generated JS chunk exceeds 500 kB advisory threshold. |
| English voice on target device | Not verified | Record browser/device and result. |
| Hindi voice on target device | Not verified | Record browser/device and result. |
| Agent-authenticated desktop actions | Not verified | Do not record token values. |
| Alias safety and user isolation | Automated checks pass | `frontend/src/utils/commandAliases.test.js`: safe targets, malformed values, URL restrictions, exact English/Hindi phrase matching, and per-user storage isolation. Aliases live in browser local storage; they do not sync between browsers/devices. |
| Legacy route/tool audit | Code audit recorded | See the route and capability matrix in section 10.7; high-impact/free-form Node routes return 410, and the model tool list remains allowlisted. Authenticated direct-UI routes are not equivalent to model tools. |
| English voice on target device | Unverified | Requires manual microphone/browser check on the target setup. |
| Hindi voice on target device | Unverified | Requires manual Hindi STT/TTS check; browser STT language selection remains manual. |
| Language switching, transcript edit/cancel, mic denial | Unverified | Automated hook tests pass; live browser permission, transcript UX, and per-conversation switching still require manual validation. |
| Agent-authenticated desktop actions | Unverified | Requires starting the local agent with a matching private `AGENT_API_TOKEN`; no token was inspected or recorded. |
| Phase owner review | Pending | Complete target-device checks and review unresolved blockers before starting Phase 11. |

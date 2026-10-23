# Cheeni Phase 3 — Bilingual Voice Interaction

**Status:** Browser push-to-talk implementation hardened; target-device validation remains  
**Prerequisites:** `PHASE_1_ARCHITECTURE.md`, completed Phase 2 command boundary  
**Scope:** Voice input and spoken output for the web dashboard without adding an always-on listener or a second command-execution path.

## 1. Purpose

Make Cheeni usable by voice in English and Hindi while preserving the safety guarantees of typed interaction. Voice is an input and output experience, not a permission bypass: every transcript must follow the same conversation, tool-validation, confirmation, and result-reporting path as typed text.

The first release uses browser push-to-talk and browser text-to-speech (TTS). It must work without a wake word, must make microphone activity obvious, and must always leave the user with a typed alternative.

## 2. Goals

- Let the user deliberately start and stop a browser microphone session.
- Support `en-IN` English and `hi-IN` Hindi speech-recognition locales.
- Show an editable final transcript before it is submitted.
- Send an approved transcript through the normal assistant request flow only.
- Speak suitable assistant responses when browser TTS is available, with a clear text fallback.
- Reply in the language of the user's latest message where the model and available voice support it.
- Give understandable recovery actions for unsupported browsers, denied microphone permission, silence, recognition errors, unavailable TTS, and interrupted playback.
- Ensure stopping, leaving the page, changing language, or opening a new session does not leave the microphone or speech playback active unexpectedly.

## 3. Explicit Non-Goals

- No always-on listening, automatic microphone startup, ambient recording, or hidden wake-word process.
- No automatic language detection guarantee. The user selects English or Hindi before recording in this release.
- No raw-audio storage, upload, transcription archive, biometric voice identification, or speaker recognition.
- No direct voice-to-shell, voice-to-PowerShell, direct Python-agent, or legacy command endpoint.
- No voice-only authorization for deletion, sending, payments, installation, administrator actions, shutdown/restart, form submission, or other consequential actions.
- No offline STT engine in this phase. A later owner-approved phase may evaluate Whisper/Vosk against privacy, memory, download size, and accuracy requirements.
- No native wake-word rollout. Existing native voice code remains disabled unless a later phase deliberately enables and tests it.

## 4. Current Baseline

The repository currently contains a browser Web Speech API input hook, browser speech synthesis hook, English/Hindi language controls, and an editable transcript review flow. The browser locale selection is persisted locally. The application also has native-agent voice modules, but normal startup must not start their microphone capture.

This is a code baseline, not proof of reliable user-facing operation. Browser speech support, Hindi recognition quality, installed TTS voices, microphone permissions, and device driver behavior must be checked on the owner's Windows browser before this phase is marked complete.

## 5. Product Decisions

| Decision | Phase 3 choice | Reason |
| --- | --- | --- |
| Input mode | Visible push-to-talk control | Prevents ambient capture and makes consent clear. |
| Input language | User selects `en-IN` or `hi-IN` before recording | Browser recognition does not reliably identify mixed Hindi/English speech automatically. |
| Transcript handling | Editable review with **Send** and **Cancel** | Misrecognition must be recoverable before a request reaches the assistant. |
| Submission | Only **Send** submits the transcript | Stopping the microphone never implies approval. |
| Command path | Existing authenticated assistant endpoint and Phase 2 tool boundary | Avoids a second executor or a voice bypass. |
| Output mode | Text is always shown; TTS is optional and interruptible | Keeps the assistant accessible when no suitable voice is installed. |
| Consequential actions | Visible, action-specific confirmation after the transcript is processed | Speech alone is not reliable authorization. |
| Native wake word | Deferred and opt-in only | Requires separate privacy, device, language, and battery validation. |

## 6. Interaction Flow

```mermaid
sequenceDiagram
    actor User
    participant UI as Cheeni dashboard
    participant Browser as Browser speech APIs
    participant API as Authenticated assistant API
    participant Policy as Phase 2 policy boundary
    participant Agent as Local Windows agent

    User->>UI: Choose English or Hindi; select microphone
    UI->>Browser: Start recognition after user gesture
    Browser-->>UI: Interim and final transcript
    User->>UI: Stop recording
    UI->>User: Show editable transcript, Send, Cancel
    User->>UI: Select Send
    UI->>API: Normal authenticated assistant request
    API->>Policy: Parse request and validate any tool proposal
    Policy->>Agent: Only registered, permitted local tool calls
    Agent-->>Policy: Structured result
    Policy-->>UI: Text response and safe action outcome
    UI->>Browser: Optionally speak response
    User->>UI: Stop speaking at any time
```

### Required state model

| State | Entry condition | UI behavior | Allowed next states |
| --- | --- | --- | --- |
| `idle` | No recording or speech active | Microphone is available; typed input remains usable. | `requesting_permission`, `listening`, `speaking` |
| `requesting_permission` | User selects microphone and permission is needed | Clearly say the browser is asking for microphone access. | `listening`, `mic_error`, `idle` |
| `listening` | Browser recognition starts | Show a persistent listening indicator and Stop control; disable language switching. | `reviewing`, `mic_error`, `idle` |
| `reviewing` | Recording ends with recognized text | Show editable transcript with Send and Cancel; do not execute or submit yet. | `submitting`, `idle` |
| `submitting` | User selects Send | Use the same loading/streaming state as typed input. | `idle`, `speaking`, `request_error`, `confirmation_required` |
| `confirmation_required` | Policy returns a consequential pending action | Show action-specific visible confirmation; never treat the transcript as confirmation. | `submitting`, `idle` |
| `speaking` | TTS begins | Show Stop speaking control; text remains visible. | `idle`, `tts_error` |
| `mic_error` / `tts_error` / `request_error` | A recoverable failure occurs | Show concise cause and next action; retain typed input. | `idle`, `requesting_permission` |

## 7. Language and Bilingual Behavior

### 7.1 Input language

- Offer `English (India)` (`en-IN`) and `हिन्दी` (`hi-IN`) in both dashboard voice surfaces.
- Save only the locale preference in browser local storage; do not save raw microphone audio.
- Disable language switching during an active recording. Apply a changed selection only to the next recording.
- State that the selection affects recognition, not the language of all typed messages.
- If the selected browser does not support the requested locale, show the transcript/text workflow and ask the user to type instead.

### 7.2 Reply language

- Pass the latest user message to the normal assistant prompt with the instruction to reply in that message's primary language.
- For Hindi input, reply in Hindi/Devanagari unless the user asks for English. Preserve useful English technical names, product names, paths, URLs, and code as written.
- For English input, reply in English unless the user asks otherwise.
- For mixed Hindi-English input, respond naturally in the dominant language; ask one short clarification only when language choice changes the meaning of the request.
- Local tool identifiers, validation rules, and permission decisions remain canonical internal values. Localization changes explanation text only, never authorization or the requested target.

### 7.3 Spoken language

- Select a voice whose locale begins with `hi` for Hindi text and `en` for English text when the browser reports one.
- If a matching voice is unavailable, retain the text response and show that spoken output is unavailable or using the browser default. Do not silently claim Hindi speech is active.
- Let the user stop current speech immediately. Starting a new response cancels previous queued speech rather than overlapping it.
- Keep speech rate, volume, and selected voice as optional user preferences only after their controls and persistence behavior are documented and tested.

## 8. Privacy, Consent, and Safety Requirements

### Microphone and transcript privacy

- Start microphone access only after a visible user gesture; do not request access on page load or background startup.
- Show a strong visual listening state while recognition is active, with a one-click Stop control and accessible status text.
- Stop recognition when the user stops it, cancels review, navigates away, unmounts the component, or changes the active account/session.
- Do not write raw audio to browser storage, application logs, conversation history, analytics, or the local Python agent.
- Explain that browser speech recognition can be implemented by the browser/vendor service and may require a network connection; it is not equivalent to local offline transcription.
- Treat the final text transcript as ordinary user content. Apply the existing provider/privacy disclosure before sending it to a cloud model.
- Do not include transcripts in diagnostic logs beyond the application's existing, explicitly approved conversation retention policy.

### Execution safety

- A voice transcript goes to the same authenticated Node assistant endpoint used by typed messages.
- Any model-proposed desktop action goes through the Phase 2 closed tool registry, argument validation, backend-to-agent authentication, and structured result handling.
- No frontend speech event may call the Python agent, `subprocess`, `shell`, a legacy command route, or a browser automation function directly.
- The UI must not translate a spoken “yes” into confirmation for a consequential action. Require the existing visible action-specific confirmation control immediately before execution.
- Keep arbitrary command execution, deletion, sending, purchase, installation, shutdown/restart, and admin operations disabled unless their own later phase explicitly enables them.

## 9. Browser Compatibility and Failure Handling

### Supported path

The initial target is a current Chromium-based Windows browser with the Web Speech APIs available. Feature detection, not user-agent detection, determines whether microphone recognition and speech synthesis controls appear as available.

### Required failure mapping

| Condition | User-facing behavior | Safety behavior |
| --- | --- | --- |
| Speech recognition unavailable | Explain that voice input is unsupported in this browser; keep typed input enabled. | Do not fake listening or attempt a fallback recorder. |
| Permission denied / blocked | Explain how to enable the site microphone permission, then retry only after another user gesture. | Never loop permission prompts. |
| No microphone / audio capture error | Explain that a microphone was not found or is unavailable. | Stop listening state and release resources. |
| Silence / no speech | Return to transcript review only if usable text exists; otherwise return to idle with a concise retry message. | Do not submit an empty request. |
| Network/service recognition error | Explain that speech recognition is temporarily unavailable; permit retry or typing. | Do not synthesize a transcript. |
| Recognition aborted | Return to idle without error when the user intentionally stopped/cancelled. | Do not submit partial text automatically. |
| TTS unavailable / voice unavailable | Keep response on screen and offer no false audio status. | Do not block response rendering. |
| TTS error or interruption | Stop speaking indicator and retain text. | Cancel queued utterances; avoid repeated playback. |
| Assistant/API error | Preserve review text when practical and show normal request error UI. | Do not reroute to an alternate executor. |

## 10. Implementation Work Packages

### 3.1 — Baseline audit and ownership

1. Trace dashboard microphone controls, speech-recognition hook, transcript-review UI, assistant submission handler, speech-synthesis hook, and native-agent voice modules.
2. Confirm voice submission invokes the same function and authenticated endpoint as text submission.
3. Confirm normal Node and Python-agent startup does not auto-start native listener, speaker, or wake-word capture.
4. Record browser support and target-device assumptions without exposing configuration secrets.

**Deliverable:** a short route/state inventory appended to this document's completion record.

### 3.2 — Recognition lifecycle and transcript review

1. Feature-detect browser recognition APIs and create one instance per mounted hook lifecycle.
2. Bind the selected `en-IN` or `hi-IN` locale before each session; reject locale switching while listening.
3. Display interim speech as live text but treat it as unsubmitted.
4. On stop/end, preserve the final text in an editable review control with explicit Send and Cancel actions.
5. Reset all timers, recognition callbacks, and recording state on cleanup, cancel, and unmount.
6. Never submit from an `onend` event, silence timeout, or recognition callback.

**Deliverable:** reliable review-first browser STT flow in all dashboard voice entry points.

### 3.3 — Bilingual response and TTS lifecycle

1. Verify prompt behavior for Hindi, English, and ordinary Hindi-English code switching.
2. Choose browser voices by actual `speechSynthesis.getVoices()` locale metadata rather than display name assumptions.
3. Delay voice selection until the browser's voice list is loaded; update safely on `voiceschanged`.
4. Provide one visible control to stop current speech and cancel queued utterances before a replacement response begins.
5. Keep text rendering independent from TTS failures.

**Deliverable:** text-first bilingual response behavior with optional, interruptible browser speech.

### 3.4 — Accessibility and user controls

1. Give every microphone, stop, send, cancel, and speech control an accessible name and keyboard operation.
2. Announce listening, review-ready, permission-error, and speech-start/stop states through appropriate non-intrusive live regions.
3. Keep a fully usable typed input at all times, including when recognition or synthesis is unsupported.
4. Do not rely on color alone for microphone/speaking state.

**Deliverable:** keyboard and screen-reader test notes with the UI tests.

### 3.5 — Native wake-word disposition

1. Keep native wake-word/listener code off by default and out of standard startup scripts.
2. If a later phase evaluates it, require an explicit opt-in setting, persistent visible indicator, local-only data-flow disclosure, stop verification, Hindi/English device tests, and a battery/CPU impact check.
3. Preserve authentication on any native voice control/status endpoint and do not expose it directly to untrusted browser clients.

**Deliverable:** documented deferral; no native feature is enabled by Phase 3.

## 11. Testing Matrix

| Area | Automated tests | Manual Windows/browser test |
| --- | --- | --- |
| Recognition support | Supported and unsupported API feature detection. | Test a supported Chromium browser and an unsupported browser. |
| Lifecycle | Start/stop, duplicate start prevention, cleanup/unmount, stale callbacks, silence timeout. | Refresh/navigate while listening; verify no continuing microphone indicator. |
| Transcript review | Interim/final text, edit, Send, Cancel, empty transcript rejection. | Deliberately mis-speak a command, edit it, cancel it, then send a harmless request. |
| Permission/errors | Denied, blocked, no-speech, aborted, audio-capture, network/service error mappings. | Deny and later re-enable mic permission in browser settings. |
| Hindi/English STT | Locale argument changes and selector persistence. | Record an English request and a Hindi request; note recognition quality and unsupported locale behavior. |
| Shared request path | Voice Send calls the same assistant handler/endpoint as typed input. | Send a harmless launch/open request only after reviewing the transcript; compare outcome to typed path. |
| Tool safety | Voice-originated requests obey Phase 2 policy and confirmation behavior. | Try an unsupported/high-impact request and verify no local action happens. |
| TTS | Voice selection, unavailable voice fallback, cancel current/queued playback, error handling. | Confirm English and Hindi playback where installed; stop a long response mid-speech. |
| Accessibility | Labels, keyboard action, live-state messaging. | Keyboard-only mic/review flow and screen-reader spot check. |
| Native isolation | Normal startup does not call wake-word/listener start. | Confirm no ambient listening indicator or device use after restart. |

## 12. Manual Acceptance Checklist

Run these checks with the owner present, a harmless request, and no real secrets in the spoken content.

- [ ] A fresh dashboard load does not request microphone access or show an active microphone state.
- [ ] Selecting the microphone requests permission only after the user's action.
- [ ] English (`en-IN`) records a short English request and displays a reviewable transcript.
- [ ] Hindi (`hi-IN`) records a short Hindi request and displays a reviewable transcript.
- [ ] The user can edit a mistaken transcript, select Send, and receive the normal assistant response.
- [ ] Selecting Cancel sends nothing and starts no desktop action.
- [ ] A stopped, silent, denied, disconnected, or unsupported recognition session returns to a truthful recoverable state.
- [ ] A voice-submitted harmless local request has the same Phase 2 validation and structured outcome as the typed equivalent.
- [ ] A consequential/unsupported request cannot execute through a voice-only statement.
- [ ] Text response remains usable when no matching TTS voice is installed.
- [ ] Spoken output uses an appropriate available English/Hindi voice where possible and can be stopped immediately.
- [ ] Browser refresh, component close, and normal app restart leave no active microphone or native wake-word listener.
- [ ] No raw audio, agent token, or unexpected transcript diagnostic payload appears in browser network/dev tools or application logs.

## 13. Acceptance Criteria

- [x] Voice is explicitly initiated, visibly active, and can be stopped immediately.
- [x] English and Hindi locale selection is available and persisted locally without storing audio.
- [x] No transcript is submitted or executed until the user selects visible Send.
- [x] Voice and typed requests use the same authenticated assistant and Phase 2 command-policy path.
- [x] Hindi, English, and reasonable mixed-language replies follow the latest-message language policy without changing tool authorization at the application boundary.
- [x] Browser TTS is optional, language-aware when a matching voice exists, and interruptible.
- [x] Recognition, permission, TTS, and request failures are understandable and leave typed input available.
- [x] No normal startup path starts ambient microphone capture, a wake word, or native recording; native start routes now fail closed.
- [ ] Focused automated tests pass; the owner-reviewed target-device checklist remains open.

## 14. Rollback and Change Control

- Keep typed chat available throughout implementation and retain the ability to hide/disable voice controls through a narrow configuration/UI change if a browser regression appears.
- Do not add a fallback recorder, cloud STT provider, native wake-word startup, or new dependency as an unreviewed workaround.
- Revert only the affected Phase 3 change when a voice regression is found; preserve unrelated worktree changes.
- Do not mark Phase 3 complete based solely on unit tests. Browser permission behavior and Hindi/English voices require target-device verification.
- Do not commit, delete existing voice modules, or enable native voice services without owner approval.

## 15. Completion Record

Populate this section only while executing Phase 3.

| Item | Result | Evidence / notes |
| --- | --- | --- |
| Route and startup audit | Complete | Browser push-to-talk submits only through the normal assistant UI flow. Dashboard wake-word controls and polling were removed. |
| Recognition/review implementation | Complete | Transcript segments are retained, recognition errors suppress review submission, and silence is recoverable. |
| Bilingual prompt and TTS behavior | Code complete; target-browser verification pending | `en-IN`/`hi-IN` selection and browser voice matching remain dependent on installed browser/device support. |
| Focused frontend tests | Passed | 17 voice-hook tests passed. |
| Agent and backend safety tests | Passed | 10 Python command-boundary tests and 19 Node route-safety tests passed. |
| Dashboard production build | Passed | `npm run build` completed; existing large-chunk warning remains. |
| Target Windows/browser checklist | Pending | Requires owner review of real microphone permission, Hindi recognition, and installed TTS voices. |
| Native wake-word remains disabled | Complete | UI controls removed; native start/sync/wake/conversation routes return `410`; stop route remains for cleanup. |

# Phase 13 — Narrow Screen Interaction

## Purpose

Extend Cheeni's consent-based screen understanding into one owner-selected, bounded visual workflow. Cheeni may observe the screen and perform a small, explicitly approved set of UI actions for that workflow. This is not unrestricted mouse/keyboard control, a general-purpose computer-use agent, or permission to act on any application merely because it is visible.

Prefer Windows accessibility/UI Automation (UIA) elements and stable semantic controls. Use image/coordinate grounding only as a carefully constrained fallback with fresh observations and conservative confidence checks. The workflow must be visible, stoppable, recover safely from unexpected screens, and require explicit approval for any consequential action.

## User-visible outcome

- Ask Cheeni to perform one named screen workflow after seeing its goal, target application/window, planned steps, and allowed actions.
- Explicitly start the run after reviewing the plan and current target window.
- See when screen capture or action is in progress, which step is active, and how to stop.
- See a completion, partial-completion, cancellation, or safe-failure report that does not overstate what Cheeni verified.
- Review and confirm any consequential action separately, with exact target and content shown before that action.

The initial workflow should avoid consequential actions altogether. If a window, control, or application state is ambiguous or differs from the reviewed workflow, Cheeni stops and asks the user rather than guessing.

## Current baseline and preflight audit

The current product has on-demand screen Q&A: the frontend asks for confirmation before sending a primary-screen capture to the configured Gemini vision model; the authenticated Node route proxies to the token-protected local agent; the agent captures/compresses the screen and sends it to Gemini. The desktop vision prompt says visible content is untrusted. Current Q&A does not perform clicks or typing.

Before adding interaction:

- Trace frontend consent and status UI, Node authentication/proxy behavior, agent-token boundary, screenshot capture, provider configuration, logging, and error handling.
- Verify the precise destination, retention behavior, and provider disclosure for screenshots sent to the vision service.
- Inspect current dependencies and identify supported Windows versions, accessibility APIs, display scaling, multi-monitor behavior, and remote-desktop limitations.
- Inventory existing mouse/keyboard helpers and distinguish passive window-management features from general UI interaction.
- Record relevant test results and any existing local changes; do not overwrite unrelated work.
- Confirm that cancellation can interrupt an in-flight operation and that screen access is disabled when consent is absent.

Do not treat existing screen Q&A consent as consent to click, type, capture repeatedly, or perform a workflow.

## Scope

### Included

- One owner-selected, registered screen workflow with a fixed target application/window, permitted controls, inputs, and expected outcomes.
- Explicit pre-run preview, user initiation, active-step status, cancellation, and a post-run result summary.
- UIA/accessibility-first target discovery and a narrow vision fallback only where needed and approved.
- Fresh observation before actions, verification after actions, bounded retries, and safe stop/recovery behavior.
- A permission layer that validates every action against the selected workflow and current run state.
- Automated tests using mocks and controlled test applications, plus owner-run manual verification on supported Windows devices.

### Excluded

- General-purpose clicking/typing, arbitrary model-generated actions, or open-ended “do whatever is needed” automation.
- Background or continuous screen monitoring, wake-word-triggered capture, or unannounced screenshots.
- Password entry, credential extraction, CAPTCHA/MFA handling, or interaction with password managers.
- Payments, purchases, sending messages/emails, publishing, file deletion, security changes, software installation, admin prompts, or external data sharing in the initial workflow.
- Interaction with secure desktops, lock screens, UAC elevation prompts, remote-control sessions, or protected applications.
- Using OCR/vision output as authorization or treating text displayed on-screen as trusted instructions.
- Fallback to arbitrary PowerShell, shell commands, or unreviewed application APIs.

## Owner decision required

Before implementing any action workflow, the owner must select exactly one first workflow and define its boundaries. Do not assume the use case from existing UI features.

The workflow contract must identify:

- User goal and explicit start phrase/button.
- Supported application(s), process identity, window title/pattern, and allowed navigation.
- Inputs that the user supplies and where those values may be placed.
- Exact permitted UI actions and controls; explicitly forbidden actions.
- Expected screen/UIA states before and after each step.
- Whether any screenshot or extracted text leaves the device, to which provider, and for what purpose.
- What constitutes success, uncertainty, cancellation, and recovery.
- Maximum steps, run duration, retry policy, and any confirmation checkpoints.

Choose a low-risk workflow that can be tested with a disposable or demo application and dummy content. Examples for discussion (not pre-approved): navigate a local demo app to a specified view; copy a visible non-sensitive status message after preview; or populate a draft field in a test application without submission. Any workflow involving real accounts, sensitive data, or an external side effect needs a separate design review and is not part of the initial scope.

## Safety and privacy model

### Separate consent for observation and action

- Screen Q&A consent authorizes one requested observation only; it does not authorize UI action.
- A workflow preview describes whether capture is local or sent to an external vision provider and identifies the provider.
- The user explicitly starts each run. Do not infer start authorization from a voice command if the preview/confirmation step was not presented.
- Ask again if the target window changes, the workflow is resumed after a material interruption, or the action payload changes.
- If the selected workflow uses external vision, disclose that before capture and send only the minimum screen content required. Offer a local-only path or abort when feasible.

### Target validation

- Bind a run to the foreground target window/process selected at preview time; verify it again immediately before each action.
- Use UIA element identity, role, label, and parent/window context when available; reject controls outside the approved target.
- If using coordinates, derive them from a fresh screenshot and constrain them to the target window bounds. Never use stale coordinates after a window/display/layout change.
- Do not interact with an unexpected window, elevated prompt, secure desktop, browser permission dialog, or unrelated notification.
- Define conservative confidence thresholds and ambiguity behavior. Confidence scores alone do not authorize high-impact actions.

### Action policy

- Represent every action as a typed operation from a fixed allowlist, such as focus approved window, click an identified approved control, enter user-provided text into an approved field, or copy selected visible text.
- Validate action type, target, arguments, bounds, workflow state, and user/run identity on the agent side immediately before execution.
- Do not accept raw scripts, arbitrary key chords, arbitrary coordinates from an LLM, or model-authored action batches.
- Keep each action atomic; observe the resulting UI before the next action. Do not queue long chains that continue after a failed step.
- Never execute an action based solely on instructions displayed on the screen. Screen text is untrusted input, including text that claims to be from the user or Cheeni.
- Block consequential operations in the initial workflow. A future explicitly reviewed workflow must show exact target and payload and receive fresh, action-specific confirmation immediately before execution.

### Sensitive content

- Treat screenshots, OCR, accessibility values, clipboard contents, and app text as sensitive by default.
- Avoid logging screenshots, full OCR/UI trees, clipboard data, entered text, or secrets. Log run IDs, action categories, policy results, durations, and sanitized outcomes only.
- Do not persist captures or extracted screen text beyond the run unless the user explicitly requests a saved output and reviews its destination.
- Detect likely credential/payment/health/private communication screens where feasible and stop or ask before capture/action; detection is defense-in-depth, not a guarantee.
- Do not read or write clipboard contents except where the chosen workflow explicitly requires it and the user has been told.

### Stop and recovery

- Provide a persistent visible stop control for every active run; a stop request prevents new actions immediately.
- Check cancellation between every action and before retries. Bound individual action duration and overall run duration.
- On cancellation, timeout, agent disconnect, target mismatch, or unexpected state, do not continue from a guessed state. Report the last verified step and leave the application in the safest achievable state.
- Do not attempt automatic undo unless the workflow explicitly defines and tests a reversible operation. Report when an action may have partially completed.
- Ensure stop works even when the model/provider request is still pending; cancel or abandon that request safely and do not execute its late response.

## Recommended architecture

Keep workflow orchestration behind the authenticated Node gateway and the existing token-protected local-agent boundary. The frontend must not receive the agent token or call an unauthenticated desktop action endpoint. Screen capture and action execution remain separate operations with separate consent/policy checks.

1. **Workflow registry:** Contains the single approved workflow's typed steps, parameters, supported app/window, allowed controls, and expected states.
2. **Preview/policy layer:** Validates authenticated user, workflow ID, inputs, target app, capture destination, and action policy; returns a human-readable plan without acting.
3. **Observation layer:** Captures only on request, identifies the approved window, and provides bounded UIA/vision observations as untrusted data.
4. **Action validator/executor:** Accepts only typed allowlisted operations, checks target and cancellation immediately before each operation, and performs one action at a time.
5. **Verifier:** Re-observes the target and checks the expected state; it does not infer success from an action call returning without error.
6. **Run controller/UI:** Displays preview, disclosure, active step, stop control, confirmations, and sanitized result.

No model response may call UIA, pyautogui, or an OS input API directly. The model may help interpret an observation or suggest a registered next step; a deterministic policy layer must authorize it before execution.

## Workflow state and API sketch

Use existing route conventions; names below are illustrative and should not duplicate existing endpoints unnecessarily:

- `POST /api/screen/workflows/preview` — validate a registered workflow and inputs, identify target and disclosure, and return a plan without capture/action unless an explicitly disclosed preview capture is separately approved.
- `POST /api/screen/workflows/start` — begin only after user start confirmation; bind run to authenticated owner and selected target.
- `GET /api/screen/runs/:runId` — return sanitized state and step progress to the authorized owner.
- `POST /api/screen/runs/:runId/stop` — request cancellation and prevent further actions.
- `POST /api/screen/runs/:runId/confirm` — reserve for a future separately reviewed consequential action; bind approval to exact action and payload.
- `GET /api/screen/runs/:runId/result` — return verified outcome, last completed step, and limitations.

Suggested state flow:

`idle → previewed → awaiting_start → target_validation → observing → action_authorized → acting → verifying → observing → completed`

Terminal/exception states include `cancelled`, `target_changed`, `needs_human_review`, `blocked_by_policy`, `timed_out`, `partially_completed`, and `failed`. Every transition must be authorized server-side. Repeated start requests must not duplicate actions. A stop, timeout, disconnect, or late model response must not advance to another action.

## Implementation work breakdown

### 13.1 — Baseline audit and workflow selection

- Trace current consent UI, screen Q&A API, gateway auth, agent auth, screenshot code, configured provider, and all mouse/keyboard tools.
- Verify current screen capture destination and provider data handling; document that screen Q&A is not action consent.
- Inventory Windows/UIA dependencies and target device limitations.
- Select one low-risk workflow with the owner; write the full workflow contract and forbidden-operation list.

**Gate:** No action-control code is enabled until the workflow contract, disclosure, target, and safety boundary are accepted.

### 13.2 — Threat model and policy contract

- Define protected data, user/session boundary, malicious screen content, target spoofing, unintended clicks, replay/duplicate start, and stop failure risks.
- Define typed action schemas, control-identity checks, window/process binding, confidence/ambiguity rules, timeouts, and cleanup.
- Decide what stays local and what, if anything, is sent to the configured vision provider.

**Gate:** Security relies on deterministic validation and OS-side target checks, not only prompting.

### 13.3 — Workflow registry and preview UI

- Implement exactly one registered workflow definition with validated parameters and bounded steps.
- Generate a readable preview showing target application, actions, inputs, capture/provider disclosure, and exclusions.
- Require an explicit user start control; no hidden automatic execution from ordinary chat intent.

**Gate:** Preview can be produced without performing UI actions; invalid workflow IDs or parameters are rejected.

### 13.4 — Observation and target grounding

- Add bounded UIA observation for the approved target and minimize captured regions where feasible.
- Use vision only as a defined fallback; keep observation payload separate from trusted workflow instructions.
- Revalidate window/process identity and UIA/coordinate target immediately before acting.
- Add target-change and unexpected-screen stop handling.

**Gate:** The system identifies the intended target on supported display configurations and refuses ambiguous targets.

### 13.5 — Typed action executor

- Implement only the actions the selected workflow requires, each separately allowlisted.
- Check authorization, run state, target, arguments, bounds, and cancellation immediately before each action.
- Execute one action at a time and require verification before proceeding.
- Reject arbitrary coordinates/scripts/key sequences and all excluded consequential actions.

**Gate:** Unregistered actions are rejected even if returned by the model or requested by page/app content.

### 13.6 — Progress, stop, and recovery

- Show active state, current step, target application, and persistent stop control.
- Cancel pending model work or ignore late responses after stop; ensure they cannot trigger an action.
- Report completed, partial, cancelled, blocked, and failed outcomes truthfully.
- Document what recovery is possible and avoid claiming rollback where none exists.

**Gate:** Stop prevents subsequent actions under normal, timeout, and disconnect scenarios.

### 13.7 — Automated tests and security review

- Add unit tests for schemas, workflow action allowlist, target matching, bounds, state transitions, cancellation, and confirmation binding.
- Add integration tests against a controlled demo window/app and stub vision provider; no real account or external side effects.
- Review logs and storage for screenshot, OCR, clipboard, and typed-data leakage.
- Add a feature flag/disabled-by-default switch and a documented rollback procedure.

**Gate:** Relevant tests pass; the approved workflow does not act on real external services during test runs.

### 13.8 — Manual Windows verification and owner acceptance

- Test on supported Windows/display settings with a disposable app and dummy data.
- Verify disclosure, target binding, action-by-action observation, cancellation, app switching, and unexpected prompts.
- Record device/OS/display/provider details and any limitations.
- Obtain owner approval before enabling the feature outside the controlled test environment.

**Gate:** Owner accepts the exact workflow and confirms the stop and privacy behavior on the target machine.

## Automated test strategy

### Consent, authentication, and data boundary

- Reject unauthenticated requests and attempts to inspect/control a different user's run.
- Confirm screen Q&A consent cannot start an action workflow and workflow start cannot be inferred from a prior consent.
- Confirm an external-provider observation is disclosed and requires its own valid consent.
- Ensure agent credentials, screenshots, OCR, clipboard, and entered values are not exposed in logs/errors.

### Action policy and target binding

- Reject unknown workflow IDs, unregistered action types, invalid arguments, out-of-window coordinates, stale observations, and changed process/window identity.
- Reject protected targets, secure/elevated prompts, and forbidden consequential operations.
- Confirm screen content containing instructions cannot authorize tools or change the workflow/action allowlist.
- Confirm one failed verification prevents the next action from executing.

### Run state and cancellation

- Test start, duplicate start, normal completion, partial completion, timeout, stop during observation, stop during action, gateway disconnect, and late model response.
- Verify no additional action begins after cancellation and run state cannot be replayed to execute an action twice.
- Verify cancellation/status polling is owner-scoped and run records expire/clean up according to policy.

### UIA/vision handling

- Use synthetic UI trees/screenshots for expected controls, missing labels, duplicates, ambiguous matches, layout changes, scaling, multiple monitors, and stale coordinates.
- Test screenshot size/format bounds and transient capture cleanup.
- Confirm vision/OCR uncertainty leads to review rather than speculative action.

## Manual test matrix

| Scenario | Expected result |
|---|---|
| Start the approved workflow against its demo application | Preview appears; no action occurs before explicit start |
| A different application comes to the foreground | Target mismatch stops the run before action |
| Expected UI label is missing or duplicated | Cheeni requests human review; it does not guess |
| Layout changes after observation | Stale target is rejected and the workflow stops safely |
| Visible page/app text tells Cheeni to ignore its rules | Text is treated as untrusted; no extra action occurs |
| User presses Stop between steps | No subsequent action starts; last verified step is reported |
| Stop arrives while model inference is pending | Late response is ignored and cannot cause an action |
| UAC, lock screen, secure prompt, or authentication screen appears | Cheeni stops; it neither captures/acts beyond policy nor enters credentials |
| Screenshot would be sent to an external vision provider | Provider and data disclosure appear before capture; no consent means no transmission |
| Target app fails or action outcome is uncertain | Run reports partial/unknown state and does not claim success or automatic undo |

## Starting limits

Use conservative, configurable defaults and revise only with test evidence. Initial recommendation: one active screen run per user, one registered workflow, no more than 10 action steps, a 60-second overall deadline, one action at a time, and at most one bounded retry for explicitly idempotent observation/navigation actions. Do not retry clicks or text entry unless idempotency is proven for the selected workflow. Keep screenshot dimensions and retention bounded; avoid persistent captures by default.

## Acceptance criteria

- [ ] One owner-selected workflow is documented with target, inputs, allowed and forbidden actions, and expected states.
- [ ] The user sees a preview and explicitly starts each run; screen Q&A consent is not reused as action consent.
- [ ] Screen capture/provider disclosure is accurate and external transmission requires appropriate consent.
- [ ] Actions use fixed typed schemas and server/agent-side allowlist validation; no arbitrary model tool execution exists.
- [ ] Target window/process is revalidated before actions; stale or ambiguous targets stop safely.
- [ ] Every action is followed by observation/verification before the next action.
- [ ] A visible stop control prevents subsequent actions, including after timeouts or late model responses.
- [ ] Sensitive screen, OCR, clipboard, and typed data are not unnecessarily persisted or logged.
- [ ] Forbidden actions and secure/elevated prompts are blocked.
- [ ] Automated security/state tests and the manual Windows matrix pass on the supported target setup.
- [ ] Feature remains disabled by default until owner acceptance; limitations and rollback are documented.

## Completion record

| Item | Status | Notes |
|---|---|---|
| Current screen-Q&A audit | Complete (baseline) | Frontend confirmation precedes the authenticated Node proxy; the local agent endpoint requires its token and sends the primary-screen capture to the configured Gemini provider. This consent covers one Q&A request only. |
| Owner-selected workflow | Pending owner decision | Required before any UI action implementation |
| Threat model and action contract | Not started | Must precede action executor |
| Preview and disclosure UI | Not started | No action on preview |
| UIA/vision grounding | Not started | Target-bound and ambiguity-safe |
| Typed action executor | Not started | Exactly one workflow, disabled by default |
| Stop/recovery behavior | Not started | Test late responses and disconnects |
| Read-only vision safety hardening | Complete (initial) | Validates questions and screenshot parameters, avoids capture when the provider/key is unavailable, and returns sanitized provider errors. |
| Automated tests | Partial | `test_phase13_vision_safety.py`: 5 passed. Workflow/action tests and manual Windows verification remain pending. |
| Manual tests | Not started | Controlled app, dummy data, Windows target |
| Owner acceptance | Not started | Required before wider enablement |

## Dependencies and handoff

Phase 13 builds on Phase 6's on-demand screen Q&A and requires Phase 12's owner-selected browser workflow only if the selected screen workflow interacts with a browser. Do not assume that dependency for a non-browser desktop workflow. It also depends on the authenticated gateway/agent boundary and a working Windows test environment. If stop, target validation, or provider disclosure cannot be demonstrated, keep action execution disabled.

**Phase 13 exit:** One narrowly scoped screen workflow is observable, target-bound, stoppable, privacy-disclosed, verified after each action, and accepted by the owner on Windows. General-purpose clicking and typing remain disabled.

# Phase 15 — Approved Multi-Step Execution

## Purpose

Turn Cheeni's validated, preview-only task plans into controlled executions of a small number of registered tools. The user reviews and approves the exact plan; the coordinator then advances one bounded step at a time, validates each tool call, verifies results, and allows the user to pause or cancel.

Approval applies only to the exact plan snapshot. Any material change to a step, arguments, target, data, or permission invalidates approval and requires a new preview. The original user request, a model-generated plan, or an earlier approval is never standing authorization for changed or future work.

This phase does not create an autonomous agent with arbitrary shell, browser, screen, or external-service access. Execution may use only capabilities already implemented, reviewed, and exposed through an explicit registry. Unimplemented or not-yet-approved capabilities remain unavailable.

## User-visible outcome

- Ask Cheeni for a bounded multi-step task and receive a clear preview; planning itself does not perform any step.
- Review the exact ordered steps, targets, inputs, possible effects, and execution limits before approving.
- See each step move through pending, running, verified, failed, or skipped states.
- Pause between steps, resume an unchanged valid plan, or cancel the task.
- Receive a truthful final report that distinguishes completed, partially completed, failed, and cancelled work.
- Review and confirm separately any consequential operation that the active capability policy permits.

Cheeni stops on a failed or uncertain step. It must not silently skip, rewrite, retry, or continue with dependent steps unless the reviewed plan explicitly defines a safe branch and the policy permits it.

## Current baseline and preflight audit

The current `taskPlan.service.js` validates proposed desktop-tool calls against `validateDesktopTool`, limits previews to 2–5 steps, labels them `awaiting_review`, and marks every step `pending`. Its formatter says the plan has not been executed. Existing tests cover preview-only behavior, unsupported tools, malformed arguments, and the five-step limit. The current service does not implement task persistence, exact-plan approval tokens, execution state, pause/resume/cancel orchestration, or verified sequential execution.

Before implementation:

- Trace plan generation, the supported tool registry, desktop-agent validation, authenticated user identity, API proxying, and frontend plan presentation.
- List each tool that could be eligible for orchestration and its side effects, timeout, idempotency, result-verification method, and cancellation characteristics.
- Confirm that unsupported shell execution, disabled file mutations, and unselected browser/screen/service integrations cannot be invoked through alternate paths.
- Decide which server persists run metadata and how task ownership is bound to the authenticated user.
- Record baseline tests and preserve existing uncommitted work.

## Scope

### Included

- Validated plans within a fixed, conservative step/resource limit.
- Human-readable exact-plan preview and approval bound to the authenticated owner, plan version/digest, and expiry.
- Server-side state machine for one-step-at-a-time execution and result verification.
- Pause, cancel, explicit resume, expiry, and restart-safe behavior.
- Revalidation of tool, arguments, authorization, and assumptions immediately before every step.
- Minimal, user-isolated task persistence with documented retention and sensitive-argument handling.
- Automated tests for plan validation, ownership, approvals, duplicate requests, expiry, cancellation, limits, restart, tool failures, and unauthorized execution.

### Excluded

- Arbitrary shell/PowerShell execution, arbitrary code, free-form tool names, or model-generated APIs outside the registry.
- Unattended/background execution or automatic continuation after app/server restart.
- Infinite plans, recursive planning, hidden parallel tasks, or unbounded tool loops.
- Automatic retries of non-idempotent actions or best-effort compensation that was not part of the reviewed plan.
- Treating approval of one task as approval for a different task, changed arguments, changed target, or new permissions.
- Automatic sending, purchases, payments, account changes, deletion, or data sharing; these remain governed by each capability's own policy and require fresh, exact confirmation.
- Using Phase 15 orchestration to bypass Phase 12 browser workflow selection, Phase 13 screen workflow selection, Phase 14 service selection, or Phase 11 file-operation preview/recovery gates.

### Feature flag

Multi-step approval, step dispatch, and resume are disabled unless the backend environment variable `TASK_EXECUTION_ENABLED` is exactly `true`. It is `false` in `backend/.env.example`; do not enable it for production until manual Windows verification and owner acceptance are complete. Preview, status, rejection, pause, and cancellation remain available while execution is disabled.
- Unreviewed model access to stored secrets, provider tokens, or raw tool credentials.

## Capability eligibility and dependencies

Every step must resolve to a stable registered `tool_id` and schema. Eligibility is an explicit allowlist—not every tool the model can name. For each eligible tool, document:

- Read/write/system impact and required permission.
- Parameter schema, validation rules, allowed targets, and maximum payload sizes.
- Whether it is idempotent and whether a timeout can leave an unknown outcome.
- How success is verified independently of the tool call returning `success`.
- Timeout, cancellation, retry, and any supported recovery behavior.
- Whether it requires a separate per-action confirmation.

Initially use only the low-risk tools already supported and reviewed (for example, opening an approved app/folder/site or reading bounded system status). Exclude file mutations until their preview/confirmation/recovery path is fully implemented and enabled. Exclude browser automation, screen interaction, connected services, and any capability whose owner choice or Phase 12–14 gates are still pending.

## Approval and plan integrity

- Construct the preview only after validating the entire plan; if any step is invalid, reject the plan and execute nothing.
- Display exact ordered operations, target, normalized arguments, assumptions, likely effects, and any data sent outside the device.
- Bind approval to the authenticated user, task ID, immutable plan version/digest, and a short expiry. Use server-side storage or a cryptographically protected opaque token; never trust a client-provided “approved” boolean.
- Make approval single-use for task start and atomically transition the task to prevent concurrent or replayed starts.
- Recompute/verify the plan digest on every step. Any change to tool, arguments, order, target, data, side-effect classification, or permission invalidates approval.
- Approval to execute the plan does not substitute for a capability-specific confirmation required by a tool (for example, a separate confirmation for a destructive or external write).
- If an assumption becomes stale—target application changed, destination changed, account disconnected, file preview changed, or permission changed—pause/stop and show a fresh plan for approval.
- Expired approval can never be renewed silently; require a newly rendered preview and user action.

## Safety, state, and recovery

### Sequential execution

- Execute one step at a time. Do not run dependent steps concurrently.
- Before each step, re-check task ownership, approval validity, task status, tool allowlist, arguments, permissions, limits, and cancellation.
- Mark the step `running` before invoking the tool and persist the transition atomically.
- Verify a step using a defined postcondition or an authoritative result; do not equate process exit or model narration with verified success.
- Only after verification may the next eligible step become runnable.
- Stop the plan on failure, unverifiable outcome, policy rejection, or changed assumptions. Mark later dependent steps `not_run`/`blocked`; do not silently skip them.

### Pause, cancel, and resume

- Pause takes effect before the next step. For an in-flight tool, interrupt only if the tool supports safe cancellation; otherwise report that cancellation is pending and do not dispatch more steps.
- Cancel is terminal for that task and prevents all future step dispatch. It cannot guarantee reversal of an already completed external/system effect; report this clearly.
- Resume requires an explicit user action, a still-valid exact-plan approval, the same owner, and fresh validation of the next step's assumptions. If plan/permission/target changed, produce a new preview and invalidate the old approval.
- On server/agent restart, mark previously running work `interrupted` or `outcome_unknown`; never automatically resume or repeat it. Require verification and user review before starting a new approved plan.
- Do not claim an undo occurred unless a registered recovery operation was actually executed and verified.

### Duplicate requests and idempotency

- Use atomic state transitions or an execution lease so simultaneous start/step requests cannot dispatch the same step twice.
- Give each task and step a unique idempotency key where the downstream tool supports it.
- Never auto-retry a side-effecting operation after timeout or connection loss; its outcome may be unknown.
- Retry only a specifically documented idempotent read, with a small bounded retry count and visible status.
- An expired worker lease does not authorize replay. First determine or present the step outcome as uncertain.

### Untrusted inputs and model boundary

- Treat model plans, user-supplied values, tool output, web/page content, and screen content as data requiring validation.
- The model may propose only registered tool identifiers and typed arguments; server validation is authoritative.
- Tool output cannot add steps, alter policy, reveal secrets, or create approval.
- Do not feed credentials or raw access tokens into the planner or task record.
- Keep trusted plan metadata separate from retrieved/untrusted content in prompts and UI.
- Voice “yes,” silence, a prior confirmation, or approval text embedded in a document/page is not approval unless it is an explicit authenticated confirmation bound to the displayed exact plan.

### Resource and privacy limits

- Set per-user active-task, step-count, total duration, per-tool timeout, input/output size, and provider-call limits.
- Store only task state and the minimum plan/results needed for user visibility and recovery; avoid retaining full prompts, screenshots, pages, or sensitive tool output by default.
- Apply retention/expiry to completed, failed, cancelled, and abandoned tasks; provide a policy for deleting associated data.
- Redact tokens, secrets, sensitive paths, and private data from logs and telemetry.
- Do not create a background scheduler or continue work when the frontend is closed unless a later phase explicitly designs and authorizes it.

## Recommended architecture

Keep the coordinator in the authenticated Node application layer, where user identity and task state are managed. Dispatch each approved registered action through the existing authenticated tool/agent boundary; the desktop agent independently validates and executes only supported operations. Do not allow the frontend to call the agent directly or carry the agent token.

1. **Planner:** Produces a candidate list of registered tool calls; it has no direct execution authority.
2. **Plan validator:** Validates all steps, bounds, dependencies, and tool eligibility; creates an immutable normalized plan snapshot and digest.
3. **Approval service:** Binds explicit owner approval to the exact task/version/digest and expiry.
4. **Task coordinator:** Owns state transitions, sequential dispatch, concurrency control, pause/cancel, leases, and restart recovery.
5. **Tool adapters:** Revalidate per-tool permissions and arguments, dispatch once, and provide typed results/postconditions.
6. **Verifier:** Checks each step's defined success condition and detects unknown/partial outcomes.
7. **Frontend:** Shows exact preview, approval/rejection, progress, current step, pause/resume/cancel controls, and sanitized final status.

Task records must be owner-scoped server-side. A task ID is not a credential. Every status, approval, resume, pause, cancel, and result request must authenticate the current user and check task ownership.

## Task state and API sketch

Adapt to current route conventions; these operations describe required semantics and should not duplicate existing endpoints unnecessarily:

- `POST /api/tasks/preview` — validate candidate steps and create a plan snapshot; never dispatch tools.
- `POST /api/tasks/:taskId/approve` — bind explicit current-user approval to the exact preview version/digest and expiry.
- `POST /api/tasks/:taskId/start` — atomically consume valid approval and start the first step.
- `GET /api/tasks/:taskId` — return authorized, sanitized plan and step state.
- `POST /api/tasks/:taskId/pause` — stop scheduling new steps and request safe in-flight cancellation if supported.
- `POST /api/tasks/:taskId/resume` — explicitly revalidate and continue an unchanged, eligible task.
- `POST /api/tasks/:taskId/cancel` — terminal cancellation; prevent further dispatch.
- `POST /api/tasks/:taskId/steps/:stepId/confirm` — only for a step requiring additional exact action-specific confirmation.

Suggested task states:

`draft → awaiting_review → approved → running → paused → running → completed`

Other terminal/stopped states: `rejected`, `expired`, `cancelled`, `failed`, `partially_completed`, `needs_review`, and `interrupted`. Suggested step states: `pending`, `awaiting_confirmation`, `running`, `verified`, `failed`, `not_run`, `cancelled`, and `outcome_unknown`.

All state transitions are server-enforced and atomic. Validate allowed transition edges; reject stale versions, repeated approvals, cross-user task IDs, and out-of-order step dispatch. Persist enough information to report and recover safely, but not secrets or unnecessary raw content.

## Implementation work breakdown

### 15.1 — Baseline audit and eligible-tool inventory

- Trace current planner, preview formatting, tool schemas, Node agent proxy, user authentication, and existing tests.
- Create a capability eligibility matrix with side effects, idempotency, verification, cancellation, limits, and dependency gates.
- Confirm excluded tools cannot be called through alternate routes.
- Record the storage model and minimal task retention requirements.

**Gate:** Every eligible tool has a reviewed schema and effect/verification contract; unsupported tools remain excluded.

### 15.2 — Plan normalization and approval binding

- Normalize arguments and generate deterministic plan versions/digests.
- Create an exact, readable preview with targets and effects.
- Implement authenticated approval binding, expiry, single-use semantics, and atomic start.
- Invalidate approval on any plan or assumption change.

**Gate:** Tests prove stale, modified, duplicate, expired, or cross-user approvals cannot start work.

### 15.3 — Task state machine and minimal persistence

- Implement owner-scoped task records and explicit transition validation.
- Add per-user concurrency/resource limits, state versioning, and execution leases.
- Define retention and sensitive-field handling.
- Ensure task state cannot be used to retrieve secrets or cross-user data.

**Gate:** Restart and concurrent-request tests demonstrate no unauthorized or duplicate step dispatch.

### 15.4 — Sequential dispatch and verification

- Dispatch only the next eligible step through the authenticated existing tool boundary.
- Revalidate plan digest, user, arguments, capability policy, target, and cancellation before dispatch.
- Add per-step timeout, typed outcome, postcondition check, and bounded idempotent-read retry rules.
- Stop on failed/unknown outcome and mark dependent later steps not run.

**Gate:** One failed or unverifiable step prevents dependent steps from executing.

### 15.5 — Pause, resume, cancel, and restart safety

- Add explicit user controls and safe state transitions.
- Implement safe in-flight cancellation only where tool support is reliable.
- Require revalidation on resume; never auto-resume or replay after process restart.
- Represent uncertain effects as `outcome_unknown` and request user review.

**Gate:** Stop/cancel and restart tests prove no new action begins after cancellation/interruption.

### 15.6 — Progress and outcome UI

- Render the immutable preview and exact approval target.
- Show task state, current step, verified results, error, and steps not run.
- Keep pause/resume/cancel controls visible and disable invalid transitions.
- Ensure UI distinguishes “tool returned” from “postcondition verified.”

**Gate:** Users can understand what ran and what remains without reading logs.

### 15.7 — Security, regression, and fault-injection tests

- Add tests for plan bounds, allowlist, plan digest changes, ownership, approval replay, expiry, concurrency, cancellation, limits, restart, and provider/tool errors.
- Inject timeouts before dispatch, during dispatch, after side effect, and before verification.
- Test that untrusted tool output cannot add steps or alter task permissions.
- Confirm logs/results do not leak secrets and apply retention checks.

**Gate:** Relevant automated tests pass; no external side effects occur in test environments.

### 15.8 — Manual release review

- Test approve, reject, pause between steps, resume, cancel during a step, partial failure, expiry, and restart against safe tools/dummy data.
- Verify exact-plan display and action-specific confirmation gates.
- Release behind a feature flag/controlled rollout with rollback instructions.
- Obtain owner acceptance of the eligible-tool matrix and data retention behavior.

**Gate:** Owner confirms the tested execution matches the preview and can be stopped reliably.

## Automated test strategy

### Plan and approval integrity

- Reject empty, oversized, malformed, unsupported, or out-of-policy plans before dispatching any step.
- Verify deterministic normalization/digest and that every material plan change invalidates approval.
- Reject missing, expired, replayed, duplicate, and cross-user approval/start requests.
- Confirm rejection or plan expiry leaves all steps unexecuted.

### Ownership and access control

- User A cannot inspect, approve, execute, pause, resume, cancel, or read results for user B's task.
- A guessed task/step ID cannot bypass authentication or per-tool permissions.
- Agent-token or provider credentials never appear in client responses, task records, or logs.

### Sequential state and failures

- Verify no step N+1 dispatches before step N is verified.
- Test tool returns error, malformed result, verifier failure, partial effect, and unknown outcome.
- Confirm failures block dependent steps and produce accurate partial status.
- Ensure retries occur only for declared idempotent reads and within configured limits.

### Concurrency, expiry, and cancellation

- Race duplicate start, approval, resume, and step-dispatch requests; assert exactly-once dispatch where supported.
- Test approval expiry before start and during a paused task.
- Test pause/cancel before dispatch, during a cancellable operation, and during a non-cancellable action.
- Ensure no late tool/model response can dispatch a new step after cancel.
- Simulate worker/server restart; confirm running work becomes interrupted/outcome unknown and never auto-resumes.

### Limits and privacy

- Reject step counts, payload sizes, durations, concurrency, and tool timeouts above policy.
- Verify retention expiry and deletion of task-associated sensitive data.
- Confirm logs redact tokens, private content, and sensitive arguments.

## Manual test matrix

| Scenario | Expected result |
|---|---|
| Preview a supported multi-step plan | Exact ordered plan appears; nothing executes |
| Reject a preview | Task becomes rejected; no tools run |
| Approve then start | Approval binds to that plan; steps run one at a time with visible status |
| Change a parameter after approval | Old approval is invalid; a new preview/approval is required |
| Pause between steps and resume | No new step runs while paused; resume revalidates the unchanged plan |
| Cancel during execution | No later step starts; current effect is reported accurately, without false rollback claims |
| A tool fails or returns ambiguous outcome | Task stops; dependent steps are not run; partial/unknown state is shown |
| Repeat a start/step request | No duplicate side-effecting dispatch occurs |
| Restart Node/agent mid-task | Task is interrupted/unknown and does not resume automatically |
| Attempt a tool outside the allowlist | Plan is rejected before any step runs |
| Open a task from another user/session | Access is denied and no task metadata is disclosed |

## Starting limits

Retain the existing maximum of five steps unless testing justifies a change; use at most one active task per user initially. Set explicit overall and per-tool deadlines, bounded inputs/results, and no background continuation. Use no automatic retry for writes or uncertain outcomes. Values must be configurable and surfaced in preview where they affect execution.

## Acceptance criteria

- [ ] Only registered, reviewed, eligible tools can appear in a plan.
- [ ] The entire plan is validated and previewed before any action; invalid plans execute zero steps.
- [ ] Approval is explicit, authenticated, single-use, expiring, owner-bound, and tied to an immutable exact-plan version/digest.
- [ ] Every step is revalidated and executed sequentially; the next step requires verified completion of the prior step.
- [ ] Any material plan/target/permission change invalidates approval and requires re-preview.
- [ ] Pause, cancel, resume, expiry, and app/server restart behave safely; there is no automatic restart replay.
- [ ] Failures and unknown outcomes stop dependent work and are accurately reported.
- [ ] Duplicate requests cannot repeat side effects; retries are limited to explicitly idempotent reads.
- [ ] Per-user isolation, step/time/payload/concurrency limits, retention, and secret redaction are tested.
- [ ] Browser, screen, connected-service, file-mutation, and consequential capabilities remain unavailable until their own gates pass.
- [ ] Automated fault-injection and manual lifecycle tests pass; owner accepts rollout and rollback plan.

## Completion record

| Item | Status | Notes |
|---|---|---|
| Current preview baseline | Complete | Existing 2–5 step plans are normalized and persisted before being presented as executable. |
| Eligible-tool matrix | Complete (initial subset) | Only existing validated `launch_app`, `open_folder`, `open_url`, and `get_system_telemetry` tools can be included; broader capabilities remain excluded. |
| Exact-plan approval | Implemented | Authenticated owner, canonical SHA-256 plan digest, single transition from review, and 10-minute approval expiry. |
| Task state/persistence | Implemented | Mongo task records are owner-scoped; a unique active-task key limits each user to one active plan; records expire after 24 hours. |
| Sequential execution/verifier | Implemented (bounded) | Explicit UI action executes only one step; each step must return `success: true` from the local agent. This verifies the agent's reported outcome, not independent visual UI state. |
| Pause/cancel/resume | Implemented (bounded) | Resume revalidates expiry and state; pause/cancel during a running action apply after that action. No automatic resume/retry; stale running tasks become outcome-unknown. |
| Feature flag | Implemented | `TASK_EXECUTION_ENABLED` defaults to `false`; preview/reject/status remain available while approval/step/resume routes fail closed. |
| Automated tests | Complete | Backend unit/route suite: 40 passed; opt-in Mongo integration suite: 2 passed; task-card suite: 4 passed; frontend production build passed; Phase 12/13 security tests: 10 passed. Mongo integration covers the unique active-task constraint, cross-owner read isolation, concurrent step claims with one mocked tool dispatch, and persistence after reconnect. |
| Manual release review | Pending owner-controlled device run | Automated tests intentionally mock the desktop tool. Before enabling, manually verify preview, reject, approval, one-step execution, pause/resume, cancel, failure/unknown outcome, and restart behavior using safe apps/folders on the target Windows device. |
| Owner acceptance | Pending | Keep `TASK_EXECUTION_ENABLED=false` until the owner observes the manual run, accepts the eligible-tool matrix and data retention, and confirms rollback. |

### Verification run

- Backend unit/route suite: `npm test` (40 passed; Mongo integration suite is opt-in and skipped in the default run).
- Mongo integration suite: `$env:RUN_MONGO_INTEGRATION='true'; npx vitest run tests/taskExecution.mongo.test.js` from `backend` (2 passed against the dedicated `CheeniPhase15IntegrationTest` database; the suite drops that database before and after use).
- Frontend task-card tests: `npm test -- src/components/home/TaskPlanCard.test.jsx` from `frontend` (4 passed).
- Frontend production build: `npm run build` from `frontend` (passed; Vite reports a non-blocking large-chunk warning).
- Agent security checks: `python -m pytest tests/test_phase13_vision_safety.py tests/test_phase7_security.py` from `cheeni-agent` (10 passed).

## Dependencies and handoff

Phase 15 builds on validated tool schemas, the authenticated Node-to-agent boundary, and independently reviewed safety gates for every capability it can orchestrate. A phase being planned or partially implemented does not make its tools eligible. Keep the coordinator disabled if exact-plan approval, owner isolation, sequential verification, cancellation, or restart-safe behavior cannot be demonstrated.

**Phase 15 exit:** The user approves an exact bounded plan; every authorized step is independently validated and verified; the user can stop the task; and failures, restarts, or changed assumptions cannot trigger unsafe continuation or replay.

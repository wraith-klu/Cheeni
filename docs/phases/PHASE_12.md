# Phase 12 — Named Browser Workflows

## Purpose

Add a carefully bounded browser capability to Cheeni. The system should research public web pages and, later, run one explicitly chosen named workflow in an isolated browser context. This phase is not a general-purpose browser agent and does not grant unrestricted control of the user's browser, accounts, or computer.

Work in two stages: first establish a reliable public-page search/read/summarize path, then select and implement one repeatable workflow. Do not begin workflow execution until its purpose, domains, actions, and safety boundaries have been agreed with the owner.

## User-visible outcome

- Ask Cheeni to find and summarize public web information, with source URLs clearly shown.
- Start one named, reviewed browser workflow and see its purpose, allowed sites, and planned actions before it runs.
- Observe progress, stop a run, and receive a report of what was visited, read, and changed.
- Review any consequential external action before it occurs; the initial workflow should preferably be read-only.

The system fails closed on an unapproved domain, unexpected page state, authentication prompt, challenge, timeout, or uncertain action.

## Current baseline and preflight audit

Before implementation, inspect existing public web intelligence routes, frontend command flow, Node gateway authentication, Python local-agent boundary, tests, and documentation. Record what can be reused and what needs hardening. Do not assume an existing search, scrape, or summarization route is secure without review.

- Map browser-related UI, API routes, agent tools, configuration, and tests.
- Confirm which service owns browser lifecycle and which owns authorization.
- Verify that the browser never receives or exposes the local agent bearer token.
- Identify URL validation, redirect handling, request timeouts, result-size limits, and logging behavior.
- Record supported operating systems and whether a visible browser can be launched reliably.
- Capture baseline test results before changing behavior.

## Scope

### Included

- Public web search, page reading, summarization, and source attribution, reusing existing capabilities where safe.
- One owner-selected, named browser workflow with a fixed purpose and explicit domain allowlist.
- An isolated, temporary browser context that does not reuse the user's everyday browser profile.
- Workflow preview, explicit start, progress, stop/cancel, result reporting, and safe failure states.
- URL/network policy enforcement, hostile-page handling, browser lifecycle cleanup, and tests.

### Excluded

- Unrestricted browsing, arbitrary model-generated click/type actions, or general-purpose computer use.
- Reusing Chrome/Edge personal profiles, cookies, browser password stores, or saved sessions.
- Storing or entering passwords, bypassing CAPTCHA/MFA, or circumventing site access controls.
- File uploads/downloads, purchases, payments, account changes, or message sending in the initial workflow.
- Arbitrary shell execution, browser extensions, stealth/evasion behavior, or silent background runs.
- Treating page content as trusted instructions or allowing a page to expand workflow permissions.

If the selected use case requires sign-in or an external write, mark it out of scope until a separate credential/integration and approval design is reviewed. Prefer an official API or OAuth-based integration in a later phase over automating a personal logged-in browser session.

## Owner decision required

Before implementing the named workflow, the owner must choose exactly one initial workflow and approve its boundaries. Do not choose one on the owner's behalf.

Possible read-only examples:

- Produce a brief from a user-provided public article URL.
- Compare information across a fixed set of public product or service pages.
- Read a public portal page and report a specified status without signing in.

The workflow definition states its user goal, approved domains, inputs, allowed navigation, expected output, maximum duration/steps, and behavior when a page differs from expectations. If no workflow is selected, limit work to hardening and testing public-page research; do not invent workflow behavior.

## Safety and privacy decisions

### Browser isolation

- Launch a dedicated browser context using a temporary profile/data directory.
- Never attach to or copy the user's normal browser profile or its cookies, local storage, or credentials.
- Keep the context short-lived; close it after completion, cancellation, timeout, or failure and remove temporary state where feasible.
- Do not persist cookies, passwords, form values, page contents, or screenshots beyond the run unless the user explicitly requests an output containing them.
- Make browser visibility and run status clear to the user; provide a reliable stop control.

### Network and URL policy

Check all requested URLs and every navigation/redirect. Permit only `http` and `https`; reject embedded credentials, unsupported schemes, and unapproved ports. Block loopback, private, link-local, multicast, reserved, and metadata-service destinations for IPv4 and IPv6. Protect against DNS rebinding by validating resolved addresses at connection time and revalidating redirects and subsequent requests, not only the initial hostname.

Apply policy to browser navigations and relevant subresources, popups, frames, WebSockets, downloads, and service-worker requests. Domain allowlisting must be explicit and hostname-boundary aware (for example, `example.com.evil.test` must not match `example.com`). If the browser/network layer cannot reliably enforce policy, do not claim SSRF protection or enable the workflow until the boundary is fixed.

### Untrusted page content

- Treat page text, metadata, accessibility labels, images, and downloaded material as untrusted data, never as system instructions.
- Keep workflow instructions and page content in distinct model/context fields where applicable.
- Ignore page requests to reveal secrets, change policy, visit unrelated sites, execute code, or perform new actions.
- Limit extracted content and disclose when it is truncated or incomplete.
- Do not send private user data to a page or external model unless the user reviews exactly what will be sent.

### Actions and confirmation

- Use fixed, workflow-specific actions and allowed state transitions; do not expose arbitrary browser scripting to the model.
- The initial workflow should be read-only. If a later approved workflow includes an external side effect, show the exact destination, recipient, content/data, and action, then require separate explicit confirmation immediately before execution.
- Approval to start a workflow is not approval to submit, send, purchase, share, or change account data.
- Never infer confirmation from silence, a prior unrelated approval, page content, or a model-generated plan.
- On uncertain state, stop and explain what needs human review rather than guessing or retrying a consequential action.

### Logging and retention

Log run identifiers, policy decisions, timestamps, action types, and outcomes needed for troubleshooting. Avoid logging credentials, tokens, full page bodies, private form contents, or unredacted sensitive screenshots. Define and document retention/cleanup behavior for run artifacts before release.

## Recommended architecture

Keep browser orchestration behind the authenticated application gateway. The frontend requests preview/start/status/stop operations from the existing authenticated Node API; it must not call the Python agent directly or receive its bearer token. The service responsible for browser execution applies user/session authorization and per-run policy before invoking a pinned, supported browser automation runtime such as Playwright.

Separate responsibilities:

1. **Intent and workflow selection:** Resolve only a registered workflow ID and validated parameters; model output cannot create tools or permissions.
2. **Policy engine:** Validate authorization, domain list, URL, operation type, limits, and confirmation state.
3. **Browser runner:** Own the isolated context and execute deterministic workflow steps.
4. **Observation/extraction:** Return bounded page facts and source URLs, separated from instructions.
5. **Run state and UI:** Expose progress, current approved domain, stop control, confirmation prompts, and final report.

Browser-run state is scoped to the authenticated user/session, uses an unguessable run identifier, and expires. The browser process must not be reachable as an unauthenticated general-purpose control endpoint.

## Workflow lifecycle and API sketch

Use existing project route conventions; these names describe required behavior, not a mandate to create duplicate APIs:

- `POST /api/browser/workflows/preview` — validate workflow ID and parameters; return a human-readable plan, domains, and requested permissions without navigation or action.
- `POST /api/browser/workflows/start` — start only a registered workflow after user initiation and policy validation.
- `GET /api/browser/runs/:runId` — return bounded progress and current state for an authorized owner.
- `POST /api/browser/runs/:runId/stop` — stop the run and close its context.
- `POST /api/browser/runs/:runId/confirm` — only for a separately approved consequential action, bound to the exact preview and action.
- `GET /api/browser/runs/:runId/result` — return a sanitized result with source URLs, actions, and limitations.

Suggested state flow:

`idle → previewed → awaiting_start → policy_check → launching → navigating → observing → extracting → completed`

Terminal/exception states include `cancelled`, `blocked_by_policy`, `needs_human_review`, `timed_out`, and `failed`. If a later workflow is separately approved to perform an external side effect, insert `awaiting_action_confirmation → executing_confirmed_action → verifying` immediately before that action. Confirmation is bound to the exact action payload and expires if the page, recipient, or payload changes.

Validate every transition server-side. Duplicate start requests must not cause duplicate actions. Cancellation, process crashes, expired sessions, policy violations, or timeouts close the browser context and never fall through to an unconfirmed action.

## Implementation work breakdown

### 12.1 — Baseline audit and workflow decision

- Trace current public web routes, frontend UI, auth, agent proxy, tests, and logging.
- Run and record relevant existing tests.
- Select one read-only workflow with the owner, or explicitly defer workflow execution.
- Write its contract: inputs, approved domains, step list, expected page states, output, failure behavior, and limits.

**Gate:** No browser automation begins until the baseline and workflow contract are reviewed.

### 12.2 — Threat model and policy specification

- Document assets, trust boundaries, attacker-controlled inputs, and abuse cases.
- Specify URL/redirect/DNS/subresource policy, page-content handling, session isolation, retention, and confirmation semantics.
- Assign an owner to each policy enforcement point and identify fail-closed behavior.

**Gate:** Security policy is testable and does not depend only on the model following instructions.

### 12.3 — Harden public search and reading

- Reuse and harden existing search/read/summarize features rather than duplicating them.
- Bound request time, page count, content size, redirects, and output size.
- Return source URLs and distinguish retrieved facts from inference or uncertainty.
- Ensure fetched content cannot invoke local tools or alter Cheeni's system instructions.

**Gate:** Public-page requests pass URL, redirect, timeout, size, and hostile-content tests.

### 12.4 — Build the isolated browser runner

- Pin and document supported automation/browser versions.
- Create one temporary browser context per run; disable password saving and avoid personal profile attachment.
- Enforce hostname and network restrictions on top-level navigation and relevant outbound requests.
- Handle popup, iframe, WebSocket, service-worker, and download behavior according to policy.
- Guarantee cleanup after completion, stop, timeout, and runner crash.

**Gate:** Isolation and network policy are demonstrated in automated and manual tests.

### 12.5 — Implement one registered workflow

- Implement only the owner-approved workflow using deterministic steps and explicit expected states.
- Prefer accessible roles/labels and stable page semantics over brittle coordinates.
- Do not let model-generated selectors or free-form action sequences execute without validation.
- Stop on unexpected navigation, login prompt, challenge, missing element, or ambiguous state.

**Gate:** The named workflow is repeatable on approved test pages and safely stops on deliberate page variations.

### 12.6 — Add preview, progress, cancellation, and results UI

- Show workflow name, purpose, inputs, target domains, planned operations, and limits before start.
- Show active state, current domain, progress, and stop control during execution.
- Return a concise report of sources read, actions performed, skipped steps, errors, and limitations.
- Never display success unless the result was verified.

**Gate:** The user can understand and stop a run without inspecting logs or developer tools.

### 12.7 — Add security and regression tests

- Cover policy unit tests, runner integration tests, route authorization, state transitions, and frontend confirmation/cancel behavior.
- Use local fixtures and controlled test servers; do not automate real purchases, messages, or account changes.
- Add feature flags or equivalent staged rollout controls and document rollback.

**Gate:** Relevant automated tests pass; failures and policy blocks leave no browser process or temporary profile behind.

### 12.8 — Manual verification and release review

- Verify behavior on the supported OS/browser combination with a disposable profile and test pages.
- Review privacy, retention, visible status, stop behavior, and user-facing claims.
- Document limitations and explicitly record any deferred authenticated workflow.

**Gate:** Owner accepts workflow behavior and safety boundaries before enabling it by default.

## Starting limits

Use conservative configurable limits, then tune based on tests and the selected workflow. Suggested initial ceilings: one active browser run per user, one registered workflow, no more than 20 navigation/action steps, a 60-second deadline, a small fixed page count, and bounded extracted text (for example, 100 KB per page). These are starting values, not guaranteed final requirements. Make truncation and limit failures visible; update tests and the threat model before relaxing a limit.

## Automated test strategy

### URL and network policy

- Reject malformed URLs, non-HTTP(S) schemes, embedded credentials, unsupported ports, deceptive hostnames, and unapproved domains.
- Reject IPv4/IPv6 loopback, private, link-local, multicast, reserved, and metadata-service destinations.
- Test DNS answers that change between validation and connection, mixed public/private answers, IPv4-mapped IPv6, and redirect chains.
- Verify redirects, frames, popups, subresources, WebSockets, and service workers cannot escape policy.

### Browser lifecycle and workflow

- Confirm every run starts with a fresh context and does not read a host browser profile.
- Test success, unexpected page, timeout, stop, service crash, duplicate start, and expired run ID.
- Confirm cleanup removes temporary context state and terminates orphaned processes.
- Verify the workflow cannot visit unapproved domains or execute unregistered action types.

### Hostile content and privacy

- Use fixture pages with prompt-injection text, fake tool instructions, misleading links, hidden content, and oversized pages.
- Confirm page content is summarized as data and cannot change policy or invoke tools.
- Confirm logs and error reports do not expose tokens, passwords, or full private content.

### Application and authorization

- Unauthenticated or cross-user requests cannot start, inspect, stop, or confirm another user's run.
- Any future external side effect requires confirmation; confirmation is invalidated when its payload changes.
- UI accurately reflects cancellation, policy blocks, partial results, and failures.

## Manual test matrix

| Scenario | Expected result |
|---|---|
| Run the approved read-only workflow on its normal test page | Completes and reports source URL and outcome |
| Page tells Cheeni to ignore its rules | Treated as untrusted content; no policy change or extra action |
| Page redirects to an unapproved or private destination | Navigation is blocked and run ends safely |
| Page layout or expected label changes | Run stops for review; it does not guess or click a nearby control |
| Authentication prompt, CAPTCHA, or MFA appears | Run stops; no credentials are entered and no bypass is attempted |
| User presses Stop during navigation | Browser closes promptly; run is cancelled and cleaned up |
| Browser crashes or deadline expires | Run is marked failed/timed out and temporary state is cleaned up |
| Attempt to use the user's normal browser profile | Request is rejected; no personal profile data is opened |
| Attempt an external submission, if later separately approved | Exact action preview and fresh explicit confirmation are required; tests use no real transaction |

## Acceptance criteria

- [ ] One owner-selected workflow is documented, narrowly scoped, and domain-allowlisted.
- [ ] Public search/read/summarize results provide source URLs and visible limitations.
- [ ] Browser runs use a fresh isolated temporary context and never reuse personal profile data.
- [ ] URL, DNS, redirect, and outbound request controls are enforced outside model instructions.
- [ ] Hostile page content cannot expand permissions, invoke tools, or override policy.
- [ ] The user sees a pre-run preview, active status, cancellation control, and accurate final report.
- [ ] Unexpected states fail closed; no external side effect occurs without action-specific confirmation.
- [ ] Authentication, password storage, personal cookies, file uploads, and unreviewed downloads remain disabled.
- [ ] Automated tests cover security, authorization, lifecycle, workflow, and regressions; manual matrix is completed.
- [ ] Cleanup, retention, feature flag, rollback, and known limitations are documented.

## Completion record

| Item | Status | Notes |
|---|---|---|
| Baseline audit | Complete (partial) | Existing public web search/news/read endpoints are authenticated through the Node gateway and the local-agent routes require the agent token. The safe reader now pins its connection to validated public DNS addresses; broader route/auth review remains for the browser runner. |
| Owner-selected workflow | Pending owner decision | Do not assume the workflow |
| Threat model and policy | Not started | Must precede browser execution |
| Public reader hardening | In progress | DNS-rebinding gap fixed by connecting directly to the validated address; security test suite: 5 passed. Further end-to-end and hostile-page coverage remains. |
| Isolated browser runner | Not started | Temporary context only |
| Workflow and UI | Not started | One registered workflow |
| Automated/manual tests | Not started | No real external transactions |
| Release review | Not started | Feature-flagged until accepted |

## Dependencies and handoff

Phase 12 depends on a working authenticated application-to-agent boundary and test coverage for existing web intelligence behavior. If either is missing or cannot be demonstrated, address that prerequisite before enabling browser execution. The owner must select the initial workflow and approve its allowed domains and inputs before implementation proceeds beyond public-reader hardening.

**Phase 12 exit:** The single named workflow is repeatable and observable, respects its domain and data boundaries, reports what it read or changed, cleans up its isolated context, and never performs an unapproved external action.

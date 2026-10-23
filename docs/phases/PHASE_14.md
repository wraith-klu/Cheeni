# Phase 14 — One User-Selected Connected Service

## Purpose

Connect Cheeni to exactly one user-selected external service through that provider's official API and delegated authorization. Deliver one narrowly scoped workflow, with a clear account connection status, data-sharing disclosure, least-privilege access, protected token storage, and working disconnect/revocation controls.

The first delivered operation should be read-only whenever practical. Drafting content must remain separate from sending it. This phase does not authorize broad account access, password collection, scraping logged-in sessions, or automatic external actions.

## User-visible outcome

- Choose one supported service and see exactly what data Cheeni requests, reads, stores, and sends.
- Connect through the provider's official authorization experience; Cheeni never asks the user for their provider password.
- View whether the account is connected, which permissions were granted, and when access needs attention.
- Invoke one reviewed operation and see a clear, source-linked/attributed result.
- Disconnect Cheeni, remove stored credentials, and revoke provider access where the provider supports it.
- Review any external write as a separate action; no email/message is sent automatically.

If authorization is denied, expired, revoked, incomplete, or unavailable, fail safely and explain how to reconnect. Do not fall back to a broader scope or an unofficial integration without explicit review.

## Current baseline and preflight audit

The integration catalog currently has a planned, non-connectable Google Calendar entry for a read-only event-list operation. Its declared scope is Calendar events read-only. The catalog route is authenticated and reports metadata only; the current groundwork does not implement OAuth, connect/disconnect, token storage, or an external API call.

Before implementation:

- Trace the authenticated React → Node API path, session identity, deployment topology, environment/config handling, and integration catalog.
- Confirm which database is available, user identity mapping, encryption/key-management options, backup behavior, and log retention.
- Review the selected provider's official OAuth/API docs, required verification/consent-screen steps, redirect URI restrictions, scope rules, rate limits, revocation behavior, and test-account support.
- Identify local-development, production, and test redirect URLs; never reuse a production secret in tests or development.
- Record baseline tests and preserve existing uncommitted project work.
- Check whether provider API usage or data terms require user-facing disclosure, verification, or limited-use controls.

The catalog's Calendar option is a candidate only; the owner must select the provider and first operation before implementation. Verify exact provider requirements against current official documentation at execution time.

## Scope

### Included

- One owner-selected provider and one defined workflow.
- Official delegated OAuth authorization with state validation and PKCE where supported/required by the provider.
- Least-privilege scopes, user/account isolation, secure token persistence, refresh/expiry handling, and revocation/disconnect lifecycle.
- A clear connect/connected/expired/error/disconnected UI and data-use disclosure.
- One provider API operation and bounded output/result handling.
- Automated tests for OAuth security, authorization, token secrecy, user isolation, provider errors, and lifecycle behavior.
- Manual verification using a provider test account with limited/synthetic data.

### Excluded

- Connecting multiple providers or implementing a generalized integration platform.
- Collecting provider passwords, asking for copied access tokens, browser-cookie reuse, or scraping logged-in websites.
- Broad scopes “for future use,” silent scope expansion, or using a service-account credential to impersonate a user.
- Automatic email/message sending, publishing, purchases, payments, account changes, or sharing data with other users.
- Storing provider tokens in browser local/session storage, logs, analytics, frontend state beyond transient display, or the desktop agent.
- Using integration credentials as a way to bypass service access controls, quotas, or user consent.
- Background sync, unsolicited event monitoring, or continuous polling unless separately designed and approved.

## Owner decision required

Before building the connection, the owner must select:

1. The one provider/service.
2. The first workflow and specific API operation.
3. The account/data subset and date/time scope needed for that operation.
4. Whether data stays in the app response or is retained, and the requested retention period.
5. Whether any operation creates a draft or other external write; sending remains excluded.

The catalog's Google Calendar read-only listing is a low-risk candidate. Other candidates may be discussed, but do not implement the Calendar entry or another provider solely because a catalog entry exists. If the workflow needs broad access or a provider cannot grant the required least-privilege permission, stop and revise the scope.

## Security and privacy decisions

### OAuth and authorization

- Use the provider's official authorization-code flow through a server-controlled callback. Do not put client secrets in frontend code.
- Generate a cryptographically unpredictable, single-use `state` value bound to the initiating authenticated user/session; validate it on callback and expire it promptly.
- Use PKCE when supported/required and verify the callback's state, issuer/tenant, redirect URI, and expected provider before exchanging a code.
- Reject missing, mismatched, replayed, expired, cross-user, or unexpected callback state. A failed exchange must not create a connected account.
- Request only scopes required for the single operation. Display the human-readable permission purpose before redirecting to the provider.
- Never silently add scopes during refresh or reconnection. A scope increase requires a new visible user approval.
- Validate the provider's returned identity (stable account/subject ID) and bind it to the authenticated Cheeni user; do not trust a client-provided user ID.
- Do not treat a successful OAuth callback alone as proof that all requested scopes were granted; inspect the actual grant and fail closed if required access is missing.

### Token storage and handling

- Keep access/refresh tokens server-side only; never return them to the browser or local desktop agent.
- Encrypt persisted credentials at rest using a maintained authenticated-encryption/KMS or envelope-encryption approach. Keep encryption keys separate from the application database and source code.
- Do not invent cryptography or store reversible tokens using a hard-coded key. If secure key management is unavailable in the target deployment, do not persist refresh tokens; use a reviewed alternative or defer the feature.
- Bind every credential record to the Cheeni user, provider, provider subject/account, granted scopes, and key version. Enforce unique/conflict behavior for multiple accounts according to the approved product decision.
- Restrict token access to the integration service; redact authorization headers, codes, tokens, secrets, and sensitive provider responses from application logs and error traces.
- Use short-lived access tokens and provider-supported refresh behavior. Serialize refresh attempts per credential to avoid races; handle invalid-grant/revocation by marking the connection unusable and prompting reconnection.
- Define retention, backup, key rotation, deletion, and incident-response behavior before production enablement.

### Connect, disconnect, and revoke

- Show a clear connection state and the connected provider account identity in a privacy-appropriate form.
- Disconnect immediately blocks future API calls and deletes locally stored access/refresh tokens and related cached data according to the approved retention decision.
- Where supported, call the provider's official token revocation endpoint and report whether revocation succeeded. If the provider is unreachable, local disconnection still takes effect; clearly explain that provider-side access may remain until separately revoked/expired.
- Make the provider's manual access-revocation instructions available.
- Ensure account deletion and session/user deletion remove linked credentials and queued operations as defined by project policy.
- A reconnect should create fresh authorization state and must not resurrect previously deleted credentials.

### Data minimization and disclosure

- Explain what will be sent to the provider during authorization and what Cheeni will read/create through the API.
- Request the narrowest time range, resource set, and fields needed; bound provider results and avoid retrieving entire mailboxes/calendars when a query suffices.
- Do not include provider data in analytics, unrelated model prompts, or training/telemetry by default.
- If provider data is sent to an AI model for summarization, disclose the destination and data category, minimize the payload, and request the necessary user approval before the first such use.
- Avoid retaining raw provider responses. If retention is needed, define purpose, access controls, expiry, deletion, and user visibility.
- Do not log event details, message bodies, contact information, or identifiers unless strictly necessary and sanitized.

### External writes and model boundary

- The first integration workflow should be read-only when possible.
- Draft creation is a write: show destination/account, exact draft content/recipient, and the resulting effect; obtain explicit user confirmation before creating a draft if the provider operation changes remote state.
- Sending is out of scope for Phase 14. Do not expose a send operation or infer permission from approval to connect, read data, or create a draft.
- Provider content is untrusted data. It cannot change system instructions, grant scopes, invoke other tools, or cause an external write.
- Model output cannot select arbitrary provider endpoints, scope names, account IDs, or API request bodies; validate operation IDs and parameters server-side.
- A model suggestion is never itself approval. Bind any write confirmation to the exact provider account, operation, target, and payload and expire it if any of those change.

## Recommended architecture

Keep OAuth and provider tokens in the authenticated Node backend. The React application starts a connect flow and receives only sanitized status/results. Do not route connected-service credentials through the Python desktop agent or expose them in browser storage. Follow the existing authenticated application patterns without treating a client-supplied owner ID as authority.

1. **Integration catalog:** Describes the selected provider, operation, required scopes, data accessed, and confirmation policy. Catalog metadata is not executable authorization.
2. **Authorization controller:** Creates and validates state/PKCE data, redirects to the official provider, exchanges the code server-side, verifies grant/identity, and handles errors.
3. **Credential repository:** Encrypts/decrypts tokens using managed keys, enforces user/provider/account ownership, and supports rotation/deletion.
4. **Provider adapter:** Implements only the approved operation with fixed endpoints, strict parameter validation, timeouts, pagination/result limits, rate-limit handling, and typed errors.
5. **Policy/service layer:** Checks current user, connection state, granted scopes, operation allowlist, data minimization, and any confirmation requirement before each call.
6. **Frontend:** Shows disclosure, connect/disconnect, permission state, data query controls, sanitized result, and errors; never receives credentials.

Suggested server-side API shape (adapt to current route conventions; do not create overlapping APIs):

- `GET /api/integrations` — authenticated catalog/status view without secrets.
- `POST /api/integrations/:provider/connect` — create a short-lived authorization transaction and return/redirect to provider authorization.
- `GET /api/integrations/:provider/callback` — validate state and complete server-side exchange.
- `GET /api/integrations/:provider/status` — return sanitized connection state, account label, and granted permission summary.
- `POST /api/integrations/:provider/operations/:operationId` — invoke only the registered operation for the authenticated owner.
- `POST /api/integrations/:provider/disconnect` — disable access, delete tokens/cache, and attempt provider revocation.

Do not include token/code material in URL query parameters beyond the provider's unavoidable authorization callback; immediately exchange codes server-side and scrub callback parameters from logs/telemetry. Use secure, same-site session cookies and CSRF protections consistent with the existing app.

## Operation lifecycle

Suggested read-only flow:

`disconnected → authorization_pending → connected → request_validated → provider_call → result_sanitized → completed`

Error/terminal states include `authorization_denied`, `state_invalid`, `scope_missing`, `token_expired`, `access_revoked`, `rate_limited`, `provider_unavailable`, and `disconnected`. Every operation rechecks user ownership and current connection/scope; cached status alone does not authorize a call.

For a future draft/write operation, use a separate flow:

`draft_preview → awaiting_exact_confirmation → provider_write → verified_result`

Never add a send transition to this phase. If a write times out with an uncertain outcome, do not automatically retry; query/verify safely or present an unknown outcome for user review.

## Implementation work breakdown

### 14.1 — Baseline audit and owner selection

- Trace `integrationRegistry.service.js`, the authenticated integration route, session/user identity, database model conventions, encryption/config storage, and deployment settings.
- Confirm the existing catalog is metadata-only and no credentials or provider calls are currently present.
- Owner selects one provider, one initial operation, fields/data range, and retention decision.
- Record current tests and supported local/production callback URLs.

**Gate:** Do not implement authorization until provider and workflow are selected and hosting/key-storage requirements are understood.

### 14.2 — Provider requirements and threat model

- Review current official provider OAuth, API, scope, verification, rate-limit, and revocation documentation.
- Define user data categories, trust boundaries, token threat model, callback attacks, CSRF/replay risks, and service-account isolation.
- Confirm development/test accounts and provider review/verification requirements.

**Gate:** Requirements are documented and least-privilege scope availability is confirmed.

### 14.3 — OAuth transaction and callback

- Implement secure state generation, storage, expiry, single-use behavior, and authenticated user/session binding.
- Add PKCE and issuer/redirect validation as supported/required.
- Exchange codes server-side; verify provider identity and actual granted permissions.
- Handle denial, malformed callback, code replay, timeout, and provider errors without creating partial connections.

**Gate:** OAuth tests cover state/CSRF/replay and callback cross-user isolation.

### 14.4 — Protected credential persistence

- Choose an approved managed-key/envelope-encryption approach for the deployment target.
- Implement credential records with strict user/provider/account ownership and encrypted-at-rest token fields.
- Add redaction, limited service access, token refresh serialization, rotation/versioning, and deletion paths.
- If secure key handling cannot be provided in the deployment environment, stop before storing refresh tokens.

**Gate:** Tests and configuration review demonstrate tokens cannot be read from API responses, logs, or another user's records.

### 14.5 — Connection UI and lifecycle

- Add disclosure and connect flow, status, account display, permission summary, disconnect, and reconnect/error states.
- Ensure disconnect blocks future calls immediately and removes local token/cache material.
- Implement provider revocation where available and explain partial failure accurately.

**Gate:** Manual test account can connect, display status, disconnect, and verify provider-side access state.

### 14.6 — One provider operation

- Implement exactly the owner-selected operation with narrow scope and bounded inputs/results.
- Apply timeouts, pagination caps, rate-limit handling, safe retries for idempotent reads only, and sanitized errors.
- Add source/updated-time/context details so the user can judge freshness and completeness.
- Keep model summarization optional and separately disclosed if it transmits provider content to another service.

**Gate:** The operation returns verified, bounded results from a test account and cannot access unrelated provider data.

### 14.7 — Security and regression tests

- Add unit tests for catalog permissions, operation allowlist, scope validation, token repository, refresh, disconnect, and provider adapter.
- Add route tests for authentication, CSRF/state, cross-user isolation, invalid parameters, and sanitized error responses.
- Add provider-mocked tests for revoked/expired access, rate limits, pagination, malformed responses, timeouts, and uncertain outcomes.
- Ensure secrets are excluded from logs, analytics, traces, test snapshots, and frontend bundles.

**Gate:** All relevant automated tests pass; no live user data or production credentials are used in tests.

### 14.8 — Manual verification and controlled release

- Use a test account and synthetic data to verify actual consent screen, granted scopes, operation result, expiry/revocation, and disconnect.
- Verify data-sharing disclosure, provider account identity, result bounds, and deletion behavior.
- Enable behind a feature flag for controlled testing; document rollback and key-compromise response.
- Obtain owner acceptance before general availability.

**Gate:** The owner verifies the permission screen and actual API access match the documented scope.

## Automated test strategy

### OAuth and callback security

- Reject missing, mismatched, expired, reused, or cross-user OAuth `state` values.
- Verify PKCE challenge/verifier and redirect/issuer validation where applicable.
- Reject authorization errors, missing codes, unexpected provider/tenant, replay, and code-exchange failures without persisting tokens.
- Confirm state transactions are single-use and cleaned up after success/failure.

### Token confidentiality and user isolation

- Confirm access/refresh tokens never appear in API JSON, browser storage, logs, errors, analytics, or normal database projections.
- Verify encrypted credential values are unreadable without the configured key and that key/config absence fails closed.
- Verify user A cannot read, refresh, use, disconnect, or revoke user B's linked account.
- Confirm refresh-token rotation, refresh race handling, expiry, invalid-grant/revocation, and disconnect deletion.

### Scopes and provider operation

- Reject missing required scopes and unexpected broad scopes according to approved policy.
- Verify only registered provider operations/endpoints are callable and parameters are bounded.
- Test provider timeout, rate limit, pagination cap, malformed response, partial result, revoked access, and sanitized errors.
- Verify read operations are idempotent and never trigger a write; tests for draft write must require exact confirmation and must never send.

### Lifecycle and data minimization

- Confirm disconnect blocks the next request immediately, deletes local tokens/cache, and records revocation outcome without secrets.
- Confirm result fields and date ranges are minimal and bounded.
- Confirm provider data is not automatically inserted into unrelated model requests or telemetry.
- Verify feature-flag-off behavior does not allow callbacks or operations to bypass normal route authorization.

## Manual test matrix

| Scenario | Expected result |
|---|---|
| Connect a provider test account | Official consent screen shows only approved scopes; callback binds the account to the signed-in user |
| User denies consent | No credential record is created; user sees a safe cancellation message |
| Callback state is missing, stale, or changed | Connection is rejected; no provider token is persisted |
| Provider grants fewer scopes than required | Connection is not used for the operation; user gets a clear permission explanation |
| Run the approved read operation with synthetic data | Only the approved resource/range is fetched and result size is bounded |
| Provider token expires or access is revoked | Calls stop; status changes; user is asked to reconnect if appropriate |
| Disconnect while connected | Local use stops immediately, stored token/cache material is deleted, and provider revocation outcome is shown |
| Another account/user requests this connection | Access is denied; no account metadata or data leaks |
| Provider is rate-limited or unavailable | Cheeni reports a retryable/temporary failure; it does not broaden scope or repeat unsafe operations |
| An email/draft feature is later considered | Draft is separately previewed/confirmed; sending remains unavailable in Phase 14 |

## Starting limits

Use conservative configurable limits derived from the chosen operation. Suggested starting policy: one provider, one account per user unless a product decision says otherwise, one read-only operation, bounded date range and page count, a short API timeout, and no persistent raw provider response cache. Do not hard-code generic limits that conflict with provider quotas; document and test the specific values selected for the operation.

## Acceptance criteria

- [ ] Exactly one owner-selected provider and workflow are documented.
- [ ] Official delegated authorization is used; Cheeni never collects provider passwords.
- [ ] OAuth state is unpredictable, user-bound, expiring, single-use, and covered by tests; PKCE/issuer checks follow provider requirements.
- [ ] Scopes are least-privilege, shown to the user, verified after authorization, and never silently expanded.
- [ ] Tokens are encrypted at rest, server-side only, user-isolated, redacted, and deletable/revocable.
- [ ] Connect, status, reconnect, disconnect, and provider-side revocation behavior are visible and tested.
- [ ] Only the selected provider operation is callable; data inputs/results are bounded and minimized.
- [ ] Provider errors, expiry, revocation, rate limits, and uncertain outcomes fail safely.
- [ ] Provider data is not forwarded to another model/service without disclosure and appropriate user approval.
- [ ] No message/email is sent; any permitted draft/write requires exact action review and confirmation.
- [ ] Automated security tests and test-account manual verification pass; feature is controlled until owner acceptance.
- [ ] Retention, key management, rollback, provider verification requirements, and known limitations are documented.

## Completion record

| Item | Status | Notes |
|---|---|---|
| Integration groundwork audit | Complete (initial) | Authenticated catalog route is rate-limited and metadata-only. MongoDB is configured, but no provider OAuth, credential model, or encryption/KMS key-management configuration was found. |
| Provider and workflow selection | Pending owner decision | One provider and one operation required |
| Official provider requirements | Not started | Verify current official docs during execution |
| OAuth callback and state | Not started | State/CSRF/replay protections required |
| Encrypted credential storage | Not started | Must confirm deployment key management first |
| Connect/disconnect/revoke UI | Not started | No credential exposure to frontend |
| Selected provider operation | Not started | Prefer read-only first operation |
| Baseline catalog tests | Complete | `backend/tests/integrationRegistry.test.js`: 2 passed; confirms the Calendar entry remains planned/non-connectable and returned data is a defensive copy. |
| OAuth/security tests | Not started | State/CSRF, scopes, token secrecy, isolation, errors |
| Manual test-account verification | Not started | Synthetic data; verify actual grants |
| Owner acceptance/release | Not started | Keep disabled until accepted |

## Dependencies and handoff

Phase 14 requires the authenticated Node backend, reliable user/session identity, a supported secure credential-storage/key-management strategy, and a provider test account. The current catalog is only groundwork and does not satisfy these prerequisites. If secure token storage or least-privilege scopes are unavailable, keep the integration non-connectable. If the chosen workflow requires email/message sending or broad data access, split it into a separate reviewed phase.

**Phase 14 exit:** One connected service provides one bounded, owner-approved operation with verified least-privilege authorization, protected/revocable credentials, minimal data handling, and no unapproved external writes.

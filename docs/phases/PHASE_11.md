# Phase 11 — Safe File Changes and Recovery

## Purpose

Turn Cheeni’s existing limited file search/read and basic filesystem operations into a safe, reviewable file workflow. Every write must be scoped to approved user data folders, previewed against exact paths and expected impact, explicitly confirmed, revalidated immediately before execution, and reported with a recovery option when recovery is reliable.

This phase is not general filesystem control. It does not enable delete, recycle-bin emptying, arbitrary shell or PowerShell, administrator access, access to credentials/system files, or unattended file changes. Cheeni must never treat an AI-generated plan or natural-language request itself as authorization to mutate files.

## User-Visible Outcome

At the end of Phase 11, the user can:

- Search and read supported documents within the approved roots: Desktop, Documents, and Downloads.
- Request creation of a folder, rename, move, copy, a bounded organization task, or a backup within those roots.
- Review a preview showing exact source(s), destination(s), collision behavior, item count, estimated size, and any skipped items before confirming.
- Confirm or cancel a specific preview; a changed, expired, or already-used preview cannot be applied.
- See per-item results and failures rather than an unqualified success message.
- Undo a completed operation when the inverse operation is safe and the affected items have not changed.
- Recover from ordinary errors and interrupted multi-item jobs without silently overwriting or deleting user data.

Deletion remains unavailable. Moving a file is not a synonym for deletion; moving outside the approved roots is rejected. A future delete feature needs a separately reviewed Recycle Bin and restore design.

## Current Baseline and Risks

The Python agent currently has helpers for search, document reading, folder creation, rename, and move in `cheeni-agent/tools/filesystem_control.py`. Those helpers are not a preview/confirmation transaction system. For example, folder creation and move can write during the initial operation call, and move may create a destination directory. Legacy Node and Python routes exist for file operations. They must not be wired directly to an AI action or UI button as a substitute for the Phase 11 workflow.

Phase 11 begins by tracing each path from UI through Node to Python. Keep existing search/read behavior only after its path, symlink, output-size, and privacy controls pass the tests in this plan. Put all mutations behind one new structured workflow with distinct preview and confirmation steps. The model may propose an operation, but only the authenticated user’s confirmation of a concrete preview authorizes execution.

## Scope

### Included

1. Define approved roots and a canonical filesystem policy shared by preview and execution.
2. Harden search/read and implement a bounded result and content policy.
3. Add create-folder, rename, move, and copy operations, all preview-first.
4. Add only clearly bounded organization and backup workflows that can be represented as explicit lists of file operations.
5. Add expiring, one-time, user-bound confirmations and revalidation of the preview at execution time.
6. Add an operation journal, safe rollback/recovery, and truthful per-item status reporting.
7. Add automated security, race, rollback, and partial-failure tests, plus disposable-folder manual checks.
8. Remove or retire unsafe direct mutation entry points that bypass preview/confirmation.

### Explicitly Excluded

- Deleting files/folders, emptying Recycle Bin, secure erase, or cleanup by age.
- Access outside Desktop, Documents, and Downloads (including arbitrary home-directory, project, network, removable, cloud-sync, and system paths).
- Arbitrary commands, scripts, executable launch, registry changes, permission changes, or elevation.
- Overwrite/merge without a separately designed, exact and reversible workflow. Default is reject collisions.
- Recursive broad cleanup, deduplication based on fuzzy guesses, AI-selected mass moves without a full itemized preview, or unattended organization.
- Editing document contents or extracting and sending file contents to an external model without a separate disclosure/consent policy.
- Background or scheduled file mutations. Phase 16 governs unattended work and must not inherit write privileges from this phase.
- A blanket “undo everything” claim. Undo is offered only when the journal and current filesystem state prove that the inverse is safe.

## Safety and Data-Handling Decisions

### Approved roots and path identity

- Approved roots are the current user’s resolved `Desktop`, `Documents`, and `Downloads` directories. If a configured root does not exist, the feature must report that state; it must not silently substitute another folder.
- Decide and document whether a symlink/junction inside an approved root is rejected or allowed only when its fully resolved target remains inside the same approved root. The initial recommended policy is to reject symlinks, junctions, reparse points, and mount-point traversal for mutations and reads until Windows-specific checks are proven reliable.
- Resolve each source and destination to a canonical path and verify containment after resolution. A string-prefix check is never sufficient.
- Reject UNC/network paths, device paths, drive-relative paths, alternate data stream syntax, environment-variable expansion, `~` ambiguity, reserved device names, and paths that escape with `..`.
- Ensure the final parent directory and the selected object remain under an allowed root immediately before every filesystem operation.
- Case-insensitive path comparison must match Windows semantics. Test Unicode normalization and case collisions on Windows.

### Operation preview

Every preview is a server-created operation record with a cryptographically unguessable ID and an authenticated owner. The server—not the client—stores the normalized action and exact plan. The browser may render the returned preview but cannot change its operations and reuse the confirmation identifier.

Preview records should contain, at minimum:

- Operation ID, owner ID, operation type, creation time, expiry, and `pending` state.
- Canonical source and destination paths, root classification, and the exact files/folders selected.
- For every source: relative path, item type, byte size, last-modified time, and a stable identity snapshot (Windows file ID where practical; otherwise a carefully defined stat signature plus content hash when needed).
- Intended effect and expected count/size; for folder operations, an explicit bounded list, not an opaque “all files” command.
- Collision decisions, skipped items, warnings, and whether recovery is available.
- A digest of the normalized plan so confirmation applies only to the preview the user saw.

The preview is not authorization by itself. It expires after a short, configurable interval (recommended default 5 minutes), is consumable only once, and is invalidated on cancellation, user/session change, material filesystem change, or policy change. Never log file contents, access tokens, or unnecessarily sensitive absolute paths.

### Confirmation and execution

- Confirmation is an explicit UI action tied to the exact pending operation ID. “Continue,” a natural-language “yes” unrelated to the preview, or a prior confirmation for a different plan is insufficient.
- Display a localized, specific confirmation including operation type, item count, destination, overwrite/collision behavior, and recovery status. Hindi and English should follow the active conversation/UI locale where available.
- Before committing, atomically claim the operation ID (`pending` → `executing`) to prevent replay or concurrent execution.
- Recompute path safety and source identity, verify the destination and collision policy, verify the same user/session, and ensure the preview has not expired. Any mismatch cancels the operation and requires a fresh preview.
- Use same-volume atomic rename where possible. For copy/cross-volume operations, write to a unique temporary sibling, flush/verify it, then atomically publish without overwriting. Clean up only temporary artifacts created by the operation.
- Do not claim all-or-nothing for multi-item operations unless rollback has actually restored every item. Return itemized `succeeded`, `failed`, `skipped`, `rolled_back`, or `recovery_required` states.
- Recheck state after each operation and record the actual result. Stop or pause after an unexpected error; do not continue applying a stale plan to a changing directory.

### Undo and recovery

- Create a journal entry before and after each mutation, containing the operation ID, user ID, action, canonical locations, item identity, timestamps, and result. Store no file contents in the journal.
- Offer undo for create-folder only if the folder is still empty and still the same created object; rename/move only if the object remains at the expected destination and the original source is free; copy only if the copied object still matches the operation’s recorded identity/hash and undo can remove only that exact copy.
- Never overwrite an object to make undo “succeed.” If source/destination changed or a collision appeared, stop and explain how the user can recover manually.
- For an interrupted multi-item task, report exactly which items changed and provide safe per-item recovery actions. Do not auto-run a destructive rollback that could delete a user-modified file.
- Journal expiry/retention and storage location must be documented. Protect the journal from other users on the machine; avoid storing it in a sync folder by default.

### Organization and backups

- An organization workflow is a preview of individual moves/copies, not a generic agent instruction. Use deterministic rules selected by the user (for example, extension-to-folder or a user-chosen date range); do not infer categories and move files silently.
- Bound each plan by configurable maximum item count, total bytes, directory depth, and elapsed time. Reject plans over limits and ask the user to narrow the selection.
- A backup operation must disclose source and destination, estimated bytes, available disk space where measurable, whether metadata is preserved, and whether the result is a copy or archive. Verify the backup after writing and do not delete the source.
- Do not back up outside approved roots in this phase unless the user explicitly chooses an additional destination and that destination receives a separately reviewed allowlist/security design. The initial implementation should keep both source and destination within approved roots.
- Do not follow symlinks/reparse points during recursive organization or backup. Avoid unbounded recursion and special files.

### Privacy and prompt injection

- Treat filenames, file contents, document metadata, and directory names as untrusted data, never as instructions or authorization.
- For read requests, show which file is being read and provide a clear result if it is unsupported, too large, encrypted, or unreadable. Apply file-type and response-size limits.
- Ask before sending extracted content to a hosted AI provider. Default to not uploading file contents unless that disclosure/consent is explicit and the current provider behavior is known.
- Avoid logging content or returning entire absolute paths in analytics. Keep user-visible paths sufficiently clear to verify the target without leaking unrelated account data.

## Recommended Architecture

```text
Typed/voice request
        ↓
Intent parsing (proposal only; no filesystem side effect)
        ↓
Filesystem policy + canonical path resolver
        ↓
Preview builder (bounded, exact operation list)
        ↓
User reviews and explicitly confirms preview ID
        ↓
Atomic claim + expiry/owner/plan-digest revalidation
        ↓
Filesystem executor (no shell; recheck each source/destination)
        ↓
Operation journal + verified result + safe undo eligibility
        ↓
Localized status, itemized results, and recovery controls
```

Keep the executor as a small allowlisted set of operations, for example `create_folder`, `rename`, `move`, and `copy`. Do not make a generic “execute action” API that accepts arbitrary paths or operation names. Keep proposal/preview endpoints read-only; make the commit endpoint the only mutating entry point, and require authenticated confirmation plus the one-time preview ID.

## Work Breakdown

### 11.1 — Baseline, Call Graph, and Threat Review

- Record repository status and preserve all existing work.
- Trace current Node and Python file routes, frontend callers, model tool schemas, and direct utility calls.
- Identify whether any current UI, model, or legacy endpoint can invoke create/rename/move without a preview. Disable or route that path through the new workflow before adding UI controls.
- Record Python, Node, and Windows versions and current file-root assumptions without listing private user files.
- Agree on the root/symlink policy, journal persistence, preview lifetime, size/count limits, and user-facing confirmation language before implementing mutations.

**Deliverable:** concise baseline and risk decisions in this document’s completion record or a linked test report.

### 11.2 — Canonical Filesystem Policy

- Implement one canonical resolver/policy module used by search, read, preview, execute, and undo.
- Restrict all operations to resolved approved roots; reject traversal, path ambiguity, symlinks/reparse points (initial policy), UNC/device paths, and unsupported object types.
- Make Windows case-insensitive collision detection explicit.
- Reject roots that resolve to unexpected locations and verify behavior when Desktop/Documents are redirected by Windows or cloud backup.
- Add unit tests before wiring the policy into UI.

**Deliverable:** testable path-policy helpers with no filesystem writes.

### 11.3 — Harden Search and Read

- Bound query length, traversal depth, inspected entries, results, document size, page count, text extraction time, and returned characters.
- Ensure errors do not expose stack traces or unrelated absolute paths.
- Reject links/reparse points, unsupported files, encrypted/binary files, and files that change while being read, with clear user feedback.
- Ensure document content is untrusted input and not treated as agent instructions.
- Confirm file contents are not sent to an external model without explicit disclosure and consent.

**Deliverable:** safe, bounded read-only search/read with privacy-aware responses.

### 11.4 — Preview Records and Lifecycle

- Define a versioned operation schema and operation state machine: `pending`, `executing`, `completed`, `partially_completed`, `cancelled`, `expired`, `failed`, and `recovery_required`.
- Store owner, plan digest, exact file list, identity snapshots, expiry, and expected impact server-side.
- Add authenticated preview retrieval, cancellation, and expiry cleanup. Retrieval must enforce owner isolation.
- Ensure retries cannot create duplicate operations or extend expiry silently.
- Unit-test malformed records, cross-user lookup, expiry, replay, concurrent claims, and changed plans.

**Deliverable:** a durable or appropriately scoped preview lifecycle without mutation capability.

### 11.5 — Safe Single-Item Operations

Implement one at a time, with preview → user confirmation → revalidation → operation → journal → result:

1. **Create folder:** exact parent and folder name; reject existing destination and reserved names; no implicit recursive parent creation unless each missing parent is included in preview.
2. **Rename:** exact source and proposed sibling name; reject collision, invalid name, root-folder rename, and path escape.
3. **Move:** exact source and destination directory; reject moving a directory into itself/descendant, collisions, cross-root transfer if policy disallows, and ambiguous replace behavior.
4. **Copy:** exact source and destination; reject collisions by default; use temporary destination and verify file size/hash before publication; bound recursive copies by explicit item list/limits.

Do not proceed to multi-item organization until the four single-item flows have passed automated and manual testing.

**Deliverable:** individually tested safe operations with operation records and only conditionally available undo.

### 11.6 — Bounded Organization and Backup

- Offer one simple, deterministic workflow first (owner-selected rule and explicit source scope); do not ship open-ended “organize my computer.”
- Generate and display the full operation list, including unchanged/skipped items and all destinations.
- Enforce item/byte/depth/time limits and require a fresh preview after any source changes.
- Implement backup as copy-only, verify every result, disclose destination space estimate, and never remove or overwrite source data.
- Provide a pause/cancel mechanism at safe item boundaries and a recovery report for partial completion.

**Deliverable:** one owner-reviewed, repeatable organization or backup workflow. Defer additional workflows rather than broadening the interface.

### 11.7 — Confirmation, Journal, Undo, and Recovery UI

- Add a dedicated preview panel that names the action and shows all exact targets and effects. Avoid hiding important paths/counts behind collapsed UI.
- Provide distinct Confirm and Cancel controls; confirmation must be an explicit click/tap, not voice inference alone.
- Disable confirmation when the preview expires or changes, and explain how to create a fresh preview.
- Show progress and itemized completion/failure status. Do not display success until the executor verifies the result.
- Offer Undo only when the server marks that exact operation as safely reversible; revalidate current object identity before undo.
- Include operation history with minimal metadata and owner-scoped access; allow journal expiry and clear history controls that do not delete user files.
- Provide English and Hindi copy for preview, cancellation, expiry, partial failure, and recovery status where the interface supports localization.

**Deliverable:** transparent confirmation and recovery interface with no blanket undo promise.

### 11.8 — Legacy Route Retirement and Model Boundary

- Remove model access to all filesystem mutation tools in this phase. Model may propose a candidate preview, but execution can occur only after user confirmation.
- Ensure frontend uses only the preview/confirm API; never invoke legacy `/api/agent/files/create_folder`, `/rename`, or `/move` directly.
- Restrict or retire legacy direct mutation routes at the Node gateway and Python agent. If compatibility requires keeping them temporarily, make them unavailable to the browser/model and document deprecation; do not leave a reachable bypass.
- Validate schemas at Node and Python boundaries. Node must not forward a client-supplied owner ID, target root, command, or confirmation flag as authority.
- Add route tests for unauthenticated requests, malformed schemas, cross-user operation IDs, missing/expired/consumed confirmations, and attempts to call legacy mutation routes.

**Deliverable:** a single auditable mutation path and regression tests proving direct bypasses fail closed.

### 11.9 — Manual Target-Device Testing and Documentation

- Use a disposable test tree with small text files, a nested folder, duplicate names, a read-only file, and test data with no personal content.
- Exercise create, rename, move, copy, cancellation, expiry, undo, collisions, partial failure, application restart, and local-agent disconnect.
- Verify Windows path behavior for redirected user folders, Unicode names, long paths, case-insensitive collisions, file locks, and reparse points.
- Verify that no action executes from merely speaking a request, from transcript cancellation, from a stale preview, or after user sign-out.
- Update README and roadmap to claim only the operations that passed both automated and manual checks.

**Deliverable:** reproducible target-device report with OS/browser/agent versions, outcomes, and known limitations—without private filenames or secrets.

## API and State-Machine Contract

Exact endpoints may follow repository conventions, but preserve these semantics:

| Operation | Behavior | Filesystem side effect |
|---|---|---|
| `POST preview` | Validate intent, resolve paths, enumerate exact plan, store owner-bound preview, return summary and operation ID | None |
| `GET preview/:id` | Return only the authenticated owner’s pending preview and current expiry/status | None |
| `POST preview/:id/cancel` | Cancel only that owner’s still-pending preview; idempotent safe response | None |
| `POST preview/:id/confirm` | Atomically claim, revalidate owner/expiry/digest/path identities, execute and journal | Only after all checks pass |
| `POST operation/:id/undo` | Verify completed operation, current identities, and inverse safety; atomically claim undo | Only the specific safe inverse operation |
| Legacy direct mutation endpoint | Return a clear disabled/deprecated response; do not proxy to the agent | None |

Use a database transaction/atomic compare-and-set for state changes where supported. If filesystem mutation cannot be included in a database transaction, document the crash-consistency design and reconcile journal state on restart. Treat a timeout as an unknown result, not a failed operation; retrieve status before retrying to avoid duplicate writes.

## Limits and Defaults

Choose final limits after baseline measurements and keep them configurable with safe defaults. Initial suggested caps for review (not silently assumed product guarantees):

- Preview lifetime: 5 minutes.
- Maximum items in a single operation: 100.
- Maximum recursive depth: 8.
- Maximum total bytes for one copy/backup: 500 MiB.
- Maximum individual text file read: 2 MiB, with a lower response-character cap.
- Search: 5,000 inspected entries and 20 results per request.
- Execution: bounded timeout and cancellation checks between items.

If a limit is exceeded, fail closed with the reason and a way to narrow the request. Never silently truncate a mutation plan and then act on the truncated subset.

## Automated Test Strategy

### Path and security tests

- `..` traversal, mixed separators, drive-relative paths, UNC/device paths, alternate data streams, NUL/control characters, reserved names, Unicode normalization, and case-insensitive collisions.
- Symlink and junction escape; symlink within a root; root itself as source; redirected Desktop/Documents; missing roots; mount points and reparse points.
- Paths whose textual prefix resembles an approved root but resolve outside it.
- Race: replace source or destination with a symlink/reparse point after preview; change file identity, size, timestamp, or contents before confirmation.
- Reject files/folders not in the preview and any client-tampered plan digest.

### Preview and authorization tests

- Missing auth, malformed operation, extra unrecognized fields, oversized plans, cross-user retrieval/confirm/cancel/undo, expiry, cancellation, duplicate confirmation, concurrent confirmations, replay, session/user switch, and policy-version change.
- Verify a natural-language “yes” or any unrelated endpoint cannot confirm a preview.
- Verify the browser cannot set `confirmed: true`, owner ID, allowed roots, plan digest, expiry, or result status.

### Mutation and recovery tests

- Create-folder, rename, move, and copy happy paths; reject collisions without overwriting.
- Permission denied, locked file, insufficient space, disk full, process interruption, network/agent timeout, cross-volume partial copy, and journal write failure.
- Confirm per-item results and no false full-success response after partial failure.
- Undo succeeds only when identity checks match; it fails safely after user modification, external move, new collision, or operation journal mismatch.
- Retry after unknown timeout returns operation status and does not duplicate the change.
- Backup source remains untouched and copied output is verified.

### Read/search tests

- Root confinement, bounded traversal, result caps, file-type allowlist, encrypted/corrupt documents, oversized files, extraction timeout, malformed encodings, private content logging, and untrusted prompt-like text inside documents.
- Ensure the AI cannot convert document instructions into filesystem actions without producing a new preview and user confirmation.

### Test gates

- Run narrow Python filesystem tests first, then Node route/controller tests, then frontend preview/confirmation UI tests.
- Run existing Python, backend, and frontend test suites and the production build.
- Use temporary directories only; tests must not touch real user folders.
- Test cleanup must be in `finally`/fixture teardown, scoped to the test-created temporary directory, and must never recursively delete a calculated user path.
- Keep unrelated baseline failures documented rather than expanding this phase.

## Manual Test Matrix

| Scenario | Expected result |
|---|---|
| Preview create-folder, inspect details, cancel | No folder exists after cancel. |
| Preview create-folder and confirm | Only exact approved destination is created; result and undo availability are truthful. |
| Rename a disposable file | Exact old/new names shown; collision and invalid names are rejected; no overwrite. |
| Move a disposable file | Exact source/destination shown; operation is rejected outside roots or into a descendant. |
| Copy a file/folder | Explicit item list and bytes shown; copy verified; source remains unchanged. |
| Modify source after preview | Confirmation fails with stale-preview message; no mutation occurs. |
| Let preview expire or sign out | Preview cannot execute; user must create a new preview. |
| Re-submit a confirmed operation | No duplicate mutation; current operation status is returned. |
| Cause a partial failure with disposable items | Itemized results and safe recovery steps; no blanket success claim. |
| Undo after user changed the output | Undo refuses to overwrite or remove changed data. |
| Try traversal, symlink, UNC, system, or arbitrary path | Rejected before preview/commit; no path outside roots is read or changed. |
| Stop local agent/network during execution | UI reports unknown/partial status and retrieves journal state before any retry. |
| Ask in Hindi and English | Preview, confirmation, cancel, expiry, and failure text are understandable and action details remain exact. |

Use disposable test files only. Do not use real Downloads cleanup, personal documents, cloud-synced data, or valuable files during manual testing.

## Acceptance Criteria

Phase 11 may be marked complete only when:

- Search/read are bounded, confined to approved roots, and do not leak file content through logs or unintended provider requests.
- Every filesystem mutation begins with a server-generated exact preview and requires owner-bound, explicit, one-time confirmation.
- Expiry, stale state, path changes, collisions, symlinks/reparse points, malformed input, and cross-user IDs fail closed.
- Only create-folder, rename, move, copy, and explicitly approved bounded workflows are enabled; delete remains unavailable.
- No model or frontend path can invoke a legacy direct mutation endpoint to bypass preview and confirmation.
- Each mutation is revalidated at commit and produces an itemized verified result and journal record.
- Undo appears only for verified safe inverses; partial failure and interrupted operations are reported accurately.
- Automated tests cover path attacks, confirmations, races, collisions, partial failures, rollback/recovery, and legacy-route denial.
- Frontend tests and production build pass; Python and backend relevant suites pass.
- Manual disposable-folder testing passes on the target Windows machine, including cancellation, expiry, stale preview, and recovery.
- README, roadmap, and capability descriptions match only verified behavior.
- Completion record identifies commands, results, environment, manual checks, and unresolved blockers without including secrets or personal filenames.

## Known Dependencies and Blockers

- Windows path resolution, symlinks/junctions, redirected user folders, file locks, atomic rename, and cross-volume copy behavior must be tested on the target Windows setup.
- The desktop agent may be unavailable or lose connectivity during an operation; the design must distinguish failed, partially completed, and unknown outcomes.
- Persistent preview/journal storage needs a deliberate location and access-control/retention decision. Browser local storage alone is not appropriate authority for filesystem confirmation.
- File contents can be sensitive. Provider upload, conversation persistence, analytics, and log behavior need inspection before AI summarization of local documents is enabled.
- Large directories, low disk space, antivirus/file-lock interference, and cloud-sync providers can alter operation timing and outcomes.
- No deletion capability is part of Phase 11. Do not work around this exclusion by moving unwanted files to hidden locations or automatically emptying Recycle Bin.

## Completion Record

| Check | Result | Evidence / Notes |
|---|---|---|
| Baseline routes and current filesystem primitives | Implemented | Node/Python file mutation APIs are routed through the new operation service; old direct mutation and free-form command endpoints are retired. Native voice mutation intents return a disabled response. |
| Approved-root and symlink policy | Implemented; device edges unverified | Limits paths to resolved Desktop/Documents/Downloads and rejects symlinks, Windows reparse points, hard-linked files, traversal, unsupported object types, and cross-volume moves. Redirected known folders are rejected rather than silently followed. |
| Search/read hardening | Implemented | Search: 120-character query, depth 8, max 5,000 visited entries/20 results. Read: `.txt`, `.md`, `.csv`, `.pdf`, `.docx`; max 2 MiB input, 5,000 returned characters, 50 PDF pages, DOCX expanded-size/ratio bounds. Panel displays file text locally and does not send it to the AI. |
| Preview and confirmation lifecycle | Implemented | Local SQLite record, random operation ID, owner ID from authenticated Node session, 5-minute expiry, one-time atomic claim, exact path/identity revalidation, reject-on-collision. UI keeps only the operation ID in tab session storage and refreshes server status. |
| Create-folder | Implemented | Existing parent only; exact name; collision rejected; confirmation required; no undo because deleting the created folder is excluded. Automated tests pass. |
| Rename/move | Implemented for individual files | Same-volume no-overwrite file operation; source fingerprint checked before and after linking. Undo creates a fresh preview and requires a second explicit confirmation; only unchanged file identity is eligible. Automated tests pass. |
| Copy/backup | Implemented for one file | Copy-only to an existing approved folder, no overwrite, 500 MiB maximum, available destination space previewed and rechecked, hash verified, source retained. Recursive folder copy and multi-file backups are not implemented. |
| Organization workflow | Partially implemented | User can explicitly move one selected file to an existing approved folder. No automatic category rules, multi-file operation, recursive organization, or batch plan is enabled. |
| Undo/journal/recovery | Partial | SQLite operation record retained up to 30 days. Safe undo preview exists for rename/move only. Create/copy have no undo. Interrupted/stuck `executing` records are shown as uncertain; restart-time reconciliation is not implemented. |
| Legacy mutation route retirement | Automated checks pass | Node and Python direct create/rename/move and free-form command endpoints return 410; native voice mutation intents do not write. Backend safety tests cover auth, legacy rejection, and malformed preview authority fields. |
| Python focused tests | Pass | `python -m pytest tests/test_phase11_file_operations.py tests/test_phase11_file_routes.py tests/test_phase6.py tests/test_phase7_security.py -q` — 18 passed, 1 skipped (symlink creation not permitted), 1 upstream PyPDF2 deprecation warning. |
| Backend tests | Pass | `npm.cmd test` — 5 files, 31 tests passed. |
| Frontend tests | Pass | `npm.cmd test -- --run` — 4 files, 21 tests passed, including preview-before-confirm UI behavior. |
| Production build | Pass with advisory | `npm.cmd run build` succeeds; Vite warns that the main JS chunk exceeds 500 kB. |
| Full Python suite | Existing/environment failures | `python -m pytest -q` reports unrelated async tests without a pytest async plugin, an endpoint test expecting unauthenticated access, and three live web tests blocked by unavailable network. Do not treat these as Phase 11 regressions. |
| Windows manual UI/agent matrix | Unverified | Automated filesystem tests ran on Windows temporary folders, but the real browser UI, local agent token path, redirects/reparse points on actual profile folders, and hands-on cancel/timeout/recovery checks remain unverified. |
| Phase owner review | Pending | Review manual blockers and the unsupported recursive/multi-item workflows before considering Phase 11 complete or starting Phase 12. |

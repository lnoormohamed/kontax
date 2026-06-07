# Phase 7 — First Real CardDAV Implementation Slice

## Objective
Turn the CardDAV roadmap into a real product slice by connecting live CardDAV accounts, importing real remote contacts safely into Kontax, and exposing enough sync status and recovery tooling for private beta use.

## Success Criteria
- A user can connect a real CardDAV account from the app and pass connection validation.
- Kontax can discover CardDAV account metadata and persist a usable `SyncAccount`.
- A first safe one-way sync can import remote contacts and create stable sync links without mutating the remote source.
- Users can see sync state, failures, and retry guidance without needing direct database access.

## Exit Criteria
- Kontax supports a real end-to-end CardDAV connection and first import sync flow.
- Sync failures are observable and recoverable enough for a private beta rollout.
- The product is ready to begin controlled testing with real user address books before two-way sync work starts.

## Field Support Boundary For Phase 7
- Phase 7 must distinguish clearly between fields Kontax can store internally and fields that can safely round-trip through CardDAV and vCard in the first real sync slice.
- Kontax already supports a richer internal model than its current portability layer, including split names, labels, favorite state, avatar URL, multiple emails/phones/websites/addresses, birthday, additional significant dates, related people, and custom fields.
- The first real CardDAV sync slice should treat these fields as the safe portability baseline: full name, name parts available through `N`, nickname, multiple labeled emails, multiple labeled phone numbers, company, job title, websites, birthday, postal addresses, notes, and remote UID linkage.
- The following fields should be treated as Kontax-local or partial-support in Phase 7 unless explicit provider validation proves otherwise: labels, favorite state, avatar/photo metadata, significant dates beyond birthday, related people, custom fields, and any provider-specific x-properties.
- The following fields are not first-class supported yet and must not be implied as sync-safe in Phase 7 messaging: maiden name as a dedicated field, phonetic name, department as a distinct field, social profiles, messaging accounts, attachments, contact groups/lists, and external IDs.
- Phase 7 acceptance and UX copy must describe unsupported or partial fields honestly so private beta users understand what will sync cleanly, what may flatten, and what will remain Kontax-local.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P7-01 | Done | P0 | P5-01, P5-03 |
| P7-02 | Done | P0 | P7-01, P6-04 |
| P7-03 | Not Started | P0 | P7-02, P5-04 |
| P7-04 | Not Started | P1 | P7-03, P6-05 |
| P7-05 | Not Started | P1 | P7-03, P5-06 |
| P7-06 | Not Started | P2 | P7-02, P7-05 |

## P7-01 — Build the live CardDAV account connection flow
- Status: `Done`
- Priority: `P0`
- Dependencies: `P5-01`, `P5-03`
- Implementation Notes:
  - Add a real connect-account form that captures label, server base URL, username, and secret or app password.
  - Validate server reachability, authentication, and principal discovery before saving the connection as active.
  - Resolve and persist discovered `principalUrl`, `addressBookUrl`, `remoteAccountId`, and initial `remoteCTag` values when available.
  - Keep failure messages specific enough to distinguish invalid credentials, bad endpoints, TLS problems, and discovery mismatches.
  - Kontax now validates the CardDAV endpoint before creating the account, encrypts credentials during setup, and records a successful connection-validation job when discovery completes.
- Acceptance Criteria:
  - A real CardDAV account can be connected from the UI.
  - Successful connection persists enough metadata to schedule and run sync jobs later.
  - Failed connection attempts return actionable feedback without partially activating the account.
- Risks / Open Questions:
  - CardDAV providers vary in discovery behavior, so discovery may need provider-specific fallback logic early.

## P7-02 — Persist encrypted credentials and harden account validation
- Status: `Done`
- Priority: `P0`
- Dependencies: `P7-01`, `P6-04`
- Implementation Notes:
  - Store raw CardDAV credentials only through the credential-encryption path already defined in earlier phases.
  - Persist credential versioning, key references, and last-validated timestamps so rotation and revocation behavior stay observable.
  - Add server-side validation rules that prevent incomplete or unencrypted credential records from becoming runnable sync accounts.
  - Ensure rich-field portability assumptions remain explicit at connection time so unsupported fields are not silently promised as sync-safe.
  - Sync accounts now persist `credentialLastValidatedAt`, `connectionValidatedAt`, and discovered address book display metadata so validation posture is explicit in the UI and server logic.
  - Rotating credentials now clears validation timestamps and forces a fresh connection validation before a sync job can queue.
- Acceptance Criteria:
  - Sync credentials are encrypted before persistence.
  - Saved `SyncAccount` records contain clear validation state and credential metadata.
  - The app can distinguish auth failure from encryption/configuration failure during setup.
- Risks / Open Questions:
  - Local development and production secret handling must stay aligned or debugging sync failures will be confusing.

## P7-03 — Ship the first safe one-way CardDAV import sync
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P7-02`, `P5-04`
- Implementation Notes:
  - Implement a manual sync action that reads remote vCards, normalizes them into the Kontax contact model, and creates `SyncContactLink` records.
  - Treat the first production slice as import-first and non-destructive: create new contacts or attach to existing links before attempting any remote writes.
  - Record per-run counts, skipped contacts, malformed-card failures, and conflict candidates in `SyncJob`.
  - Use stable remote UID and href mapping so later incremental sync work can build on the same linkage.
  - Define an explicit field mapping contract for the Phase 7 sync-safe set and preserve non-portable metadata in Kontax without claiming remote round-trip fidelity.
  - Persist unmapped or partially supported remote data in a dedicated snapshot or metadata path so recovery, debugging, and future mapping upgrades do not depend on lossy transforms alone.
- Acceptance Criteria:
  - A sync job can import real remote contacts into Kontax.
  - Imported contacts create stable sync links and job history entries.
  - The first sync path avoids destructive remote changes and handles malformed cards gracefully.
  - Imported records preserve unsupported metadata as Kontax-local data where possible instead of silently discarding or falsely advertising remote parity.
- Risks / Open Questions:
  - Existing local duplicates may need review-first behavior before automatic link creation is trustworthy.
  - Providers may interpret even standard vCard fields differently, especially labels, address structure, and secondary values.

## P7-04 — Add sync status, retry, and recovery UX
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P7-03`, `P6-05`
- Implementation Notes:
  - Expose last sync time, current status, imported counts, failures, and next-step guidance in the app.
  - Add manual retry and revalidate actions so a user can recover from expired credentials or transient provider failures without admin help.
  - Surface a simple contact-level view of sync-linked records so users understand what came from CardDAV.
  - Keep the first UX operational and confidence-building rather than overly advanced.
  - Show field-support guidance in the UI so users can tell which details are sync-safe, which may flatten during portability, and which remain Kontax-local.
- Acceptance Criteria:
  - Users can see whether sync is healthy, failing, or needs reauthentication.
  - A failed sync can be retried from the UI with clear feedback.
  - Sync-origin visibility exists for imported contacts and account-level job history.
  - Field portability limits are visible enough that a beta user is not misled about unsupported metadata.
- Risks / Open Questions:
  - Too little error detail will frustrate users, but too much raw protocol output may overwhelm them.

## P7-05 — Add failure handling, support telemetry, and recovery exports
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P7-03`, `P5-06`
- Implementation Notes:
  - Capture structured error codes for discovery failures, auth failures, parse failures, rate limits, and provider-side write restrictions.
  - Add support-oriented diagnostics such as job summaries, conflict snapshots, and recovery export helpers for affected contacts.
  - Make sure sync failures create enough auditability to support beta operations without direct database inspection.
  - Define a lightweight health model so repeated failing accounts can be paused automatically instead of looping forever.
- Acceptance Criteria:
  - Sync failures produce structured logs and visible job summaries.
  - Support and recovery flows can export enough context to debug real user issues.
  - Repeated failure patterns can be identified and handled safely.
- Risks / Open Questions:
  - Diagnostic exports must avoid leaking secrets while still being useful for debugging.

## P7-06 — Prepare private beta validation and rollout rules
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P7-02`, `P7-05`
- Implementation Notes:
  - Define the private beta entry checklist, supported providers, known limitations, and rollback expectations.
  - Add explicit validation scenarios for first sync, repeat sync, expired credentials, malformed vCards, and duplicate-heavy imports.
  - Document what must be true before enabling wider user access, especially around observability, support tooling, and non-destructive behavior.
  - Treat two-way sync as out of scope for this phase so rollout pressure does not compromise first-sync safety.
  - Publish a field-support matrix for beta users that separates sync-safe fields, partial-support fields, and Kontax-local-only metadata.
- Acceptance Criteria:
  - Phase 7 includes a concrete beta-readiness checklist.
  - Real-world validation scenarios are documented clearly enough to guide testing and support.
  - The rollout plan protects users from premature two-way sync behavior.
  - Beta documentation states clearly which fields are expected to round-trip and which are intentionally out of scope for Phase 7.
- Risks / Open Questions:
  - Provider-specific differences may force the beta list to stay narrow longer than expected.

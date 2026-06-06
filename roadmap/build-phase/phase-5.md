# Phase 5 — Sync Architecture and CardDAV Readiness

## Objective
Prepare Kontax for reliable iPhone and Android contact sync via CardDAV by defining sync-safe data structures, conflict handling, credential protection, and a staged rollout strategy.

## Success Criteria
- Sync architecture is documented as a first-class subsystem.
- CardDAV model assumptions are compatible with earlier contact/import/merge work.
- Credential protection and job scheduling are clearly defined.
- Rollout and support strategy reduce sync-related user risk.

## Exit Criteria
- CardDAV work can begin without redesigning contacts/import/merge internals.
- Sync is treated as a protocol/product surface, not just another import path.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P5-01 | In Progress | P0 | P1-02, P3-01 |
| P5-02 | In Progress | P0 | P5-01 |
| P5-03 | In Progress | P1 | P5-01, P1-04 |
| P5-04 | In Progress | P1 | P5-02, P4-05 |
| P5-05 | In Progress | P2 | P5-02 |
| P5-06 | Done | P2 | P5-03, P5-04 |

## P5-01 — Define sync data model for CardDAV readiness
- Status: `In Progress`
- Priority: `P0`
- Dependencies: `P1-02`, `P3-01`
- Implementation Notes:
  - Plan `SyncAccount` and `SyncJob` entities with account ownership, provider metadata, remote IDs, and sync health fields.
  - Include stable IDs, remote ETags, and tombstone support.
  - Preserve mapping between canonical contacts and protocol-facing records.
  - Kontax now has a first CardDAV-ready schema foundation with `SyncAccount`, `SyncContactLink`, and `SyncJob` models plus sync-specific enums for provider, direction, account status, job trigger, and job status.
  - Contacts now carry a stable `syncUid`, a local `syncVersion`, and a `syncTombstoneAt` field so protocol-facing identity and future delete propagation do not depend on ad hoc contact mutations.
  - `SyncContactLink` preserves the mapping between canonical contacts and remote protocol records through `remoteHref`, `remoteUid`, `remoteETag`, tombstone timestamps, and per-link error fields.
  - `SyncAccount` stores account ownership, CardDAV endpoint metadata, remote collection versioning (`remoteCTag`), sync direction, status, cursor, and sync health timestamps without forcing credential storage details into this phase.
  - `SyncJob` now records queue/run outcomes, counts, cursors, and partial-failure state so later orchestration and support tooling can build on a stable history model.
- Acceptance Criteria:
  - Sync entities and relationships are documented.
  - Model supports future bidirectional sync without schema rework.
- Risks / Open Questions:
  - CardDAV clients vary widely in field support and conflict behavior.

## P5-02 — Define sync scope and direction strategy
- Status: `In Progress`
- Priority: `P0`
- Dependencies: `P5-01`
- Implementation Notes:
  - Document the roadmap target as two-way sync, with one-way bootstrap import as fallback if rollout requires it.
  - Define what “source of truth” means when remote edits and local edits conflict.
  - Clarify whether all contacts sync or only selected books/filters.
  - Kontax now treats `two-way CardDAV sync` as the roadmap target, with `import-only bootstrap` as the fallback path for early rollout, recovery, and high-risk provider/client combinations.
  - The initial consumer-first sync scope is `one SyncAccount to one remote address book`, syncing `all active contacts` in that account by default. Archived contacts remain local-only and are not pushed remotely in the first shipping sync model.
  - Local Kontax records remain the canonical product surface for merge, archive, billing, and audit workflows, but sync conflict handling should not silently overwrite remote changes. When both sides changed since the last successful sync cursor, the later sync phases should record a conflict and require deterministic resolution rather than pretending one side is always globally authoritative.
  - The practical v1 rollout strategy is: start with import-only bootstrap when connection quality or client behavior is uncertain, then enable two-way sync per account once account health and conflict behavior are understood well enough.
  - Filtered or tag-scoped sync is intentionally deferred. The first supported sync scope is the primary active address book for the signed-in consumer account, which keeps support expectations understandable before advanced selection rules exist.
- Acceptance Criteria:
  - Sync direction and fallback strategy are explicit.
  - Product tradeoffs are documented, not implied.
- Risks / Open Questions:
  - Full bidirectional sync increases support load significantly.
  - Archived-contact exclusion may surprise some users if not explained clearly in setup UX.
  - Some CardDAV clients may behave more like eventual export/import bridges than truly cooperative two-way peers.

## P5-03 — Define sync credential protection and job orchestration
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P5-01`, `P1-04`
- Implementation Notes:
  - Specify how CardDAV credentials, app passwords, or tokens are stored and protected.
  - Define job scheduling, retry windows, error classes, and health monitoring.
  - Add audit requirements for credential creation, update, and revoke actions.
  - `SyncAccount` now carries explicit credential lifecycle metadata through `credentialReference`, `credentialVersion`, `credentialUpdatedAt`, `credentialRevokedAt`, and `encryptionKeyRef`. This keeps raw CardDAV secrets out of the main schema while giving the app a stable pointer to secret storage and rotation state.
  - The intended protection model is: raw secrets live outside primary relational fields, references point to encrypted secret storage, and rotation or revoke events advance `credentialVersion` rather than mutating history invisibly.
  - `SyncJob` now carries orchestration metadata for retries and workers: `attemptCount`, `maxAttempts`, `nextRetryAt`, `leaseExpiresAt`, `workerId`, and `idempotencyKey`.
  - The operational expectation is an idempotent queue/worker model: one active lease per job attempt, bounded retries with backoff, resumable cursors, and explicit partial/failure states instead of silent re-runs.
  - Credential create, update, revoke, and failed-auth events should be emitted into the future audit layer, while sync jobs should classify failures into authentication, connectivity, protocol/data-shape, rate-limit, and conflict buckets for support visibility.
- Acceptance Criteria:
  - Credential handling and sync job expectations are documented.
  - Security posture aligns with the earlier encryption baseline.
- Risks / Open Questions:
  - Sync secrets may require stronger storage controls than standard app secrets.
  - Some CardDAV providers only support app passwords, which may need provider-specific revoke guidance in the UI later.

## P5-04 — Define conflict handling, tombstones, and versioning
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P5-02`, `P4-05`
- Implementation Notes:
  - Document conflict resolution policy between local edits, remote edits, merges, and deletes.
  - Include tombstone handling for deleted contacts and remote references.
  - Define how merge history interacts with sync-safe IDs.
  - Kontax now has an explicit `SyncConflict` model with conflict type, status, resolution strategy, local/remote snapshots, remote ETag reference, and contact/link/account relationships. This gives later sync phases a dedicated place to persist real conflict state instead of hiding it inside generic job errors.
  - Local contact mutations now advance `syncVersion`, while archive actions also stamp `syncTombstoneAt`. That means edits, archives, restores, merges, and merge undos all produce deterministic local version changes that future CardDAV reconciliation can compare against remote state.
  - Merge lineage is now recorded on contacts through `mergedIntoContactId`, and merge execution archives the secondary contact with both a local tombstone timestamp and a lineage pointer to the surviving primary record.
  - Merge undo restores the archived secondary contact, clears merge lineage, restores pre-merge tombstone state from audit snapshot data, and advances sync versions again so the undo itself is visible as a new local change.
  - The intended conflict policy is now clearer: simultaneous local and remote edits should become `SyncConflict` records, local archive/delete intent should travel through tombstones, and merge outcomes should preserve stable `syncUid` values rather than pretending merged records were never separate.
- Acceptance Criteria:
  - Conflict rules are deterministic and testable.
  - Deletes and merge outcomes remain compatible with sync semantics.
- Risks / Open Questions:
  - Hidden remote-side edits can produce difficult-to-explain user outcomes.
  - The app still needs actual sync execution logic to create `SyncConflict` rows in practice; this phase establishes the model and local mutation semantics first.

## P5-05 — Document iPhone and Android compatibility expectations
- Status: `In Progress`
- Priority: `P2`
- Dependencies: `P5-02`
- Implementation Notes:
  - Record expected compatibility with iPhone Contacts and common Android CardDAV clients.
  - Note platform-specific field limitations, background sync assumptions, and user setup friction.
  - iPhone compatibility target is the native Contacts app through the system CardDAV account flow in iOS Settings. Expected support is strongest for core fields such as name, email, phone, organization, and notes, while more advanced merge semantics, custom metadata, and app-specific audit context remain local-only in Kontax.
  - Android compatibility target should assume third-party CardDAV clients first, because native Android behavior varies by vendor and Google Contacts does not behave like a universal CardDAV peer. The product and support posture should treat DAVx5-style clients as the most predictable reference implementation for Android.
  - iPhone setup friction is expected to center on account discovery, app-password/provider credential requirements, and the fact that sync visibility is mostly managed by OS settings rather than in-app controls. Android setup friction is expected to center on third-party client installation, battery/background restrictions, and vendor-specific sync throttling.
  - Background sync expectations should remain conservative: iPhone sync cadence is largely OS-controlled and may feel delayed, while Android sync cadence can depend heavily on the chosen client plus device battery optimization policies. Kontax should not promise instant propagation across platforms in first-wave sync messaging.
  - Compatibility messaging should make clear that first-wave sync aims for reliable core-contact interoperability, not perfect parity for every provider-specific field or every client-specific contact UI behavior.
  - Support and QA planning should treat these field classes differently:
    - expected to round-trip well: full name, primary email, primary phone, company, notes
    - likely degraded or client-dependent: secondary identifiers, archive state, merge lineage, audit state, plan metadata
    - Kontax-local only: billing entitlements, merge decisions, import/export job history, sync conflict records
- Acceptance Criteria:
  - Platform notes are captured clearly enough for support and QA planning.
  - Known compatibility limitations are documented up front.
- Risks / Open Questions:
  - Android compatibility may depend on third-party clients more than native OS behavior.
  - iPhone and Android may each appear “correct” while still exposing different contact-edit UIs for the same CardDAV record, which can create support confusion without careful documentation.

## P5-06 — Define beta rollout, support tooling, and recovery flow
- Status: `Done`
- Priority: `P2`
- Dependencies: `P5-03`, `P5-04`
- Implementation Notes:
  - Plan a private beta rollout with health dashboards, verbose logs, and recovery steps.
  - Document user-facing fallback options such as export/re-import if sync fails badly.
  - Define support tools needed to inspect sync jobs and conflict states safely.
  - The recommended rollout path is a staged private beta:
    - stage 1: internal and founder-only testing against a single reference CardDAV provider/client mix
    - stage 2: invited power users with import/export maturity and explicit recovery expectations
    - stage 3: broader beta only after conflict handling, credential revoke flow, and support tooling prove stable
  - Sync health should be observable through account-level and job-level support views showing:
    - sync account status
    - last successful sync time
    - last error code and summary
    - current remote collection tag/cursor
    - recent sync job outcomes
    - open sync conflicts
    - tombstoned or merged contacts linked to sync records
  - Support tooling should stay read-heavy by default, with carefully scoped write actions for:
    - pausing a sync account
    - forcing a manual resync
    - revoking stored credentials
    - marking a conflict resolution outcome
    - exporting a user-safe recovery package
  - User-facing recovery flow should be explicit and layered:
    - first: pause sync and preserve current local state
    - second: inspect recent sync failures/conflicts
    - third: allow export of current contacts before further recovery actions
    - fourth: offer bootstrap re-import or full relink only when safer targeted recovery is not possible
  - The preferred disaster-recovery fallback remains portability-first rather than silent repair:
    - CSV export
    - vCard export
    - re-import into Kontax
    - clean relink to a new or reset CardDAV account
  - User messaging should acknowledge that sync failures can lag behind remote edits. Recovery UX must explain whether the next step preserves local state, remote state, or both before executing any destructive action.
  - Kontax now exposes a first recovery toolkit in the sync center:
    - export a user-safe sync recovery package that excludes raw credentials but includes account state, recent jobs, conflicts, and related contacts
    - prepare a relink reset that clears local sync links, resets cursors/remote collection markers, and closes open conflicts without mutating canonical contacts
    - keep pause, credential revoke, preflight, and recovery retry actions together in the same support-oriented surface
  - The recovery package export now lives at a dedicated application route and is positioned before reset actions so operators and end users can capture state before attempting relink or rebootstrap flows.
- Acceptance Criteria:
  - Rollout and support requirements are documented.
  - Sync can be introduced gradually without compromising user trust.
- Risks / Open Questions:
  - Sync failures can cause outsized trust damage, so recovery paths must be explicit.
  - Support tooling can become too powerful too early if write actions are not tightly scoped and audited.

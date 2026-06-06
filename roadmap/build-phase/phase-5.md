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
| P5-01 | Not Started | P0 | P1-02, P3-01 |
| P5-02 | Not Started | P0 | P5-01 |
| P5-03 | Not Started | P1 | P5-01, P1-04 |
| P5-04 | Not Started | P1 | P5-02, P4-05 |
| P5-05 | Not Started | P2 | P5-02 |
| P5-06 | Not Started | P2 | P5-03, P5-04 |

## P5-01 — Define sync data model for CardDAV readiness
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P1-02`, `P3-01`
- Implementation Notes:
  - Plan `SyncAccount` and `SyncJob` entities with account ownership, provider metadata, remote IDs, and sync health fields.
  - Include stable IDs, remote ETags, and tombstone support.
  - Preserve mapping between canonical contacts and protocol-facing records.
- Acceptance Criteria:
  - Sync entities and relationships are documented.
  - Model supports future bidirectional sync without schema rework.
- Risks / Open Questions:
  - CardDAV clients vary widely in field support and conflict behavior.

## P5-02 — Define sync scope and direction strategy
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P5-01`
- Implementation Notes:
  - Document the roadmap target as two-way sync, with one-way bootstrap import as fallback if rollout requires it.
  - Define what “source of truth” means when remote edits and local edits conflict.
  - Clarify whether all contacts sync or only selected books/filters.
- Acceptance Criteria:
  - Sync direction and fallback strategy are explicit.
  - Product tradeoffs are documented, not implied.
- Risks / Open Questions:
  - Full bidirectional sync increases support load significantly.

## P5-03 — Define sync credential protection and job orchestration
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P5-01`, `P1-04`
- Implementation Notes:
  - Specify how CardDAV credentials, app passwords, or tokens are stored and protected.
  - Define job scheduling, retry windows, error classes, and health monitoring.
  - Add audit requirements for credential creation, update, and revoke actions.
- Acceptance Criteria:
  - Credential handling and sync job expectations are documented.
  - Security posture aligns with the earlier encryption baseline.
- Risks / Open Questions:
  - Sync secrets may require stronger storage controls than standard app secrets.

## P5-04 — Define conflict handling, tombstones, and versioning
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P5-02`, `P4-05`
- Implementation Notes:
  - Document conflict resolution policy between local edits, remote edits, merges, and deletes.
  - Include tombstone handling for deleted contacts and remote references.
  - Define how merge history interacts with sync-safe IDs.
- Acceptance Criteria:
  - Conflict rules are deterministic and testable.
  - Deletes and merge outcomes remain compatible with sync semantics.
- Risks / Open Questions:
  - Hidden remote-side edits can produce difficult-to-explain user outcomes.

## P5-05 — Document iPhone and Android compatibility expectations
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P5-02`
- Implementation Notes:
  - Record expected compatibility with iPhone Contacts and common Android CardDAV clients.
  - Note platform-specific field limitations, background sync assumptions, and user setup friction.
- Acceptance Criteria:
  - Platform notes are captured clearly enough for support and QA planning.
  - Known compatibility limitations are documented up front.
- Risks / Open Questions:
  - Android compatibility may depend on third-party clients more than native OS behavior.

## P5-06 — Define beta rollout, support tooling, and recovery flow
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P5-03`, `P5-04`
- Implementation Notes:
  - Plan a private beta rollout with health dashboards, verbose logs, and recovery steps.
  - Document user-facing fallback options such as export/re-import if sync fails badly.
  - Define support tools needed to inspect sync jobs and conflict states safely.
- Acceptance Criteria:
  - Rollout and support requirements are documented.
  - Sync can be introduced gradually without compromising user trust.
- Risks / Open Questions:
  - Sync failures can cause outsized trust damage, so recovery paths must be explicit.

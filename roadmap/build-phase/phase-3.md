# Phase 3 — Import/Export and Format Support

## Objective
Make Kontax genuinely portable by supporting the most common contact formats, a safe import pipeline, and export behavior that preserves the canonical contact model.

## Success Criteria
- Supported import/export formats are explicitly prioritized.
- Import pipeline stages are fully defined.
- Export behavior preserves normalized contact structure and origin metadata where appropriate.
- Job tracking and error handling are documented well enough for implementation.

## Exit Criteria
- Popular import/export formats are covered.
- Portability works without CardDAV.
- Data normalization rules are documented well enough for merge logic.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P3-01 | Not Started | P0 | P1-02 |
| P3-02 | Not Started | P0 | P3-01 |
| P3-03 | Not Started | P0 | P3-01 |
| P3-04 | Not Started | P1 | P3-02, P3-03 |
| P3-05 | Not Started | P1 | P3-02 |
| P3-06 | Not Started | P2 | P3-02, P3-03 |

## P3-01 — Finalize supported contact formats
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P1-02`
- Implementation Notes:
  - Support `vCard 3.0`, `vCard 4.0`, generic CSV, and mapped CSV profiles for Google, Apple, and Outlook first.
  - Decide which fields are first-wave canonical vs pass-through metadata.
  - Define export downgrade behavior when a format cannot represent all contact data.
- Acceptance Criteria:
  - A supported format list exists with field coverage expectations.
  - Canonical vs lossy format behavior is documented.
- Risks / Open Questions:
  - CSV field naming is inconsistent across sources and needs explicit mapping tables.

## P3-02 — Design import pipeline
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P3-01`
- Implementation Notes:
  - Specify stages: upload, file sniffing, parse, normalize, validate, preview, confirm, commit.
  - Define how malformed rows, duplicate headers, and unsupported fields are surfaced.
  - Include source attribution so imported contacts can power merge suggestions later.
- Acceptance Criteria:
  - Import stages and transitions are documented.
  - Failure handling and partial-result rules are clear.
- Risks / Open Questions:
  - Large imports may need async chunking or background processing sooner than expected.

## P3-03 — Design export pipeline
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P3-01`
- Implementation Notes:
  - Support full export, filtered export, and format-specific mapping behavior.
  - Decide whether exports include archived contacts by default and how deleted records are treated.
  - Preserve stable contact IDs internally while keeping export payloads consumer-friendly.
- Acceptance Criteria:
  - Export modes and field mapping rules are documented.
  - Export behavior after merges remains consistent with canonical records.
- Risks / Open Questions:
  - Need clear expectations for what metadata is omitted from consumer exports.

## P3-04 — Define import and export job records
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P3-02`, `P3-03`
- Implementation Notes:
  - Add `ImportJob` and `ExportJob` planning with format, file reference, counts, status, and errors.
  - Include start/end timestamps, initiating user, and links to audit records.
  - Plan for resumable or retryable jobs where feasible.
- Acceptance Criteria:
  - Job data model is explicit.
  - Operational status reporting is strong enough for both UI and support use.
- Risks / Open Questions:
  - File storage and retention policy needs alignment with Phase 2 operational cleanup.

## P3-05 — Define validation and conflict handling
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P3-02`
- Implementation Notes:
  - Cover invalid encodings, malformed vCards, partial rows, missing required name/email fields, and unsupported custom attributes.
  - Decide when the pipeline blocks, warns, or drops rows.
  - Preserve row-level errors for user review.
- Acceptance Criteria:
  - Validation outcomes and user-visible error handling are documented.
  - Import behavior is deterministic and reviewable.
- Risks / Open Questions:
  - Hard fail vs partial import policies must not surprise users.

## P3-06 — Define import/export UX preview and rollback model
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P3-02`, `P3-03`
- Implementation Notes:
  - Design preview summaries, field mapping confirmation, duplicate warnings, and post-import rollback expectations.
  - Clarify whether rollback is full-job only or row-level.
- Acceptance Criteria:
  - UX expectations are documented well enough for design and implementation.
  - Rollback semantics align with audit and merge planning.
- Risks / Open Questions:
  - Per-row rollback may be too expensive for v1 and should be explicitly deferred if so.

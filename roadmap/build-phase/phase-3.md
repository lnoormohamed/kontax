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
| P3-01 | In Progress | P0 | P1-02 |
| P3-02 | In Progress | P0 | P3-01 |
| P3-03 | In Progress | P0 | P3-01 |
| P3-04 | In Progress | P1 | P3-02, P3-03 |
| P3-05 | In Progress | P1 | P3-02 |
| P3-06 | In Progress | P2 | P3-02, P3-03 |

## P3-01 — Finalize supported contact formats
- Status: `In Progress`
- Priority: `P0`
- Dependencies: `P1-02`
- Implementation Notes:
  - First implementation slice now supports generic CSV import and export plus vCard 4.0 export.
  - CSV profile selection is now explicit in the UI with `Generic`, `Google Contacts`, `Apple Contacts`, and `Outlook` parsing modes.
  - Google/Apple/Outlook-style header aliases are applied server-side during preview and commit.
  - Next pass should expand the mapping table and explicitly document downgrade behavior across formats.
- Acceptance Criteria:
  - A supported format list exists with field coverage expectations.
  - Canonical vs lossy format behavior is documented.
- Risks / Open Questions:
  - CSV field naming is inconsistent across sources and needs explicit mapping tables.

## P3-02 — Design import pipeline
- Status: `In Progress`
- Priority: `P0`
- Dependencies: `P3-01`
- Implementation Notes:
  - The import flow now supports CSV upload or pasted CSV text plus a profile-aware preview step before commit.
  - The pipeline now performs parse, normalize, lightweight validate, preview, confirm, import, and job recording.
  - Next pass should add richer malformed-row review and future duplicate suggestions before commit.
- Acceptance Criteria:
  - Import stages and transitions are documented.
  - Failure handling and partial-result rules are clear.
- Risks / Open Questions:
  - Large imports may need async chunking or background processing sooner than expected.

## P3-03 — Design export pipeline
- Status: `In Progress`
- Priority: `P0`
- Dependencies: `P3-01`
- Implementation Notes:
  - CSV export is open to all plans and vCard 4.0 export is plan-gated as a premium surface.
  - Export jobs are recorded with counts and archived-scope metadata.
  - Next pass should add filtered export controls and richer format-specific options.
- Acceptance Criteria:
  - Export modes and field mapping rules are documented.
  - Export behavior after merges remains consistent with canonical records.
- Risks / Open Questions:
  - Need clear expectations for what metadata is omitted from consumer exports.

## P3-04 — Define import and export job records
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P3-02`, `P3-03`
- Implementation Notes:
  - Prisma schema now includes `ImportJob` and `ExportJob` with format, status, counts, and error summaries.
  - The app records job history for recent imports and exports.
  - Next pass should connect job records to file retention and future audit events.
- Acceptance Criteria:
  - Job data model is explicit.
  - Operational status reporting is strong enough for both UI and support use.
- Risks / Open Questions:
  - File storage and retention policy needs alignment with Phase 2 operational cleanup.

## P3-05 — Define validation and conflict handling
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P3-02`
- Implementation Notes:
  - The preview step now surfaces row-level issues for missing identifiers, invalid emails, and duplicate phone/email values within the same import.
  - Invalid rows are skipped before commit and warnings remain reviewable in the preview UI.
  - Next pass should expand into malformed vCard handling, encoding issues, and unsupported custom attributes.
- Acceptance Criteria:
  - Validation outcomes and user-visible error handling are documented.
  - Import behavior is deterministic and reviewable.
- Risks / Open Questions:
  - Hard fail vs partial import policies must not surprise users.

## P3-06 — Define import/export UX preview and rollback model
- Status: `In Progress`
- Priority: `P2`
- Dependencies: `P3-02`, `P3-03`
- Implementation Notes:
  - The app now supports preview summaries, profile confirmation, row-level warnings, and explicit confirm-before-commit behavior.
  - Rollback is still job-level rather than row-level and should be documented more explicitly in the next pass.
- Acceptance Criteria:
  - UX expectations are documented well enough for design and implementation.
  - Rollback semantics align with audit and merge planning.
- Risks / Open Questions:
  - Per-row rollback may be too expensive for v1 and should be explicitly deferred if so.

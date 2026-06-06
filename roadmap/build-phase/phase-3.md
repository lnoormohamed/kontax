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
| P3-03 | Done | P0 | P3-01 |
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
  - Field-mapping coverage has been expanded to recognize a wider set of popular contact-book headers for alternate email, phone, company, note, and naming columns across those four profiles.
  - Multi-column provider exports are now handled more safely by taking the first populated mapped value across matched email, phone, company, note, and naming columns instead of relying on a single matched header.
  - Current downgrade behavior is intentionally conservative: unsupported structured provider fields are ignored, while supported mapped values are collapsed into the canonical Kontax model of one full name, one email, one phone, one company, and freeform notes.
  - Next pass should expand the mapping table further and document future vCard import lossiness explicitly.
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
- Status: `Done`
- Priority: `P0`
- Dependencies: `P3-01`
- Implementation Notes:
  - CSV export is open to all plans and vCard 4.0 export is plan-gated as a premium surface.
  - Export jobs are recorded with counts and archived-scope metadata.
  - The export UI now supports full export, filtered export by search query, and an include-archived CSV option.
  - Next pass should deepen format-specific options and document downgrade behavior more explicitly.
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
  - Prisma schema now includes `ImportJob` and `ExportJob` with format, status, counts, error summaries, profile metadata, preview counts, warning counts, file size, and preview/commit timestamps.
  - Preview now creates an import job record up front, and commit reuses the same job when the user confirms the import.
  - Export jobs now record the filter query and generated result filename so support and future download history have stronger context.
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
  - The preview step now surfaces row-level issues for missing identifiers, invalid emails, duplicate phone/email values within the same import, and potential matches against existing contacts already in the user's address book.
  - Unsupported CSV columns are now called out as warnings so users know what will be ignored before commit.
  - Duplicate headers, blank headers, fallback-name rows, sparse records, inconsistent column counts, unusually long notes, and same-name/company shapes are now surfaced as preview warnings before commit.
  - Malformed CSV quoting now fails fast with a clear preview error instead of producing confusing partial imports.
  - Duplicate rows are now summarized into explicit duplicate groups, with high-confidence email and phone groups treated as commit-blocking until the CSV is cleaned up.
  - Commit rules are now explicit in both preview UI and server-side enforcement so users can see exactly why an import is blocked.
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
  - Import history now carries rollback metadata, and completed import jobs can archive the contacts they created as a reversible safety action.
  - Rollback remains job-level rather than row-level, which keeps the first user-facing recovery model simple and auditable.
- Acceptance Criteria:
  - UX expectations are documented well enough for design and implementation.
  - Rollback semantics align with audit and merge planning.
- Risks / Open Questions:
  - Per-row rollback may be too expensive for v1 and should be explicitly deferred if so.

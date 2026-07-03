# P45-04 — Exporter: single document + bulk archive

Status: Not started · Priority: P1 · Depends: [P45-03](p45-03-archive-container-spec.md), [P45-DB01](p45-db01-design-brief-export-format-surfaces.md) (UI portions)
Phase: [Phase 45](phase-45-open-export-format.md)

## Scope

Wire the new format into the existing export surfaces:

- The `/api/export` format enum gains the new format.
- Single-contact export from the contact detail (bare document or
  one-contact archive per the P45-DB01 decision).
- Bulk from the workspace selection and export presets
  (`/settings/export-presets`).
- The full data-export job (`src/server/data-export/generate-export.ts`)
  offers the archive alongside the current files; photos stream from MinIO
  into `media/` (never assembled in memory).
- Privacy scoping per P45-02 (private fields, shared-book rules) enforced at
  export time via the P40-02 read-path helper.
- Coordinate with P38-10's import-export code split so the exporter lands in
  the split bundle, not the main one.

## Acceptance

- Every surface listed exports the new format; archives pass the P45-06
  validator.
- 10k-contact + photos export completes within the data-export job's memory
  envelope (measure, record here).
- A non-owner member's export of a shared book contains no other member's
  private fields.

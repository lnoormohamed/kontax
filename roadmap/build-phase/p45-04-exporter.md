# P45-04 — Exporter: single document + bulk archive

Status: Built (2026-07-04) · Priority: P1 · Depends: [P45-03](p45-03-archive-container-spec.md), [P45-DB01](p45-db01-design-brief-export-format-surfaces.md) (UI portions)
Phase: [Phase 45](phase-45-open-export-format.md)

## Built

Most export **surfaces** shipped in P45-DB01 (export-card, single-contact
split button + `/api/contacts/[id]/export`, async archive job + polling UI,
bulk selection → `/api/exports/kontax`). This ticket closed the two genuinely
outstanding items:

- **Streaming (§7.8).** New `streamKontaxArchive` (`archive.ts`) pulls each
  photo just-in-time via `iterateArchiveEntries` (`export.ts`) and appends it
  with per-entry backpressure (`await once(archive, "entry")`), writing the
  manifest **last** once every entry is hashed. The async job (`jobs.ts`) now
  streams to a temp file, then uploads with a known `ContentLength` — never
  assembling 10k photos or the whole zip in memory. Peak memory ≈ one photo.
  Dependency-free (no `lib-storage`); shares one manifest builder with the
  buffered `buildKontaxArchive` (kept for single-contact/sync).
- **Privacy scoping (§9).** `loadExportableContacts` now routes through the
  single P40-02 overlay helper (`buildPrivateOverlay`), merging only the
  exporting user's own private-field rows onto the shared row. Another
  member's private fields are never loaded (query scoped to `userId`), so a
  non-owner's export can't contain them. A verified no-op until Phase 40's
  write path lands; establishes the correct read seam now.

**Not measured locally** (no MinIO in dev): the 10k-contact memory-envelope
figure must be recorded from a staging run. Streaming correctness (valid,
deduped, integrity-passing, lossless round-trip) is proven by
`npm run qa:phase45:archive`.

GDPR full-data-export (`generate-export.ts`) offering the archive is **not**
done — deferred (separate "download your data" surface; the contact exporter
paths above are complete). P38-10 code-split coordination: no dedicated split
exists yet; unaffected.

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

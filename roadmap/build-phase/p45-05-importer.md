# P45-05 — Importer: lossless round-trip of our own format

Status: Built (2026-07-04) · Priority: P1 · Depends: [P45-04](p45-04-exporter.md)
Phase: [Phase 45](phase-45-open-export-format.md)

> Note: the recognition-marker wording in "Scope" below predates the P45-02/DB01
> decision to drop a branded marker string — recognition is by the vendor
> property + `manifest.json` (spec §7.7), which is what's implemented.

## Built

Recognition + commit routes and the import-wizard states shipped in P45-DB01
(`/api/imports/contacts/kontax/{preview,commit}`, `import-preview-form.tsx`).
This ticket sealed the round-trip and the designed error states:

- **Pre-commit integrity (spec §7.3).** The commit route now calls
  `verifyKontaxArchiveIntegrity` before parsing an archive; a truncated or
  tampered archive (`verified && !ok`) returns HTTP 400 naming the failed-entry
  count — never a silent partial import.
- **Envelope validation before ingest.** New `cardEnvelopeErrors`
  (`parse.ts`) rejects a document that isn't a supported JSContact Card (bad
  `@type`/`version`, missing/newer-major `formatVersion`) at both parse
  boundaries — archive entries that fail are skipped (counted), a bad bare
  document is refused. Enforces §7.5 version uniformity; stays lenient on
  optional properties (dependency-free — no ajv).
- **Multi-book membership (Phase 40).** `commitKontaxImport` now honors
  `contact.books[1:]`: the home book is the primary membership, every other
  named book that exists in the target account becomes a secondary membership,
  so a multi-book contact round-trips (previously only `books[0]` survived).
  Non-matching book names fall back rather than auto-creating books.

**Round-trip acceptance** proven by `npm run qa:phase45:archive`: export →
archive → import parse is field-identical across name, emails, phones,
websites, custom fields, birthday, emergency flag, book membership, and label
registry, with photos byte-identical. Corrupt/unsupported inputs hit the
designed error states. A full through-the-DB `commitKontaxImport` wipe/reimport
still wants a live staging run (no DB in the pure selftest).

## Scope

Import our own format losslessly — the round-trip test *is* the format's
credibility. Runs through the existing import pipeline seam
([docs/import-export-pipeline.md](../../docs/import-export-pipeline.md)) with
a new parser:

- Recognition: bare documents by the `"format"` marker; archives by
  `manifest.json` with the same marker (string per the P45-02/DB01 naming
  decision).
- Accepts both serializations; validates against the published schema before
  ingesting; rejects newer majors with a clear error.
- Labels re-registered with colors (P31B registry); photos restored
  byte-identical from `media/`; custom fields intact; book memberships
  honoured (Phase 40 shape) with a sensible fallback when the target account
  lacks a named book.
- Import-wizard recognition state per P45-DB01 ("archive — N contacts, M
  photos").

## Acceptance

- **Round-trip:** export N contacts (with photos, custom fields, labels,
  multi-value entries) → wipe → import → field-identical; photos
  byte-identical; label registry recreated with colors.
- Corrupt archive / unsupported version produce the designed error states,
  never a partial silent import.

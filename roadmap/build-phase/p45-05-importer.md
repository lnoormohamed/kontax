# P45-05 — Importer: lossless round-trip of our own format

Status: Not started · Priority: P1 · Depends: [P45-04](p45-04-exporter.md)
Phase: [Phase 45](phase-45-open-export-format.md)

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

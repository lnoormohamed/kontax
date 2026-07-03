# P45-03 — Archive container spec (manifest, media, fallback)

Status: Not started · Priority: P0 · Depends: [P45-02](p45-02-schema-spec-vcard-mapping.md)
Phase: [Phase 45](phase-45-open-export-format.md)

## Scope

The zip layout from the draft doc (`manifest.json`, `contacts/`, `media/`,
optional `vcards/`), hardened:

- Media deduplication by content hash (`media/<sha256>.<ext>`; two contacts
  sharing a photo store it once).
- Size/count limits and **streaming strategy** for large books — 10k contacts
  × photos must not build in memory; the existing `data-export/` job + S3
  plumbing is the execution seam.
- Integrity: manifest checksums cover every entry so a truncated archive is
  detectable.
- The optional `vcards/` compatibility-copy toggle (degraded vCard 3.0
  projection per the P45-02 mapping table).
- Ordinal filenames in `contacts/` — document content is the identity, not
  the filename.

## Acceptance

- Spec section published alongside P45-02 (same repo/versioning).
- A worked example archive (small, committed as a fixture) validates against
  the spec and round-trips through the P45-05 importer once built.

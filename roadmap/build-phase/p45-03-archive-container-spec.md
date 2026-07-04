# P45-03 — Archive container spec (manifest, media, fallback)

Status: Built (2026-07-04) · Priority: P0 · Depends: [P45-02](p45-02-schema-spec-vcard-mapping.md)
Phase: [Phase 45](phase-45-open-export-format.md)

## Built

- Spec §7 hardened from an interface stub into the normative archive-container
  section: layout + ordinal filenames (§7.1), `manifest.json` shape (§7.2),
  per-entry `integrity` checksums (§7.3), media dedup (§7.4), intra-archive
  version uniformity (§7.5), vCard fallback (§7.6), recognition (§7.7),
  streaming strategy + limits (§7.8). Manifest schema:
  [docs/schemas/kontax-archive.v1.schema.json](../../docs/schemas/kontax-archive.v1.schema.json).
- Container code brought up to the spec:
  - `src/server/export-format/archive.ts` now emits `@type`, the integrity
    table (sha256 + byte length per non-manifest entry), and a hoisted label
    registry; ordinal width widens with the contact count (fixes lexical-sort
    break past 9 999).
  - `src/server/export-format/parse.ts` gains `verifyKontaxArchiveIntegrity` —
    detects truncation / tamper (missing / size-mismatch / hash-mismatch)
    before any contact is committed.
- Worked-example fixture committed:
  [tests/fixtures/kontax-archive/example.zip](../../tests/fixtures/kontax-archive/example.zip)
  (+ loose `manifest.json` for diffing). Regenerated and asserted by
  `npm run qa:phase45:archive` (`scripts/phase45-archive-selftest.ts`):
  validates against both schemas, dedups a shared photo, catches
  truncation/tamper, and round-trips losslessly through `parseKontaxArchive`
  (photo byte-identical). Typecheck clean.

Streaming to object storage (never assembling 10k photos in memory) is
**specified** here (§7.8) but wired by [P45-04](p45-04-exporter.md); today's
`buildKontaxArchive` still returns a Buffer.

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

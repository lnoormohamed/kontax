# P45-06 — Open-source publication: repo, license, validator

Status: Built (2026-07-04, in-tree bundle) · Priority: P1 · Depends: [P45-02](p45-02-schema-spec-vcard-mapping.md), [P45-03](p45-03-archive-container-spec.md), [P45-DB01](p45-db01-design-brief-export-format-surfaces.md) (naming)
Phase: [Phase 45](phase-45-open-export-format.md)

## Built

The publishable repo contents live in-tree at [`open-format/`](../../open-format),
self-contained and ready to extract to the public repo **`getkontax/contact-format`**
(name per P45-DB01). Actually creating/pushing the GitHub repo is a human
publication step (not done here — no unsanctioned public push).

- **CLI validator** (`open-format/bin/validate.mjs`) — the crux deliverable.
  **Zero dependencies** (Node ≥18, no npm install, no Kontax account): a
  minimal draft-2020-12 JSON-Schema evaluator covering exactly the keywords the
  schemas use, a hand-rolled zip central-directory reader + core `zlib` for
  archives, and manifest **integrity checksum** verification. Validates both
  serializations; rejects newer majors and version-disagreeing archive entries;
  exit 0/1/2.
- **Schemas** — `open-format/schemas/{kontax-contact,kontax-archive}.v1.schema.json`,
  vendored from `docs/schemas`. A guard keeps them from drifting.
- **Spec** — `open-format/spec.md` (canonical published copy), schema links fixed.
- **Examples** — `daniel-cho.json` (bare document, inline photo) and
  `example-archive.zip` (two contacts sharing one photo → media dedup, with a
  vcards/ fallback + integrity table).
- **README** (format name, version policy, vCard mapping promise, how to
  validate) + **MIT LICENSE** — rationale recorded in the README: minimal
  adoption friction for an interchange format; Apache-2.0's patent grant is
  overkill for a spec + small validator.
- **Guard** — `npm run qa:phase45:openformat`
  (`scripts/phase45-openformat-check.mjs`): vendored schemas match `docs/schemas`
  byte-for-byte, validator accepts both examples, rejects a corrupted archive.
  All pass. Verified negative cases by hand too: tampered archive
  (integrity/JSON fail), truncated archive (no EOCD), newer major, malformed
  document (missing `@type`, bad uuid) — each exits non-zero with a clear
  message.

Remaining (human/publication, out of code scope): create the GitHub repo under
the Kontax org and push `open-format/`; the in-app `/developers` page rendering
the spec is [P45-07](p45-07-developers-page-format-docs.md).

## Scope

Public repo containing:

- The spec (P45-02 document + P45-03 container section) — canonical home;
  the in-app `/developers` page ([P45-07](p45-07-developers-page-format-docs.md))
  renders/links it rather than forking the text.
- JSON Schema files, versioned in lockstep with `formatVersion`.
- A **CLI validator** — a spec without a validator is ignored (the
  phase-37/04 exploration's own conclusion). Validates bare documents and
  archives (manifest checksums included) with no Kontax account needed.
- Example files: a bare document and a small archive fixture.
- Permissive license (MIT or Apache-2.0 — record the call and why).

**Naming:** the vendor-neutral spec name comes from P45-DB01 and must land
before the repo is created (renaming a public repo later costs adoption).
The repo can live under the Kontax org.

## Acceptance

- A third party can validate a file against the published schema with the
  CLI tool alone.
- Repo README states the format name, version policy, and vCard mapping
  promise; spec text matches what P45-04/05 implement (same
  `formatVersion`).

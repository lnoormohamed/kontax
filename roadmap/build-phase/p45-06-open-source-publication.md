# P45-06 — Open-source publication: repo, license, validator

Status: Not started · Priority: P1 · Depends: [P45-02](p45-02-schema-spec-vcard-mapping.md), [P45-03](p45-03-archive-container-spec.md), [P45-DB01](p45-db01-design-brief-export-format-surfaces.md) (naming)
Phase: [Phase 45](phase-45-open-export-format.md)

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

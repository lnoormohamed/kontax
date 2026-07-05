# Phase 45 — Open Contact Export Format

> CSV and vCard 3.0 are no longer enough for what a Kontax contact carries.
> Today's export loses or mangles: profile photos (not exported at all),
> custom fields (Json blob → flattened or dropped), labels/books structure,
> multi-value field metadata, and activity/source context. This phase designs
> and ships an **open-source export format**: lossless, photo-inclusive,
> extensible, and publishable.

## Phase status
In progress — P45-01 complete (2026-07-02): JSContact (RFC 9553) confirmed as
the base format. See
[p45-01-format-research-jscontact-fit.md](p45-01-format-research-jscontact-fit.md).
P45-02 complete (2026-07-03): published spec + JSON Schema + complete vCard
mapping table. See
[p45-02-schema-spec-vcard-mapping.md](p45-02-schema-spec-vcard-mapping.md) and
[docs/contact-export-format-spec.md](../../docs/contact-export-format-spec.md).
P45-DB01 complete (2026-07-03): brief + all six surfaces implemented
([design brief](../design-briefs/p45-db01-export-format-surfaces.md)). The
build pulled forward the working core of P45-04/05 (serializer, single/bulk
export incl. async archive job, import recognition + lossless import in
`src/server/export-format/`); those tickets now cover hardening + the
remaining seams (P45-03 container spec, preset surfaces, full data-export
job integration, round-trip QA harness).

## Strategic guardrail (from the P37 Part 4 exploration)
[phase-37/04-open-standard-exploration.md](../phase-37/04-open-standard-exploration.md)
draws the line this phase must respect: this is an **export/portability
format** (a product deliverable we control end-to-end), *not* the ecosystem
standards play (RFC process, third-party adoption) — that stays parked until
a §3 trigger is real. The insurance policy it prescribes applies here:
**every field in our format must have a documented vCard mapping** (X-props
where vCard has no native slot), so the open-standard door stays open at zero
extra cost and any vCard consumer can degrade gracefully.

## Format decision (recorded 2026-07-02, **confirmed by P45-01**)

**One schema, two serializations — not two formats.**

The "single contact vs multiple contacts" question resolves cleanly:
- **The contact document** — one JSON document per contact, one published
  schema. This is the single-contact export (and the natural payload for
  QR/public-card/share surfaces later).
- **The archive** — a zip container for N contacts: `manifest.json`
  (format version, counts, exporter version), `contacts/` (one document each,
  the *same* schema), `media/` (photos as real files, referenced by hash from
  the documents — no base64 bloat), and optionally `vcards/` (the degraded
  vCard 3.0 projection for legacy consumers).

A single contact is just an archive with one entry — or the bare document
where a file-of-one is friendlier (QR, API). Two *formats* would mean two
parsers, two validators, two docs, and a guaranteed drift bug; one schema in
two wrappers costs almost nothing extra.

**Base to evaluate, not assume:** JSContact (**RFC 9553**, IETF 2024) is a
standards-track JSON contact format with an extension mechanism and defined
vCard interop (RFC 9555). Building the document as JSContact + registered
Kontax extensions (books, labels, layers, source lineage) would make "open"
credible on day one and save most of the spec-writing. P45-01 validates
whether it can carry our model losslessly; greenfield JSON is the fallback,
not the default.

## Tickets

| Ticket | Title | Priority | Depends on |
| --- | --- | --- | --- |
| [P45-01](p45-01-format-research-jscontact-fit.md) ✅ | Format research: JSContact fit, lossless field audit | P0 | — |
| [P45-02](p45-02-schema-spec-vcard-mapping.md) ✅ | Schema specification + vCard mapping table | P0 | P45-01 |
| [P45-03](p45-03-archive-container-spec.md) | Archive container spec (manifest, media, fallback) | P0 | P45-02 |
| [P45-04](p45-04-exporter.md) | Exporter: single document + bulk archive | P1 | P45-03 |
| [P45-05](p45-05-importer.md) | Importer: lossless round-trip of our own format | P1 | P45-04 |
| [P45-06](p45-06-open-source-publication.md) | Open-source publication: repo, license, validator | P1 | P45-02, P45-03 |
| [P45-07](p45-07-developers-page-format-docs.md) | Publish the format docs on `/developers` (+ Help entry) | P2 | P45-02, P45-06 |
| [P45-DB01](p45-db01-design-brief-export-format-surfaces.md) ✅ | Design brief: export format surfaces & naming | P1 | P45-01 |

> Tickets are split into standalone files (linked above); the sections
> below remain the phase-level overview.

### P45-01 — Format research: JSContact fit, lossless field audit
Two deliverables:
1. **Field audit** — enumerate everything a Kontax contact can carry
   (schema walk: core fields, multi-value + type metadata, `customFields`
   Json, `labels` + registry colors, book memberships (Phase 40 shape —
   design for it now), `significantDates`, avatar, source/lineage, activity
   summary?) and mark each: must-export / optional / never (private-field
   rules per the Phase 40 privacy model).
2. **JSContact gap analysis** — map the audit onto RFC 9553; identify what
   fits natively, what needs a Kontax extension property, what genuinely
   doesn't fit. Decision recorded: JSContact-based vs greenfield (with the
   vCard-mapping guardrail either way).

### P45-02 — Schema specification + vCard mapping table
**Starting point: [docs/contact-export-format-draft.md](../../docs/contact-export-format-draft.md)**
(2026-07-02) — the developer draft of the document shape, archive layout,
field conventions, and exclusion rules; P45-02 hardens it into the published
spec after P45-01's JSContact decision.
The published spec: JSON Schema for the contact document, versioning policy
(`formatVersion`, additive-only within a major), custom-field encoding,
photo-by-reference convention, and the **complete vCard 3.0/4.0 mapping
table** (every field → native property or `X-KONTAX-*`). Private fields and
per-book scoping rules defined here (what an export from a shared book may
contain, per member sharing policy).

### P45-03 — Archive container spec
The zip layout above, plus: media deduplication by content hash, size/count
limits and streaming strategy for large books (10k contacts × photos — must
not build in memory; the existing `data-export/` job + S3 plumbing is the
execution seam), integrity (manifest checksums), and the optional `vcards/`
fallback projection toggle.

### P45-04 — Exporter
Wire into the existing export surfaces: the `/api/export` format enum gains
the new format; single-contact export from the detail page; bulk from the
workspace selection and export presets; the full data-export job
(`generate-export.ts`) offers the archive alongside the current files.
Photos stream from MinIO into `media/`.

### P45-05 — Importer
Import our own format losslessly — the round-trip test *is* the format's
credibility: export N contacts → wipe → import → field-identical (photos
byte-identical, custom fields intact, labels re-registered with colors).
Runs through the existing import pipeline seam
(docs/import-export-pipeline.md) with a new parser.

### P45-06 — Open-source publication
Public repo: the spec (P45-02/03), JSON Schema files, a CLI validator
("conformance tool" in miniature — the exploration doc is right that a spec
without a validator is ignored), example files, and a permissive license
call (MIT/Apache-2.0). **Neutral-ish name** decided in P45-DB01 —
per the exploration doc, a vendor-neutral name travels further; the repo can
still live under the Kontax org.

### P45-07 — Publish the format docs on `/developers` (+ Help entry)
The public, indexed `/developers` page (currently the REST API reference)
gains an **Export format** section or subpage: the human-readable spec —
document structure with the worked example, archive layout, field
conventions, versioning policy, and the vCard mapping table — sourced from
the P45-02 spec (single source of truth: the open-source repo from P45-06 is
canonical; the page renders/links it rather than forking the text). Includes
download links to the JSON Schema files and the validator. Follows the
existing page's conventions (the `API_VERSION` review comment pattern applies
— add a matching `FORMAT_VERSION` marker).

Division of audiences: `/developers` gets the spec; **`/help`** gets the
user-level entry ("Which export format should I use?" — the what's-kept
comparison from P45-DB01); the marketing **changelog** announces it at
launch. The in-app help copy is already covered by P45-DB01 and the phase's
documentation checklist — this ticket owns the developer page.

Acceptance: a developer who has never seen Kontax can implement a reader for
the format from the `/developers` page alone (spec + schema + example files);
the page and the repo state the same `formatVersion`; SEO metadata follows
the existing `/developers` pattern.

## Success criteria
- Round-trip losslessness proven (P45-05 acceptance) including photos and
  custom fields.
- A third party can validate a file against the published schema with the
  CLI tool alone — no Kontax account needed.
- Every schema field has a vCard mapping; a `vcards/` fallback opens in
  Apple/Google contacts with graceful degradation.
- The single-vs-multiple question is settled in the spec: one schema, bare
  document + archive wrapper.

## Sequencing notes
- P45-01 can start now; P45-02's book/privacy scoping should track Phase 40's
  model decisions rather than waiting for its build (design against the
  P37 Part 1 schema shapes).
- Coordinate P45-04 with P38-10 (import-export code split) so the new
  exporter lands in the split bundle, not the main one.

## Documentation (per roadmap/documentation-policy.md)
- [ ] External · users — in-app Help: export formats compared, what each keeps
- [ ] External · developers — the published spec repo (P45-06) + the
      `/developers` page section (P45-07)
- [ ] Internal · engineering — docs/import-export-pipeline.md: new format in
      both directions

# P45-02 — Schema specification + vCard mapping table

Status: **Done** (2026-07-03) · Priority: P0 · Depends: [P45-01](p45-01-format-research-jscontact-fit.md) (done — JSContact RFC 9553 confirmed as base)
Phase: [Phase 45](phase-45-open-export-format.md)

Published spec: [docs/contact-export-format-spec.md](../../docs/contact-export-format-spec.md).
JSON Schema: [docs/schemas/kontax-contact.v1.schema.json](../../docs/schemas/kontax-contact.v1.schema.json).

## Scope

The published spec, hardened from two inputs:
- **[docs/contact-export-format-draft.md](../../docs/contact-export-format-draft.md)** —
  the developer draft of document shape, archive layout, field conventions,
  and exclusion rules (the requirements contract).
- **[P45-01](p45-01-format-research-jscontact-fit.md)** — the JSContact
  decision: adopt RFC 9553's Card vocabulary + the ~10 vendor extensions from
  the gap analysis; resolve its open items (frictions F1–F6 dispositions are
  recorded there).

Deliverables:
- JSON Schema for the contact document (JSContact Card + Kontax extension
  properties), replacing the draft's placeholder property names.
- Versioning policy: `formatVersion` MAJOR.MINOR, additive-only within a
  major; readers reject only newer majors.
- Custom-field encoding, photo-by-reference convention (inline `dataUrl`
  permitted only in the bare serialization).
- The **complete vCard 3.0/4.0 mapping table** — every field → native
  property or `X-KONTAX-*` (RFC 9555 conversion where JSContact defines it).
- Private fields and per-book scoping rules (what an export from a shared
  book may contain, per member sharing policy — restate the Phase 40 rules,
  don't invent new ones).

## Acceptance

- [x] Every field from the P45-01 audit has: a schema property, a vCard
  mapping, and a must/optional/never export classification. See
  [spec §3](../../docs/contact-export-format-spec.md#3-property-reference-complete-field-table)
  and [§6](../../docs/contact-export-format-spec.md#6-complete-vcard-30-40-mapping-table).
- [x] The draft doc is updated to point at the spec as authoritative (retired
  into it — [docs/contact-export-format-draft.md](../../docs/contact-export-format-draft.md)
  now redirects).
- [x] Recognition mechanism finalized (spec §7.4/§8): the draft's
  `"format": "kontax-contact"` marker string is retired, not finalized —
  recognition uses the `getkontax.com:formatVersion` vendor property +
  `manifest.json` instead, which doesn't require P45-DB01's product-name
  decision to land first. P45-DB01 still owns the public-facing name/copy,
  unaffected by this.

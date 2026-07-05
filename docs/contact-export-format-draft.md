# Contact Export Format — Developer Draft (superseded)

> **Status: RETIRED** (2026-07-03). **P45-02 has published the authoritative
> spec: [docs/contact-export-format-spec.md](contact-export-format-spec.md).**
> Everything below is kept only as the historical requirements contract this
> draft handed to P45-02 (property names here are placeholders — the
> published spec uses JSContact's Card vocabulary plus `getkontax.com:*`
> vendor extensions). Do not implement against this file; implement against
> the spec.

## Design principles

1. **The document is the format.** One JSON document describes one contact.
   Everything else (the archive) is packaging around N documents.
2. **Decoupled from the database.** Property names and shapes are a public
   contract, versioned independently of the Prisma schema. Exports are
   *projections* of a contact, never row dumps — internal IDs, sync
   bookkeeping (`syncVersion`, `syncUid`, tombstones), merge lineage, and
   other operational fields are excluded by design.
3. **Nothing lossy.** Every user-visible datum a Kontax contact carries must
   round-trip: export → import → field-identical, photos byte-identical.
4. **Additive versioning.** Consumers ignore unknown properties. Within a
   major version, the schema only gains optional properties. A file states
   its version; a reader rejects only a higher *major* than it knows.
5. **vCard-mappable.** Every property has a documented vCard 3.0/4.0 mapping
   (native property or `X-KONTAX-*`) so a degraded compatibility copy can
   always be produced. This is the phase-37/04 guardrail.
6. **Media by reference.** Photos are files in the archive, referenced by
   content hash — never base64 inside the document.

## The contact document

One JSON object per contact. Draft shape (property names subject to the
JSContact decision):

```json
{
  "format": "kontax-contact",
  "formatVersion": "1.0",
  "exportedAt": "2026-07-02T14:30:00Z",

  "name": {
    "full": "Dr. Amelia Rowe-Nguyen",
    "given": "Amelia",
    "middle": null,
    "family": "Rowe-Nguyen",
    "prefix": "Dr.",
    "suffix": null,
    "nickname": "Mel",
    "phoneticGiven": null,
    "phoneticFamily": null
  },

  "organization": {
    "company": "Vexon Health",
    "phoneticCompany": null,
    "jobTitle": "Clinical Lead",
    "department": "Research"
  },

  "emails": [
    { "label": "Work", "value": "amelia@vexonhealth.example", "primary": true }
  ],

  "phones": [
    {
      "label": "Mobile",
      "value": "+61 412 345 678",
      "primary": true,
      "e164": "+61412345678",
      "countryCode": "AU",
      "extension": null,
      "numberType": "mobile"
    }
  ],

  "addresses": [
    {
      "label": "Home",
      "street": "12 Harbour Lane",
      "city": "Sydney",
      "state": "NSW",
      "postcode": "2000",
      "country": "Australia"
    }
  ],

  "websites": [
    { "label": "Company", "value": "https://vexonhealth.example" }
  ],

  "dates": [
    { "label": "Birthday", "value": "1988-04-12" },
    { "label": "Anniversary", "value": "--06-30" }
  ],

  "relatedPeople": [
    { "label": "Spouse", "value": "Kim Rowe-Nguyen" }
  ],

  "labels": [
    { "name": "Clients", "color": "#4158f4" }
  ],

  "customFields": [
    { "label": "Client ID", "value": "VX-2201" }
  ],

  "notes": "Prefers email. Met at HealthTech 2025.",
  "favorite": true,
  "emergency": false,

  "photo": {
    "ref": "media/3fa4c2….jpg",
    "sha256": "3fa4c2…",
    "mediaType": "image/jpeg",
    "width": 1024,
    "height": 1024
  },

  "source": {
    "createdAt": "2025-11-03T09:12:00Z",
    "updatedAt": "2026-06-28T17:45:00Z",
    "origin": "IMPORT",
    "originDetail": "google-csv"
  },

  "books": [
    { "name": "Work" }
  ]
}
```

### Field conventions

- **Multi-value entries** (`emails`, `phones`, `websites`, `addresses`,
  `dates`, `relatedPeople`) mirror the internal entry model
  (`contact-multi-value.tsx`): each entry is `{ label, value, … }`. Labels
  are free strings; the well-known set ("Work", "Mobile", …) is documented
  but not enforced — custom labels round-trip as-is.
- **Phones** carry the Phase 37 normalization enrichment (`e164`,
  `countryCode`, `numberType`) as *optional* properties. `value` alone is a
  valid phone entry; importers re-derive enrichment when absent. Internal
  bookkeeping (`validationStatus`, `source`, `rawInput`) is **not** exported.
- **Dates** use ISO 8601, with vCard 4's no-year form (`--MM-DD`) permitted
  for year-unknown birthdays/anniversaries.
- **Labels** export as name + registry color, so an import into a fresh
  account recreates the label registry (P31B) faithfully. Membership is
  per-contact; the registry is implied by the union across documents.
- **Custom fields** are ordered `{ label, value }` pairs — the internal
  `customFields` Json maps 1:1. Values are strings in v1 (typed values are a
  future additive extension).
- **Photo** references a file in the archive by path and content hash. A bare
  single-contact document (no archive) may instead carry
  `"photo": { "sha256": …, "dataUrl": … }` — the only place inline data is
  permitted, and only in the bare serialization.
- **Books** export as names (Phase 40 will extend this to multi-membership —
  the property is an array from day one for that reason).
- **Privacy:** fields marked private (Phase 40 `ContactPrivateField`) export
  only in the owner's own export, never in shared-book exports by other
  members. The spec must restate the sharing-model rules, not invent new
  ones.

### Excluded by design

Internal IDs (`id`, `userId`, `bookId`, cuids of any kind), sync state
(`syncUid`, `syncVersion`, `syncTombstoneAt`, sync links/conflicts), merge
lineage, reminder state, import-job references, archival timestamps. An
export must be importable into *any* account, including a different user's.

## The archive

A standard zip. Draft layout:

```
contacts-export.zip
├── manifest.json          # format, formatVersion, exportedAt, counts,
│                          # exporter app version, checksums
├── contacts/
│   ├── 0001.json          # one contact document each (same schema as bare)
│   ├── 0002.json
│   └── …
├── media/
│   └── <sha256>.<ext>     # photos, deduplicated by content hash
└── vcards/                # OPTIONAL compatibility copy
    └── contacts.vcf       # vCard 3.0 projection, degraded per mapping table
```

- Filenames in `contacts/` are ordinal, not IDs — the document content is
  the identity.
- `media/` files are content-addressed; two contacts sharing a photo store
  it once.
- The manifest's checksums cover every entry, so a truncated archive is
  detectable.
- Streaming: exporters write the zip incrementally (10k contacts × photos
  must not be assembled in memory — the existing `data-export` job is the
  execution seam).

## Serializations

One schema, two wrappers (Phase 45 decision):

| Wrapper | Contents | Use |
| --- | --- | --- |
| Bare document (`.json`) | One contact document | Single-contact export, QR/share payloads, API |
| Archive (`.zip`) | manifest + N documents + media + optional vcards | Bulk export, backup, migration |

File extension and public naming are P45-DB01 decisions; nothing in this
draft depends on them.

## Versioning

- `formatVersion`: `MAJOR.MINOR`. Minor = additive optional properties only.
  Major = breaking; readers refuse newer majors with a clear error.
- The manifest and every document state the version (documents travel alone).
- The published JSON Schema is versioned in lockstep; the P45-06 validator
  pins one schema per version.

## Open questions (owned by P45-01/02)

1. **JSContact or bespoke names?** If RFC 9553 + extensions can carry every
   field above losslessly, adopt its property vocabulary and keep this
   document's *structure* as the extension design. Bespoke names (as drafted
   here) are the fallback.
2. **Activity/source depth** — is `source.origin` enough, or do we export
   activity summaries? (Draft position: origin only; activity is account
   data, not contact data.)
3. **Typed custom fields** — v1 strings vs `{ label, value, type }`. Draft
   position: strings in v1, type as an additive later.
4. **Shared-book export semantics** — exact field set a non-owner member's
   export may include (depends on Phase 40 policy resolution).

## Relationship to import

The importer (P45-05) accepts both serializations and must round-trip
losslessly. Recognition: bare documents by the `"format"` marker; archives by
`manifest.json` with the same marker. (`"kontax-contact"` is a placeholder —
the marker string follows the P45-DB01 naming decision, which favours a
vendor-neutral spec name; importers should match whatever P45-02 publishes.) The import wizard treats an
archive like any other source (see
[import-export-pipeline.md](import-export-pipeline.md)).

# Kontax Contact Export Format — Specification

> **Published copy.** This is the canonical, publicly distributed spec that
> ships in the `getkontax/contact-format` repository alongside the
> [schemas](schemas/) and the [reference validator](bin/validate.mjs). It is
> kept in lockstep with the working copy inside the Kontax monorepo. A few
> cross-references below point at internal `roadmap/…` and `src/…` planning
> documents; those are provenance notes and are not expected to resolve in this
> public mirror — the normative content is entirely self-contained here and in
> `schemas/`.

> **Status: PUBLISHED** (v1.0.0, 2026-07-03). This document is the
> authoritative spec for [Phase 45](../roadmap/build-phase/phase-45-open-export-format.md),
> written by [P45-02](../roadmap/build-phase/p45-02-schema-spec-vcard-mapping.md)
> against the [P45-01](../roadmap/build-phase/p45-01-format-research-jscontact-fit.md)
> decision (JSContact/RFC 9553 base) and the field audit therein. It supersedes
> [docs/contact-export-format-draft.md](contact-export-format-draft.md), which
> is now a historical pointer to this file.
>
> The **public product name, file extension, and marketing framing** are a
> [P45-DB01](../roadmap/build-phase/p45-db01-design-brief-export-format-surfaces.md)
> product decision that has not shipped a brief yet. Nothing technical here
> depends on that name (see [§8](#8-naming--recognition)) — the recognition
> mechanism (vendor property + `manifest.json`) is final regardless of what
> the format is called in the UI.

## 0. Conformance language

MUST / MUST NOT / SHOULD / MAY follow RFC 2119. This document assumes
familiarity with **RFC 9553 (JSContact)** and **RFC 9555 (JSContact vCard
extensions)** — it does not restate their grammar, only how Kontax uses it.

## 1. Design principles

Carried forward from the draft, now settled:

1. **The document is the format.** One JSON document — a JSContact `Card` —
   describes one contact. The archive ([P45-03](../roadmap/build-phase/p45-03-archive-container-spec.md))
   is packaging around N documents, not a second format.
2. **Decoupled from the database.** Every property below is a public,
   independently-versioned contract. Exports are *projections*, never row
   dumps — Prisma column names never appear as document properties.
3. **Nothing lossy for must-export fields.** Export → import → field-identical;
   photos byte-identical. See the classification in §3.
4. **Additive versioning within a major** (§4). JSContact's own MUST-preserve
   rule (RFC 9553 §1.7.4/§1.7.5) already gives readers a stronger contract
   than "ignore unknown properties" — Kontax versioning rides on top of it.
5. **Every property has a documented vCard mapping** (§6) — the phase-37/04
   guardrail. Native property where vCard has one, `X-KONTAX-*` otherwise.
6. **Media by reference.** Photos are archive files referenced by content
   hash; inline `dataUrl` is permitted only in the bare single-document
   serialization (§7.4).

## 2. Base format and vendor extensions

The contact document is a JSContact `Card` (RFC 9553), `version: "1.0"`,
plus properties in the **`getkontax.com`** vendor namespace (RFC 9553
§1.8.1 requires a domain-prefixed name — `getkontax.com` is the domain
Kontax controls, already used for public URLs, see
[docs/sharing-model.md](sharing-model.md)).

- **Top-level vendor properties** use the form `"getkontax.com:name"`.
- **In-object vendor properties** (inside `Address`, `Media`, `Phone`, …) use
  the same prefix and are legal per §1.8.1 ("MAY be set in any JSContact
  object").
- **Vendor enum values**, where used, follow §1.8.2's `vendor-id:value`
  form (e.g. a `relatedTo` relation of `getkontax.com:partner`).

This document's job is to enumerate every one of those vendor properties and
pin their shape. Nothing outside `getkontax.com:*` is Kontax-specific — a
generic JSContact reader that ignores unknown properties still recovers a
usable, mostly-complete contact.

## 3. Property reference (complete field table)

Class definitions unchanged from the P45-01 audit:
**must** = round-trip required, format is lossy without it · **optional** =
exported when present, importers tolerate absence · **never** = excluded by
design (operational/internal).

`pref: 1` is JSContact's primary-marker convention (RFC 9553 §2.4.1) — used
throughout below for `isPrimary`.

### 3.1 Envelope

| Property | Type | Class | Notes |
| --- | --- | --- | --- |
| `@type` | `"Card"` | must | Fixed. |
| `version` | `"1.0"` | must | JSContact spec version — **not** the Kontax format version. |
| `uid` | string (UUID) | must | Minted fresh per export (resolves F6). Stable only *within* one export, for cross-references to `media/`; never the internal `Contact.id`/`syncUid`. |
| `created` | timestamp | must | ← `Contact.createdAt`. |
| `updated` | timestamp | must | ← `Contact.updatedAt`. |
| `prodId` | string | optional | Exporter identity, e.g. `"kontax/1.0"`. |
| `getkontax.com:formatVersion` | string `MAJOR.MINOR` | must | The Kontax extension-set version (§4). Two version fields, two meanings — see §4. |
| `getkontax.com:exportedAt` | timestamp | must | Wall-clock time of this export run (distinct from `updated`). |

### 3.2 Name & identity

| Kontax field | JSContact property | Class | Notes |
| --- | --- | --- | --- |
| `fullName` | `name.full` | must | |
| `firstName` | `name.components[]` kind `given` | must | |
| `middleName` | `name.components[]` kind `given2` | must | |
| `lastName` | `name.components[]` kind `surname` | must | |
| `namePrefix` | `name.components[]` kind `title` | must | |
| `nameSuffix` | `name.components[]` kind `credential` | must | |
| `nickname` | `nicknames.<id>.name` | must | |
| `phoneticFirstName`, `phoneticLastName` | `name.components[]` matching component's `phonetic` + `name.phoneticSystem`/`phoneticScript` | must | **F2 resolution:** derive `phoneticScript` from the Unicode script of the stored string via the table in §3.2.1; when no script is detected, omit `phoneticScript`/`phoneticSystem` and keep the string in `getkontax.com:phoneticRaw` on the component instead. Either path is lossless. |

#### 3.2.1 Phonetic script detection (F2)

Cheap, deterministic, no registered `phoneticSystem` claimed unless the
string is unambiguous:

| Dominant Unicode script of the string | `phoneticScript` | `phoneticSystem` |
| --- | --- | --- |
| Han (`\p{Script=Han}`) | `"Hani"` | omit (ambiguous between Mandarin pinyin / Cantonese jyutping without more context — reading is preserved either way) |
| Hiragana / Katakana | `"Kana"` | omit |
| Hangul | `"Hang"` | omit |
| Latin, ASCII (romanized pinyin/yomi) | omit | omit — falls back to `getkontax.com:phoneticRaw` |
| Anything else / mixed | omit | omit — falls back to `getkontax.com:phoneticRaw` |

### 3.3 Organization

| Kontax field | JSContact property | Class | Notes |
| --- | --- | --- | --- |
| `company` | `organizations.<id>.name` | must | |
| `department` | `organizations.<id>.units[]` | must | |
| `jobTitle` | `titles.<id>.name`, `titles.<id>.organizationId` → the org above | must | |
| `phoneticCompany` | `organizations.<id>."getkontax.com:phoneticCompany"` | must | **extension** — RFC 9553 §2.2.3 has no org phonetics slot. |

### 3.4 Multi-value entries

Kontax's `{label, value, isPrimary}` entry shape maps onto JSContact's
keyed-map-of-objects pattern (`Id` keys, RFC 9553 §1.4). `label` free strings
carry through as-is; the well-known set ("Work", "Mobile", "Home", …) gets a
`contexts` value where JSContact defines one, in addition to the literal
label where JSContact has no free-text label slot (addresses — F3).

| Kontax field | JSContact property | Class | Notes |
| --- | --- | --- | --- |
| `emailEntries[].value` | `emails.<id>.address` | must | |
| `emailEntries[].label` | `emails.<id>.contexts` (well-known) or `emails.<id>.label` (RFC 9553 §2.3.1 has both) | must | |
| `emailEntries[].isPrimary` | `emails.<id>.pref: 1` | must | |
| `phoneEntries[].label/value/isPrimary` | `phones.<id>.label` / `phones.<id>.number` / `phones.<id>.pref` | must | **F5 resolution:** `number` carries the user-typed string as-is (not a `tel:` URI) — lossless, matches existing vCard behavior (`contactsToVCard`'s bare `TEL:` line). |
| `phoneEntries[].e164` | `phones.<id>."getkontax.com:e164"` | optional | Companion to the F5 free-text choice; importers re-derive when absent. |
| `phoneEntries[].countryCode` | `phones.<id>."getkontax.com:countryCode"` | optional | |
| `phoneEntries[].numberType` | `phones.<id>.features` (map to `mobile`/`voice`/`fax`/… per RFC 9553 §2.4.2, vendor-extend if no match) | optional | |
| `phoneEntries[].extension` | encoded into `number` string (`;ext=` convention, human legible) | optional | Not split into a separate property — the extension is part of what the user typed. |
| `phoneEntries[].rawInput/national/callingCode/display*/validationStatus/source` | — | never | Derivable or internal bookkeeping (unchanged from P45-01). |
| `websiteEntries[].value` | `links.<id>.uri` | must | |
| `websiteEntries[].label` | `links.<id>.label` | must | |
| `addressEntries[].street/city/state/postcode/country` | `addresses.<id>.components[]` kinds `name`(street)/`locality`/`region`/`postcode`/`country` (RFC 9553 §2.5.1.2) | must | |
| `addressEntries[].label` (well-known: Home/Work) | `addresses.<id>.contexts` | must | |
| `addressEntries[].label` (custom, e.g. "Holiday house") | `addresses.<id>."getkontax.com:label"` | must | **F3 resolution:** vendor property inside the Address object carries the literal label whenever it isn't one of the well-known contexts; `contexts` is still set to the closest well-known value (or omitted) so generic readers get a reasonable default. |
| `significantDates[].value` | `anniversaries.<id>.date` as `Timestamp` or `PartialDate` (RFC 9553 §2.8.1 — supports year-less `--MM-DD` and `calendarScale`) | must | Year-less dates and non-Gregorian calendars (e.g. lunar birthdays) both fit natively. |
| `significantDates[].label` ("Birthday") | `anniversaries.<id>.kind: "birth"` | must | |
| `significantDates[].label` ("Anniversary"/"Wedding") | `anniversaries.<id>.kind: "wedding"` | must | |
| `significantDates[].label` (custom) | `anniversaries.<id>.kind: "getkontax.com:<slug>"`, literal string in `anniversaries.<id>.place` is **not** reused for this — literal label rides `anniversaries.<id>."getkontax.com:label"` | must | Vendor enum value (§1.8.2) plus a vendor property so the exact label round-trips even if the slug is lossy. |
| `significantDates[].isPrimary` | `anniversaries.<id>."getkontax.com:isPrimary"` | must | `Anniversary` has no native `pref`. |
| `relatedPeople[].label`, `.value` | `"getkontax.com:relatedPeople".<id>.{label, value}` | must | **F4 resolution:** kept as a standalone vendor property mirroring the internal `{label, value}` shape — do **not** contort `relatedTo` (RFC 9553 keys are Card `uid`s and Kontax stores free-text names of people who are often not contacts; "Partner" also isn't a registered relation value). |

### 3.5 Labels, books, flags, notes

| Kontax field | JSContact property | Class | Notes |
| --- | --- | --- | --- |
| `labels` (names on contact) | `keywords` (`String[Boolean]`, RFC 9553 §2.8.2) | must | Membership is per-contact. |
| Label registry (`Label.name` + `Label.color`) | `"getkontax.com:labels".<id>.{name, color}` at document level | optional | **extension.** Carries color so a fresh account recreates the registry (P31B) faithfully. In an archive, the registry SHOULD also be deduplicated into `manifest.json` (P45-03 decides the exact split; a per-document copy is still valid for the bare single-contact case). `Label.position`: optional, same object. `Label.id`/`Label.userId`: never. |
| Book membership (names) | `"getkontax.com:books"` (string array) | must | Array-shaped from day one for the Phase 40 multi-book model. `AddressBook` operational fields (`slug`, `deviceWritable`, `sourceBookIds`, `isDefault`): never. `AddressBook.description`: optional, archive-manifest level (P45-03), not per-document. |
| `notes` | `notes` | must | |
| `isFavorite` | `"getkontax.com:favorite"` (boolean) | must | |
| `isEmergency` | `"getkontax.com:emergency"` (boolean) | must | |
| `customFields` (ordered `{label, value}`) | `"getkontax.com:customFields"` (array, order-preserving) | must | §5. |

### 3.6 Photo

| Kontax field | JSContact property | Class | Notes |
| --- | --- | --- | --- |
| Avatar bytes | `media.<id>` kind `"photo"`, `uri`, `mediaType` | must | §7.4/F1 resolution below. |
| content hash | `media.<id>."getkontax.com:sha256"` | must | |
| dimensions | `media.<id>."getkontax.com:width"` / `"getkontax.com:height"` | optional | |
| `avatarUrl` (storage URL) | — | never | Infrastructure, not the datum — unchanged from P45-01. |

**F1 resolution.** `Media.uri` MUST be a URI. Two valid forms, chosen by
serialization:

- **Archive documents** (`contacts/*.json` inside a zip): `uri` is a
  *relative reference* (RFC 3986 §4.2) resolved against the archive root,
  e.g. `"media/3fa4c2….jpg"`. This is the same convention the draft used;
  RFC 9553 constrains `Media.uri` to "a URI" and does not forbid a relative
  reference, which is a valid URI-reference in RFC 3986 terms.
- **Bare single-document serialization**: `uri` MUST be an absolute `data:`
  URI (`data:image/jpeg;base64,…`) — the one place inline image data is
  permitted, since a bare document has no archive root to resolve against.

Readers detect which form to expect from the wrapper (§7), not from
inspecting the URI scheme.

### 3.7 Provenance

| Kontax field | JSContact property | Class | Notes |
| --- | --- | --- | --- |
| `createdAt` / `updatedAt` | `created` / `updated` (§3.1) | must | |
| `sourceType`, `sourceDetail` | `"getkontax.com:source".origin` / `.originDetail` | optional | Origin only (`"IMPORT"` / `"google-csv"`) — activity is account data, not contact data (P45-01 §1.6 decision, restated, not reopened). |
| `lastMutatedBy`, `lastMutatedByDetail`, activity events | — | never | Operational sync bookkeeping. |

### 3.8 Excluded by design (never) — full list

Unchanged from P45-01 §1.7, restated for completeness: internal identifiers
(`id`, `userId`, `bookId`, `importJobId`, any cuid); sync state (`syncUid`,
`syncVersion`, `syncTombstoneAt`, `SyncContactLink`, `SyncConflict`); merge
lineage (`mergedIntoContactId`, suggestions/decisions/dismissals); reminder
state (`reminderLeadDaysOverride`, `BirthdayReminderState`); share plumbing
(`ContactShare`); `archivedAt`; `searchVector`.

## 4. Versioning policy

Two independent version fields — do not conflate them:

| Field | Meaning | Changes when |
| --- | --- | --- |
| `version` | JSContact spec version | RFC 9553 itself revises (out of Kontax's control; expect this to stay `"1.0"` for years). |
| `getkontax.com:formatVersion` | The Kontax vendor-extension set's version, `MAJOR.MINOR` | Kontax adds/changes `getkontax.com:*` properties. |

Rules for `formatVersion`:

- **MINOR** bump: additive only — a new optional `getkontax.com:*`
  property, a new optional field on an existing vendor object, a new
  well-known `anniversaries.kind` vendor slug. Existing readers of an older
  minor MUST still parse the document (unknown properties preserved per
  RFC 9553 §1.7.4, exactly as for native properties).
- **MAJOR** bump: anything that removes, renames, or changes the meaning of
  an existing `getkontax.com:*` property. Readers MUST reject a document
  whose major exceeds the highest major they support, with a clear
  "unsupported format version" error — never a silent partial import.
- The manifest (archive) and every document state `formatVersion`
  independently (documents travel alone, per design principle 1).
- The published [JSON Schema](schemas/kontax-contact.v1.schema.json) is
  versioned in lockstep, one schema file per major
  (`kontax-contact.v1.schema.json`); P45-06's validator pins the schema
  matching the document's declared major.

Current version: **`1.0`**.

## 5. Custom-field encoding

`"getkontax.com:customFields"` is an ordered array (not a map — order is
significant and the internal representation is already list-shaped, per
P45-01 §1.4/draft §"Custom fields"):

```json
"getkontax.com:customFields": [
  { "label": "Client ID", "value": "VX-2201" }
]
```

- `value` is a **string** in v1. Typed values (`{ label, value, type }`)
  are an additive MINOR extension for a future version — do not add a
  `type` property speculatively now (draft open question 3, resolved:
  strings only in v1).
- Empty array is omitted, not emitted as `[]`.

## 6. Complete vCard 3.0/4.0 mapping table

Every property in §3 maps to a native vCard property where one exists, or a
Kontax `X-` extension otherwise (phase-37/04 guardrail). This is the same
`X-KONTAX-*` namespace already emitted by
[`contactsToVCard`](../src/server/contact-portability.ts) — this table is
the first place it's specified end-to-end rather than implied by the code.
`X-` properties apply to both vCard 3.0 and 4.0 (vCard 4.0/RFC 6350 keeps
`X-` extensibility); grouped/`item*.` lines follow vCard 3.0's `X-ABLABEL`
convention for custom labels, matching existing behavior.

| Document property | vCard line | Notes |
| --- | --- | --- |
| `name.full` | `FN:` | |
| `name.components` (given/given2/surname/title/credential) | `N:family;given;given2;title;credential` | |
| `name.components[].phonetic` | `X-KONTAX-PINYIN-FIRST-NAME:` / `X-KONTAX-PINYIN-LAST-NAME:` | Existing code; combined form also emits `SORT-STRING:` + `X-KONTAX-PINYIN-NAME:`. |
| `nicknames` | `NICKNAME:` | |
| `organizations.name` + `.units` | `ORG:company;department` | |
| `organizations."getkontax.com:phoneticCompany"` | `X-KONTAX-PINYIN-COMPANY:` | Existing code. |
| `titles.name` | `TITLE:` | |
| `emails` | `EMAIL;TYPE=<ctx>[,PREF]:` (custom label → `itemN.EMAIL` + `itemN.X-ABLABEL:`) | |
| `phones.number` | `TEL;TYPE=<ctx>[,PREF]:` (custom label → `itemN.TEL` + `itemN.X-ABLABEL:`) | Free-text number, per F5. |
| `phones."getkontax.com:e164"` | `X-KONTAX-E164:` | Not currently emitted by code; new for P45-04. |
| `links` (websites) | `URL;TYPE=<ctx>[,PREF]:` (custom label, generic flavor → `itemN.URL` + `itemN.X-ABLABEL:`; Fastmail flavor → `X-CYRUS-ONLINESERVICE;X-SERVICE-TYPE=…:`) | Existing code (`appendFastmailOnlineServiceLine`). |
| `addresses.components` | `ADR;TYPE=<ctx>[,PREF]:pobox;ext;street;city;region;postcode;country` (custom label → `itemN.ADR` + `itemN.X-ABLABEL:`) | |
| `addresses."getkontax.com:label"` | `itemN.X-ABLABEL:` | Same mechanism as the custom-label case above — no separate line. |
| `anniversaries` kind `birth` | `BDAY:` (vCard 4 no-year form `--MM-DD` permitted) | |
| `anniversaries` other kinds | `itemN.X-ABDATE:` + `itemN.X-ABLABEL:` | Existing code, covers "Anniversary" and custom-labeled dates uniformly. |
| `"getkontax.com:relatedPeople"` | `X-KONTAX-RELATED;X-KONTAX-LABEL=<label>:` (one line per entry) | New for P45-04 — vCard 4's `RELATED` isn't used because Kontax's values are free-text names, not URIs/UIDs (F4). |
| `keywords` (labels) | `CATEGORIES:` (comma-joined names) | Registry colors have no vCard slot; `X-KONTAX-LABEL-COLOR;X-KONTAX-LABEL=<name>:<hex>` one line per colored label. |
| `"getkontax.com:books"` | `X-KONTAX-BOOK:` (one line per book name) | Matches phase-37/04's `X-KONTAX-BOOK` proposal. |
| `notes` | `NOTE:` | |
| `"getkontax.com:favorite"` | `X-KONTAX-FAVORITE:TRUE` / omitted when false | |
| `"getkontax.com:emergency"` | `X-KONTAX-EMERGENCY:TRUE` / omitted when false | |
| `"getkontax.com:customFields"` | `X-KONTAX-CUSTOM-FIELD;X-KONTAX-LABEL=<label>:<value>` (one line per entry, order preserved by line order) | |
| `media` (photo) | `PHOTO;ENCODING=b;TYPE=<subtype>:<base64>` (vCard 3) / `PHOTO:data:<mediaType>;base64,<data>` (vCard 4) | The `vcards/` fallback always inlines the photo — there is no archive to reference from inside a `.vcf`. |
| `media."getkontax.com:sha256"` | `X-KONTAX-PHOTO-SHA256:` | |
| `created` | `X-KONTAX-CREATED:` | vCard has no native creation-time property. |
| `updated` | `REV:` | Native vCard 3/4 property. |
| `"getkontax.com:source".origin`/`.originDetail` | `X-KONTAX-SOURCE:<origin>` / `X-KONTAX-SOURCE-DETAIL:<detail>` | Optional class — only emitted when present. |
| `uid` | `UID:` | Native; the export-minted UUID (F6), not any internal id. |
| `getkontax.com:formatVersion` | `X-KONTAX-FORMAT-VERSION:` | Lets a `.vcf` consumer that also understands Kontax X-props know which vocabulary version produced the file. |

Fields classified **never** (§3.8) have no vCard line — omission there is
correct, not a gap.

## 7. Archive container

> **Normative as of P45-03** (this section was an interface stub in the v1.0.0
> P45-02 publication; P45-03 hardens it in place — media dedup, integrity
> checksums, streaming, and limits — without changing the on-the-wire layout
> P45-DB01 already ships). The manifest is machine-checkable against
> [kontax-archive.v1.schema.json](schemas/kontax-archive.v1.schema.json).

Two serializations carry the §2–§6 documents:

- **Bare document** (`.json`): a single Card, exactly as specified in §2–§6,
  photo inlined per §3.6's `data:` URI form. No container — nothing in this
  section applies.
- **Archive** (`.zip`): N Cards plus their media and a manifest. The rest of
  this section specifies it.

### 7.1 Layout

```
manifest.json            — required, exactly one, at the archive root
contacts/0001.json       — one Card document (§2–§6) per contact, photo by ref
contacts/0002.json
   …
media/<sha256>.<ext>     — content-addressed photo bytes (§7.4)
vcards/contacts.vcf      — optional vCard 3.0 fallback (§7.6)
```

- **`contacts/` filenames are ordinals, not identity.** The content of each
  document (its `uid`, §3.1) is the contact's identity; the filename is only a
  stable sort key. Importers MUST NOT derive any meaning from it. Names are
  zero-padded to a width that covers the archive's contact count
  (`0001`…`9999`, then `00001`… for ≥ 10 000) so lexical entry-name order
  always equals numeric order — a reader that sorts entries by name gets export
  order back. Gaps (from a skipped/invalid contact) are permitted; ordinals
  need not be contiguous.
- Every `contacts/*.json` entry MUST declare the **same**
  `getkontax.com:formatVersion` as the manifest. A mixed-version archive is
  invalid (§7.5).
- Unknown top-level entries (e.g. a future `attachments/` tree) MUST be ignored
  by a v1 reader, never treated as an error — this is the container-level
  analogue of RFC 9553's unknown-property rule.

### 7.2 `manifest.json`

The manifest is the archive's envelope and its integrity root. Shape:

```json
{
  "@type": "getkontax.com:Archive",
  "getkontax.com:formatVersion": "1.0",
  "getkontax.com:exportedAt": "2026-07-04T14:30:00Z",
  "exporter": "kontax/1.0",
  "counts": { "contacts": 2, "photos": 1 },
  "getkontax.com:labels": {
    "l1": { "name": "Clients", "color": "#4158f4", "position": 0 }
  },
  "integrity": {
    "algorithm": "sha256",
    "entries": [
      { "path": "contacts/0001.json", "sha256": "…", "bytes": 1180 },
      { "path": "contacts/0002.json", "sha256": "…", "bytes": 1094 },
      { "path": "media/3fa4c2….png", "sha256": "3fa4c2…", "bytes": 20481 }
    ]
  }
}
```

| Property | Class | Notes |
| --- | --- | --- |
| `@type` | must | Fixed `"getkontax.com:Archive"`. Distinguishes a manifest from a stray Card at the root. |
| `getkontax.com:formatVersion` | must | The archive's format major.minor (§4). Recognition (§7.7) keys off this. |
| `getkontax.com:exportedAt` | must | Wall-clock time of the export run; matches every document's `getkontax.com:exportedAt`. |
| `exporter` | optional | Producer id, e.g. `"kontax/1.0"`. |
| `counts.contacts` / `counts.photos` | optional | Advisory totals for a progress UI; the authoritative counts are the actual entries. A reader MAY cross-check them but MUST NOT reject on a mismatch alone (they are a hint, not a checksum). |
| `getkontax.com:labels` | optional | **Dedup hoist (SHOULD).** The label registry (name + color + position, §3.5) collected once at the archive level instead of copied into every document. Resolves §10-item-4: a per-document copy remains valid, so a document extracted from an archive still stands alone; when the manifest carries the registry, an importer SHOULD prefer it. |
| `getkontax.com:books` | optional | Book descriptions (`{ name, description }`), the archive-level home for `AddressBook.description` (§3.5). Membership itself stays per-document (`getkontax.com:books` array on each Card). |
| `integrity` | must | §7.3. |

### 7.3 Integrity

`integrity.entries[]` lists **every packed entry except `manifest.json`
itself** (a manifest cannot checksum the document it lives in), each with:

- `path` — the entry's archive-relative path.
- `sha256` — hex SHA-256 of the entry's exact bytes. `integrity.algorithm`
  names the hash (`"sha256"` in v1; a different algorithm is a MAJOR change).
- `bytes` — the entry's uncompressed byte length.

This makes a **truncated or corrupted archive detectable before any contact is
committed**: a clipped download loses its zip central directory (fails to open
→ integrity failure), and a short or dropped entry fails its length/hash check.
For `media/*`, the filename is *already* the content hash (§7.4), so the
integrity row is a belt-and-braces restatement that also lets a reader verify
media without re-deriving paths.

Reader rules:

- A reader SHOULD verify integrity before import and refuse a mismatching
  archive with a clear error, rather than importing a partial contact set.
- An archive whose manifest has **no** `integrity` block (a pre-P45-03
  producer) is not rejected on that basis — it is simply *unverified*; the
  reader falls back to per-document JSON validity. New producers MUST emit it.

### 7.4 Media deduplication

Photo bytes live under `media/<sha256>.<ext>`, where `<sha256>` is the hex
SHA-256 of the bytes and `<ext>` derives from the media type. Because the path
is the content hash, **two contacts sharing an identical photo reference the
same single `media/` file** — the exporter writes each distinct photo once.
Documents reference media by the relative path (§3.6 F1), e.g.
`"uri": "media/3fa4c2….png"`, resolved against the archive root.

### 7.5 Versioning within an archive

Every document and the manifest state `formatVersion` independently (design
principle 1 — documents travel alone), but within one archive they MUST agree.
A reader that finds two different majors, or a document major exceeding the
manifest's, MUST treat the archive as invalid rather than importing the subset
it understands (§4's "never a silent partial import", applied to the container).

### 7.6 vCard fallback

`vcards/contacts.vcf` is an **optional** single-file vCard 3.0 projection of
the whole archive per the §6 mapping — a compatibility copy for tools that
can't read JSContact. It is degraded by construction (X-props a generic reader
drops) and always inlines photos (`PHOTO;ENCODING=b`), since a `.vcf` has no
`media/` root to reference. It is never the round-trip source: an importer that
recognizes the archive reads `contacts/`, not `vcards/`. Producing it is a
per-export toggle (P45-DB01's picker).

### 7.7 Recognition

Content-based, never the file extension (a renamed `.zip` still imports):

- **Bare document**: top-level `@type: "Card"` **and** a
  `getkontax.com:formatVersion` property.
- **Archive**: a `manifest.json` at the root carrying a
  `getkontax.com:formatVersion` string. That value is authoritative for the
  container; §7.5 requires every `contacts/*.json` to match it.

This mechanism does **not** depend on any product-facing name — see §8.

### 7.8 Streaming & limits (execution seam)

A 10 000-contact book with photos MUST NOT be assembled in memory. The
strategy the exporter (P45-04) implements against this spec:

1. **Single pass builds the plan, not the bytes.** Loading contacts and
   projecting Cards yields, per photo, its `sha256`, byte length, and media
   type — the manifest's `integrity` table and `counts` are fully known from
   this pass *without* holding photo bytes. So the manifest is finalized first,
   cheaply.
2. **Entries stream one at a time.** The zip writer emits `manifest.json`, then
   each `contacts/*.json` (small, serialized on demand), then each distinct
   `media/*` file whose bytes are pulled from object storage (MinIO) and piped
   straight into the zip stream — never all resident at once. The whole zip
   streams to its storage destination (the P45-DB01 `KontaxExportJob` +
   presigned-download seam), so peak memory is one photo plus zip buffers, not
   the archive.
3. **The job, not the request, owns large exports.** Bulk archives run through
   the async `KontaxExportJob` (cron-drainable), matching the GDPR
   data-export job; a synchronous single-/few-contact export MAY build in
   memory since the bound is small.

Limits, enforced by the exporter and stated so importers can budget:

| Bound | v1 value | Rationale |
| --- | --- | --- |
| Max contacts per archive | 100 000 | Ordinal width and job runtime; larger books split into multiple archives. |
| Max single media file | 25 MB | Matches the avatar upload ceiling; larger images are re-encoded upstream, never exported raw. |
| Compression | DEFLATE, level 6 | Photos are already compressed; the win is on JSON. |

An importer MAY reject an archive that exceeds a limit it can't budget for, with
a clear message — but MUST NOT silently import a truncated prefix.

## 8. Naming & recognition

Per [P45-DB01](../roadmap/build-phase/p45-db01-design-brief-export-format-surfaces.md)'s
recorded direction (2026-07-02): **no branded file extension.** Bare
documents are plain `.json`; archives are plain `.zip`. There is no
`"format": "kontax-contact"` marker string to finalize, because recognition
(§7.4) uses the vendor property + manifest key, not a marker field — this
supersedes the draft's placeholder `"format"` property, which is retired
rather than finalized.

What P45-DB01 still owns, unaffected by anything above: the **product name**
shown in export-picker UI copy ("Export as ___"), and whether the repo/spec
uses that same name or a separate neutral spec name. Either choice is a
label over an already-fixed technical contract.

## 9. Privacy & shared-book scoping (restates Phase 40, invents nothing)

Source: [phase-37/01 §3.2–§3.5](phase-37/01-data-model-build-now.md) (Phase
40's design spec — Phase 40's own tickets are not yet built at the time of
writing; P45-02 designs against the frozen spec per the phase-45 sequencing
note, not against shipped schema).

### 9.1 Mechanism

A contact's fields live in exactly one of two layers:

- **Shared layer** — the `Contact` row itself. Every book member with access
  sees this.
- **Private layer** — `ContactPrivateField` rows, one set per `(contact,
  owner)` pair. Only the owning member ever sees their own private values;
  other members see the shared layer only, with the private field simply
  absent (not shown redacted — absent).

There is no "this field is private" flag on a shared value; privacy is
*which table the value lives in*. This has one direct export consequence:

> **An export is a projection of what the exporting user can see, not an
> annotated dump.** The document format has **no property that marks a
> value as private** — a value the exporter can see (because they own it or
> it's shared) is exported exactly like a value that's shared by default.
> There is nothing to mark, because by the time a document exists, the
> per-layer origin is no longer meaningful — it's account-relative state
> that doesn't survive an export/import round-trip into a different
> account. (This restates the P45-01 §1.8 position; P45-02 makes it a
> normative rule rather than a note.)

### 9.2 Export field set by role

| Exporting user | What's included |
| --- | --- |
| Contact owner (private-field owner), exporting their own book | Shared-layer values **merged with** the owner's own `ContactPrivateField` values — indistinguishable in the output, exactly as the owner sees them in-app. |
| Non-owner member of a shared book | Shared-layer values only. The other member's private fields (and the exporting member's own private fields on a contact they don't own) never appear — because the read path never surfaces them, not because export filters them out after the fact. |
| Any exporter, any field whose effective sharing policy resolves to private (per `max(minimumSharingPolicy, sharingPolicy)`, phase-37/01 §5) | Same as above — a field currently private is a field currently in `ContactPrivateField`, so it's mechanically absent from a non-owner's read, not export-specific logic. |

**Implementation note (binding on P45-04):** the exporter MUST use the same
"owner-merged vs. member-base" read helper specified in
[P40-02](../roadmap/build-phase/p40-02-schema-contact-private-field.md)
("the read-path helper used by workspace, detail, export, and sync — one
function so every consumer applies the same visibility rule"). The export
format spec does not define its own privacy filter; there is exactly one
privacy decision point in the codebase, and the exporter calls it like every
other consumer.

### 9.3 What is *not* restated here

Policy *values* (which field types default private/shared, the
`minimumSharingPolicy` Teams-floor mechanics) live entirely in Phase 40's
spec and P40-03's implementation — P45-02 does not duplicate or
re-derive them, only the export-time consequence above.

## 10. Open items closed by this ticket

Resolved (from P45-01 §"Open items handed to P45-02"):

1. Vendor prefix: `getkontax.com` (§2). Marker string: retired in favor of
   the vendor-property recognition mechanism (§8) — there is no separate
   string to finalize.
2. F1 media-reference convention: relative reference in archives, `data:`
   URI in bare documents (§3.6).
3. F5 phone `number` policy: free-text, with `"getkontax.com:e164"` as the
   companion canonical form (§3.4).
4. Label registry placement: per-document vendor property now; archive
   manifest-level dedup is a SHOULD, not a MUST — now specified in §7.2 and
   emitted into the manifest by P45-03's exporter (§3.5).
5. Shared-book export field set: §9.

## Appendix: worked example

```json
{
  "@type": "Card",
  "version": "1.0",
  "uid": "8f14e45f-ceea-467e-9a19-2c6a7e5e6f01",
  "created": "2025-11-03T09:12:00Z",
  "updated": "2026-06-28T17:45:00Z",
  "prodId": "kontax/1.0",
  "getkontax.com:formatVersion": "1.0",
  "getkontax.com:exportedAt": "2026-07-03T14:30:00Z",

  "name": {
    "full": "Dr. Amelia Rowe-Nguyen",
    "components": [
      { "kind": "title", "value": "Dr." },
      { "kind": "given", "value": "Amelia" },
      { "kind": "surname", "value": "Rowe-Nguyen" }
    ]
  },
  "nicknames": { "k1": { "name": "Mel" } },

  "organizations": {
    "o1": { "name": "Vexon Health", "units": ["Research"], "getkontax.com:phoneticCompany": null }
  },
  "titles": { "t1": { "name": "Clinical Lead", "organizationId": "o1" } },

  "emails": {
    "e1": { "address": "amelia@vexonhealth.example", "contexts": { "work": true }, "pref": 1 }
  },
  "phones": {
    "p1": {
      "number": "+61 412 345 678",
      "features": { "mobile": true },
      "pref": 1,
      "getkontax.com:e164": "+61412345678",
      "getkontax.com:countryCode": "AU"
    }
  },
  "addresses": {
    "a1": {
      "contexts": { "private": true },
      "components": [
        { "kind": "name", "value": "12 Harbour Lane" },
        { "kind": "locality", "value": "Sydney" },
        { "kind": "region", "value": "NSW" },
        { "kind": "postcode", "value": "2000" },
        { "kind": "country", "value": "Australia" }
      ]
    }
  },
  "links": { "w1": { "uri": "https://vexonhealth.example", "label": "Company" } },

  "anniversaries": {
    "d1": { "kind": "birth", "date": { "@type": "PartialDate", "year": 1988, "month": 4, "day": 12 } },
    "d2": { "kind": "wedding", "date": { "@type": "PartialDate", "month": 6, "day": 30 } }
  },
  "getkontax.com:relatedPeople": {
    "r1": { "label": "Spouse", "value": "Kim Rowe-Nguyen" }
  },

  "keywords": { "Clients": true },
  "getkontax.com:labels": { "l1": { "name": "Clients", "color": "#4158f4" } },
  "getkontax.com:books": ["Work"],

  "getkontax.com:customFields": [
    { "label": "Client ID", "value": "VX-2201" }
  ],

  "notes": "Prefers email. Met at HealthTech 2025.",
  "getkontax.com:favorite": true,

  "media": {
    "m1": {
      "kind": "photo",
      "uri": "media/3fa4c2....jpg",
      "mediaType": "image/jpeg",
      "getkontax.com:sha256": "3fa4c2....",
      "getkontax.com:width": 1024,
      "getkontax.com:height": 1024
    }
  },

  "getkontax.com:source": { "origin": "IMPORT", "originDetail": "google-csv" }
}
```

## Relationship to import / other tickets

Unchanged from the draft: the importer ([P45-05](../roadmap/build-phase/p45-05-importer.md))
accepts both serializations and must round-trip losslessly per §1. The
archive container is specified in §7, hardened by
[P45-03](../roadmap/build-phase/p45-03-archive-container-spec.md) (manifest,
media dedup, integrity checksums, streaming, limits). The
[contact JSON Schema](schemas/kontax-contact.v1.schema.json) is the
machine-checkable form of §2–§6, and the
[archive manifest JSON Schema](schemas/kontax-archive.v1.schema.json) the form
of §7.2. A committed worked-example archive
([tests/fixtures/kontax-archive/example.zip](../tests/fixtures/kontax-archive/example.zip))
validates against both and round-trips through the importer (§7.8 acceptance).

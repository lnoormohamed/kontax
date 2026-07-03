# P45-01 — Format Research: JSContact Fit, Lossless Field Audit

## Status

**COMPLETE** (2026-07-02). Decision recorded in §4: **adopt JSContact
(RFC 9553) as the base format**, with vendor extensions for the Kontax-specific
model. Greenfield JSON is rejected. Inputs to P45-02.

## Purpose

Two deliverables (per [phase-45](phase-45-open-export-format.md)):

1. **Field audit** — enumerate everything a Kontax contact can carry and mark
   each field must-export / optional / never.
2. **JSContact gap analysis** — map the audit onto RFC 9553; identify native
   fits, extension-property needs, and genuine misfits. Record the
   JSContact-vs-greenfield decision.

Sources: `prisma/schema.prisma` (Contact, Label, AddressBook, GroupContact),
entry shapes in `contact-multi-value.tsx` and `phone-normalization.ts`, the
Phase 40 model design ([phase-37/01-data-model-build-now.md](../phase-37/01-data-model-build-now.md)),
the [developer draft](../../docs/contact-export-format-draft.md), and
RFC 9553 / RFC 9555 (verified against the published RFC text, section
references below).

---

## 1. Field audit

Classification:
- **must** — user-visible contact data; the format is lossy without it.
- **optional** — exported when present; importers must tolerate absence.
- **never** — operational/internal; excluded by design (an export must be
  importable into *any* account, including a different user's).

### 1.1 Name & identity

| Field (schema) | Class | Notes |
| --- | --- | --- |
| `fullName` | must | Display name; always present. |
| `firstName`, `middleName`, `lastName` | must | |
| `namePrefix`, `nameSuffix` | must | |
| `nickname` | must | |
| `phoneticFirstName`, `phoneticLastName` | must | See §2 friction F2. |

### 1.2 Organization

| Field | Class | Notes |
| --- | --- | --- |
| `company`, `jobTitle`, `department` | must | |
| `phoneticCompany` | must | No JSContact slot — extension (§2). |

### 1.3 Multi-value entries

Current columns: `emailEntries`, `phoneEntries`, `websiteEntries`,
`addressEntries`, `significantDates`, `relatedPeople` (the `ENTRY_GROUPS` map
in `actions/contacts.ts`). Legacy columns `emailAddresses`, `phoneNumbers`,
`postalAddresses` and the scalar fallbacks (`email`, `phone`, `website`,
`address`, `birthday`) are **not distinct exportables** — the exporter projects
the effective entry list (entries column, falling back to scalar), same as the
Google-sync mapping does. Legacy columns themselves: **never**.

| Entry group / property | Class | Notes |
| --- | --- | --- |
| `emailEntries[]` `{label, value, isPrimary}` | must | Free-string labels round-trip as-is. |
| `phoneEntries[].label/value/isPrimary` | must | |
| `phoneEntries[].e164/countryCode/extension/numberType` | optional | Phase 37 enrichment; importers re-derive when absent. |
| `phoneEntries[].rawInput/national/callingCode/display*/validationStatus/source` | never | Derivable or internal bookkeeping. |
| `websiteEntries[]` `{label, value}` | must | |
| `addressEntries[]` `{label, street, city, state, postcode, country}` | must | Structured; see friction F3 (labels). |
| `significantDates[]` `{label, value, isPrimary}` | must | Birthday + arbitrary labeled dates ("Anniversary", "Lunar birthday", custom). Year-less dates must survive. |
| `relatedPeople[]` `{label, value}` | must | Free-text person names, labels incl. "Partner". See friction F4. |

### 1.4 Labels, books, flags, notes

| Field | Class | Notes |
| --- | --- | --- |
| `labels` (names on contact) | must | Membership is per-contact. |
| Label registry (`Label.name/color`) | must | Color + name so a fresh account recreates the registry (P31B). `Label.position` optional. `Label.id/userId`: never. |
| Book membership | must | Exported as **names**, array-shaped from day one for the Phase 40 `ContactBookMembership` multi-book model. `AddressBook` operational fields (`slug`, `deviceWritable`, `sourceBookIds`, `isDefault`, …): never. `AddressBook.description`: optional (archive manifest level, P45-03). |
| `notes` | must | |
| `isFavorite`, `isEmergency` | must | |

### 1.5 Photo

| Field | Class | Notes |
| --- | --- | --- |
| Avatar image bytes | must | The headline fix of Phase 45 — photos are currently not exported at all. By-reference in the archive (`media/<sha256>`), byte-identical round-trip. `avatarUrl` itself (a storage URL): never — the URL is infrastructure, the image is the datum. |

### 1.6 Provenance

| Field | Class | Notes |
| --- | --- | --- |
| `createdAt`, `updatedAt` | must | Native JSContact `created`/`updated`. |
| `sourceType`, `sourceDetail` | optional | Origin only ("IMPORT" / "google-csv"), per the draft position. |
| `lastMutatedBy`, `lastMutatedByDetail` | never | Operational sync bookkeeping. |
| Activity events / summaries | never | **Decision (draft open question 2 confirmed):** activity is account data, not contact data. Origin fields above are the full provenance surface. |

### 1.7 Excluded by design (never) — the full list

Internal identifiers (`id`, `userId`, `bookId`, `importJobId`, cuids of any
kind); sync state (`syncUid`, `syncVersion`, `syncTombstoneAt`,
`SyncContactLink`, `SyncConflict`); merge lineage (`mergedIntoContactId`,
suggestions/decisions/dismissals); reminder state
(`reminderLeadDaysOverride`, `BirthdayReminderState`); share plumbing
(`ContactShare`); `archivedAt` (exports cover live contacts; an
archived-contacts export is a product question, not a format one);
`searchVector` (derived).

### 1.8 Privacy & shared-book rules (Phase 40 forward-design)

- **Private layer** (`ContactPrivateField`, P37 Part 1): private-field values
  export **only in the owner's own export**, merged into the document
  indistinguishably from shared-layer values. A non-owner member's export of a
  shared-book contact contains the shared layer only. The format does **not**
  mark which layer a value came from — exports are projections of what the
  exporting user can see, and layer membership is account-relative state.
- **Shared-book contacts** (`GroupContact`) carry the same field surface and
  audit classes; the *field set* a member's export may include is Phase 40
  sharing-policy territory and is restated (not invented) by P45-02.

---

## 2. JSContact (RFC 9553) gap analysis

Verified against the RFC text. Three headline properties of RFC 9553 make it a
strong base:

- **Extensions are first-class and go anywhere** (§1.8.1): vendor properties
  use a domain-prefixed name (`example.com:foo`) and "MAY be set in any
  JSContact object" — inside an Address or Phone, not just at Card top level.
  Enum values can be vendor-extended the same way (§1.8.2).
- **Preservation is mandatory** (§1.7.4/§1.7.5): readers MUST *preserve*
  unknown registered/vendor properties — stronger than our draft's "consumers
  ignore unknown properties", and exactly the additive-versioning contract we
  wanted.
- **vCard interop is already specified** (RFC 9555): X-props round-trip into
  `vCardProps`/`vCardParams`; vendor JSContact properties map to vCard via
  `JSPROP`+`JSPTR`. Our phase-37/04 guardrail (documented vCard mapping for
  every field) gets standards scaffolding for free — though P45-02 should
  still define human-readable `X-KONTAX-*` mappings for the fields that
  matter, since `JSPROP` blobs are lossless but not legible to Apple/Google
  importers.

### 2.1 Mapping table

| Kontax field | JSContact (RFC 9553) | Fit |
| --- | --- | --- |
| `fullName` | `name.full` | native |
| first/middle/last, prefix/suffix | `name.components` kinds `given`, `given2`, `surname`, `title`, `credential` (§2.2.1) | native |
| `nickname` | `nicknames` | native |
| phonetic first/last | per-component `phonetic` | **friction F2** |
| `company`, `department` | `organizations` (name + `units`) | native |
| `jobTitle` | `titles` (kind `title`, linked via `organizationId`) | native |
| `phoneticCompany` | — (no org phonetics, §2.2.3) | **extension** |
| emails | `emails`: `address`, `label`, `pref` (`isPrimary` → `pref: 1`) | native |
| phones | `phones`: `number` (tel URI; `;ext=` for extensions), `features` (`numberType` → `mobile`/…), `label`, `pref` | native; see F5 |
| addresses | `addresses.components` kinds `number`/`name`/`locality`/`region`/`postcode`/`country` (§2.5.1.2); Home/Work → `contexts` | **friction F3** (custom labels) |
| websites | `links` with `label` | native |
| significant dates | `anniversaries`: kinds `birth`/`wedding` + vendor kinds; free-text `label`; `PartialDate` supports year-less month+day and even `calendarScale` (lunar!) (§2.8.1) | native |
| related people | `relatedTo` — but keyed by **uid of another Card**, not free text (§2.1.8); "Partner" not in the relation enum | **friction F4 → extension** |
| labels (names) | `keywords` (`String[Boolean]`, §2.8.2) | native |
| label colors/registry | — | **extension** (archive manifest carries the registry; bare document carries a vendor property — P45-02/03 decide the split) |
| custom fields | — | **extension** (ordered `{label, value}` array) |
| `notes` | `notes` | native |
| `isFavorite`, `isEmergency` | — | **extension** |
| photo | `media` kind `photo` (`uri`, `mediaType`) | **friction F1** (URI + hash/dimensions) |
| `createdAt`/`updatedAt` | `created`/`updated` (§2.1.3/§2.1.10) | native |
| source origin | `prodId` for the exporter; origin/detail | **extension** |
| books | — | **extension** |
| format envelope | `version: "1.0"` is JSContact's version (§2.1.2); the Kontax format/spec version rides a vendor property | native + extension |

### 2.2 Frictions (all resolvable, none blocking)

- **F1 — media URI + integrity.** `Media.uri` must be an RFC 3986 URI —
  a bare relative path (`media/3fa4….jpg`) is not one, and there is no native
  slot for content hash or dimensions. Resolution: vendor properties *inside*
  the Media object (allowed per §1.8.1) for `sha256`/`width`/`height`, and
  either a relative-reference convention documented for the archive wrapper or
  a vendor ref property; the bare-document serialization may use a `data:` URI
  (which is a valid URI). P45-02/03 pick the exact convention.
- **F2 — phonetic names.** A component `phonetic` requires `phoneticSystem`
  or `phoneticScript` on the Name object (§2.2.1), and the registered systems
  are `ipa`/`jyut`/`piny`. Kontax stores free-form phonetic strings with no
  system. Resolution: derive `phoneticScript` from the Unicode script of the
  stored string (cheap and honest), or fall back to a vendor property.
  P45-02 decides; either preserves the value losslessly.
- **F3 — address labels.** `Address` has **no** free-text `label` property
  (verified §2.5.1.1). "Home"/"Work" map to `contexts`; custom labels
  ("Holiday house") need a vendor property inside the Address object.
- **F4 — related people.** `relatedTo` keys are Card uids; Kontax stores
  free-text names of people who may not be contacts. And "Partner" is not a
  registered relation value. Resolution: keep related people in a vendor
  property mirroring our `{label, value}` shape. Do not contort `relatedTo`.
- **F5 — phone display vs canonical.** `Phone.number` is one slot (URI or
  free text). Exporting `tel:`+E.164 (with `;ext=`) is canonical but loses the
  user's typed formatting; exporting free text loses nothing but pushes
  E.164 to a vendor property. P45-02 decides; both are lossless with one
  vendor property.
- **F6 — mandatory `uid`.** JSContact requires `uid` (§2.1.9), but our
  excluded-by-design list bans internal ids. Resolution: mint a random UUID at
  export time — stable across contacts *within* one export (media/manifest
  cross-references), meaningless across exports. Not our `syncUid`, not a
  cuid.

### 2.3 What genuinely doesn't fit

Nothing. Every audited field is either native or a sanctioned vendor
extension; the extension mechanism is expressive enough (any object, any
depth, vendor enum values) that no field forces a schema outside the Card.

---

## 3. Extension property inventory (input to P45-02)

One vendor prefix, one namespace. The prefix must be a domain we control
(§1.8.1 requirement) — actual string is a P45-DB01/P45-02 naming decision
(vendor-neutral spec name vs `getkontax.com:`). Working set:

`…:books`, `…:labels` (name+color when the registry can't ride a manifest),
`…:customFields`, `…:relatedPeople`, `…:favorite`, `…:emergency`,
`…:phoneticCompany`, `…:source` (origin/originDetail), `…:formatVersion`,
plus in-object extensions: address `…:label`, media `…:sha256`/`…:width`/
`…:height`, phone `…:e164` (if F5 resolves to free-text numbers).

Ten-ish top-level extensions against ~20 native properties — a healthy ratio;
the model is mostly standard, and the Kontax-specific parts (books, labels,
layers) are exactly what the phase-37/04 exploration expected to be extension
territory.

---

## 4. Decision

**JSContact (RFC 9553) is the base. The contact document is a JSContact
`Card` (version `"1.0"`) plus vendor-prefixed Kontax extensions. Greenfield
JSON is rejected.**

Rationale:
1. **Coverage** — §2 shows full lossless coverage: mostly native, the rest via
   the RFC's own extension mechanism, zero misfits.
2. **The forward-compat contract is better than ours** — MUST-preserve
   (§1.7.4) beats "ignore unknown"; our additive-versioning principle maps
   directly onto it.
3. **The vCard guardrail gets cheaper** — RFC 9555 defines the interop frame;
   P45-02 writes the human-readable `X-KONTAX-*` table on top rather than
   inventing the whole mapping discipline.
4. **"Open" is credible on day one** — "JSContact + documented extensions"
   is a defensible public spec; a bespoke format with a superficial
   resemblance to JSContact would invite the fair question "why not just use
   the RFC?".
5. **Cost** — the draft's structure survives; only property names change
   (`emails[].value` → `emails.<id>.address`, arrays → RFC-style keyed maps
   where the RFC uses them). The archive layout, media-by-reference, manifest,
   and versioning sections of the draft carry over untouched.

What the decision does **not** change: the archive container (P45-03) stays
ours — JSContact specifies the document, not the packaging. `manifest.json`,
`contacts/`, `media/`, optional `vcards/` proceed as drafted.

### Consequences for the draft / P45-02

- Rewrite the draft's document example in Card vocabulary (keyed maps with
  Id keys, `@type` members, `PartialDate` for dates, `pref` for primary).
- `formatVersion` becomes the *Kontax extension-set* version riding a vendor
  property; Card `version` stays `"1.0"`. Two version fields, two meanings —
  the spec must say so explicitly.
- Media type: `application/jscontact+json` applies to a bare Card; whether we
  also register/claim a vendor suffix is a P45-DB01/06 naming decision.
- Resolve F1–F6 (each has a preferred resolution recorded above).
- The `"format": "kontax-contact"` recognition marker from the draft becomes a
  vendor property; importers detect bare documents by `@type: Card` + our
  vendor property, archives by `manifest.json`.

## Open items handed to P45-02

1. Exact vendor prefix string (with P45-DB01 naming).
2. F1 media-reference convention (relative-ref rule vs vendor ref property).
3. F5 phone `number` policy (tel URI vs free text + `…:e164`).
4. Label registry placement: manifest vs per-document vendor property (both?).
5. Shared-book export field set — restate Phase 40 policy once P37 Part 1
   shapes are frozen (design against them now, per phase sequencing notes).

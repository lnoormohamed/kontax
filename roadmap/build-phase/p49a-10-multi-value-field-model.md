# P49A-10 — One source of truth for emails, phones and addresses

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** M · **Status:** Done (2026-09-27, branch `p49a-10`; not yet deployed)
**Audit IDs:** A-14 (high), A-19

## Objective
A contact's multi-value fields must be read and written from one canonical representation, so no
writer or reader can lose values the other one stored.

## Production verification (2026-09-25)
- Confirmed in origin/main: the CSV import commit (`api/imports/contacts/commit/route.ts:160-180`)
  writes only the legacy `emailAddresses`/`phoneNumbers` JSON; the web editor reads the typed
  `emailEntries`/`phoneEntries` (`contacts/[id]/page.tsx:621`) and `saveContact` rewrites both from
  what the editor showed (`actions/contacts.ts:406`); the DAV server reads/writes yet another mix
  (`server.mjs:905-1110`).
- Consequence: a CSV contact's 2nd/3rd emails are invisible in the editor and deleted on first
  save; a phone added on the web may not reach devices.
- Prod data check (read-only): 0 contacts, so 0 mismatched rows today. The same query
  (legacy array longer than typed entries) is the migration's verification query.
- A-19: inbound sync writes empty remote lists as "no change"
  (`sync-contact-mapping.ts:59-75`, `sync-runner.ts:349-362`), so remote deletions never clear.

## Steps
1. Make `*Entries` (typed, labelled) canonical. Add one module that derives the legacy arrays and
   the single `email`/`phone`/`address` columns from entries; every writer (web, API, CSV,
   vCard/Kontax import, DAV, Google/Outlook/CardDAV sync, merge) goes through it.
2. Backfill migration: for rows where legacy has values missing from entries, append them as
   entries (label "other"). Run on staging first; prod has no rows today.
3. Readers use entries only. Later (P49A-18) drop the legacy columns.
4. Inbound sync: distinguish "field absent / unsupported by provider" from "field present and
   empty" (use the link's capability profile) so remote deletions clear locally.

## Acceptance
- Test: CSV with three emails → editor shows three; editing the name keeps all three; device GET
  returns three.
- Test: removing a phone on Google clears it in Kontax.
- Migration verification query returns 0 on staging after backfill.

## Resolution (2026-09-27)

### The canonical model
- **Module:** `src/server/dav/contact-multi-values.mjs` — plain ESM with JSDoc types (it lives
  under `src/server/dav/` because the production image ships only that directory next to
  `server.mjs`, the same arrangement as `plan-entitlements.mjs`). The Next app imports it through
  the Prisma-typed wrapper `src/server/contact-multi-values.ts`.
- **Canonical:** `emailEntries`, `phoneEntries`, `addressEntries`, `websiteEntries`
  (`[{ label, value | formatted, isPrimary, ...metadata }]`; phone `e164` etc. is carried through).
- **Derived, never written on their own:** `email`/`emailAddresses`, `phone`/`phoneNumbers`
  (`e164` when the entry has one, as the web form always wrote), `address`/`postalAddresses`,
  `website`. Scalar = the primary entry (first `isPrimary`, else the first entry); arrays = each
  distinct value in entry order; an empty family is written as SQL NULL (`Prisma.DbNull`).
- **Write API:** `multiValueWriteData(entries)` (a family passed as `undefined` is left untouched,
  `[]` clears it), `copyMultiValueWriteData(source)` (copy a contact-shaped row/snapshot),
  `snapshotMultiValueWriteData(snapshot)` (only the families a remote/conflict snapshot carries),
  `restoreMultiValueWriteData(snapshot)` (merge undo: entries reconciled with legacy values).
  The `.mjs` layer exposes the same as `buildMultiValueWriteData(input, { jsonNull })` etc.
- **Read API:** `readMultiValueEntries(row)` (typed entries; legacy columns only while a family's
  entries are empty — a row the backfill has not reached), `readMultiValueFields(row)` (entries +
  legacy keys re-derived from them), `withDerivedLegacyFields(row)` / `readDerivedLegacyFields(row)`
  for exports built from flat values (output unchanged, data from the entries),
  `reconcileLegacyIntoEntries(row)` (the backfill rule in JS).

### Writers converted
Web: `saveContact` form (`actions/contacts.ts` parseContactInput → create/update; an emptied
family now clears), inline `updateContactEntries` (legacy arrays used to go stale) and
`updateContactField` for email/phone/address/website (rewrites the primary entry instead of the
scalar alone). Imports: CSV commit route and in-app CSV action (A-14), Kontax archive import.
REST API v1 create/PATCH. Kontax CardDAV server PUT (`vcard.mjs` `buildDavContactWriteData`,
used by every PUT in `server.mjs`). Sync: Google/Outlook inbound (`sync-contact-mapping.ts`
`mappedContactToWriteData`), CardDAV client create + remote apply (`sync-runner.ts`), conflict
resolution keep-remote / duplicate-local / manual-merge / policy switch (`actions/sync.ts`).
Merge + undo (`contact-merge.ts`). Shares (static/live snapshot, accept, live propagation),
add-to-family/team book, family kept-copy.

### Readers converted
Contact page editor, REST API responses, DAV GET serializer, conflict local snapshot, Google /
Outlook / CardDAV push sources and supported-field shadows, merge preview, CSV / vCard / share-link
/ single-contact exports, GDPR data export, Kontax archive export, print view, public card phones.
The scalar `email`/`phone` columns stay readable for list views, search and indexes — they are
always derived now.

### A-19 — inbound deletions (see also "Fable review fixes" below: clearing also needs shadow evidence)
- Capability profiles gain `fields.emails|phones|addresses|websites: "full" | "partial"`
  (`sync-provider-capabilities.ts`, `providerListIsAuthoritative`). `"full"` = Kontax pushes the
  family and the provider returns it on every read, so an empty inbound list is a deletion and
  clears the local list. `"partial"` = an empty inbound list is not evidence (Outlook addresses:
  the Graph push never sends them). Google, Outlook (except addresses) and all CardDAV profiles are
  `"full"`. Google omits an empty requested personField entirely, which therefore reads as empty.
- `MappedContact.omittedFamilies` marks families a payload did not carry at all (Outlook JSON with
  none of the family's keys); those are never written, and are nulled on the shadow side.
- CardDAV client: a remote card carries every family, so an emptied `TEL` clears locally.
- Non-empty inbound lists apply exactly as before. relatedPeople / customFields are unchanged
  (still never cleared — they hold local-only values no provider returns).

### Migration
`prisma/migrations/20260927090000_p49a_10_backfill_multi_value_entries/migration.sql`
- **Data-only — no schema change** (UPDATE statements only; no DDL). `KONTAX_SCHEMA_MODE=validate`
  will nonetheless refuse to boot while it is *pending*, so **production must have it applied
  (out of band, `npm run db:migrate`) before the P49A-10 image boots.** Prod has 0 contacts, so it
  updates nothing there; staging first as the ticket says.
- Idempotent: step 1 appends every legacy value missing from the entries (label `"other"`; a postal
  address keeps its own label; phones match on `e164` and digits/`+` only; primary only when the
  family had no entries) and bumps `syncVersion` + `updatedAt` so devices re-download; step 2
  re-derives the legacy columns from the entries. A second run updates 0 rows.
- Checked on a throwaway local Postgres 17 cluster (never a real DB; re-checked after the Fable
  review fixes with 12 rows, see below): all migrations applied, 8
  fixture rows (CSV legacy-only, legacy extra, e164 phone, stale legacy, web-editor address,
  already-clean, JSON-null entries, scalar-only edit) matched the JS twin
  `reconcileLegacyIntoEntries` + `deriveMultiValueFields` field for field; re-run → `UPDATE 0` ×8.
- **Verification query** (must return 0 after the backfill; it returned 0 on the scratch cluster):

```sql
SELECT count(*) FROM "Contact"
 WHERE jsonb_array_length(CASE WHEN jsonb_typeof("emailAddresses") = 'array' THEN "emailAddresses" ELSE '[]' END)
     > jsonb_array_length(CASE WHEN jsonb_typeof("emailEntries") = 'array' THEN "emailEntries" ELSE '[]' END)
    OR jsonb_array_length(CASE WHEN jsonb_typeof("phoneNumbers") = 'array' THEN "phoneNumbers" ELSE '[]' END)
     > jsonb_array_length(CASE WHEN jsonb_typeof("phoneEntries") = 'array' THEN "phoneEntries" ELSE '[]' END)
    OR jsonb_array_length(CASE WHEN jsonb_typeof("postalAddresses") = 'array' THEN "postalAddresses" ELSE '[]' END)
     > jsonb_array_length(CASE WHEN jsonb_typeof("addressEntries") = 'array' THEN "addressEntries" ELSE '[]' END);
```

### Tests
`tests/node/contact-multi-values.test.ts` (module rules; CSV with three emails → three entries,
legacy derived; mobile-sheet save and inline editor keep all three; DAV GET returns three;
inline primary-email edit; emptied family clears) and `tests/node/sync-multi-value-deletions.test.ts`
(phone removed on Google clears; Outlook family not returned / not round-tripped is left alone).

### Fable review fixes (2026-09-27)
1. **HIGH — an empty remote list could delete values Kontax never pushed.** Non-MANUAL local edits
   (Kontax CardDAV PUT, REST API) are anchored without a push (A-17), so the next unrelated remote
   edit cleared them — on the device too. An empty inbound list is now a deletion only when the
   family is authoritative in the capability profile **and** the link's stored
   `supportedFieldShadow` shows the provider held values for it at the last sync
   (`clearableInboundFamilies`, `sync-contact-mapping.ts`); no shadow = no evidence = nothing
   cleared. Threaded through `mappedContactToWriteData(m, profile, previousShadow)`,
   `applyRemoteToContact(..., previousShadow)` (engine update paths and the Google / Outlook
   SERVER_WINS stale-etag paths — Outlook push links now select the shadow) and the CardDAV
   runner's remote apply (`buildContactWriteDataFromRemoteSnapshot(..., previousShadow)`).
   Remaining limitation: if the provider held a family and then emptied it, a value added locally
   and not yet pushed in between is cleared with it (a non-empty remote list replaced it before
   P49A-10 anyway); A-17 in P49A-12 closes that by pushing non-MANUAL edits.
2. **MEDIUM — inline primary-phone edit kept the old number's metadata.** `replacePrimaryEntry`
   (`actions/contacts.ts`) now keeps only the label when the value changes: phones are rebuilt
   with `buildNormalizedPhoneEntries` (fresh `e164`, `national`, `validationStatus`, …), other
   families drop stale metadata / structured address components.
3. **LOW — migration primacy order.** Step 2 orders by `coalesce(isPrimary = true, false) DESC`
   (a missing flag no longer sorts first) and dedupes entries on label + value first, exactly as
   `normalizeValueEntries` + `primaryEntryOf`; address component fallbacks treat `""` like the JS
   `||` (e.g. empty `streetLine1` → `street`).
4. **LOW — migration cost.** Every correlated subquery was replaced by joins / GROUP BY
   aggregates (`(array_agg(value ORDER BY is_primary DESC, ord))[1]`, `jsonb_agg(... ORDER BY
   ord)`), so step 1 and step 2 are linear in contacts + entries. Edited in place (never applied).
   Re-run on a fresh throwaway Postgres 17 cluster with 12 fixture rows (the 8 before plus mixed
   primacy flags, empty `streetLine1`, duplicate label+value with the later copy flagged, website
   primary out of date): run 1 matched the JS twin field for field ("ALL MATCH"), run 2 → `UPDATE 0`
   ×8, verification query → 0, no SubPlan in the step-2 plan. Cluster deleted afterwards.
5. **LOW — snapshot applies.** `snapshotMultiValueWriteData(snapshot, clearable)` now requires
   the families an empty list may clear: the CardDAV runner passes the shadow-evidence set; the
   explicit keep-remote resolution (`actions/sync.ts` `buildContactWriteDataFromRemoteSnapshot`
   only) passes the profile's authoritative families, so Outlook addresses ("partial") are never
   cleared. `familiesPresentIn` counts only an entries array, a string scalar or a legacy array in
   Kontax's shape — null keys (P39-03 exclusions) and Google's raw `emailAddresses` /
   `phoneNumbers` object arrays are not carried families.

Tests added: unpushed non-MANUAL phone survives an unrelated Google edit (full run, no conflict);
empty list without shadow evidence / with a legacy-only shadow; inline phone edit recomputes
`e164` and the derived `phoneNumbers`; snapshot clearable / carried-family rules; `familiesHeldBy`.
A mutation check (dropping the shadow condition) makes the two A-19 tests fail.

### Not done / deferred
- Dropping the legacy columns: P49A-18.
- Outbound A-19 (Microsoft PATCH never sends `null` for an emptied family): not part of this ticket.
- Dev seed / QA scripts under `scripts/` still write both representations by hand; they never run
  in production and the migration reconciles anything they write.
- A contact whose scalar was set alone by the old inline scalar edit keeps that value as an extra
  `"other"` entry; the scalar is then re-derived from the primary entry (the value the editor
  already showed).
- Not verifiable without a DB: the real Prisma write of `Prisma.DbNull` into the Json columns and
  the migration on staging data (run it there first, then the verification query).


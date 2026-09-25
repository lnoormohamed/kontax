# P49A-10 — One source of truth for emails, phones and addresses

**Phase:** 49A · **Priority:** P0 · **Depends on:** — · **Effort:** M
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

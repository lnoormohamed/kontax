# P48-11 — Import/export hardening: archive content types, zip bounds, CSV caps, formula injection, iCal CRLF, error passthrough

**Phase:** 48 · **Workstream:** E · **Priority:** P1 · **Depends on:** —
**Audit severity:** Medium (×3) + Low (×3)

## Objective

Bound and sanitise every user-controlled byte that enters through imports and
leaves through exports.

## Context and steps

1. **Archive import stores attacker-chosen content types on the public media
   host (Medium).** `src/server/export-format/parse.ts:214-218` accepts
   `data:<anything>;base64,` and keeps the string as `mediaType`;
   `export-format/import.ts:53-60,78-79` uploads raw bytes with
   `ContentType: mediaType` (no `normalizeContactPhoto`), key extension
   defaulting to `.jpg`. `data:text/html;base64,…` or `image/svg+xml` becomes
   a public object served as HTML/SVG on `media.getkontax.com` (stored XSS /
   phishing on the media origin).
   → Allowlist `mediaType` to the `EXT_MAP` raster keys; run every photo
   through `normalizeContactPhoto` (sharp re-encode, as `/api/upload/avatar`
   does); set `Content-Disposition: inline` only for the allowlisted types.
   Also set a bucket-level policy note in P48-15/P47-02 that the media host
   must never serve `text/html`.
2. **Unbounded zip decompression (Medium).** `parse.ts:460,486,504` call
   `entry.getData()` with no per-entry uncompressed-size cap; the routes
   buffer up to 512 MB (`kontax/commit/route.ts:15,35`, `preview/route.ts:9,28`).
   A small zip declaring a 4 GB entry OOMs the process (adm-zip advisory
   GHSA-xcpc-8h2w-3j85; zip-slip is not reachable since `extractAllTo` is
   unused).
   → Check `entry.header.size` against a cap (e.g. 20 MB per entry, 200 MB
   total) before `getData()`; lower route `MAX_BYTES` to 64 MB; reject
   entry counts over a sane limit. Upgrade adm-zip in P48-12.
3. **CSV formula injection (Medium).** `src/server/contact-portability.ts:524-530
   escapeCsv` quotes `" , \n` only; `sync/deletion-hold-export/route.ts:11-12`
   likewise. Names flow in from shares, family/team books, sync and imports.
   → Prefix cells starting with `= + - @ \t \r` with `'` (or a tab), in one
   shared `escapeCsvCell`.
4. **Unbounded CSV import bodies (Low).** `imports/contacts/preview|commit`
   `csvText: z.string().min(1)` has no `.max()`; `parseCsvContacts` has no
   row cap; `assertCanImportContacts` runs after the full parse
   (`commit/route.ts:100`). `import-export.ts:29-46` same.
   → `.max(10_000_000)`, row cap (e.g. 50 000), quota check first.
5. **iCal CRLF injection (Low).** `src/server/ical.ts:23-24 escapeICalText`
   does not strip `\r\n`; a synced name injects properties into subscribers'
   calendars. `calendar/birthdays.ics/route.ts:44` caches without `private`.
   → Strip/escape CR and LF; `Cache-Control: private, max-age=3600`.
6. **Internal error passthrough (Low).** `exports/contacts/vcard/route.ts:125-126`
   returns `error.message` with 403 for any exception; `imports/contacts/commit:196`,
   `preview:133`, `kontax/commit:93`, `merge-suggestions/dismiss:33` pass
   messages through; `sync/[accountId]/books:104-109` echoes upstream text.
   → Return fixed error codes; log the detail server-side.
7. **Image proxy pixel bomb (Low).** `api/image-proxy` → sharp with default
   `limitInputPixels`. → `sharp(body, { limitInputPixels: 25e6 })` and a
   global concurrency semaphore (e.g. 4).

## Acceptance

- Importing an archive with a `data:text/html;base64,…` photo either rejects
  the photo or stores a re-encoded JPEG/WebP with an image content type; the
  media host never returns `text/html`.
- A zip with a 4 GB-declared entry is rejected before allocation; process RSS
  stays flat.
- Exporting a contact named `=HYPERLINK("http://x")` yields a CSV cell that
  opens as text in Excel and LibreOffice.
- A 20 MB CSV body → 413; a 60 000-row CSV → rejected with a clear message.
- A contact name containing `\r\nX-EVIL:1` produces a valid ICS with no
  injected property.
- No route returns `error.message` from an unexpected exception.
- Tests for `escapeCsvCell`, `escapeICalText`, the mediaType allowlist and the
  zip size gate.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [x] External · users — in-app Help (import size limits)
- [x] External · developers — /developers (archive photo media types; limits)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [ ] Internal · engineering — docs/

## References

- Audit report §Medium "Archive import…", "CSV formula injection"; §Low input/iCal/error items
- `src/server/export-format/{parse,import}.ts`, `src/server/contact-portability.ts`, `src/server/ical.ts`, `src/app/api/imports/**`, `src/app/api/exports/**`, `src/app/api/image-proxy/route.ts`
- P45 (open export format), P29 (imports)

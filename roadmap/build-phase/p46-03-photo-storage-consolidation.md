# P46-03 — Photo storage consolidation (optimize-on-upload, no raw original, cleanup)

Status: **Built + verified on staging 2026-07-04** (backfill live run still pending) · Priority: P1 · Depends: [P46-DB02](p46-db02-design-brief-contact-photo-model.md)
Phase: [Phase 46](phase-46-alphabet-scrubber.md)

> **Verified on staging 2026-07-04:** uploaded a 1600×1200 PNG → one 1024×768
> JPEG (EXIF stripped) + 96px webp thumb, **zero raw originals** in MinIO;
> replace with `prevUrl` deleted the prior object + thumb. Confirmed by direct
> MinIO listing. **Backfill dry-run ran clean on staging** (2026-07-04): 28
> avatar objects = 14 canonical `.jpg` + 14 thumbs, **0 raw originals, 0
> orphans** — all already in canonical form and referenced, so no `--commit`
> was needed. The script + scan verified working; re-run on prod once real
> user uploads exist.

> **Built 2026-07-04.** Upload route `src/app/api/upload/avatar/route.ts`
> rewritten to `normalizeContactPhoto`→`storeContactPhoto` (no raw write) +
> supersede-delete via `prevUrl`. `internalizeExternalAvatar()` added to
> `src/server/contact-photo-sync.ts` (SSRF-hardened fetch → normalize → store).
> `src/app/actions/contacts.ts`: pasted-URL internalize on create/update,
> replace-cleanup on update, aliasing-guarded delete-cleanup on
> `permanentlyDeleteContact` + `deleteContactsBulk`. `profile-section.tsx`
> passes `prevUrl`. Backfill: `scripts/backfill-avatars.mjs` (dry-run default,
> `--commit`, resumable). Typecheck + `qa:phase44:photo-decision` pass.
> **Needs staging + MinIO:** upload E2E, replace/delete cleanup, and the
> backfill dry-run → `--commit` run (staging first, per the standing DB note).

> User items #1 (storage) + #2: "images get optimized and the original is
> removed." Today the profile-upload route stores the **raw original
> unmodified** and nothing ever deletes superseded objects. This ticket makes
> every user-uploaded photo go through the shared normalizer, stops persisting
> raw originals, and cleans up orphans — so we keep exactly two objects per
> photo (canonical + 96 thumb) and no dead bytes.

## Scope

### Optimize on upload — one shared normalize path
- Route `/api/upload/avatar` (`src/app/api/upload/avatar/route.ts`) through
  the existing `normalizeContactPhoto()` +
  `storeContactPhoto()` (`src/server/contact-photo-sync.ts:50-146`) instead of
  its bespoke "store raw bytes + thumb" logic. **The raw uploaded bytes are
  never written to MinIO** — only the normalized canonical (per P46-DB02's
  canonical spec) + the 96px webp thumb.
- Result: a 2 MB PNG upload becomes a capped, re-encoded, EXIF-stripped
  canonical — the storage win, without changing the two-object model.

### Remove superseded originals (no orphans)
- On avatar **replace or clear** in `updateContact()`
  (`src/app/actions/contacts.ts:635-703`) and in the profile-photo save
  (`settings/account/profile-section.tsx`), call `deleteContactPhoto()`
  (`contact-photo-sync.ts:149-158`) on the **prior** `avatarUrl` (best-effort,
  never blocks the write — mirror the sync path's `void delete...` pattern).
- On contact **delete**, delete its photo objects too.
- Only delete **Kontax-hosted** objects (guard with the same key/host check
  `resolveAvatarSrc` uses); never attempt to delete a pasted external URL.

### Backfill / orphan sweep (one-off script)
- `scripts/*.mjs` one-off, staging first, dry-run before write (mind the
  `db push` / staging-DB notes):
  1. Re-normalize existing **raw** profile originals in place (detect
     un-normalized objects; re-encode → replace, keeping the same key/thumb).
  2. Sweep MinIO for orphaned avatar objects with no referencing
     `Contact.avatarUrl` / `User.image` and delete them.
- Log counts and bytes reclaimed; cap and log any truncation.

## Acceptance
- Uploading a large unoptimized image (e.g. 2 MB PNG) results in a stored
  canonical that is normalized (capped dimensions, re-encoded, EXIF stripped)
  — verify the stored object bytes/format, not just that it renders.
- Exactly two objects exist per photo after upload (canonical + `-thumb.webp`);
  no third/raw variant.
- Replacing a contact's photo deletes the previous Kontax-hosted object
  (verify it's gone from MinIO); clearing the photo does likewise; deleting
  the contact removes its objects. Pasted external URLs are never delete-
  attempted.
- Backfill script dry-run reports the set of raw originals + orphans; a live
  run on staging reclaims them with logged byte counts and no dangling
  `avatarUrl` references.
- No regression to sync-sourced photos (they already used this path).

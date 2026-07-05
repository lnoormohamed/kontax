# P46-DB02 — Design brief: contact photo storage, upload & display model

Status: **Decided 2026-07-04** → [design-briefs/p46-db02-contact-photo-model.md](../design-briefs/p46-db02-contact-photo-model.md) · Priority: P0 · Depends: —
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Feeds: [P46-03](p46-03-photo-storage-consolidation.md), [P46-04](p46-04-contact-photo-upload-ui.md)

> **Decided & built 2026-07-04.** All five decisions are settled in the
> deliverable above and implemented across P46-02/03/04 (see each ticket).
> The open questions in this brief's body below are kept for provenance; the
> deliverable is the source of truth. Two deviations recorded there: upload
> key stays under the user id (cleanup keys off the URL, avoids IDOR), and the
> config-driven host uses `NEXT_PUBLIC_MEDIA_HOST` (hydration-safe).

> Design brief front-runs its builds. This one settles the photo *model*
> (how many variations we keep, what happens to an uploaded original, when
> orphans get cleaned up, and how a stored photo resolves to an `<img src>`)
> before P46-03/04 build against it. The display-bug diagnosis in
> [P46-02](p46-02-contact-photo-display-fix.md) runs in parallel and feeds
> the "Display resolution" section below.

## Why (verified 2026-07-04)

Current photo reality in the repo:

- **Two upload/store paths, inconsistent.**
  - User **profile** photo upload (`src/app/api/upload/avatar/route.ts`) is
    the *only* file-upload surface. It stores the **raw original bytes
    unmodified** (up to 2 MB — an unoptimized PNG stays a PNG) plus a 96×96
    webp thumb sibling. No normalization, no EXIF strip on the original.
  - Sync inbound (`src/server/contact-photo-sync.ts:50-146`) does it
    properly: `normalizeContactPhoto()` rotates by EXIF, caps at 1024px,
    re-encodes JPEG q82, strips EXIF, then stores canonical + 96px webp thumb.
    `deleteContactPhoto()` (`:149-158`) already cleans up both objects.
- **Contacts have no file upload at all.** The contact form
  (`create-contact-form.tsx`), mobile sheet (`mobile-contact-sheet.tsx`) and
  dashboard only accept a **pasted URL**, stored raw in `Contact.avatarUrl`.
  Pasted external URLs render through `/api/image-proxy` (re-encoded on every
  request, never stored).
- **No cleanup on manual replace/clear.** `updateContact()`
  (`src/app/actions/contacts.ts:635-703`) overwrites `avatarUrl` and orphans
  the old MinIO object. Only sync cleans up. There is no orphan-sweep cron.
- **Storage variations: already only 2** (canonical + 96 thumb). The waste
  isn't variation *count* — it's storing **raw un-normalized originals** and
  **never deleting superseded objects**.

## Decisions to make

### 1. Canonical variation set (the "fewer variations / minimum storage" ask)
- **Recommended: keep exactly two stored objects per photo** and no more —
  `<key>.<ext>` (canonical) + `<key>-thumb.webp` (96×96). Resist adding
  256/512 intermediates; the detail hero (~80–160px displayed) is well served
  by the canonical, and the 96 thumb covers list rows at 2× DPR.
- **Canonical spec:** decide the cap + codec. Constraint to reconcile: the
  same canonical object also feeds **outbound sync push** to providers
  (P44-04), which wants reasonable fidelity — so the cap can't be tuned purely
  for our own display. Recommend **matching the sync normalizer: ≤1024px,
  q82** so uploaded and synced photos are indistinguishable downstream, and
  the *savings* come from normalizing (not from a smaller cap). Record the
  storage math either way.

### 2. Upload lifecycle — optimize-on-upload, no raw original (user item #2)
- Every user-uploaded photo (profile **and** contact) passes through the
  shared `normalizeContactPhoto()` before storage. **The raw original is
  never persisted** — only the normalized canonical + thumb.
- Decide crop vs contain for the canonical (thumb is already `cover`).
  Recommend `contain`/no-crop for canonical, `cover` square for thumb
  (matches today).
- On **replace or clear**: delete the superseded object(s) best-effort via
  `deleteContactPhoto()`. On contact **delete**: delete its photo objects.

### 3. Pasted-URL contact photos
- Decide: keep proxying external URLs at render time, **or** fetch-normalize-
  store them as Kontax-hosted on save (via the existing SSRF-hardened
  `safe-image-fetch.ts`) so display no longer depends on the origin staying
  up or the proxy. Recommend **store-on-save** for consistency with uploads
  and to close the "external host 404s later" failure — but note the privacy
  angle (we now host a copy) and keep the proxy as the fallback for URLs we
  can't fetch.

### 4. Display resolution (reconcile with P46-02 findings)
- `resolveAvatarSrc()` (`src/lib/avatar-src.ts:13`) hardcodes the
  Kontax-media host to `https://media.getkontax.com/`. The upload route
  builds URLs from `MINIO_PUBLIC_URL ?? MINIO_ENDPOINT`. **If the deployed
  public URL host ≠ media.getkontax.com, every Kontax-hosted avatar falls
  through to `/api/image-proxy` and the thumb sibling is never used** — a
  prime "images not displaying / slow" suspect. Brief the correct
  host-matching rule (config-driven, not a hardcoded literal).
- Detail hero (`contacts/[id]/page.tsx:914-919`, `mobile-contact-detail.tsx:412-422`)
  has **no `onError` fallback** (list rows do). Specify the fallback chain:
  thumb → canonical → initials avatar.

### 5. Backfill / cleanup of existing state
- One-off script (`scripts/*.mjs` pattern; mind the `db push` deploy note) to
  (a) re-normalize existing raw profile originals, and (b) sweep orphaned
  superseded objects. Dry-run first; scope to staging per the standing DB
  note.

## Deliverable
A short brief (in `roadmap/design-briefs/`) recording decisions 1–5 with the
chosen canonical spec, the upload lifecycle diagram (upload → normalize →
store canonical+thumb → delete-on-replace), and the display fallback chain —
enough that P46-03 and P46-04 build without re-litigating.

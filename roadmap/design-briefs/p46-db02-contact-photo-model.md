# P46-DB02 — Contact photo storage, upload & display model (design brief)

Status: **Decided** 2026-07-04 · Feeds: P46-02, P46-03, P46-04
Source: design canvas `P46-DB02 Contact Photo Model` (Claude Design handoff)

Settles the photo *model* so the build tickets don't re-litigate it. Two truths
anchor everything: we already keep only **two objects per photo** (canonical +
96px thumb) — the waste is storing **raw un-normalized originals** and **never
deleting superseded objects**; and the sync path
(`src/server/contact-photo-sync.ts`) already does it right. This brief makes the
upload paths reuse that path.

## Decision 1 — Variation set: exactly two objects
- Keep **canonical** `avatars/<ownerId>/<cuid>.jpg` + **thumb**
  `…-thumb.webp`. No 256/512 intermediates — a new size is a new decision with
  its own storage math.
- **Canonical spec = the sync normalizer**: ≤1024px (`fit:"inside"`,
  no-enlarge), JPEG **q82**, EXIF stripped. Chosen so uploaded and synced
  photos are indistinguishable downstream and the same object can push to
  providers (P44-04); a 1024/q82 JPEG (~100–300 KB) stays under every P44-01
  provider cap (iCloud rejects >1 MB).
- Storage win comes from **normalizing**, not from a smaller variant count:
  a raw 1.8 MB phone upload → ~218 KB stored (~88% smaller). Sync-sourced
  photos are already normalized, so the win is only on the upload paths.

## Decision 2 — Upload lifecycle: optimize on upload, no raw original
- Every user upload (profile **and** contact) →
  `normalizeContactPhoto()` → `storeContactPhoto()`. **The raw bytes are never
  persisted.** Undecodable bytes → `INVALID_IMAGE`, nothing written.
- Canonical **contain / no-crop** (cropping a copy we push to providers is
  destructive); thumb **cover** square. Framing is a CSS concern.
- **Delete superseded** on replace / clear / contact-delete, **Kontax-hosted
  only** — never a pasted external URL. Fire-and-forget (`void deleteContactPhoto`),
  never in the write's critical path; a failed delete leaves an orphan (swept
  by Decision 5), not a broken write.

## Decision 3 — Pasted URLs: fetch-normalize-store on save
- On save, a pasted external `avatarUrl` is fetched through the SSRF-hardened
  `safe-image-fetch.ts`, normalized, and stored as Kontax-hosted (same as an
  upload) → closes the "external host 404s later" failure, cheaper renders,
  one storage path.
- **Best-effort**: on fetch failure (host down, SSRF block, non-image,
  timeout) keep the pasted URL and render it through `/api/image-proxy` as
  today. The proxy is retained as the fallback, not removed.
- **Privacy, recorded**: we now host a copy of a linked image — same posture
  as any synced photo.

## Decision 4 — Display resolution (reconciles P46-02)
- **Media-host match is config-driven.** `resolveAvatarSrc` no longer
  hardcodes `media.getkontax.com`; a non-default deploy host resolves to a
  direct MinIO load + thumb instead of falling through to the proxy.
- **Fallback chain on both detail heroes: thumb → canonical → initials.** Each
  `onError` advances one distinct step; the final step is the initials element
  (no `<img>`, can't error). A dead URL never shows a broken-image icon.

## Decision 5 — Backfill + orphan sweep
- One-off `scripts/backfill-avatars.mjs`: (a) re-normalize raw originals in
  place, (b) sweep objects unreferenced by any `Contact.avatarUrl` /
  `User.avatarUrl`. **Dry-run first, staging first**, log bytes reclaimed,
  resumable/idempotent.

---

## Implementation notes (built 2026-07-04)

Two intentional deviations from the canvas, with reasons:

1. **Upload key stays under `session.user.id`, not the contact id.** The canvas
   suggested keying contact uploads under the contact id. Cleanup keys off the
   **stored URL** (`deleteContactPhoto(url)`), not the id, so the id doesn't
   affect correctness — and keying under the user avoids an IDOR on a
   caller-supplied contact id and the "new contact has no id yet" problem.
2. **Host match uses `NEXT_PUBLIC_MEDIA_HOST`, not raw `MINIO_PUBLIC_URL`.**
   `resolveAvatarSrc` runs on client **and** server; a server-only env var is
   `undefined` in the browser bundle and would cause a hydration mismatch. The
   public var guarantees both sides agree. The CSP `img-src` (in both
   `next.config.js` and `src/middleware.ts`) is now **config-driven from the
   same var**, so it no longer needs a manual per-deploy edit. **Deploy action
   (reduced):** a deploy whose media host isn't `media.getkontax.com` only needs
   to set `NEXT_PUBLIC_MEDIA_HOST` — CSP follows automatically.

3. **Fallback catches images that error before hydration.** Live testing
   surfaced an SSR-race: a server-rendered `<img>` can finish loading and error
   before React attaches `onError`, stranding a broken image. `ContactHeroAvatar`
   now re-checks `complete && naturalWidth === 0` after mount and advances the
   chain, so the initials fallback always wins.

## Live verification (2026-07-04, dev server → staging DB + MinIO)

- **P46-03**: uploaded a 1600×1200 PNG → stored a single 1024×768 **JPEG**
  (EXIF stripped) + 96px webp thumb, **zero raw originals** in MinIO. Replace
  with `prevUrl` deleted the prior object + thumb. Verified by listing MinIO.
- **P46-02**: the contact detail hero resolved to the **direct MinIO URL** (not
  `/api/image-proxy`) — confirming the host-match root cause + fix. The initials
  fallback engaged for an unreachable image (`img` removed, "AL" shown).
- **P46-05**: clicking Sharing → History → Details kept `history.length`
  constant — `replace` prevents tab stacking at runtime.
- Local caveat: staging MinIO is `http://` on a private IP, so
  `upgrade-insecure-requests` stops the browser painting the photo locally
  (prod media host is https); this exercised the fallback path.

Backfill key-stability choice: Job 1 overwrites bytes at the **same key/ext**
with the normalized JPEG (a `.png` object may then hold JPEG bytes) so no DB
`avatarUrl` rewrite is needed — renderers serve by URL and sniff content.

Not done here (deliberately out of scope, orphan-sweep is the backstop):
merge-loser photo cleanup; clearing a contact photo via `updateContact` (the
form treats an empty field as "no change", so it can't null the avatar).

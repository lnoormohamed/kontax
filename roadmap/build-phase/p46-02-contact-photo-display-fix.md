# P46-02 — Contact photo display fix (diagnosis + fallbacks)

Status: **Built + verified on staging 2026-07-04** · Priority: P1 · Depends: —
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Feeds: [P46-DB02](p46-db02-design-brief-contact-photo-model.md) (Display resolution section)

> **Built + verified 2026-07-04.** Config-driven host in `src/lib/avatar-src.ts`
> (exported `isKontaxHosted`, matches `NEXT_PUBLIC_MEDIA_HOST` + legacy literal);
> CSP `img-src` config-driven from the same var in `next.config.js` +
> `src/middleware.ts`. New shared client component
> `src/app/_components/contact-hero-avatar.tsx` (thumb→canonical→initials),
> hardened against an SSR-error race (re-checks `complete && naturalWidth===0`
> after mount), wired into desktop (`contacts/[id]/page.tsx`) + mobile
> (`mobile-contact-detail.tsx`) heroes.
>
> **Root cause confirmed on staging:** `MINIO_PUBLIC_URL` = `http://10.0.0.144:9000`,
> so the old hardcoded `media.getkontax.com` regex sent every avatar to
> `/api/image-proxy`, which **blocks private IPs → 502** (that's the "images
> not displaying"). After the fix the hero resolves to the **direct MinIO URL**;
> the initials fallback engages for an unreachable image. (Suspect #1, not the
> missing-env suspect #2.) Typecheck clean.

> User report: "images are not being displayed." The reporter isn't sure
> where — treat this as **diagnose first, then fix**. Thumbnail infrastructure
> already exists (96px webp on both upload and sync paths), so the failure is
> almost certainly in *resolution/serving*, not in "we never made thumbnails."

## Scope

### Diagnose (on staging — per the standing DB/env note)
Reproduce and pin the actual failure. Instrument the `<img>` resolution for a
Kontax-hosted avatar, a pasted-URL avatar, and a synced avatar, across list
rows, desktop detail hero, and mobile detail hero. Confirm which of the known
suspects is biting:

1. **Media-host mismatch (top suspect).** `resolveAvatarSrc()`
   (`src/lib/avatar-src.ts:13`) matches only `https://media.getkontax.com/`.
   The upload route returns URLs from `MINIO_PUBLIC_URL ?? MINIO_ENDPOINT`
   (`src/app/api/upload/avatar/route.ts:98`). If the deployed public host
   differs, Kontax-hosted avatars route through `/api/image-proxy` (auth +
   rate-limit + re-fetch) instead of loading directly, and the 96px thumb
   sibling is bypassed — reads as broken/slow/missing images.
2. **MinIO env not configured on the target container.** Per the P44-06
   live-run blocker, a container missing `MINIO_*` stores nothing and
   `avatarUrl` stays null → initials-only. Confirm env presence where the bug
   reproduces.
3. **Missing `onError` fallback on detail heroes.** `contacts/[id]/page.tsx:914-919`
   and `mobile-contact-detail.tsx:412-422` render `resolveAvatarSrc(url)` with
   **no fallback**; a 404 (e.g. pre-backfill upload with no thumb, or a dead
   pasted URL) shows a broken image. List rows
   (`contacts-workspace-table.tsx:190-204`) already fall back via `onError`.
4. **Image-proxy failures** (rate-limit / unreachable / 5xx) on pasted-URL
   photos with no visible fallback to initials.

### Fix
- Make the Kontax-media-host match **config-driven** (derive from
  `MINIO_PUBLIC_URL`), not a hardcoded literal, so uploaded photos resolve to
  a direct load + thumb regardless of deploy host. Keep the
  `media.getkontax.com` case working.
- Add the **thumb → canonical → initials** `onError` fallback chain to both
  detail heroes, matching the list-row pattern.
- If the root cause is env (suspect 2), file the env fix against the deploy
  (Coolify) and note it here — code fixes alone won't resolve it.

## Acceptance
- Root cause identified and stated in the ticket (which suspect, with
  evidence from the staging repro).
- On staging: a freshly uploaded profile photo and a pasted-URL contact photo
  both render in list rows **and** the detail hero; the list row loads the
  96px thumb (verify the actual `src` in the network panel, not just the
  screenshot).
- A deliberately-broken avatar URL degrades to the initials avatar in every
  surface (list, desktop hero, mobile hero) — no broken-image icon.
- `resolveAvatarSrc()` resolves Kontax-hosted photos to a direct MinIO load
  under the deployed `MINIO_PUBLIC_URL` host, not the proxy.

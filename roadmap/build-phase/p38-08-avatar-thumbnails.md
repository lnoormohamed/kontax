# P38-08 — Avatar Thumbnails for List Rows

## Status
Implemented & verified 2026-07-02.

**Reality check found during implementation** (adjusts the ticket's premise):
- The MinIO upload route (`/api/upload/avatar`) is only used for USER profile
  avatars today. CONTACT avatars are a pasted-URL text field (arbitrary
  external URLs), and zero contacts on staging have avatars at all — so the
  "photo-heavy list" cost is prospective, not current. The mechanism is built
  now because contact-photo work is in flight (P34S-04 / uncommitted
  avatar-in-rows rendering), so every Kontax-hosted avatar gets a thumb from
  day one.
- Sync engines do not write avatarUrl (no provider photo ingestion yet) —
  the upload route remains the single controlled write path.

**Close-out:**
- Upload route generates a 96×96 webp (quality 80, EXIF-rotated) sibling at
  `<key minus ext>-thumb.webp`; generation failure never blocks the upload.
- `src/lib/avatar-thumb.ts` derives thumb URLs by key convention
  (`/avatars/<uid>/<id>.<ext>` shape only); external URLs return null. Pinned
  by tests/node/avatar-thumb.test.ts.
- List-row Avatar loads the thumb first with `onError` fallback to the
  original (covers pre-backfill uploads); detail pages keep the original.
- `npm run backfill:avatar-thumbs` (supports `--dry-run`) backfills existing
  MinIO-hosted avatars; run against prod after deploy (needs MINIO_* env).
- Verified: sharp pipeline (3.1KB jpeg → 92-byte 96×96 webp; corrupt input
  rejected inside the guard), thumb-first request → 404 → original fallback
  observed in the browser network log, external URLs pass through untouched.
  End-to-end upload not testable locally (no MINIO_* in dev env) — smoke-test
  a profile-picture upload on staging Coolify after deploy.
- Docker: node:22-alpine builder installs sharp's musl prebuilds; runner
  copies node_modules from the builder, so no Dockerfile change needed.
- **Side-finding**: external pasted avatar URLs are blocked by the app CSP
  (`img-src` allows only self/data/blob/media.getkontax.com) — they render
  broken today. Flagged as a separate task (widen CSP vs proxy vs
  upload-only).

## Purpose

Stop downloading full-size contact photos to render 32–40px list avatars. On a
photo-heavy address book the people list currently pulls the original upload
for every visible row.

## Background

`ContactAvatar` in `src/app/_components/contacts-workspace-table.tsx` (~line
180) renders a plain `<img src={avatarUrl}>` sized via inline style. Avatars
are uploaded through `/api/upload/avatar` to MinIO (LXC 151) and served from
`https://media.getkontax.com` (already allowed in the CSP `img-src`). There is
no resizing anywhere in the pipeline — the list, the detail page, and the
mobile sheets all fetch the original.

`next/image` is not currently used in the app, and the self-hosted deploy would
need the image optimizer configured (and its cache volume) — generating a
thumbnail at upload time is simpler and fits the existing MinIO setup.

## Scope

**In scope**
- Generate a small square variant (e.g. 96×96, covers 2× DPR at 48px) at
  upload time in `/api/upload/avatar`, stored alongside the original with a
  predictable key suffix (e.g. `…-thumb.webp`).
- Store or derive the thumb URL; list rows, mobile rows, and any ≤ 64px
  rendering use it; the detail page keeps the original.
- Backfill script (`scripts/*.mjs` pattern) generating thumbs for existing
  avatars in MinIO.
- Graceful fallback: if the thumb 404s (backfill gap), fall back to the
  original via `onError` or by serving original when thumb is missing.

**Out of scope**
- Adopting `next/image` / an image-optimizer service.
- Sync-provider photo ingestion changes (Google/Microsoft photos land through
  their own paths — audit where they write `avatarUrl`; if they bypass the
  upload route, add thumb generation there too or explicitly defer with a
  follow-up note).

## Design / Implementation Spec

- Use `sharp` (add as dependency) in the upload route; output webp, quality
  ~80. Keep the original untouched.
- Derive thumb URL by key convention rather than a new DB column if possible
  (`avatarUrl` → insert `-thumb` before extension, extension → `.webp`);
  if URL shapes vary too much in existing data, add `avatarThumbUrl` to
  `Contact`/`User` instead — decide during implementation, prefer convention.

## Acceptance Criteria

- Network panel on a seeded photo-heavy list shows thumb requests of a few KB
  each instead of original uploads; record total image bytes before/after for
  the first screenful.
- New upload produces both objects in MinIO; existing avatars display
  correctly before and after backfill (fallback verified by deleting one thumb
  manually on staging).
- Detail page still shows the full-resolution image.

## Risks / Open Questions

- Where do Google/Microsoft sync photos enter the system, and are they already
  size-bounded by the provider? Answer determines whether sync paths need the
  same treatment.
- `sharp` needs its native binaries in the Docker image — verify the Coolify
  build includes them (alpine images need `--platform`-correct install).

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — key convention note
- [x] Internal · support/admin — backfill runbook

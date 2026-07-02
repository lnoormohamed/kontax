# P38-08 — Avatar Thumbnails for List Rows

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

# P46-04 — Contact photo upload UI (desktop + mobile)

Status: **Built 2026-07-04 (needs real-device verify)** · Priority: P2 · Depends: [P46-DB02](p46-db02-design-brief-contact-photo-model.md), [P46-03](p46-03-photo-storage-consolidation.md)
Phase: [Phase 46](phase-46-alphabet-scrubber.md)

> **Built 2026-07-04.** New shared `src/app/_components/avatar-upload-button.tsx`
> (posts to the P46-03 optimized route with `prevUrl`, 2 MB guard, mapped error
> states) added alongside the URL-paste field in `create-contact-form.tsx` and
> `mobile-contact-sheet.tsx`. Keys under the user id (see P46-DB02 deviation).
> Typecheck clean. **Needs real-device pass** (native file picker / camera
> capture — preview can't emulate it) and a staging MinIO upload E2E. The
> desktop `contact-dashboard` inline avatar edit was left on URL-paste (no
> inline file field there today); revisit if wanted.

> User decision (2026-07-04): add a real **file upload** for contact photos.
> Today contacts can only take a **pasted URL** (`create-contact-form.tsx`,
> `mobile-contact-sheet.tsx`, `contact-dashboard.tsx`) — the only file-upload
> in the app is the user *profile* photo. This ticket adds file upload to the
> contact photo field on both desktop and mobile, reusing the optimized,
> cleanup-aware storage path from P46-03.

## Scope

### Upload surface
- Add a file picker (accept `image/jpeg,png,webp,gif`, ~2 MB client cap to
  match the route) alongside the existing URL-paste input on:
  - desktop create/edit contact form (`create-contact-form.tsx`, and the
    inline/dashboard avatar edit in `contact-dashboard.tsx`),
  - mobile contact sheet (`mobile-contact-sheet.tsx`, currently the `type="url"`
    field around line 504).
- Keep URL-paste as an option (per P46-DB02 decision on pasted-URL handling).
- Upload posts to the shared optimized route from P46-03; the returned
  canonical URL is written to `Contact.avatarUrl`. **The contact-scoped upload
  must use a contacts key prefix / scoping**, not the profile-photo user key —
  extend or parameterize `/api/upload/avatar` (or add a sibling route) so the
  object lands under the contact, and P46-03's replace-cleanup can find it.
- Show upload progress + the same error states the route returns
  (`INVALID_FILE_TYPE`, `FILE_TOO_LARGE`, `UPLOAD_NOT_CONFIGURED`), degrading
  gracefully when MinIO isn't configured.

### Behaviour
- Preview the chosen image before save; on save, the optimized canonical +
  thumb are what persist (P46-03).
- Replacing an existing contact photo triggers P46-03's superseded-object
  cleanup.

## Acceptance
- On desktop and mobile, a user can pick an image file for a contact and it
  is stored optimized (canonical + thumb), then renders in the list row (96px
  thumb) and the detail hero.
- URL-paste still works and coexists with the file picker.
- Replacing a contact's uploaded photo removes the prior Kontax-hosted object
  (via P46-03).
- Oversized / wrong-type files show the correct inline error and don't write
  anything.
- With MinIO unconfigured, the picker shows the "upload unavailable" state and
  URL-paste still works.
- Real-device pass on mobile (file picker + camera capture where the OS offers
  it); preview can't emulate the native picker.

# P44-03 — Inbound photo sync (provider → MinIO → `avatarUrl`)

Status: Not started · Priority: P1 · Depends: [P44-02](p44-02-photo-change-detection-echo-suppression.md)
Phase: [Phase 44](phase-44-photo-sync.md)

## Scope

Pull provider photos into Kontax: fetch (People API photo / vCard `PHOTO`
decode), normalize (re-encode to our canonical format, cap dimensions, strip
EXIF for privacy), store in MinIO alongside the existing S3/data-export
plumbing, set `avatarUrl`, update the photo shadow.

- Respect `excludedFields` (Phase 39) — photos become an excludable field
  family, which also means the P36 settings panel's Field Exclusions checkbox
  grid gains a "Photos" entry (small UI addition; coordinate with
  [P39-03](p39-03-runner-field-exclusions.md), whose seam already treats the
  list as open).
- Emits activity events; feeds the P38-08 thumbnail pipeline rather than
  duplicating it.

## Acceptance

- A provider-side photo add/change appears in Kontax (normalized, EXIF
  stripped) with shadow updated and an activity event.
- "Photos" excluded → inbound photos ignored, existing `avatarUrl` untouched.
- Thumbnails render via the existing P38-08 path (no second pipeline).

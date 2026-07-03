# P34S-04 — Contact Image/Profile-Picture Sync and Rendering QA Matrix

## Purpose

Run a dedicated compatibility and QA pass for contact images/profile pictures
across creation, editing, sync providers, and major user-facing surfaces.

## Background

Contact photos are a high-visibility detail that often break in subtle ways:

- sync providers may downscale or strip them
- list/detail/public-card/admin surfaces may render different crops
- multilingual/demo fixtures can hide image regressions because text receives
  more attention than media

This work should come late in the phase stack, after the sync and contact model
is more stable.

## Scope

**In scope**
- create/edit contact photo behavior in web UI
- sync behavior for contact photos across:
  - iCloud
  - Fastmail
  - generic CardDAV safe mode
- rendering/cropping checks in:
  - contact list
  - contact detail
  - mobile contact sheet
  - public card where applicable
  - admin/support views where contact identity appears
- fallback/avatar behavior when a photo is missing or unsupported

**Out of scope**
- full media library management
- advanced image editing tools

## Design / Implementation Spec

### Test matrix

- upload new photo locally
- replace photo
- remove photo
- sync provider-origin photo into Kontax
- push Kontax photo outward where supported

### Rendering checks

- avatar crop consistency
- fallback initials when absent
- dark/light background contrast
- mobile/detail/list consistency

### Why this ticket is late

This pass should happen after the sync and contact model are more stable so we
do not spend QA effort revalidating image behavior after every nearby change.

## Acceptance Criteria

- Contact-photo behavior is tested explicitly, not incidentally.
- Provider compatibility expectations are documented.
- Rendering/cropping/fallback behavior is consistent across surfaces.
- QA fixtures include at least one image-heavy contact scenario.

## Documentation

- [ ] External · users — none
- [x] Internal · engineering — compatibility expectations documented here
- [x] Internal · QA/support — photo-specific test checklist created

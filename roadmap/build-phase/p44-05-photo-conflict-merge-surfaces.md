# P44-05 — Photos in conflict review & merge surfaces

Status: Not started · Priority: P2 · Depends: [P44-03](p44-03-inbound-photo-sync.md)
Phase: [Phase 44](phase-44-photo-sync.md)

## Scope

When both sides changed (the P44-02 conflict case) or a merge candidate pair
has two photos: show the two images side-by-side with a pick, in the existing
conflict-review (P23-05) and merge surfaces. Small design addendum to the
existing briefs rather than a full new brief.

Photo-specific states: broken image, both-identical-after-normalization
(auto-resolve, no user prompt), oversized preview.

## Acceptance

- A seeded both-changed photo conflict presents the side-by-side pick; the
  choice propagates per the conflict policy and updates the shadow.
- Identical-after-normalization auto-resolves silently.
- Merge review with two distinct photos offers the pick; the merged contact
  carries the chosen one.

# P44-05 — Photos in conflict review & merge surfaces

Status: Built (typecheck-verified; not exercised live) · Priority: P2 · Depends: [P44-03](p44-03-inbound-photo-sync.md)
Phase: [Phase 44](phase-44-photo-sync.md)

> **Built 2026-07-04 (typecheck-verified; not exercised live — flag-gated):**
> - Identical-after-normalization **auto-resolves silently** in the reconcile
>   core (`contact-photo-sync.ts`) — both sides changed to the same image →
>   no conflict, one remote fetch in the conflict case only. Covered by
>   `npm run qa:phase44:photo-decision`.
> - **Sync conflict review** shows the photo **side-by-side as thumbnails**
>   (compare grid + manual-merge picker, broken-image fallback). `avatarUrl`
>   rides in the conflict snapshots (`sync-conflict-snapshot.ts`); `KEEP_REMOTE`
>   applies the chosen photo (`buildContactWriteDataFromRemoteSnapshot`, guarded
>   so pre-P44-05 conflicts are untouched).
> - **Photo-only conflict recording** from the photo pass
>   (`sync-photo-pass.ts` → `recordPhotoConflict`): stages the remote photo to a
>   renderable MinIO URL, records a `SyncConflict` whose two snapshots differ
>   only in `avatarUrl` (so resolve never wipes other fields), and sets an
>   "acknowledged" shadow in the same tx so it can't re-record. `resolveSyncConflict`
>   gained a photo branch that **reseeds `photoShadow`** per the pick (KEEP_REMOTE
>   applies remote + settles; KEEP_LOCAL clears the local half → next pass
>   pushes). The provider write lands on the next photo pass. Manual-merge is
>   hidden for photo-only conflicts.
> - **Merge review** offers a **photo pick** (side-by-side thumbnails) when both
>   contacts have different photos; `avatarUrl` is now a first-class
>   `MergeFieldChoices` field threaded through the merge action. Unpicked → the
>   existing recency default.
>
> **Not verified live** (flag off, dead staging Google token) — exercised end to
> end in [P44-06](p44-06-photo-sync-qa-matrix.md). Note: for photo-only conflicts
> `MANUAL_MERGE` maps to KEEP_LOCAL (a single image has no field-merge), which is
> why the manual-merge button is hidden for them.

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

# P44-05 — Photos in conflict review & merge surfaces

Status: Partially built (conflict surface + auto-resolve done; two follow-ups
deferred — see below) · Priority: P2 · Depends: [P44-03](p44-03-inbound-photo-sync.md)
Phase: [Phase 44](phase-44-photo-sync.md)

> **Built 2026-07-04 (typecheck-verified; not exercised live):**
> - Identical-after-normalization **auto-resolves silently** in the reconcile
>   core (`contact-photo-sync.ts`) — both sides changed to the same image →
>   no conflict, one remote fetch in the conflict case only. Covered by
>   `npm run qa:phase44:photo-decision`.
> - The sync **conflict review** shows the photo **side-by-side as thumbnails**
>   with a broken-image fallback (both the compare grid and the manual-merge
>   picker). `avatarUrl` now rides in the conflict snapshots
>   (`sync-conflict-snapshot.ts`) and `KEEP_REMOTE` applies the chosen photo
>   (`buildContactWriteDataFromRemoteSnapshot`, guarded so pre-P44-05 conflicts
>   are untouched). Merge already carries the recency-default photo onto the
>   survivor.
>
> **Deferred (documented, not built):**
> 1. **Interactive photo pick in the *merge* review** — `ConflictCard` is
>    text-oriented; needs an image variant + `avatarUrl` threaded through
>    `MergeFieldChoices`/the merge action. The survivor still gets the
>    recency-default photo today.
> 2. **Photo-*only* conflict recording from the (flag-gated) photo pass** — the
>    pass currently tallies+logs a both-different photo conflict but writes
>    nothing. Recording one safely needs the resolve action to re-push on
>    `KEEP_LOCAL` and **reseed `photoShadow`**, else the conflict re-appears each
>    cycle. Not wired without live verification; auto-resolve already covers the
>    common both-same case, and the deferred path is a no-write no-loop skip
>    (safe, no data loss).

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

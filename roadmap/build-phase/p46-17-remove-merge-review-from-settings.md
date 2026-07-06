# P46-17 (DB07·T6) — Remove Merge review from settings

Status: **Built & preview-verified (2026-07-06, 3d6ba0b)** · Priority: P2 · Depends: P46-12

> The sidebar rewrite (P46-12) had removed the entry; verification found NO
> remaining UI path to /merge/manual — a "Manual merge" button now lives on
> the duplicates toolbar (desktop, matching the removed entry's desktop-only
> scope). DB07 T1–T6 all complete.
Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: DB07 §2 (build-note)

The desktop "Jump to → Merge review" entry disappears with the sidebar
rewrite (P46-12); this ticket verifies the tool's reachability from the
Contacts workspace instead. **Build-note from the review:** the design's
"`/duplicates`" route doesn't exist — the real surfaces are
`/contacts?tab=duplicates` (queue) and `/merge/manual` +
`/merge-suggestions/[id]` (tools). Ensure the duplicates tab links to the
manual-merge workbench; no new route. Resolves smell 13.

Acceptance: no settings nav path to merge tools; duplicates tab offers manual
merge; both merge screens keep their DB06 mobile headers (back "Contacts").

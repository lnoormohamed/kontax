# P46-18 — Teams page body-split + seats relocation (DB07 T5 remainder)

Status: **Built & preview-verified (2026-07-06, d0b2241)** · Priority: P2 · Depends: P46-16

> Delivered: shared `loadOwnedTeam` loader; Books + Permissions child pages;
> parent slimmed ~360 lines with a child-links card; seats form relocated to
> Plan & billing (owner-only, Stripe action untouched), Teams shows read-only
> usage. Guards verified with the Free-plan QA user (children redirect to the
> parent's upsell; no seats card on billing). **Owner-path live verification
> rides the deferred Stripe smoke test — run before prod cutover.** The
> nested-back polish item (back to nearest group index) remains open here.
Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: DB07 §6 (Teams boundary card)

> Deferred from [P46-16](p46-16-settings-sharing-groups.md), which landed the
> full URL restructure (family/teams/shares/audit under /settings/sharing with
> 301s). The remaining piece is internal to the Teams page and has zero URL/IA
> impact: the ~850-line page body splits into child pages **Books ·
> Permissions** (Audit is already a child), and the **seat purchase/update
> flow relocates to Plan & billing** (which owns seats per DB07/T2) with Teams
> keeping read-only usage + a link. Deferred deliberately: the split untangles
> shared owner-state around a PAID flow (updateTeamSeats → Stripe) and
> deserves its own careful pass rather than riding a URL-move commit.

Additional polish item spotted during T5: nested settings pages' mobile back
always targets /settings root ("Settings") — consider backing to the nearest
group index (e.g. "Sharing & groups") for 2-level-deep pages.

Acceptance: /settings/sharing/teams renders overview + links to child pages;
books/permissions CRUD unchanged functionally; seats updated only from Plan &
billing; no Stripe regression (run the deferred Stripe smoke test after).

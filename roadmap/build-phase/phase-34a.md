# Phase 34A — Shared Contact & Merge UX

> Refines the two areas of the app that deal with other people's data: the
> "Shared with" panel on the contact detail page, and the duplicate/merge
> review workflow. Both receive a visual redesign plus smarter backend logic.

## Phase status
Pre-plan — blocked on design briefs P34A-DB01 and P34A-DB02.

## Phase objective
Make the sharing panel immediately legible (who has access, what role, which book),
and make the merge workflow smart enough that it surfaces only genuine duplicates,
explains why they were flagged, and lets users resolve conflicts field-by-field
rather than blindly picking a "winner" contact.

## Background
The current Sharing tab shows book membership as a paragraph of text — no avatars,
no role badges, no hierarchy. The duplicate detection engine uses a flat scoring
model with no explanatory output. "Not a duplicate" has no persistent storage so
dismissed pairs reappear on every page load. Both areas were noted as needing
refinement by the user in the Phase 34 planning session (2026-06-14).

## Dependencies
- P34A-01/02/03 are blocked until design brief P34A-DB01 is approved.
- P34A-07/08/09/10 are blocked until design brief P34A-DB02 is approved.
- P34A-04/05/06 have no design dependency and can start now.

## Success criteria
- Sharing tab clearly shows every member row with avatar, name, and role badge.
- "Not a duplicate" dismissals persist across sessions and never resurface.
- Duplicate cards show match-reason chips and an expandable field comparison.
- The merge conflict picker covers all conflicting scalar fields, not just name.
- Manual "Merge with" is accessible from the contact detail ··· menu.

## Exit criteria
- [ ] P34A-01 through P34A-10 shipped and tested on staging.
- [ ] P34A-DB01 and P34A-DB02 approved by designer before implementation starts.
- [ ] No regression on existing sharing or merge flows.

## Ticket index

| Ticket | Title | Priority | Blocked on |
|---|---|---|---|
| P34A-01 | "Shared with" card — desktop layout rebuild | P1 | P34A-DB01 |
| P34A-02 | "Shared with" card — mobile layout rebuild | P1 | P34A-DB01 |
| P34A-03 | "Shared with" empty state | P2 | P34A-DB01 |
| P34A-04 | MergeDismissal schema | P0 | — |
| P34A-05 | Wire dismissals to duplicate query | P0 | P34A-04 |
| P34A-06 | Smarter scoring weights | P1 | — |
| P34A-07 | Match-reason label chips on duplicate card | P1 | P34A-DB02 |
| P34A-08 | Side-by-side field comparison panel | P1 | P34A-DB02 |
| P34A-09 | Merge conflict resolution — per-field picker | P2 | P34A-DB02 |
| P34A-10 | Manual "Merge with" from contact detail | P2 | P34A-09 |

## Design briefs

| Brief | File | Covers |
|---|---|---|
| P34A-DB01 | [p34a-db01-shared-with-card.md](../design-briefs/p34a-db01-shared-with-card.md) | Shared contact card, member rows, role badges, empty + pending states |
| P34A-DB02 | [p34a-db02-merge-review.md](../design-briefs/p34a-db02-merge-review.md) | Duplicate card enhancements, comparison panel, dismiss, manual merge picker |

## Start immediately (no design dependency)

- **P34A-04** — Prisma `MergeDismissal` model + `dismissMergeSuggestion` server action
- **P34A-05** — Exclude dismissed pairs from the duplicate query
- **P34A-06** — Revised scoring weights (phone/email exact match → 0.95)

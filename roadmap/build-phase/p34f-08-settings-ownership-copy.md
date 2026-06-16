# P34F-08 — Settings Copy: Ownership Semantics

## Purpose

Make the Family-vs-Teams ownership difference explicit in the UI so users understand
what happens to shared contacts when they leave or a plan ends. Family books fan out
into personal copies; Team books belong to the org and are removed on leave. Today
neither is stated — and one existing string is now *wrong* once P34F-07 lands — so the
asymmetry is invisible (or misleading) until it bites.

Independent of the billing re-anchor; ship in parallel, but gate the family "keeps a
copy" strings on P34F-07 being merged (see Risks).

## Background

- Family settings: `src/app/settings/family/page.tsx`. Teams settings:
  `src/app/settings/teams/page.tsx`.
- Family leave now keeps a copy (P34F-07); team leave removes access with no copy
  (`src/app/actions/teams.ts:597`; `roadmap/design-briefs/14-teams-plan-surfaces.md:55`).
- The cancel-plan modal (`src/app/settings/_components/cancel-plan-modal.tsx`) already
  has a Family branch (`:118`) but its copy is now inaccurate: it says *"{n} members
  will lose group access and revert to Free"* (`:125`) with no mention that each member
  keeps a private copy of the family contacts.

## Scope

**In scope:**
- Explanatory copy on `/settings/family` and `/settings/teams` describing what happens
  to contacts on leave / plan end.
- Updated Leave confirmation modals for both flows.
- Corrected Family branch in `cancel-plan-modal.tsx` (members keep a copy).
- A short note for Teams downgrade (grace → read-only → lock; books stay with the team).

**Out of scope:**
- Behaviour changes (P34F-07 owns family copy; teams behaviour unchanged).
- Marketing / pricing copy (Phase 34C owns that).

## Design / Implementation Spec

### Family settings (`/settings/family`)

- Book section note: *"Family contacts are shared with everyone in the group. If you
  leave, you keep a private copy."*
- Leave confirmation: *"Leave {family}? A private copy of the family contacts will be
  saved to your account. Other members keep the shared book."*

### Teams settings (`/settings/teams`)

- Book section note (member view): *"Team contacts belong to {team}. If you leave or are
  removed, you lose access — they're not copied to your account."*
- Leave confirmation: *"Leave {team}? You'll lose access to all team books. Your private
  contacts are untouched."*
- Owner/admin delete-team confirmation (`deleteTeam`, `teams.ts:616`): clarify team
  books are permanently removed for everyone.

### Cancel-plan modal — Family branch (`cancel-plan-modal.tsx:118`)

**Before** (`:125`):
> Your family group will end. {n} members will lose group access and revert to Free.

**After:**
> Your family group will end. Each member (including you) keeps a private copy of the
> family contacts; the shared book is dissolved and everyone reverts to Free.

Keep the existing warn-banner styling; only the text changes.

### Teams downgrade messaging

Where the Teams plan can be downgraded/cancelled, add a note consistent with the grace
logic (`src/server/stripe-handlers.ts` grace start; `getTeamGraceState` in
`team-access.ts:8`): *"Your team stays available for 14 days, then becomes read-only.
Team contacts remain with the team — they are not copied to members."*

Tone: Teams copy slightly more utilitarian, Family warmer; both in the locked-light /
Geist system per `roadmap/design-briefs/14-teams-plan-surfaces.md`.

## Acceptance Criteria

- `/settings/family` states that leaving keeps a private copy.
- `/settings/teams` (member) states that leaving loses access with no copy.
- Both Leave confirmation modals state the correct outcome.
- The cancel-plan modal Family branch reflects copy-on-dissolution (no longer "just
  lose access").
- Teams downgrade copy mentions grace → read-only and that team books stay with the
  team.
- All copy is consistent with actual behaviour after P34F-07.

## Risks and Open Questions

- **Sequencing with P34F-07.** Do not ship the family "keeps a copy" strings before
  P34F-07 makes it true. If P34F-08 merges first, the family strings are wrong. Gate the
  family copy on P34F-07 (and the dissolution copy on the dissolution flow actually
  copying per member).
- **Counts in modals.** Showing "{n} contacts" needs a count query; the cancel modal
  already has `familyMembers` but not a contact count. Keep the qualitative statement if
  a count is costly.
- **Dissolution per-member copy.** The cancel-modal "each member keeps a copy" claim is
  only true once the dissolution flow copies for every member (P34F-07 reuse / Phase
  13). Confirm that path exists before shipping the dissolution wording.

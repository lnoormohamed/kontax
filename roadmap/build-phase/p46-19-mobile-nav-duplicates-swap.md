# P46-19 — Mobile bottom nav: Duplicates replaces Sync

Status: **Built & preview-verified (2026-07-06, uncommitted)** · Priority: P2 · Depends: P46-17

> Verified at 375px against staging data: nav swap + active-state mapping
> (`?tab=duplicates` and `/merge/manual` light Duplicates, `/sync` lights
> Settings), Duplicates badge from a seeded pair, mobile action row
> (Manual merge · Rescan · Accept all 1), rescan endpoint round-trip, and
> the bulk-accept modal through to the server action. The merge transaction
> itself timed out locally (Prisma 5s interactive-transaction limit over
> the VPN to the staging DB) — an environment artifact, not a code change
> in this ticket; the merge path is unchanged from P46-17.
Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: follow-on from P46-17 mobile review (2026-07-06)

Duplicates review is a recurring, phone-friendly chore, while /sync is a
set-up-once surface whose day-to-day signal already flows through Activity
and notifications. Meanwhile the duplicates toolbar (Manual merge · Rescan ·
Accept all high-confidence) is `hidden md:flex`, so mobile users can browse
suggestions but can't act on them. Swap the bottom-nav slot and give the
duplicates tab mobile actions.

Scope:

1. **Bottom nav swap** — replace the Sync tab with Duplicates
   (`/contacts?tab=duplicates`, `merge` icon). Badge = open merge-suggestion
   count. Active-tab mapping: `?tab=duplicates` and `/merge*` routes light
   the Duplicates tab; `/sync` lights Settings (its new home path is
   Settings → Data & sync → Sync connections).
2. **Re-home the sync error signal** — the red `syncErrorCount` badge moves
   from the removed Sync tab to the Settings tab, and the "Sync connections"
   row on /settings/data gets a "needs attention" chip when any account is
   ERROR / NEEDS_REAUTH. Broken sync must stay visible on mobile.
3. **Mobile duplicates actions** — the duplicates tab renders a mobile-only
   action row (Manual merge · Rescan · Accept all N) above the suggestion
   list, reusing the existing toolbar components. Desktop toolbar unchanged.
4. **Counts plumbing** — every BottomNav call site (contacts page, AppShell,
   settings layout, /sync page) supplies the open-suggestion count.

Acceptance: mobile bottom nav shows Contacts · Activity · Duplicates ·
Settings; Duplicates badge = open suggestions; sync errors badge the
Settings tab and flag the Sync connections row; manual merge, rescan, and
bulk-accept all reachable at 375px; /sync still reachable via Settings →
Data & sync; desktop unchanged.

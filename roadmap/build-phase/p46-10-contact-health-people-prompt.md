# P46-10 — Contact-health "needs attention" prompt in People (mobile)

Status: **Built & preview-verified (2026-07-05) — uncommitted** · Priority: P2 · Depends: P46-08

> Delivered: distinct-contact `attention` aggregate added to
> `getWorkspaceHealthCounts` (OR of the five predicates — keys overlap, so a
> sum would over-count); `healthPromptDismissedCount` flat pref key (P43
> pattern, no schema change); `mobile-health-prompt.tsx` amber card above the
> People list (lg:hidden), tap → largest health bucket, ✕ → dismiss.
> Verified live: "2 contacts need attention" → dismiss persists (fresh-read
> gate, no flash) → third contact added → returns as "3 contacts need
> attention" with Review → `health=missing-methods`. A11y note: dismiss got a
> distinct aria-label after clashing with the email-banner's generic
> "Dismiss" (that clash also exists between the email + connection banners —
> noted for a11y follow-up). QA leftovers on staging: 3 "QA Health *" contacts
> under li+p46qa (sourceDetail "p46-10 QA").
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Spec: [P46-DB06](p46-db06-design-brief-mobile-consistency-audit.md) Part B (health-in-People mock)

## Scope
- The Overview health worklist (missing methods / context / labels / dates,
  `contact-dashboard.tsx` health cards) surfaces on the **mobile People list**
  as a **dismissible amber prompt** at the top of the list, per the DB06 Part B
  mock: warning icon tile + "N contacts need attention" + one-line detail +
  chevron → the existing health-filter views (`?tab=people&health=…`).
- Dismissal: per-user, re-appears when the health count *changes* (not on a
  timer); store alongside existing user UI prefs (P43 pattern — flat key).
- Amber uses the canonical protective-amber family (`#f6edd9` bg / `#e8d8b0`
  border / `#7a5a1a` ink) — not the error red.
- Desktop Overview keeps the full worklist — this is additive for mobile only.

## Acceptance
- Seeded account with health issues: prompt shows the correct count at the top
  of the mobile People list; tapping opens the health view; dismiss hides it;
  it returns when the count changes; never shows at zero issues.
- No layout shift for users with zero issues; virtualized list scroll
  unaffected (prompt lives above the list, not inside the window).

# P46-07 — Mobile contact-list row polish (contingent)

Status: **Pre-plan — contingent** · Priority: P3 · Depends: P46-DB04
Phase: [Phase 46](phase-46-alphabet-scrubber.md)

> **Contingent ticket.** Exists only to catch any row change that
> [P46-DB04](p46-db04-design-brief-mobile-contact-list-refresh.md) decides. If
> that brief ratifies the as-built mobile row (photo + name + secondary line +
> scrubber) and only documents it, **this ticket is dropped** — no build
> needed. Do not start until the brief lands and names a concrete change.

## Why (verified 2026-07-04)

The mobile row already renders the user's proposed spine and more —
`mobileStacked` (`src/app/_components/contacts-workspace-table.tsx:654-708`):
avatar (40 px cozy) + name + company/email/phone meta + conditional context
badges + match snippet, in a `@tanstack/react-virtual` windowed list; the
scrubber (`contact-list/alphabet-scrubber.tsx`) is built and conditionally
mounted (~1417-1467). So there may be **nothing to build** — the brief will say.

## Scope (only what P46-DB04 changes)

Likely candidates the brief might hand down, if any:
- Make the secondary meta line's field priority / visibility follow the brief's
  rule (e.g. a name-only minimal density, or a user toggle).
- Adjust density default (cozy vs compact) if the brief changes it.
- Any avatar-prominence or scrubber-clearance tweak the brief specifies beyond
  what ships.

Reuse the existing avatar chain (`resolveAvatarSrc`, thumb→canonical→initials),
the windowed list, and `SwipeableRow` — this is a row-layout polish, not a
rebuild. Real-device pass for any gesture/scrubber interaction (preview can't
emulate touch — established workflow).

## Acceptance
- Whatever concrete change P46-DB04 specifies is implemented and matches the
  brief; if the brief specified no change, this ticket is closed as **not
  needed** with a one-line note pointing at the brief's ratification.
- No regression to windowed scroll, section headers, swipe actions, or the
  scrubber eligibility/jump behaviour; verified on a real phone (iOS Safari +
  Android Chrome).

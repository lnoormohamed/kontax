# P46-06 — Notification aging & event-passed treatment

Status: **Pre-plan** · Priority: P2 · Depends: P46-DB03
Phase: [Phase 46](phase-46-alphabet-scrubber.md)

> A notification that is stale by time (older than ~7 days) or whose underlying
> event has already passed should render **muted** — present in the feed for
> the record, but visibly *past* rather than a live call to action. Builds
> against [P46-DB03](p46-db03-design-brief-notification-aging.md); do not start
> until that brief settles the two triggers, the muted spec, and the data-model
> choice.

## Why (verified 2026-07-04)

The notification system is fully built; this adds an aging layer it lacks:

- `Notification` (`prisma/schema.prisma:1604-1627`) has `createdAt`, `read`,
  `readAt`, `dismissedAt`, `category`, `actionUrl` — **no `expiresAt`, no event
  date**.
- `getNotificationFeed` (`src/server/notifications.ts`) is
  `where: { userId, dismissedAt: null }`, `orderBy: createdAt desc`, `take: 20`
  — nothing ages.
- `notification-bell.tsx` (~127-133) already splits **fresh** (unread OR
  < 24 h) vs **earlier** (read AND ≥ 24 h), and renders `relativeTime()`
  (`notification-categories.ts:25-35` → `1w` etc.) per row — but every row
  renders at full strength regardless of age.
- Two surfaces, one component: **360 px desktop dropdown** and **full-screen
  mobile overlay** (`max-md:fixed inset-0`, ~line 250).
- Reusable muted tokens: `opacity-45`/`opacity-50`, text `#8b938c` / `#5c655e`
  / `#aeb4ac`.

## Scope

> Exact thresholds, muted values, affix copy, and the field-vs-derive choice
> come from [P46-DB03](p46-db03-design-brief-notification-aging.md). The steps
> below assume its recommended shape; reconcile if the brief decides otherwise.

### Data
- If the brief chose an explicit field: add nullable `eventAt` / `expiresAt` to
  `Notification` (mind the `db push` deploy note — additive, safe; verify the
  diff, then push on staging per the standing DB note). Set it at creation in
  the sources that know the date — birthday/anniversary (`src/server/reminders.ts`),
  share-invite emission (`SHARING`), sync-window notifications (`SYNC_STATUS`).
  Backfill is a no-op (existing rows → null → "no event").
- Add one named threshold constant for the **aged** window (default 7 days) —
  no scattered literals.

### Compute
- Derive two per-row flags where the feed is assembled (`src/server/notifications.ts`
  or the component, per the brief): `aged` = `createdAt < now − AGED_WINDOW`;
  `eventPassed` = event date/expiry in the past **and** the underlying action
  no longer valid (don't infer "passed" from age alone).

### Render (both surfaces)
- Apply the brief's muted treatment in `notification-bell.tsx` rows — desktop
  dropdown **and** mobile overlay — using the existing opacity/text tokens.
  Desaturate the category icon tile only if the brief says so.
- Add the event-passed affix (e.g. "Passed"/"Expired") per the brief; confirm
  it fits the narrower mobile row without truncating the title.
- Honour the brief's rules for **unread** (age softens but doesn't clear
  unread) and the **unread badge count**.
- **No auto-hide / no auto-dismiss** unless the brief explicitly specified a
  separate cap — muting is visual only; the row stays dismissible.

## Acceptance
- On a seeded feed spanning ages: a notification created **8+ days** ago
  renders in the muted register in **both** the desktop dropdown and the mobile
  full-screen overlay; a **fresh** (< 7 day) one renders normally. Verified at
  both densities.
- A birthday/anniversary `REMINDERS` notification whose date is **now in the
  past** renders muted with the "Passed" affix even if it is only a day or two
  old (event-passed fires independently of the aged threshold).
- An expired `SHARING` invite renders muted with its deep-link action
  disabled/repointed per the brief; a still-valid but old invite keeps a live
  action.
- Unread badge behaves per the brief (aged/passed unread items still counted
  unless the brief said otherwise); no notification is silently marked read or
  hidden by the aging pass.
- No regression to the existing fresh/earlier grouping, dismiss, or
  `relativeTime` rendering.

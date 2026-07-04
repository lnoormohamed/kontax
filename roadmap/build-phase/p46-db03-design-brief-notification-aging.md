# P46-DB03 — Design brief: notification aging & event-passed states (desktop + mobile)

Status: **Pre-plan** · Priority: P0 · Depends: —
Phase: [Phase 46](phase-46-alphabet-scrubber.md)
Feeds: [P46-06](p46-06-notification-aging-treatment.md)
Extends: [P22-DB05](p22-db05-design-brief-notifications.md) (the original notification UI brief)

> Design brief front-runs its build. This one settles **how a notification
> visibly ages** — a notification that is stale by time (older than ~7 days) or
> whose underlying event has already passed should read as *past*, not as a
> live call to action. The build ([P46-06](p46-06-notification-aging-treatment.md))
> implements against the decisions here. Because it touches the same surfaces
> as the original notification brief, this extends [P22-DB05](p22-db05-design-brief-notifications.md)
> rather than replacing it.

## Why (verified 2026-07-04)

The notification system already exists and is fully built — this is a polish
pass on it, not a new feature:

- **Model has no age/expiry concept.** `Notification`
  (`prisma/schema.prisma:1604-1627`) stores `createdAt`, `read`, `readAt`,
  `dismissedAt`, `category`, `actionUrl` — but **no `expiresAt` and no event
  date**. The feed query (`getNotificationFeed`, `src/server/notifications.ts`)
  is `where: { userId, dismissedAt: null }`, `orderBy: createdAt desc`,
  `take: 20`. Nothing ages out; a notification stays visually "live" forever
  until dismissed.
- **Only one time-tier exists today.** `notification-bell.tsx` (~lines 127-133)
  splits the feed into **fresh** (unread OR created < 24 h ago) and **earlier**
  (read AND ≥ 24 h). That's a *grouping*, not a *muting* — an "earlier" item
  still renders at full strength. There is no third tier for genuinely stale
  items.
- **Relative time is already rendered.** `relativeTime()`
  (`notification-categories.ts:25-35`) emits `now / 2m / 1h / 3d / 1w`, shown
  per row (~line 194). So "this is a week old" is already legible to the user —
  the styling just doesn't reflect it.
- **Two rendering surfaces, one component.** `notification-bell.tsx` renders a
  **360 px desktop dropdown** and a **full-screen mobile overlay**
  (`max-md:fixed inset-0 max-md:z-[100]`, ~line 250). Whatever "aged" looks
  like must be specified for both densities.
- **Some notifications are intrinsically event-bound.** `REMINDERS`
  (birthday/anniversary, `src/server/reminders.ts`) and `SYNC_STATUS` window
  notifications reference a **dated event**; `SHARING` notifications carry an
  `actionUrl` deep-link to an invite that can itself expire. "The event has
  passed" is a real, distinct state from "this is just old."
- **Muted/greyed vocabulary already exists in the app** to reuse:
  `opacity-45`/`opacity-50` for disabled, secondary text tokens `#8b938c` /
  `#5c655e` / `#aeb4ac`, unread dot `#4158f4`, unread row tint `#f9faf8`.

## The two triggers (keep them distinct)

The brief must treat these as **separate** conditions — they can co-occur but
mean different things:

1. **Aged (time-based).** `createdAt` older than the threshold (start at
   **7 days**; make it one named constant, not a scattered literal). Meaning:
   "still true, just old." Reversible only by time.
2. **Event-passed (state-based).** The notification points at a moment that is
   now in the past or an action that is no longer actionable — a birthday that
   already occurred, a sync window that closed, a share invite that expired.
   Meaning: "the thing this was about is over." This one can fire on a
   *fresh* notification (a reminder created for tomorrow's birthday is not
   passed; the day after, it is).

## Decisions to make

### 1. What "aged" and "event-passed" look like
- Recommend a **muted treatment**, not hiding: reduce the row (icon tile +
  text) toward the `opacity-45`–`#8b938c` register so it reads as background,
  while staying readable and dismissible. Decide whether the **category icon
  tile desaturates** or only the text dims.
- Decide if event-passed adds a **label affix** (e.g. a small "Passed" /
  "Expired" tag) versus muting alone. Recommend an affix for event-passed
  (it explains *why* it's greyed) and mute-only for merely-aged.
- Decide the interaction with the existing **unread** styling: an aged item
  that is still unread — does it keep the blue dot, or does age win? Recommend
  age softens but does **not** clear unread (don't silently mark things read).

### 2. Does aging change grouping or just styling?
- Option A: pure restyle in place, within today's fresh/earlier split.
- Option B: add a third **"Older"** section below "earlier" that collects
  aged items. Recommend **A** for v1 (least disruption; the 20-item
  `FEED_LIMIT` means few aged items surface anyway) and note B as a follow-up
  if the feed ever paginates.

### 3. Actionability of event-passed notifications
- For an event-passed item with an `actionUrl` (e.g. an expired share invite):
  decide whether the deep-link stays live, is **disabled**, or is repointed.
  Recommend: keep the link live only if the target is still valid; disable
  (with the "Expired" affix) when the underlying action is genuinely gone.
  The build must derive validity, not guess from age.

### 4. Unread badge & auto-dismiss policy
- Does an aged/passed notification still count toward the **unread badge**?
  Recommend passed/aged unread items still count (don't hide unread work) but
  the brief should state it explicitly.
- **No silent auto-hide** in v1 — muting is visual only, the audit trail
  stays. If a hard cap is wanted (e.g. drop dismissed+aged after 90 days via a
  cron), spec it as a **separate, explicit** decision with a `log()`-style
  note, not as a side effect of greying.

### 5. Where the event date comes from (the key data decision)
- The model has **no event/expiry field** today. Options:
  - (a) add a nullable `eventAt` / `expiresAt` to `Notification` (mind the
    `db push` deploy note; backfill existing rows as null → treated as
    "no event"), set at creation by the sources that know the date
    (`reminders.ts`, share-invite creation, sync-window notifications); or
  - (b) derive event-passed per-category at read time from the linked entity.
  - Recommend **(a)** — an explicit `eventAt`/`expiresAt` is cheaper to render
    and honest; only the emitting source knows the real event moment. Record
    the storage/backfill plan the way [P46-DB02](p46-db02-design-brief-contact-photo-model.md)
    did for photos.

### 6. Desktop vs mobile density
- Same rules both places; specify the muted spec at **360 px dropdown** row
  height and at **full-screen mobile overlay** row height, and confirm the
  "Passed/Expired" affix still fits the narrower mobile row without truncating
  the title.

## Deliverable
A short brief in `roadmap/design-briefs/` (e.g. `p46-db03-notification-aging.md`)
recording decisions 1–6: the two trigger definitions + threshold constant, the
muted visual spec for both surfaces (with the exact opacity/token values), the
event-passed affix + actionability rule, the unread/auto-dismiss policy, and
the chosen data-model change (field vs derivation) with its backfill note —
enough that [P46-06](p46-06-notification-aging-treatment.md) builds without
re-litigating. Cross-link from [P22-DB05](p22-db05-design-brief-notifications.md).

# P24B-DB21 — Design Brief: Sync (mobile) + plan variance

## Purpose

Design the mobile **Sync** tab to the design language and pin down every plan/lifecycle variant —
connection cards, statuses, add flow, Free upsell, account cap, and read-only. Formalises what was
built ad-hoc in `MobileSyncScreen` so it's reviewed and consistent.

## Background

Sync is a bottom-nav tab (Plain "Sync" header). `MobileSyncScreen` (md:hidden) shows connection cards;
the desktop `SyncPageClient` takes over full-screen for a selected connection (`?account=`) or the add
form (`?add=1`). Entitlements: `cardDavSyncEnabled` is **false on Free** (whole feature gated),
`syncAccountsLimit` = 5 on Pro+ (1-ish on Free). Account status enum: `ACTIVE / PAUSED / NEEDS_REAUTH /
ERROR`. Build: **P24B-10** — redo/confirm against this brief. Spec §E5.

## Scope

**In scope:** the mobile Sync summary (cards + add) and its variance. **Out of scope:** the connection
detail / add form internals (the desktop client, used full-screen on mobile); sync engine.

## Design Requirements

### Chrome
Plain "Sync" header + bottom nav.

### Connection card (per account)
`GroupCard` of rows. Each row (tap → `/sync?account=<id>`):
- **Icon tile** 38px, `green-tint`, refresh/sync glyph (`green`).
- **Name** 15/600 `ink`.
- **Status line** 12.5, tone by status:
  - `ACTIVE` → "Synced {relative}" / "Connected" (`mute`), **green** dot `#2f9e5e`.
  - `PAUSED` → "Paused" (`amber`), **amber** dot.
  - `NEEDS_REAUTH` → "Reconnect needed" (`red`), **red** dot.
  - `ERROR` → error message / "Sync error" (`red`), **red** dot.
- **Status dot** 9px on the right.

### Add connection
Dashed "+ Add connection" button (`blue`, 48px) → `/sync?add=1`. **Disabled** (faint, dashed grey)
with a reason caption when at the cap or read-only.

### States
- **Empty (has access, 0 accounts):** centered icon tile + "No sync connections yet" + description +
  Add button.
- **Populated:** the card list + Add.
- **Offline:** offline banner; Add disabled.

### Variance (per DB14) — the crux
- **Free (`cardDavSyncEnabled = true`, `syncAccountsLimit = 1`):** Free **includes 1 sync account** —
  show the normal card list + Add. At 1/1 the Add is **disabled** with "Free includes 1 sync account."
  + an **"Upgrade to Pro for up to 5."** link (→ `/pricing`). (Product decision, implemented in
  P24B-10: Free gets one included account, not a blanket upsell. A pure `UpsellCard` is retained only
  as a defensive fallback should a plan ever set `cardDavSyncEnabled = false`.)
- **Pro+:** up to `syncAccountsLimit` (5) accounts; **Add disabled at the cap** with "You're using all N
  sync accounts." caption (no upgrade nudge — already top tier).
- **Read-only (GRACE/LOCKED):** `ReadOnlyBanner` at top; Add disabled with "Your account is read-only."

### Interactions
Tap a card → full-screen connection detail (`?account=`). Add → full-screen add form (`?add=1`). The
detail/add back button returns to the summary (`/sync`).

### Deliverables
Annotated frames: populated cards (mixed statuses), empty, Free upsell, at-cap (Add disabled),
read-only, offline.

## Acceptance Criteria (design sign-off)

- Connection cards match the design (icon tile · name · status line · dot) with the four status tones.
- Free shows the upsell only (no cards/add); Pro+ caps at the limit; read-only disables Add with reason.
- Add + tap deep-link to the full-screen detail/add; back returns to the summary.
- Empty / offline states designed.

## Dependencies / Risks

- Mirror server entitlement enforcement exactly (`cardDavSyncEnabled`, `syncAccountsLimit`) so UI and
  server agree — confirm the Free behaviour (pure upsell vs 1 included account).
- Implemented by **P24B-10**; variance per **P24B-DB14**.

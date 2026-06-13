# P24B-10 — Sync: plan variance (Free CardDAV upsell / account cap)

Status: Done — built against P24B-DB21. **Free includes 1 sync account**
(`cardDavSyncEnabled=true`, `syncAccountsLimit=1`): at 1/1 the Add is disabled with
"Free includes 1 sync account. Upgrade to Pro for up to 5." (→ `/pricing`). Pro+
caps at 5 with "You're using all N sync accounts."; read-only and offline both
disable Add with their own reason + banner. (Reverses the earlier pure-`UpsellCard`
treatment — product decision: Free gets one included account, matching the original
`Sync (Mobile) Spec` design. The `cardDavEnabled=false` upsell branch is retained as
a defensive fallback for a hypothetical fully-gated plan.)

Mobile flow extension (beyond the original DB21 summary scope — the brief had
deferred the detail/add/edit internals to the desktop client; that left an
undesigned destination). `SyncPageClient` made responsive at ≤767px against the
`Sync Connections.html` design:
- Account rail is now desktop-only (always hidden on mobile — `MobileSyncScreen`
  is the mobile list); the detail pane always shows. Removed the fragile
  `mobilePane` state whose stale `list` value showed the rail after a client nav.
- Sync-history table and conflict comparison grid stack into labelled rows
  (`data-th`) instead of overflowing; the re-auth modal becomes a bottom sheet.

## Purpose

Apply plan variance to the mobile Sync screen: Free has no CardDAV sync and a 1-account ceiling, so the
screen should upsell or cap rather than offer unlimited "Add connection".

## Background

P24A shipped `MobileSyncScreen` (connection cards + add deep-link) for the populated/empty cases, but it
doesn't yet reflect entitlements: `cardDavSyncEnabled=false` and `syncAccountsLimit=1` on Free, `5` on
Pro+.

## Scope

**In scope:** Free upsell / account-cap behavior on the mobile sync summary + add flow. **Out of
scope:** the desktop sync client and the connection detail internals (already usable full-screen).

## Design / Implementation Spec

Per spec §E5 and §E0.2.
- **Free** (`cardDavSyncEnabled=false`): the screen is an `UpsellCard` ("Sync is a Pro feature") — or,
  if product prefers, allow the single included account with "Add connection" disabled past 1. Match
  the entitlement actually enforced server-side.
- **Pro+**: up to `syncAccountsLimit` (5) — disable Add at the cap with an explanatory note.
- **Read-only** (GRACE/LOCKED): Add disabled.

## Acceptance Criteria

- Free user sees the correct gate (upsell or 1-account cap) consistent with server enforcement.
- Pro+ can add up to 5; Add disables at the cap with a reason.
- Read-only disables Add.
- Populated/empty states from P24A still correct.

## Risks and Open Questions

- Confirm the product intent for Free: pure upsell vs "1 account included". Mirror whatever
  `entitlement` enforcement does so UI and server agree.

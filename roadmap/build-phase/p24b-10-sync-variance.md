# P24B-10 — Sync: plan variance (Free CardDAV upsell / account cap)

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

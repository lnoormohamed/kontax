# P24B-19 — Auth & public surfaces mobile verification pass

## Purpose

Verify and fix (small) the auth, account-status, legal, and invite-join pages on mobile — the
centered-card and long-form patterns that the sweep expects to be fine but didn't all eyeball.

## Background

`/forgot-password` and `/` (landing) verified good; the rest of the auth family shares the centered-card
pattern. Privacy/terms, account-status, and join-token pages weren't directly viewed at 375px.

## Scope

**In scope:** verify + small fixes for `login, login/verify-2fa, register, reset-password,
verify-email, account-deleted, account-pending-deletion, privacy, terms, family/join/[token],
teams/join/[token]`. **Out of scope:** any redesign — these follow existing patterns.

## Design / Implementation Spec

Per spec §E9–E10.
- **Auth (centered card):** full-width with 16px gutter `< 768`, wordmark, title 22–24/700, labelled
  inputs ≥16px, full-width primary, secondary link, legal footer. 2FA = code entry + resend.
- **Account status:** centered card + single CTA.
- **Legal (privacy/terms):** comfortable measure, 16px gutter, readable line-height.
- **Invite join:** centered card — who invited you, what you get, one Accept CTA + decline link.

## Acceptance Criteria

- Each listed page verified at 375px: no overflow, ≥16px inputs, ≥44px targets, readable.
- 2FA code entry usable on mobile (numeric keyboard, resend).
- Invite-join pages present a clear single Accept action.
- Any issues found are fixed (small) or split into a follow-up ticket if larger.

## Risks and Open Questions

- Some pages are state-gated (valid 2FA challenge, valid invite token) — may need seeded states to
  fully verify.

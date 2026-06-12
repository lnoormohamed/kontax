# P24B-03 — Plan/role/lifecycle variance primitives

## Purpose

Build the reusable components that express plan, billing-lifecycle, and group-role variance, so every
mobile page renders gated/limited/read-only/role states consistently instead of each page inventing its
own treatment.

## Background

The same route renders differently along four axes (spec §E0): plan (FREE/PRO/FAMILY/TEAMS), lifecycle
(read-only on GRACE/LOCKED), group role (OWNER/ADMIN/MEMBER), and per-resource permission. P24B
build tickets all depend on a shared set of treatments; defining them once keeps copy, color, and
behavior identical.

## Scope

**In scope:** the shared primitives below + a thin `usePlanContext`/props pattern to feed them.
**Out of scope:** wiring them into each page (that happens in the per-page tickets).

## Design / Implementation Spec

Per spec §E0.4 and §C. Build:

1. **`UpsellCard`** — centered `wash` rounded icon, "<Feature> is a <Plan> feature", value prop, `blue`
   "Upgrade to <Plan>", "You're on the <Plan> plan." Must fit `w-full max-w-[460px]`. Reused by
   Activity (Free), Sharing tab (Free), Sync/CardDAV (Free), Family/Team setup.
2. **`NearLimitBanner`** — amber under-header banner: "{used} of {limit} … remaining" + Upgrade link.
   At-limit variant disables the caller's create affordance.
3. **`ReadOnlyBanner`** — `red-t` banner: "Your account is read-only. {reason}" + "Manage plan".
4. **`PendingChip`** — muted chip for `inviteStatus = PENDING` rows.
5. **`PermissionGate`** — helper/HOC: given role + required capability, **render nothing** (hide) for
   role-gated controls; render `disabled + reason` only for temporary gates (offline / read-only).

Inputs come from `planSummary` (plan, lifecycleState, lifecyclePolicy.canWrite, entitlements) and
`GroupMember` (role, canEdit, addressBookPermissions, inviteStatus) — already loaded server-side.

## Acceptance Criteria

- All five primitives exist, themed per Part A tokens, and match the Activity-locked card as the
  reference for `UpsellCard`.
- `PermissionGate` hides (not disables) role-gated controls; disables-with-reason for offline/read-only.
- Primitives are presentational and take plain props (no data fetching), so any page can use them.
- Storybook/example or a temporary `/wireframes` demo shows each state (optional but encouraged).

## Risks and Open Questions

- Confirm the exact upsell target plan per feature (e.g., Activity → "Pro", Family setup → "Family").
- `canWrite` already exists on `lifecyclePolicy`; ensure read-only disables the *same* affordance set
  everywhere (FAB, swipe-edit, edit/save, add-connection, invite).

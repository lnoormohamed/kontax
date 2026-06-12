# P24B-DB14 — Design Brief: Mobile variance & gating system

## Purpose

Specify the design for how every mobile surface expresses **plan, billing-lifecycle, and group-role
variance** — upsell, near/at-limit, read-only, and permission-gated states — so the experience is
consistent across all P24B build tickets instead of each page inventing its own treatment.

## Background

The same route renders differently along four axes (contacts limit, activity lock, sync cap, sharing
gate, owner-vs-member controls, read-only on billing failure). Without a shared design these states
drift. This brief is the design contract that build ticket **P24B-03** (variance primitives) implements
and every other build ticket consumes. Underlying model is captured in
`roadmap/mobile-pwa-design-spec.md` §E0.

## Scope

**In scope:** the visual + interaction design for the five variance treatments and the rules for which
to use when. **Out of scope:** the entitlement/enforcement logic (server-side, already built); per-page
wiring (the build tickets).

## Design Requirements

### Axes the design must cover
1. **Plan** — FREE / PRO / FAMILY / TEAMS (feature gates).
2. **Lifecycle** — ACTIVE / TRIALING / GRACE / CANCELED / LOCKED (GRACE/LOCKED → read-only).
3. **Role** — OWNER / ADMIN / MEMBER (group management capability).
4. **Per-resource** — `canEdit`, `addressBookPermissions`, `inviteStatus`.

### Treatments to design (tokens per spec Part A)
- **UpsellCard** — centered `wash` rounded icon (56–64px), "<Feature> is a <Plan> feature" (17/700),
  value-prop body (13.5 `mute`), `blue` "Upgrade to <Plan>" button, "You're on the <Plan> plan." caption.
  Fits `w-full max-w-[460px]`. Reference = the Activity-locked card.
- **NearLimitBanner** — amber (`amber-t`) under-header banner: "{used} of {limit} … remaining" + Upgrade
  link. **At-limit** variant disables the caller's create affordance.
- **ReadOnlyBanner** — `red-t` banner: "Your account is read-only. {reason}" + "Manage plan" link.
- **PendingChip** — muted chip for `inviteStatus = PENDING` member rows + resend/revoke affordance.
- **PermissionGate** — hide controls a role cannot use; never render them disabled for role gates.

### Rules (must be encoded in the design)
- **Hide vs disable:** role gates → *hide* the control. Temporary gates (offline, read-only) → *disable
  with a short reason*. Never show a control a member can't use.
- **Empty-because-plan vs empty-because-new:** an upsell must never be styled as "no data yet," and a
  genuine empty must never imply an upgrade.
- **Read-only affordance set:** GRACE/LOCKED disables the *same* set everywhere — FAB, swipe-edit,
  edit/save, add-connection, invite — while keeping owned data visible and basic export available.

### States to deliver (per treatment)
default · at-limit (banner) · offline · read-only · role-hidden. Provide the who-sees-what coverage
for the most-affected pages (spec §E0.5) as the design's acceptance reference.

### Deliverables
- Annotated specs for the five treatments (tokens, spacing, copy slots).
- The hide-vs-disable + empty-vs-upsell rules written into the spec (done in §E0; keep in sync).
- A reference frame/screenshot of each treatment (Activity-locked exists; add the others).

## Acceptance Criteria (design sign-off)

- All five treatments specified to Part A tokens with copy slots and states.
- Hide-vs-disable and empty-vs-upsell rules unambiguous.
- Who-sees-what table (§E0.5) approved as the variance acceptance reference.

## Dependencies / Risks

- Confirm the correct upsell *target plan* per feature (Activity→Pro, Family setup→Family, etc.).
- Mirror server enforcement exactly so UI gates and entitlement checks agree.
- Implemented by **P24B-03**; consumed by all per-page build tickets.

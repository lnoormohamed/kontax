# P38-04 — Request-Scoped Billing & Shared-Context Cache

## Purpose

Deduplicate per-request work that multiple server components repeat today —
most visibly the billing context, which is computed by the page **and** again
by `BillingBannerSlot` on every authenticated view.

## Background

`auth()` is already wrapped in React `cache()` (`src/server/auth/index.ts`) so
it dedupes within a request. Nothing else is:

- `getUserPlanSummary` (`src/server/billing.ts:273`) → `getUserBillingContext`
  + 4 parallel queries. Called by `contacts/page.tsx`, `contacts/[id]/page.tsx`,
  settings pages, import-export, sync, shares…
- `getBillingBanner` (`src/server/billing-surface.ts:312`) independently calls
  `getUserBillingContext` again, plus 2 more queries — and `BillingBannerSlot`
  renders on every shell page, so the user row + subscription lookup runs
  twice per view.
- `getNotificationFeed` / `getActiveSecurityAlerts` are single queries but the
  same pattern applies if they ever grow.

React `cache()` memoizes per request per argument list — the idiomatic Next.js
App Router fix, zero staleness risk.

## Scope

**In scope**
- Wrap in React `cache()`: `getUserBillingContext`, `getUserPlanSummary`,
  `getUserFamilyMembership`, `getAccessibleTeamBooks`, `getLabels`.
- Audit call sites to confirm all callers within one request pass the same
  `userId` (they do — it's always the session user on these paths — but the
  admin/impersonation paths must be checked before wrapping anything they
  touch).
- A short engineering note (code comment on the module) establishing the
  convention: read-only per-user context getters used by layout-level slots
  get `cache()`.

**Out of scope**
- Cross-request caching (Redis/TTL) — explicitly not this ticket; P38-09
  covers the one justified case (session validation).
- Restructuring the banner-slot component tree.

## Design / Implementation Spec

```ts
import { cache } from "react";

export const getUserBillingContext = cache(async (userId: string) => { … });
```

- Mutating actions that need a fresh read after a write within the same
  request (e.g. `assertCanCreateContacts` after an insert) must be checked:
  `cache()` would return the pre-write value. Audit `src/app/actions/*` for
  read-after-write on the wrapped functions; where found, keep an uncached
  internal variant (`getUserPlanSummaryUncached`) and export the cached one
  for render paths.

## Acceptance Criteria

- Prisma query log for one `/contacts` view shows `getUserBillingContext`'s
  user/subscription lookup executing once, not twice.
- No behaviour change to banner display, plan gating, or limit enforcement
  (exercise: trial banner, grace banner, contact-limit block on free plan).
- Read-after-write audit documented in the PR description with the list of
  call sites checked.

## Risks / Open Questions

- `cache()` scope is the RSC render, and server actions get their own scope —
  a write in an action followed by `revalidatePath` re-render reads fresh.
  The only hazard is read→write→read *within one action*; the audit covers it.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — convention note on cached context getters
- [ ] Internal · support/admin — none

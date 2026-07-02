# P38-03 — Contacts Page Query Consolidation

## Status
Implemented & verified 2026-07-02.

**Close-out:**
- The 9-count wave + 2 merge-suggestion counts collapsed into one
  `getWorkspaceCounts` raw query (count FILTER + scalar subselects); verified
  identical to individual counts on both the seeded account and a real
  account with live shares/notifications/sync/merge data.
- `getLabels()` turned out to be the worst offender (found during
  implementation): every view ran the registry backfill (label fetch +
  2,000-contact scan + aggregate) plus **one count query per label**. Now one
  grouped `jsonb_array_elements_text` query supplies both usage counts and
  backfill detection (extra writes only when something is missing) — and the
  2,000-contact backfill cap is gone.
- The bulk-edit label-suggestion 2,000-row scan is deleted (suggestions come
  from the registry) — this plus the P38-02 collator removal completes P38-07.
- Await tiers after auth: tier 1 (books/labels/plan/merge) → optional FTS →
  tier 2 (list windows + health + counts) → onboarding.
- Measured per view (Prisma query log, dev): **~26 real queries, down from
  ~35+** (~40+ for label-heavy users). The remaining fat is duplicated
  per-request context — billing context runs twice (page + BillingBannerSlot),
  the notification feed twice (desktop + mobile bell) — which is exactly
  P38-04's request-scoped `cache()` scope, plus `getUserPlanSummary`'s 5
  queries. The original ≤12 target lands with P38-04.

## Purpose

Reduce a `/contacts` page view from ~30 queries in 4+ sequential await waves to
a small, intentional set. The DB is a same-host container, so each query is
cheap on the wire — but 30 of them serialized into waves still stack Prisma
overhead, connection churn, and pure wall-clock serialization, and all of it
re-runs on every `revalidatePath("/contacts")`.

## Background

Current shape of one `/contacts` request (`src/app/contacts/page.tsx`):

1. `auth()` — 2 queries (user + session revocation; see P38-09)
2. Wave 1 (~line 338): family membership, team books, saved filters, personal
   books, per-book groupBy, label rows (**up to 2,000 contacts fetched just to
   build a 24-item suggestion popover**), label registry
3. Optional FTS raw queries (private + shared scopes)
4. Wave 2 (~line 452): 3 contact list queries, archived, merge suggestions,
   **2 separate mergeSuggestion counts**, recent merges, `getUserPlanSummary`
   (itself 1 + 4 queries)
5. Wave 3 (~line 526): **9 individual `count` queries**
6. `getOnboardingChecklist` — sequential, after wave 3
7. Banner slots: `NotificationBellSlot`, `BillingBannerSlot` (re-runs
   `getUserBillingContext`), `SecurityAlertBannerSlot`

## Scope

**In scope**
- Collapse the 9 counts of wave 3 plus the 2 mergeSuggestion counts into one
  or two `$queryRaw` statements using `count(*) FILTER (WHERE …)`.
- Merge waves: wave 3 has no dependency on wave 2's results, and
  `getOnboardingChecklist`'s inputs (`hasContact`, `hasSync`) can come from
  the combined counts — fold into one `Promise.all` tier where data
  dependencies allow. Target: 2 await tiers after `auth()`.
- Replace the 2,000-row label scan with the `Label` registry (`getLabels()` is
  already fetched in the same wave) as the source for bulk-edit label
  suggestions (see P38-07; do it in whichever lands first, skip in the other).
- Move health-card counts to SQL (`count FILTER`) so they don't depend on the
  full in-memory list (prerequisite for P38-02's pagination).

**Out of scope**
- Billing-context dedupe between page and banner slots (P38-04).
- List query pagination (P38-02).
- Any caching across requests.

## Design / Implementation Spec

- One raw "workspace counts" query returning: privatePeople, sharedPeople,
  favorites, emergency, archived, incomingShares, unreadNotifications,
  syncErrors, connectedSync, openMergeSuggestions, highConfidenceSuggestions —
  typed via a `z.object` or explicit interface, lives in a new
  `src/server/contacts-workspace.ts`.
- Keep per-concern helpers (`getUserFamilyMembership` etc.) — this ticket
  restructures the page's awaits, not the domain modules, except where a
  helper is trivially foldable into the counts query.
- Add a temporary dev-only query counter (Prisma `$on("query")` in
  development) or use the existing query log to assert the final number.

## Acceptance Criteria

- Prisma query log for `/contacts?tab=people` shows the agreed target count
  (document the number; expected ≤ 12 including auth) vs ~30 before.
- Await tiers after `auth()` ≤ 3 (verified by reading the page code, not
  timing).
- All counts/badges identical before/after on a seeded account with shares,
  notifications, sync errors, and open merge suggestions.

## Risks / Open Questions

- `count FILTER` over `Contact` mixes predicates that today hit different
  indexes; check `EXPLAIN` — worst case split into two raw queries (contacts
  vs. other tables) which still replaces 11 round trips with 2.
- The shared-people count spans `GroupContact` — may stay a separate query;
  that's fine, the target is "few and intentional", not "one".

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — comment the counts query; record before/after
- [ ] Internal · support/admin — none

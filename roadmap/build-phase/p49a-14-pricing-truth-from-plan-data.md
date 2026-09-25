# P49A-14 — Pricing matrix rendered from plan data; correct false claims

**Phase:** 49A · **Priority:** P1 · **Depends on:** — · **Effort:** M
**Audit IDs:** A-31, A-32, A-33, A-34

## Objective
Every public plan claim is generated from, or checked against, the entitlements the code enforces.

## Production verification (2026-09-25)
Confirmed in origin/main and on getkontax.com/pricing:
- A-31: the pricing matrix has a `Webhooks` row ticked for Pro/Teams; there is no outbound
  webhook code anywhere in `src/` or `prisma/` (0 files).
- A-32: pricing says API "5k / day" (Pro) / "20k / day" (Teams); the limiter is per token,
  `apiRead` 1,000/hour and `apiWrite` 200/hour (`rate-limit.ts:136-137`), as `/developers` says.
- A-33: "Minimum events kept" 3/25/10/All vs `historyFloorPerContact` 10/20/20/20; Teams
  "Unlimited" members vs `memberSlotsLimit: 25`; "Priority support" differs across
  `plan-data.ts:217`, `pricing-comparison.tsx:50` and `pricing/page.tsx:145-148`.
- A-34 (help FAQ): "14-day Pro trial automatically, no card" — trial only via Checkout and a card is
  collected (`actions/billing.ts:119-136`); "Family gets a full Pro account" (no API since P49);
  iCal feed / smart lists / bulk edit sold as Pro but not gated.

## Steps
1. Render the public pricing matrix from `PLAN_MATRIX`/`PLAN_ROWS` in `plan-data.ts` (same source
   as the in-app comparison modal); add a unit test asserting numeric rows equal `billing.ts`.
2. Remove the Webhooks row (or scope the feature separately); state real API limits.
3. Decide product questions and record them in the ticket before copy changes:
   (a) trial — real no-card trial or remove the claim; (b) iCal/smart lists/bulk edit — gate or
   call them "every plan"; (c) support tiers.
4. Update help FAQ and `/developers` accordingly.

## Acceptance
- Test fails if any pricing number diverges from `billing.ts`.
- No public page mentions webhooks, "5k/day" or an automatic no-card trial unless implemented.

## Resolution (2026-09-25, feat/p50-marketing-redesign)
- `/pricing` matrix and plan-card bullets render from `PLAN_MATRIX` / `planCardFeatures` in
  `plan-data.ts`, whose limits read `PLAN_DEFAULTS` (plan-entitlements.mjs). Values that live in
  server-only modules (Teams seat bounds, Free share-link TTL, API rate limits) are mirrored
  constants pinned by `tests/node/pricing-plan-data.test.ts`.
- Webhooks and "Minimum events kept" rows removed; API limit is per token (1,000/hr read-only,
  200/hr read/write); Teams members = per seat (min. 3, checkout max 500); Google sync and two-way
  sync on every plan; import is CSV or Kontax archive (no vCard import).
- No placeholder prices: without the Stripe catalogue the paid plans show no amount.
- Support: "Email support" on every plan (no tiers in code). Trial: first Pro subscription only,
  started at checkout with a card (help + FAQ say so). iCal / smart lists / bulk edit: not
  claimed as plan features on the pricing page.

# P46-13 (DB07·T2) — Kill the anchor · birth /settings/billing

Status: **Pre-plan** · Priority: P1 · Depends: P46-12
Phase: [Phase 46](phase-46-alphabet-scrubber.md) · Spec: DB07 §4/§5c

Extract the root `#plan-billing` section into a real `/settings/billing` page
(plan & usage, invoices, plan comparison; **owns seat count & purchase** —
Teams shows read-only usage, T5). `/settings` becomes a nav index on both
breakpoints. Sessions + sign-out card moves to Security (T3 companion).
Redirects: `/settings#plan-billing` → `/settings/billing` (deep-linked from
code today — Family/Teams "nogroup" rows, mobile Plan & billing row) and
**preserve Stripe return params** (`?billing=success`, `?portal=returned`)
onto the new page. Resolves smells 3, 10, 14.

Acceptance: no `#plan-billing` references remain (grep); gated Family/Teams
rows land on their own pages' upsell states; Stripe success/portal returns
render their banners on `/settings/billing`; root renders the index on
desktop too.

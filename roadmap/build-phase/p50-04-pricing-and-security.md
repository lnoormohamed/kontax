# P50-04 — `/pricing` and `/security` in Direction A

**Phase:** 50 · **Priority:** P1 · **Effort:** M · **Depends on:** P50-02, P49A-14

## Objective
Rebuild the two proving pages from the prototype (`?view=pricing`, `?view=security`).

## Scope
- **Pricing:** centred head ("Free until you need more"), monthly/annual toggle, four plan cards
  (Pro highlighted "Most flexible"), "Every limit, in one table" matrix with category rows and
  the Pro column tinted, billing FAQ ("Before you choose"), stone CTA band. Every price comes
  from Stripe and every limit from `billing.ts`/`plan-data.ts` — the prototype marks these as
  `stripe:` / `billing.ts` slots. P49A-14 (render the matrix from plan data) lands first so
  this ticket only restyles it.
- **Security:** restyle the existing sections with the section-head grid, facts cards and the
  hairline-wire diagrams from the prototype. Keep claims to the verified list (no backup
  encryption claim until it ships).
- Every plan card has a clear primary action.

## Acceptance
- Visual parity at 1440 and 375; matrix scrolls horizontally inside its container on mobile.
- A unit test (from P49A-14) proves pricing numbers equal `billing.ts`.
- No claim on either page that isn't in the P50-DB01 fact list.

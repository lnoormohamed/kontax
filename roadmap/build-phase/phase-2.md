# Phase 2 — SaaS Billing and Operational Structure

## Objective
Introduce subscription and entitlement planning early enough that Kontax can monetize cleanly later, without forcing billing to block the core consumer contacts experience.

## Success Criteria
- Subscription-related schema direction is defined.
- Billing boundaries and provider assumptions are explicit.
- Plan tiers and entitlement gates map to contact features realistically.
- Lifecycle, audit, quota, and retention behaviors are documented.

## Exit Criteria
- Product is still single-user first.
- Billing can be added without reworking core contact ownership or auth.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P2-01 | Done | P0 | P1-01 |
| P2-02 | In Progress | P0 | P2-01 |
| P2-03 | In Progress | P1 | P2-01 |
| P2-04 | Not Started | P1 | P1-04, P2-01 |
| P2-05 | Not Started | P1 | P2-02 |
| P2-06 | Not Started | P2 | P2-05 |

## P2-01 — Define subscription customer and subscription records
- Status: `Done`
- Priority: `P0`
- Dependencies: `P1-01`
- Implementation Notes:
  - Prisma schema now includes `SubscriptionCustomer` and `Subscription` tied directly to a single `User`.
  - Provider identity, subscription identifiers, lifecycle timestamps, and cancellation metadata have concrete schema fields.
  - Billing ownership remains separate from contact ownership while staying linked to the account root.
- Acceptance Criteria:
  - Billing entities and relationships are clearly documented.
  - Future provider integration does not require ownership redesign.
- Risks / Open Questions:
  - Need to avoid prematurely modeling organization billing while still supporting future growth.

## P2-02 — Define plan tiers and entitlements
- Status: `In Progress`
- Priority: `P0`
- Dependencies: `P2-01`
- Implementation Notes:
  - Prisma schema now includes `SubscriptionPlan` plus entitlement-oriented fields like `contactsLimit`, `monthlyImportLimit`, `syncAccountsLimit`, `advancedMergeEnabled`, `premiumExportEnabled`, and `cardDavSyncEnabled`.
  - Next implementation pass should decide the exact product-level limits for free vs paid tiers and where enforcement will live in app logic.
  - Include upgrade/downgrade behavior assumptions.
- Acceptance Criteria:
  - Plan boundaries are documented and feature-relevant.
  - Entitlement checks can be implemented independently of billing UI.
- Risks / Open Questions:
  - Overly strict limits can create migration pain later.

## P2-03 — Choose billing provider integration boundary
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P2-01`
- Implementation Notes:
  - Schema is Stripe-ready through `BillingProvider`, provider customer IDs, and provider subscription IDs.
  - Next pass should define where webhook handlers, invoice events, and customer portal entry points attach to app services.
  - Keep provider-specific fields isolated from the rest of the domain.
- Acceptance Criteria:
  - Integration boundary is explicit.
  - Billing provider assumptions are documented without locking UI scope too early.
- Risks / Open Questions:
  - Need a clean abstraction so future provider swaps remain possible.

## P2-04 — Define billing and account lifecycle audit requirements
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P1-04`, `P2-01`
- Implementation Notes:
  - Audit subscription creation, trial start, renewal, payment failure, cancellation, and lockout transitions.
  - Decide which lifecycle events must be immutable and support support/debug workflows.
- Acceptance Criteria:
  - Billing-relevant audit events are cataloged.
  - Sensitive state transitions are traceable.
- Risks / Open Questions:
  - Event volume and retention policy may matter later for support tooling.

## P2-05 — Define account lifecycle states and enforcement
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P2-02`
- Implementation Notes:
  - Document `active`, `trialing`, `grace`, `canceled`, and `locked` behavior.
  - Decide what features remain accessible in grace or canceled states, especially export rights and read-only access.
  - Separate authentication from entitlement enforcement so access decisions remain predictable.
- Acceptance Criteria:
  - Lifecycle states and transitions are unambiguous.
  - Read/write/export behavior per state is documented.
- Risks / Open Questions:
  - Export rights after cancellation are product-sensitive and should be explicit.

## P2-06 — Plan cleanup, retention, and quota jobs
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P2-05`
- Implementation Notes:
  - Define background jobs for stale export cleanup, import artifact cleanup, quota recalculation, and retention enforcement.
  - Include how billing state interacts with queued jobs and retained files.
- Acceptance Criteria:
  - Operational jobs and their triggers are documented.
  - Cleanup policies align with security and support expectations.
- Risks / Open Questions:
  - File retention may become a cost issue once imports/exports scale.

# Phase 1 — SaaS Foundation and Secure Contact Core

## Objective
Define the canonical consumer SaaS data foundation for Kontax, including account ownership, contact structure, normalization strategy, security baseline, and the minimum dashboard/contact milestone that future import, merge, billing, and sync phases can safely build on.

## Success Criteria
- Canonical schema direction for user-owned contacts is documented and stable.
- Security and encryption baseline decisions are explicit and practical.
- The contact model supports future import/export, duplicate detection, and CardDAV-safe identifiers.
- Consumer v1 scope boundaries are explicit and prevent premature workspace complexity.

## Exit Criteria
- Schema direction is stable.
- Security baseline is documented.
- Contact model is ready for import/export and merge layers.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P1-01 | Done | P0 | None |
| P1-02 | Done | P0 | P1-01 |
| P1-03 | Done | P0 | P1-01 |
| P1-04 | Done | P0 | P1-03 |
| P1-05 | Done | P1 | P1-01 |
| P1-06 | Done | P1 | P1-02, P1-03 |

## Ticket Template
- Status: `Not Started`
- Priority:
- Dependencies:
- Implementation Notes:
- Acceptance Criteria:
- Risks / Open Questions:

## P1-01 — Define canonical consumer SaaS schema
- Status: `Done`
- Priority: `P0`
- Dependencies: `None`
- Implementation Notes:
  - Define `User` as the root owner for all contact records in v1.
  - Add planning structures for future `SubscriptionCustomer`, `Subscription`, `AuditEvent`, and background job tables without introducing workspace ownership yet.
  - Decide on canonical IDs using internal immutable IDs plus future-safe external identifiers.
  - Specify archive/soft-delete behavior for contacts and account lifecycle states at the schema level.
  - Canonical blueprint completed in `roadmap/build-phase/p1-01-canonical-schema.md`.
- Acceptance Criteria:
  - A documented schema blueprint exists for `User`, `Contact`, `ContactIdentifier`, `ContactSource`, `AuditEvent`, and job tables.
  - Ownership, deletion, and indexing expectations are unambiguous.
  - Future subscription and sync tables can attach without changing core ownership assumptions.
- Risks / Open Questions:
  - Over-designing for teams too early could slow consumer delivery.
  - Need to preserve a clean path to future shared books without polluting v1 UX.

## P1-02 — Define contact normalization and indexing strategy
- Status: `Done`
- Priority: `P0`
- Dependencies: `P1-01`
- Implementation Notes:
  - Split canonical contact data from repeated identifiers.
  - Plan normalized email and phone representations for search, duplicate detection, and sync.
  - Include source metadata for manual, imported, and future synced records.
  - Define indexes that optimize user-scoped search and duplicate candidate generation.
  - Normalization and indexing blueprint completed in `roadmap/build-phase/p1-02-contact-normalization-and-indexing.md`.
- Acceptance Criteria:
  - Normalized fields and lookup rules are documented.
  - `ContactIdentifier` and `ContactSource` responsibilities are clear.
  - Search and duplicate-related index assumptions are listed.
- Risks / Open Questions:
  - Phone normalization strategy may differ by region and should avoid overfitting too early.

## P1-03 — Define auth, session, and password policy
- Status: `Done`
- Priority: `P0`
- Dependencies: `P1-01`
- Implementation Notes:
  - Standardize credentials login, session duration, session invalidation, and reset placeholders.
  - Lock password hashing policy, migration stance, and rehash strategy.
  - Define account recovery and email verification placeholders even if they are not fully implemented in this phase.
  - Include session-related audit event hooks for sign-in, sign-out, and credential changes.
  - Auth/session/password blueprint completed in `roadmap/build-phase/p1-03-auth-session-and-password-policy.md`.
- Acceptance Criteria:
  - Auth/session flows are documented at a system level.
  - Password policy and rehash strategy are explicit.
  - Future verification/reset work can be implemented without redesigning account data.
- Risks / Open Questions:
  - Email delivery strategy may be deferred but placeholders must not mislead implementers.

## P1-04 — Document encryption and security baseline
- Status: `Done`
- Priority: `P0`
- Dependencies: `P1-03`
- Implementation Notes:
  - Define transport security, secret storage, password hashing, backup encryption assumptions, and provider-managed at-rest encryption.
  - Distinguish between current baseline protections and future field-level encryption.
  - Plan immutable security audit records for auth, deletion, import, merge, export, and sync actions.
  - Include key management expectations for future sync credentials and encrypted sensitive fields.
  - Encryption and security baseline completed in `roadmap/build-phase/p1-04-encryption-and-security-baseline.md`.
- Acceptance Criteria:
  - A clear baseline security model is documented.
  - Future field-level encryption is framed as an extension, not implied as already solved.
  - Audit requirements cover all sensitive operations.
- Risks / Open Questions:
  - Search on encrypted fields is expensive and should remain explicitly out of early scope.

## P1-05 — Lock consumer v1 boundaries
- Status: `Done`
- Priority: `P1`
- Dependencies: `P1-01`
- Implementation Notes:
  - Document what v1 is and is not.
  - Confirm single-user ownership, no workspaces, no family sharing, no CardDAV yet, and no CRM-heavy workflows.
  - Clarify what “consumer-first SaaS” means for onboarding, data portability, and product tone.
  - Consumer boundary document completed in `roadmap/build-phase/p1-05-consumer-v1-boundaries.md`.
- Acceptance Criteria:
  - Scope boundaries are explicit enough to reject out-of-phase work.
  - Product assumptions align with roadmap decisions in later phases.
- Risks / Open Questions:
  - Family sharing and shared books should be listed as future-compatible but deferred.

## P1-06 — Define dashboard and contact CRUD milestone
- Status: `Done`
- Priority: `P1`
- Dependencies: `P1-02`, `P1-03`
- Implementation Notes:
  - Describe the minimum end-to-end milestone for phase completion.
  - Include account signup/login, a basic dashboard shell, create/edit/archive/delete contact flows, and user-scoped contact listing/search.
  - Ensure CRUD behavior respects normalization, audit hooks, and future import/merge layers.
  - Milestone blueprint completed in `roadmap/build-phase/p1-06-dashboard-and-contact-crud-milestone.md`.
- Acceptance Criteria:
  - A concrete “phase complete” milestone is documented.
  - Dashboard/contact CRUD scope is clear enough to hand to implementation.
- Risks / Open Questions:
  - Archive vs hard-delete behavior should align with audit and export expectations.

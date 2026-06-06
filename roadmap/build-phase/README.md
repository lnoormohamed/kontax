# Kontax Build Roadmap

## Summary
Kontax is being built as a consumer-first SaaS contacts platform with single-user ownership in v1, practical strong security defaults, import/export before CardDAV, and billing foundations introduced early without blocking the core contact experience.

This roadmap is the implementation source of truth for phases 1-6. Each phase file contains detailed tickets, dependencies, implementation notes, acceptance criteria, and progress tracking.

## Goals
- Ship a trustworthy personal contacts product with strong foundations for future SaaS growth.
- Design the data model to support imports, exports, duplicate handling, subscriptions, and future sync.
- Keep v1 decision-making optimized for consumer usage, not teams or workspaces.
- Treat security, auditability, and data portability as first-class product pillars.

## Non-Goals
- Multi-workspace collaboration in the first release.
- Enterprise compliance programs in the first release.
- Full CardDAV sync in the earliest shipping milestone.
- Deep CRM automation or sales pipeline features in the first 5 phases.

## Ticket Status Definitions
- `Not Started`: No implementation work has begun.
- `In Progress`: Active implementation or validation is underway.
- `Blocked`: Work cannot continue due to a dependency or unresolved decision.
- `Done`: Acceptance criteria are satisfied and the phase artifact is complete.

## Master Progress Tracker
| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | 1 | Done | P0 | None | Unassigned | Canonical consumer SaaS schema drafted |
| P1-02 | 1 | Done | P0 | P1-01 | Unassigned | Contact normalization and indexes documented |
| P1-03 | 1 | Done | P0 | P1-01 | Unassigned | Auth/session and password policy defined |
| P1-04 | 1 | Done | P0 | P1-03 | Unassigned | Encryption baseline and audit requirements captured |
| P1-05 | 1 | Done | P1 | P1-01 | Unassigned | Consumer v1 scope and boundaries locked |
| P1-06 | 1 | Done | P1 | P1-02, P1-03 | Unassigned | Dashboard and CRUD milestone defined |
| P2-01 | 2 | Done | P0 | P1-01 | Unassigned | Subscription customer model drafted |
| P2-02 | 2 | Done | P0 | P2-01 | Unassigned | Plan and entitlement rules defined |
| P2-03 | 2 | Done | P1 | P2-01 | Unassigned | Billing provider integration boundary chosen |
| P2-04 | 2 | Done | P1 | P1-04, P2-01 | Unassigned | Billing lifecycle audit events defined |
| P2-05 | 2 | Done | P1 | P2-02 | Unassigned | Account lifecycle states and enforcement documented |
| P2-06 | 2 | Done | P2 | P2-05 | Unassigned | Retention, cleanup, and quota jobs planned |
| P3-01 | 3 | Done | P0 | P1-02 | Unassigned | Supported formats and multi-column field mapping finalized |
| P3-02 | 3 | Done | P0 | P3-01 | Unassigned | Import pipeline and preview/commit stages documented |
| P3-03 | 3 | Done | P0 | P3-01 | Unassigned | Export pipeline stages documented |
| P3-04 | 3 | Done | P1 | P3-02, P3-03 | Unassigned | Import/export job model and history metadata defined |
| P3-05 | 3 | Done | P1 | P3-02 | Unassigned | Validation, duplicate blocking, and conflict rules defined |
| P3-06 | 3 | Done | P2 | P3-02, P3-03 | Unassigned | UX preview, rollback, and history model specified |
| P4-01 | 4 | Done | P0 | P3-02, P3-05 | Unassigned | Duplicate heuristics and confidence tiers defined |
| P4-02 | 4 | Done | P0 | P4-01 | Unassigned | Merge suggestion lifecycle, statuses, and decisions set |
| P4-03 | 4 | Done | P1 | P4-02 | Unassigned | Suggested review and manual pairwise merge flows specified |
| P4-04 | 4 | Done | P1 | P4-03 | Unassigned | Advanced merge preview and field protection rules defined |
| P4-05 | 4 | Done | P1 | P4-03, P1-04 | Unassigned | Merge audit, undo, and reversibility rules documented |
| P4-06 | 4 | Done | P2 | P4-01, P4-04 | Unassigned | Edge-case merge scenarios and review-first guards covered |
| P5-01 | 5 | Done | P0 | P1-02, P3-01 | Unassigned | CardDAV-ready sync account, link, and job model defined |
| P5-02 | 5 | Done | P0 | P5-01 | Unassigned | Sync scope, two-way target, and bootstrap fallback strategy locked |
| P5-03 | 5 | Done | P1 | P5-01, P1-04 | Unassigned | Sync credential protection, rotation metadata, and job orchestration documented |
| P5-04 | 5 | Done | P1 | P5-02, P4-05 | Unassigned | Conflict model, tombstones, merge lineage, and versioning rules defined |
| P5-05 | 5 | Done | P2 | P5-02 | Unassigned | iPhone and Android compatibility assumptions and limitations captured |
| P5-06 | 5 | Done | P2 | P5-03, P5-04 | Unassigned | Beta rollout, support tooling, and recovery plan documented |
| P6-01 | 6 | Done | P0 | P1-01, P3-01 | Unassigned | Rich person/profile fields and labels planned |
| P6-02 | 6 | Done | P0 | P6-01 | Unassigned | Structured multi-value email, phone, and address model defined |
| P6-03 | 6 | Done | P1 | P6-01, P4-04 | Unassigned | Dates, websites, related people, and custom fields planned |
| P6-04 | 6 | Done | P1 | P6-02, P5-01 | Unassigned | Rich-field schema, merge, and sync treatment documented |
| P6-05 | 6 | Done | P2 | P6-02, P3-03 | Unassigned | Rich contact editing and portability UX expectations defined |
| P6-06 | 6 | Done | P2 | P6-03, P5-05 | Unassigned | Mobile parity and compatibility expectations documented |

## Dependency Map
- Phase 1 defines the contact model, security baseline, and consumer scope.
- Phase 2 depends on Phase 1 because billing must align with account ownership and audit requirements.
- Phase 3 depends on Phase 1 because import/export requires a stable contact schema and normalization rules.
- Phase 4 depends on Phase 3 because merge quality relies on normalized imported data and source metadata.
- Phase 5 depends on Phases 1, 3, and 4 because sync requires stable identifiers, import-compatible mappings, and deterministic conflict/merge behavior.
- Phase 6 depends on Phases 1, 3, 4, and 5 because richer contact detail needs a stable schema base, portability rules, deterministic merge behavior, and clear sync compatibility expectations.

## Cross-Phase Validation Scenarios
- A new account can sign up, authenticate, and save contacts without schema redesign between phases.
- Imported CSV and vCard records retain enough metadata to drive duplicate suggestions and future sync mappings.
- Exported contacts remain structurally sound after merges and preserve the canonical contact record.
- Subscription and plan checks can gate premium features without impacting access to already-owned contacts.
- Security controls clearly differentiate password protection, app secret handling, backups, sync credentials, and audit records.
- CardDAV planning does not assume unsupported field semantics from earlier import/export phases.

## Implementation Notes
- Use the phase files as the detailed work queue.
- Update the master tracker and per-phase trackers together.
- When a ticket becomes blocked, document the reason in the ticket section and in the tracker status.

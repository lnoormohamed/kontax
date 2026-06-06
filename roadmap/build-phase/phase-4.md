# Phase 4 — Merge Engine and Duplicate Resolution

## Objective
Make duplicate handling trustworthy by defining how Kontax finds likely duplicate contacts, presents merge options, and records irreversible or reversible merge decisions.

## Success Criteria
- Duplicate heuristics are documented and user-scoped.
- Merge suggestions and manual merge flows are deterministic.
- Advanced merge rules exist for per-field choice, precedence, and auditability.
- Edge-case scenarios are covered well enough to avoid unsafe merging.

## Exit Criteria
- Duplicate discovery is reliable enough for imported consumer address books.
- Advanced merge behavior is deterministic and auditable.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P4-01 | Not Started | P0 | P3-02, P3-05 |
| P4-02 | Not Started | P0 | P4-01 |
| P4-03 | Not Started | P1 | P4-02 |
| P4-04 | Not Started | P1 | P4-03 |
| P4-05 | Not Started | P1 | P4-03, P1-04 |
| P4-06 | Not Started | P2 | P4-01, P4-04 |

## P4-01 — Define duplicate detection heuristics
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P3-02`, `P3-05`
- Implementation Notes:
  - Use normalized emails, phones, names, company values, and source metadata for candidate generation.
  - Distinguish hard matches from soft confidence-based suggestions.
  - Keep matching rules scoped per user account in v1.
- Acceptance Criteria:
  - Matching signals and confidence tiers are documented.
  - False-positive risk areas are explicitly called out.
- Risks / Open Questions:
  - Household and shared-business numbers may create ambiguous matches.

## P4-02 — Define merge suggestion lifecycle
- Status: `Not Started`
- Priority: `P0`
- Dependencies: `P4-01`
- Implementation Notes:
  - Add `MergeSuggestion` and `MergeDecision` planning with statuses, confidence, timestamps, and provenance.
  - Clarify when suggestions are generated: after import, after manual create/edit, or via background scan.
- Acceptance Criteria:
  - Suggestion lifecycle is fully documented.
  - Decision history is preserved and auditable.
- Risks / Open Questions:
  - Background rescoring may be expensive if not constrained.

## P4-03 — Define suggested and manual merge flows
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P4-02`
- Implementation Notes:
  - Support merge suggestion queue and manual pairwise merge entry points.
  - Define preview behavior, blocked cases, and user confirmation rules.
  - Keep the user in control of non-obvious merges.
- Acceptance Criteria:
  - Suggested merge and manual merge flows are documented end-to-end.
  - Trigger points and user actions are clear.
- Risks / Open Questions:
  - Merge fatigue can hurt trust if too many low-confidence suggestions are shown.

## P4-04 — Define advanced merge preview and field precedence
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P4-03`
- Implementation Notes:
  - Document per-field choice UI and protected fields.
  - Define precedence rules for manual entries vs imported contacts vs future synced contacts.
  - Clarify how multiple identifiers are preserved or consolidated.
- Acceptance Criteria:
  - Field resolution rules are deterministic.
  - Advanced merge preview has clear requirements for engineering and design.
- Risks / Open Questions:
  - Need to avoid lossy merges of important secondary identifiers.

## P4-05 — Define audit, undo, and reversibility rules
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P4-03`, `P1-04`
- Implementation Notes:
  - Decide what merge metadata is retained to support undo or investigation.
  - Document whether undo is time-limited, job-limited, or admin/support only.
  - Ensure merged contact exports still reflect a coherent canonical record.
- Acceptance Criteria:
  - Merge audit expectations are explicit.
  - Undo or non-undo behavior is clearly defined, not implied.
- Risks / Open Questions:
  - Unlimited undo can complicate sync and export consistency later.

## P4-06 — Cover edge-case merge scenarios
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P4-01`, `P4-04`
- Implementation Notes:
  - Include shared family emails, assistant phone numbers, nicknames, transliterated names, and sparse imported records.
  - Document cases where the system should suggest review but never auto-merge.
- Acceptance Criteria:
  - Edge-case behaviors are listed with expected treatment.
  - High-risk scenarios are explicitly guarded.
- Risks / Open Questions:
  - Name-only matching should probably remain low-confidence by default.

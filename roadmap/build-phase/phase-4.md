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
| P4-01 | In Progress | P0 | P3-02, P3-05 |
| P4-02 | In Progress | P0 | P4-01 |
| P4-03 | In Progress | P1 | P4-02 |
| P4-04 | In Progress | P1 | P4-03 |
| P4-05 | In Progress | P1 | P4-03, P1-04 |
| P4-06 | In Progress | P2 | P4-01, P4-04 |

## P4-01 — Define duplicate detection heuristics
- Status: `In Progress`
- Priority: `P0`
- Dependencies: `P3-02`, `P3-05`
- Implementation Notes:
  - Use normalized emails, phones, names, company values, and source metadata for candidate generation.
  - Distinguish hard matches from soft confidence-based suggestions.
  - Keep matching rules scoped per user account in v1.
  - Kontax now computes per-user duplicate suggestions across active contacts with deterministic signals for exact email, exact phone, same normalized name plus company, and same normalized name with missing company context.
  - Exact email and exact phone are treated as hard-match signals and surfaced as high-confidence suggestions.
  - Same-name and same-company matches stay below hard-match level so household/shared-number false positives remain review-first.
  - Current implementation is intentionally contact-pair based and capped for dashboard display, which gives Phase 4 a concrete heuristic foundation before persisted suggestion lifecycles arrive in `P4-02`.
- Acceptance Criteria:
  - Matching signals and confidence tiers are documented.
  - False-positive risk areas are explicitly called out.
- Risks / Open Questions:
  - Household and shared-business numbers may create ambiguous matches.
  - Name-only similarity remains intentionally excluded for now to avoid noisy consumer suggestions.

## P4-02 — Define merge suggestion lifecycle
- Status: `In Progress`
- Priority: `P0`
- Dependencies: `P4-01`
- Implementation Notes:
  - Add `MergeSuggestion` and `MergeDecision` planning with statuses, confidence, timestamps, and provenance.
  - Clarify when suggestions are generated: after import, after manual create/edit, or via background scan.
  - Kontax now persists `MergeSuggestion` records with open, dismissed, merged, and stale lifecycle states plus confidence, score, hard-match flags, reasons, signals, generated timestamp, reviewed timestamp, and provenance source.
  - `MergeDecision` records are now created for dismiss actions so review history starts existing before full merge execution is implemented.
  - The current generation entry point is a user-triggered duplicate refresh scan over active contacts; future phases can add automatic generation after import, contact edits, and background rescoring without changing the data model.
  - Dismissed suggestions stay dismissed across refreshes, while open suggestions that no longer match are marked stale.
- Acceptance Criteria:
  - Suggestion lifecycle is fully documented.
  - Decision history is preserved and auditable.
- Risks / Open Questions:
  - Background rescoring may be expensive if not constrained.

## P4-03 — Define suggested and manual merge flows
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P4-02`
- Implementation Notes:
  - Support merge suggestion queue and manual pairwise merge entry points.
  - Define preview behavior, blocked cases, and user confirmation rules.
  - Keep the user in control of non-obvious merges.
  - Kontax now has a dedicated suggestion review page with explicit “keep contact A” and “keep contact B” merge paths instead of forcing a hidden canonical winner.
  - Manual pairwise merge is now available through a dedicated page and contact-detail entry point so users can merge records that were not surfaced by heuristics.
  - The current merge preview is deterministic: the chosen primary contact keeps its non-empty canonical fields first, the secondary contact fills blanks, secondary records are archived after merge, and notes are combined when both sides have content.
  - Conflicting secondary email, phone, and company values are called out in preview notes so users understand what this pre-`P4-04` merge path does not preserve yet.
- Acceptance Criteria:
  - Suggested merge and manual merge flows are documented end-to-end.
  - Trigger points and user actions are clear.
- Risks / Open Questions:
  - Merge fatigue can hurt trust if too many low-confidence suggestions are shown.
  - This phase still uses record-level rather than per-field interactive choice, so lossy secondary identifiers remain a known limitation until `P4-04`.

## P4-04 — Define advanced merge preview and field precedence
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P4-03`
- Implementation Notes:
  - Document per-field choice UI and protected fields.
  - Define precedence rules for manual entries vs imported contacts vs future synced contacts.
  - Clarify how multiple identifiers are preserved or consolidated.
  - Suggested and manual merge flows now expose per-field choices for full name, email, phone, company, and notes before the merge is confirmed.
  - Current protected default rules are explicit in the UI: manual values outrank imported values when both sides conflict, otherwise the chosen primary record keeps precedence unless the user overrides a field.
  - Notes now support an explicit combine mode, while other canonical fields remain single-value selections in this phase.
  - Future synced-contact precedence is documented as a follow-on gap rather than being implied by the current import-vs-manual rule set.
- Acceptance Criteria:
  - Field resolution rules are deterministic.
  - Advanced merge preview has clear requirements for engineering and design.
- Risks / Open Questions:
  - Need to avoid lossy merges of important secondary identifiers.
  - Multiple secondary identifiers are still not preserved structurally in the schema yet, so this phase remains intentionally conservative.

## P4-05 — Define audit, undo, and reversibility rules
- Status: `In Progress`
- Priority: `P1`
- Dependencies: `P4-03`, `P1-04`
- Implementation Notes:
  - Decide what merge metadata is retained to support undo or investigation.
  - Document whether undo is time-limited, job-limited, or admin/support only.
  - Ensure merged contact exports still reflect a coherent canonical record.
  - Accepted merges now store a structured snapshot of primary-before, secondary-before, merged-after, and the field choices used at merge time.
  - The contact detail page now exposes an immediate undo path after merge so the current Phase 4 safety model is visible to the user instead of being hidden in backend state.
  - Undo currently restores the primary record to its pre-merge values, restores the archived secondary record, reopens the merge suggestion, and records a `REVERSED` decision event for audit history.
  - Reversibility is currently decision-scoped rather than time-limited, and it depends on the stored merge snapshot being present on the accepted merge decision.
- Acceptance Criteria:
  - Merge audit expectations are explicit.
  - Undo or non-undo behavior is clearly defined, not implied.
- Risks / Open Questions:
  - Unlimited undo can complicate sync and export consistency later.
  - A stricter undo window may still be needed before CardDAV sync work begins.

## P4-06 — Cover edge-case merge scenarios
- Status: `In Progress`
- Priority: `P2`
- Dependencies: `P4-01`, `P4-04`
- Implementation Notes:
  - Include shared family emails, assistant phone numbers, nicknames, transliterated names, and sparse imported records.
  - Document cases where the system should suggest review but never auto-merge.
  - Merge suggestions and merge previews now surface explicit review-first warnings for shared family emails, assistant or front-desk style shared phone numbers, same-number-different-company collisions, nickname or transliteration-style name mismatches, and sparse imported records.
  - Risky exact matches are now guarded by confidence downgrades in suggestion generation so the dashboard stops presenting those cases as high-confidence duplicates.
  - The current system remains intentionally user-confirmed only. Even strong matches stay in a review flow, and edge-case scenarios are called out before the merge is submitted.
- Acceptance Criteria:
  - Edge-case behaviors are listed with expected treatment.
  - High-risk scenarios are explicitly guarded.
- Risks / Open Questions:
  - Name-only matching should probably remain low-confidence by default.
  - Future shared-book and sync scenarios may require even stricter family or assistant-number protections.

# Phase 6 — Rich Contact Model and Consumer Detail Expansion

## Objective
Expand Kontax beyond the current canonical contact core into a richer consumer contact record that can support the real-world detail depth users expect from modern address books, while staying compatible with import/export, merge, billing, and future sync work.

## Success Criteria
- Richer person and household fields are explicitly planned.
- Structured multi-value fields are modeled without breaking the current canonical record.
- New field classes are grouped into clear implementation slices.
- CardDAV and export implications are documented before schema expansion begins.

## Exit Criteria
- Phase 6 becomes the source of truth for richer contact-detail scope.
- Future implementation can add these fields without rethinking the Phase 1–5 foundations.

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P6-01 | Done | P0 | P1-01, P3-01 |
| P6-02 | Done | P0 | P6-01 |
| P6-03 | Done | P1 | P6-01, P4-04 |
| P6-04 | Done | P1 | P6-02, P5-01 |
| P6-05 | Done | P2 | P6-02, P3-03 |
| P6-06 | Done | P2 | P6-03, P5-05 |

## P6-01 — Expand the person and profile model
- Status: `Done`
- Priority: `P0`
- Dependencies: `P1-01`, `P3-01`
- Implementation Notes:
  - Split current person naming into richer fields such as `firstName`, `middleName`, `lastName`, `prefix`, `suffix`, and display-name strategy, while preserving compatibility with existing `fullName`.
  - Add support for contact avatar/profile photo metadata and favorite/starred state.
  - Add label or tag support for consumer organization such as family, work, VIP, school, or custom labels.
  - Preserve compatibility with current merge heuristics and export behavior by treating `fullName` as a canonical fallback until the richer model is fully adopted.
- Acceptance Criteria:
  - Rich person/profile fields are enumerated clearly.
  - Name and profile expansion does not invalidate earlier merge/import/export planning.
- Risks / Open Questions:
  - Name-part support can complicate export and merge logic if display-name rules are not explicit.

## P6-02 — Add structured multi-value communication and address fields
- Status: `Done`
- Priority: `P0`
- Dependencies: `P6-01`
- Implementation Notes:
  - Expand beyond one canonical email and phone plus simple secondary arrays into structured multi-value entries with labels and optional preference flags.
  - Plan structured addresses with fields such as `countryOrRegion`, `streetLine1`, `streetLine2`, `cityOrTown`, `postcode`, `poBox`, and per-address labels.
  - Keep support for multiple emails, multiple phone numbers, and multiple addresses as first-class entities rather than lossy text blobs.
  - Ensure these structures remain exportable and map sensibly to CardDAV/vCard expectations later.
- Acceptance Criteria:
  - Multi-value email, phone, and address structure is explicit.
  - Structured address support includes region-specific fields without forcing one country-only model.
- Risks / Open Questions:
  - International address differences may require looser validation than a rigid form suggests.

## P6-03 — Add richer personal context fields
- Status: `Done`
- Priority: `P1`
- Dependencies: `P6-01`, `P4-04`
- Implementation Notes:
  - Add support for birthday decomposition and other significant dates with date labels such as anniversary, met date, or memorial.
  - Add websites as richer multi-value or labeled entries instead of a single URL only.
  - Add related-person relationships such as spouse, parent, child, assistant, or emergency contact.
  - Add custom fields so users can store meaningful personal metadata without waiting for every field to become first-class schema.
- Acceptance Criteria:
  - Significant dates, websites, related people, and custom fields are planned clearly.
  - Field precedence and merge expectations are acknowledged for these richer classes.
- Risks / Open Questions:
  - Custom fields can become difficult to merge or export consistently if their structure is too loose.

## P6-04 — Define schema, merge, and sync treatment for rich fields
- Status: `Done`
- Priority: `P1`
- Dependencies: `P6-02`, `P5-01`
- Implementation Notes:
  - Decide which rich fields live inline on `Contact` versus related child tables or JSON-backed structures.
  - Define merge preservation rules for labeled emails, phones, addresses, dates, websites, relationships, tags, and custom fields.
  - Define CardDAV/vCard-safe mapping expectations for each new field class, especially which ones round-trip cleanly and which remain Kontax-local.
  - Keep destructive or lossy behavior explicit so Phase 4 merge guarantees do not silently regress.
  - Kontax now preserves rich fields in merge previews, persisted merge snapshots, merge writes, and undo flows.
  - Scalar profile fields such as avatar, split names, and structured primary values follow the existing manual-over-imported precedence model.
  - Multi-value and contextual fields such as labels, websites, significant dates, related people, and custom fields merge by union so non-destructive detail is retained across records.
- Acceptance Criteria:
  - Rich-field storage direction is documented.
  - Merge and sync implications are explicit before implementation starts.
- Risks / Open Questions:
  - Some rich fields may not survive round-trip sync cleanly across clients.

## P6-05 — Define UI and portability expectations for rich fields
- Status: `Done`
- Priority: `P2`
- Dependencies: `P6-02`, `P3-03`
- Implementation Notes:
  - Plan a richer contact create/edit screen with sections for profile, communication methods, addresses, dates, websites, relationships, labels, and notes.
  - Preserve progressive disclosure so power users can add detail without overwhelming quick-entry flows.
  - Document which rich fields should export to CSV, which belong in vCard, and which remain Kontax-local or custom-profile specific.
  - Keep notes as a durable freeform field even when richer structured data expands.
  - Kontax now uses a quick-save essentials section plus collapsible advanced panels so richer detail stays available without forcing every edit into a dense all-fields form.
  - Portability guidance is surfaced in-product so users understand which rich fields are safest across CSV, vCard, merge, and future sync.
- Acceptance Criteria:
  - Rich contact editing and export expectations are documented.
  - UI scope supports both quick add and deep editing modes.
- Risks / Open Questions:
  - A highly detailed contact form can become heavy unless quick-add and advanced-detail modes are separated.

## P6-06 — Define mobile parity and compatibility expectations
- Status: `Done`
- Priority: `P2`
- Dependencies: `P6-03`, `P5-05`
- Implementation Notes:
  - Use the mobile-style contact-editing expectations from modern address books as a parity target for field coverage, not necessarily exact UI cloning.
  - Track which rich fields are expected to round-trip well to iPhone Contacts, Android CardDAV clients, CSV, and vCard.
  - Explicitly note that labels, favorites, related people, significant dates, and custom fields may have uneven support across sync clients.
  - Keep Phase 5 compatibility assumptions aligned with this richer Phase 6 field set.
  - Kontax now surfaces portability and mobile-parity guidance in the contact editing flow so richer field behavior is explained where users edit those fields.
  - Core identity fields remain the safest sync anchors, while richer metadata is treated as graceful-degradation territory until CardDAV/client validation is finalized.
- Acceptance Criteria:
  - Phase 6 includes mobile and sync compatibility planning for rich fields.
  - Expectations for parity versus graceful degradation are documented.
- Risks / Open Questions:
  - Consumer expectations may be shaped by Google or Apple contact apps that support fields unevenly across export and sync surfaces.

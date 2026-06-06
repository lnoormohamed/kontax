# P1-02 Contact Normalization and Indexing Strategy

## Purpose
This document defines how Kontax should normalize contact data and which indexes should support search, duplicate detection, import/export, and future CardDAV sync without redesigning the canonical model from `P1-01`.

## Design Goals
- Keep the canonical `Contact` record human-friendly and product-facing.
- Move repeated and matchable data into dedicated normalized structures.
- Preserve raw imported or user-entered values for fidelity while storing normalized values for matching and search.
- Scope all search and matching behavior to a single `User`.
- Support later import, merge, and sync phases without changing ownership or identifier strategy.

## Canonical Split of Responsibilities
### `Contact`
`Contact` remains the canonical profile card for a person or organization.

Use `Contact` for:
- display name and derived display state
- human-edited profile fields
- archive and delete lifecycle
- default primary values shown in the UI
- sync-safe canonical identity within Kontax

Do not use `Contact` for:
- storing every repeated identifier inline
- duplicate detection on raw strings only
- source provenance for every imported or synced field

### `ContactIdentifier`
`ContactIdentifier` stores all matchable repeated identifiers and is the main normalization surface.

Use `ContactIdentifier` for:
- emails
- phone numbers
- websites
- social handles
- external system IDs
- structured address search tokens when needed later

### `ContactSource`
`ContactSource` stores provenance and trust metadata for contact creation and future field resolution.

Use `ContactSource` for:
- manual vs import vs sync origin
- source system naming
- source record ID
- source confidence or trust weighting
- linking contacts back to import jobs or sync accounts

## Normalization Rules
### Names
Store raw canonical fields:
- `displayName`
- `givenName`
- `familyName`
- `middleName`
- `nickname`
- `organizationName`

Derived normalized fields to plan for:
- `displayNameNormalized`
- `organizationNameNormalized`
- optional phonetic or transliterated search fields later if needed

Normalization approach:
- trim outer whitespace
- collapse repeated internal whitespace
- lowercase for normalized search fields
- strip obvious punctuation for match-only variants where appropriate
- keep raw presentation fields unchanged for display/export fidelity

Notes:
- name normalization is for search assistance and low-confidence duplicate hints, not hard identity matching
- name-only matches should never be treated as a high-confidence duplicate without supporting identifiers

### Email
For every email identifier:
- keep `valueRaw` exactly as entered/imported where possible
- store `valueNormalized` as trimmed lowercase email

Rules:
- lowercase the entire email for matching
- trim whitespace
- do not remove dots or plus-tags globally because provider-specific rewriting can create false matches

Primary email:
- `Contact.primaryEmail` is a denormalized convenience field
- the actual set of emails lives in `ContactIdentifier`
- primary email must point to an identifier of kind `email`

### Phone
For every phone identifier:
- keep `valueRaw` for display and export fidelity
- store `valueNormalized` in a stable, machine-oriented form

Rules:
- trim whitespace
- remove formatting punctuation for matchable storage
- target E.164-compatible normalization when country context is available
- when country context is not available, store a punctuation-stripped fallback normalization and mark confidence lower for duplicate logic

Notes:
- phone numbers should support labels such as `mobile`, `home`, `work`, and `other`
- phone normalization must stay conservative in v1 to avoid false-positive merges across regions

### Websites
For website identifiers:
- preserve raw URL
- normalize host casing and obvious trailing slash variance for matching
- avoid aggressive canonicalization that changes semantic meaning

### Social Handles
For social identifiers:
- preserve raw handle or profile URL
- normalize casing only where the network treats handles as case-insensitive
- keep provider/network name as part of identity context

### External IDs
For imported or synced references:
- store them in `ContactIdentifier` or `ContactSource` depending on whether they behave as matchable identifiers or provenance links
- never treat an external ID as a substitute for the canonical `Contact.id`

## Raw vs Normalized Value Policy
Every identifier that may participate in matching should support:
- `valueRaw`: user-visible or export-friendly source value
- `valueNormalized`: deterministic match/search value

Rules:
- UI and exports should prefer `valueRaw`
- matching, dedupe, and indexing should use `valueNormalized`
- if normalization fails or is low-confidence, preserve raw data and lower match confidence instead of dropping the identifier

## Search Strategy
### Phase 1 search scope
User-scoped search should support:
- contact display name
- organization name
- primary email and additional email identifiers
- primary phone and additional phone identifiers
- notes in a lower-priority or later optimization path

### Search behavior
- exact and prefix matching should be fast for common lookups
- user-scoped matching must always include `userId` in query paths
- identifier-based search should route through `ContactIdentifier.valueNormalized`
- display search should route through normalized name/company fields on `Contact`

## Duplicate Detection Support
The normalization layer should prepare these future signals:
- exact email match within a user
- exact normalized phone match within a user
- mixed signal: name + company + partial identifier overlap
- source-aware weighting from `ContactSource`

Duplicate confidence guidance:
- exact normalized email match is high confidence
- exact normalized phone match is high confidence with regional caution
- name-only match is low confidence
- imported source overlap boosts confidence but does not replace identifier checks

## Source Metadata Responsibilities
`ContactSource` should answer:
- where did this contact come from
- what job or sync account created it
- what external source record is associated with it
- how trustworthy is the source when resolving future merges

Planned source metadata fields:
- `sourceType`
- `sourceSystem`
- `sourceRecordId`
- `sourceLabel`
- `importJobId`
- `syncAccountId`
- `confidence`
- `lastSeenAt`

## Indexing Strategy
### Core contact indexes
- `Contact.userId + displayNameNormalized`
- `Contact.userId + organizationNameNormalized`
- `Contact.userId + isArchived`
- `Contact.userId + deletedAt`
- `Contact.userId + updatedAt`

### Identifier indexes
- `ContactIdentifier.userId + kind + valueNormalized`
- `ContactIdentifier.contactId + kind + isPrimary`
- optional uniqueness guard for `userId + kind + valueNormalized + contactId`

### Source indexes
- `ContactSource.userId + sourceType`
- `ContactSource.userId + sourceSystem + sourceRecordId`
- `ContactSource.contactId + sourceType`

### Import/merge-ready indexes
- `ImportJob.userId + status`
- `MergeSuggestion.userId + status + confidenceScore`
- `SyncJob.userId + status`

## Proposed Schema Direction From This Ticket
### Changes expected after P1-02 implementation work
`Contact` should grow toward:
- `displayName`
- `displayNameNormalized`
- `givenName`
- `familyName`
- `middleName`
- `nickname`
- `organizationName`
- `organizationNameNormalized`
- `primaryEmail`
- `primaryPhone`
- `isArchived`
- `archivedAt`
- `deletedAt`

`ContactIdentifier` should be added with:
- `userId`
- `contactId`
- `kind`
- `label`
- `valueRaw`
- `valueNormalized`
- `isPrimary`

`ContactSource` should be added with:
- `userId`
- `contactId`
- `sourceType`
- `sourceSystem`
- `sourceRecordId`
- `importJobId`
- `syncAccountId`
- `confidence`

## Current Schema Gap vs Target
Current schema only supports:
- one inline `email` field on `Contact`
- one inline `phone` field on `Contact`
- one inline `company` field on `Contact`
- no normalized search fields
- no repeated identifiers
- no provenance records

This means current gaps are:
- duplicate detection cannot be made reliable without schema expansion
- import/export mapping cannot preserve multiple emails or phones cleanly
- sync cannot map remote identifiers safely
- future merge rules would be forced to rely on lossy inline fields

## Acceptance Outcome
`P1-02` is complete when this document is treated as the normalization and indexing contract for future schema work, search behavior, duplicate detection, import mapping, and sync preparation.

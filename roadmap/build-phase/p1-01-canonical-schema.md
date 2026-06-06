# P1-01 Canonical Consumer SaaS Schema Blueprint

## Purpose
This blueprint defines the canonical data model direction for Kontax as a consumer-first SaaS contacts app. It is the Phase 1 schema contract that later phases for billing, import/export, merge, audit, and CardDAV sync should build on without revisiting ownership assumptions.

## Design Principles
- Single-user ownership is the v1 root model.
- Every mutable business record belongs directly or indirectly to `User`.
- Contacts are canonical records first; imports, merges, and syncs attach metadata rather than redefining the contact model.
- Auditability and soft-delete behavior must exist at the model level before destructive product features expand.
- Future billing, family sharing, or workspace support must be additive, not a rewrite of contact ownership.

## Ownership Model
### Root owner
- `User` is the only ownership root in v1.
- All user data is scoped by `userId`.
- No shared books, workspaces, team memberships, or cross-user contact containers are introduced in this phase.

### Future extension path
- Future `Workspace` or `SharedBook` support should be added as a second ownership layer above contacts, not by removing `User`.
- `SubscriptionCustomer` and `Subscription` attach to `User` in v1.
- Sync accounts, import jobs, export jobs, merge suggestions, and audit events all remain user-scoped even if future sharing is introduced.

## Canonical Entities
### `User`
Purpose:
- Consumer account identity, auth boundary, billing boundary, and top-level data owner.

Core fields:
- `id`
- `email`
- `name`
- `passwordHash`
- `status`
- `createdAt`
- `updatedAt`
- `lastActiveAt`

Relationships:
- owns `Contact`
- owns `SubscriptionCustomer`
- owns `Subscription`
- owns `ImportJob`
- owns `ExportJob`
- owns `MergeSuggestion`
- owns `MergeDecision`
- owns `SyncAccount`
- emits `AuditEvent`

Notes:
- `email` is unique globally in v1.
- account lifecycle state should support `active`, `trialing`, `grace`, `canceled`, `locked`.

### `Contact`
Purpose:
- Canonical person or organization contact record used by UI, exports, merge decisions, and sync.

Core fields:
- `id`
- `userId`
- `displayName`
- `givenName`
- `familyName`
- `middleName`
- `nickname`
- `organizationName`
- `jobTitle`
- `birthday`
- `notes`
- `avatarUrl`
- `primaryEmail`
- `primaryPhone`
- `sourcePriority`
- `isArchived`
- `archivedAt`
- `deletedAt`
- `createdAt`
- `updatedAt`

Notes:
- `displayName` is the primary rendered label.
- `primaryEmail` and `primaryPhone` are convenience fields, not the only identifiers.
- `deletedAt` supports soft delete or tombstone-style future sync behavior.
- `isArchived` and `archivedAt` support user-facing archive without destructive removal.

### `ContactIdentifier`
Purpose:
- Normalized repeated identifiers for a contact, enabling search, duplicate detection, import mapping, and sync-safe references.

Core fields:
- `id`
- `contactId`
- `userId`
- `kind`
- `label`
- `valueRaw`
- `valueNormalized`
- `isPrimary`
- `verificationState`
- `createdAt`
- `updatedAt`

Supported `kind` values in the roadmap:
- `email`
- `phone`
- `website`
- `social`
- `external_id`
- `address`

Notes:
- `valueRaw` preserves user/import fidelity.
- `valueNormalized` is used for matching and search.
- `userId` is denormalized intentionally for query efficiency and user-scoped uniqueness checks.

### `ContactSource`
Purpose:
- Origin metadata describing how a contact or identifier entered the system and how reliable that source is.

Core fields:
- `id`
- `contactId`
- `userId`
- `sourceType`
- `sourceSystem`
- `sourceRecordId`
- `sourceLabel`
- `importJobId`
- `syncAccountId`
- `confidence`
- `createdAt`
- `updatedAt`

Supported `sourceType` values:
- `manual`
- `import`
- `sync`
- `merge`
- `system`

Notes:
- This model is required before merge and sync so provenance is preserved.
- Imported and synced contacts should keep origin metadata separate from the canonical contact row.

### `SubscriptionCustomer`
Purpose:
- Billing identity for a single user account.

Core fields:
- `id`
- `userId`
- `provider`
- `providerCustomerId`
- `defaultCurrency`
- `createdAt`
- `updatedAt`

Notes:
- One primary customer per user in v1.
- This model is Phase 2 implementation work but belongs in the canonical schema plan now.

### `Subscription`
Purpose:
- Plan, entitlement, and renewal state for a user.

Core fields:
- `id`
- `userId`
- `subscriptionCustomerId`
- `providerSubscriptionId`
- `planCode`
- `status`
- `billingInterval`
- `currentPeriodStart`
- `currentPeriodEnd`
- `cancelAt`
- `canceledAt`
- `trialEndsAt`
- `createdAt`
- `updatedAt`

Notes:
- Entitlements should derive from plan metadata rather than hard-coded product branches.

### `ImportJob`
Purpose:
- Async record of import processing.

Core fields:
- `id`
- `userId`
- `format`
- `status`
- `fileName`
- `fileStorageKey`
- `totalRows`
- `acceptedRows`
- `rejectedRows`
- `errorSummary`
- `startedAt`
- `finishedAt`
- `createdAt`
- `updatedAt`

### `ExportJob`
Purpose:
- Async record of export generation and delivery.

Core fields:
- `id`
- `userId`
- `format`
- `status`
- `filterScope`
- `fileStorageKey`
- `totalContacts`
- `errorSummary`
- `startedAt`
- `finishedAt`
- `createdAt`
- `updatedAt`

### `MergeSuggestion`
Purpose:
- Candidate duplicate relationship for user review or background-generated suggestions.

Core fields:
- `id`
- `userId`
- `primaryContactId`
- `candidateContactId`
- `confidenceScore`
- `status`
- `reasonSummary`
- `createdAt`
- `updatedAt`

### `MergeDecision`
Purpose:
- Recorded outcome of a merge action or dismissal.

Core fields:
- `id`
- `userId`
- `mergeSuggestionId`
- `decisionType`
- `survivingContactId`
- `mergedContactId`
- `decisionPayload`
- `decidedAt`
- `createdAt`

### `SyncAccount`
Purpose:
- CardDAV-ready sync account configuration for future iPhone/Android contact sync.

Core fields:
- `id`
- `userId`
- `provider`
- `baseUrl`
- `principalUrl`
- `credentialRefId`
- `syncDirection`
- `status`
- `lastSyncedAt`
- `lastError`
- `createdAt`
- `updatedAt`

### `SyncJob`
Purpose:
- Background execution record for sync runs.

Core fields:
- `id`
- `userId`
- `syncAccountId`
- `status`
- `startedAt`
- `finishedAt`
- `contactsCreated`
- `contactsUpdated`
- `contactsDeleted`
- `conflictCount`
- `errorSummary`
- `createdAt`

### `AuditEvent`
Purpose:
- Immutable log for security-sensitive or destructive actions.

Core fields:
- `id`
- `userId`
- `actorType`
- `actorId`
- `eventType`
- `targetType`
- `targetId`
- `payload`
- `ipAddress`
- `userAgent`
- `createdAt`

Notes:
- Audit records are append-only.
- Events must cover auth, contact deletion, import confirmation, merge execution, export generation, billing lifecycle transitions, and sync credential changes.

### `EncryptionKeyRef`
Purpose:
- Metadata-only reference to future field-level or secret encryption material.

Core fields:
- `id`
- `userId`
- `keyPurpose`
- `provider`
- `providerKeyId`
- `status`
- `rotatedAt`
- `createdAt`
- `updatedAt`

Notes:
- No field-level encryption is required in v1, but this model preserves a migration path for sync secrets and high-sensitivity PII.

## Deletion, Archive, and Retention Rules
- Contacts should default to archive before destructive delete in user-facing flows.
- `deletedAt` is preferred over hard delete for contacts once imports, merges, or sync jobs exist.
- Audit events are never hard-deleted from normal product flows.
- Import/export files may be cleaned up by retention jobs, but their job records remain for auditability.
- Subscription and billing state changes remain historically visible even after cancellation.

## ID Strategy
- Use immutable internal IDs for all primary records.
- Preserve external identifiers separately in `ContactIdentifier` or source/sync metadata.
- Never treat email or phone as the primary technical key for contacts.
- Sync-safe external record references must remain decoupled from the canonical contact ID.

## Indexing Expectations
- `User.email` unique
- `Contact.userId + displayName`
- `Contact.userId + isArchived`
- `ContactIdentifier.userId + kind + valueNormalized`
- `ContactSource.userId + sourceType`
- `MergeSuggestion.userId + status`
- `ImportJob.userId + status`
- `ExportJob.userId + status`
- `SyncJob.userId + status`
- `AuditEvent.userId + eventType + createdAt`

## Current Schema Gap vs Target
Current codebase only includes:
- `User`
- `Contact`

Current gaps to close in later tickets:
- no `ContactIdentifier`
- no `ContactSource`
- no archive or soft-delete fields on `Contact`
- no billing entities
- no import/export job entities
- no merge entities
- no sync entities
- no audit event model
- no encryption key metadata model

## Outcome
`P1-01` is complete when this blueprint is treated as the canonical schema direction for all subsequent Phase 1-5 work and all later tickets build on these ownership, deletion, and extensibility assumptions.

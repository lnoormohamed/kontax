# P34G-01 — SyncAccount Lineage Schema

## Purpose

Add the persistent fields that separate a sync-account row's database identity
from its logical connection identity. This is the foundation for reconnect,
replacement, retirement, and support/debug lineage.

## Background

`SyncAccount.id` currently acts as both the database primary key and the
practical connection identity. That stops being sufficient once a user can
choose to create a fresh connection and retire an older one. At that point the
row id and the logical connection identity diverge, and history can no longer
be grouped safely without a new model.

## Scope

**In scope**
- Add `connectionId`
- Add `replacesSyncAccountId`
- Add `replacedBySyncAccountId`
- Add `retiredAt`
- Add `retiredReason`
- Add self-relations / indexes as needed
- Backfill `connectionId` for existing rows

**Out of scope**
- User-facing reconnect/replace chooser
- Activity-feed copy
- Support/admin UI rendering of lineage

## Design / Implementation Spec

### Proposed schema shape

```prisma
model SyncAccount {
  id                      String   @id @default(cuid())
  connectionId            String
  replacesSyncAccountId   String?
  replacedBySyncAccountId String?
  retiredAt               DateTime?
  retiredReason           String?

  replacesSyncAccount   SyncAccount?  @relation("SyncAccountReplacement", fields: [replacesSyncAccountId], references: [id], onDelete: SetNull)
  replacedBySyncAccount SyncAccount?  @relation("SyncAccountReplacement", fields: [replacedBySyncAccountId], references: [id], onDelete: SetNull)
  replacementChildren   SyncAccount[] @relation("SyncAccountReplacement")
}
```

### Semantics

- `id` = row identity
- `connectionId` = stable logical identity used for grouping history and
  support/debugging
- reconnecting an old connection keeps the same row and same `connectionId`
- replacing a connection creates a fresh row and a fresh `connectionId`

### Backfill

For all existing sync-account rows:
- assign a new cuid to `connectionId`
- leave replacement fields null

## Acceptance Criteria

- `SyncAccount` has all five new fields
- relations compile cleanly in Prisma
- `prisma db push` applies cleanly
- every existing row gets a non-empty `connectionId`

## Risks / Open Questions

- Decide whether `connectionId` should be globally unique or simply indexed.
- Keep relation naming explicit so the replacement chain is easy to query later.

## Documentation

- [ ] External · users — none
- [ ] External · developers — none
- [x] Internal · engineering — schema comments + Phase 34G document lineage semantics
- [ ] Internal · support/admin — follow-up later

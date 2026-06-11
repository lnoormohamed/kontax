# P23-01 — SyncAccountSettings Model

## Purpose

Add a `SyncAccountSettings` model that stores per-connection configuration beyond the credential fields already on `SyncAccount`. Each connection needs independent control over which remote address books are included, what direction sync flows, and how conflicts are resolved. Without this model, all connections share the same defaults and users cannot tune behaviour per source.

## Background

The `SyncAccount` model (P5-01) captures the connection endpoint and credentials. Phase 7 implemented the first CardDAV sync. Both assumed uniform sync behaviour — two-way, all address books, server-wins on conflicts. In practice, users have different relationships with different sync sources: an iCloud connection may be import-only (Kontax as the master), while a Nextcloud connection is two-way. The settings model extends without modifying the core sync model, keeping the schema addition additive and backwards-compatible.

The connection edit drawer (P23-02) writes to this model. The sync engine (Phase 5/7) reads from it before each job run.

## Scope

**In scope:**
- `SyncAccountSettings` Prisma model — 1:1 with `SyncAccount`, created lazily on first save
- `SyncDirection` enum: `TWO_WAY`, `IMPORT_ONLY`, `EXPORT_ONLY`
- `ConflictPolicy` enum: `SERVER_WINS`, `DEVICE_WINS`, `MANUAL`
- `bookAllowlist String[]` — Postgres array of remote address book URLs; empty = all books included
- `syncFrequencyMinutes Int?` — polling interval override; null = platform default (60 min)
- Migration + seed defaults: all existing `SyncAccount` rows get `SERVER_WINS` / `TWO_WAY` / empty allowlist
- Update the sync engine to read settings before each job

**Out of scope:**
- The edit drawer UI (P23-02)
- Book discovery and allowlist selection (P23-03)
- Conflict resolution queue (P23-05)

---

## Design / Implementation Spec

### Schema change

```prisma
enum SyncDirection {
    TWO_WAY
    IMPORT_ONLY
    EXPORT_ONLY
}

enum ConflictPolicy {
    SERVER_WINS   // remote change always wins
    DEVICE_WINS   // Kontax change always wins (export-biased)
    MANUAL        // write a SyncConflict row for user review
}

model SyncAccountSettings {
    id                    String        @id @default(cuid())
    syncAccountId         String        @unique
    syncDirection         SyncDirection @default(TWO_WAY)
    conflictPolicy        ConflictPolicy @default(SERVER_WINS)
    bookAllowlist         String[]      // empty = sync all discovered books
    syncFrequencyMinutes  Int?          // null = platform default (60 min)
    requireReauthToEdit   Boolean       @default(true)
    lastModifiedAt        DateTime      @updatedAt
    createdAt             DateTime      @default(now())

    syncAccount SyncAccount @relation(fields: [syncAccountId], references: [id], onDelete: Cascade)
}
```

Add inverse relation to `SyncAccount`:
```prisma
settings SyncAccountSettings?
```

Run: `prisma migrate dev --name add-sync-account-settings`

### Seed defaults for existing accounts

In the migration, create default `SyncAccountSettings` rows for every existing `SyncAccount`:

```typescript
// In a seed script or migration afterware:
const accounts = await db.syncAccount.findMany({ select: { id: true } });
await db.syncAccountSettings.createMany({
  data: accounts.map((a) => ({
    syncAccountId: a.id,
    syncDirection: "TWO_WAY",
    conflictPolicy: "SERVER_WINS",
    bookAllowlist: [],
  })),
  skipDuplicates: true,
});
```

### Sync engine integration

In `src/server/sync/run-sync-job.ts` (or equivalent), before executing a sync job:

```typescript
const settings = await db.syncAccountSettings.findUnique({
  where: { syncAccountId: account.id },
});

const direction = settings?.syncDirection ?? "TWO_WAY";
const conflictPolicy = settings?.conflictPolicy ?? "SERVER_WINS";
const bookAllowlist = settings?.bookAllowlist ?? [];

// Apply direction
if (direction === "IMPORT_ONLY") {
  // Skip the push phase — read only from remote
}
if (direction === "EXPORT_ONLY") {
  // Skip the pull phase — write only to remote
}

// Apply allowlist
const booksToSync = bookAllowlist.length > 0
  ? discoveredBooks.filter((b) => bookAllowlist.includes(b.url))
  : discoveredBooks;

// Apply conflict policy
// Pass conflictPolicy into the conflict-resolution function
```

### `getOrCreateSettings` helper

```typescript
export async function getOrCreateSettings(syncAccountId: string): Promise<SyncAccountSettings> {
  return await db.syncAccountSettings.upsert({
    where: { syncAccountId },
    create: {
      syncAccountId,
      syncDirection: "TWO_WAY",
      conflictPolicy: "SERVER_WINS",
      bookAllowlist: [],
    },
    update: {},
  });
}
```

---

## Acceptance Criteria

- `SyncAccountSettings` model exists with all specified fields; migration applied.
- Every existing `SyncAccount` row has a corresponding `SyncAccountSettings` row after migration (seeded with defaults).
- The sync engine reads `SyncDirection` and respects it: `IMPORT_ONLY` skips the push phase; `EXPORT_ONLY` skips the pull phase.
- The sync engine reads `bookAllowlist` and skips books not in the list (when the list is non-empty).
- `ConflictPolicy` is read by the conflict resolution step and passed to the resolver.
- `getOrCreateSettings` is idempotent — safe to call multiple times for the same account.

---

## Risks and Open Questions

- **`DEVICE_WINS` conflict policy semantics:** if the policy is `DEVICE_WINS`, Kontax changes always overwrite remote changes regardless of the remote's ETag. This can cause data loss if someone edits a contact directly in iCloud while also editing it in Kontax. Document this risk clearly in the UI tooltip for the setting. Default remains `SERVER_WINS`.
- **`MANUAL` conflict policy queue size:** `MANUAL` policy creates `SyncConflict` rows indefinitely. If the user never reviews them, the queue grows without bound. Add a max-queue-size safety valve (e.g., auto-pause the account after 50 unresolved conflicts) in P23-05.
- **Sync frequency granularity:** `syncFrequencyMinutes` is stored but not yet wired to a scheduler. The scheduler integration is a later improvement; for now, the field is persisted and reserved for future use.

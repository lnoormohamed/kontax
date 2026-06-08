# P14-06 Team-Level CardDAV Sync Accounts

## Purpose
Teams often share a common CardDAV source of truth — a company Nextcloud instance, a Google Workspace CardDAV endpoint, or an internal vCard server. This ticket extends the Phase 5/7 CardDAV client sync infrastructure to operate on a team address book rather than a personal contact library, enabling a team admin to connect a shared CardDAV account, link it to a specific team address book, and have the sync job write into that book's `GroupContact` set with proper attribution and permission enforcement.

## Background
Phase 5 implemented the CardDAV client sync engine: `SyncAccount` model stores credentials (encrypted) and sync state (`syncToken`, `lastSyncedAt`), and the sync runner fetches vCards from the remote server and upserts them as `Contact` records owned by the user. Phase 7 extended this with bidirectional sync and conflict resolution.

Phase 13 extended sync with a `syncDirection` parameter for Family shared books, but the runner was still personal-contact-scoped.

Phase 14 needs the sync runner to operate on a `GroupContact` set instead of a personal `Contact` set when a `groupAddressBookId` is provided. The `TeamSyncAccount` model (P14-01) links a `SyncAccount` to a `GroupAddressBook`. The sync job must:
1. Query the remote CardDAV server for vCards (existing logic).
2. Upsert contacts into the team address book's `GroupContact` set (new logic).
3. Attribute all mutations to `actor: SYNC` with `actorDetail: "[Sync label] · [Team name] · [Book name]"`.
4. Surface sync conflicts to team admins (not to individual members).

## Scope

### In scope
- `TeamSyncAccount` CRUD: admin connects, lists, edits, removes team sync accounts.
- Sync runner modification: accept `groupAddressBookId` parameter; switch contact storage from personal `Contact` to `GroupContact`-linked `Contact`.
- Attribution in ActivityEvent for sync operations.
- Conflict surfacing: conflicts logged to the team admin's notification surface.
- Team sync account management UI (in team management page under "Sync Accounts" tab — layout is P14-07).
- Credential storage: same encryption approach as personal sync accounts.

### Out of scope
- CardDAV server exposure for team books (outbound/server-side) — that is P14-09.
- New CardDAV protocol features — only reusing existing Phase 5/7 implementation.
- Sync scheduling changes — existing scheduler is reused, just with the new parameter.
- Per-member sync visibility — sync-written contacts are visible to all members with at least VIEW permission on the book.

## Design / Implementation Spec

### 1. TeamSyncAccount CRUD

The `TeamSyncAccount` model (P14-01) is the link between a `SyncAccount` and a `GroupAddressBook`. The `SyncAccount` itself stores the credentials and sync state, owned by the team owner's userId.

#### 1.1 Connect a Team Sync Account

**Server Action: `connectTeamSyncAccount`**

```typescript
const ConnectTeamSyncAccountSchema = z.object({
  groupId: z.string().cuid(),
  groupAddressBookId: z.string().cuid(),
  label: z.string().min(1).max(100),
  serverUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  syncDirection: z.enum(["PULL", "PUSH", "BIDIRECTIONAL"]).default("BIDIRECTIONAL"),
});

export async function connectTeamSyncAccount(
  input: z.infer<typeof ConnectTeamSyncAccountSchema>
) {
  const session = await auth();
  await requireGroupRole(session.user.id, input.groupId, "ADMIN");

  // Validate the addressBook belongs to the group
  const book = await prisma.groupAddressBook.findFirst({
    where: { id: input.groupAddressBookId, groupId: input.groupId, archivedAt: null },
  });
  if (!book) throw new Error("Address book not found or is archived");

  // Check: only one sync account per team address book (one source of truth per book)
  const existing = await prisma.teamSyncAccount.findFirst({
    where: { groupAddressBookId: input.groupAddressBookId },
  });
  if (existing) {
    throw new Error(
      "This address book already has a sync account. Remove the existing one first."
    );
  }

  // Test the CardDAV credentials before saving
  const testResult = await testCardDAVConnection({
    serverUrl: input.serverUrl,
    username: input.username,
    password: input.password,
  });
  if (!testResult.success) {
    throw new Error(`Cannot connect: ${testResult.error}`);
  }

  const group = await prisma.group.findUniqueOrThrow({
    where: { id: input.groupId },
    select: { ownerId: true },
  });

  return prisma.$transaction(async (tx) => {
    // Create SyncAccount owned by the team owner
    const syncAccount = await tx.syncAccount.create({
      data: {
        userId: group.ownerId,
        label: input.label,
        serverUrl: input.serverUrl,
        username: input.username,
        encryptedPassword: encrypt(input.password),
        syncDirection: input.syncDirection,
        isTeamAccount: true, // new boolean flag — add to SyncAccount if not present
      },
    });

    // Create TeamSyncAccount link
    const teamSyncAccount = await tx.teamSyncAccount.create({
      data: {
        groupId: input.groupId,
        syncAccountId: syncAccount.id,
        groupAddressBookId: input.groupAddressBookId,
        addedByUserId: session.user.id,
      },
    });

    // Emit ActivityEvent
    // ...

    return teamSyncAccount;
  });
}
```

**One sync account per book policy**: enforced by both the application check above and the `@@unique([syncAccountId, groupAddressBookId])` constraint in P14-01. A `SyncAccount` can theoretically be linked to multiple books (the unique constraint is on the combination), but the application-level "one per book" check prevents this. The unique constraint on `(syncAccountId, groupAddressBookId)` prevents linking the same sync account to the same book twice, but does not prevent the same sync account from linking to two different books. The application check above closes this gap.

#### 1.2 List Team Sync Accounts

```typescript
export async function listTeamSyncAccounts(groupId: string) {
  const session = await auth();
  await requireGroupRole(session.user.id, groupId, "ADMIN");

  return prisma.teamSyncAccount.findMany({
    where: { groupId },
    include: {
      syncAccount: {
        select: {
          id: true,
          label: true,
          serverUrl: true,
          username: true,
          syncDirection: true,
          lastSyncedAt: true,
          lastSyncStatus: true,
          lastSyncError: true,
        },
      },
      groupAddressBook: { select: { id: true, name: true } },
      addedBy: { select: { id: true, name: true } },
    },
  });
}
```

#### 1.3 Remove Team Sync Account

```typescript
export async function removeTeamSyncAccount(teamSyncAccountId: string) {
  const session = await auth();

  const tsa = await prisma.teamSyncAccount.findUniqueOrThrow({
    where: { id: teamSyncAccountId },
    select: { groupId: true, syncAccountId: true },
  });

  await requireGroupRole(session.user.id, tsa.groupId, "ADMIN");

  return prisma.$transaction(async (tx) => {
    await tx.teamSyncAccount.delete({ where: { id: teamSyncAccountId } });
    // The SyncAccount record itself is also deleted (or marked inactive)
    // since a team sync account's SyncAccount has no independent existence
    await tx.syncAccount.delete({ where: { id: tsa.syncAccountId } });
    // Emit ActivityEvent
  });
}
```

#### 1.4 Manual Trigger Sync

```typescript
export async function triggerTeamSync(teamSyncAccountId: string) {
  const session = await auth();
  const tsa = await prisma.teamSyncAccount.findUniqueOrThrow({
    where: { id: teamSyncAccountId },
    select: { groupId: true, syncAccountId: true, groupAddressBookId: true },
  });
  await requireGroupRole(session.user.id, tsa.groupId, "ADMIN");

  // Enqueue sync job with groupAddressBookId parameter
  await enqueueSyncJob({
    syncAccountId: tsa.syncAccountId,
    groupAddressBookId: tsa.groupAddressBookId,
  });

  return { queued: true };
}
```

---

### 2. Sync Runner Modification

The sync runner is the core service that executes CardDAV synchronization. It must be extended to handle team address books.

#### 2.1 Runner Interface Extension

The sync runner entry point (wherever it currently lives — likely `src/server/sync/runner.ts` or similar) must accept a new optional parameter:

```typescript
interface SyncRunnerOptions {
  syncAccountId: string;
  syncDirection: "PULL" | "PUSH" | "BIDIRECTIONAL";
  groupAddressBookId?: string; // If present, operate on team book
}
```

#### 2.2 Contact Storage Strategy Pattern

The runner currently uses a `PersonalContactStore` strategy. Introduce a strategy interface:

```typescript
// src/server/sync/contact-store.ts

interface ContactStore {
  /**
   * Look up an existing contact by its source UID (vCard UID field).
   * Returns null if not found.
   */
  findByUid(uid: string): Promise<Contact | null>;

  /**
   * Upsert a contact from a parsed vCard.
   * Returns the created or updated Contact.
   */
  upsert(vcard: ParsedVCard, source: UpsertSource): Promise<Contact>;

  /**
   * Archive (soft-delete) a contact by UID.
   */
  archiveByUid(uid: string): Promise<void>;

  /**
   * List all contacts currently in this store (for PUSH sync).
   */
  listActive(): Promise<Contact[]>;

  /**
   * Return the owner userId for ActivityEvent attribution.
   */
  ownerId: string;

  /**
   * Return metadata for ActivityEvent attribution.
   */
  attributionMeta: {
    actor: "SYNC";
    actorDetail: string;  // "[Sync label] · [Team name] · [Book name]"
    teamId?: string;
    addressBookId?: string;
  };
}
```

**PersonalContactStore** (existing behavior, refactored):
- `findByUid`: query `Contact WHERE userId = X AND uid = Y`.
- `upsert`: upsert `Contact` directly.
- `ownerId`: `syncAccount.userId`.
- `attributionMeta.actor`: `"SYNC"`.
- `attributionMeta.actorDetail`: `"[Sync label]"`.

**TeamContactStore** (new):
- `findByUid`: query `GroupContact JOIN Contact WHERE groupAddressBookId = X AND Contact.uid = Y`.
- `upsert`: create/update `Contact` with `userId = group.ownerId`, then upsert `GroupContact` row.
- `archiveByUid`: set `Contact.archivedAt = now()` for the matching contact.
- `listActive`: query `GroupContact WHERE groupAddressBookId = X AND contact.archivedAt IS NULL`.
- `ownerId`: `group.ownerId`.
- `attributionMeta`: `{ actor: "SYNC", actorDetail: "[label] · [team] · [book]", teamId: groupId, addressBookId }`.

```typescript
// src/server/sync/team-contact-store.ts

export class TeamContactStore implements ContactStore {
  constructor(
    private groupAddressBookId: string,
    private groupId: string,
    private syncAccountLabel: string,
    private teamName: string,
    private bookName: string,
    private teamOwnerId: string
  ) {}

  async findByUid(uid: string): Promise<Contact | null> {
    const gc = await prisma.groupContact.findFirst({
      where: {
        groupAddressBookId: this.groupAddressBookId,
        contact: { uid },
      },
      include: { contact: true },
    });
    return gc?.contact ?? null;
  }

  async upsert(vcard: ParsedVCard, source: UpsertSource): Promise<Contact> {
    return prisma.$transaction(async (tx) => {
      // Upsert the Contact record
      const contact = await tx.contact.upsert({
        where: { uid_userId: { uid: vcard.uid, userId: this.teamOwnerId } },
        create: {
          userId: this.teamOwnerId,
          uid: vcard.uid,
          ...mapVCardToContactFields(vcard),
        },
        update: mapVCardToContactFields(vcard),
      });

      // Ensure the GroupContact row exists
      await tx.groupContact.upsert({
        where: {
          groupAddressBookId_contactId: {
            groupAddressBookId: this.groupAddressBookId,
            contactId: contact.id,
          },
        },
        create: {
          groupAddressBookId: this.groupAddressBookId,
          contactId: contact.id,
          addedByUserId: this.teamOwnerId,
        },
        update: { updatedAt: new Date() },
      });

      return contact;
    });
  }

  async archiveByUid(uid: string): Promise<void> {
    await prisma.contact.updateMany({
      where: { uid, userId: this.teamOwnerId },
      data: { archivedAt: new Date() },
    });
  }

  async listActive(): Promise<Contact[]> {
    const gcs = await prisma.groupContact.findMany({
      where: {
        groupAddressBookId: this.groupAddressBookId,
        contact: { archivedAt: null },
      },
      include: { contact: true },
    });
    return gcs.map((gc) => gc.contact);
  }

  get ownerId() {
    return this.teamOwnerId;
  }

  get attributionMeta() {
    return {
      actor: "SYNC" as const,
      actorDetail: `${this.syncAccountLabel} · ${this.teamName} · ${this.bookName}`,
      teamId: this.groupId,
      addressBookId: this.groupAddressBookId,
    };
  }
}
```

#### 2.3 Runner Factory

```typescript
// src/server/sync/runner.ts (modified)

export async function createContactStore(
  syncAccount: SyncAccount,
  groupAddressBookId?: string
): Promise<ContactStore> {
  if (!groupAddressBookId) {
    return new PersonalContactStore(syncAccount);
  }

  const book = await prisma.groupAddressBook.findUniqueOrThrow({
    where: { id: groupAddressBookId },
    include: { group: true },
  });

  if (book.archivedAt) {
    throw new Error(`Cannot sync to archived book: ${book.name}`);
  }

  return new TeamContactStore(
    groupAddressBookId,
    book.groupId,
    syncAccount.label,
    book.group.name,
    book.name,
    book.group.ownerId
  );
}
```

The runner's main loop then calls `store.findByUid`, `store.upsert`, `store.archiveByUid`, etc., regardless of whether it's operating on personal or team contacts. The sync logic itself does not branch on team vs personal — the ContactStore abstraction handles it.

---

### 3. Conflict Resolution for Team Sync Accounts

When a sync conflict occurs (a contact was modified both locally and on the remote server since the last sync):

**Personal sync conflict**: surfaced to the account owner (existing Phase 7 behavior).

**Team sync conflict**: must be surfaced to team admins, not to the individual member who last edited the contact.

#### 3.1 Conflict Storage

A `SyncConflict` model should already exist from Phase 7. If not, or if it needs extension:

```prisma
model SyncConflict {
  // ... existing fields ...
  teamId        String?  // NEW: populate for team sync conflicts
  addressBookId String?  // NEW: the team book involved
}
```

#### 3.2 Conflict Notification to Admins

When a conflict is detected and stored:
1. Query all OWNER and ADMIN members of the team.
2. Send an in-app notification (or email) to each admin: "[Sync account label] has a conflict on '[Contact Name]' in [Book Name]. Please review."
3. The conflict resolution UI (existing from Phase 7) must work for team sync accounts. The acting admin who resolves the conflict becomes the `resolvedByUserId`.

---

### 4. Sync Status Display

In the team management page Sync Accounts tab, each connected sync account shows:

- Label and server URL.
- Target address book name.
- Last sync timestamp (`syncAccount.lastSyncedAt`).
- Last sync status: `SUCCESS` | `PARTIAL` | `ERROR` | `NEVER`.
- Error message if status is ERROR (truncated to 200 chars, expand on click).
- Active conflicts count (if any).
- Actions: Sync Now, Edit label, Remove.

The "Sync Now" button calls `triggerTeamSync`. It is disabled while a sync job is queued or running (`syncAccount.syncStatus === "RUNNING"`).

---

### 5. ActivityEvent Attribution for Sync

All contacts created, updated, or archived by the sync runner in a team context emit ActivityEvent rows with:

```typescript
{
  userId: teamOwnerId,
  teamId: groupId,
  actor: "SYNC",
  actorId: null,  // no user actor for automated sync
  actorDetail: `${syncAccount.label} · ${team.name} · ${book.name}`,
  entityType: "CONTACT",
  entityId: contactId,
  eventType: "CONTACT_UPDATED",  // or CREATED, ARCHIVED
  addressBookId: groupAddressBookId,
  diff: { ... },
}
```

These events appear in the team audit log (P14-05) under the "SYNC" event type category filter.

---

### 6. isTeamAccount Flag on SyncAccount

To distinguish team sync accounts from personal ones in the personal sync account list and prevent them from appearing in the personal settings:

```prisma
model SyncAccount {
  // ... existing fields ...
  isTeamAccount Boolean @default(false)
}
```

Personal sync account queries must add `WHERE isTeamAccount = false` to avoid including team accounts. The migration adds this column with `DEFAULT false` — all existing rows are correctly personal.

---

### 7. Security Considerations

- Sync account credentials (password/token) are encrypted with the existing `encrypt()` function. For team sync accounts, the encryption key is still tied to the team owner's userId (or a server-wide key — use whichever approach the existing encryption infrastructure uses).
- If the team owner's account is deleted, the encryption key must still be resolvable. Document this edge case in the key management documentation.
- Team admins see the sync account label and server URL but not the encrypted credentials.
- Admin who removes a team sync account does not see the password at any point — deletion is direct.

## Acceptance Criteria

- [ ] A team OWNER or ADMIN can connect a CardDAV sync account to a specific team address book.
- [ ] Connecting a second sync account to the same team address book is rejected with a clear error.
- [ ] Credentials are tested against the CardDAV server before the sync account is saved.
- [ ] The sync runner, when given a `groupAddressBookId`, writes contacts to `GroupContact` instead of personal `Contact`.
- [ ] Contacts created by the sync runner in a team book have `userId = team owner's userId`.
- [ ] Sync attribution: all ActivityEvent rows from team sync have `actor = SYNC`, `teamId` populated, and `actorDetail` in the correct format.
- [ ] Sync conflicts on team books are surfaced to team admins, not to individual members.
- [ ] A team OWNER or ADMIN can remove a team sync account; the SyncAccount and TeamSyncAccount rows are deleted.
- [ ] A team OWNER or ADMIN can manually trigger a sync for a team sync account.
- [ ] Syncing to an archived team address book is rejected with a clear error.
- [ ] Personal sync account list does not show team sync accounts.
- [ ] The sync runner's PersonalContactStore behavior is not changed.
- [ ] `isTeamAccount` is correctly set on new team sync accounts and is `false` on all existing sync accounts after migration.
- [ ] Audit log (P14-05) shows sync events with the correct event type category "SYNC".

## Risks and Open Questions

- **SyncAccount.uid upsert constraint**: The `upsert` in `TeamContactStore.upsert` uses `uid_userId` as the unique key. If the same vCard UID appears in multiple team books (e.g., the same contact synced to two different books from different CardDAV servers), this upsert would conflict. The correct approach is to use `groupAddressBookId + uid` as the unique key for team contacts. This may require a composite unique index on `(groupAddressBookId, contact.uid)` via the GroupContact table. Investigate before implementation.
- **Encryption key ownership**: If credentials are encrypted per-user and the team owner's account is deleted, team sync account credentials become undecryptable. This needs a key management strategy (server-side key, or key escrow). Flag for security review.
- **Phase 7 conflict model**: If `SyncConflict` does not already exist as a first-class Prisma model, this ticket must define and migrate it. Check Phase 7 implementation before starting.
- **Runner concurrency**: If two admins click "Sync Now" simultaneously, two sync jobs may run for the same sync account. The existing personal sync runner presumably has a lock (check). Ensure the lock works for team sync accounts too — the lock key should be `syncAccountId`, which is unique per sync account.
- **PUSH sync for team books**: Writing back to the CardDAV server is sensitive — it would push all team book contacts to a shared server. This may not be desired in all cases. Consider making PUSH sync ADMIN-only and adding a warning in the UI: "Bidirectional sync will write all team contacts to this CardDAV server."

## Outcome
Team admins can connect a shared CardDAV server to a specific team address book, enabling the team's contacts to stay synchronized with an external source while all mutations are attributed and auditable through the team's audit log.

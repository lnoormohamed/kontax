# P23-03 — Book Allowlist

## Purpose

Let users restrict a sync connection to specific remote address books rather than syncing every book the server exposes. A user connected to iCloud may have a "Personal" book, a "Work" book shared by a colleague, and a "Subscribed calendars" book — they likely only want "Personal" in Kontax. Without an allowlist, all discovered books sync, polluting the user's contact library with unwanted entries.

## Background

CardDAV PROPFIND discovery (P9-03) already fetches the list of address books from each remote server. The results are used during the initial connection to validate the server. This ticket caches those results and surfaces them as a selectable list in the connection settings drawer (P23-02). The allowlist is stored in `SyncAccountSettings.bookAllowlist` (P23-01) as an array of remote address book URLs.

## Scope

**In scope:**
- `GET /api/sync/[accountId]/books` endpoint — re-runs PROPFIND discovery and returns the discovered book list, using a 1-hour cache
- Book allowlist sub-section within the P23-02 settings drawer: list of discovered books with checkboxes
- `updateBookAllowlist(syncAccountId, allowlist)` server action
- Empty allowlist = sync all books (the default behaviour)
- Re-sync trigger: after saving a narrower allowlist, queue a re-scope sync job to remove contacts that came from now-excluded books

**Out of scope:**
- Creating or renaming remote address books (that is a remote server operation)
- Kontax-as-server outbound book scoping (P23-07)

---

## Design / Implementation Spec

### Book discovery endpoint

`src/app/api/sync/[accountId]/books/route.ts`:

```typescript
export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });

  const account = await db.syncAccount.findUniqueOrThrow({
    where: { id: params.accountId, userId: session.user.id },
    select: { serverUrl: true, encryptedCredential: true },
  });

  const credential = decryptCredential(account.encryptedCredential);

  // Re-run PROPFIND discovery
  const books = await discoverAddressBooks({
    serverUrl: account.serverUrl,
    username: credential.username,
    password: credential.password,
  });

  // Cache result on SyncAccount for 1 hour
  await db.syncAccount.update({
    where: { id: params.accountId },
    data: {
      discoveredBooks: books, // Json field: Array<{ url, displayName, ctag }>
      booksDiscoveredAt: new Date(),
    },
  });

  return NextResponse.json({ books });
}
```

Add `discoveredBooks Json?` and `booksDiscoveredAt DateTime?` fields to `SyncAccount`:
```prisma
discoveredBooks   Json?      // cached list of { url, displayName } objects
booksDiscoveredAt DateTime?
```

Run: `prisma migrate dev --name add-sync-account-discovered-books`

### Book allowlist UI

In the P23-02 settings section, the "Address books" disclosure expands to:

```
Address books
─────────────────────────────────────────────
Sync all address books  [toggle — off when custom]

Custom selection
☑ Personal              (default)
☑ Work contacts
☐ Subscriptions (read-only on remote)
☐ Shared family

[Refresh list]          [Save]
```

- **"Sync all" toggle:** when on (default), the checkboxes are greyed out and the allowlist is empty (all books sync). When turned off, the user selects individual books.
- **Checkboxes:** each discovered book with its remote `displayName`. Pre-checked based on the current allowlist; if allowlist is empty, all are checked (representing "sync all").
- **"Refresh list":** calls `GET /api/sync/[accountId]/books` to re-run discovery and update the book list.
- Books that were previously synced but are no longer discovered are shown with a `(not found on remote)` note and pre-unchecked.

### `updateBookAllowlist` server action

```typescript
export async function updateBookAllowlist(input: {
  syncAccountId: string;
  allowlist: string[]; // array of remote book URLs; empty = all
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("UNAUTHENTICATED");

  await db.syncAccount.findUniqueOrThrow({
    where: { id: input.syncAccountId, userId: session.user.id },
  });

  await db.syncAccountSettings.update({
    where: { syncAccountId: input.syncAccountId },
    data: { bookAllowlist: input.allowlist },
  });

  // If allowlist narrowed, queue a re-scope job to clean up excluded contacts
  if (input.allowlist.length > 0) {
    await queueSyncJob({
      syncAccountId: input.syncAccountId,
      trigger: "SETTINGS_CHANGE",
      rescopeOnly: true, // removes contacts from excluded books, does not re-import
    });
  }
}
```

### Re-scope job behaviour

A re-scope sync job (triggered after narrowing the allowlist) runs a targeted cleanup:
1. Find all contacts in Kontax that have `sourceAccountId = syncAccountId` and `sourceBookUrl` not in the new allowlist.
2. Archive those contacts (set `archivedAt`; do not hard-delete).
3. Log each archive as an `ActivityEvent` with `source: SYNC` and a note that it was removed due to allowlist change.

This is reversible — the user can restore archived contacts or widen the allowlist again.

---

## Acceptance Criteria

- `GET /api/sync/[accountId]/books` returns the list of discovered address books for the account.
- The UI shows all discovered books with checkboxes; the current allowlist is reflected.
- Saving a custom selection calls `updateBookAllowlist` and updates `SyncAccountSettings.bookAllowlist`.
- Narrowing the allowlist queues a re-scope job that archives (not deletes) contacts from excluded books.
- The "Refresh list" button re-runs discovery and updates the checkbox list.
- With an empty allowlist, all discovered books are synced (default behaviour preserved).

---

## Risks and Open Questions

- **Read-only remote books:** some remote books are read-only (e.g., subscribed address books shared by another user). Kontax can import from them but should not attempt to push changes. Mark read-only books in the UI and automatically treat them as `IMPORT_ONLY` regardless of the connection-level direction setting.
- **Book URL stability:** CardDAV book URLs can change if the user renames a book on the remote. If a book URL in the allowlist no longer exists on the remote, surface it as a warning rather than silently dropping it. The "Refresh list" action should flag missing URLs.
- **Re-scope performance:** for accounts with large contact libraries, the re-scope job may take minutes. Run it asynchronously and show progress in the sync job history row.

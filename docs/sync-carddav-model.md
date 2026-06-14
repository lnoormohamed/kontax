# Sync & CardDAV model

**Cross-cutting subsystem.** How Kontax syncs contacts with external sources — both as a CardDAV server (devices pull from Kontax) and as a CardDAV/OAuth client (Kontax pulls from remote services).

---

## Two roles, one `SyncAccount` table

Kontax plays both sides of the sync equation:

| Role | What it does |
|------|-------------|
| **CardDAV server** | Serves contacts at `/dav/{userId}/contacts/` so iOS/Mac/Android can add Kontax as a CardDAV account. |
| **Sync client** | Polls remote CardDAV servers (iCloud, Nextcloud, Fastmail) and OAuth APIs (Google Contacts, Microsoft Graph) on a schedule. |

Both sides use the `SyncAccount` table to track connection state, credentials, and sync position.

---

## CardDAV server (inbound)

Devices connect to `{APP_URL}/dav/{userId}/contacts/`. The server implements the CardDAV/WebDAV subset needed by major clients:

- `PROPFIND` — list address books and contacts (ETags for change detection).
- `GET` — fetch a contact as vCard 3.0.
- `PUT` — create or update a contact.
- `DELETE` — delete or tombstone a contact.
- `REPORT` (addressbook-query, sync-collection) — efficient delta sync.

Authentication is HTTP Basic with app-specific passwords (`AppPassword` table, bcrypt-hashed). Each app password has a `syncAccountId` linking it to a `SyncAccount` row so Kontax knows which device made which change.

### `lastMutatedBy` sentinel

When the CardDAV server processes a `PUT` from a device, it stamps `Contact.lastMutatedBy = syncAccountId`. This prevents echo-loops: the sync client skips pushing back contacts to the server that just sent them.

### `syncVersion` counter

Each contact has a `syncVersion` integer (Kontax internal). On every write (any source), `syncVersion` increments. The CardDAV server uses ETags derived from `syncVersion` to tell clients whether a contact changed since they last fetched it.

---

## Sync client (outbound polling)

The sync runner (`src/server/sync-runner.ts`) polls configured sync accounts on a schedule. Two sub-engines:

### CardDAV client

Connects to remote CardDAV servers (iCloud, Nextcloud, Fastmail, others) using:
- Server URL, username, and an app-specific password from the remote service (stored encrypted in `SyncAccount.encryptedCredentials`).
- Uses `REPORT sync-collection` for delta sync (only changed contacts since last `syncToken`).
- On first sync: full `PROPFIND` to download all contacts.

Conflict resolution: **LAST_WRITE_WINS** at the field level, with a snapshot stored in `SyncConflictSnapshot` for audit purposes. The strategy is configurable per `SyncAccount`.

### OAuth client (Google & Microsoft)

Connects to Google Contacts API (v1) and Microsoft Graph Contacts API using OAuth 2.0 access tokens:
- Tokens are encrypted and stored in `SyncAccount.encryptedCredentials`.
- Refresh tokens are used to get new access tokens when they expire (~1 hour TTL for access tokens).
- On token revocation: `SyncAccount.status` → `ERROR`, `lastError` set.

The OAuth sync engine maps provider-specific field names to Kontax's contact schema via `src/server/sync-contact-mapping.ts`.

---

## SyncAccount status machine

| Status | Meaning |
|--------|---------|
| `PENDING` | Created but not yet first-synced |
| `ACTIVE` | Syncing normally |
| `PAUSED` | Suspended (billing downgrade — over sync limit) |
| `ERROR` | Auth failure or repeated errors — requires user action to reconnect |

Transitions:
- First sync succeeds → `PENDING → ACTIVE`
- Auth error / repeated failures → `ACTIVE → ERROR`
- Billing downgrade → `ACTIVE → PAUSED` (oldest account kept active)
- User reconnects → `ERROR → ACTIVE`

---

## Dedup during sync

When the sync engine imports a contact from a remote source, `sync-dedup.ts` checks for matches by name + email + phone. If a match is found:
- **Merge**: the remote fields are merged into the existing contact using the conflict strategy.
- **Skip**: if the match is confident and the data is identical, the import is skipped.
- **Create**: if no match, a new contact is created with `source = SYNC_CARDDAV` or `source = SYNC_OAUTH`.

---

## References

- Sync runner: `src/server/sync-runner.ts`
- Dedup: `src/server/sync-dedup.ts`
- Contact mapping (field name translation): `src/server/sync-contact-mapping.ts`
- Conflict snapshots: `src/server/sync-conflict-snapshot.ts`
- OAuth state (token refresh): `src/server/sync-oauth-state.ts`
- Credentials (encrypted storage): `src/server/sync-credentials.ts`
- Health checks: `src/server/sync-health.ts`
- Runbook: [sync-ops.md](../roadmap/runbooks/sync-ops.md)

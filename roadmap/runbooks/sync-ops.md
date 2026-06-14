# Runbook: Sync engine operations

**Subsystem:** CardDAV and OAuth (Google/Outlook) contact sync  
**Audience:** Engineers investigating sync failures or user-reported sync issues

---

## Overview

Kontax supports two sync mechanisms:

1. **CardDAV** — server-to-server protocol. Kontax acts as a CardDAV server (contacts accessible at `/dav/...`) and as a CardDAV client syncing with remote servers (iCloud, Nextcloud, Fastmail).
2. **OAuth sync** — Google Contacts API and Microsoft Graph Contacts, authenticated via OAuth 2.0 tokens stored (encrypted) in `SyncAccount`.

Sync jobs run on a schedule and on-demand. The sync engine lives in `src/server/sync-runner.ts` and related files.

---

## Normal state

- All `SyncAccount` rows have `status = 'ACTIVE'` and a recent `lastSyncedAt`.
- No `SyncAccount` rows with `status = 'ERROR'` or `lastError` set.
- Sync runs complete without errors in Coolify logs.

---

## Monitoring signals

- `SyncAccount.status`: `ACTIVE`, `PAUSED` (billing downgrade), `ERROR` (auth failure or repeated errors), `PENDING` (not yet first-synced).
- `SyncAccount.lastError`: most recent error message.
- `SyncAccount.lastSyncedAt`: when the last successful sync completed.
- User-visible: Sync page shows a red error badge and last error description.

---

## Failure modes & recovery

### CardDAV: authentication error

**Symptom:** `SyncAccount.status = 'ERROR'`, `lastError` contains `401 Unauthorized` or `Invalid credentials`.

**Cause:** The user's app-specific password expired or was revoked (iCloud auto-expires app passwords; users may have regenerated their password).

**Recovery:**
1. Ask the user to generate a new app-specific password from their provider.
2. They update it in Kontax → Sync → edit the account → re-enter credentials.
3. The next sync run clears the error and sets `status = 'ACTIVE'`.

There is no admin path to update another user's credentials.

### OAuth: token expired or revoked

**Symptom:** `SyncAccount.status = 'ERROR'`, `lastError` contains `401` or `invalid_grant` (Google) or `Authorization_RequestDenied` (Microsoft).

**Cause:** Google OAuth tokens expire after ~6 months of inactivity. Microsoft tokens can be revoked when the user changes their Microsoft password or revokes app access.

**Recovery:**
1. User goes to Kontax → Sync → finds the failed account → clicks Reconnect.
2. They go through the OAuth flow again; a new token is stored.
3. The connector triggers a full resync from where it left off (using `syncVersion` and `lastMutatedBy` to avoid re-importing unchanged contacts).

### Sync not running (stuck)

**Symptom:** `SyncAccount.lastSyncedAt` is hours or days old for accounts that should sync every 15 minutes.

**Check:**
1. Is the sync cron job running? Check Coolify logs for the sync trigger.
2. Is there a server error? Check app logs around the expected sync time.
3. Is `CRON_SECRET` set correctly? The sync trigger endpoint requires this header.

**Recovery:** Trigger a manual sync from the Sync page (user-facing) or via the admin panel if available. If the cron is not running, check the LXC crontab on Proxmox LXC 114.

### syncVersion drift / contacts duplicated

**Symptom:** Contacts appear twice after a sync.

**Cause:** The `syncVersion` counter on a contact fell out of sync with the remote server's ETag or version, causing the engine to re-import a contact that already exists.

**Recovery:**
1. The dedup engine (`src/server/sync-dedup.ts`) should catch this on the next pass.
2. If not, direct the user to the Duplicates tab to merge the pairs manually.
3. File a bug with the contact ID and `SyncAccount.id` if this recurs.

### CardDAV server not reachable from client

**Symptom:** User reports their phone's Contacts app stopped syncing. No errors on the Kontax side.

**Check:** The CardDAV server URL is `APP_URL + /dav/` (e.g. `https://kontax.vexon.co/dav/`). If `APP_URL` is wrong or the app is down, client devices cannot reach it.

**Recovery:** Ensure `APP_URL` is set correctly and the app is reachable at that URL. Users may need to re-enter credentials in their CardDAV client after an `APP_URL` change.

---

## Forced re-sync

If a user's contacts are badly out of sync (e.g. after a data migration):
1. In the admin panel, or directly in the DB, set `SyncAccount.syncVersion = 0` and `lastSyncedAt = null`.
2. The next sync run treats this as a first sync and does a full import.

> This will re-import everything from the remote — existing contacts will be deduped but it can be noisy. Warn the user.

---

## References

- Sync runner: `src/server/sync-runner.ts`
- Sync dedup: `src/server/sync-dedup.ts`
- Sync credentials (token storage): `src/server/sync-credentials.ts`
- Sync conflict resolution: `src/server/sync-conflict-snapshot.ts`
- OAuth state management: `src/server/sync-oauth-state.ts`
- Sync health checks: `src/server/sync-health.ts`

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
3. The connector triggers a full resync from where it left off (using the per-contact `Contact.syncVersion` / `Contact.lastMutatedBy` and the `SyncContactLink` rows to avoid re-importing unchanged contacts).

### Sync not running (stuck)

**Symptom:** `SyncAccount.lastSyncedAt` is hours or days old for accounts that should sync every 15 minutes.

**Check:**
1. Is the sync cron job running? Check Coolify logs for the sync trigger.
2. Is there a server error? Check app logs around the expected sync time.
3. Is `CRON_SECRET` set correctly? The sync trigger endpoint requires this header.

**Recovery:** Trigger a manual sync from the Sync page (user-facing) or via the admin panel if available. If the cron is not running, check `/etc/cron.d/kontax` on the cron host (Proxmox LXC 152 `kontax-cron`). If the cron is running but one account never syncs, see "Stuck sync job" below.

### Stuck sync job (RUNNING forever / account never re-enqueued)

**Symptom:** one account's `lastSyncedAt` stops advancing; its newest `SyncJob` row is `RUNNING` with a `startedAt` long in the past. Before P49A-04 this happened on every deploy that landed mid-sync (the container was SIGKILLed, the job was orphaned, and `enqueueDueSyncJobs` skips accounts with a `RUNNING` job).

**How it self-heals now (P49A-04):**
- A worker holds a 10-minute lease (`SyncJob.leaseExpiresAt`) and renews it every 2 minutes while the job runs (`createSyncLeaseKeeper` in `src/server/sync-job-lifecycle.ts`).
- Every enqueue and drain starts with `reclaimExpiredSyncJobs()` (`src/server/sync-runner.ts`): any `RUNNING` job whose lease lapsed becomes `FAILED` with `errorCode = 'LEASE_EXPIRED'` and `nextRetryAt = now`. The next cron tick enqueues the account again. Log line: `[sync] reclaimed N sync job(s) with an expired lease`.
- On graceful shutdown (SIGTERM) the server stops claiming, waits up to `SHUTDOWN_GRACE_MS` (default 20 s) for the running job, and if it must abandon it, expires its lease immediately so the replacement container reclaims it on its first tick.
- Scheduled runs honour `nextRetryAt` of the last `FAILED` job (backoff 5 / 15 / 60 / 180 / 720 min); `enqueueDueSyncJobs` reports those accounts as `deferred`.

**Check:**
```sql
SELECT id, "syncAccountId", status, "startedAt", "leaseExpiresAt", "workerId", "errorCode", "nextRetryAt"
FROM "SyncJob"
WHERE status IN ('QUEUED', 'RUNNING')
ORDER BY "createdAt";
```
- `RUNNING` with `leaseExpiresAt` in the future → a live worker holds it; leave it.
- `RUNNING` with `leaseExpiresAt` in the past → it will be reclaimed on the next cron tick (`POST /api/cron/sync`). If ticks are running and it is still there, the cron is not reaching the app — check the cron host.
- `QUEUED` with `nextRetryAt` in the future → deliberate backoff; it runs when due.
- Latest job `FAILED` / `LEASE_EXPIRED` repeatedly → the worker keeps dying mid-run (OOM, crash loop) rather than being redeployed; check container restarts and memory.

**Manual recovery** (only if the automatic reclaim cannot run, e.g. the cron is down):
```sql
UPDATE "SyncJob"
SET status = 'FAILED', "completedAt" = NOW(), "leaseExpiresAt" = NULL, "workerId" = NULL,
    "nextRetryAt" = NOW(), "errorCode" = 'LEASE_EXPIRED',
    "errorSummary" = 'Manually reclaimed by ops'
WHERE id = '<job id>' AND status = 'RUNNING';
```
Then trigger a tick (`POST /api/cron/sync` with `x-cron-secret`) or ask the user to press "Sync now".

**Deploy setting:** the container must be given more than `SHUTDOWN_GRACE_MS` to stop — set the Coolify/Docker stop grace period to at least 30 s (Docker's default is 10 s, which SIGKILLs a draining server). Graceful shutdown depends on `scripts/runtime/start-production.mjs` (PID 1) forwarding SIGTERM to `node server.mjs`; look for `[startup] Received SIGTERM; forwarding…` followed by `[Kontax] SIGTERM received — draining` and `[Kontax] drained cleanly` in the container log on each redeploy.

### Stuck export (PROCESSING forever / "export already in progress")

**Symptom:** a user cannot request a new data export (the request returns the old job), or the Kontax Archive export spinner never finishes.

**How it self-heals now (P49A-04):** `POST /api/cron/data-export` starts by reclaiming:
- `DataExportJob` rows `PROCESSING` for more than 30 min (the route itself is capped at 5 min) → `FAILED` with an "Interrupted" message. `getActiveDataExportJob` already ignores such rows, so the user can request again even before the cron reclaims it.
- `KontaxExportJob` rows `PROCESSING` whose `updatedAt` (heartbeat every 25 contacts) is more than 30 min old → `FAILED` and the user gets an "Export didn't finish" notification.
- Log lines: `[data-export] reclaimed N export job(s) stuck in PROCESSING` / `[Kontax] reclaimed N archive export job(s)`.
- A failed "your export is ready" email or notification no longer flips a finished export to `FAILED`; the cron response reports `emailed: false` and the log says `is READY but the notification email failed`.

**Check:**
```sql
SELECT id, "userId", status, "requestedAt", "startedAt", "errorMessage" FROM "DataExportJob" WHERE status IN ('PENDING', 'PROCESSING');
SELECT id, "userId", status, "startedAt", "updatedAt", "progressCount", "totalCount", "errorSummary" FROM "KontaxExportJob" WHERE status IN ('PENDING', 'PROCESSING');
```

**Manual recovery** (cron down):
```sql
UPDATE "DataExportJob" SET status = 'FAILED', "completedAt" = NOW(), "errorMessage" = 'Interrupted — request a new export.' WHERE id = '<id>' AND status = 'PROCESSING';
UPDATE "KontaxExportJob" SET status = 'FAILED', "completedAt" = NOW(), "errorSummary" = 'Interrupted — request a new export.' WHERE id = '<id>' AND status = 'PROCESSING';
```
The user then requests the export again.

### Conflicts piling up / account auto-paused with a full conflict queue

Since P49A-04 a link has at most one `OPEN` `SyncConflict`: a divergence re-detected on the next run refreshes the existing row (snapshots, `remoteETag`) instead of opening a duplicate, and the job summary says "N conflicts still awaiting review". An account that still hits `SYNC_CONFLICT_QUEUE_FULL` (50 open) has 50 genuinely different contacts in conflict. Rows opened before this fix may still be duplicated per link:
```sql
SELECT "syncContactLinkId", COUNT(*) FROM "SyncConflict" WHERE status = 'OPEN' GROUP BY 1 HAVING COUNT(*) > 1;
```

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
1. In the admin panel, or directly in the DB, clear the account's sync cursor: set `SyncAccount.lastSyncCursor = NULL`, `SyncAccount.remoteCTag = NULL` and `SyncAccount.lastSyncedAt = NULL`. (There is no `SyncAccount.syncVersion`; `syncVersion` is a per-contact counter on `Contact` and must not be reset.)
2. The next sync run treats this as a first sync and does a full import (Google/Outlook: no stored sync token/delta link → full listing; CardDAV already fetches the full address-book index on every run and re-matches against the existing `SyncContactLink` rows).

> This will re-import everything from the remote — existing contacts will be deduped but it can be noisy. Warn the user.

---

## References

- Sync runner: `src/server/sync-runner.ts`
- Sync dedup: `src/server/sync-dedup.ts`
- Sync credentials (token storage): `src/server/sync-credentials.ts`
- Sync conflict resolution: `src/server/sync-conflict-snapshot.ts`
- OAuth state management: `src/server/sync-oauth-state.ts`
- Sync health checks: `src/server/sync-health.ts`

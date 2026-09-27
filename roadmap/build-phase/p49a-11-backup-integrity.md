# P49A-11 — Backups: pipefail, verified dumps, off-host copy

**Phase:** 49A · **Priority:** P0 · **Status:** Done 2026-09-27 · **Depends on:** — · **Effort:** S
**Audit IDs:** A-15 (high)

## Objective
A backup that is logged OK is complete and restorable, and a host loss costs at most a day.

## Production verification (2026-09-25)
- Checked on the prod DB host (LXC 129): `/usr/local/bin/kontax-pg-backup.sh` has `set -u` only —
  **no `pipefail`**; it runs `$PGDUMP -d kontax | gzip > "$OUT.tmp" && gzip -t "$OUT.tmp"`, so a
  pg_dump that dies mid-stream still yields a valid (truncated) gzip that is logged OK.
- `age` is not installed on the host (encryption remains deferred by decision on 2026-09-25; the
  script silently falls back to plaintext when `AGE_RECIPIENT` is set but `age` is missing).
- Off-host copy today is the monthly Proxmox vzdump only (decision 2026-09-25: keep monthly).

## Steps
1. `set -euo pipefail`; switch to `pg_dump -Fc -f "$OUT.tmp"` and verify with `pg_restore -l`
   before the atomic rename; log size and duration.
2. If `AGE_RECIPIENT` is set and `age` is missing → fail loudly (non-zero, alert), never plaintext.
3. Nightly off-host copy of the latest dump (target to be chosen: NFS storage already mounted for
   app storage, or another Proxmox node), retaining 14 days.
4. Monthly scripted restore test into a scratch DB with row-count comparison; document in
   `db-restore.md` (and fix the runbook drift noted in the audit).
5. Update the repo copy `scripts/ops/kontax-pg-backup.sh`, then install on LXC 129
   (prod change — requires explicit go-ahead at the time).

## Acceptance
- Killing pg_dump mid-run produces a non-zero exit, an error log line, and no new dump file.
- A restore test from last night's dump succeeds and matches row counts.

## Resolution (2026-09-27)
- `scripts/ops/kontax-pg-backup.sh` rewritten: bash `set -euo pipefail`, `pg_dump --format=custom`
  to a temp file, verified with `pg_restore --list`, atomic rename, `last-success` marker, loud
  failure if `AGE_RECIPIENT` is set without `age`, 30-day retention (old `.sql.gz` too).
- Off-host: `scripts/ops/kontax-db-offsite.sh` on the Proxmox host copies the newest dump to the NAS
  (`/mnt/pve/pve-backup-nfs/kontax-db/`, 14 days, 03:00) and logs `FAILED` if it is older than 26 h.
- Monthly restore test: `scripts/ops/kontax-db-restore-test.sh` (1st of the month, 04:00) restores
  into a throwaway DB, compares key row counts, drops it.
- Installed and run once by hand on production: backup OK (326 KB, 1 s), restore test OK, off-host
  copy OK. Runbook `db-restore.md` updated (new format, restore commands, encryption status).
- Not done: encryption (deferred by owner) and alerting — failures are logged, not paged. A
  Coolify/uptime check on `last-success` age would close that gap.

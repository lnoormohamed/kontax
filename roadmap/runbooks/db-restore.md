# Database Runbook — Kontax

## Instances

| Instance | Host | Port | Database | User | Purpose |
|----------|------|------|----------|------|---------|
| Staging | 10.0.0.200 (LXC 131 `postgresql-staging` on Proxmox 10.0.0.10) | 5432 | `kontax` | `kontax` | kontax.vexon.co — smoke tests, development |
| Production | 10.0.50.193 (LXC 129 `postgresql` on Proxmox 10.0.50.10) | 5432 | `kontax` | `kontax` | getkontax.com — live users |

> The production network was re-addressed from `192.168.1.x` to `10.0.50.x`
> after provisioning. References to `192.168.1.193` further down are the
> historical provisioning record, not the current address.

Both instances run **PostgreSQL 18.1** on separate database servers. Production and staging are on different hosts with no shared resources.

## Connection strings

Stored in Coolify environment variables — never commit to git.

| Instance | Coolify env var | Value |
|----------|-----------------|-------|
| Staging | `DATABASE_URL` (staging app) | `postgresql://kontax:<pw>@10.0.0.200:5432/kontax` |
| Production | `DATABASE_URL` (prod app) | `postgresql://kontax:<pw>@10.0.50.193:5432/kontax` |

Passwords are stored in Coolify — not in any git-tracked file.

## Production DB provisioning (P34D-09 — completed 2026-06-16)

Provisioned on **192.168.1.193** (PostgreSQL 18.1). Same user/password as staging for operational simplicity; isolation is at the host level.

```sql
-- Run as postgres superuser on 192.168.1.193
CREATE USER kontax WITH
  PASSWORD '<same as staging>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN;

CREATE DATABASE kontax
  OWNER = kontax
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.utf8'
  LC_CTYPE = 'en_US.utf8'
  TEMPLATE = template0;

REVOKE ALL ON DATABASE kontax FROM PUBLIC;
GRANT CONNECT ON DATABASE kontax TO kontax;

-- Connect to kontax, then:
GRANT ALL ON SCHEMA public TO kontax;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kontax;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kontax;
```

## Schema push (P34D-10 — completed 2026-06-16)

Prisma schema applied to production via:

```bash
DATABASE_URL="postgresql://kontax:<pw>@192.168.1.193:5432/kontax" \
  npx prisma db push --skip-generate
```

Result: 45 tables created. No `--accept-data-loss` required or used (fresh database).

**Note on search indexes:** The app uses `to_tsvector()` computed at query time — there is no stored `searchVector` column or GIN index on `Contact`. This is intentional (see `src/server/contact-search.ts`).

## Backup

### Setup — completed 2026-06-17 (P34D-10)

Provisioned remotely via `COPY TO PROGRAM` as the postgres superuser. No SSH required.

- **Backup directory**: `/var/lib/postgresql/backups/kontax/` (owned by `postgres`, mode 750)
- **Credentials**: `/var/lib/postgresql/.pgpass` (mode 600) — `192.168.1.193:5432:kontax:kontax:<pw>`
- **pg_dump binary**: `/usr/lib/postgresql/18/bin/pg_dump` (PostgreSQL 18.1, matches server version)
- **Crontab**: installed under the `postgres` OS user (uid=102)

First backup run manually on 2026-06-17: `/var/lib/postgresql/backups/kontax/kontax_20260617.sql.gz` — 12 KB, 3,613 SQL lines. ✅

### Current nightly backup — script-based (P49A-11, since 2026-09-27)

Three scripts, all in this repo under `scripts/ops/`:

| Script | Runs on | When | What |
|---|---|---|---|
| [`kontax-pg-backup.sh`](../../scripts/ops/kontax-pg-backup.sh) | LXC 129, `postgres` crontab | `0 2 * * *` | `pg_dump --format=custom` → `kontax_YYYYMMDD.dump` via a temp file, verified with `pg_restore --list` before it replaces anything; `set -euo pipefail` so a half-finished dump fails the run; writes `last-success`; keeps 30 days |
| [`kontax-db-offsite.sh`](../../scripts/ops/kontax-db-offsite.sh) | Proxmox host 10.0.50.10, root crontab | `0 3 * * *` | Copies the newest dump to the NAS: `/mnt/pve/pve-backup-nfs/kontax-db/` (mode 600, size-checked); keeps 14 days; logs `FAILED` if the newest dump is older than 26 h |
| [`kontax-db-restore-test.sh`](../../scripts/ops/kontax-db-restore-test.sh) | LXC 129, `postgres` crontab | `0 4 1 * *` | Restores the newest dump into `kontax_restore_test`, compares row counts of key tables with live, drops it |

- **Check it ran**:
  - LXC 129: `tail -5 /var/lib/postgresql/backups/kontax/backup.log` — expect `OK kontax_YYYYMMDD.dump <bytes> bytes in <n>s`
    nightly and a monthly `restore-test OK …` line; `cat …/kontax/last-success`.
  - Host: `tail -3 /var/log/kontax-db-offsite.log` — expect `OK copied kontax_YYYYMMDD.dump …`.
- **Update the installed copies** after changing a script in the repo:
  ```bash
  ssh -i ~/.ssh/claude-proxmox-uk root@10.0.50.10 'cat > /tmp/kontax-pg-backup.sh' < scripts/ops/kontax-pg-backup.sh
  ssh -i ~/.ssh/claude-proxmox-uk root@10.0.50.10 'pct push 129 /tmp/kontax-pg-backup.sh /usr/local/bin/kontax-pg-backup.sh --perms 0755 && rm /tmp/kontax-pg-backup.sh'
  # same pattern for kontax-db-restore-test.sh; the offsite script is installed directly on the host:
  ssh -i ~/.ssh/claude-proxmox-uk root@10.0.50.10 'cat > /usr/local/bin/kontax-db-offsite.sh && chmod 755 /usr/local/bin/kontax-db-offsite.sh' < scripts/ops/kontax-db-offsite.sh
  ```
- Installed 2026-09-27: first custom-format dump 326 KB in 1 s; restore test OK
  (User 3/3, Contact 1/1, `_prisma_migrations` 6/6); first off-host copy OK. The previous script
  is kept as `/usr/local/bin/kontax-pg-backup.sh.bak-20260927` on LXC 129; previous crontabs as
  `/tmp/pgcron.bak` (LXC 129) and `/root/crontab.bak-20260927` (host).
- Older `kontax_YYYYMMDD.sql.gz` files (plain SQL, pre-2026-09-27) are pruned by the same 30-day rule.

### Failure alerts (Uptime Kuma push monitor)

All three scripts report to one Uptime Kuma **Push** monitor, "Kontax DB backup"
(Kuma: LXC 131 on 10.0.50.10, http://10.0.50.73:3001):

- `kontax-pg-backup.sh` pushes `up` after a verified dump and `down` (with the reason) on any failure.
- `kontax-db-offsite.sh` and `kontax-db-restore-test.sh` push only `down`, so a later success can
  never hide a failed nightly backup; the next good backup flips the monitor back to up.
- The monitor's heartbeat interval is 26 h, so a job that never runs (cron gone, container down)
  also goes down.
- The push URL is in `/etc/kontax-backup.env` (`KUMA_PUSH_URL=http://10.0.50.73:3001/api/push/<token>`),
  on LXC 129 (`root:postgres`, mode 640) and on the Proxmox host (`root`, mode 600). It is read with
  `sed`, never sourced. The file is missing → the scripts skip alerting; Kuma unreachable → a
  `WARN: alert push failed` log line. Neither ever changes the backup's own result.
- Kuma only pages if the monitor has a **notification channel** (Settings → Notifications). As of
  2026-09-27 Kuma had none, so no monitor alerted anyone.
- Test an alert without breaking anything:
  `curl -G --data-urlencode status=down --data-urlencode "msg=test alert" "$KUMA_PUSH_URL"`,
  then run `kontax-pg-backup.sh` (as postgres) to put it back up.

Separately, Proxmox snapshots the whole LXC 129 to the NAS monthly (job
`c02d393d`, 1st of the month 02:30, storage `pve-backup-nfs`).

### Backup encryption (P48-17) — NOT enabled

> **Status (2026-09-27): deferred by owner decision (2026-09-25).** `age` is not installed on
> LXC 129 and `AGE_RECIPIENT` is not set, so dumps on disk and on the NAS are **unencrypted**. If
> `AGE_RECIPIENT` is set without `age` installed, the backup now fails instead of writing
> plaintext. When enabled, the script encrypts the verified `.dump` to `.dump.age`.

The crontab above writes a plain `gzip`'d dump to disk — anyone with
filesystem or off-host-copy access to `/var/lib/postgresql/backups/kontax/`
can read every contact, every hashed password, and (since sync credentials
and TOTP secrets are stored as opaque ciphertext blobs, but the dump is a
full logical backup) the encrypted blobs themselves in a form that could be
replayed if `SYNC_CREDENTIAL_ENCRYPTION_KEY`/`AUTH_SECRET` were ever also
exposed. Encrypt every dump with [`age`](https://github.com/FiloSottile/age)
(asymmetric, recipient-key based — the crontab only ever needs the **public**
key, so a compromise of the backup host alone cannot decrypt past backups).

**One-time setup:**

```bash
# Generate the keypair ONCE, ideally on a machine other than the backup host:
age-keygen -o kontax-backup-key.txt
# Prints the public key to stderr, e.g.:
#   Public key: age1qyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqrx8p9x
```

- The **public** key (the `age1...` string) is not secret — it goes straight
  into the crontab below.
- The **private** key file (`kontax-backup-key.txt`) is the only thing that
  can decrypt any backup ever made with it. Store it as a Coolify secret (or
  equivalent secret store) — the same way `SYNC_CREDENTIAL_ENCRYPTION_KEY`
  and `AUTH_SECRET` are handled per `roadmap/runbooks/env-secrets.md` — never
  in the backup directory itself, never committed to git, and never only on
  the database host (that would let anyone who can read the backups directory
  also decrypt them, defeating the point).
- Losing the private key makes every backup encrypted with it permanently
  unreadable. Losing it is a bigger operational risk than losing a single
  backup file, so treat it with the same care as a production signing key.
- Rotating the key: generate a new keypair, update `AGE_RECIPIENT` in the
  crontab to the new public key, and keep the retired private key until the
  last backup encrypted under it ages out (30 days, per the `-mtime +30
  -delete` retention job below) — old backups still need the old key to
  decrypt.

**Status: not enabled** (deferred on 2026-09-25). Dumps are currently plain
gzip. The `/security` page's "encrypted nightly backups" claim is not yet true
until this is switched on.

**Enabling it** — the backup script encrypts when `AGE_RECIPIENT` is set, piping
the gzip'd dump through `age` before it touches disk:

```bash
# On LXC 129, once:
apt-get install -y age
# Then change the postgres crontab entry to (real public key from age-keygen):
0 2 * * * AGE_RECIPIENT=age1... /usr/local/bin/kontax-pg-backup.sh
```

Output files become `kontax_YYYYMMDD.sql.gz.age`; the script's retention step
already prunes both `.sql.gz` and `.sql.gz.age` older than 30 days.

**Decrypting a backup** (first step before any restore below):

```bash
age -d -i /path/to/kontax-backup-key.txt \
  /var/lib/postgresql/backups/kontax/kontax_YYYYMMDD.sql.gz.age \
  > kontax_YYYYMMDD.sql.gz
```

### Verify a backup file

```bash
# On LXC 129 as postgres (encrypted dumps: `age -d -i key.txt -o x.dump x.dump.age` first):
/usr/lib/postgresql/18/bin/pg_restore --list /var/lib/postgresql/backups/kontax/kontax_YYYYMMDD.dump | head
# Lists the archive's table of contents; a truncated or corrupt file errors out.
```

## Restore from dump

### Full restore to a new database

```bash
# 1. Create the target database (as postgres)
createdb -O kontax kontax_restored

# 2. Restore (custom format; add `age -d` first if the dump is encrypted)
/usr/lib/postgresql/18/bin/pg_restore --no-owner --role=kontax --exit-on-error \
  -d kontax_restored /var/lib/postgresql/backups/kontax/kontax_YYYYMMDD.dump
#    From the NAS copy: pct push 129 /mnt/pve/pve-backup-nfs/kontax-db/kontax_YYYYMMDD.dump /tmp/restore.dump

# 3. Verify table and row counts
psql -d kontax_restored -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"

# 4. Swap (once verified): update DATABASE_URL in Coolify to point to kontax_restored,
#    then drop the old kontax database. For validate-mode startup, the restored DB carries its
#    own _prisma_migrations table, so no migration step is needed if the dump is from the same release.
```

Older plain-SQL backups (`kontax_YYYYMMDD.sql.gz`): `gunzip -c file.sql.gz | psql -d kontax_restored`.

**RTO:** a full restore of the current production dump takes seconds (326 KB, 2026-09-27); expect
minutes as contact counts grow.

### Restore test

Automated monthly by `kontax-db-restore-test.sh` (see above). To run one by hand on LXC 129:
`su postgres -c /usr/local/bin/kontax-db-restore-test.sh && tail -1 /var/lib/postgresql/backups/kontax/backup.log`.

## Checking user privileges

```sql
-- As postgres superuser
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname = 'kontax';
```

Expected: all privilege columns are `f`.

## Emergency access

If the Coolify production app cannot connect to the DB:

1. Verify the DB host is reachable from the app LXC: `nc -z -w5 192.168.1.193 5432`
2. Verify PostgreSQL is running on 192.168.1.193: `systemctl status postgresql`
3. Check `pg_hba.conf` permits the app LXC IP on port 5432 for the `kontax` user
4. Check `postgresql.conf` — `listen_addresses` must include `*` or the server's LAN IP
5. After any config change: `systemctl reload postgresql`
6. Check recent PostgreSQL logs: `journalctl -u postgresql --since "1 hour ago"`

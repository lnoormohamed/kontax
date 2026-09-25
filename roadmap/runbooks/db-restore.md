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

### Current nightly backup — script-based (since 2026-09-15)

The original crontab was malformed (both jobs on one line with a literal
`\n`, doubled backslashes before `%`) and pointed at the old
`192.168.1.193` address, so it never ran after 2026-06-17. It was replaced on
2026-09-15 by a script that lives in this repo:

- **Script**: [`scripts/ops/kontax-pg-backup.sh`](../../scripts/ops/kontax-pg-backup.sh),
  installed on LXC 129 as `/usr/local/bin/kontax-pg-backup.sh` (root-owned,
  mode 755). It dumps over the local socket (no password needed), writes
  `kontax_YYYYMMDD.sql.gz` via a temp file, verifies it with `gzip -t`, logs one
  line per run to `backup.log`, and deletes dumps older than 30 days.
- **Crontab** (`postgres` OS user, LXC 129):
  ```
  0 2 * * * /usr/local/bin/kontax-pg-backup.sh
  ```
- **Check it ran**: `tail -3 /var/lib/postgresql/backups/kontax/backup.log`
  on LXC 129 — expect an `OK kontax_YYYYMMDD.sql.gz <bytes> bytes` line per
  night.
- **Update the installed copy** after changing the script in the repo:
  ```bash
  ssh -i ~/.ssh/claude-proxmox-uk root@10.0.50.10 'cat > /tmp/kontax-pg-backup.sh' < scripts/ops/kontax-pg-backup.sh
  ssh -i ~/.ssh/claude-proxmox-uk root@10.0.50.10 'pct push 129 /tmp/kontax-pg-backup.sh /usr/local/bin/kontax-pg-backup.sh --perms 0755 && rm /tmp/kontax-pg-backup.sh'
  ```
- The previous crontab is kept at `/root/postgres.cron.bak-*` on LXC 129.

Separately, Proxmox snapshots the whole LXC 129 to the NAS monthly (job
`c02d393d`, 1st of the month 02:30, storage `pve-backup-nfs`).

### Backup encryption (P48-17)

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

Backups since P48-17 are `age`-encrypted (`.sql.gz.age`) — decrypt first
(see above), then verify the plain `.sql.gz` exactly as before:

```bash
# From the server as postgres, after `age -d ...` (above):
gunzip -c kontax_YYYYMMDD.sql.gz | head -3
# Expected: -- PostgreSQL database dump
gunzip -c kontax_YYYYMMDD.sql.gz | wc -l
# Schema-only (no data): ~3613 lines; with data: much larger
```

## Restore from dump

### Full restore to a new database

```bash
# 1. Create target database (postgres superuser required)
psql -U postgres -c "CREATE DATABASE kontax_restored OWNER kontax;"

# 2. Decrypt, then restore
age -d -i /path/to/kontax-backup-key.txt \
  /var/lib/postgresql/backups/kontax/kontax_YYYYMMDD.sql.gz.age \
  | gunzip -c | psql -U kontax -d kontax_restored

# 3. Verify table and row counts
psql -U kontax -d kontax_restored \
  -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"

# 4. Swap (once verified): update DATABASE_URL in Coolify to point to kontax_restored,
#    then drop the old kontax database.
```

**RTO estimate (tested 2026-06-16):** Schema-only restore (45 tables, no data) completes in ~173 s. With production data, estimate ~5–15 min depending on contact count.

### Restore test procedure (run after each major schema change)

```bash
psql -U postgres -c "CREATE DATABASE kontax_restore_test OWNER kontax;"
age -d -i /path/to/kontax-backup-key.txt \
  /var/lib/postgresql/backups/kontax/kontax_YYYYMMDD.sql.gz.age \
  | gunzip -c | psql -U kontax -d kontax_restore_test --quiet
psql -U kontax -d kontax_restore_test \
  -c "SELECT count(*) FROM pg_tables WHERE schemaname='public';"
# Expected: 45
psql -U postgres -c "DROP DATABASE kontax_restore_test;"
```

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

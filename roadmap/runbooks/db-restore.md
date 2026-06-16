# Database Runbook — Kontax

## Instances

| Instance | Host | Port | Database | User | Purpose |
|----------|------|------|----------|------|---------|
| Staging | 10.0.0.200 | 5432 | `kontax` | `kontax` | kontax.vexon.co — smoke tests, development |
| Production | 192.168.1.193 | 5432 | `kontax` | `kontax` | getkontax.com — live users |

Both instances run **PostgreSQL 18.1** on separate database servers. Production and staging are on different hosts with no shared resources.

## Connection strings

Stored in Coolify environment variables — never commit to git.

| Instance | Coolify env var | Value |
|----------|-----------------|-------|
| Staging | `DATABASE_URL` (staging app) | `postgresql://kontax:<pw>@10.0.0.200:5432/kontax` |
| Production | `DATABASE_URL` (prod app) | `postgresql://kontax:<pw>@192.168.1.193:5432/kontax` |

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

### Setup — run once on 192.168.1.193 (requires SSH as root)

```bash
# 1. Create backup directory on a persistent volume
mkdir -p /mnt/backups/kontax
chown postgres:postgres /mnt/backups/kontax
chmod 750 /mnt/backups/kontax

# 2. Install cron jobs for postgres user
cat > /etc/cron.d/kontax-db-backup << 'EOF'
# Daily backup at 02:00
0 2 * * * postgres pg_dump -U kontax -d kontax | gzip > /mnt/backups/kontax/kontax_$(date +\%Y\%m\%d).sql.gz 2>> /var/log/kontax-backup.log
# 30-day retention cleanup at 02:15
15 2 * * * postgres find /mnt/backups/kontax -name "*.sql.gz" -mtime +30 -delete
EOF

chmod 644 /etc/cron.d/kontax-db-backup

# 3. Run first backup immediately to verify
sudo -u postgres bash -c "pg_dump -U kontax -d kontax | gzip > /mnt/backups/kontax/kontax_$(date +%Y%m%d).sql.gz"
ls -lh /mnt/backups/kontax/
```

> **pg_dump client version**: the server runs PostgreSQL 18.1, so `pg_dump` must be version 18.x. Remote dumps from a machine running pg_dump 16 or earlier will fail with a version mismatch error.

### Verify a backup file

```bash
# Check the dump is non-empty and valid SQL
gunzip -c /mnt/backups/kontax/kontax_YYYYMMDD.sql.gz | head -5
# Expected first line: --
# Followed by: -- PostgreSQL database dump
```

## Restore from dump

### Full restore to a new database

```bash
# 1. Create target database (postgres superuser required)
psql -U postgres -c "CREATE DATABASE kontax_restored OWNER kontax;"

# 2. Restore
gunzip -c /mnt/backups/kontax/kontax_YYYYMMDD.sql.gz | psql -U kontax -d kontax_restored

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
gunzip -c /mnt/backups/kontax/kontax_YYYYMMDD.sql.gz | psql -U kontax -d kontax_restore_test --quiet
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

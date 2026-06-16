# Database Runbook — Kontax

## Instances

| Instance | Host | Port | Database | User | Purpose |
|----------|------|------|----------|------|---------|
| Staging | 10.0.0.200 | 5432 | `kontax` | `kontax` | kontax.vexon.co — smoke tests, development |
| Production | 10.0.0.200 | 5432 | `kontax_prod` | `kontax_prod` | getkontax.com — live users |

Both instances run **PostgreSQL 18.1** on the same DB host (Debian, Proxmox LXC). Production and staging are isolated via separate databases and roles — neither user has access to the other's database.

> **Important**: Production and staging share the same PostgreSQL server process but are fully isolated at the database and role level. If stricter isolation is required in future (separate LXC per spec), migrate production data to a fresh host and update `DATABASE_URL` in Coolify.

## Connection strings

Stored in Coolify environment variables — never commit to git.

| Instance | Coolify env var | Value format |
|----------|-----------------|--------------|
| Staging | `DATABASE_URL` (staging app) | `postgresql://kontax:<pw>@10.0.0.200:5432/kontax` |
| Production | `DATABASE_URL` (prod app) | `postgresql://kontax_prod:<pw>@10.0.0.200:5432/kontax_prod` |

The production password is set in Coolify. It is not stored in any git-tracked file.

## Production DB provisioning (P34D-09 — completed 2026-06-16)

The `kontax_prod` database was provisioned as follows:

```sql
-- Run as postgres superuser on 10.0.0.200
CREATE USER kontax_prod WITH
  PASSWORD '<generated>'
  NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN;

CREATE DATABASE kontax_prod
  OWNER = kontax_prod
  ENCODING = 'UTF8'
  LC_COLLATE = 'en_US.utf8'
  LC_CTYPE = 'en_US.utf8'
  TEMPLATE = template0;

REVOKE ALL ON DATABASE kontax_prod FROM PUBLIC;
GRANT CONNECT ON DATABASE kontax_prod TO kontax_prod;

-- Connect to kontax_prod, then:
GRANT ALL ON SCHEMA public TO kontax_prod;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO kontax_prod;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO kontax_prod;
```

Schema is applied by `prisma db push` on first deploy (P34D-10).

## pg_hba.conf note

The PostgreSQL host at `10.0.0.200` must allow connections from the production app LXC. Verify the current `pg_hba.conf` includes a line permitting `kontax_prod@10.0.0.200:5432/kontax_prod` via `scram-sha-256`. If the app LXC IP changes, update `pg_hba.conf` and `systemctl reload postgresql`.

## Backup

> Backup configuration is in scope for P34D-10 (schema push). Until a backup schedule is configured, run manual `pg_dump` before any major schema change:
>
> ```bash
> pg_dump -h 10.0.0.200 -U kontax_prod -F c -f /tmp/kontax_prod_$(date +%Y%m%d).dump kontax_prod
> ```

## Restore from dump

```bash
# 1. Drop and recreate the target database (requires postgres superuser)
psql -h 10.0.0.200 -U postgres -c "DROP DATABASE IF EXISTS kontax_prod;"
psql -h 10.0.0.200 -U postgres -c "CREATE DATABASE kontax_prod OWNER kontax_prod;"

# 2. Restore
pg_restore -h 10.0.0.200 -U kontax_prod -d kontax_prod /path/to/dump.dump

# 3. Verify row counts
psql -h 10.0.0.200 -U kontax_prod -d kontax_prod \
  -c "SELECT relname, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;"
```

## Checking user privileges

```sql
-- As postgres superuser
SELECT rolname, rolsuper, rolcreatedb, rolcreaterole
FROM pg_roles
WHERE rolname IN ('kontax', 'kontax_prod');
```

Expected: both rows have `f` for all privilege columns.

## Emergency access

If the Coolify production app cannot connect to the DB:

1. Verify the DB host is reachable: `nc -z -w5 10.0.0.200 5432`
2. Verify pg is running: `systemctl status postgresql` (on 10.0.0.200)
3. Check `pg_hba.conf` allows the app LXC IP
4. Check `postgresql.conf` `listen_addresses` includes `*` or the DB host's LAN IP
5. Reload: `systemctl reload postgresql`

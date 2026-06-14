# P34D-10 — Production db push, Schema Verification, and Backup Setup

## Purpose

Apply the Prisma schema to the production database, verify all required indexes exist
(especially the GIN full-text search index), configure daily automated backups with
30-day retention, and document and test the restore procedure.

## Background

Kontax uses `prisma db push` (not migrations) to apply schema changes. Per the "DB &
verification workflow" memory note: never use `--accept-data-loss` without explicit
understanding of what data will be dropped. On production, this flag is forbidden.

The GIN full-text index on `Contact.searchVector` is critical for P33 search
performance. If this index is absent, every full-text query does a sequential scan,
which degrades at hundreds of contacts.

SES email delivery (P34D-11) and the app startup sequence both depend on the DB
being healthy before the first deploy.

## Scope

**In scope**
- Run `prisma db push` against production `kontax_prod`
- Verify schema completeness and critical indexes via SQL
- Set up daily `pg_dump` via cron with 30-day retention on a separate volume
- Run and verify a restore test to `kontax_restore_test`
- Document the restore procedure in `roadmap/runbooks/db-restore.md`

**Out of scope**
- Provisioning the database itself (P34D-09)
- Seed data (production starts with zero data — user accounts are created by registration)
- Continuous WAL archiving / point-in-time recovery (future phase)

## Design / Implementation Spec

### Step 1 — Run prisma db push

From the app LXC (where the source code is deployed), with `DATABASE_URL` pointing to
the production database:

```bash
cd /path/to/kontax-app
DATABASE_URL="postgresql://kontax_prod:<password>@<db-host>:5432/kontax_prod" \
  npx prisma db push --skip-generate
```

**Do NOT use `--accept-data-loss`.** If Prisma reports any destructive changes, stop,
read the diff, and understand what would be dropped. On a fresh production DB (no
existing tables), `db push` is always safe. If tables already exist from a previous
attempt, review carefully.

Expected output: `Your database is now in sync with your Prisma schema.`

### Step 2 — Verify schema completeness

Connect to the production DB and run verification queries:

```sql
-- All expected tables present
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Critical indexes on Contact table
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Contact'
ORDER BY indexname;
```

**Must-have indexes** (confirm each is present):
- `Contact_userId_idx` (or similar) — scopes contacts to a user
- `Contact_searchVector_idx` — GIN index enabling full-text search
- Any unique indexes on email/phone field tables

If the GIN index is missing, create it manually:
```sql
CREATE INDEX CONCURRENTLY "Contact_searchVector_idx"
ON "Contact" USING GIN ("searchVector");
```

### Step 3 — Backup volume

Create a dedicated backup directory on a separate volume (not the OS volume):
```bash
mkdir -p /mnt/backups/kontax
chown postgres:postgres /mnt/backups/kontax
chmod 750 /mnt/backups/kontax
```

If no separate volume is attached, use a Proxmox-mounted additional disk or an
external mount point. The backup directory must survive an LXC rebuild.

### Step 4 — Daily backup cron

Create `/etc/cron.d/kontax-db-backup`:
```
# Kontax production database daily backup
0 2 * * * postgres pg_dump kontax_prod | gzip > /mnt/backups/kontax/kontax_$(date +\%Y\%m\%d).sql.gz 2>> /var/log/kontax-backup.log
```

Verify the cron is active: `crontab -l -u postgres`

**30-day retention cleanup** — add alongside the backup cron:
```
15 2 * * * postgres find /mnt/backups/kontax -name "*.sql.gz" -mtime +30 -delete
```

### Step 5 — Test restore

Run a restore test immediately after the first backup:
```bash
# Create a test database
sudo -u postgres createdb kontax_restore_test

# Restore
sudo -u postgres bash -c "gunzip -c /mnt/backups/kontax/kontax_$(date +%Y%m%d).sql.gz | psql kontax_restore_test"

# Verify table counts match
sudo -u postgres psql -c "
  SELECT 'Contact' AS tbl, COUNT(*) FROM kontax_prod.public.\"Contact\"
  UNION ALL
  SELECT 'Contact', COUNT(*) FROM kontax_restore_test.public.\"Contact\";
" 2>/dev/null || echo "Run counts per DB separately if cross-db query fails"

# Drop test DB
sudo -u postgres dropdb kontax_restore_test
```

Document the actual restore time in `roadmap/runbooks/db-restore.md`.

### Step 6 — Document restore procedure

Create `roadmap/runbooks/db-restore.md` with:
- Backup location and naming convention
- Step-by-step restore commands for a full restore to a new DB
- Step-by-step restore for a point-in-time restore (once WAL archiving is added)
- RTO estimate (time to restore from backup)
- Who to contact and what to check first if the production DB is down

## Acceptance Criteria

- [ ] `prisma db push` completes without errors and without `--accept-data-loss`.
- [ ] All expected tables present in `pg_tables`.
- [ ] GIN index `Contact_searchVector_idx` confirmed via `pg_indexes` query.
- [ ] Cron job is active: `crontab -l -u postgres` shows both backup and cleanup lines.
- [ ] A restore test completes successfully and table counts match.
- [ ] `roadmap/runbooks/db-restore.md` exists and covers full restore steps.
- [ ] First backup file exists at `/mnt/backups/kontax/kontax_YYYYMMDD.sql.gz`.

## Risks / Open Questions

- **Coolify auto-push on deploy**: the "Email/SES deployment" memory note says
  "deploy runs `db push` on startup → schema drift crash-loops the site". This must
  be prevented on the production deployment. Either disable auto-push in the Coolify
  build command or ensure the production startup script only pushes if a new schema
  version is detected. Verify the Coolify build/start command before the first
  production deploy.
- **Backup of secrets**: the backup contains all user data (hashed passwords, contact
  records). The backup volume must have restricted access (`chmod 750`, owned by
  `postgres`). Consider encrypting backups with GPG for off-site copies.
- **Off-site backup**: cron + local volume is not sufficient for disaster recovery.
  Plan for an off-site copy (rclone to S3, Backblaze B2, etc.) in a follow-up
  ticket.
- The `CONCURRENTLY` option on `CREATE INDEX` requires that no transaction holds a
  lock on the table. On a fresh DB this is not an issue, but document it in case the
  index needs to be recreated on a live database later.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — no changes needed
- [x] Internal · ops — `roadmap/runbooks/db-restore.md`: create this file as part of
      Step 6 above
- [ ] Internal · engineering — docs/: no code changes in this ticket

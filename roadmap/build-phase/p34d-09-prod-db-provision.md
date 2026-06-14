# P34D-09 — Provision Production PostgreSQL Database

## Purpose

Create a completely isolated production PostgreSQL 16 database and dedicated
database user on the production server, configure network access from the application
LXC, and store the connection string securely in Coolify. Production and staging must
share no database resources.

## Background

Currently Kontax runs on Proxmox LXC 114. The staging database (`kontax`) lives on
that container. The production database must be on a separate LXC or a dedicated
PostgreSQL installation — never co-located with staging data. Environment isolation
is a hard requirement: a staging test that clears contacts must not affect production
users.

SES is already live. The `prisma db push` step and schema verification are in
P34D-10 (depends on this ticket).

## Scope

**In scope**
- Install PostgreSQL 16 (if not already present on the production server)
- Create `kontax_prod` database
- Create `kontax_prod` user with a strong random password
- Grant least-privilege permissions (only SELECT, INSERT, UPDATE, DELETE, CREATE on
  the `kontax_prod` database — not SUPERUSER, not CREATEDB)
- Configure `pg_hba.conf` to allow connections from the application LXC IP
- Configure `postgresql.conf` with minimum production settings
- Store the connection string in Coolify environment (as `DATABASE_URL`)
- Smoke-test the connection from the app LXC

**Out of scope**
- Schema creation (P34D-10)
- Backup configuration (P34D-10)
- PgBouncer or connection pooling (future phase if needed at scale)

## Design / Implementation Spec

### Step 1 — Identify or provision the database host

Decide: does the production database live in LXC 114 (alongside the app) or in a
dedicated database LXC? Recommendation: a dedicated DB LXC for isolation. If using
LXC 114, ensure the staging database is in a separate PostgreSQL cluster or at
minimum a separate PostgreSQL user with no cross-database access.

Note the production DB LXC IP address — it will be needed for pg_hba.conf and the
connection string.

### Step 2 — Install PostgreSQL 16

```bash
# Debian/Ubuntu-based LXC
apt-get update
apt-get install -y postgresql-16 postgresql-client-16

systemctl enable postgresql
systemctl start postgresql
```

Verify: `psql --version` → should show 16.x.

### Step 3 — Create database and user

```bash
sudo -u postgres psql <<'SQL'
CREATE USER kontax_prod WITH PASSWORD '<strong-random-password>';
CREATE DATABASE kontax_prod OWNER kontax_prod;
REVOKE ALL ON DATABASE kontax_prod FROM PUBLIC;
GRANT CONNECT ON DATABASE kontax_prod TO kontax_prod;
-- After connecting to kontax_prod:
\c kontax_prod
GRANT ALL ON SCHEMA public TO kontax_prod;
SQL
```

Generate the password with: `openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 40`

**Never commit this password to git or store it in a file outside the secrets manager.**

### Step 4 — Configure postgresql.conf

Edit `/etc/postgresql/16/main/postgresql.conf`:
```
max_connections = 100
shared_buffers = 256MB
effective_cache_size = 768MB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
```

These are conservative settings appropriate for a small VPS. Tune upward if load
requires it.

### Step 5 — Configure pg_hba.conf

Edit `/etc/postgresql/16/main/pg_hba.conf`. Add a line permitting the app LXC to
connect using md5 (or scram-sha-256) authentication:
```
# TYPE  DATABASE       USER          ADDRESS                 METHOD
host    kontax_prod    kontax_prod   <app-lxc-ip>/32         scram-sha-256
```

Reload PostgreSQL: `systemctl reload postgresql`

### Step 6 — Store in Coolify

Set `DATABASE_URL` in the Coolify production app environment:
```
postgresql://kontax_prod:<password>@<db-lxc-ip>:5432/kontax_prod
```
Do not set this in P34D-11 (that ticket covers the full env var audit) — set it now
as it is required for P34D-10 to proceed.

### Step 7 — Verify connection from app LXC

SSH into the app LXC and run:
```bash
psql postgresql://kontax_prod:<password>@<db-lxc-ip>:5432/kontax_prod -c "\l"
```
Expected: lists `kontax_prod` database. No connection refused or authentication errors.

## Acceptance Criteria

- [ ] PostgreSQL 16 is running on the production server.
- [ ] `kontax_prod` database exists and is owned by `kontax_prod` user.
- [ ] `kontax_prod` user has no superuser or CREATEDB privileges.
- [ ] Connection from the app LXC is verified with a `psql` or `pg_isready` check.
- [ ] `DATABASE_URL` is set in Coolify production environment.
- [ ] Staging database is untouched and still functional on kontax.vexon.co.
- [ ] The production password is not stored in any git-tracked file.

## Risks / Open Questions

- **IP stability**: if the app LXC IP changes (e.g. after a Proxmox migration),
  pg_hba.conf must be updated. Consider using a Proxmox internal VLAN or static IPs
  for both LXCs.
- **PostgreSQL version parity**: staging and production should run the same PostgreSQL
  major version to avoid schema differences. Verify staging version before proceeding.
- **Firewall**: ensure Proxmox firewall rules allow traffic on port 5432 between the
  two LXCs but block port 5432 from the public internet.
- **Secrets management**: Coolify stores env vars encrypted. Confirm the Coolify
  instance itself is not accessible from the public internet without auth.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — no changes needed
- [x] Internal · ops — `roadmap/runbooks/db-restore.md`: note the production DB host,
      port, and user (password separately in secrets manager)
- [ ] Internal · engineering — docs/: no code changes

# Kontax

Kontax is a contact system for personal, family, and team contact management
with built-in sync, sharing, admin operations, billing, and self-hosted
CardDAV.

This repo is no longer a starter scaffold. It contains the production app, the
sync engine, the admin/support tooling, and the runbooks we use to operate it.

## What lives here

- Next.js app router product surface under `src/app`
- Prisma data model under `prisma/schema.prisma`
- sync engine and provider integrations under `src/server`
- CardDAV server in `server.mjs`
- operator and engineering runbooks under `roadmap/runbooks`
- repo-owned regression tests under `tests`

## Local development

### Prerequisites

- Node 22+
- npm 11+
- a Postgres database

### Start the app

```bash
npm ci
npm run db:push
npm run dev
```

Common local URLs:

- app: `http://localhost:3000`
- email preview: `http://localhost:3001` via `npm run email:preview`

## Common commands

```bash
# app
npm run dev
npm run build
npm run preview

# quality
npm run lint
npm run typecheck
npm run test:repo
npm run test:sync-fixtures
npm run test:e2e

# schema
npm run db:push
npm run db:migrate
npm run db:check:drift

# demo / QA data
npm run seed:demo
npm run seed:demo:multilingual
```

## Architecture map

### Product surfaces

- `src/app/contacts`
  - contact list, detail, create/edit, merge, export, print
- `src/app/sync`
  - user-facing sync connections, reconnect flows, settings, conflict handling
- `src/app/settings`
  - account, security, plan, billing, notifications, developer settings
- `src/app/admin`
  - support/admin views for users, sync ops, audit, and internal notes

### Server domains

- `src/server/carddav.ts`
  - CardDAV discovery and transport helpers
- `src/server/sync-runner.ts`
  - sync job execution and provider projection logic
- `src/server/sync-provider-capabilities.ts`
  - provider field-support rules such as generic-safe vs verified providers
- `src/server/sync-provider-identity.ts`
  - provider identity registry and generic CardDAV detection model
- `src/server/contact-portability.ts`
  - CSV/vCard portability and structured contact fixture logic

### Data model

Key models:

- `Contact`
- `SyncAccount`
- `SyncAccountSettings`
- `SyncContactLink`
- `SyncJob`
- `SyncConflict`

The sync system uses:

- `connectionId` for stable logical connection identity
- lineage links (`replacesSyncAccountId`, `replacedBySyncAccountId`) for
  reconnect/retire workflows
- supported-field shadows on `SyncContactLink` to avoid destructive data loss
  when providers cannot roundtrip every field

## Sync and provider model

Kontax currently supports:

- Google Contacts
- Microsoft / Outlook
- CardDAV
  - verified iCloud profile
  - verified Fastmail profile
  - generic-safe CardDAV fallback
  - detected-but-unverified generic providers via host registry

Important rule: provider identity and provider capability are related, but they
are not the same thing.

- provider identity answers: "what service does this connection look like?"
- provider capability answers: "what fields can we safely roundtrip here?"

Unknown CardDAV providers should stay honest:

- user label remains primary
- host-derived provider identity is shown conservatively
- unsupported fields stay in Kontax rather than being mistaken for deletions

## Testing

The repo now owns a fast regression lane.

```bash
npm run test:repo
```

That lane currently protects:

- phone input / country-code edit semantics
- provider capability behavior for iCloud, Fastmail, and generic-safe CardDAV
- provider identity detection and generic naming rules

See:

- [Testing & Critical Paths](/Users/lnoormohamed/ChatGPT/Kontax/roadmap/runbooks/testing-and-critical-paths.md)

## Deployment and schema model

Development and staging can still use `db push` conveniently.

Production should not rely on startup-time schema mutation by default. The
container now boots through `scripts/start-production.mjs`:

- `KONTAX_SCHEMA_MODE=push`
  - apply `prisma db push` before boot
- `KONTAX_SCHEMA_MODE=validate`
  - refuse to boot if the live database does not match `prisma/schema.prisma`
- `KONTAX_SCHEMA_MODE=skip`
  - boot without a schema step

If `KONTAX_SCHEMA_MODE` is unset, the startup script defaults to:

- `validate` when `KONTAX_DEPLOY_ENV=production`
- `validate` when `KONTAX_DEPLOY_ENV` is unset but `NODE_ENV=production`
- `push` otherwise

Runbooks:

- [Deploy & schema](/Users/lnoormohamed/ChatGPT/Kontax/roadmap/runbooks/deploy.md)
- [Testing & Critical Paths](/Users/lnoormohamed/ChatGPT/Kontax/roadmap/runbooks/testing-and-critical-paths.md)

## Operator notes

- Sync and billing changes can affect production behavior even when the UI diff
  looks small.
- For risky provider work, land fixture coverage before relying on manual
  staging checks alone.
- Avoid adding DB-level uniqueness to hot production tables unless the rollout
  plan is explicit and verified.

## First places to look when something breaks

- sync issue or provider mismatch:
  - `src/server/sync-runner.ts`
  - `src/server/sync-provider-capabilities.ts`
  - `src/server/sync-provider-identity.ts`
- CardDAV transport issue:
  - `src/server/carddav.ts`
  - `server.mjs`
- contact import/export issue:
  - `src/server/contact-portability.ts`
- deploy/schema issue:
  - `scripts/start-production.mjs`
  - `scripts/check-schema-drift.mjs`
  - [deploy runbook](/Users/lnoormohamed/ChatGPT/Kontax/roadmap/runbooks/deploy.md)

# P49A-18 — Hardening & debt backlog

**Phase:** 49A · **Priority:** P2 · **Depends on:** P49A-02, P49A-10 · **Effort:** L (pick items)
**Audit IDs:** P2 list in the audit report

## Objective
Reduce the surface that produced this audit's bugs: duplicated vCard code, untyped server code,
untested critical paths and stale docs.

## Production verification (2026-09-25)
Code-level items; confirmed present in origin/main. None is user-visible on prod today.

## Items
**Tests (highest leverage)** — sync runner, Google/Outlook mapping, merge execution, vCard
round-trip, Stripe handlers, DAV handlers; run the DB-gated authz suites locally via a
docker-compose Postgres.

**Code**
- Move `server.mjs` DAV logic into typed modules (`src/server/dav/*`), sharing vCard code with
  `contact-portability.ts`; delete the unused `dav/ctag.ts`/`dav/conflicts.ts` copies.
- Route all env reads through `~/env` (146 raw `process.env` reads; validate
  `KONTAX_ALLOW_INSECURE_OUTBOUND`, `ADMIN_CAPABILITY_OVERRIDES`, …).
- Remove dead settings/flags: `importLabelId`, `projectionBookIds`, `fieldPrecedence` (or
  implement), `weekStartsOn`, `requireReauthToEdit`, `isFeatureEnabled`, unused
  `SharedBookPermissionAuditEvent` model, dead `upgrade-gate.tsx` + stale "CardDAV is Pro" gate.
- Drop legacy multi-value columns after P49A-10 settles.
- Remove `src/app/wireframes` from production builds; consolidate the six `S3Client`s.
- Search: raise/lift the 1,000-match cap, add an `id` tiebreaker (also v1 list).
- Import mapping: Google `:::` multi-values, nickname/phonetic columns, split address columns,
  strip CSV `'` phone prefix on re-import, idempotent commit.
- Reminders: year-boundary dedupe, don't mark sent on failure; iCal Feb-29, DTSTAMP, folding,
  stable UIDs; API counter reset robust to a missed 1st-of-month run.

**Tooling / deps** — add `.claude/**` to ESLint ignores (fixes local `eslint .` OOM); generic
`.next-*/types/**/*.ts` tsconfig include; upgrade off deprecated `@react-email/*`, plan
`next-auth` GA and zod v4; load Geist via `next/font`; shared design tokens for the app.

**Docs** — fix runbook drift: `sync-ops.md` (forced resync field), `db-restore.md` (search index,
encryption status), `gdpr-erasure.md` (deletion filter).

**Performance** — make the homepage static with a client-side "welcome back"; trim
`pinyin-pro`/`transliteration` from the create-contact bundle; find the 325 kB crypto-polyfill
chunk.

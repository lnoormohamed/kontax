# P47-06 — Production schema apply & drift-free boot

**Phase:** 47 · **Workstream:** A · **Priority:** P0 · **Depends on:** P47-01

## Objective

Bring the production database schema up to `prisma/schema.prisma` (all P38–P46
additions) **intentionally and additively**, so the app boots clean in
production's `validate` mode without a crash-loop.

## Context — why this is the highest-risk step

Prod boots via `scripts/start-production.mjs`. With `KONTAX_DEPLOY_ENV=production`
it runs in **`validate`** mode: it compares the live DB to the schema and
**refuses to boot on any drift**. The prod DB is P34D-era and is missing every
schema change since — `ContactBookMembership`, `ContactPrivateField`,
`sharingPolicy` / `minimumSharingPolicy` / `destinationBookId`, `KontaxExportJob`,
photo-storage columns, notification-aging columns (`eventAt` / `expiresAt` /
`contactShareId`), etc.

The exact failure this prevents was seen on staging: **Incident 2026-07-04
(P40)** — staging crash-looped on additive drift because schema was applied by
boot, not before it. In prod we apply **before** the app swap, on purpose.

> **Never** run `prisma db push --accept-data-loss` in production — it silently
> drops columns/tables. The prod DB is empty pre-launch, but the habit is what
> matters.

## Steps

1. **Backup first** — take a DB snapshot (P47-12 sets up the routine; take a
   manual one here regardless) so a bad apply is recoverable.
2. **Compute the diff** — point a controlled release task's `DATABASE_URL` at
   prod and verify the change is additive-only:
   ```
   npx prisma migrate diff \
     --from-url "$DATABASE_URL" \
     --to-schema-datamodel prisma/schema.prisma --exit-code
   ```
   Read the output — confirm it is `[+] Added`-only. If anything is a drop or a
   new **required** column on a populated table, stop and rework.
3. **Data migrations first** — the prod DB is empty pre-launch, so most backfills
   are no-ops, but confirm the migration/backfill scripts that gate later
   behaviour are either N/A on an empty DB or run in order (e.g.
   `backfill-contact-book-memberships.mjs`, `migrate-default-address-books.mjs`,
   `backfill-avatar-thumbs.mjs`, sync-account lineage/settings). Record which are
   skipped-because-empty vs run.
4. **Apply schema** — `npm run db:push` in the controlled task (additive-safe).
   Then seed the static lookup data the schema expects:
   `npm run seed:sort-romanization` (CharRomanization table, ~35k rows;
   idempotent — without it non-Latin names (CJK, Arabic, Cyrillic, …) fall back
   to the `#` bucket in the contact list instead of their romanized letter).
5. **Confirm drift-free** — `node scripts/check-schema-drift.mjs` against prod →
   **exit 0**.
6. **Boot** — deploy/restart the app; watch for `Validating live schema before
   boot.` → `Starting Kontax.` → ready, with no validation error.

## Acceptance

- `check-schema-drift.mjs` against prod exits 0.
- App boots in `validate` mode with no schema error in the Coolify log.
- The additive-only diff output and the backfill run/skip decisions are recorded
  on the P47-01 checklist.
- A pre-apply DB snapshot exists.

## References

- deploy.md §Production deploys · §Schema validation boot failure (P40 incident)
- `scripts/start-production.mjs`, `scripts/check-schema-drift.mjs`
- `scripts/backfill-*.mjs`, `scripts/migrate-*.mjs`
</content>

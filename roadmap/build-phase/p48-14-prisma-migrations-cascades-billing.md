# P48-14 — Prisma migrations baseline, unique constraints, cascade and billing-on-delete fixes

**Phase:** 48 · **Workstream:** G · **Priority:** P1 · **Depends on:** —
**Audit severity:** High + Medium (×3) + Low

## Objective

Move production schema changes onto `prisma migrate deploy` so constraints
can be added safely, then fix the delete-cascade and billing gaps the schema
review found.

## Context

- **No migration history (High).** `prisma/migrations/` does not exist.
  README and `scripts/start-production.mjs` describe `db push` (non-prod) +
  `validate` (prod). Comments at `prisma/schema.prisma:349-353`
  (`User.calToken`) and `:810-818` (`SyncAccount.connectionId`,
  `replacesSyncAccountId`, `replacedBySyncAccountId`) say `@unique` was
  deliberately omitted because adding an index via push would crash-loop the
  deploy. So a bearer token for the calendar feed and the sync lineage
  identity are unique only in app code.
- **Audit trail is not append-only (Medium).** `AdminAuditEvent.admin …
  onDelete: Cascade` (`:1217`), `AdminSupportNote.author` (`:1233`), and the
  `AdminBroadcast` / `AdminSupportCase` actor relations: deleting an admin's
  User row erases every event they authored, contradicting the comment at
  `:1201-1205`.
- **Billing cascades with no Stripe call (Medium).** `SubscriptionCustomer.user`
  (`:604`) and `Subscription.user` (`:648`) cascade; `cron/delete-accounts/route.ts:30`
  and `actions/account.ts:255-300` make no Stripe call. The Stripe customer
  keeps billing while the local record is gone.
- **FK columns without leading indexes (Medium).** `MergeSuggestion.leftContactId/rightContactId`
  (`:742`), `MergeDismissal.contactAId/contactBId` (`:788`),
  `ContactShare.contactId/recipientContactId` (`:1552`),
  `BirthdayReminderState.contactId` (`:1736`), `Contact.importJobId`,
  `Contact.mergedIntoContactId`, `ContactPrivateField.userId`,
  `SyncAccount.destinationBookId`, `SyncAccountSettings.importLabelId`,
  `Notification.securityAlertId`, admin actor columns. Every parent delete
  is a sequential scan.
- **Low:** plaintext capability tokens `GroupMember.inviteToken` (`:1382`),
  `ContactShare.token` (`:1557`), `User.calToken` (`:351`); redundant
  `@@index` duplicating `@unique` at `:1124,1139,1159,1598,1835`; no
  `@db.VarChar` limits on user text except `PublicCardView.referrer`; 37
  unbounded `Json` columns; `DATABASE_URL` passed as a CLI arg to `prisma
  migrate diff` (`start-production.mjs:66-79`, `check-schema-drift.mjs:11-19`)
  so the password is visible in `ps`.

## Steps

1. **Baseline.** `prisma migrate diff --from-empty --to-schema-datasource
   … --script > prisma/migrations/0_init/migration.sql`; `prisma migrate
   resolve --applied 0_init` on staging and prod. Switch
   `start-production.mjs` `validate` mode to `prisma migrate status` +
   `migrate deploy` (keep the drift assessment as a post-check). Update
   `README.md`, `runbooks/deploy.md`, `.github` job.
2. **Constraints migration.** Add `@unique` to `User.calToken`,
   `SyncAccount.connectionId` (per-user or global as the lineage model
   requires), and the lineage links; first run a pre-check query for
   duplicates on prod and reconcile (there is a `backfill:sync-lineage`
   script).
3. **Indexes migration.** Add `@@index` for every FK column listed; drop
   the five redundant indexes.
4. **Cascades.** Change admin actor relations to `onDelete: SetNull`
   (nullable actor id + denormalised `actorEmail`), or `Restrict` with a
   documented "admins are never hard-deleted" rule.
5. **Billing on delete.** In the hard-delete cron (and in
   `scheduleAccountDeletion` for immediacy), cancel the Stripe subscription
   (`cancel_at_period_end: false`) and delete or detach the Stripe customer
   before `db.user.delete`; keep `StripeWebhookEvent` (already standalone).
   For Teams, respect org-anchored billing (P34F): only the owner's deletion
   touches the subscription, and only after ownership transfer is refused.
6. **Tokens at rest.** Hash `inviteToken`, `ContactShare.token` and
   `calToken` (SHA-256, lookup by hash) with a dual-read migration window.
7. **Hygiene.** Pass `DATABASE_URL` via env / `--from-schema-datasource`
   rather than argv. Add `@db.VarChar` caps on the main user-text columns
   in a follow-up migration once zod caps are aligned (P48-17).

## Acceptance

- `prisma migrate status` on prod reports no pending migrations; a
  schema change lands through a migration file reviewed in a PR.
- `calToken` / `connectionId` uniqueness is enforced by Postgres (insert of a
  duplicate fails).
- Deleting an admin user keeps their audit events with `actorEmail`
  populated.
- Hard-deleting a subscribed user cancels the Stripe subscription (verified
  in Stripe test mode) before the row is removed.
- `EXPLAIN` on `DELETE FROM "Contact" WHERE id = …` shows index scans on all
  child tables.
- `ps` during boot no longer shows the DB password.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (deploy.md: migrate deploy flow; rollback)
- [x] Internal · engineering — docs/ (schema change policy)

## References

- Audit report §High "No Prisma migration history"; §Medium cascade/billing; §Low schema items
- `prisma/schema.prisma`, `scripts/start-production.mjs`, `scripts/check-schema-drift.mjs`, `src/app/api/cron/delete-accounts/route.ts`, `src/app/actions/account.ts`
- P47-06 (schema apply), P34F (org-anchored billing)

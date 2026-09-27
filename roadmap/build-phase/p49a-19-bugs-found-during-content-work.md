# P49A-19 — Bugs found while writing the help centre and guides

**Phase:** 49A · **Priority:** P1 (item 1 is P0) · **Effort:** M · **Found:** 2026-09-25, P50A-05/-06

Found by the help-centre and guides agents while checking every article against the code. Each
needs confirming in code before the fix.

| # | Bug | Where to look | Impact |
|---|---|---|---|
| 1 | **Regenerating 2FA recovery codes discards the new codes** (the user is shown codes that were never saved, or the new set is thrown away) | `src/app/actions/totp.ts` `regenerateRecoveryCodes` + the settings 2FA UI | Users think they have backup codes and are locked out if they lose their phone (P0) |
| 2 | Sync conflict **"Manual merge" ignores the fields the user picks** | sync conflict resolution in `src/app/actions/sync.ts` + the conflict review UI | **Fixed** 2026-09-27 with P49A-12 (branch `p49a-12`) — the picks are sent with MANUAL_MERGE keyed by field (`fieldPicks`, `src/lib/sync-conflict-picks.ts`), validated (zod, unknown keys / values rejected) and the merged contact is built from exactly the chosen side per field, multi-value families through the P49A-10 entries (`buildPickedMergeWriteData`, `src/server/sync-conflict-merge.ts`); the union helper is gone. Unpicked field = "Kontax" (the UI's preselection); a resolution with no picks (page loaded before the deploy) therefore saves what the user was shown, not the old union. Rows now also cover nickname, addresses, department and dates. Tests: `tests/node/sync-conflict-manual-merge.test.ts`. Still open (pre-existing): keep local / manual merge push through the CardDAV client, so they fail for Google / Outlook conflicts |
| 3 | Data-export ready email links to the wrong settings page | `src/app/api/cron/data-export/route.ts` | **Fixed** 2026-09-27 — links to `/settings/data/export` via `DATA_EXPORT_SETTINGS_PATH` (also used for revalidation); test `tests/node/data-export-email-link.test.ts` |
| 4 | Failed-payment grace (3 days) is not enforced — display only | `billing-surface.ts`, `stripe-handlers.ts` (P49A-05 notes: by policy, Stripe decides the lapse) | **Fixed** 2026-09-27 — owner decision: enforce. Paid plan for 3 days from the first failure, then Free entitlements until paid (web + CardDAV), Stripe untouched, nothing deleted. See below. |
| 5 | Free users can get a vCard file via the Kontax Archive ".vcf copy" option and the full data export, although vCard export is Pro | `src/server/export-format/*`, data export | **Fixed** 2026-09-27 — owner decision: not a leak. The full data export keeps `contacts.vcf` on every plan (data portability); the archive's .vcf compatibility copy stays on every plan too. Pro = the standalone vCard 4.0 export on Import & export. Copy aligned — see below. |
| 6 | Auto-pause after repeated sync failures defaults to 5, while copy says 3 | `src/server/sync-health.ts` | **Fixed** 2026-09-27 — owner decision: 3 consecutive failures on Free, 5 on paid plans, from the plan matrix; runner, settings panel, help and the support export share it. See below. |
| 7 | `DOWNGRADE_COPY` in `plan-data.ts` is never shown and is wrong in places; users see `cancel-plan-modal.tsx` | `src/app/_components/plan-data.ts`, `cancel-plan-modal.tsx` | Dead, misleading code — delete or wire up correctly |
| 8 | iPhone edits through Kontax's CardDAV server are not marked as local edits, so they may not push to the source provider (e.g. Google) | `server.mjs` PUT `lastMutatedBy` | **Fixed** 2026-09-27 in P49A-12 (A-17) — confirmed: PUT never set `lastMutatedBy`. Every device PUT / DELETE now stamps `MANUAL` ("CardDAV device") and marks the contact's sync links dirty (`flagDeviceWriteForSync`) |
| 9 | Free `monthlyImportLimit: 3` counts **contacts**, so any Free CSV import over 3 rows is refused | `src/server/billing.ts` `assertCanImportContacts` | **Fixed** — owner decision 2026-09-26: 3 import runs a month (CSV + Kontax archive), not 3 contacts. See below. |

Fixed already (not part of this ticket): the sign-up card's "no card required" trial copy and the
help FAQ's vCard-import claim (08b6fac, release branch).

## Item 9 — fixed (2026-09-26)

`monthlyImportLimit` now counts import **runs** (`importsThisMonthWhere` in `src/server/billing.ts`):
an ImportJob counts once it has created at least one contact (`importedCount > 0`), in the UTC month
of its `committedAt` (legacy rows without one fall back to `createdAt`). So previews, failed runs and
empty runs never count; a run cut short by the 500 contact cap counts as one; a rolled-back run still
counts. An import is allowed while `importsThisMonth < monthlyImportLimit` (null = unlimited); the
contact cap still applies separately and still creates only what fits (P49A-06).

Every import path records `importedCount` + `committedAt` on its job inside the inserting
transaction, after `lockUserForPlanCheck`, so concurrent imports at 2/3 let exactly one through
(CSV commit route, Kontax archive import — first landing chunk — and the legacy in-app action).
The CSV commit route claims a preview job atomically (only PENDING, or FAILED with nothing
imported); a retry or double-submit of a job that already ran gets 409 instead of importing twice.
Tests: `tests/node/monthly-import-limit.test.ts`.

## Item 4 — fixed (2026-09-27, owner decision: enforce the 3-day grace)

- **Rule** (`src/server/dav/plan-entitlements.mjs`, shared by `billing.ts` and `server.mjs`):
  `subscriptionGrantsPlan` — ACTIVE / TRIALING grant; PAST_DUE (Stripe `past_due` and `unpaid`)
  grants until `Subscription.graceEndsAt`; after that the row grants nothing, so
  `loadEffectivePlan` resolves to Free (or a higher comp / Teams membership). Enforced at read
  time — the grace running out is not a Stripe event. `PAYMENT_GRACE_DAYS = 3` is the single
  constant (help FACTS read it). No schema change: the existing `graceEndsAt` column is the
  episode marker.
- **Grace start from Stripe data** (`stripe-handlers.ts` `paymentFailureStartedAt` /
  `ensureGraceDeadline`): the failing invoice's `status_transitions.finalized_at` (the first
  charge attempt) + 3 days, from the subscription's `latest_invoice` (every retrieve now expands
  it) or the invoice event's own invoice when it is that latest invoice. Arrival time is only the
  fallback. The stamp only moves earlier while PAST_DUE, so duplicate / retried / out-of-order
  events never restart or extend the grace; leaving PAST_DUE clears it (next failure = new
  episode). Recovery (`invoice.payment_succeeded` → status active) restores the plan at once.
- **Structural steps unchanged:** downgrade clean-up (sync accounts paused, live shares made
  static), the Family 7-day dissolve notice and the Teams 14-day read-only window still start
  only when Stripe cancels / pauses — they are not reversible and a paid invoice must restore
  everything. So during the unpaid period: Family members keep the shared book (membership
  based) and the owner can't invite (plan is Free); a Teams org past its grace stops granting
  Teams to members (they fall back to their own plan) but the team is not locked. Known gap
  (follow-up): the sync-account limit is enforced on creation, so connections beyond Free's keep
  running during the unpaid window until Stripe's final cancel. Live shares a lapsed user
  *receives* are paused, not converted (see the review fixes below).
- **Admin comp (P49A-07):** a comp row is ACTIVE, so it still grants; max-rank keeps the higher.
- **UI:** Settings → Plan & billing: grace card "Payment failed — update your payment method by
  <date> to keep <Plan>…", new `paymentLapsed` card "…your account moved to the Free plan on
  <date>… <Plan> comes back as soon as the payment goes through" with "Update payment method"
  (never "Upgrade", which would start a second subscription); new `ownerLapsed` banner. A dunning
  retry that fails after the grace sends only an in-app notice (the "update within N days" email
  would show a past date). Help: "If a payment fails" rewritten.
- Tests: `tests/node/payment-grace.test.ts` (rule, web + DAV path, contact cap, comp, Teams),
  `stripe-webhook.test.ts` "failed-payment grace (P49A-19)", `billing-surface-grant.test.ts`.

### Item 4 — Fable review fixes (2026-09-27)

1. **Live shares received by a lapsed user are paused, not revoked** (`contact-shares.ts`
   `classifyLiveShareRecipient`): past-grace PAST_DUE → `lastErrorCode RECIPIENT_PAYMENT_LAPSED`
   (owner sees "Sync paused — recipient account issue"); the next propagation after payment
   syncs again. Only a recipient with no paid plan is converted to a static copy.
   Test: `live-share-payment-lapse.test.ts`.
2. **No second subscription:** `findCheckoutBlockingSubscription`
   (`src/server/billing-checkout-guard.ts`) refuses a new checkout (`USE_CUSTOMER_PORTAL`) when
   a real Stripe subscription is ACTIVE / TRIALING / **PAST_DUE** (personal, or the owned team's).
   `/api/billing/plan` returns `paymentLapse`, and /pricing then labels paid CTAs "Update payment
   method" and opens the portal. Test: `checkout-guard-past-due.test.ts`.
3. **Self-heal for a lost recovery webhook:** the nightly `POST /api/cron/delete-accounts`
   (existing crontab entry — **nothing new to schedule**) also runs
   `resyncLapsedPaymentSubscriptions` (`src/server/billing-lapse-resync.ts`): every real Stripe
   subscription PAST_DUE past `graceEndsAt` (personal or org) is re-read via
   `syncStripeSubscriptionById` and applied; 100 per night, least recently updated first, 250 ms
   apart, per-subscription errors reported in the response (`paymentLapseResync`), never thrown.
   The billing-portal return still resyncs at once. Test: `payment-lapse-resync.test.ts`.
4. **Pre-deploy check** for PAST_DUE rows without `graceEndsAt` (fail-open legacy rows) in
   `roadmap/runbooks/deploy.md` "P49A-19 deploy" (count, then stamp now() + 3 days).
5. **Admin / team views:** admin user list + detail show "Pro — payment lapsed, on Free since
   <date>" (`adminPlanLabel`); the Teams settings billing line shows "payment failed — Teams
   features off since <date> until it's paid" (`getTeamBillingSummary.paymentLapsedSince`). The
   data export's `account.json` is left as the subscription record (plan + PAST_DUE status in
   `billing-summary.txt`). Test: `admin-payment-lapse-label.test.ts`.
6. **No past "update by" date:** with a comp at the same rank, the billing card uses rows that
   still grant (comp view + "Manage my Pro subscription" portal) and shows no grace card/banner.
7. **UK dates:** billing card/banner and billing emails format dates in Europe/London.

## Item 5 — fixed (2026-09-27, owner decision: vCard in the data export for everyone)

- Behaviour unchanged, now intended and tested: Settings → Data & sync → Download your data
  (`generateDataExport`) always writes `contacts.vcf` (+ CSV, activity, billing summary, account)
  with no plan check; the Kontax Archive's **Add a compatibility copy (.vcf)** (vCard 3.0 at
  `vcards/contacts.vcf`) stays available on every plan — it is a fallback inside a full-fidelity
  archive, consistent with the portability decision. The Pro feature (`premiumExportEnabled`,
  `assertCanUsePremiumExport` on `/api/exports/contacts/vcard`) is the standalone **vCard 4.0
  export** of the whole library from the Import & export page.
- Copy no longer implies Free can never get a vCard file: pricing matrix (row renamed "vCard 4.0
  export (whole library)" + new "Full data download (includes a vCard file)" on every plan; Pro
  card "vCard 4.0 export"; upgrade-gate text), home pricing teaser, /security, /compare/kontax-vs-
  google-contacts, /compare/kontax-vs-icloud-contacts, help (getting-started plan table,
  export-your-contacts, Kontax format, the "Is vCard export available on Free?" answer, Free vs
  Pro, downgrade consequences) and the in-app PRO popover on the export card.
- Test: `tests/node/data-export-vcard-all-plans.test.ts` (a Free user's export zip contains
  `contacts.vcf`; no plan gate on the export path).

## Item 6 — fixed (2026-09-27, owner decision: auto-pause 3 on Free / 5 on paid)

- **One source:** `PLAN_DEFAULTS[plan].syncAutoPauseAfterFailures` (Free 3, Pro / Family / Teams
  5) and `syncAutoPauseMaxFailures` (Free 3, paid null) in `plan-entitlements.mjs`;
  `resolveSyncAutoPauseThreshold(entitlements, setting)` combines them with the connection's
  setting. `sync-health.ts` exports `FREE_/PAID_AUTO_PAUSE_FAILURES`,
  `getSyncAutoPauseThreshold(client, syncAccountId, setting)` (owner's effective plan via
  `loadEffectivePlan`, so admin comp = paid and the item 4 payment grace applies) and
  `shouldAutoPauseAfterFailure`. `DEFAULT_MAX_ATTEMPTS_BEFORE_PAUSE = 5` is gone.
- **Runner** (`sync-runner.ts` `markJobFailed`): threshold from the above; a failed plan lookup
  logs and uses Free's 3 for that failure rather than leaving the job RUNNING.
- **Per-connection setting (decision):** "Retry sensitivity" is respected within the plan's
  ceiling — Free may pause sooner (1) but a stored 5 / 10 / never acts as 3 (value kept, applies
  again after an upgrade); paid plans keep any choice (1, 3, 5, 10, never) as before.
- **Copy:** settings panel "Plan default (N failures)", Free options above 3 disabled and marked
  "paid plans", hint explains the ceiling; help (sync troubleshooting, paused states, settings
  list) via `FACTS.autoPauseRule` = "3 on Free, 5 on paid plans". Notifications / email already
  quote the real count. The support recovery export's `autoPauseFailureStreak` now reports the
  account's real threshold (it was the 3-failure display heuristic, `AUTO_PAUSE_FAILURE_STREAK`,
  which stays only for classifying legacy pauses).
- Test: `tests/node/sync-auto-pause-per-plan.test.ts`.

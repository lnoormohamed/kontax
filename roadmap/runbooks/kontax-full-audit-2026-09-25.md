# Kontax full audit — 2026-09-25

Scope: security, bugs/correctness, performance/ops/tech debt, UX/UI, features vs claims.
Audited at `docs/p49-homepage-brief` HEAD d5847dd (= staging). Read-only; no prod access.
Auditors: Fable (security, 3 passes), Opus (bugs; performance/ops), Sonnet (UX/UI; features),
plus a live browser pass of the public site. Top items were re-checked in code by hand.

Health baseline: `tsc` clean, `next build` OK, `npm run test:repo` 194 pass / 14 skipped
(DB-gated authz suites, run in CI) / 0 fail. No tests exist for the sync runner, Google/Outlook
sync, merge execution, vCard round-trip, Stripe handlers or the DAV server — which is where most
of the bugs below live.

**Production verification (2026-09-25, read-only):** prod runs `main` @ b71a35f, identical to
the audited code apart from two P49 files that don't affect these findings. All 15 P0s were
re-confirmed in `origin/main`; A-01, A-02, A-13 and A-23 were reproduced by running prod's own
code on sample input; A-08 was confirmed on the live container's process tree; A-15 on the prod
DB host; A-35–A-37 on getkontax.com. Prod data is 3 users / 0 contacts / 0 sync accounts /
0 subscriptions, so **no finding has affected real data yet**. Microsoft/Outlook is not
configured in prod (Outlook paths latent). Tickets: Phase 49A
(`roadmap/build-phase/phase-49a-audit-remediation.md`).

Severity: **P0** = data loss, money, or a live security hole — fix first. **P1** = real defect or
false public claim. **P2** = hardening, polish, debt.

---

## P0 — fix first

| ID | Area | Finding | Where | Effort |
| --- | --- | --- | --- | --- |
| A-01 | Sync | **Google push wipes addresses and websites.** The update mask names `addresses,urls` but the mapper never sets them, so every local edit clears them (and extra orgs / title without company) on Google. *Verified.* | `google-sync.ts:374`, `google-sync-mapping.ts:265-301` | S |
| A-02 | Sync / DAV | **iPhone edits lose addresses and websites; deletions don't stick.** DAV PUT doesn't strip the `item1.` group prefix (iOS always groups ADR/URL) and merges instead of replacing, so removed emails/notes come back. | `server.mjs:994-1013, 2213` | S |
| A-03 | Sync | **CardDAV push (iCloud etc.) wipes remote-only data** — anniversaries, IM, related names, categories — and has no `If-Match`, so a concurrent phone edit is overwritten. `significantDates` is missing from the push query. | `sync-runner.ts:1236-1270`, `carddav.ts:930-1006` | M |
| A-04 | Sync | **Google incremental sync reads only the first page** — >~100 remote changes and it loops on page 1 forever. | `google-sync.ts:339-365` | S |
| A-05 | Sync | **Every Google/Outlook-imported contact looks locally edited** (`lastSyncedAt` < `updatedAt`) → false conflicts, remote edits dropped, remote deletes ignored. | `sync-import-engine.ts:585, 284, 515` | S |
| A-06 | Sync | **Same conflict re-opened every run** → 50 conflicts in ~12 h → account auto-pauses. | `sync-runner.ts:1403-1420, 1484, 1936` | S |
| A-07 | Sync | **One rejected contact blocks Google/Outlook sync forever** (no per-contact try/catch; push runs before import). | `google-sync.ts:753-854`, `microsoft-sync.ts:770-868` | S |
| A-08 | Sync / ops | **A deploy mid-sync stops that account syncing permanently.** `leaseExpiresAt` is written but never read; the container gets SIGKILLed (no signal forwarding), so RUNNING jobs are orphaned. Same for data exports stuck in PROCESSING. | `sync-runner.ts:918, 649`, `start-production.mjs`, `data-export/jobs.ts:7` | S–M |
| A-09 | Billing | **A Stripe webhook that fails once is never processed** — the retry sees the error row and skips it (e.g. checkout never grants the plan). *Verified.* | `api/stripe/webhook/route.ts:69-91` | S |
| A-10 | Billing | **Teams subscribers get Free personal limits** (500 contacts, no API): Teams subs are stored on the group with `userId = null`, entitlements only read the user's subs. *Verified.* | `billing.ts:222-262` vs `stripe-handlers.ts:300` | S–M |
| A-11 | Billing | **Admin plan override breaks the customer's billing** — writes `admin-override-…` as the Stripe customer id, so checkout/portal fail; overriding a paying Pro user to Free strips features while they keep paying. | `actions/admin.ts:70-77`, `stripe-customers.ts:4,14` | M |
| A-12 | Security | **Fake SES bounces can silence a user's password-reset mail.** SNS webhook verifies the signature but not `TopicArn`, and auto-confirms subscriptions — any AWS account can mark any address BOUNCED. | `api/ses/events/route.ts:84-131`, `sns-verify.ts` | S |
| A-13 | Perf / availability | **Duplicate scoring is O(n²) on the web thread** — 62 s CPU for 1,000 contacts (~25 min for 5,000), blocking the whole site and CardDAV. Triggered by an un-rate-limited refresh route and first Google/Outlook import. | `contact-merge.ts:1160-1170`, `duplicate-signals.ts:50` | M |
| A-14 | Data | **Multi-value fields live in two column sets used by different code** — a CSV contact's 2nd/3rd emails are invisible in the editor and deleted on first save; web-added phones never reach devices. | `imports/contacts/commit/route.ts:166-176`, `contacts/[id]/page.tsx:621`, `server.mjs:905-1110` | M |
| A-15 | Ops | **Backups can be silently truncated** (`pg_dump \| gzip` without `pipefail`), fall back to plaintext if `age` is missing, and live only on the DB host (off-host copy is the monthly vzdump). | `scripts/ops/kontax-pg-backup.sh:17-26` | S |

## P1 — real defects and false claims

**Sync / data**
- A-16 "Delete permanently" hard-deletes and cascades the sync link → CardDAV re-imports it, Google/Outlook never delete, phones keep a ghost (`actions/contacts.ts:1293,1340`, v1 DELETE). M
- A-17 API, CSV-import and device edits never reach Google/Outlook/CardDAV — push only picks `lastMutatedBy: MANUAL`. M
- A-18 Devices silently overwrite REST API edits — API PATCH and photo pass don't bump `syncVersion` (the DAV ETag). S
- A-19 Remote field deletions never clear Kontax lists; Microsoft PATCH never sends null (`sync-contact-mapping.ts:59-75`). S–M
- A-20 Merge drops department/phonetics/emergency/book memberships; undo overwrites later edits; 30-day window UI-only; restore doesn't clear tombstoned links (`contact-merge.ts:1705, 2229-2268`). M
- A-21 Duplicate UIDs in one remote CardDAV book abort every run (`sync-runner.ts:1293`). S
- A-22 Google 400 FAILED_PRECONDITION (expired token / stale etag) not handled — idle accounts fail forever (*needs-verification*). S
- A-23 Google nicknames wiped (`google-sync.ts:77`); iOS year-less birthdays stored as 1604; Feb-29 iCal date invalid; birthday reminders duplicate across New Year (`reminders.ts:143`). S each
- A-24 Stripe lifecycle: unordered webhooks can regress state; Family lapse does nothing; repeatable Pro trial; webhook un-LOCKs admin-locked accounts; `graceEndsAt` never read. M

**Entitlements / security**
- A-25 Free 500-contact cap bypassed via CardDAV PUT, inbound sync, and create-into-family-book (`server.mjs:1715,1933,2191`, `sync-import-engine.ts:495`, `contacts.ts:614`). M
- A-26 Team plan lock bypassed: `requireTeamNotLocked` only checks teams the caller *owns* (admins bypass); team books stay writable over CardDAV after lapse (`teams.ts:98`, `server.mjs:1198`). S
- A-27 Admin "schedule deletion" doesn't flush the DAV credential cache — synced devices keep access ~10 min (`admin.ts:213`). S
- A-28 No step-up password for API token creation, TOTP enrolment, recovery-code regeneration, or swapping sync credentials (`api-tokens.ts:11`, `totp.ts:33-153`, `sync.ts:1039`). A hijacked session can mint durable access or redirect a contact export. S
- A-29 Quadratic regex over untrusted 10 MB CardDAV responses on the shared event loop (`carddav.ts:171,190`). S–M
- A-30 Export ZIPs (full PII) are never deleted from MinIO, and hard-delete doesn't remove them — contradicts the runbook and GDPR erasure (`data-export/jobs.ts:47`). S

**Public claims that are false** (pricing page is a hand-copied table that drifts from `plan-data.ts`/`billing.ts`)
- A-31 "Webhooks" ticked for Pro/Teams — no outbound webhooks exist (`pricing/page.tsx:147`).
- A-32 API limits "5k/day Pro, 20k/day Teams" — real limit is per token, 1,000 reads + 200 writes/hour (`rate-limit.ts:136`).
- A-33 "Minimum events kept" 3/25/10/All — code is 10/20/20/20; Teams "Unlimited members" — code caps at 25; "Priority support" contradicts itself across three surfaces.
- A-34 Help FAQ: "14-day Pro trial automatically, no card" — trial only via Checkout, card collected; "Family gets a full Pro account" (no API now); iCal feed / smart lists / bulk edit sold as Pro but ungated.
- Fix once: render the pricing matrix from `plan-data.ts` (M), then correct the copy.

**Public site (live on getkontax.com)**
- A-35 `/about` and `/contact` redirect logged-out visitors to /login — missing from middleware `PUBLIC_PREFIXES` (pricing links to /contact). S
- A-36 Dead links: `/u/demo` (features), `/changelog.xml` (changelog RSS). S
- A-37 `/changelog` overflows at 375 px; `/help` search input 15 px (iOS zoom); titles "Help — Kontax · Kontax" / "Developer docs — Kontax · Kontax". S

**Ops / performance**
- A-38 CardDAV outbound sync downloads the whole book twice per run, no ctag short-circuit; big iCloud books exceed 10 MB and fail forever (`sync-runner.ts:1189`). M
- A-39 DAV server loads every full contact row for every PROPFIND/REPORT; multiget filters in memory (`server.mjs:1130, 704`). M
- A-40 Dockerfile: `npm install prisma@^…` after prune likely reinstalls devDeps and drifts from the lockfile; `chown -R` duplicates a layer — likely cause of the staging full-disk. S–M
- A-41 No timeouts on Microsoft Graph / Google photo fetches; cron fan-out runs every user's reminders/digests concurrently on one pool. S
- A-42 `/api/health` 503s on a DB blip → restart loop takes the marketing site down; split liveness/readiness. S

**UX / accessibility**
- A-43 Revoking a live share or signing out a device happens instantly — no confirm/undo (`contact-sharing.tsx:454`, `sessions-section.tsx:40`). S
- A-44 New-contact form: no `<label>`s (placeholder-only) and 14 px inputs (iOS zoom) (`create-contact-form.tsx`). M
- A-45 2FA code boxes: no per-digit labels, no `autocomplete="one-time-code"`; 2FA modal lacks `aria-modal`/labelledby/Escape/focus (`verify-2fa/page.tsx`, `two-factor-modal.tsx`). S
- A-46 Mobile bottom sheet claims a focus trap but has none (`mobile-bottom-sheet.tsx:131`). M
- A-47 No `loading.tsx` / `not-found.tsx` anywhere — blank screens on slow routes, default Next 404. M

## P2 — hardening, polish, debt

Security: SSRF-safe but regex-heavy DAV client parsing; admin search leaks audit rows to non-`audit.view` tiers; `/admin/metrics` not capability-gated; admin audit CSV formula injection; `javascript:` URLs accepted for website fields; recovery codes 40-bit unsalted + non-atomic redemption; single-use share link race; unauthenticated username oracle; unbounded `PublicCardView` inserts and broadcast length; no Origin check on cookie-authed side-effecting GETs; v1 API invalid-token spraying unlimited; XFF fallback for IP limits; PII (emails) in logs; 64 MB archive upload without per-user limiter; decline-invite not bound to invitee; aggregate-book DELETE cross-book check.

Bugs: search tops out at 1,000 matches with no tiebreaker; import mapping gaps (Google `:::`, nickname/phonetic columns, split address columns); dead settings (`importLabelId`, `projectionBookIds`, `fieldPrecedence`, `weekStartsOn`, `requireReauthToEdit`); reminders marked sent on failure; no cron overlap locks; DAV unescape order; CSV `'`-prefixed phones not stripped on re-import; `nextRetryAt` never read.

Ops/debt: no error reporting (Sentry/OTel) and unstructured logs; runbook drift (`sync-ops.md`, `db-restore.md`, `gdpr-erasure.md`); `server.mjs` is 2,364 untyped lines with its own vCard code; 146 raw `process.env` reads vs `~/env`; CI never builds the Docker image; `eslint .` OOM is caused by linting `.claude/worktrees` (add to ignores); homepage dynamic just for "Welcome back"; heavy client bundles (`pinyin-pro` on the new-contact form); deprecated `@react-email/*`, `next-auth` beta, zod v3; `src/app/wireframes` ships to prod; unused `SharedBookPermissionAuditEvent` model; Geist font never loaded; no shared design tokens in the app (hex duplicated per file); dead `upgrade-gate.tsx` with stale "CardDAV is Pro" copy; onboarding completion auto-dismisses in 5 s; delete-account modal closes on backdrop.

## Product opportunities (from the features audit)

1. Relationship "reach out" nudges — `ActivityEvent` already timestamps every touch (M).
2. Sync health for end users — the data exists; only admins see it (S).
3. Background duplicate detection outside import — reuse `duplicate-signals` once A-13 is fixed (S–M).
4. Interaction timeline (calls/meetings notes) on the contact (M).
5. A real no-card Pro trial (Stripe `payment_method_collection: if_required`) — or stop claiming it (M).
6. Server-saved smart lists; family/team birthday calendar feed (S each).

## Found solid

Login/2FA/session revocation, open-redirect guard, cron auth, server-action authz (all use
`requireSession`), parameterised raw SQL, CSP/headers, CSV/zip import limits, OAuth state HMAC,
credential encryption + keyring, SSRF-safe fetch, impersonation design, Stripe signature + customer
binding, share-token design, DAV auth + path binding + XML hardening, migrations match the schema,
Microsoft delta paging, virtualised contact list, Redis-down degradation, non-root container.

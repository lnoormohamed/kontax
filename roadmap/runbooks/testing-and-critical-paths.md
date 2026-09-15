# Runbook: Testing & Critical Paths

**Subsystem:** Engineering test strategy and critical-path ownership  
**Audience:** Engineers adding features, debugging regressions, or preparing releases

---

## Overview

Kontax now carries meaningful product risk in contact editing, sync, billing,
and admin operations. This repo-owned baseline keeps the highest-risk logic
under source control instead of relying only on manual smoke checks.

## Test layers

### 1. Fast repo tests

Run these on every branch and in CI:

```bash
npm run test:repo
```

Current coverage owners:

| Flow / risk | Suite | Why it exists |
|---|---|---|
| Contact number editing semantics | `tests/node/phone-country-input-utils.test.ts` | Protects phone-country transformations that affect editing and country-code changes |
| Provider capability regressions | `tests/node/sync-provider-capabilities.test.ts` | Protects iCloud/Fastmail/generic-safe field handling and custom-label export rules |
| Provider identity / generic CardDAV naming | `tests/node/sync-provider-identity.test.ts` | Protects verified vs detected vs generic connection identity rules |
| Outbound fetch SSRF guard | `tests/node/safe-fetch.test.ts` | Protects the hardened fetcher (P48-04) shared by CardDAV, discovered hrefs and photo URIs against private/loopback/link-local targets |
| DAV request body caps | `tests/node/dav-body-limits.test.ts` | Protects the 64 KB query / 1 MB PUT caps and linear XML parsing (P48-08) against the DoS the old quadratic regex allowed |
| DAV client IP + auth | `tests/node/dav-auth-client-ip.test.ts` | Protects `cf-connecting-ip`-keyed rate limiting and the verified-credential cache (P48-09) |
| CSV export escaping | `tests/node/csv-escape.test.ts` | Protects against formula injection in CSV exports (P48-11) |
| iCal export escaping | `tests/node/ical-escape.test.ts` | Protects CRLF/text escaping in the `.ics` feed (P48-11) |
| Sharing projection (family/team copies, snapshots) | `tests/node/sharing-projection.test.ts` | Protects the sharing policy being applied to *copies*, not just live reads (P48-07) |
| Sync credential keyring | `tests/node/sync-credentials-keyring.test.ts` | Protects credential encryption/decryption across key rotation (P48-16) |
| Rate-limit outage policy | `tests/node/rate-limit-policy.test.ts` | Protects fail-open/fail-closed behaviour when Redis is unavailable (P48-16) |
| Open-redirect guard | `tests/node/safe-internal-path.test.ts` | Protects `?next=` / `redirectTo` against off-site redirects (P48-03) |
| Authorization / tenant isolation | `tests/node/authz/` | Cross-user access (P48-05), impersonation + pending-deletion write refusal (P48-06), unauthenticated cron routes (P48-10) — see harness usage below |

### 2. Environment-backed smoke coverage

Use this when an app instance is already running:

```bash
npm run test:e2e
```

This lane is reserved for browser-path validation such as auth continuity,
contact create/edit, sync settings save flows, and reconnect behavior.

### 3. Manual release smoke

Use the product smoke runbooks for staging/prod validation after deploys or
provider-specific sync changes.

## Critical-path ownership map

| Product path | Automated owner | Manual backup |
|---|---|---|
| Contact edit semantics | `tests/node/phone-country-input-utils.test.ts` | contact create/edit smoke on staging |
| Provider field projection | `tests/node/sync-provider-capabilities.test.ts` | provider fixture smoke on staging |
| Generic CardDAV provider identity | `tests/node/sync-provider-identity.test.ts` | sync-connections UI/admin review |
| Sync settings and reconnect flows | `tests/e2e/` lane | sync reconnect runbook |
| Destructive admin actions | `tests/e2e/` lane | admin ops smoke |

### 4. Authorization regression suite (`tests/node/authz/`)

P48-13 added a dedicated authz harness alongside the plain `tests/node/*`
unit tests. It needs a real Postgres — CI provides one as a `postgres:16`
service container and runs `prisma migrate deploy` against it before tests;
locally, point `TEST_DATABASE_URL` at any throwaway Postgres (e.g.
`./start-database.sh`'s container, or a second `docker run postgres:16`) and
run the same migration:

```bash
export TEST_DATABASE_URL=postgresql://kontax:kontax@localhost:5432/kontax_test
DATABASE_URL="$TEST_DATABASE_URL" npx prisma migrate deploy
npm run test:repo
```

Without `TEST_DATABASE_URL` set, the suite prints a clear
"skipping authz suite: TEST_DATABASE_URL not set" message and skips itself —
it does not fail the run, so `npm run test:repo` stays usable on a laptop
with no database running. CI always sets it.

The harness calls server actions and route handlers directly against a real
database rather than driving HTTP through `next dev`/`next start` — see
`tests/node/authz/_helpers.ts` for why (no `AUTH_SECRET`-signed session
cookie is available to construct outside of an actual sign-in, so the
harness overrides the module-level `auth()` resolver instead of mocking
cookies).

## Commands

```bash
# fast repo-owned regression suites
npm run test:repo

# same as above, but only the provider-fixture lane
npm run test:sync-fixtures

# environment-backed browser smoke
npm run test:e2e
```

## Expectations for new work

- Add or extend a repo-owned test when touching sync mapping, provider identity,
  import/export serialization, or contact editing helpers.
- If a flow cannot be reasonably covered without a live provider, add a fixture
  regression first and keep the live check in the smoke runbook.
- When introducing a new risky surface, update the ownership map above instead
  of leaving the test plan implicit.

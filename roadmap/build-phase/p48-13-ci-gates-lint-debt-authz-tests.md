# P48-13 — CI gates (check + build), lint debt, authorization regression tests

**Phase:** 48 · **Workstream:** F · **Priority:** P1 · **Depends on:** P48-12
**Audit severity:** High (process) + Low

## Objective

Make CI a real gate and give the security fixes in this phase a place to be
regression-tested. Nothing in the auth/authz surface is tested today.

## Context

- `.github/workflows/repo-tests.yml` runs only `npm run test:repo`. No
  typecheck, no lint, no `next build`, no e2e. `next.config.js:71` sets
  `eslint.ignoreDuringBuilds: true`, so lint is enforced nowhere.
- Local run 14 Sep: `tsc --noEmit` → 0 errors. `next lint` → 90 errors, 30
  warnings across 52 files: 33 unnecessary type assertions, 31
  `prefer-nullish-coalescing`, 14 unused vars, 8 `prefer-optional-chain`, 7
  `react/no-unescaped-entities`, 6 `@next/next/no-img-element`, 5
  `no-base-to-string`, 3 `react-hooks/exhaustive-deps`. `next lint` is
  deprecated; migrate to the ESLint CLI.
- Tests: 14 node files (~97 tests) cover merge scoring, sharing policy,
  provider capabilities/identity, the SSRF guard, session cache. Zero tests
  for: credentials login / TOTP / reset / revocation, server-action `userId`
  scoping, `withApiAuth`, `assertCronSecret`, Stripe webhook handlers,
  import/export jobs, or the 1,881-line `server.mjs`. One Playwright test.
- `test-results/` (with a Playwright trace) is committed and not gitignored.
- `docs/session-continuity.md` describes a middleware redirect that no
  longer exists (P48-01).

## Steps

1. **Workflow.** Add jobs: `npm ci` → `npm run typecheck` → `npm run lint`
   → `npm run test:repo` → `npm run build` (with `SKIP_ENV_VALIDATION=1` and
   a dummy `DATABASE_URL`). Run on `push` to `main`/`staging` and on
   `pull_request`. Cache `~/.npm`. Optionally a nightly `npm audit
   --audit-level=high`.
2. **Lint debt.** Migrate `next lint` → `eslint .` with the flat config
   already in `eslint.config.js`; auto-fix the 33 + 31 + 8 mechanical rules;
   hand-fix the rest; remove `ignoreDuringBuilds`. Add a rule (or a small
   script in CI) that fails when `auth()` is called directly under
   `src/app/actions` or `src/app/api` outside the P48-01 helper.
3. **Authz test harness.** Add `tests/node/authz/` with a helper that creates
   two users (and an admin) against a test Postgres (CI service container or
   `start-database.sh`), obtains sessions, and exercises server actions and
   route handlers directly. Land the cases required by P48-01, P48-02,
   P48-03, P48-05, P48-06, P48-10 as those tickets ship.
4. **DAV harness.** Boot `server.mjs` against the test DB in a test and run:
   Basic auth happy path, wrong password, cross-user principal (403), 4 MB
   PROPFIND (413), read-only book PUT (P48-09).
5. **Hygiene.** `git rm -r test-results/`; add to `.gitignore`. Update
   `docs/session-continuity.md`. Prune the 14 stale remote branches.

## Acceptance

- A PR that introduces a type error, a lint error, a failing test or a build
  failure cannot merge (branch protection on `main` requires the workflow).
- `next lint` / `eslint .` reports 0 errors on `main`.
- `tests/node/authz` runs in CI with at least the cases from P48-01, P48-05,
  P48-06 and P48-10 green.
- `test-results/` no longer tracked.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (testing-and-critical-paths: new lanes)
- [x] Internal · engineering — docs/ (authz test harness usage)

## References

- Audit report §Code health, §Tests
- `.github/workflows/repo-tests.yml`, `eslint.config.js`, `next.config.js`, `tests/`, `roadmap/runbooks/testing-and-critical-paths.md`
- P34P (test coverage triage, outstanding)

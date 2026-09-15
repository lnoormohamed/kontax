// P48-13: shared bootstrap for tests/node/authz/*.
//
// The authz suite needs a REAL Postgres — it exercises server actions and
// route handlers against actual FK/unique constraints, not a mock. CI
// provides one as a `postgres:16` service container (see
// .github/workflows/repo-tests.yml) and runs `prisma migrate deploy` against
// it before tests run; TEST_DATABASE_URL is how the suite finds it.
//
// `npm run test:repo` sets a dummy, unreachable DATABASE_URL so the rest of
// the suite can import `~/server/db` without a real database (see
// package.json). That dummy value is wrong for this suite, so — when
// TEST_DATABASE_URL is set — this module overwrites `process.env.DATABASE_URL`
// with it BEFORE any test file dynamically imports `~/server/db` (or anything
// that transitively imports it, e.g. the action modules under test).
//
// This only works because Node's test runner (`node --test <dir>`) forks one
// process PER TEST FILE by default: mutating `process.env` here can never
// leak into a sibling test file's process. Every test in tests/node/authz/
// MUST import this module first, and MUST use a dynamic `await import(...)`
// (not a static `import`) for `~/server/db` and anything downstream of it —
// static imports are hoisted and would run before this module's body does.
export const hasTestDb = Boolean(process.env.TEST_DATABASE_URL);

if (hasTestDb) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.SKIP_ENV_VALIDATION = process.env.SKIP_ENV_VALIDATION ?? "1";
}

export const skipMessage =
  "TEST_DATABASE_URL not set — skipping authz suite (see roadmap/runbooks/testing-and-critical-paths.md)";

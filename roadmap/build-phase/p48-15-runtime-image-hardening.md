# P48-15 — Runtime image hardening: non-root, pruned, no `src`/`scripts`/`generated`, HEALTHCHECK

**Phase:** 48 · **Workstream:** G · **Priority:** P1 · **Depends on:** P48-12
**Audit severity:** Medium + Low (×3)

## Objective

Reduce what an attacker gets if they achieve code execution in the app
container, make builds reproducible, and give Coolify a meaningful health
signal.

## Context

- `Dockerfile:16-38`: no `USER` directive — the app runs as root.
- `Dockerfile:9` installs with `NODE_ENV=development`; `:27` copies the whole
  `node_modules` (Playwright, ESLint, TypeScript, Tailwind toolchain) into
  the runner. No `npm prune --omit=dev`.
- `:33-34` copy `scripts/` (44 files incl. `grant-admin.mjs`,
  `seed-demo-showcase.mjs` which calls `db.user.deleteMany` at `:107`,
  `rollback-teams-billing-to-org.mjs`, 11 seeders) and `src/` into the
  runtime image. `server.mjs` imports only `./generated/prisma/index.js`;
  the only runtime needs are `start-production.mjs`, `check-schema-drift.mjs`,
  `setup-contact-search-index.mjs` and (until P48-14) the migration tooling.
- `generated/` (27 files, 28 MB, incl. an 18.9 MB
  `libquery_engine-darwin-arm64.dylib.node`) is committed. `npm ci` runs
  `prisma generate` producing a fresh Linux client, then `COPY . .`
  (`:12`) overwrites it with the committed macOS-generated copy. Today the
  two match on schema, but any schema change without a manual
  `prisma generate` ships a stale client silently.
- No `HEALTHCHECK`; `/api/health` returns a static `{status:"ok"}` without
  touching Postgres or Redis.
- `.dockerignore` has 9 entries; `docs/`, `roadmap/` (7.7 MB), `tests/`,
  `test-results/`, `.github/`, `.claude/` enter the build context.
- No error tracking; console-only logging with no request ids.

## Steps

1. **Multi-stage tidy.** Builder: `npm ci` → `prisma generate` → `next
   build` → `npm prune --omit=dev`. Runner: copy `.next`, `public`,
   `next.config.js`, `server.mjs`, `prisma/` (schema + migrations),
   `node_modules` (pruned), `generated/` (from the builder, not the repo),
   and an allowlisted `scripts/runtime/` containing only the boot scripts.
   Consider `output: "standalone"` to shrink further (verify `server.mjs`
   compatibility).
2. **Stop tracking `generated/`.** `git rm -r --cached generated`; add to
   `.gitignore`; `postinstall` already regenerates. Update any import paths
   that assume the committed location.
3. **Non-root.** `RUN chown -R node:node /app` then `USER node`; confirm
   `PORT=3000` needs no privileges and MinIO/Redis/Postgres clients work.
4. **Health.** Make `/api/health` do a cheap `SELECT 1` and a Redis `PING`
   (with 1 s timeouts) and return 503 on failure, without leaking versions.
   Add `HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1`.
   Point Coolify's health check at it.
5. **`.dockerignore`.** Add `docs`, `roadmap`, `tests`, `test-results`,
   `.github`, `.claude`, `open-format` (unless served at build), `*.md`.
6. **Observability (minimum).** Add `process.on("unhandledRejection")` /
   `uncaughtException` logging in `server.mjs`; add a request id to DAV and
   API error logs; evaluate a lightweight error tracker (Sentry/GlitchTip)
   in a follow-up.

## Acceptance

- `docker run … id -u` → non-zero; app boots and passes the smoke matrix.
- Runtime image contains no `eslint`, `typescript`, `playwright`, `src/`,
  seed scripts or `grant-admin.mjs` (`docker run … ls`).
- Image size reduced (record before/after).
- A schema change + `prisma generate` in CI produces a client that matches;
  `generated/` no longer in git.
- Stopping Postgres makes `/api/health` return 503 and Coolify mark the
  container unhealthy.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (deploy.md: image layout, how to run admin scripts now that they are not in the image — e.g. a one-off `docker run` of the builder stage or an ops LXC)
- [ ] Internal · engineering — docs/

## References

- Audit report §Medium "Runtime image runs as root…"; §Low health/logging items
- `Dockerfile`, `.dockerignore`, `scripts/start-production.mjs`, `src/app/api/health/route.ts`
- P47-01 readiness checklist, P47-12 uptime monitoring

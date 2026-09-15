# P48-12 — Dependency upgrades, lockfile regeneration, image optimizer off, Host pinning

**Phase:** 48 · **Workstream:** F · **Priority:** P0 · **Depends on:** —
**Audit severity:** High (×2)

## Objective

Get `npm ci` working again, clear the critical/high advisories, and remove
two Next.js attack surfaces that this deployment exposes but does not use.

## Context

- **Lockfile drift.** `npm ci` fails: "package.json and package-lock.json are
  not in sync" (missing `@emnapi/runtime`, `@emnapi/core`;
  `@emnapi/wasi-threads` version mismatch). `package-lock.json` was last
  touched 4 Jul, `package.json` 5 Jul. All six most recent GitHub Actions
  runs on `main` failed in 10-15 s with this error (checked 14 Sep; oldest
  failure seen 2 Jul). The Dockerfile also runs `npm ci` (`Dockerfile:9`),
  so a fresh build from `ab10c61` cannot succeed; whatever serves
  getkontax.com came from an older commit or cached layer.
- **`npm audit`:** 4 critical, 14 high, 1 moderate; all have fixes.
  - `next` 15.5.19: GHSA-89xv-2m56-2m9x (SSRF in Server Actions on custom
    servers — this app runs `server.mjs` and uses actions heavily);
    GHSA-2xp9-vwfh-vxw4 (unauthenticated RCE in the Image Optimization API
    with AVIF); GHSA-68g3-v927-f742 / GHSA-4633-3j49-mh5q (cache confusion);
    GHSA-m99w-x7hq-7vfj (DoS via Server Actions); others. Patched in 15.5.21+.
  - `next-auth` 5.0.0-beta.25: GHSA-8fpg-xm3f-6cx3 (fail-open on config
    errors), GHSA-x445-f3h2-j279 (OAuth check cookies not bound to provider),
    GHSA-7rqj-j65f-68wh, GHSA-xmf8-cvqr-rfgj. Fixed in beta.32.
  - `adm-zip` ≤ 0.6.0: GHSA-xcpc-8h2w-3j85 (4 GB allocation), GHSA-vwc7-r8mq-g2x9.
  - `sharp` (libvips/libheif CVEs), `postcss` (sourceMappingURL file read),
    plus transitive `brace-expansion`, `fast-uri`, `js-yaml`, `nanoid`, `ws`,
    `qs`, `deepmerge-ts`, `socket.io-*`, `engine.io`, `prisma`/`@prisma/config`.
- **Image optimizer live but unused.** `git grep 'from "next/image"' src`
  → 0 hits, yet `GET /_next/image?url=/icon-192.png&w=64&q=75` on
  getkontax.com returns 200. No `images` config in `next.config.js`.
- **Host not pinned.** `server.mjs:1854-1860` passes the raw request to
  `handle(req, res)`; `x-forwarded-host` from the client is not overwritten
  (NPM/Traefik behaviour unverified from the repo).
- `x-powered-by: Next.js` on every response.

## Steps

1. `npm install` to regenerate `package-lock.json`; commit. Confirm `npm ci`
   passes locally on macOS and in CI on Linux.
2. Upgrade: `next` ≥ 15.5.21 (stay on 15.x; 16 is a separate migration),
   `eslint-config-next` to match, `next-auth` ≥ 5.0.0-beta.32,
   `@auth/prisma-adapter` — **remove** (0 imports; JWT strategy),
   `adm-zip` ≥ 0.6.1, `sharp` latest 0.35.x with the libvips fix, `postcss`
   ≥ 8.5.23, `prisma` / `@prisma/client` to the patched 6.x. Then
   `npm audit fix` for transitives and re-run `npm audit` until zero
   critical/high.
3. Move `react-email` to devDependencies; drop the redundant `playwright`
   (keep `@playwright/test`); add `"engines": { "node": ">=22 <23" }`; bump
   `@types/node` to 22; align `@next/bundle-analyzer` with next 15.
4. In `next.config.js`: `images: { unoptimized: true }`,
   `poweredByHeader: false`.
5. In `server.mjs`, before `handle()`: set `req.headers.host` and
   `req.headers["x-forwarded-host"]` to the host of `APP_URL` (fail closed if
   `APP_URL` is unset in production — P48-16 makes it required). Optionally
   set `__NEXT_PRIVATE_ORIGIN`.
6. Run the full smoke matrix (P47-13) on staging after the upgrade; pay
   attention to next-auth beta changes (cookie names, `trustHost`).

## Acceptance

- `npm ci` exits 0 on a clean clone; GitHub Actions is green on `main`.
- `npm audit --audit-level=high` reports 0.
- `GET /_next/image?...` returns 404/400 on staging and prod.
- Response headers no longer include `x-powered-by`.
- A request with `X-Forwarded-Host: evil.example` to a server action redirect
  produces a `Location` on `getkontax.com`.
- Login, 2FA, Google/Microsoft OAuth connect, Stripe checkout and CardDAV
  all pass the smoke matrix on the upgraded build.

## Documentation (per roadmap/documentation-policy.md)
On completion, update the relevant surface(s):
- [ ] External · users — in-app Help
- [ ] External · developers — /developers
- [x] Internal · admins/ops — roadmap/runbooks/ (deploy: upgrade notes; `APP_URL` now required)
- [ ] Internal · engineering — docs/

## References

- Audit report §High "Vulnerable dependencies…", "Lockfile drift…"
- `npm audit --json` output (14 Sep 2026), `.github/workflows/repo-tests.yml`, `Dockerfile`, `next.config.js`, `server.mjs`

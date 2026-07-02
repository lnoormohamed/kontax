# SEC-02 — Remove `'unsafe-inline'` from the script-src CSP

> Severity: defense-in-depth · would have neutralized SEC-01 on its own
> Status: **DONE** (Option C) — shipped to staging in commit `0fd01e4`.

## Outcome (verified on staging)

Implemented Option C: a nonce-based `script-src` scoped to `/u/*` via
`middleware.ts`; `next.config.js` and all other routes untouched.

Verified on `kontax.vexon.co`:
- `/u/*` serves `script-src 'self' 'nonce-<32-char>' https://js.stripe.com`
  (no `'unsafe-inline'`); the middleware header cleanly replaced the global one
  on that route (single CSP header, not two).
- All inline scripts on the page carry the header's nonce (10/10 inline
  `<script>` tags nonced; 0 un-nonced), so Next.js applied it to its own
  hydration scripts and the page renders without CSP violations.
- Marketing/app routes (`/`, etc.) keep the original `'unsafe-inline'` policy —
  no regression, static generation unaffected.
- Local: `tsc` clean; production build passes; `/u/[username]` stays dynamic.

## Purpose

Harden the Content-Security-Policy so that an injected inline `<script>` cannot
execute, even if an output-encoding bug (like SEC-01) slips through in future.

## Background

The staging response headers on `kontax.vexon.co` carry:

```
content-security-policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com; ...
```

`'unsafe-inline'` in `script-src` allows any inline `<script>` to run, which is
exactly what makes the SEC-01 JSON-LD breakout exploitable. The rest of the CSP
is well-constructed (`object-src 'none'`, `base-uri 'self'`, `form-action 'self'`,
scoped `connect-src`/`frame-src`), so this is the single weakest link.

The app uses inline scripts today (Next.js hydration/bootstrap, the JSON-LD
blocks, and the auto-print snippet in `src/app/contacts/print/page.tsx:13`), so
removing `'unsafe-inline'` requires a nonce or hash strategy rather than a
straight deletion.

**Important — the current CSP cannot carry a nonce as written.** It is defined
as a *static* string in `next.config.js` (the `securityHeaders` array →
`headers()`, lines 24-41). `next.config.js` `headers()` is evaluated once and
returns a fixed value; it has no per-request context, so a nonce cannot be
injected there. Delivering a nonce requires generating it **per request in
`src/middleware.ts`** and setting the CSP header there instead. This is the real
scope of the ticket — not a one-line directive edit.

Note also that `src/middleware.ts` is deliberately kept lightweight for the
self-hosted Coolify/edge build (see its header comment about `AUTH_SECRET` not
being available at build time). Nonce generation via Web Crypto
(`crypto.randomUUID()` / `getRandomValues`) works in the edge runtime, but the
change touches a sensitive file and must be tested against the deployed build.

## Scope

**In scope**
- Relocating the `script-src` CSP (at minimum) from the static `next.config.js`
  header into per-request generation in `src/middleware.ts`
- A nonce- or hash-based mechanism for the legitimate inline scripts, applied to
  `JsonLd` and the print-page `<script>`

**Out of scope**
- `style-src 'unsafe-inline'` (lower risk; can be a follow-up)
- Broader CSP restructuring beyond `script-src`

## Dependencies

- Best sequenced after SEC-01 lands, so the XSS is already closed and this is
  purely hardening.
- Coordinate with the JSON-LD component (SEC-01) so its `<script>` carries the
  nonce.

## Risks / decision required before starting

Reading a per-request nonce in a component (via `headers()`) opts that route out
of static generation — it forces **dynamic rendering**. The marketing pages
(`src/app/(marketing)/*`) render `JsonLd` and are statically generated today (no
`dynamic`/`revalidate` overrides), and middleware runs on every HTML route, so a
naive global-nonce rollout would turn the currently-static marketing pages
dynamic. That is a performance/caching regression, not just a header change.

Decide up front which path to take. Investigation (staging HTML + route
inspection) narrowed the viable options:

- **A — nonce everywhere:** middleware sets a per-request nonce on all routes;
  Next propagates it to its own inline scripts. Works, but every page — including
  the marketing site — becomes dynamically rendered, and the per-request nonce
  makes the HTML uncacheable at the CDN. Real perf/cost regression for public
  pages.
- **B — hash static pages (REJECTED, infeasible):** the idea was to hash inline
  scripts on static pages and nonce only dynamic ones. It does not work: a Next.js
  App Router page emits ~15 of its *own* inline hydration scripts (`self.__next_f
  .push(...)`), whose content varies per page and per build. They cannot be
  stably hashed, and a static page cannot receive a per-request nonce, so
  `'unsafe-inline'` cannot be removed from any statically-generated page. Hashing
  our two scripts (JSON-LD, print) does not help — Next's own inline scripts
  remain.
- **C — scoped strict CSP on the user-content route (RECOMMENDED):** keep the
  global static CSP (with `'unsafe-inline'`) for the marketing/app pages so their
  static generation and CDN caching are unaffected, and in `middleware.ts` emit a
  *stricter, nonce-based* `script-src` **only** for `/u/*`. `/u/[username]` is
  already dynamically rendered (it calls `auth()` and `headers()`), so the nonce
  applies to Next's inline scripts there at no extra rendering cost. This puts the
  strict policy exactly on the surface that renders user-controlled JSON-LD (the
  SEC-01 vector) with zero regression elsewhere.

Because SEC-01 already closed the exploitable XSS, SEC-02 is now purely
defense-in-depth. Option C is the only path that adds meaningful hardening
without a broad regression; if its complexity isn't judged worthwhile, the
reasonable alternative is to accept the residual risk and shelve this ticket.

**Decision: proceeding with Option C.**

## Design / Implementation Spec

### Desired behavior
- `script-src` no longer contains `'unsafe-inline'`.
- All first-party inline scripts (Next.js bootstrap, JSON-LD, the print
  auto-print snippet in `src/app/contacts/print/page.tsx`) still execute.
- Stripe's `https://js.stripe.com` remains allowed.

### Suggested implementation direction
- Move `script-src` out of the static `next.config.js` header. Keep the other
  directives in `next.config.js` if desired, or move the whole CSP to middleware
  for a single source of truth.
- In `src/middleware.ts`, generate a per-request nonce (`crypto.randomUUID()` or
  `getRandomValues`) and set the CSP header with
  `script-src 'self' 'nonce-<value>' https://js.stripe.com`. Next.js reads the
  nonce from the CSP header on the request and auto-applies it to its own inline
  bootstrap scripts (App Router nonce support). Forward the nonce to the app via
  a request header if components need it directly.
- Set `nonce={nonce}` on the `JsonLd` `<script>` and the print-page `<script>`.
- If a full nonce rollout is too large for one pass, an interim step is to switch
  `'unsafe-inline'` to hashes (`'sha256-...'`) for the two known static inline
  scripts (print snippet is a fixed string; JSON-LD is not, so it needs the nonce
  path) — but nonce is the cleaner target overall.

### Engineering notes
- The framework-level nonce propagation only kicks in when the CSP header is set
  per-request from middleware; a static header will not work. Confirm Next.js is
  actually attaching the nonce to hydration scripts after the move (inspect page
  HTML), or hydration will break under the tightened policy.
- Verify no third-party embed silently depends on inline scripts before
  tightening.
- Test Stripe Checkout/Elements flows after the change — they are the main
  external script consumer.
- Test against the Coolify/Docker build, not just local dev — the middleware file
  carries build-time env caveats.

## Acceptance Criteria
- Staging CSP header shows `script-src` without `'unsafe-inline'`.
- No CSP violations in the console across: landing, `/login`, dashboard,
  `/u/[username]`, contact print view, and a Stripe checkout flow.
- A hand-crafted inline `<script>` injected into page HTML does not execute.

## Documentation
- [ ] External · users
- [x] Internal · engineering — record the nonce approach and CSP rationale
- [x] Internal · QA

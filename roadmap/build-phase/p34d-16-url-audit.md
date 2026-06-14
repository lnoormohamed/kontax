# P34D-16 — Audit and Replace Hardcoded Staging URLs

## Purpose

Find and replace every hardcoded `kontax.vexon.co` (and any other hardcoded
non-production URLs) in the source code with `process.env.NEXT_PUBLIC_APP_URL` or
the appropriate env-driven constant, so that the same codebase can serve both
staging and production without domain-specific behaviour.

## Background

During development it is common to hardcode `kontax.vexon.co` in email templates,
share link generators, OG image URLs, and API documentation examples. Left in
production, these hardcoded URLs cause:
- Emails with links pointing back to staging (users click the link, land on staging,
  not the production app)
- OG image previews on social cards pointing to staging
- API docs showing the wrong base URL
- Public card share URLs generating staging links for production users

`NEXT_PUBLIC_APP_URL` is set to `https://getkontax.com` in production (P34D-11).
All dynamic URL construction should reference this variable.

## Scope

**In scope**
- All `.ts`, `.tsx`, `.js`, `.json` files under `src/`
- Email templates (wherever they live — `src/emails/`, `src/lib/email/`, etc.)
- Any constants or config files with hardcoded base URLs
- `roadmap/` directory — check for any documentation that will be publicly visible
  (e.g. if any roadmap content feeds into the public-facing developer docs)

**Out of scope**
- `kontax.vexon.co` references that appear only in `roadmap/` documentation intended
  for internal use (these do not need to be replaced, only noted)
- `.env` files (staging env vars are correct there by definition)
- `node_modules/`

## Design / Implementation Spec

### Step 1 — Find all occurrences

```bash
grep -rn "kontax.vexon.co" \
  src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.json" \
  --include="*.mjs"
```

Also search for other hardcoded production-pattern URLs that might be wrong:
```bash
# Check for any http:// URLs that should be https://
grep -rn "http://getkontax.com\|http://kontax" src/ --include="*.ts" --include="*.tsx"

# Check for hardcoded localhost in production paths
grep -rn "localhost:3000" src/ --include="*.ts" --include="*.tsx"
```

Document every file and line number found.

### Step 2 — Replacement patterns

For each occurrence, apply the appropriate replacement:

**In server-side code (API routes, server actions, email templates)**:
```typescript
// BEFORE
const shareUrl = `https://kontax.vexon.co/s/${token}`;

// AFTER
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://getkontax.com';
const shareUrl = `${appUrl}/s/${token}`;
```

**In client-side components** (NEXT_PUBLIC_ vars are available on the client):
```typescript
// BEFORE
const publicCardUrl = `https://kontax.vexon.co/u/${username}`;

// AFTER
const publicCardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/u/${username}`;
```

**In email templates** (these run on the server):
```typescript
// BEFORE
<a href="https://kontax.vexon.co/verify?token={{token}}">Verify email</a>

// AFTER
<a href="{{appUrl}}/verify?token={{token}}">Verify email</a>
// where appUrl is passed in from the caller using process.env.NEXT_PUBLIC_APP_URL
```

**In OG metadata** (in Next.js layout/page `metadata` exports):
```typescript
// BEFORE
openGraph: {
  url: 'https://kontax.vexon.co',
}

// AFTER
openGraph: {
  url: process.env.NEXT_PUBLIC_APP_URL,
}
```

**In sitemap generator** (`app/sitemap.ts` or `pages/sitemap.xml.ts`):
```typescript
// BEFORE
const BASE_URL = 'https://kontax.vexon.co';

// AFTER
const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://getkontax.com';
```

### Step 3 — Verify zero remaining occurrences

After all replacements:
```bash
grep -rn "kontax.vexon.co" \
  src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js" \
  --include="*.json" \
  --include="*.mjs"
```

Expected: no output (zero matches).

### Step 4 — Also check for constants files

Search for any constants or config file that might define the app URL:
```bash
grep -rn "APP_URL\|BASE_URL\|SITE_URL\|appUrl\|baseUrl\|siteUrl" \
  src/ \
  --include="*.ts" \
  --include="*.tsx" \
  --include="*.js"
```

If a constants file exists (e.g. `src/lib/config.ts`), ensure the URL constant reads
from `process.env.NEXT_PUBLIC_APP_URL`, not a hardcoded string.

### Step 5 — Test on staging after changes

Deploy the changes to staging (kontax.vexon.co). Trigger a registration email and
confirm the verification link in the email points to `kontax.vexon.co` (the staging
value of `NEXT_PUBLIC_APP_URL`). This proves the env-driven replacement works
correctly.

## Acceptance Criteria

- [ ] `grep -rn "kontax.vexon.co" src/ --include="*.ts" --include="*.tsx"` returns
      zero matches after all replacements.
- [ ] Verification email on staging contains links to `kontax.vexon.co` (not hardcoded
      to anything else).
- [ ] Verification email on production (after P34D-23) contains links to `getkontax.com`.
- [ ] OG metadata `url` field references `NEXT_PUBLIC_APP_URL` in the source.
- [ ] Sitemap base URL reads from `NEXT_PUBLIC_APP_URL`.
- [ ] No regressions: the app builds without errors after replacements.

## Risks / Open Questions

- **NEXT_PUBLIC_ variables are baked at build time**: if `NEXT_PUBLIC_APP_URL` is not
  set during the Next.js build, the client-side code will receive `undefined`. Ensure
  Coolify injects `NEXT_PUBLIC_APP_URL` before the build step, not just at runtime.
  (This is handled by setting the var in Coolify build env, which Next.js reads during
  `next build`.)
- **Email template format**: if email templates use a template engine or React Email,
  the pattern for injecting the URL may differ from plain string interpolation.
  Follow the pattern already established in the codebase.
- **robots.txt and sitemap**: these are often dynamically generated in Next.js App
  Router (`app/robots.ts`, `app/sitemap.ts`). Verify they use `NEXT_PUBLIC_APP_URL`
  and are not static files with hardcoded URLs.

## Documentation

- [ ] External · users — no changes needed (transparent change)
- [ ] External · developers — /developers: the base URL shown in API examples should
      update automatically if it reads from `NEXT_PUBLIC_APP_URL`
- [ ] Internal · ops — no runbook changes needed
- [x] Internal · engineering — establish the convention: never hardcode a domain;
      always use `NEXT_PUBLIC_APP_URL`. Add a note to `docs/conventions.md` or
      equivalent.

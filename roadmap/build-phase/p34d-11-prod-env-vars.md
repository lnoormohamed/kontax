# P34D-11 — Set All Production Environment Variables

## Purpose

Audit every environment variable used by the Kontax application, set all production
values in Coolify for the production deployment, and verify that the application
starts cleanly without env-validation errors.

## Background

Next.js apps with T3-style `env.mjs` or similar env validation throw on startup if
required variables are missing or malformed. `SKIP_ENV_VALIDATION` must not be set
in production. Each variable that differs between staging and production (domain,
Stripe keys, NEXTAUTH_SECRET, price IDs) must be explicitly overridden.

The NEXTAUTH_SECRET must be freshly generated for production — never reused from
staging. A shared secret would allow staging sessions to be replayed on production.

## Scope

**In scope**
- Full audit of `.env.example` in the codebase
- Setting all required variables in Coolify production environment
- Generating a fresh NEXTAUTH_SECRET
- Setting Stripe live keys (sk_live_...) and live price IDs
- Confirming the app starts without validation errors after a test deploy

**Out of scope**
- Stripe webhook secret (set separately in P34D-13 once the webhook endpoint is
  registered)
- Database provisioning (P34D-09 — DATABASE_URL should already be set from there)

## Design / Implementation Spec

### Step 1 — Audit .env.example

Run:
```bash
cat /path/to/kontax/.env.example
```
Identify every variable. For each: determine whether it has a different value in
production vs staging. Variables that are the same (e.g. SES region) can be copied;
variables that differ must be set to the production value.

### Step 2 — Production variable checklist

Set each of the following in Coolify → Production app → Environment Variables:

**Database**
- [ ] `DATABASE_URL` — `postgresql://kontax_prod:<password>@<host>:5432/kontax_prod`
      _(already set in P34D-09 — verify it is correct)_

**NextAuth**
- [ ] `NEXTAUTH_URL` — `https://getkontax.com`
      _(Must match exactly — trailing slash will cause OAuth callback mismatches)_
- [ ] `NEXTAUTH_SECRET` — freshly generated:
      ```bash
      openssl rand -base64 32
      ```
      Never reuse the staging value. Store the generated value in the secrets
      manager immediately.

**Google OAuth (sync)**
- [ ] `GOOGLE_CLIENT_ID` — from Google Cloud Console → Credentials → the sync OAuth
      client ID (same client can be used for staging and production if redirect URIs
      are both registered — see P34D-12)
- [ ] `GOOGLE_CLIENT_SECRET` — corresponding client secret

**Azure AD (Outlook sync)**
- [ ] `AZURE_AD_CLIENT_ID` — from Azure Portal → App registrations → the Kontax sync
      app → Application (client) ID
- [ ] `AZURE_AD_CLIENT_SECRET` — client secret value (not the secret ID)
- [ ] `AZURE_AD_TENANT_ID` — if multi-tenant, use `common`; if single-tenant, use the
      Directory (tenant) ID

**Stripe**
- [ ] `STRIPE_SECRET_KEY` — `sk_live_...` (production live mode secret key from
      Stripe Dashboard → Developers → API keys)
- [ ] `STRIPE_WEBHOOK_SECRET` — set after P34D-13 when the production webhook is
      registered; placeholder until then
- [ ] `STRIPE_PRICE_ID_PRO_MONTHLY` — the price ID from Stripe live mode for the
      monthly Pro plan (starts with `price_`)
- [ ] `STRIPE_PRICE_ID_PRO_ANNUAL` — annual Pro plan price ID
  _(Add any other plan/price IDs that exist in the codebase)_
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — `pk_live_...` (publishable key for
      Stripe.js on the client)

**SES / Email**
- [ ] `AWS_ACCESS_KEY_ID` — IAM access key with SES send permissions
- [ ] `AWS_SECRET_ACCESS_KEY` — corresponding secret
- [ ] `AWS_REGION` — `us-east-1` (SES is in us-east-1 per email/SES deployment note)
- [ ] `SES_FROM_ADDRESS` — `noreply@vexon.co` (or `noreply@getkontax.com` if the
      getkontax.com domain is verified in SES; check SES → Verified identities first)

**App**
- [ ] `NEXT_PUBLIC_APP_URL` — `https://getkontax.com`
- [ ] `NODE_ENV` — `production` (Coolify may set this automatically; verify)

**Any additional variables found in .env.example** — audit and set accordingly.

### Step 3 — Variables that must NOT be set in production

- [ ] `SKIP_ENV_VALIDATION` — must be absent or empty
- [ ] `DATABASE_URL` pointing to staging — verify it is not present

### Step 4 — Test deploy and startup verification

Trigger a test deployment in Coolify (production app, latest main commit). Watch the
build and startup logs for:
- Env validation errors (T3 env: `Invalid environment variables: ...`)
- Database connection errors (`P1001: Can't reach database server`)
- NextAuth configuration errors
- Any `NEXTAUTH_URL mismatch` warnings

If the app starts and `/api/auth/session` returns `{"user":null}` (not an error),
the env is valid.

### Step 5 — Verify NEXTAUTH_URL matches domain

From the app, trigger a login attempt and verify the callback URL in the browser's
network tab is `https://getkontax.com/api/auth/callback/credentials`. If it shows
the staging domain, `NEXTAUTH_URL` is wrong.

## Acceptance Criteria

- [ ] All variables in `.env.example` are accounted for in the production Coolify env.
- [ ] `NEXTAUTH_SECRET` is a freshly generated value, not reused from staging.
- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_` (not `sk_test_`).
- [ ] `NEXT_PUBLIC_APP_URL` is `https://getkontax.com`.
- [ ] `SKIP_ENV_VALIDATION` is not set.
- [ ] Production app starts without env-validation errors in Coolify logs.
- [ ] `/api/auth/session` returns valid JSON (not an error response).

## Risks / Open Questions

- **Stripe live key access**: live keys may be restricted to specific team members.
  Confirm who has access to the Stripe Dashboard live mode before starting this
  ticket.
- **Azure AD secret expiry**: Azure client secrets have a maximum expiry of 2 years.
  Note the expiry date and create a calendar reminder.
- **SES from address**: if `noreply@getkontax.com` is not yet verified in SES (us-east-1),
  emails will be rejected. Either verify the domain in SES first (a separate ticket
  if needed) or continue using `noreply@vexon.co` at launch and migrate later.
- **NEXT_PUBLIC_ variables**: these are baked into the client bundle at build time in
  Next.js. If any `NEXT_PUBLIC_` variable is changed after a build, a full rebuild is
  required. Ensure Coolify triggers a fresh build (not just a restart) after env
  var changes.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — no changes needed
- [x] Internal · ops — secrets manager: store all production credentials here; do not
      document the values themselves in any git-tracked file
- [ ] Internal · engineering — docs/: no code changes in this ticket; the `.env.example`
      should already reflect all required variables

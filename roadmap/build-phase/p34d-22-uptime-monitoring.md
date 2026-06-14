# P34D-22 — Configure Uptime Monitoring

## Purpose

Set up external uptime monitoring for `getkontax.com` before go-live so that any
downtime triggers an immediate alert. Create a `/api/health` endpoint if one does
not exist. Monitor both the main app and the API subdomain.

## Background

Without uptime monitoring, downtime is only discovered when a user reports it (or
when the team notices). A 5-minute check interval with email alerting is the minimum
viable monitoring setup — it means downtime is detected within 5 minutes and the
alert reaches the admin within seconds of detection.

The health endpoint must be:
- Unauthenticated (no session cookie required)
- Excluded from rate limiting (so the monitor's checks are never throttled)
- Lightweight (no database queries that could cascade-fail if the DB is slow)

## Scope

**In scope**
- Create `/api/health` endpoint in the Next.js app (if it doesn't exist)
- Configure UptimeRobot (free tier) to monitor `/api/health` every 5 minutes
- Configure a second UptimeRobot monitor for the API endpoint
- Set up email alert to admin email on downtime
- Document the UptimeRobot account details in the ops runbook

**Out of scope**
- Status page (Statuspage.io or similar) — future phase
- Slack alerting (nice-to-have, can be added post-launch)
- Synthetic transaction monitoring (a more advanced check that logs in and creates a
  contact) — future phase

## Design / Implementation Spec

### Step 1 — Create /api/health endpoint

Check if `src/app/api/health/route.ts` (App Router) or `src/pages/api/health.ts`
(Pages Router) already exists:

```bash
find src -name "health*" -o -name "healthcheck*" | head -10
```

If it does not exist, create it:

**App Router** (`src/app/api/health/route.ts`):
```typescript
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? 'unknown',
    },
    { status: 200 }
  );
}
```

**Do not** add a database ping to this endpoint — a DB outage should not prevent the
health endpoint from returning. The health endpoint confirms the Node.js process is
alive and responding. A separate, deeper health check (with DB ping) can be added
later and monitored at a lower priority level.

Exclude this route from NextAuth middleware. In `middleware.ts`, ensure the `/api/health`
path is in the public routes matcher (not wrapped in auth):
```typescript
export const config = {
  matcher: [
    // Protect all routes EXCEPT:
    '/((?!api/health|_next/static|_next/image|favicon.ico).*)',
  ],
};
```

Exclude from rate limiting by checking the path in the rate limiter middleware.

### Step 2 — Verify the health endpoint locally

```bash
curl https://getkontax.com/api/health
# Expected:
# {"status":"ok","timestamp":"2026-06-14T10:00:00.000Z","version":"..."}
# HTTP 200
```

### Step 3 — Set up UptimeRobot

1. Create a free account at https://uptimerobot.com (or use an existing account).
2. Click "Add New Monitor":
   - Monitor type: HTTP(s)
   - Friendly name: `Kontax — App Health`
   - URL: `https://getkontax.com/api/health`
   - Monitoring interval: 5 minutes
   - Alert contacts: add the admin email (Li@linoormohamed.com or equivalent ops email)
   - Alert threshold: Alert after 1 failure (immediate alerting)
3. Click "Create Monitor".

4. Add a second monitor for the API subdomain:
   - Monitor type: HTTP(s)
   - Friendly name: `Kontax — API`
   - URL: `https://api.getkontax.com/v1/contacts`
   - HTTP method: GET
   - Add a header: `Authorization: Bearer <monitoring-api-token>` (create a dedicated
     read-only API token for monitoring — do not use a personal API token)
   - Monitoring interval: 5 minutes
   - Alert contacts: same as above

5. Optionally: add a third monitor for the marketing homepage:
   - Friendly name: `Kontax — Homepage`
   - URL: `https://getkontax.com`
   - Keyword to check for: "Kontax" (confirms the page content is rendering, not just
     returning a 200 with an empty body)

### Step 4 — Verify monitoring is active

After creating the monitors, UptimeRobot will immediately check the URLs. The
monitors should show "Up" status within 2 minutes. If any show "Down", investigate
before go-live.

### Step 5 — Test alerting

UptimeRobot has a "Test" button on each monitor (or you can temporarily set the URL
to a non-existent path). Trigger a test downtime and confirm:
- An email alert arrives at the admin email within 5 minutes.
- The alert includes the monitor name, the URL that went down, and the timestamp.

### Step 6 — Document in ops runbook

Add to `roadmap/runbooks/uptime-monitoring.md` (create if it doesn't exist):
- UptimeRobot account email (store password in secrets manager)
- List of monitors and their URLs
- Alert email address(es)
- What to do when an alert fires (first-response runbook)

## Acceptance Criteria

- [ ] `GET https://getkontax.com/api/health` returns `{"status":"ok",...}` with HTTP 200.
- [ ] `/api/health` is accessible without a session cookie (unauthenticated).
- [ ] `/api/health` is not rate-limited (curl 10× rapidly — all return 200).
- [ ] UptimeRobot monitor for `/api/health` shows "Up" status.
- [ ] UptimeRobot monitor for `api.getkontax.com/v1/contacts` shows "Up" status.
- [ ] A test alert email is received at the admin email address.
- [ ] `roadmap/runbooks/uptime-monitoring.md` documents the monitoring setup.

## Risks / Open Questions

- **UptimeRobot free tier limitations**: free tier allows 50 monitors with 5-minute
  intervals. This is more than sufficient for the initial setup. If subdomain
  monitoring or more frequent checks are needed, the Pro plan adds 1-minute intervals
  and more monitors.
- **Monitoring API token security**: the API token used by UptimeRobot to authenticate
  against `/api/v1/contacts` should have read-only scope and should be rotated if
  it is ever exposed. Create it as a dedicated "monitoring" token in the Kontax app.
- **Health endpoint in middleware exclusion**: if `middleware.ts` does not correctly
  exclude `/api/health`, the health check will return a 401 or redirect to login,
  causing UptimeRobot to report a false "Down" status.
- **Coolify restart on deploy**: Coolify restarts the Next.js process on each deploy.
  During a rolling restart (30–60 seconds), the health endpoint may return 502.
  UptimeRobot will alert after 1 failure — consider setting the alert threshold to 2
  consecutive failures to avoid false alarms during normal deployments.

## Documentation

- [ ] External · users — no changes needed
- [ ] External · developers — /developers: document `/api/health` as a public endpoint
      for integration health checks
- [x] Internal · ops — `roadmap/runbooks/uptime-monitoring.md`: full monitoring setup
- [x] Internal · engineering — document the health endpoint exclusion from auth
      middleware in `docs/api-routes.md` or equivalent

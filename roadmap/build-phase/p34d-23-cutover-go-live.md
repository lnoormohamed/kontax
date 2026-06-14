# P34D-23 — Go-Live Cutover Execution

## Purpose

Execute the production go-live in a controlled, sequential sequence. Every step has a
verification check. A rollback plan is defined for use within the first hour if a
critical issue is discovered.

## Background

This is the final execution ticket. It is not a code ticket. All prerequisites (smoke
test sign-off, infrastructure provisioned, checklists complete) must be confirmed
before step 3. The DNS flip in step 5 is the point of no return — after it, real
users can access the production application.

Keep this document open during the cutover and mark each step as done in real time.
Assign one person to run the steps and a second person to monitor logs and verify
independently.

## Prerequisites (must be confirmed before step 1)

- [ ] P34D-08: Smoke test sign-off document is signed with zero open P0 failures
- [ ] P34D-09: Production database is provisioned
- [ ] P34D-10: Schema pushed to production DB, backups running
- [ ] P34D-11: All production env vars set in Coolify
- [ ] P34D-12: OAuth redirect URIs updated for getkontax.com
- [ ] P34D-13: Stripe live webhook registered and verified
- [ ] P34D-14: DNS records configured (may not be pointing to prod IP yet — that
      happens in step 5)
- [ ] P34D-15: TLS verified (run after DNS flip in step 5)
- [ ] P34D-16: Zero hardcoded staging URLs in codebase
- [ ] P34D-17: Security headers deployed
- [ ] P34D-18: Redirect from kontax.vexon.co configured
- [ ] P34D-19: Security checklist passed (all P0s clear)
- [ ] P34D-20: Performance checklist passed (P0s clear)
- [ ] P34D-21: SEO checklist passed (P0s clear)
- [ ] P34D-22: Uptime monitoring active

## Cutover Steps

### Step 1 — Final prerequisite confirmation (T-60 min)

Walk through every prerequisite checkbox above. If any is unchecked, stop — do not
proceed until resolved. Assign a go/no-go decision. Both the test runner (P34D-08
signer) and the infra owner must confirm go.

```
Go / No-Go decision: ______________ at ______________ (time)
Infra owner: ______________________
Test runner: ______________________
```

### Step 2 — Final deploy from main (T-30 min)

In Coolify, trigger a fresh deploy of the production application from the latest
`main` branch commit:

1. Go to Coolify → Production app → Deploy.
2. Select "Deploy latest commit from main".
3. Watch the build logs until "Deploy successful" or equivalent.
4. Check the Coolify runtime logs for any startup errors.
5. Verify the app is responding: `curl https://getkontax.com/api/health`
   (this will use whatever IP getkontax.com currently resolves to — may still be the
   staging server or a parked page at this point; if so, test by IP directly:
   `curl --resolve getkontax.com:443:<prod-ip> https://getkontax.com/api/health`)

```
Deploy commit SHA: __________________
Deploy completed at: ________________
Startup logs: clean / errors found: ___________________
```

### Step 3 — Pre-flip verification (T-15 min)

While DNS still points at the old destination:
1. Verify the production app responds correctly via the server IP directly:
   ```bash
   curl --resolve getkontax.com:443:<prod-ip> https://getkontax.com/api/health
   # Expected: {"status":"ok",...}
   ```
2. Verify login works via direct IP (use `--resolve` trick):
   ```bash
   curl --resolve getkontax.com:443:<prod-ip> -I https://getkontax.com/login
   # Expected: 200
   ```
3. Confirm `NEXTAUTH_URL` is `https://getkontax.com` in Coolify (login will fail if
   this is wrong).

### Step 4 — TTL pre-lower to 60 (T-10 min)

At the DNS registrar, set the TTL on the apex A record for `getkontax.com` to 60
seconds. Wait 5 minutes for the reduced TTL to propagate (so resolvers cache the
60s TTL before the flip).

```
TTL set to 60 at: ___________________
Waited 5 minutes: yes / no
```

### Step 5 — DNS flip (T=0)

Change the A record for `getkontax.com` to point to the production server IP
(`<prod-ip>`). This is the go-live moment.

```
DNS A record changed at: ___________________
New IP: ____________________________________
```

### Step 6 — Wait and verify DNS propagation (T+5 min)

```bash
# Check from multiple resolvers
dig @8.8.8.8 getkontax.com +short     # Google DNS
dig @1.1.1.1 getkontax.com +short     # Cloudflare DNS
dig @9.9.9.9 getkontax.com +short     # Quad9

# All three should return <prod-ip>
```

If propagation is taking longer than 5 minutes at 60s TTL, check the registrar's
control panel for errors.

```
Propagation confirmed at: ___________________
All resolvers show prod IP: yes / no
```

### Step 7 — End-to-end smoke test on production (T+8 min)

Open `https://getkontax.com` in an incognito browser window. Perform these checks:

1. **Homepage loads**: marketing homepage renders without error.
2. **Login**: log in with the smoke test account (created in P34D-01).
3. **Create a contact**: create a contact named "Go-Live Test" in production.
4. **Search**: type "Go-Live" in search. Contact appears.
5. **TLS**: address bar shows padlock (no cert error).
6. **HSTS**: `curl -I https://getkontax.com | grep strict-transport` shows header.

```
Homepage: pass / fail
Login: pass / fail
Create contact: pass / fail
Search: pass / fail
TLS: pass / fail
HSTS header: pass / fail
```

Any failure here triggers the rollback plan (see below).

### Step 8 — Monitor Coolify logs (T+0 to T+15 min)

In Coolify → Production app → Logs, watch for 5xx responses. During the first 15
minutes after DNS flip, any 500-series responses should be investigated immediately.

```
5xx responses observed: yes / no
If yes, routes and errors: ___________________
```

### Step 9 — Verify Stripe webhooks arriving from production (T+20 min)

In Stripe Dashboard → Developers → Webhooks → getkontax.com endpoint → Recent
deliveries. After the DNS flip, Stripe will start sending events to the production
endpoint.

If no events are visible within 20 minutes, it may mean no billing events have
occurred yet (that's fine). Confirm the webhook endpoint shows a green "Active"
status.

```
Stripe webhook endpoint status: Active / Error
Recent deliveries visible: yes / no / pending (no events yet)
```

### Step 10 — Announce go-live (T+25 min)

Once steps 7–9 are confirmed:
1. Post a go-live announcement in the team communication channel (Slack or equivalent).
2. Send any pre-planned launch communications (email list, social media).
3. Update the internal status page or ops doc with "LIVE as of [timestamp]".

```
Go-live announced at: ___________________
```

---

## Rollback Plan

**Trigger condition**: if any of the following occur within 1 hour of step 5:
- Step 7 smoke test fails on login or contact creation
- Stripe webhook errors accumulate (failed deliveries in Stripe dashboard)
- Coolify logs show sustained 5xx rate > 5% of requests
- Database connection errors in startup logs

**Rollback steps**:

1. Change the DNS A record for `getkontax.com` back to the staging server IP
   (or the parked page IP). With TTL at 60s, this propagates in ~1 minute.
2. Confirm: `dig @8.8.8.8 getkontax.com +short` returns the old IP.
3. Kontax.vexon.co remains untouched and fully functional — users who had bookmarks
   to the staging domain are unaffected.
4. Diagnose the failure. Open a P0 bug. Fix, re-test on staging, then re-run the
   cutover from step 2.

**After rollback**:
- Keep TTL at 60s until the next cutover attempt.
- Keep staging running for at least 48h post-rollback.
- Do not re-attempt cutover until the P0 failure is resolved and signed off.

---

## Post-Cutover Tasks

- [ ] Update `NEXT_PUBLIC_APP_URL` is confirmed as `https://getkontax.com` in production
- [ ] UptimeRobot monitors both show "Up"
- [ ] kontax.vexon.co redirect is active (`curl -I https://kontax.vexon.co` → 301)
- [ ] Delete the "Go-Live Test" contact created in step 7
- [ ] Schedule P34D-24 (post-launch review) for 24 hours from now

## Acceptance Criteria

- All 10 steps completed with no failures.
- End-to-end smoke (step 7) passes all 6 checks.
- No P0 issues in Coolify logs within 30 minutes of go-live.
- Go-live announced (step 10).

## Documentation

- [x] Internal · ops — this document IS the cutover runbook; keep it updated with
      actual timestamps during execution
- [x] Internal · ops — `roadmap/runbooks/smoke-test-results-v1.md`: note the
      production verification results from step 7
- [ ] External · users — post any status update to users if applicable
- [ ] Internal · engineering — no code changes in this ticket

# Runbook: Incident response basics

**Subsystem:** Cross-cutting — applies to any production incident  
**Audience:** On-call engineer, first responder

---

## Severity definitions

| Level | Impact | Response target |
|-------|--------|-----------------|
| **P0** | Site down / complete data loss risk | Immediate — drop everything |
| **P1** | Core feature broken for all users (can't sign in, contacts not loading) | Within 1 hour |
| **P2** | Feature degraded or broken for a subset of users | Within 4 hours |
| **P3** | Minor bug, cosmetic issue, single-user report | Normal sprint |

---

## First-response checklist

1. **Confirm the impact.** Open the site. Try to sign in. Check if contacts load. Identify what is broken and who is affected.

2. **Check the obvious things first:**
   - Coolify: is the container running? Any recent deploys?
   - Coolify logs: errors in the last 5–10 minutes?
   - Database: is `DATABASE_URL` reachable? Can you run a simple query?
   - Recent commit: did a deploy just go out? Check `git log --oneline -5`.

3. **Identify the blast radius.** Is it all users, a plan tier, a specific feature, a specific device/browser?

4. **Stop the bleeding before diagnosing.** If a bad deploy is the cause, roll back in Coolify (redeploy the previous image tag) — don't spend time debugging a broken build in production.

5. **Check Stripe** if billing-related: webhook delivery status, failed invoices, subscription state.

6. **Check SES** if email-related: SES sending statistics, bounce/complaint rates, suppression list.

---

## Common incident patterns

### Site down (crash-loop)

- **Cause:** Almost always a bad `prisma db push` on deploy (schema drift). See [deploy.md](deploy.md).
- **Fix:** Roll back to the previous working image in Coolify.

### Sign-in broken

- **Cause:** `AUTH_SECRET` rotated without notice; or the DB is unreachable; or NextAuth config error.
- **Check:** `AUTH_SECRET` env var matches what was set when sessions were issued. If rotated, all users are signed out — expected but disruptive.

### Contacts not saving

- **Cause:** DB write error, billing `lifecycleState` check, impersonation read-only check, or a middleware block.
- **Check:** Browser network tab → look at the failing request → check response body for error code.

### Emails not sending

- **Cause:** SES not configured (all four SES env vars must be set), SES in sandbox mode (only verified addresses), bounce rate too high (SES auto-pauses), or `EMAIL_FROM` not on a verified domain.
- **Check:** [ses-setup.md](ses-setup.md).

### Sync not working for a user

- **Cause:** Expired credentials, OAuth token revoked, wrong CardDAV URL.
- **Check:** `SyncAccount.status` and `lastError`. Direct user to reconnect. See [sync-ops.md](sync-ops.md).

---

## Escalation path

1. Check Coolify logs + Stripe dashboard + SES console — resolve if possible.
2. If data loss risk: take a DB snapshot immediately before any further action.
3. If unresolved after 30 minutes on a P0/P1: escalate to the team lead.
4. Post a status update in the team channel even if the incident is ongoing.

---

## Postmortem template

After every P0 or P1 incident:

```markdown
## Incident: [short description] — [date]

**Duration:** HH:MM – HH:MM UTC
**Severity:** P0 / P1
**Impact:** [who was affected and how]

### Timeline
- HH:MM — first report / alert
- HH:MM — [what happened]
- HH:MM — [mitigation applied]
- HH:MM — resolved

### Root cause
[What went wrong]

### What worked
[Detection, communication, resolution steps that were effective]

### What didn't work
[Gaps in monitoring, slow response, unclear runbooks]

### Action items
- [ ] [Owner]: [preventive change] by [date]
```

---

## References

- Deploy recovery: [deploy.md](deploy.md)
- Stripe issues: [stripe-billing.md](stripe-billing.md)
- SES issues: [ses-setup.md](ses-setup.md)
- Sync issues: [sync-ops.md](sync-ops.md)
- Admin ops: [admin-ops.md](admin-ops.md)

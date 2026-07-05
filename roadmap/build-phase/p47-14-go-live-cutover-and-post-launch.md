# P47-14 — Go-live cutover runbook & 24 h post-launch review

**Phase:** 47 · **Workstream:** D · **Priority:** P0 · **Depends on:** P47-13

## Objective

Execute the production cutover as a single sequential runbook with a clear
rollback, then review the first 24 hours.

## Go / No-Go gate (all must be true)

- [ ] P47-13 smoke test signed off — all P0 failures closed
- [ ] Schema applied, app boots clean in `validate` mode (P47-06)
- [ ] Full env set, no degraded mode (P47-05); MinIO round-trips (P47-02)
- [ ] Stripe live verified (P47-08); SES delivers (P47-09)
- [ ] DNS/TLS valid on every hostname, one canonical origin (P47-10/11)
- [ ] Backups + uptime monitoring live (P47-12)
- [ ] Google verification status noted (test-user workaround if not yet GA, P47-07)

## Cutover sequence

1. **Announce** a maintenance window if staging users exist.
2. **Freeze** staging writes if data must migrate (pre-launch prod is empty →
   likely a clean start, not a data migration; confirm on the checklist).
3. **Final schema apply + drift check** on prod (P47-06) — re-run immediately
   before the swap in case schema moved.
4. **Deploy** the release build to Coolify LXC 122; watch the log to
   `Starting Kontax.` + ready.
5. **Admin bootstrap** — the prod DB starts empty, so no admin exists. Register
   the founding account on the live origin, then grant it admin with
   `scripts/grant-admin.mjs` (run with `DATABASE_URL` pointed at prod). Confirm
   the admin dashboard loads — everything admin-gated (capability overrides,
   admin tooling) depends on this account existing.
6. **DNS flip / route enable** — point `getkontax.com` (+ chosen app origin) at
   the prod app if not already; confirm Traefik Host rules (P47-10, P34D-11 trap).
7. **Post-swap smoke** — re-run the P47-13 P0 cases on the live origin.
8. **Redirect** `kontax.vexon.co` → prod (301) if retiring staging, or leave
   staging as-is for continued testing (decision recorded).
9. **Verify cron** fires on the real schedule (or trigger once to confirm).

## Rollback

- App-level: redeploy the previous build in Coolify.
- Schema: additive-only changes are backward-compatible with the prior build; if
  a change is not, that was caught in P47-06 and should not have shipped. DB
  snapshot from P47-06/P47-12 is the last resort.
- DNS: revert the record / disable the route.

## Post-launch review (T + 24 h)

Write `roadmap/runbooks/p47-post-launch-review.md`:
- Error rates / uptime from monitoring (P47-12)
- Cron jobs all ran overnight (P47-04)
- Any degraded-mode surprises (email in console? avatars proxied? limits reset?)
- Stripe live events processed cleanly (P47-08)
- Open follow-ups (e.g. Google verification still pending → GA date)

## Acceptance

- Cutover executed per the sequence; app live on the canonical prod origin.
- Founding admin account exists and the admin dashboard loads (step 5).
- Post-swap smoke green.
- Post-launch review written with the 24 h findings and follow-up list.
- P47-01 checklist fully ✅ or every remaining line explicitly deferred with a reason.

## References

- [phase-47-preprod-release.md](phase-47-preprod-release.md) · [phase-34d.md](phase-34d.md) (P34D-23 precedent)
- [../runbooks/deploy.md](../runbooks/deploy.md) · [../runbooks/incident.md](../runbooks/incident.md)
</content>

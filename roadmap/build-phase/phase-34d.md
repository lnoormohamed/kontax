# Phase 34D — Pre-Launch Infrastructure, Smoke Testing & Go-Live

## Overview

Phase 34D is the final gate before Kontax goes live on **getkontax.com**. It covers
three parallel workstreams that converge at a single sign-off gate (P34D-08) before
the production cutover (P34D-23).

### Workstream A — Smoke Testing (P34D-01 through P34D-08)
Structured pass/fail testing of every major feature area against the staging
environment (kontax.vexon.co), then re-verified on production after cutover. Each
ticket defines exact test cases with expected results. Results are recorded in
`roadmap/runbooks/smoke-test-results-v1.md`. All P0 failures must be closed before
the go-live execution step (P34D-23).

### Workstream B — Production Infrastructure (P34D-09 through P34D-18)
Provision and harden the production environment: database, environment variables,
OAuth redirect URIs, Stripe webhooks, DNS, TLS, URL audit, security headers, and
domain redirect. These can run in parallel with smoke testing on staging; they must
be complete before P34D-23.

### Workstream C — Pre-Production Checklists (P34D-19 through P34D-22)
Final security, performance, SEO, and uptime-monitoring verification on the
production domain before the DNS flip.

### Convergence — Go-Live & Post-Launch (P34D-23 through P34D-24)
P34D-23 is the sequential cutover execution runbook. P34D-24 is the 24-hour
post-launch review run the following day.

---

## Tickets

| ID | Title | Workstream | Depends On |
|----|-------|-----------|------------|
| P34D-01 | Smoke test: authentication flows | A | — |
| P34D-02 | Smoke test: contacts CRUD and search | A | — |
| P34D-03 | Smoke test: sync | A | — |
| P34D-04 | Smoke test: sharing and family/teams | A | — |
| P34D-05 | Smoke test: billing and admin | A | — |
| P34D-06 | Smoke test: mobile and PWA | A | — |
| P34D-07 | Smoke test: public card, API, notifications | A | — |
| P34D-08 | Smoke test sign-off gate | A | P34D-01–07 |
| P34D-09 | Provision production PostgreSQL database | B | — |
| P34D-10 | Production db push and backup setup | B | P34D-09 |
| P34D-11 | Set all production environment variables | B | P34D-09 |
| P34D-12 | Add production URIs to OAuth app registrations | B | — |
| P34D-13 | Register Stripe webhook for production | B | — |
| P34D-14 | Configure DNS for getkontax.com | B | — |
| P34D-15 | Verify HTTPS / TLS end-to-end | B | P34D-14 |
| P34D-16 | Audit and replace hardcoded staging URLs | B | — |
| P34D-17 | Add security headers via next.config.js | B | — |
| P34D-18 | Redirect kontax.vexon.co → getkontax.com | B | P34D-14 |
| P34D-19 | Pre-production security checklist | C | P34D-11–17 |
| P34D-20 | Pre-production performance checklist | C | P34D-11–15 |
| P34D-21 | Pre-production SEO checklist | C | P34D-14–15 |
| P34D-22 | Configure uptime monitoring | C | P34D-14–15 |
| P34D-23 | Go-live cutover execution | Convergence | P34D-08, P34D-19–22 |
| P34D-24 | 24-hour post-launch review | Convergence | P34D-23 |

---

## Definition of Done for Phase 34D

- [ ] Smoke test sign-off (P34D-08) signed off — all P0 failures resolved
- [ ] Production database provisioned and backed up (P34D-09, P34D-10)
- [ ] All production env vars set and validated on live deployment (P34D-11)
- [ ] OAuth redirect URIs updated for getkontax.com (P34D-12)
- [ ] Stripe live webhook registered and verified (P34D-13)
- [ ] DNS propagated, TLS active on all domains (P34D-14, P34D-15)
- [ ] Zero hardcoded staging URLs in codebase (P34D-16)
- [ ] Security headers live (P34D-17)
- [ ] kontax.vexon.co redirecting to getkontax.com (P34D-18)
- [ ] Security, performance, SEO checklists complete (P34D-19–21)
- [ ] Uptime monitoring active and alerting (P34D-22)
- [ ] Go-live cutover completed (P34D-23)
- [ ] Post-launch review written (P34D-24)

---

## Environment Reference

| Setting | Staging | Production |
|---------|---------|-----------|
| Domain | kontax.vexon.co | getkontax.com |
| Database | kontax (shared LXC 114) | kontax_prod (dedicated) |
| Stripe mode | sandbox | live |
| NEXTAUTH_URL | https://kontax.vexon.co | https://getkontax.com |
| SES from address | noreply@vexon.co | noreply@vexon.co (or noreply@getkontax.com) |
| Deployment | Coolify / Proxmox LXC 114 | Coolify / Proxmox (separate app) |

---

## Go/No-Go Owners

- **Test runner**: person who executes P34D-01 through P34D-07 and signs off P34D-08
- **Infra owner**: person who completes P34D-09 through P34D-22
- **Go-live decision**: both owners must sign off before P34D-23 step 3

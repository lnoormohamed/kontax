# P47-01 — Production readiness master checklist & service inventory

**Phase:** 47 · **Workstream:** A (infra verify) · **Priority:** P0 · **Depends on:** —

## Objective

Produce the single source of truth for the go-live: a service-by-service
inventory of the production stack with an honest, verified status for each
backing service and external dependency. Every other P47 ticket closes one or
more lines on this list; this ticket owns the list.

Deliverable: `roadmap/runbooks/p47-production-readiness.md` (a living checklist,
updated as tickets close), seeded from the checklist embedded in
[phase-47-preprod-release.md](phase-47-preprod-release.md).

## Why this exists

Production was partially stood up during the abandoned **P34D** pass, then
Phases 38–46 added new infra (MinIO photos, sync runner, Redis, export
artifacts, multi-book schema). Nobody has walked the whole stack against the
*current* app. The failure mode we are guarding against is the **P44-06
blocker**: a service that "exists" (MinIO on LXC 151) but was never wired into
the app env, so a feature silently degrades in prod. The checklist forces a
positive verification of each line, not an assumption.

## Scope — walk and record

For each service, record: **exists? / wired into app env? / reachable from where
it must be reachable? / verified by what test?**

1. **PostgreSQL** — LXC 129, `192.168.1.193:5432`, db `kontax`. Confirm reachable
   from LXC 122; capture current schema state vs `prisma/schema.prisma` with
   `node scripts/check-schema-drift.mjs` (expect drift — quantify it → P47-06).
2. **MinIO** — LXC 151, `192.168.1.119:9000`, bucket `kontax-uploads`, proxy
   `media.getkontax.com`. → P47-02.
3. **Redis/Valkey** — confirm whether a prod instance exists at all. → P47-03.
4. **Cron LXC 152** — enumerate `/etc/cron.d/kontax`; confirm 8 jobs + 15-min
   sync. → P47-04.
5. **App container (Coolify LXC 122)** — dump current env keys (not values);
   diff against the `src/env.js` inventory. → P47-05.
6. **External:** Google OAuth, Microsoft OAuth, Stripe, SES — record current
   mode (test/live, sandbox/prod, staging/prod redirect). → P47-07/08/09.
7. **Edge:** DNS records, Traefik domain rules, TLS cert status for
   `getkontax.com` / `media.getkontax.com` / `app.getkontax.com`. → P47-10/11.

## Acceptance

- `roadmap/runbooks/p47-production-readiness.md` exists with every line above,
  each carrying a status (✅/◑/⬜/⚠️), the verification command/test used, and
  the owning ticket.
- The DB drift is quantified (list of missing tables/columns) so P47-06 has a
  concrete apply list.
- No line reads "assumed" — each is either positively verified or explicitly
  marked unverified with the blocking reason.

## References

- [phase-47-preprod-release.md](phase-47-preprod-release.md) — embedded checklist
- Infra memory: `memory/project_prod-infrastructure.md`
- [../runbooks/deploy.md](../runbooks/deploy.md), [../runbooks/env-secrets.md](../runbooks/env-secrets.md)
</content>

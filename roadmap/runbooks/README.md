# Kontax Runbooks

Operational playbooks for running and supporting Kontax in production.
Each runbook covers one subsystem: when to use it, normal state, failure modes, and recovery steps.

**Audience:** engineers, operators, and support escalation.
**Home:** `roadmap/runbooks/` — one file per subsystem.

---

## Index

### Existing

| Runbook | Subsystem | Status |
|---------|-----------|--------|
| [ses-setup.md](ses-setup.md) | Email / SES — domain verification, DKIM/SPF/DMARC, SNS bounce handling, suppression list | ✅ Written |
| [pwa-sw-cache.md](pwa-sw-cache.md) | PWA service worker — cache strategy, offline mode, cache invalidation, hard refresh | ✅ Written |
| [session-expiry-support.md](session-expiry-support.md) | Session expiry — how sessions expire on mobile PWA, support steps for "keeps logging out" reports | ✅ Written |

---

### P32-05 (written)

| Runbook | Subsystem |
|---------|-----------|
| [deploy.md](deploy.md) | Deploy & schema — Coolify / Proxmox LXC 114, `prisma db push` on startup, schema drift crash-loop recovery |
| [stripe-billing.md](stripe-billing.md) | Stripe & billing — webhook handlers, `lifecycleState` state machine, grace period (3 days), plan override, secret rotation |
| [admin-ops.md](admin-ops.md) | Admin operations — impersonation (30-min TTL cookie), feature flags (OFF/ALL/SPECIFIC_USERS/ROLLOUT), plan override, audit log |
| [gdpr-erasure.md](gdpr-erasure.md) | GDPR erasure — deletion phases (grace → cron hard-delete), data export ZIP contents, contested erasure handling |
| [env-secrets.md](env-secrets.md) | Env / secrets — full variable inventory with rotation guidance for each |
| [sync-ops.md](sync-ops.md) | Sync engine operations — CardDAV auth failures, OAuth token expiry, stuck jobs, forced re-sync, `syncVersion` drift |
| [import-export-jobs.md](import-export-jobs.md) | Import/export jobs — import pipeline phases, stuck exports, MinIO blob expiry, large file handling |
| [incident.md](incident.md) | Incident basics — severity definitions, first-response checklist, common patterns, postmortem template |
| [p40-book-memberships-backfill.md](p40-book-memberships-backfill.md) | P40 multi-book migration — `ContactBookMembership` backfill ordering, verification queries, rollback |

---

## Conventions

- **One runbook per subsystem** — cross-references are fine; duplication is not.
- **Sections:** Overview · Normal state · Monitoring signals · Failure modes & recovery · References.
- **Keep runbooks current** — when a subsystem changes significantly, update its runbook in the same PR.
- **Link from phase docs** — each phase that introduces an operationally-significant subsystem should link to its runbook (or note that one needs to be written).

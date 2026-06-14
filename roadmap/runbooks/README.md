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

### Planned (P32-05)

| Runbook | Subsystem | Priority |
|---------|-----------|----------|
| [deploy.md](deploy.md) *(not yet written)* | Deploy & schema — Coolify / Proxmox LXC 114, `prisma db push` on startup, schema drift crash-loop recovery, rollback | P0 |
| [stripe-billing.md](stripe-billing.md) *(not yet written)* | Stripe & billing — webhook secret rotation, failed payments, subscription state machine, `lifecycleState` values, manual plan override via admin panel | P0 |
| [admin-ops.md](admin-ops.md) *(not yet written)* | Admin operations — how to impersonate a user, override a plan, use feature flags, read the admin audit log, suspend/unsuspend an account | P0 |
| [gdpr-erasure.md](gdpr-erasure.md) *(not yet written)* | GDPR erasure — what "Delete my data" triggers, cascade order, how to verify completion, handling a contested erasure request | P0 |
| [env-secrets.md](env-secrets.md) *(not yet written)* | Env / secrets — all required env vars, where they live, how to rotate each, `.env.example` reference | P1 |
| [sync-ops.md](sync-ops.md) *(not yet written)* | Sync engine operations — stuck CardDAV sync, OAuth token expiry, forced re-auth, manual sync trigger, `syncVersion` drift, reading sync job logs | P1 |
| [import-export-jobs.md](import-export-jobs.md) *(not yet written)* | Import/export jobs — stuck jobs, re-triggering a failed export, GDPR ZIP contents, blob storage expiry | P1 |
| [incident.md](incident.md) *(not yet written)* | Incident basics — severity definitions, first-response checklist, escalation path, postmortem template | P2 |

---

## Conventions

- **One runbook per subsystem** — cross-references are fine; duplication is not.
- **Sections:** Overview · Normal state · Monitoring signals · Failure modes & recovery · References.
- **Keep runbooks current** — when a subsystem changes significantly, update its runbook in the same PR.
- **Link from phase docs** — each phase that introduces an operationally-significant subsystem should link to its runbook (or note that one needs to be written).

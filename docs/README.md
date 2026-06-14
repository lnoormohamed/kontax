# Kontax engineering docs

Conceptual and architectural documentation for Kontax.
For the ticket-by-ticket build history see [`roadmap/`](../roadmap).
These docs capture the *concepts* and *decisions* that span tickets and phases.

**Audience:** engineers working on the Kontax codebase.
**Home:** `docs/` — one file per cross-cutting subsystem or concept.

---

## Index

### Existing

| Doc | What it covers |
|-----|----------------|
| [organizing-contacts.md](organizing-contacts.md) | How **books**, **shared books**, **lists**, and **labels** differ, when to use each, and their data models (including the Label registry introduced in P31B). |
| [session-continuity.md](session-continuity.md) | How Kontax maintains session continuity across tab, page-reload, and back-navigation — especially on mobile PWA where the OS kills background tabs. |
| [session-expiry-recovery.md](session-expiry-recovery.md) | The controlled session-expiry UX: how expired sessions are detected, the redirect/intercept flow, and the step-up auth model for sensitive actions (P31). |
| [mobile-session-model.md](mobile-session-model.md) | The mobile PWA session model: how sessions survive background kills, the `visibilitychange` heartbeat, and the offline-then-online recovery path. |

---

### Planned (P32-06)

| Doc | What it should cover | Priority |
|-----|----------------------|----------|
| [sync-carddav-model.md](sync-carddav-model.md) *(not yet written)* | The CardDAV server architecture, URL structure, app-password model, `syncVersion` / `lastMutatedBy` sentinels, conflict handling (SERVER_WINS / DEVICE_WINS / MANUAL), sync job lifecycle, and how Google/Outlook OAuth sync differs from CardDAV. | P0 |
| [billing-lifecycle.md](billing-lifecycle.md) *(not yet written)* | The entitlement model, `lifecycleState` enum (ACTIVE / GRACE / LOCKED / CANCELED), the `canWrite` / `canUseBasicExport` flag derivation, grace period mechanics, and how Stripe webhook events drive state transitions. | P0 |
| [sharing-model.md](sharing-model.md) *(not yet written)* | The three contact-share types (vCard link / static Kontax-to-Kontax / live Kontax-to-Kontax), the `ContactShare` schema, live-share propagation flow, and what happens on revoke/downgrade. | P1 |
| [family-teams-model.md](family-teams-model.md) *(not yet written)* | The `GroupAddressBook` model, membership roles (owner / editor / viewer), how change propagation works across family members, how Teams extends Family with multiple books and per-book permissions, and the audit log. | P1 |
| [import-export-pipeline.md](import-export-pipeline.md) *(not yet written)* | The CSV/vCard import pipeline (parse → column classification → field mapping → dedup check → preview → commit), the export job model (background job, blob storage, 48h expiry), and the GDPR data-export ZIP structure. | P1 |
| [notifications-model.md](notifications-model.md) *(not yet written)* | The `UserNotification` model, notification categories and which can be suppressed, the digest scheduler, birthday/anniversary reminder logic (RRULE, lead-time override), and the iCal birthday feed. | P1 |
| [auth-security-model.md](auth-security-model.md) *(not yet written)* | The session table and `sessionVersion` invalidation pattern, TOTP 2FA enrolment and challenge flow, step-up auth for sensitive actions, rate limiting infrastructure, and the suspicious-activity detection rules. | P2 |

---

## Conventions

- **One doc per cross-cutting concept** — if it spans more than one phase and can't be derived just by reading the code, it belongs here.
- **No build history** — that lives in `roadmap/build-phase/`. These docs capture *what* a subsystem is, not *how it was built*.
- **Keep docs current** — when a subsystem changes significantly, update its doc in the same PR. The P31B labels doc is a good example of a doc kept in sync with the feature.
- **Link from phase docs** — each phase that introduces a significant subsystem should link to its concept doc (or note that one needs to be written).

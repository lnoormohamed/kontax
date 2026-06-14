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

### P32-06 (written)

| Doc | What it covers |
|-----|----------------|
| [sync-carddav-model.md](sync-carddav-model.md) | CardDAV server architecture, URL structure, app-password model, `syncVersion` / `lastMutatedBy` sentinels, OAuth vs CardDAV sync, conflict handling, `SyncAccount` status machine |
| [billing-lifecycle.md](billing-lifecycle.md) | `lifecycleState` state machine (ACTIVE / GRACE / LOCKED), plan entitlement matrix, `canWrite` / `canUseBasicExport` policy, Stripe webhook → state transitions, downgrade side-effects |
| [sharing-model.md](sharing-model.md) | Three share types (VCARD_LINK / STATIC_COPY / LIVE_SYNC), `ContactShare` schema, live-share propagation, revoke/downgrade conversion |
| [family-teams-model.md](family-teams-model.md) | `Group` / `GroupMember` / `GroupAddressBook` / `GroupContact` models, Family vs Teams roles, per-book permissions, invite flow, dissolution |
| [import-export-pipeline.md](import-export-pipeline.md) | CSV/vCard import pipeline (5 phases), export (synchronous + background job), GDPR ZIP contents, blob expiry |
| [notifications-model.md](notifications-model.md) | `Notification` model, 6 categories, always-on vs suppressible, digest cron, birthday reminder dedup, iCal feed, security alert resolution |
| [auth-security-model.md](auth-security-model.md) | Session table, `sessionVersion` invalidation, impersonation cookie, TOTP enrolment + challenge, step-up auth, rate limiters, suspicious-activity detection |

---

## Conventions

- **One doc per cross-cutting concept** — if it spans more than one phase and can't be derived just by reading the code, it belongs here.
- **No build history** — that lives in `roadmap/build-phase/`. These docs capture *what* a subsystem is, not *how it was built*.
- **Keep docs current** — when a subsystem changes significantly, update its doc in the same PR. The P31B labels doc is a good example of a doc kept in sync with the feature.
- **Link from phase docs** — each phase that introduces a significant subsystem should link to its concept doc (or note that one needs to be written).

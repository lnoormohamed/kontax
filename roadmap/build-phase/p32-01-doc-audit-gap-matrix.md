# P32-01 — Documentation audit & gap matrix

**Produced:** 2026-06-14  
**Scope:** All user-visible features from Phases 1–31B  
**Method:** Inventoried each feature area against the four documentation surfaces

---

## The four surfaces

| # | Surface | Location | Status |
|---|---------|----------|--------|
| U | External · users | In-app Help (`/help`, `help-faq-data.ts`) | Partially filled |
| D | External · developers | Public `/developers` page | Partially filled |
| R | Internal · admins/ops | `roadmap/runbooks/` | Sparse |
| E | Internal · engineering | `docs/` | Sparse |

Legend: ✅ Present · ❌ Missing · N/A Not applicable · 🔲 Partial (exists but thin)

---

## Gap matrix

### Feature: Contact CRUD (Phases 1–8, 16, 17)
_Create, view, edit, delete, archive, restore, search, sort, view modes_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for core contact operations. Users are expected to discover by exploration. Highest-impact gap. |
| D — Developers | ✅ | REST endpoints GET/POST/PUT/DELETE /contacts fully documented on `/developers`. |
| R — Runbooks | N/A | |
| E — Engineering | 🔲 | `organizing-contacts.md` covers the organizing layer (books/labels/lists), not the raw CRUD model or field schema. No `contact-model.md`. |

---

### Feature: CardDAV / Sync (Phase 9, P23)
_Server architecture, app passwords, device connections, sync settings, conflict policy_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ✅ | `carddav` section covers iCloud, Apple, app passwords, Android (DAVx⁵). |
| D — Developers | N/A | CardDAV is for devices, not API consumers. |
| R — Runbooks | ❌ | No runbook for sync engine operations — stuck tokens, re-auth errors, manual sync triggers, `syncVersion` drift, `lastMutatedBy` sentinel values. |
| E — Engineering | ❌ | No `docs/sync-carddav-model.md`. The sync engine (P9), conflict handling (P9-08), sync settings model (P23-01), book allowlist (P23-03), and direction control (P23-04) are undocumented internally. |

---

### Feature: Activity log & source tracking (Phase 10)
_Event schema, mutation instrumentation, source badges, history tab, global feed_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article. Users see the Activity tab and source badges with no explanation. |
| D — Developers | N/A | Activity log is not exposed via the public API. |
| R — Runbooks | N/A | |
| E — Engineering | ❌ | No concept doc for the event sourcing model (what events exist, what triggers them, retention). |

---

### Feature: Plans & Billing (Phases 11, 19)
_Plan tiers, entitlements, Stripe checkout, customer portal, webhooks, lifecycle states_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ✅ | `billing` section covers upgrade, cancel, refund, family seats. |
| D — Developers | N/A | Billing is not API-exposed. |
| R — Runbooks | ❌ | No Stripe runbook: webhook secret rotation, failed payments, plan override via admin panel, subscription state machine, `lifecycleState` values. Critical operational gap. |
| E — Engineering | ❌ | No `docs/billing-lifecycle.md`. The entitlement model, `lifecycleState` enum, `canWrite`/`canUseBasicExport` flags, grace period, and lock behaviour are undocumented. |

---

### Feature: Contact sharing (Phase 12)
_vCard share links, static K→K share, live K→K share, share management, accept/decline_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ✅ | `sharing` section covers share links, live shares, accept/decline. |
| D — Developers | N/A | Sharing is not API-exposed. |
| R — Runbooks | N/A | |
| E — Engineering | ❌ | No `docs/sharing-model.md`. The three share types (vCard/static/live), propagation model, `ContactShare` schema, and the live-share update flow are undocumented. |

---

### Feature: Family plan (Phase 13)
_Family group creation, invites, shared address book, change propagation, CardDAV exposure_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | 🔲 | Mentioned in `billing` section (seat count, who can edit) but no dedicated "How Family works" article with invite flow, shared book behaviour, or what members can see. |
| D — Developers | N/A | |
| R — Runbooks | N/A | |
| E — Engineering | ❌ | No concept doc for the Family/Teams shared address book model (how `GroupAddressBook` works, change propagation, membership roles). |

---

### Feature: Teams plan (Phase 14)
_Team creation, roles, multiple shared books, audit log, team CardDAV accounts_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article. Team admins have no guidance on roles, audit log, or managing members. |
| D — Developers | N/A | |
| R — Runbooks | N/A | |
| E — Engineering | ❌ | Same gap as Family — no concept doc (shared with Family above). |

---

### Feature: Row badges & Emergency contacts (Phase 15)
_Badge cluster, emergency flag, favorite, family/team/share badges_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article explaining what badges mean or how to mark an emergency contact. |
| D — Developers | N/A | `isEmergency` and `isFavorite` are returned by the API — documented in field reference on `/developers`. |
| R — Runbooks | N/A | |
| E — Engineering | N/A | Straightforward UI feature; no concept doc needed. |

---

### Feature: Contacts list & Contact detail UI (Phases 16, 17)
_Sidebar shell, column rows, compact/cozy views, contact detail tabs, inline edit_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for navigating the workspace (tabs, views, sort, scope toggle). |
| D — Developers | N/A | |
| R — Runbooks | N/A | |
| E — Engineering | N/A | UI implementation; no concept doc needed. |

---

### Feature: Account & Security (Phase 18)
_Profile edit, password change/reset, email change, email verification, active sessions, 2FA, account deletion_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ✅ | `security` section covers password reset, 2FA, active sessions, account deletion. |
| D — Developers | N/A | |
| R — Runbooks | N/A | |
| E — Engineering | ❌ | No concept doc for the auth & security model (session table, 2FA TOTP flow, step-up auth, rate limiting). `docs/session-continuity.md` and `docs/session-expiry-recovery.md` cover session UX but not the underlying auth model. |

---

### Feature: Email / SES (Phase 20)
_SES configuration, React Email templates, bounce/complaint handling_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | N/A | Transactional email is infrastructure, not user-facing help. |
| D — Developers | N/A | |
| R — Runbooks | ✅ | `runbooks/ses-setup.md` exists. |
| E — Engineering | N/A | |

---

### Feature: Admin panel (Phase 21)
_Admin role, audit log, user search/detail, plan override, suspend/delete, impersonation, feature flags, metrics_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | N/A | Admin panel is internal tooling. |
| D — Developers | N/A | |
| R — Runbooks | ❌ | No runbook for admin operations: how to impersonate a user, how to override a plan, how to use feature flags, how to interpret the admin audit log. High operational value. |
| E — Engineering | N/A | |

---

### Feature: Notifications (Phase 22)
_Bell, notification preferences, suspicious activity alerts, account lockout, birthday/anniversary reminders, digest scheduler, iCal feed_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for notification preferences, birthday reminders, digest settings, or the iCal birthday feed URL. |
| D — Developers | N/A | |
| R — Runbooks | N/A | |
| E — Engineering | ❌ | No concept doc for the notification model (event types, the digest scheduler, reminder lead-time preferences). |

---

### Feature: Mobile / PWA (Phases 24, 24B)
_Responsive layout, PWA manifest, service worker, install prompt, bottom nav, mobile UX patterns_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for "Install Kontax on your phone" or mobile-specific flows (install prompt, offline behaviour). |
| D — Developers | N/A | |
| R — Runbooks | ✅ | `runbooks/pwa-sw-cache.md` covers service worker cache. |
| E — Engineering | ✅ | `docs/mobile-session-model.md` covers the session model on mobile. |

---

### Feature: Import / Export (Phase 25 + earlier)
_CSV/vCard import, field mapping, save/reuse mappings, export field selection_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ✅ | `import` section covers CSV, vCard, Google export. |
| D — Developers | N/A | |
| R — Runbooks | ❌ | No runbook for the import/export job model (background jobs, stuck jobs, re-triggering). |
| E — Engineering | ❌ | No concept doc for the import pipeline (CSV parsing → field mapping → dedup → commit) or the export job model. |

---

### Feature: Landing / Onboarding (Phase 26)
_Public landing page, login/register rebuild, onboarding checklist, in-app Help system_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | N/A | The Help system itself was built here (P26-12). |
| D — Developers | N/A | |
| R — Runbooks | N/A | |
| E — Engineering | N/A | |

---

### Feature: Google & Outlook OAuth sync (Phase 27)
_Google Contacts OAuth, Outlook OAuth, two-way sync, conflict handling, deduplication on import_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for connecting Google or Outlook sync accounts, or what two-way sync does. `carddav` section covers CardDAV only. |
| D — Developers | N/A | OAuth sync is not API-exposed. |
| R — Runbooks | ❌ | No runbook for OAuth sync operations: token expiry, forced re-auth, sync stuck on conflict, manual trigger. |
| E — Engineering | ❌ | No concept doc for the Google/Outlook sync model vs. CardDAV (how the OAuth runner differs, token storage, field mapping conventions). |

---

### Feature: Smart lists, Books, Bulk edit, Shortcuts (Phase 28)
_Saved filters (smart lists), personal address books, bulk-edit toolbar, keyboard shortcuts, vCard QR, full-text search_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for smart lists, personal books, bulk edit, or keyboard shortcuts. These are power-user features with no discoverability beyond the UI. |
| D — Developers | N/A | |
| R — Runbooks | N/A | |
| E — Engineering | ✅ | `docs/organizing-contacts.md` covers books, lists, and labels fully. |

---

### Feature: GDPR / Developer API (Phase 29)
_GDPR data export (background jobs), erasure confirmation, API access tokens, REST API v1, rate limiting_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for "Download your data" or "Delete your account data" — required for GDPR compliance UX. |
| D — Developers | ✅ | `/developers` page documents auth (Bearer tokens), all 5 endpoints, field reference. |
| D — Developers | ❌ | Rate limits, error codes, and pagination are not documented on `/developers`. |
| R — Runbooks | ❌ | No runbook for GDPR erasure: what "Delete my data" triggers, how to verify completion, how to handle a contested erasure request. |
| E — Engineering | N/A | |

---

### Feature: Public card / @username (Phase 30)
_Username claim, public card page, visibility controls, "Add to Kontax" CTA, OG image, analytics, share tools_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for claiming a username, setting public card visibility, or sharing your card link. |
| D — Developers | N/A | |
| R — Runbooks | N/A | |
| E — Engineering | N/A | |

---

### Feature: Session & Auth UX (Phase 31)
_Authenticated redirects, step-up auth for sensitive actions, mobile PWA session resilience, session-expired UX_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | N/A | Transparent to users (good UX means they never notice). |
| D — Developers | N/A | |
| R — Runbooks | ✅ | `runbooks/session-expiry-support.md` covers support for session expiry issues. |
| E — Engineering | ✅ | `docs/session-continuity.md` + `docs/session-expiry-recovery.md` fully cover this. |

---

### Feature: Labels (Phase 31B)
_Label registry, palette, filter by label, manage modal, chips on rows, mobile filter sheet_

| Surface | Status | Notes |
|---------|--------|-------|
| U — Help | ❌ | No Help article for creating, applying, filtering by, or managing labels. |
| D — Developers | ❌ | `labels` field is returned by GET /contacts (JSON array) but not documented in field reference on `/developers`. |
| R — Runbooks | N/A | |
| E — Engineering | ✅ | `docs/organizing-contacts.md` — Labels section fully rewritten in P31B-10. |

---

## Summary by surface

### Surface U — External · users (Help articles)
**Present (5):** CardDAV & Sync · Import & Export · Account & Security · Sharing & Permissions · Plans & Billing  
**Missing (14):**

| Priority | Topic |
|----------|-------|
| P0 | Contact CRUD & workspace navigation |
| P0 | Labels (create, apply, filter, manage) |
| P0 | Smart lists & personal books |
| P0 | Google & Outlook sync (vs CardDAV) |
| P0 | GDPR: download your data / delete your data |
| P0 | Notifications & birthday reminders |
| P0 | Public card & @username |
| P1 | Teams plan (roles, audit log, shared books) |
| P1 | Family plan (dedicated article beyond billing blurb) |
| P1 | Bulk edit & keyboard shortcuts |
| P1 | Install Kontax on mobile (PWA) |
| P1 | Activity log & source badges |
| P1 | Emergency contacts & badges |
| P2 | iCal birthday feed |

---

### Surface D — External · developers (/developers page)
**Present:** Auth (Bearer tokens) · 5 REST endpoints · Field reference (partial)  
**Missing:**

| Priority | Topic |
|----------|-------|
| P0 | Rate limits (requests/minute, response headers) |
| P0 | Error codes & format (4xx/5xx shape) |
| P0 | `labels` field documented in field reference |
| P1 | Pagination (cursor/offset, response envelope) |
| P1 | Filtering & query params (`q=`, `label=`, sort) |
| P2 | Changelog / versioning policy |

---

### Surface R — Internal · ops runbooks
**Present (3):** `pwa-sw-cache.md` · `ses-setup.md` · `session-expiry-support.md`  
**Missing (8):**

| Priority | Topic | Why critical |
|----------|-------|-------------|
| P0 | Deploy & `db push` model | Schema drift crash-loop is a known footgun |
| P0 | Stripe & billing webhooks | Webhook failure = subscriptions not updating |
| P0 | Admin operations (impersonate, plan override, feature flags) | Needed for every support escalation |
| P0 | GDPR erasure handling | Legal/compliance obligation |
| P1 | Env / secrets | Onboarding any new operator |
| P1 | Sync engine operations (stuck sync, re-auth, manual trigger) | CardDAV + OAuth |
| P1 | Import/export job model (stuck jobs, re-trigger) | Data operations support |
| P2 | Incident response basics | |

---

### Surface E — Internal · engineering (docs/)
**Present (5):** `README.md` (index, partial) · `mobile-session-model.md` · `organizing-contacts.md` · `session-continuity.md` · `session-expiry-recovery.md`  
**Missing (7):**

| Priority | Topic |
|----------|-------|
| P0 | `sync-carddav-model.md` — sync engine, conflict resolution, `syncVersion`, app passwords, CardDAV URL structure |
| P0 | `billing-lifecycle.md` — entitlement model, `lifecycleState` enum, grace period, `canWrite` flags |
| P1 | `sharing-model.md` — three share types, `ContactShare` schema, live-share propagation |
| P1 | `family-teams-model.md` — `GroupAddressBook`, membership roles, change propagation |
| P1 | `import-export-pipeline.md` — CSV/vCard parse → field map → dedup → commit, job model |
| P1 | `notifications-model.md` — event types, digest scheduler, birthday/anniversary reminders, iCal feed |
| P2 | `auth-security-model.md` — session table, 2FA TOTP, step-up auth, rate limiting (may overlap with session docs) |

---

## Recommended P32 work order

Based on priority and dependencies:

1. **P32-02** — IA & index pages (half-day; unblocks everything else from being findable)
2. **P32-05** — Ops runbooks P0 first: deploy, Stripe, admin ops, GDPR erasure
3. **P32-03** — Help articles P0 first: contact CRUD, labels, smart lists/books, Google/Outlook sync, GDPR, notifications, public card
4. **P32-06** — Engineering concept docs P0: sync-carddav-model, billing-lifecycle
5. **P32-04** — Developer docs gaps: rate limits, error codes, labels field, pagination
6. Remaining P32-05 (P1 runbooks) + P32-06 (P1 concept docs) + P32-03 (P1 Help articles)
7. **P32-07** — Maintenance enforcement (PR checklist, CI reminder)

Total gap count: **14 Help articles · 6 developer doc gaps · 8 runbooks · 7 concept docs = 35 discrete items**

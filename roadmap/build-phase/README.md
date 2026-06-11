# Kontax Build Roadmap

## Summary
Kontax is a consumer-first SaaS contacts hub. Users store contacts in one canonical place, sync them to any device or platform, share individual contacts with anyone, and collaborate on shared address books with family or their team — all with a full audit trail and fine-grained control over what goes where.

This roadmap is the implementation source of truth for phases 1–16. Each phase file contains detailed tickets, dependencies, implementation notes, acceptance criteria, and progress tracking. Individual ticket files provide additional implementation depth for each ticket.

> **Build-order note:** phase numbers are not strict build order. **Phase 16 (Contacts List Rebuild) is built before Phases 10–15** because it is the shell those phases extend. See the dependency map.

## Goals
- Ship a trustworthy personal contacts product with strong foundations for future SaaS growth.
- Design the data model to support imports, exports, duplicate handling, subscriptions, and sync from the start.
- Treat security, auditability, and data portability as first-class product pillars.
- Expose Kontax as a CardDAV server so any device (iPhone, Android, macOS) can add it as a native contacts account.
- Enable contact sharing between users: vCard links for anyone, static or live sharing between Kontax accounts.
- Support Family and Teams plans with shared address books, change propagation, and role-based access.
- Give Pro and higher users a full activity log and audit trail for every contact mutation.
- Define a clear four-tier plan structure (Free, Pro, Family, Teams) with unambiguous entitlement gates.

## Non-Goals
- Enterprise SSO, SCIM provisioning, or compliance certifications in the first release.
- Real-time simultaneous co-editing of the same contact (last-write-wins with conflict logging is the v1 model).
- CRM automation, sales pipeline, or deal-tracking features.
- Native mobile apps — the web app and native device sync via CardDAV are the delivery mechanism.
- Google Contacts or Outlook OAuth connectors in the first sync phase — CardDAV covers iCloud, Nextcloud, and Fastmail. OAuth connectors are a later addition.

## Ticket Status Definitions
- `Not Started`: No implementation work has begun.
- `In Progress`: Active implementation or validation is underway.
- `Blocked`: Work cannot continue due to a dependency or unresolved decision.
- `Done`: Acceptance criteria are satisfied and the phase artifact is complete.

## Master Progress Tracker

### Phases 1–8 (Complete)

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P1-01 | 1 | Done | P0 | None | Unassigned | Canonical consumer SaaS schema drafted |
| P1-02 | 1 | Done | P0 | P1-01 | Unassigned | Contact normalization and indexes documented |
| P1-03 | 1 | Done | P0 | P1-01 | Unassigned | Auth/session and password policy defined |
| P1-04 | 1 | Done | P0 | P1-03 | Unassigned | Encryption baseline and audit requirements captured |
| P1-05 | 1 | Done | P1 | P1-01 | Unassigned | Consumer v1 scope and boundaries locked |
| P1-06 | 1 | Done | P1 | P1-02, P1-03 | Unassigned | Dashboard and CRUD milestone defined |
| P2-01 | 2 | Done | P0 | P1-01 | Unassigned | Subscription customer model drafted |
| P2-02 | 2 | Done | P0 | P2-01 | Unassigned | Plan and entitlement rules defined |
| P2-03 | 2 | Done | P1 | P2-01 | Unassigned | Billing provider integration boundary chosen |
| P2-04 | 2 | Done | P1 | P1-04, P2-01 | Unassigned | Billing lifecycle audit events defined |
| P2-05 | 2 | Done | P1 | P2-02 | Unassigned | Account lifecycle states and enforcement documented |
| P2-06 | 2 | Done | P2 | P2-05 | Unassigned | Retention, cleanup, and quota jobs planned |
| P3-01 | 3 | Done | P0 | P1-02 | Unassigned | Supported formats and multi-column field mapping finalized |
| P3-02 | 3 | Done | P0 | P3-01 | Unassigned | Import pipeline and preview/commit stages documented |
| P3-03 | 3 | Done | P0 | P3-01 | Unassigned | Export pipeline stages documented |
| P3-04 | 3 | Done | P1 | P3-02, P3-03 | Unassigned | Import/export job model and history metadata defined |
| P3-05 | 3 | Done | P1 | P3-02 | Unassigned | Validation, duplicate blocking, and conflict rules defined |
| P3-06 | 3 | Done | P2 | P3-02, P3-03 | Unassigned | UX preview, rollback, and history model specified |
| P4-01 | 4 | Done | P0 | P3-02, P3-05 | Unassigned | Duplicate heuristics and confidence tiers defined |
| P4-02 | 4 | Done | P0 | P4-01 | Unassigned | Merge suggestion lifecycle, statuses, and decisions set |
| P4-03 | 4 | Done | P1 | P4-02 | Unassigned | Suggested review and manual pairwise merge flows specified |
| P4-04 | 4 | Done | P1 | P4-03 | Unassigned | Advanced merge preview and field protection rules defined |
| P4-05 | 4 | Done | P1 | P4-03, P1-04 | Unassigned | Merge audit, undo, and reversibility rules documented |
| P4-06 | 4 | Done | P2 | P4-01, P4-04 | Unassigned | Edge-case merge scenarios and review-first guards covered |
| P5-01 | 5 | Done | P0 | P1-02, P3-01 | Unassigned | CardDAV-ready sync account, link, and job model defined |
| P5-02 | 5 | Done | P0 | P5-01 | Unassigned | Sync scope, two-way target, and bootstrap fallback strategy locked |
| P5-03 | 5 | Done | P1 | P5-01, P1-04 | Unassigned | Sync credential protection, rotation metadata, and job orchestration documented |
| P5-04 | 5 | Done | P1 | P5-02, P4-05 | Unassigned | Conflict model, tombstones, merge lineage, and versioning rules defined |
| P5-05 | 5 | Done | P2 | P5-02 | Unassigned | iPhone and Android compatibility assumptions and limitations captured |
| P5-06 | 5 | Done | P2 | P5-03, P5-04 | Unassigned | Beta rollout, support tooling, and recovery plan documented |
| P6-01 | 6 | Done | P0 | P1-01, P3-01 | Unassigned | Rich person/profile fields and labels planned |
| P6-02 | 6 | Done | P0 | P6-01 | Unassigned | Structured multi-value email, phone, and address model defined |
| P6-03 | 6 | Done | P1 | P6-01, P4-04 | Unassigned | Dates, websites, related people, and custom fields planned |
| P6-04 | 6 | Done | P1 | P6-02, P5-01 | Unassigned | Rich-field schema, merge, and sync treatment documented |
| P6-05 | 6 | Done | P2 | P6-02, P3-03 | Unassigned | Rich contact editing and portability UX expectations defined |
| P6-06 | 6 | Done | P2 | P6-03, P5-05 | Unassigned | Mobile parity and compatibility expectations documented |
| P7-01 | 7 | Done | P0 | P5-01, P5-03 | Unassigned | CardDAV account connection and discovery flow works end-to-end |
| P7-02 | 7 | Done | P0 | P7-01, P6-04 | Unassigned | Encrypted credential persistence and account validation are production-safe |
| P7-03 | 7 | Done | P0 | P7-02, P5-04 | Unassigned | First one-way CardDAV import sync completes with stable link mapping |
| P7-04 | 7 | Done | P1 | P7-03, P6-05 | Unassigned | Sync status, retry, recovery UX, and contact-level sync visibility are usable from the app |
| P7-05 | 7 | Done | P1 | P7-03, P5-06 | Unassigned | Failure handling, health telemetry, auto-pause rules, and support exports are in place |
| P7-06 | 7 | Done | P2 | P7-02, P7-05 | Unassigned | Private beta checklist, provider scope, rollback rules, and validation scenarios are documented |
| P8-01 | 8 | Done | P0 | P1-06, P3-06, P4-06 | Unassigned | Contacts homepage is rebuilt as the primary list-first workspace |
| P8-01a | 8 | Done | P0 | P8-01 | Unassigned | Header, tabs, and settings architecture are reset cleanly |
| P8-01b | 8 | Done | P0 | P8-01a | Unassigned | Quick-add is removed and create-contact flow is route-based |
| P8-01c | 8 | Done | P1 | P8-01 | Unassigned | Favorites are real workspace behavior, not placeholder UI |
| P8-02 | 8 | Done | P1 | P8-01 | Unassigned | Contact detail page matches the denser homepage direction |
| P8-03 | 8 | Done | P1 | P8-02 | Unassigned | Richer contact fields are visible, editable, sortable, searchable, and portable in product flows |
| P8-03a | 8 | Done | P1 | P8-03 | Unassigned | Create flow supports richer identity and structured methods |
| P8-03b | 8 | Done | P1 | P8-03a | Unassigned | Edit/detail flow reaches parity for richer identity fields |
| P8-03c | 8 | Done | P1 | P8-03b | Unassigned | Pinyin auto-fill settings and visibility work cleanly |
| P8-03d | 8 | Done | P1 | P8-03c | Unassigned | Contact list sorting respects stored Pinyin readings |
| P8-03e | 8 | Done | P1 | P8-03d | Unassigned | Main list signals richer field coverage without added noise |
| P8-03f | 8 | Done | P1 | P8-03e | Unassigned | Import/export preserves richer identity and Pinyin fields |

### Phase 9 — Kontax as a CardDAV Server

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P9-01 | 9 | Done | P0 | P1-01 | Unassigned | URL structure, subdomain decision, and endpoint-to-schema mapping documented |
| P9-02 | 9 | Done | P0 | P9-01 | Unassigned | AppPassword model migrated; create, list, revoke work in UI |
| P9-03 | 9 | Done | P0 | P9-01 | Unassigned | Discovery endpoints pass iOS account setup wizard without error |
| P9-03a | 9 | Done | P0 | P9-03 | Unassigned | DAV auth, XML helpers, CTag, well-known, principal and address-book PROPFIND routes implemented |
| P9-03b | 9 | Done | P0 | P9-03a | Unassigned | 404 propstat, Depth:infinity → 403, smoke test passed |
| P9-03c | 9 | Done | P0 | P9-03b | Unassigned | x-forwarded-proto/host respected; well-known redirect returns HTTPS URL |
| P9-04 | 9 | Done | P0 | P9-02, P9-03 | Unassigned | REPORT/GET/PUT/DELETE + ETag/If-Match in server.mjs; 45/45 smoke test passed (real-device test in P9-07) |
| P9-05 | 9 | Done | P1 | P9-04 | Unassigned | Connect-a-device settings UI: server URL/username copy, show-once app passwords, revoke confirm, connection guides (device walkthrough in P9-07) |
| P9-06 | 9 | Done | P1 | P9-04 | Unassigned | Design brief exists; device-connections UI already shipped in P9-05 |
| P9-07 | 9 | Not Started | P1 | P9-05, P9-06 | Unassigned | Bidirectional sync verified on iOS, macOS Contacts, and DAVx⁵ |
| P9-08 | 9 | Done | P2 | P9-04 | Unassigned | Device-write conflicts logged (VERSION_MISMATCH/DELETE_CONFLICT, INBOUND_DEVICE) on stale If-Match; last-write-wins; smoke-tested |

### Phase 10 — Enhanced Merge, Activity Changelog, Source Tracking

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P10-01 | 10 | Done | P0 | P1-01, P4-01 | Unassigned | ActivityEvent model + EventType/Actor enums + indexes pushed; Zod payload schemas + append-only emitEvent helper |
| P10-02 | 10 | Done | P0 | P10-01 | Unassigned | CRUD/merge/import/sync paths emit events via emitEvent + computeContactDiff (SYNC_PUSHED + share deferred — no path yet) |
| P10-03 | 10 | Done | P0 | P10-01 | Unassigned | SourceType enum + source/lastMutatedBy fields; set on create + every mutation; formatSourceBadge; backfill run |
| P10-04 | 10 | Done | P1 | P10-02, P10-03 | Unassigned | Source badge + last-updated line + History feed (load-more, expandable diffs) on contact detail; /api/contacts/[id]/history |
| P10-05 | 10 | Done | P1 | P10-01 | Unassigned | Field-level merge review (survivor pick, auto-collapse identical, per-field winner, multi-value keep-both union, gated submit) + bulk accept + Merged-contacts section + 30-day undo |
| P10-06 | 10 | Done | P1 | P10-04, P10-05 | Unassigned | Activity tab + global feed (/api/activity), cursor pagination, category/actor filters, 90-day retention, Pro gate (route 403 + ActivityLocked) |
| P10-07 | 10 | Done | P2 | P10-06 | Unassigned | Brief 10-activity-log-and-source.md: source badge, last-edited line, history tab, global feed (+Pro lock), bulk-merge dialog, merged-contacts/undo, unified icon set, all states |
| P10-08 | 10 | Done | P2 | P10-06 | Unassigned | New signals (normalized phone, name+company proximity, phonetic name, email-domain), LOW tier, per-signal "why" panel, STALE auto-regeneration |

### Phase 11 — Plan Redesign: Free, Pro, Family, Teams

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P11-01 | 11 | Done | P0 | P2-02 | Unassigned | Feature matrix frozen: 4 tiers, entitlement mapping, sharing/downgrade rules; decisions resolved (6/25 members, PRO=5 app pwds, PLUS removal, MergeDecision undo) |
| P11-02 | 11 | Done | P0 | P11-01 | Unassigned | Enum → FREE/PRO/FAMILY/TEAMS, 8 new entitlement fields, Group/GroupMember/GroupAddressBook scaffolding; billing.ts + app-passwords.ts updated; db pushed |
| P11-03 | 11 | Done | P0 | P11-01 | Unassigned | Tier-driven entitlements (matrix), null=unlimited, activity gate→all paid + per-tier retention, Free history cap 10, sharing/book gate stubs, graceful downgrade |
| P11-04 | 11 | Done | P1 | P11-02, P11-03 | Unassigned | Brief 11-pricing-and-upgrade.md: 4-tier pricing page, contextual upgrade prompts (matrix gates), comparison modal, family invite overview, downgrade warning |
| P11-05 | 11 | Done | P1 | P11-01, P10-01 | Unassigned | scripts/prune-activity-retention.mjs (per-user, idempotent, --dry-run): Pro 90d/Family 365d pruned, Free+Teams skipped; run nightly via scheduler |
| P11-06 | 11 | Done | P2 | P11-05 | Unassigned | Settings plan section: tier name + feature summary, live usage bars (contacts/imports/sync/devices), /pricing link, group membership + coming-soon placeholder |

### Phase 12 — Contact Sharing

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P12-01 | 12 | Done | P0 | P11-02 | Unassigned | ContactShare schema (enums + model + snapshot) migrated; all share types representable |
| P12-02 | 12 | Done | P0 | P12-01 | Unassigned | vCard share link: token + /share/[token] serves .vcf (410 revoked/404 expired), Free 7d expiry, revoke + download count |
| P12-03 | 12 | Done | P1 | P12-01, P11-03 | Unassigned | Static Kontax→Kontax share (Pro+): snapshot, /shares accept/decline → independent SHARED_STATIC copy (email invite deferred to P12-06) |
| P12-04 | 12 | Done | P1 | P12-01, P11-03, P10-01 | Unassigned | Live Kontax→Kontax share (Pro+ both parties): linked SHARED_LIVE copy, mutation-triggered propagation (keeps recipient notes), Free fallback/downgrade→static, revoke/unlink |
| P12-05 | 12 | Done | P1 | P12-03, P12-04 | Unassigned | Sharing tab manages all shares (vCard/static/live): status, last-synced, revoke; plan-gated; "Shared with me" badge in sidebars |
| P12-06 | 12 | Done | P1 | P12-03 | Unassigned | Header/sidebar badges, /shares accept(→navigate)/decline, invite-to-register linking, AWS SES email (graceful no-op if unconfigured) |
| P12-07 | 12 | Done | P2 | P12-05, P12-06 | Unassigned | Brief 12-sharing-ui.md: owner Sharing tab + recipient /shares/badges/Live-from panel, plan gates, empty states, live-vs-sync badge distinction |
| P12-08 | 12 | Done | P2 | P12-07 | Unassigned | Live propagation after-commit + isolated per-recipient; wired to update/restore/merge (survivor inherits shares); lastError state + lock/retry; UI status |

### Phase 13 — Family Plan: Shared Contact Books

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P13-01 | 13 | Not Started | P0 | P11-02 | Unassigned | Group and GroupContact schema migrated; ownership model documented |
| P13-02 | 13 | Not Started | P0 | P13-01 | Unassigned | Invite flow works end-to-end; accepted members see shared book |
| P13-03 | 13 | Not Started | P0 | P13-01, P10-01, P10-02 | Unassigned | Edit and view-only permissions enforced; attribution correct on every mutation |
| P13-04 | 13 | Not Started | P1 | P13-02, P13-03, P10-01 | Unassigned | Changes visible to all members within 30 seconds or on next load |
| P13-05 | 13 | Not Started | P1 | P13-04 | Unassigned | Shared contacts clearly distinguished from private in workspace; filter works |
| P13-06 | 13 | Not Started | P1 | P13-04 | Unassigned | Admin can invite, remove, change permissions, transfer ownership, and delete group |
| P13-07 | 13 | Not Started | P1 | P13-05, P13-06 | Unassigned | Design brief covers all family plan surfaces from owner and member perspectives |
| P13-08 | 13 | Not Started | P2 | P13-07, P9-04 | Unassigned | Family book appears as separate CardDAV collection; device writes attributed correctly |

### Phase 14 — Teams Plan: Shared Contact Books for Organisations

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P14-01 | 14 | Not Started | P0 | P13-01 | Unassigned | Per-book permissions, multi-book schema, and team sync account model migrated |
| P14-02 | 14 | Not Started | P0 | P14-01 | Unassigned | Team creation, invite, and role management work end-to-end |
| P14-03 | 14 | Not Started | P0 | P14-01 | Unassigned | Multiple address books supported; per-book permissions enforced |
| P14-04 | 14 | Not Started | P1 | P14-02, P14-03, P10-01, P10-02 | Unassigned | Permission checks enforced on all mutations; attribution correct |
| P14-05 | 14 | Not Started | P1 | P14-04, P10-01 | Unassigned | Audit log shows all mutations; CSV export works; non-admins cannot access |
| P14-06 | 14 | Not Started | P1 | P14-04, P5-01, P7-03 | Unassigned | Team-level CardDAV sync accounts operate on team books and appear in audit log |
| P14-07 | 14 | Not Started | P1 | P14-05, P14-06 | Unassigned | Team contacts clearly distinguished from private; management page navigable |
| P14-08 | 14 | Not Started | P2 | P14-07 | Unassigned | Design brief covers all Teams surfaces with admin and member perspectives |
| P14-09 | 14 | Not Started | P2 | P14-07, P9-04 | Unassigned | Team books appear as named CardDAV collections; device writes attributed correctly |

### Phase 15 — Row Context Icons and Contact Designations

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P15-01 | 15 | Not Started | P1 | P8-01c | Unassigned | Shared ContactBadgeCluster renders all row icons; capped at 2–3 + overflow; one registry; a11y + tooltips |
| P15-02 | 15 | Not Started | P1 | P15-01 | Unassigned | isEmergency flag; toggle in create/edit + detail; emergency badge + filter |
| P15-03 | 15 | Not Started | P2 | P15-01, P10-01 | Unassigned | Family-shared status section on contact detail with member access + last-edited-by |
| P15-04 | 15 | Not Started | P2 | P15-01 | Unassigned | Designation filters + membership groupings wired to the badge registry |

### Phase 16 — Contacts List Rebuild (Sidebar Shell + Column Rows) — build before 10–15

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P16-01 | 16 | Done | P0 | P8-01 | Unassigned | Sidebar shell + header; nav/sub-filters drive URL params; stable counts |
| P16-02 | 16 | Done | P0 | P16-01 | Unassigned | Column rows, sticky head, Compact default, grouping + favorites pin rules |
| P16-03 | 16 | Done | P0 | P16-02 | Unassigned | Inline RowBadges cluster (delivers P15-01); trailing star removed |
| P16-04 | 16 | Done | P1 | P16-02 | Unassigned | Bulk select via hover checkbox + contextual bar; bulk actions preserved |
| P16-05 | 16 | Done | P1 | P16-02 | Unassigned | Search/empty/no-match + plan/lifecycle/sync banners in new shell |
| P16-06 | 16 | Done | P1 | P16-02 | Unassigned | Duplicates pair cards + Archived restore/delete in new shell |
| P16-07 | 16 | Done | P1 | P16-02 | Unassigned | Mobile cozy fallback + bottom nav; tablet drops Company column |

### Phase 18 — Account Settings & Auth Hardening

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P18-DB01 | 18 | Not Started | P1 | — | Unassigned | Design brief covers all 9 surface groups with all interactive states |
| P18-10 | 18 | Not Started | P0 | — | Unassigned | Middleware, rate limiting utility, JWT maxAge, CRON_SECRET guard, .env.example updated |
| P18-01 | 18 | Not Started | P0 | P18-DB01 | Unassigned | Name + avatar editable from settings; header reflects change without re-login |
| P18-02 | 18 | Not Started | P0 | P18-10 | Unassigned | Password change verified against current; sessionVersion incremented; all other sessions invalidated |
| P18-03 | 18 | Not Started | P0 | P18-04 | Unassigned | Email change held pending until new address verified via token; old address notified |
| P18-04 | 18 | Not Started | P0 | P18-10 | Unassigned | Email verification token sent on signup; /verify-email flow marks emailVerified; register route updated |
| P18-05 | 18 | Not Started | P0 | P18-04, P18-10 | Unassigned | Forgot-password flow sends 15-minute reset link; new password invalidates all sessions |
| P18-06 | 18 | Not Started | P1 | P18-02 | Unassigned | Active sessions listed with device/IP; individual and bulk revocation work; JWT maxAge configured |
| P18-07 | 18 | Not Started | P1 | P18-02, P18-04, P18-10 | Unassigned | TOTP enrolment, challenge step, recovery codes, and disable all work end-to-end |
| P18-08 | TBD | Deferred | P2 | P18-03 | Unassigned | Google and Apple Sign-In link to existing accounts by email; unlink guards last auth method |
| P18-09 | 18 | Not Started | P1 | P18-10 | Unassigned | Account deleted in 30-day grace period; cascade clean; live shares converted; Stripe stub called |
| P18-11 | 18 | Not Started | P0 | — | Unassigned | AddressBook model + Contact.bookId; default book per user; CardDAV slug-based URLs; book-scoped CTag |

### Phase 17 — Contact Detail & Create Rebuild (locked 02 / 03) — P17-02 before Phase 12 P12-05

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P17-01 | 17 | Done | P1 | P8, brief 03 | Unassigned | `/contacts/new` rebuilt to brief 03 (flat icon-column form, person/org, show-more, sticky bar, locked palette); create flow intact |
| P17-02 | 17 | Done | P0 | P10, brief 02; **blocks P12-05** | Unassigned | `/contacts/[id]` rebuilt to locked 02 (master-detail shell, left rail, Details·Sharing·History tabs, inline edit, archive-first header); Sharing tab a gated placeholder |

> **Build-order note:** P17-02 (detail rebuild) is sequenced **before Phase 12's P12-05** (share-management-UI-on-detail) for the same reason Phase 16 precedes 10–15 — P12-05 layers the Sharing tab onto the detail. P17-01 (create) is dependency-free; build anytime.

## Dependency Map

**Phases 1–8 (foundation)**
- Phase 1 defines the contact model, security baseline, and consumer scope.
- Phase 2 depends on Phase 1 because billing must align with account ownership and audit requirements.
- Phase 3 depends on Phase 1 because import/export requires a stable contact schema and normalization rules.
- Phase 4 depends on Phase 3 because merge quality relies on normalized imported data and source metadata.
- Phase 5 depends on Phases 1, 3, and 4 because sync requires stable identifiers, import-compatible mappings, and deterministic conflict/merge behavior.
- Phase 6 depends on Phases 1, 3, 4, and 5 because richer contact detail needs a stable schema base, portability rules, and sync compatibility expectations.
- Phase 7 depends on Phases 5 and 6 because real CardDAV implementation needs stable sync models, credential handling, and rich-field portability.
- Phase 8 depends on Phases 1, 3, 4, 6, and 7 because the workspace redesign builds on the stable contact model, portability rules, merge behavior, and sync-facing identity expectations.

**Phases 9–14 (hub, sharing, collaboration)**
- Phase 9 depends on Phase 1 (schema) and Phase 7 (CardDAV client experience as reference). It introduces Kontax as a CardDAV server — independent of sharing and groups.
- Phase 10 depends on Phases 1 and 4. ActivityEvent and source tracking must exist before sharing and group features can attribute changes meaningfully.
- Phase 11 depends on Phase 2. It restructures the plan model in place, updating entitlements for Free/Pro/Family/Teams before any sharing feature ships.
- Phase 12 depends on Phase 11 (entitlement gates) and Phase 10 (ActivityEvent for share attribution). vCard links are free; account sharing is Pro+.
- Phase 13 depends on Phase 11 (Group scaffolding schema and Family plan entitlements) and Phase 10 (activity attribution for family book changes).
- Phase 14 depends on Phase 13 (reuses Group/GroupContact schema and change propagation infrastructure) and Phase 5/7 (team-level CardDAV sync accounts).

**Phase 15 (row context icons & designations)**
- Phase 15 depends on Phase 8 (favorites, the first designation, and the workspace shell). It provides the shared `ContactBadgeCluster` that the Family (Phase 13), Team (Phase 14), and Live-share (Phase 12) badges render through, plus the net-new emergency-contact designation. P15-03 (family-shared detail status) additionally depends on Phase 13 (shared book) and Phase 10 (activity attribution). Sequence the cross-phase badges to adopt the shared component as each of those phases lands.
- **P15-01 (`ContactBadgeCluster`) is delivered by Phase 16's P16-03** — the inline `RowBadges` cluster is the same component. Phase 15's remaining tickets (P15-02 emergency flag, P15-03 family-shared detail, P15-04 filters) build on it afterwards.

**Phase 16 (contacts list rebuild) — BUILD ORDER: before 10–15**
- Phase 16 depends only on Phase 8 (the contact model + workspace it replaces) and the approved design (`01-contacts-list.md` + the production mock). It is sequenced **before Phases 10–15** because the contacts list is the surface those phases extend: Phase 10's activity tab, Phase 12's share/live badges, Phase 13's family sidebar section + badge, Phase 14's team books, and Phase 15's row icon cluster all layer onto this shell. Building them onto the old Phase-8 workspace and then replacing it would duplicate the integration work.

## Cross-Phase Validation Scenarios
- A new account can sign up, authenticate, and save contacts without schema redesign between phases.
- Imported CSV and vCard records retain enough metadata to drive duplicate suggestions and future sync mappings.
- Exported contacts remain structurally sound after merges and preserve the canonical contact record.
- Subscription and plan checks can gate premium features without impacting access to already-owned contacts.
- Security controls clearly differentiate password protection, app secret handling, backups, sync credentials, and audit records.
- CardDAV planning does not assume unsupported field semantics from earlier import/export phases.
- A real CardDAV account can connect, import safely, surface errors clearly, and avoid corrupting local contacts during first-sync rollout.
- A supported beta provider can complete connection, bootstrap import, linked-contact visibility, and support-export recovery without implying live two-way writes.
- A user who adds Kontax as a CardDAV account on their iPhone sees their contacts appear natively without opening the Kontax web app.
- A vCard share link generates, opens correctly on iOS, and saves the contact to the phone without the recipient needing a Kontax account.
- A live-shared contact updated by the owner appears updated in the recipient's account within 30 seconds.
- A family member editing a shared contact sees the change reflected for all other family members without manual sync.
- A team admin can see who changed a shared team contact and when, in the audit log, with field-level diff.
- Downgrading a plan does not silently destroy data — grace periods, warnings, and export options are available before any contacts or history are pruned.

## Implementation Notes
- Use the phase files as the detailed work queue. Use individual ticket files (p9-01-*.md etc.) for implementation depth.
- Update the master tracker and per-phase trackers together when a ticket moves.
- When a ticket becomes blocked, document the reason in the ticket section and in the tracker status.
- Design briefs (P9-06, P10-07, P11-04, P12-07, P13-07, P14-08, P18-DB01) must be completed before implementation of the UI tickets they inform.
- **`lifecycle-policies.md`** is the canonical reference for all account lifecycle decisions (group dissolution, payment failure, downgrade data fate, member join/leave). Phases 13, 14, 18, 19, and 22 must comply with it. Read it before implementing any subscription, group, or account-state change.

### Phase 19 — Stripe Billing (Sandbox → Production)

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P19-DB02 | 19 | Not Started | P1 | — | Unassigned | Design brief covers all billing settings states, banners, and downgrade modal |
| P19-01 | 19 | Not Started | P0 | P11-02 | Unassigned | StripeWebhookEvent model migrated; price ID map and Stripe client singleton working |
| P19-02 | 19 | Not Started | P0 | P19-01 | Unassigned | createCheckoutSession returns valid URL; upgrade CTA redirects to Stripe Checkout |
| P19-03 | 19 | Not Started | P0 | P19-02 | Unassigned | Webhook endpoint verifies signatures, routes all 7 event types, deduplicates via StripeWebhookEvent |
| P19-04 | 19 | Not Started | P0 | P19-03 | Unassigned | Subscription and lifecycleState sync correctly on all webhook events; downgrade side-effects applied |
| P19-05 | 19 | Not Started | P1 | P19-04 | Unassigned | createPortalSession returns valid portal URL; Manage billing button works in settings |
| P19-06 | 19 | Not Started | P1 | P19-04 | Unassigned | Grace period banner appears on payment failure; red variant at < 24h; disappears on recovery |
| P19-07 | 19 | Not Started | P1 | P19-05 | Unassigned | Downgrade confirmation modal shows accurate affected-features list before routing to portal |
| P19-08 | 19 | Not Started | P1 | P19-04 | Unassigned | Pricing page CTAs wired to checkout; current plan highlighted; monthly/annual toggle works |
| P19-09 | 19 | Not Started | P2 | P19-02 | Unassigned | 14-day trial on first Pro upgrade; TRIALING status shown in settings; trial_will_end logged |

### Phase 20 — Transactional Email (SES + React Email)

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P20-DB03 | 20 | Not Started | P1 | — | Unassigned | Design brief covers layout, palette, typography, CTA button, and all template variants |
| P20-01 | 20 | Not Started | P0 | — | Unassigned | SES domain verified; DKIM/SPF/DMARC records in DNS; IAM user created; env vars in .env.example; SNS topic configured; startup check works |
| P20-02 | 20 | Not Started | P0 | P20-01 | Unassigned | sendEmail sends via SES when configured; console fallback in dev; never throws; suppression stub in place |
| P20-03 | 20 | Not Started | P0 | P20-02 | Unassigned | EmailLayout, EmailButton, renderEmail; email:preview script runs and shows templates; brand tokens defined |
| P20-04 | 20 | Not Started | P0 | P20-03, P18-04 | Unassigned | sendVerificationEmail sends real email via SES; SIGNUP (72h) and EMAIL_CHANGE (24h) variants correct |
| P20-05 | 20 | Not Started | P0 | P20-03, P18-05 | Unassigned | requestPasswordReset sends real email; 15-min expiry stated in body; reset URL links correctly |
| P20-06 | 20 | Not Started | P1 | P20-03, P12-06 | Unassigned | Existing-user and new-user share invite variants send correctly; live share note included; send failure never throws |
| P20-07 | 20 | Not Started | P1 | P20-03 | Unassigned | sendSuspiciousActivityEmail callable; security alert label, device/IP block, and CTA render; cannot be suppressed |
| P20-08 | 20 | Not Started | P1 | P20-03, P19-03, P18-09 | Unassigned | All 5 billing/admin templates render; Phase 19 stubs wired; sendAccountSuspendedEmail callable by P21-05 |
| P20-09 | 20 | Not Started | P2 | P20-03, P22-01 | Unassigned | NotificationDigestTemplate renders grouped items by category; empty digest shows "nothing to report" |
| P20-10 | 20 | Not Started | P1 | P20-01, P20-02 | Unassigned | SNS endpoint confirms subscription; hard bounces set BOUNCED; complaints set COMPLAINED; isEmailSuppressed real; settings banner shown |

### Phase 21 — Internal Admin Tooling

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P21-DB04 | 21 | Not Started | P1 | — | Unassigned | Design brief covers all admin surfaces, table states, confirmation dialogs, and impersonation banner |
| P21-01 | 21 | Not Started | P0 | P18-10 | Unassigned | UserRole enum; User.role; middleware redirects non-admins from /admin/**; assertAdmin() throws FORBIDDEN; admin layout shell renders |
| P21-02 | 21 | Not Started | P0 | P21-01 | Unassigned | AdminAuditEvent model; emitAdminEvent callable; /admin/audit table paginated and filterable; read-only |
| P21-03 | 21 | Not Started | P0 | P21-01, P21-02 | Unassigned | /admin/users search works by email and name; /admin/users/[id] shows all account, usage, session, and activity fields; USER_VIEWED emitted |
| P21-04 | 21 | Not Started | P1 | P21-02, P21-03 | Unassigned | overridePlan sets local subscription plan without touching Stripe; override badge visible in admin and user settings |
| P21-05 | 21 | Not Started | P0 | P21-02, P21-03, P18-09, P20-08 | Unassigned | suspendAccount sets LOCKED and invalidates sessions; unsuspendAccount restores ACTIVE; adminDeleteAccount schedules 30-day deletion; each requires reason; audit events emitted |
| P21-06 | 21 | Not Started | P1 | P21-01 | Unassigned | /admin/metrics shows live user counts, plan breakdown, DAU/MAU, import/sync error rates; warning indicator at >5% failure |
| P21-07 | 21 | Not Started | P2 | P21-01, P21-02 | Unassigned | Admin can impersonate non-admin user; all write actions return WRITE_BLOCKED; impersonation banner visible; end returns admin session; cannot impersonate admin |
| P21-08 | 21 | Not Started | P1 | P21-01, P21-02 | Unassigned | FeatureFlag model; isFeatureEnabled with per-user and rollout-percent modes; /admin/feature-flags CRUD; FEATURE_FLAG_CHANGED emitted |

### Phase 22 — In-App Notifications & Security Alerts

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P22-01 | 22 | Not Started | P0 | — | Unassigned | NotificationPreference and UserNotification models; defaults seeded on register; createNotification respects prefs; SECURITY always fires |
| P22-02 | 22 | Not Started | P0 | P22-01 | Unassigned | Bell in header; unread badge; dropdown with 20 items; mark read; dismiss; 30s poll updates count |
| P22-03 | 22 | Not Started | P1 | P22-01 | Unassigned | /settings/notifications shows all 6 categories with per-channel toggles; SECURITY and BILLING locked; changes persist immediately |
| P22-04 | 22 | Not Started | P0 | P22-01, P20-07, P18-06, P18-10 | Unassigned | Bulk delete rule fires once at 10+ deletes/60s; new device rule fires on unknown IP; failed login rule fires at 5+ attempts/1h; none block the triggering action |
| P22-05 | 22 | Not Started | P0 | P22-01, P22-04, P22-07 | Unassigned | Security alert banner on contacts page; "That was me" marks read; "Wasn't me" routes to lockdown; multi-alert count/navigation works |
| P22-06 | 22 | Not Started | P0 | P18-02, P18-05, P22-01 | Unassigned | lockdownAccount increments sessionVersion; revokes all UserSession rows; sends password reset email; redirects to /login?message=secured; idempotent |
| P22-07 | 22 | Not Started | P1 | P22-01, P22-04 | Unassigned | Anomaly drawer shows notification body, related activity events, and device/IP; dismiss and secure actions work; deep-link via /settings/security?alert={id} |
| P22-08 | 22 | Not Started | P2 | P22-01, P20-09 | Unassigned | Digest scheduler runs per user cadence preference (daily/weekly); assembles notifications from time window; sends via P20-09 template; empty digests skipped |
| P22-DB05 | 22 | Not Started | P1 | P22-02, P22-05 | Unassigned | Design brief covers bell badge, dropdown row anatomy and category icon tiles, preference settings panel (locked categories, digest section), security alert banner (single and multi-alert), and anomaly drawer (event list and device/IP variants) |
| P22-09 | 22 | Not Started | P1 | P22-01, P10-01 | Unassigned | BirthdayReminderState dedup model; runBirthdayReminders scans birthday and significantDates; RRULE-annual logic; one notification per year per contact/date; daily CRON at 07:00 UTC |
| P22-10 | 22 | Not Started | P2 | P22-09 | Unassigned | User.reminderLeadDays default 7; Contact.reminderLeadDaysOverride nullable; settings dropdown (1d/3d/7d/14d/30d); contact edit form "Reminder" field; CRON reads override then user default |
| P22-11 | 22 | Not Started | P1 | P22-09 | Unassigned | User.calToken unique; /api/calendar/birthdays.ics returns valid iCal with RRULE:FREQ=YEARLY all-day VEVENTs; invalid token returns 401; settings panel with copy URL and regenerate; /help#calendar-feed FAQ |

### Phase 23 — Sync Connections Advanced Settings

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P23-DB12 | 23 | Not Started | P1 | P23-02, P23-05 | Unassigned | Design brief covers gear icon placement, settings zone collapsed/expanded states, direction radio with export-only warning, book allowlist (sync-all vs custom), conflict queue resolver rows, and re-auth modal |
| P23-01 | 23 | Not Started | P0 | P5-01 | Unassigned | SyncAccountSettings model with SyncDirection/ConflictPolicy enums; seed defaults for all existing SyncAccount rows; sync engine reads settings before each job |
| P23-02 | 23 | Not Started | P0 | P23-01, P9-05 | Unassigned | Gear icon on connection cards; settings section in detail panel with direction, conflict policy, and frequency controls; save calls updateSyncAccountSettings |
| P23-03 | 23 | Not Started | P1 | P23-02 | Unassigned | Book discovery endpoint caches results; allowlist checkboxes in settings section; narrowing allowlist queues re-scope job that archives (not deletes) excluded contacts |
| P23-04 | 23 | Not Started | P1 | P23-02 | Unassigned | IMPORT_ONLY skips push phase; EXPORT_ONLY skips pull phase; direction change triggers full re-sync; direction badge reflects stored value |
| P23-05 | 23 | Not Started | P2 | P23-02, P5-04 | Unassigned | SERVER_WINS and DEVICE_WINS auto-resolve; MANUAL creates OPEN conflict rows; conflict queue UI with side-by-side resolver; auto-pause at 50 open conflicts |
| P23-06 | 23 | Not Started | P1 | P23-02, P10-01 | Unassigned | Password re-auth required before saving sync settings; 15-minute elevation token; every settings change emits ActivityEvent |
| P23-07 | 23 | Not Started | P2 | P23-03, P9-04 | Unassigned | AddressBook.deviceWritable and sourceBookIds fields; read-only returns 403 on PUT/DELETE; sourceBookIds scopes CardDAV REPORT response |

### Phase 24 — Mobile Optimization & PWA

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P24-DB06 | 24 | Not Started | P0 | P24-01 | Unassigned | Design brief covers bottom nav, contact list swipe actions, detail mobile layout, form bottom sheet, PWA install prompt, and offline state |
| P24-01 | 24 | Not Started | P0 | P16-07 | Unassigned | All 12 primary flows tested on iOS Safari and Android Chrome; ranked findings doc (p24-01-audit-findings.md) with P0/P1/P2 severity; agreed before P24-02 begins |
| P24-02 | 24 | Not Started | P0 | P24-01, P24-DB06 | Unassigned | Bottom nav renders ≤ 767px with 4 tabs, active state, notification badges; 100dvh fixes; iOS safe area insets; compact top header on secondary screens |
| P24-03 | 24 | Not Started | P1 | P24-02 | Unassigned | 60px mobile rows; 44×44px star tap target; right-to-left swipe reveals Favourite and Archive; 40% snap threshold; haptic feedback; vertical scrolling unblocked |
| P24-04 | 24 | Not Started | P1 | P24-02 | Unassigned | Mobile detail: hero + sticky compact header + scrollable tab bar + field rows with tap-to-call; FAB above bottom nav; desktop layout unchanged |
| P24-05 | 24 | Not Started | P1 | P24-04 | Unassigned | Create/edit as full-screen bottom sheet; collapsible sections; keyboard-aware scroll with visualViewport; sticky save bar above keyboard; "Next" field advancement |
| P24-06 | 24 | Not Started | P2 | P24-05 | Unassigned | Mobile Step 1 has "Choose file" button; Step 2 table horizontally scrollable with sticky Name column; export shows download confirmation toast |
| P24-07 | 24 | Not Started | P2 | P24-03 | Unassigned | @tanstack/react-virtual for contact list; avatar lazy loading; content-visibility on off-screen sections; initial bundle < 200kb gzipped; 60fps scroll at 2,000 contacts |
| P24-08 | 24 | Not Started | P1 | P24-07 | Unassigned | manifest.json; service worker with NetworkFirst contacts cache; offline banner + read-only mode; background refresh on reconnect; PWA install prompt after 3rd session |

### Phase 25 — Import/Export Field Mapping & Suggestions

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P25-DB13 | 25 | Not Started | P1 | P25-02, P25-03 | Unassigned | Design brief covers 4-step indicator, mapping table row anatomy, confidence dots (3 tiers), suggestion chips (hover/click/overflow), "Create custom field" inline input, multi-value split toggle, "Save as preset" prompt, and preset auto-detection banner |
| P25-01 | 25 | Not Started | P0 | P3-02 | Unassigned | classifyColumn returns field + confidence + tier; HIGH/MEDIUM/LOW for standard headers from Google/Apple/Outlook; classification < 10ms; result included in parse API response |
| P25-02 | 25 | Not Started | P0 | P25-01 | Unassigned | 4-step indicator; mapping table with header, sample, dropdown, confidence dots; HIGH pre-filled; LOW highlighted red; Skip column option; duplicate-field validation |
| P25-03 | 25 | Not Started | P1 | P25-02 | Unassigned | "Did you mean X?" chips for LOW/MEDIUM confidence; up to 3 chips shown; Create custom field inline; feedback stored in ImportMappingSuggestionFeedback |
| P25-04 | 25 | Not Started | P1 | P25-02 | Unassigned | "Save as preset" prompt after successful import; header hash auto-detect matches on future upload; preset applied to skip mapping step; /settings/import-presets CRUD |
| P25-05 | 25 | Not Started | P2 | P25-02 | Unassigned | Multi-value detection for ; | \n delimiters on phone/email columns; split toggle defaults on; label inference for "Mobile: value" prefix format; cap at 10 split values |
| P25-06 | 25 | Not Started | P2 | P3-03 | Unassigned | "Choose fields" option on export card; grouped field checklist with header rename; export preset save/load; all-fields default preserves existing behaviour |

### Phase 26 — Public Surfaces & Onboarding

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P26-DB07 | 26 | Not Started | P1 | — | Unassigned | Design brief covers checklist card, 4 empty state variants, HelpTooltip, /help FAQ page structure, and Family/Teams upgrade 3-step flow |
| P26-01 | 26 | Not Started | P0 | — | Unassigned | Landing page matches 05-public-landing.md spec; logged-in users redirected to /contacts; FCP < 1.5s; scroll entrance animations respect prefers-reduced-motion |
| P26-02 | 26 | Not Started | P0 | P18-05, P18-07, P18-10 | Unassigned | Login page matches 04-login-register.md spec; credentials auth works; rate-limit error shown; 2FA routing works; forgot password linked |
| P26-03 | 26 | Not Started | P0 | P18-04, P18-10 | Unassigned | Register page with name field, strength meter, terms line; sends verification email; duplicate email shows log-in link; pendingShare param preserved |
| P26-04 | 26 | Not Started | P1 | P26-03, P26-DB07 | Unassigned | UserOnboardingState model; checklist card above contact list; 4 steps auto-complete; progress bar fills; dismiss persists; existing users backfilled as dismissed |
| P26-05 | 26 | Not Started | P1 | P26-04 | Unassigned | All 5 empty state variants (contacts, filtered, activity, sync, shared) render with correct icons, copy, and CTAs; Free plan gate state for activity |
| P26-06 | 26 | Not Started | P2 | P26-04, TBD (P18-08) | Unassigned | OAuth users get oauthProvider set; email pre-verified; checklist step 2 shows provider-specific import CTA; /import-export?source=google pre-selects Google profile |
| P26-07 | 26 | Not Started | P0 | P26-01 | Unassigned | All public routes have title, description, og:title, og:image, twitter:card; /login and /register have noindex; static OG image 1200×630px |
| P26-08 | 26 | Not Started | P0 | P26-01 | Unassigned | /sitemap.xml lists 5 public URLs with correct priority; /robots.txt allows public routes and disallows all app routes; Sitemap directive present |
| P26-09 | 26 | Not Started | P1 | P26-01 | Unassigned | Organization, WebSite, SoftwareApplication JSON-LD on /; BreadcrumbList on /pricing and /help; Google Rich Results Test passes |
| P26-10 | 26 | Not Started | P1 | P12-02 | Unassigned | /api/og/share/[token] returns branded 1200×630 PNG; /share/[token] og:image points to dynamic URL; only contact name shown; edge runtime |
| P26-11 | 26 | Not Started | P2 | P26-01 | Unassigned | @vercel/speed-insights installed; Lighthouse CI runs on public page changes; LCP < 2.5s and CLS < 0.1 asserted; targets documented |
| P26-12 | 26 | Not Started | P1 | P26-04 | Unassigned | /help page with 4 sections and anchor IDs; client-side search filters items; HelpTooltip component with dark popover; 4 initial placements on key settings fields |
| P26-13 | 26 | Not Started | P1 | P26-05, P26-12 | Unassigned | All 7 empty states have helpLink prop pointing to correct /help anchor; "Learn more" text in #8b938c 13px |
| P26-14 | 26 | Not Started | P1 | P26-04, P19-03 | Unassigned | Stripe webhook sets upgradedToFamilyAt; checkout success redirects to /onboarding/family; 3-step flow works; skip available; completion sets completedAt |

### Phase 27 — Google Contacts & Outlook OAuth Sync

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P27-DB08 | 27 | Not Started | P1 | P27-07 | Unassigned | Design brief covers OAuth tiles, connect/success/error return states, OAuth account list item, re-auth banner, disconnect modal, and 3 error state variants |
| P27-01 | 27 | Not Started | P0 | P5-01, TBD (P18-08) | Unassigned | GOOGLE enum value; OAuth connect/callback routes; SyncAccount created with encrypted tokens; full import with syncToken persistence; incremental sync uses syncToken; 410 falls back to full sync |
| P27-02 | 27 | Not Started | P0 | P27-01 | Unassigned | mapGooglePersonToContact maps all fields; null returned for metadata.deleted; labels normalised; SyncLink.remoteEtag stores Google etag |
| P27-03 | 27 | Not Started | P1 | P27-02, P5-04 | Unassigned | ETag comparison detects concurrent edits; SERVER_WINS/DEVICE_WINS auto-resolve; MANUAL creates OPEN conflict; Google 409 on push creates conflict; tombstones archived under SERVER_WINS |
| P27-04 | 27 | Not Started | P0 | P5-01 | Unassigned | MICROSOFT enum value; MSAL OAuth connect/callback routes; SyncAccount created with encrypted tokens; full import with delta link persistence; incremental sync uses deltaLink |
| P27-05 | 27 | Not Started | P0 | P27-04 | Unassigned | mapGraphContactToKontax maps all fields including categories and sensitivity; null for @removed; Outlook label types normalised; SyncLink.remoteEtag stores @odata.etag |
| P27-06 | 27 | Not Started | P1 | P27-05, P5-04 | Unassigned | Same conflict model as P27-03 using @odata.etag; 412 Precondition Failed on PATCH creates conflict; tombstones handled per policy |
| P27-07 | 27 | Not Started | P1 | P27-01, P27-04, P9-05 | Unassigned | OAuth tiles in Add account form; provider icon + email in list item; OAuth section in detail panel; re-auth redirect; disconnect revokes Google token; error state banners |
| P27-08 | 27 | Not Started | P1 | P27-02, P4-01 | Unassigned | generateTargetedMergeSuggestions runs after initial full import; SyncJob.duplicatesDetectedCount set; post-import banner with review link; runs async, does not block import |

### Phase 28 — Power User Productivity

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P28-DB09 | 28 | Not Started | P1 | P28-01 | Unassigned | Design brief covers smart list sidebar, book management modal, bulk edit dark toolbar, keyboard shortcuts overlay with key chips, and QR code modal |
| P28-01 | 28 | Not Started | P0 | P16-01, P28-02 | Unassigned | "Save as list" button when filters active; creation modal with filter summary; sidebar "My Lists" section; active list highlighted; rename/duplicate/delete context menu |
| P28-02 | 28 | Not Started | P0 | P28-01 | Unassigned | SavedFilter model with filterState JSON, sortOrder, usageCount; all 4 server actions; default Favourites list seeded for all users |
| P28-03 | 28 | Not Started | P0 | P18-11 | Unassigned | Sidebar "Books" section; new book creation; book management modal with rename, archive, contact count, CardDAV path; moveContactsToBook server action; default book protected |
| P28-04 | 28 | Not Started | P1 | P16-04 | Unassigned | Dark bulk edit toolbar replaces P16-04 bar; Move to book, Add label, Set company, Archive, overflow menu with Delete and Export; Escape clears selection |
| P28-05 | 28 | Not Started | P1 | P16-02 | Unassigned | j/k navigation; / focuses search; c creates; e edits; f toggles favourite; Backspace archives with undo; 1–9 switches smart lists; ? opens overlay; all inactive when input focused |
| P28-06 | 28 | Not Started | P1 | P12-02 | Unassigned | QR code modal with 200×200 canvas; reuses or creates share link; Download QR saves PNG; Copy link shows 2s confirmation; Free plan expiry note shown |
| P28-07 | 28 | Not Started | P0 | P16-02 | Unassigned | searchVector GIN index; full-text search across name, company, notes, emails, addresses, job title; ts_rank ordering; prefix matching; ILIKE fallback for short queries; backfill migration |

### Phase 29 — Compliance & Developer Access

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P29-DB10 | 29 | Not Started | P1 | P29-03, P29-05 | Unassigned | Design brief covers API token panel (list, create, show-once, revoke, usage stats) and all 4 data export status states |
| P29-01 | 29 | Not Started | P0 | P10-01, P19-05 | Unassigned | generateDataExport returns valid ZIP with 5 files; vCard and CSV from P3-03 exporter; activity JSON; billing summary; account JSON; upload to blob storage |
| P29-02 | 29 | Not Started | P0 | P29-01 | Unassigned | DataExportJob model with status enum; requestDataExport deduplicates active jobs; CRON runner generates ZIP, uploads, sets READY; expiry CRON marks READY→EXPIRED after 48h |
| P29-03 | 29 | Not Started | P0 | P29-02, P29-DB10 | Unassigned | "Your data" section in settings; 4 status states render correctly; 5s polling while PENDING/PROCESSING; download button with file size; error retry |
| P29-04 | 29 | Not Started | P1 | P18-09, P20-02 | Unassigned | AccountDeletionCompleteTemplate with email, timestamp, data-removed list; sendAccountDeletionConfirmationEmail called after cascade delete; email captured before User row deleted |
| P29-05 | 29 | Not Started | P0 | P18-06 | Unassigned | ApiToken model with tokenHash, tokenPrefix, scope, lastUsedAt; createApiToken shows plaintext once; validateApiToken returns userId/scope or null; revokeApiToken; Pro gate; settings panel |
| P29-06 | 29 | Not Started | P0 | P29-05 | Unassigned | GET/POST/GET/:id/PUT/:id/DELETE on /api/v1/contacts; Bearer auth; READ_ONLY blocks writes (403); SourceType.API attribution; rate limit headers; Zod validation; consistent error shape |
| P29-07 | 29 | Not Started | P1 | P29-06 | Unassigned | /developers public page with all 5 endpoints documented; auth and rate limit sections; cURL/JS/Python examples; syntax highlighting; indexed by search engines |
| P29-08 | 29 | Not Started | P1 | P29-05, P29-06, P18-10 | Unassigned | Upstash sliding window: 1000/h read-only, 200/h read-write; X-RateLimit-* headers on all responses; 429 with Retry-After; monthly counter reset CRON; usage shown per token |

### Phase 30 — Public Contact Card

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P30-DB11 | 30 | Not Started | P1 | P30-02 | Unassigned | Design brief covers card page layout, visibility settings panel, username claim with availability states, card analytics summary, and all 3 share tools |
| P30-01 | 30 | Not Started | P0 | P26-04 | Unassigned | User.username @unique, nullable; 3–30 chars; checkUsernameAvailability returns 4 states; claimUsername enforces 30-day cooldown; reserved words and profanity lists; profile settings UI with real-time check |
| P30-02 | 30 | Not Started | P0 | P30-01, P30-03 | Unassigned | /u/{username} server-rendered; only visible fields shown; Person JSON-LD; 404 for unclaimed or hidden; recordCardView fire-and-forget; minimal nav; indexed |
| P30-03 | 30 | Not Started | P0 | P30-02 | Unassigned | User.publicCardFields Json?; resolveCardFields with defaults; updateCardVisibility merges patch; settings panel with per-field toggles; name/photo always-on; hidden toggle returns 404 |
| P30-04 | 30 | Not Started | P1 | P30-02, P12-02 | Unassigned | Non-users get vCard download; logged-in users get /contacts/new?prefill={base64}; create form pre-populated; source: CARD_IMPORT attribution; pre-fill banner shown |
| P30-05 | 30 | Not Started | P1 | P30-02, P26-10 | Unassigned | /api/og/card/[username] edge runtime; avatar initial with hash colour; name + subtitle; Cache-Control 3600s; hidden/unknown redirects to og-default.png; wired to /u page og:image |
| P30-06 | 30 | Not Started | P2 | P30-02 | Unassigned | PublicCardView model; publicCardViews and addToKontaxClicks on User; recordCardView increments both; analytics section shows total/30d views and CTA clicks; 90-day cleanup CRON; bot/self-view suppression |
| P30-07 | 30 | Not Started | P2 | P30-02, P28-06 | Unassigned | Copy link with 2s confirmation; QrCodeModal reused with direct shareUrl prop; email signature HTML snippet with live preview and copy; all 3 in /settings/profile/card share section |

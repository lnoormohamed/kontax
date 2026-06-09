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
| P10-05 | 10 | Not Started | P1 | P10-01 | Unassigned | Field-level merge UI, bulk accept, and 30-day undo all work correctly |
| P10-06 | 10 | Not Started | P1 | P10-04, P10-05 | Unassigned | Activity feed loads, paginates, and filters correctly; Free users see gated state |
| P10-07 | 10 | Not Started | P2 | P10-06 | Unassigned | Design brief covers all activity log and source badge surfaces and states |
| P10-08 | 10 | Not Started | P2 | P10-06 | Unassigned | Phone normalisation, phonetic matching, and stale-suggestion regeneration work correctly |

### Phase 11 — Plan Redesign: Free, Pro, Family, Teams

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P11-01 | 11 | Not Started | P0 | P2-02 | Unassigned | Feature matrix for all four tiers is documented without ambiguity |
| P11-02 | 11 | Not Started | P0 | P11-01 | Unassigned | SubscriptionPlan enum updated; entitlement fields and group scaffolding migrated |
| P11-03 | 11 | Not Started | P0 | P11-01 | Unassigned | All entitlement gates use new field names; downgrade behaviour is handled gracefully |
| P11-04 | 11 | Not Started | P1 | P11-02, P11-03 | Unassigned | Design brief covers pricing page, upgrade prompts, and downgrade warning |
| P11-05 | 11 | Not Started | P1 | P11-01, P10-01 | Unassigned | Retention pruning job runs correctly for all plan tiers |
| P11-06 | 11 | Not Started | P2 | P11-05 | Unassigned | Settings page shows correct plan, usage against limits, and group membership |

### Phase 12 — Contact Sharing

| Ticket | Phase | Status | Priority | Depends On | Owner | Acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| P12-01 | 12 | Not Started | P0 | P11-02 | Unassigned | ContactShare schema migrated; all share types representable |
| P12-02 | 12 | Not Started | P0 | P12-01 | Unassigned | Share link generates; resulting URL serves valid .vcf on iOS, macOS, Google Contacts |
| P12-03 | 12 | Not Started | P1 | P12-01, P11-03 | Unassigned | Static share delivers copy to recipient with correct source attribution |
| P12-04 | 12 | Not Started | P1 | P12-01, P11-03, P10-01 | Unassigned | Live share propagates updates; revoke converts to static copy cleanly |
| P12-05 | 12 | Not Started | P1 | P12-03, P12-04 | Unassigned | All active shares visible and manageable from contact detail page |
| P12-06 | 12 | Not Started | P1 | P12-03 | Unassigned | Recipient notified in-app and email; accept and decline update share status correctly |
| P12-07 | 12 | Not Started | P2 | P12-05, P12-06 | Unassigned | Design brief covers owner and recipient perspectives and all plan-gate states |
| P12-08 | 12 | Not Started | P2 | P12-07 | Unassigned | Propagation errors are caught, logged, surfaced, and retried automatically |

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
- Design briefs (P9-06, P10-07, P11-04, P12-07, P13-07, P14-08) must be completed before implementation of the UI tickets they inform.

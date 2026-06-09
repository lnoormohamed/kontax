# Phase 11 — Plan Redesign: Free, Pro, Family, Teams

## Objective
Restructure the subscription model around four tiers that reflect how people actually use Kontax: as individuals, as families sharing contact books, and as teams maintaining a shared address book for their organisation. This phase defines the feature set for each plan, updates entitlement enforcement, and prepares the billing and schema layer for the Family and Teams sharing features that follow in Phases 13 and 14.

## Success Criteria
- The four plan tiers (Free, Pro, Family, Teams) are documented with an unambiguous feature set per tier.
- Entitlement enforcement is updated across the app to reflect the new tier boundaries.
- The schema supports Family and Teams group structures at a model level, ready for Phase 13 and 14 to implement the product surface.
- Upgrade and downgrade paths between all tiers are documented.

## Exit Criteria
- `SubscriptionPlan` enum is updated: `FREE`, `PRO`, `FAMILY`, `TEAMS`.
- Entitlement gates in the app reflect the new feature matrix.
- Billing tier definitions are frozen and handed to design for pricing page and upgrade flow work.
- Family and Teams group scaffolding models are added to the schema (empty — no product logic yet).

## Phase Tracker
| Ticket | Status | Priority | Depends On |
| --- | --- | --- | --- |
| P11-01 | Done | P0 | P2-02 |
| P11-02 | Done | P0 | P11-01 |
| P11-03 | Done | P0 | P11-01 |
| P11-04 | Not Started | P1 | P11-02, P11-03 |
| P11-05 | Not Started | P1 | P11-01, P10-01 |
| P11-06 | Not Started | P2 | P11-05 |

---

## P11-01 — Define plan feature matrix
- Status: `Done`
- Priority: `P0`
- Dependencies: `P2-02`
- Delivered:
  - Froze `roadmap/build-phase/p11-01-plan-feature-matrix.md`: complete feature set for Free/Pro/Family/Teams, full entitlement-field mapping (existing + new) with null semantics, cross-tier sharing rules, one-group-per-user + subscription-ownership rules, and Family→Pro / Teams→Pro downgrade paths.
  - Product decisions resolved: **Family 6 / Teams 25** member slots; **PRO app-password limit = 5** (matrix wins over the current hardcoded "unlimited" — fix lands in P11-03); **PLUS removal safe** (0 PLUS subscribers in dev — re-check prod before P11-02 `db push`); **merge 30-day undo** uses the shipped `MergeDecision` mechanism (P10-05), not `syncTombstoneAt`/`MergeUndo`.
  - Corrected two stale assumptions in the doc: the `AppPassword` model already exists (limit hardcoded, not a DB field yet), and there is no `ImportFormat` enum (vCard bulk import is net-new parser work).
  - Three non-blocking items remain flagged (vCard bulk import, Teams expansion >25, Teams shared-book CardDAV) — none gate P11-02/03.
- Implementation Notes:
  - Document the feature set for each tier. The working baseline is:

  **Free**
  - Up to 500 contacts
  - 1 CardDAV client sync account (connect to iCloud, Nextcloud, etc.)
  - 1 device connection via app password (Kontax CardDAV server)
  - CSV import: 3 imports/month
  - vCard and CSV export
  - Basic merge suggestions (auto-detection only, no bulk accept)
  - Per-contact history: last 10 events
  - Source badges on contacts
  - vCard share link (download only, expires in 7 days)
  - No activity log global feed
  - No static or live Kontax-to-Kontax contact sharing

  **Pro (Individual)**
  - Unlimited contacts
  - 5 CardDAV client sync accounts
  - 5 device connections via app password
  - Unlimited imports
  - All export formats
  - Advanced merge: field-level selection, bulk accept, 30-day undo window
  - Full activity log global feed (90-day retention)
  - Per-contact history: unlimited
  - Source badges on contacts
  - vCard share link (download only, no expiry, revocable)
  - Static contact sharing with other Kontax users
  - Live contact sharing with other Pro/Family/Teams users
  - Priority support

  **Family (up to 6 members)**
  - Everything in Pro for each member on the plan
  - 1 shared family address book (contacts visible and editable by all members)
  - Live contact sync within the family group — changes to shared contacts propagate to all members
  - Family admin controls: add/remove members, set who can edit shared contacts
  - Each member retains their own private contact library
  - Shared activity log for family address book changes
  - Activity log retention: 1 year

  **Teams**
  - Everything in Pro for each member
  - Up to 25 members (expandable)
  - Multiple shared team address books (e.g. "Clients", "Partners", "Staff")
  - Admin and Member roles per address book
  - Full audit log for all team address book changes (unlimited retention)
  - Team-level CardDAV sync accounts (sync an entire team address book to an external source)
  - Dedicated account manager for large teams

  - Flag any features where the boundary is uncertain and needs a product decision before this ticket can close.
- Acceptance Criteria:
  - Feature matrix is documented without ambiguity.
  - Every existing entitlement field in `Subscription` is mapped to the new tier definitions.
  - Uncertain boundaries are flagged explicitly rather than left implicit.
- Risks / Open Questions:
  - "PLUS" plan in the current schema becomes "PRO" — confirm no existing subscribers are on PLUS before renaming.
  - Family member count (6) and Teams member count (25) are working numbers — confirm with pricing before freezing.
  - Live sharing requiring both parties to be on paid plans needs enforcement logic documented here, not assumed.

---

## P11-02 — Update SubscriptionPlan enum and entitlement schema
- Status: `Done`
- Priority: `P0`
- Dependencies: `P11-01`
- Delivered:
  - `SubscriptionPlan` enum is now `FREE / PRO / FAMILY / TEAMS` (`PLUS` removed — 0 subscribers).
  - Added 8 entitlement fields to `Subscription`: `appPasswordsLimit`, `familyGroupEnabled`, `teamsEnabled`, `sharedAddressBooksLimit`, `memberSlotsLimit`, `activityLogRetentionDays`, `liveShareEnabled`, `staticShareEnabled`.
  - Added empty group-scaffolding: `Group`, `GroupMember`, `GroupAddressBook` models + `GroupType`, `GroupRole`, `GroupInviteStatus` enums (with back-relations on `User` and `Subscription`). No product logic — Phases 13/14 build on these.
  - `billing.ts`: removed PLUS, added FAMILY/TEAMS to `PLAN_DEFAULTS`/`PLAN_LABELS`, extended `PlanEntitlements` + `getUserBillingContext` select/mapping with all new fields (matrix values: FREE app-pwds=1/others=5; retention 0/90/365/null; member slots 6/25; etc.). `app-passwords.ts` now reads `appPasswordsLimit` from entitlements (FREE=1, paid=5), removing the hardcoded PLUS switch. Updated two user-facing "Plus" strings.
  - Applied via `prisma db push` after granting the `SubscriptionPlan` type to the `kontax` role (the type was owned by `postgres`, blocking enum alteration). Verified enum/columns/tables/enums all present; client regenerated; tsc + lint + build green.
  - **Note:** `contactsLimit`/`monthlyImportLimit`/`syncAccountsLimit` remain numeric ceilings in code; the matrix's "null = unlimited" semantics for paid tiers are applied in enforcement during **P11-03**.
- Implementation Notes:
  - Update `SubscriptionPlan` enum: `FREE`, `PRO`, `FAMILY`, `TEAMS`. Remove `PLUS` after confirming no active subscribers.
  - Add new entitlement fields to `Subscription` to cover Family and Teams capabilities:
    - `familyGroupEnabled Boolean @default(false)`
    - `teamsEnabled Boolean @default(false)`
    - `sharedAddressBooksLimit Int?` — null means unlimited (Teams), 1 for Family, 0 for Free/Pro
    - `memberSlotsLimit Int?` — Family: 6, Teams: 25 (expandable), null for Free/Pro
    - `activityLogRetentionDays Int?` — null means unlimited (Teams), 365 for Family, 90 for Pro, 0 for Free
    - `liveShareEnabled Boolean @default(false)` — Pro and above
    - `staticShareEnabled Boolean @default(false)` — Pro and above
  - Add group scaffolding models (empty, no logic yet):
    - `Group` model: `id`, `ownerId`, `type` (enum: `FAMILY`, `TEAM`), `name`, `subscriptionId`, `memberSlotsLimit`, `createdAt`, `updatedAt`
    - `GroupMember` model: `id`, `groupId`, `userId`, `role` (enum: `OWNER`, `ADMIN`, `MEMBER`), `inviteStatus` (enum: `PENDING`, `ACCEPTED`, `DECLINED`, `REVOKED`), `createdAt`
    - `GroupAddressBook` model: `id`, `groupId`, `name`, `description`, `createdAt`, `updatedAt`
  - These group models have no product logic yet — they exist to validate the schema direction before Phase 13/14 builds on them.
- Acceptance Criteria:
  - Migration runs cleanly.
  - New entitlement fields are present and have correct defaults.
  - Group scaffolding models exist in the schema.
  - `PLUS` enum value is handled safely (migration sets existing PLUS subscribers to PRO).
- Risks / Open Questions:
  - Stripe product IDs need to be updated to reflect new plan names — coordinate with billing integration before renaming.

---

## P11-03 — Update entitlement enforcement across the app
- Status: `Done`
- Priority: `P0`
- Dependencies: `P11-01`
- Delivered:
  - **Tier-driven entitlements.** `getUserBillingContext` now derives entitlements straight from `PLAN_DEFAULTS` (the frozen P11-01 matrix) rather than merging per-subscription columns. The P11-02 override columns stay in the schema for future custom/enterprise plans but are intentionally not merged — non-nullable boolean columns default to `false` and were silently stripping paid features from existing rows (caught in smoke testing: PRO was resolving `liveShare:false`, `contactsLimit:25000`).
  - **null = unlimited** for `contactsLimit`/`monthlyImportLimit` (Pro/Family/Teams). `PlanEntitlements` types widened to `number | null`; `assertCanCreateContacts`/`assertCanImportContacts` skip the check when null; `contactsRemaining` is null when unlimited; all UI readouts (dashboard near-limit banner, settings, import-export) render "Unlimited" / null-safe.
  - **App passwords** read `appPasswordsLimit` (FREE=1, paid=5) — done in P11-02, confirmed.
  - **Activity feed gate broadened** from PRO-only to all paid tiers via `isActivityLogEnabled(entitlements)` (retention ≠ 0), so Family/Teams are included automatically. Retention window is now per-tier from `activityLogRetentionDays` (Pro 90 / Family 365 / Teams unlimited) in the feed route + client footer ("Showing all activity" when unlimited).
  - **Per-contact history capped to the last 10 events for Free** (query-time, no deletion) in `/api/contacts/[id]/history`; paid tiers stay uncapped with cursor pagination.
  - **Stub gates added for Phases 12–14**: `assertCanLiveShare`, `assertCanStaticShare`, `assertCanUseSharedAddressBooks`, `assertCanUseActivityLog` — callable now, throwing tier-appropriate errors.
  - **Downgrade behaviour (documented + graceful).** Because entitlements are tier-driven, a downgrade takes effect immediately at the gate level with **no silent data loss**: existing contacts/sync accounts/app passwords over the new limit are retained (read-only / can't add more), the activity feed locks and per-contact history caps to 10 (events retained, just not surfaced), and old activity is only removed later by the P11-05 retention job (which runs after downgrade is confirmed). Live-share→static conversion and Family/Teams group dissolution are specified in the P11-01 matrix and implemented when those features land (Phases 12–14); the gate stubs are in place.
- Implementation Notes:
  - Audit every entitlement check in `billing.ts` and throughout the app. Update each gate to use the new field names and plan tiers.
  - Key gates to update or add:
    - Contact count limit (500 for Free, unlimited for Pro/Family/Teams)
    - Import limit (3/month for Free, unlimited above)
    - Sync accounts limit (1 Free, 5 Pro, 5 per Family member, higher for Teams)
    - App passwords limit (1 Free, 5 Pro, 5 per Family member)
    - Advanced merge (Pro and above)
    - Activity log global feed (Pro and above, with retention by tier)
    - Live sharing (Pro and above, both parties must qualify)
    - Static sharing (Pro and above)
    - Shared address books (Family and Teams only)
  - Ensure downgrade paths are handled: when a user downgrades from Pro to Free, what happens to their extra sync accounts, activity log data beyond the retention window, and any live shares they have active? Document the downgrade grace behavior before implementing.
- Acceptance Criteria:
  - All existing entitlement gates use the updated field names and tier logic.
  - New gates for sharing and group features are stubbed even if the features are not yet built.
  - Downgrade behavior is documented and handled gracefully — no silent data loss.
- Risks / Open Questions:
  - Downgrade from Family to Pro must handle the shared address book and its contacts — define who owns them after downgrade before implementing.
  - Downgrade from Teams must handle multiple shared address books and team member access.

---

## P11-04 — Design brief: pricing page and upgrade flows
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P11-02`, `P11-03`
- Implementation Notes:
  - Produce a design brief covering:
    - **Pricing page**: four-column plan comparison (Free, Pro, Family, Teams). Feature rows grouped by category (Contacts, Sync, Sharing, Collaboration, Support). Recommended plan highlight. Monthly/annual toggle.
    - **Upgrade prompt**: inline contextual prompt when a user hits a gate (e.g. "You've reached 500 contacts on the Free plan"). Should specify which plan unlocks the blocked feature.
    - **Plan comparison modal**: triggered from upgrade prompts. Shows only the two relevant tiers (current vs suggested), not all four.
    - **Family invite flow**: overview only (detail in Phase 13). Invite by email, pending state.
    - **Downgrade warning**: list of features/data that will be affected before confirming downgrade.
  - Brief should include tone guidance: pricing should feel transparent and fair, not pushy. Family and Teams plans should feel like they solve a real coordination problem, not just "more of the same."
- Acceptance Criteria:
  - Designer has clear content, hierarchy, and interaction states for all surfaces.
  - All four plans are represented fairly in the comparison.
- Risks / Open Questions:
  - Pricing numbers are not in scope for this brief — leave as placeholder. Brief covers layout and feature representation only.

---

## P11-05 — Activity log retention enforcement job
- Status: `Not Started`
- Priority: `P1`
- Dependencies: `P11-01`, `P10-01`
- Implementation Notes:
  - Add a background job that runs nightly and prunes `ActivityEvent` rows older than the user's plan retention window.
  - Free: delete events older than 0 days on the global feed (per-contact history last 10 events is enforced at query time, not by deletion — keep all events but limit query results).
  - Pro: delete events older than 90 days.
  - Family: delete events older than 365 days.
  - Teams: no deletion (unlimited).
  - The job should run per-user, not as a single bulk delete, so it can be paused or skipped for individual accounts without affecting others.
  - Log the pruning job outcome as a `SYSTEM` `ActivityEvent` so there is a record of when pruning occurred.
- Acceptance Criteria:
  - Pruning job runs without errors on a database with mixed plan users.
  - Events are not deleted for users who are within their retention window.
  - Teams users are never pruned.
- Risks / Open Questions:
  - Users who downgrade from Pro to Free mid-retention-window: prune on next job run after downgrade is confirmed, not immediately.

---

## P11-06 — Update settings page to reflect new plan tiers
- Status: `Not Started`
- Priority: `P2`
- Dependencies: `P11-05`
- Implementation Notes:
  - Update the settings page plan section to display the correct plan name and feature summary for all four tiers.
  - Show usage against limits: contacts used / limit, imports this month / limit, sync accounts used / limit, app passwords used / limit.
  - Link to the pricing page from the plan section.
  - For Family and Teams users, show group membership status (e.g. "Member of Smith Family · 4/6 members") and a link to manage the group (Phase 13/14).
- Acceptance Criteria:
  - Settings page accurately reflects the current plan and usage.
  - Group membership is surfaced for Family and Teams users.
  - All usage bars reflect live data, not cached values.
- Risks / Open Questions:
  - Group management links will be broken until Phase 13/14 ships — use a "coming soon" placeholder state rather than a dead link.

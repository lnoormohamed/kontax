# P11-01 Plan Feature Matrix

## Purpose
This ticket defines the authoritative, frozen feature set for every subscription tier in Kontax: Free, Pro, Family, and Teams. Every other Phase 11 ticket — schema migration, entitlement enforcement, design brief, activity log retention, and settings UI — derives from this document. No feature boundary in any later ticket should contradict what is written here. If a downstream ticket uncovers a conflict with this matrix, a revision to this document must be filed and agreed before the downstream ticket can close.

## Background
Kontax previously operated with three plans: FREE, PLUS, and PRO. The PLUS plan was introduced as an intermediate tier but never reached the product maturity needed to justify its position between Free and Pro. As of Phase 11, PLUS is removed. Its subscribers are migrated to PRO. The new tier structure is designed around real usage patterns: individual power users on Pro, families who want shared address book management on Family, and organisations that need multi-user shared books with role controls on Teams.

Phase 12 (account-to-account sharing), Phase 13 (family group management), and Phase 14 (teams management) all gate their features on the entitlements defined in this document. The matrix must be complete and unambiguous before those phases begin implementation work. Any "to be decided" item left open in this document blocks the phases that depend on it.

The current `billing.ts` PLAN_DEFAULTS map (`FREE`, `PLUS`, `PRO`) and the Prisma `SubscriptionPlan` enum must both be updated in P11-02 to reflect this matrix.

## Scope
### In scope
- Complete feature list for each of the four tiers: Free, Pro, Family, Teams.
- Mapping of every existing entitlement field in the `Subscription` model to the new tier definitions.
- Cross-tier sharing rules (when does live sharing require both parties to be on paid plans?).
- Group membership rules for Family and Teams (one group per user, member slot counts, who owns the subscription).
- Explicit flagging of uncertain boundaries that require a product decision before P11-02 can close.

### Out of scope
- Database migration steps — covered in P11-03.
- Enforcement code changes — covered in P11-03.
- Pricing numbers — deliberately placeholder until commercial decision is made.
- UI for plan selection or upgrade — covered in P11-04 and P11-06.
- Activity log retention job — covered in P11-05.

---

## Design / Implementation Spec

### Tier 1 — Free

**Intended user:** Someone evaluating Kontax or managing a small personal contact library with no need for sync or sharing.

#### Contacts
- Maximum 500 contacts. This is a hard ceiling enforced at contact create and import time.
- Contacts are user-owned only. No shared address books.
- Per-contact history: the last 10 ActivityEvent rows associated with a contact are visible in the contact detail view. This is enforced at query time by applying `take: 10, orderBy: createdAt desc` — not by deleting older events. The rows remain in the database but are never surfaced to Free users.
- Source badges are shown on contacts (which sync account or import job a contact came from). This is a display-only feature requiring no plan gate.

#### Import
- 3 imports per calendar month. This limit applies to the count of `ImportJob` rows with `status: COMPLETED` in the current billing month, regardless of how many contacts each job contains.
- Supported format: CSV (generic, Google, Apple, Outlook source profiles).
- No vCard bulk import.

#### Export
- vCard export (VCARD_4 format): available.
- CSV export (CSV_GENERIC format): available.
- No JSON or other premium export formats.
- Export is always available even on a CANCELED account (portability guarantee).

#### Sync
- 1 CardDAV client sync account. This means 1 `SyncAccount` row per user. The connection is to an external CardDAV server (iCloud, Nextcloud, Radicale, etc.) and syncs the user's personal contact library.
- 1 device app password for the Kontax CardDAV server endpoint (serving the user's contacts to a phone or device). App passwords are stored as hashed credentials and count against the `appPasswordsLimit` entitlement.
- Sync direction: configurable per account (TWO_WAY, IMPORT_ONLY, EXPORT_ONLY).

#### Merge
- Basic merge suggestions: auto-detection of duplicates based on name/email/phone matching. The merge suggestion engine runs and surfaces candidates.
- No bulk accept. Users must review and accept or dismiss each suggestion individually.
- No 30-day undo window for merges. Merge actions are permanent on Free.
- Advanced merge (field-level selection per field, not winner-takes-all) is not available.

#### Sharing
- vCard share link: a download-only link that lets the user share a single contact's vCard file with anyone. The link expires after 7 days. No revocation UI (the link expires naturally). This requires no account on the receiving end.
- No static Kontax-to-Kontax sharing (a persistent shared contact record visible to another Kontax user).
- No live Kontax-to-Kontax sharing.

#### Activity Log
- No global activity log feed. The activity feed page/section is not accessible.
- Per-contact history is available but limited to the last 10 events at query time (see Contacts section above).

#### Support
- Community support only (documentation and public forum).

---

### Tier 2 — Pro (Individual)

**Intended user:** An individual power user who manages a large contact library, relies on CardDAV sync across multiple devices or apps, and may want to share contacts with other Kontax users.

#### Contacts
- Unlimited contacts. The `contactsLimit` entitlement field is set to `null` and enforcement code must treat `null` as no ceiling (not as zero).
- Per-contact history: unlimited. All ActivityEvent rows for a contact are visible in the contact detail view with no pagination gate.
- Source badges: same as Free.

#### Import
- Unlimited imports per month. The `monthlyImportLimit` entitlement field is set to `null` and enforcement code must treat `null` as no ceiling.
- All import source profiles supported: GENERIC, GOOGLE, APPLE, OUTLOOK.
- vCard bulk import: available (single .vcf file containing multiple vCards).

#### Export
- All export formats: CSV_GENERIC, VCARD_4, and any future premium formats added after Phase 11.
- `premiumExportEnabled` is `true`.

#### Sync
- 5 CardDAV client sync accounts. `syncAccountsLimit` is set to 5.
- 5 device app passwords for the Kontax CardDAV server. `appPasswordsLimit` is set to 5.
- Sync direction: fully configurable per account.
- `cardDavSyncEnabled` is `true`.

#### Merge
- Advanced merge: enabled. `advancedMergeEnabled` is `true`.
- Field-level selection: when two contacts are being merged, the user can choose which version of each field wins (not winner-takes-all).
- Bulk accept: the user can accept all HIGH confidence merge suggestions in a single action.
- 30-day undo window: merged contacts are kept as soft-deleted (`syncTombstoneAt` set, contact hidden from UI) for 30 days. A separate `MergeUndo` or reversible path exists for this window. After 30 days the tombstoned contacts are eligible for hard deletion by a cleanup job.

#### Sharing
- vCard share link: download-only, no expiry, revocable (user can deactivate the link from their share management page). Receiving end requires no Kontax account.
- Static contact sharing: the user can share a contact with another Kontax user (identified by email). The recipient sees a snapshot of the contact at the time of sharing. Updates to the source contact do not propagate automatically. Recipient must have a Kontax account but does not need to be on a paid plan to receive a static share.
- Live contact sharing: the user can share a contact with another Kontax user such that changes to the source contact propagate in near-real-time to the recipient's view. The recipient must be on Pro, Family, or Teams to receive a live share. If the recipient downgrades below Pro, their incoming live shares are automatically converted to static snapshots. See cross-tier sharing rules below.
- `liveShareEnabled` is `true`.
- `staticShareEnabled` is `true`.

#### Activity Log
- Global activity log feed: available. Shows all ActivityEvents across the user's account (contact edits, imports, merges, syncs, exports, billing events, sharing events).
- Retention: 90 days. Events older than 90 days are pruned by the nightly retention job (P11-05).
- `activityLogRetentionDays` is set to 90.

#### Support
- Priority support: email support with an accelerated response SLA.

---

### Tier 3 — Family (up to 6 members)

**Intended user:** A household unit where multiple people maintain a shared address book alongside their own private libraries. One person pays and the others are invited as members under the same subscription.

#### Membership model
- One Family group per user. A user can be an owner of one Family group or a member of one Family group — not both, and not a member of multiple groups.
- Maximum 6 members including the owner. `memberSlotsLimit` is set to 6.
- The owner's Stripe subscription covers all members. Members do not pay separately. Members do not have their own `Subscription` rows — they reference the group's subscription via the `Group` model's `subscriptionId`.
- Invitations are sent by email. The owner and any member with admin rights can invite. Invited users who are already on a paid individual plan and accept must understand their individual plan will be superseded by the Family membership while active.

#### Pro features per member
- Every member of a Family plan receives all Pro entitlements for their own personal contact library: unlimited personal contacts, 5 CardDAV client sync accounts, 5 app passwords, unlimited imports, all export formats, advanced merge, 90-day per-contact history on their personal library, vCard share links with no expiry, static and live sharing.
- Activity log for personal library: 90 days (same as Pro).

#### Shared family address book
- 1 shared family address book. `sharedAddressBooksLimit` is set to 1.
- All group members can view the shared address book.
- Edit permissions are controlled by the family admin (the owner or any member the owner grants admin rights to). By default all members can edit.
- `canEdit` per `GroupMember` row controls whether that member can make changes to shared contacts.
- Contacts in the shared address book are separate records from personal contacts. A member can copy a shared contact to their personal library but the two copies are independent thereafter.
- The shared address book has its own CardDAV URL, accessible to all members via their own app passwords.

#### Live sync within the group
- Changes to shared address book contacts propagate to all members in near-real-time (same mechanism as Pro live sharing but scoped to the group).
- The propagation is automatic — no explicit share action required per contact.

#### Activity log for the shared book
- A shared activity log exists for the family address book, showing all edits by all members.
- Retention: 365 days. `activityLogRetentionDays` is set to 365 for the shared book log.
- Only the family admin and owner can view the full shared activity log.

#### Family admin controls
- The owner can assign or revoke admin rights for any member.
- Admins can invite new members (up to the 6-member slot limit).
- Admins can remove members. On removal, the member loses access to the shared address book immediately. They revert to a Free plan unless they subscribe individually.
- The owner cannot be removed (only by canceling the Family subscription).

#### Support
- Priority support: same as Pro.

---

### Tier 4 — Teams

**Intended user:** A small-to-medium organisation that needs multiple shared address books, role-based access controls per book, a full audit trail for compliance, and potentially a dedicated account manager.

#### Membership model
- Up to 25 members by default. `memberSlotsLimit` is set to 25. Expansion beyond 25 requires a custom arrangement.
- One Teams group per user (same one-group-per-user rule as Family).
- Owner pays. Members do not pay separately.
- Admin and Member roles per shared address book (not just at the group level). A user can be an Admin on one book and a Member on another.

#### Pro features per member
- Every member receives Pro entitlements for their personal contact library: same as Family member Pro entitlements above.

#### Shared address books
- Multiple shared team address books. `sharedAddressBooksLimit` is set to `null` (unlimited).
- Each address book can have its own name, description, and role assignments.
- `GroupAddressBook` rows represent individual shared books.
- Team-level CardDAV sync accounts: a sync account can be associated with a group address book (not just a personal library), allowing the entire team book to sync to an external CardDAV server.

#### Roles per address book
- ADMIN: can create/rename/archive the book, manage members for that book, view audit log for that book.
- MEMBER: can read and edit contacts in the book (if canEdit is true), but cannot manage the book itself.
- The group owner is implicitly an ADMIN on all books.

#### Audit log
- Full audit log for all team address book changes. Unlimited retention. `activityLogRetentionDays` is set to `null` for team audit events.
- This is the full `ActivityEvent` stream scoped to the group, not the personal streams of individual members.
- Individual member personal activity logs still follow Pro retention (90 days).

#### Support
- Dedicated account manager for teams above a threshold size (threshold TBD in commercial agreements, not enforced in product code).
- Priority support for all members.

---

### Cross-Tier Sharing Rules

#### Live sharing receiver eligibility
- The sender of a live share must be on Pro, Family, or Teams.
- The receiver of a live share must also be on Pro, Family, or Teams.
- If either party downgrades to Free, any live shares between them are automatically converted to static snapshots. The conversion must be done by the downgrade handler, not the retention job.
- A Free user who receives a live share before either party downgrades: the share is converted to a static snapshot at the moment of downgrade confirmation (not on the next job run).

#### Static sharing receiver eligibility
- The sender must be on Pro, Family, or Teams.
- The receiver can be on any plan, including Free. Receiving a static share does not require a paid plan.

#### vCard share links (no-account)
- Available on all plans. Free links expire after 7 days. Pro+ links have no expiry and are revocable.
- Recipients do not need a Kontax account.

---

### Entitlement Field Mapping (Subscription model)

| Existing field | Free | Pro | Family | Teams |
|---|---|---|---|---|
| `contactsLimit` | 500 | null (unlimited) | null per member | null per member |
| `monthlyImportLimit` | 3 | null (unlimited) | null per member | null per member |
| `syncAccountsLimit` | 1 | 5 | 5 per member | 5 per member (personal) |
| `advancedMergeEnabled` | false | true | true | true |
| `premiumExportEnabled` | false | true | true | true |
| `cardDavSyncEnabled` | false | true | true | true |

New fields added in P11-02:

| New field | Free | Pro | Family | Teams |
|---|---|---|---|---|
| `appPasswordsLimit` | 1 | 5 | 5 per member | 5 per member |
| `familyGroupEnabled` | false | false | true | false |
| `teamsEnabled` | false | false | false | true |
| `sharedAddressBooksLimit` | 0 | 0 | 1 | null (unlimited) |
| `memberSlotsLimit` | null | null | 6 | 25 |
| `activityLogRetentionDays` | 0 | 90 | 365 | null (unlimited) |
| `liveShareEnabled` | false | true | true | true |
| `staticShareEnabled` | false | true | true | true |

Notes on null semantics:
- `contactsLimit: null` = no ceiling. Enforcement code must check `if (limit !== null && used >= limit)`.
- `monthlyImportLimit: null` = no ceiling. Same null check.
- `activityLogRetentionDays: null` = keep forever. Retention job skips users where this is null.
- `activityLogRetentionDays: 0` = no global feed (Free). Retention job removes all global feed events for these users on each run (per-contact query-time limit of 10 is separate).
- `sharedAddressBooksLimit: null` = unlimited books (Teams only).
- `memberSlotsLimit: null` = single-user plans, group features not applicable.

---

### Group Ownership Rules

#### One group per user
- A user can own at most one Group (Family or Teams).
- A user can be a member of at most one Group.
- Being in a group as OWNER counts as their one group. Being in a group as MEMBER counts as their one group.
- Attempting to create a second group or accept a second invite must be blocked at the application layer before a database write.

#### Subscription ownership
- The Group has a `subscriptionId` linking to the owner's Subscription row.
- Family members do not have their own active Subscription rows while they are in the group. Their `User.lifecycleState` is set to ACTIVE by virtue of group membership.
- When a member leaves or is removed, they revert to Free (no active Subscription) unless they independently subscribe.

#### Family-to-Pro downgrade: shared address book fate
- When the owner downgrades the Family subscription to Pro, the family group is dissolved.
- The shared address book is transferred to the owner as a read-only snapshot in their personal library. The owner receives a one-time export of the shared book in vCard format.
- Members who were in the family group revert to Free immediately.
- Contacts that were only in the shared book and not in any member's personal library are preserved in the owner's archive, not deleted.

#### Teams downgrade
- When a Teams subscription downgrades to Pro, all shared address books become read-only.
- The owner retains read access to all team books. Members lose write access.
- A grace period of 30 days allows the owner to export team books before they are archived.
- After 30 days, team books are archived (archivedAt set) and become invisible to members. Owner retains export access.

---

### Uncertain Boundaries Requiring Product Decision Before P11-02 Closes

1. **PLUS subscriber migration**: Confirm with billing that zero active subscribers are on PLUS before renaming the enum. If any exist, a one-time communication and migration plan is required before the schema migration runs in production.

2. **Family member count (6) and Teams member count (25)**: These are working numbers. Confirm with pricing and commercial team before freezing. Schema stores `memberSlotsLimit` as an Int on both the `Subscription` and `Group` models, so the number can be overridden per-group without a migration.

3. **App passwords entitlement field**: `appPasswordsLimit` is not currently in the `Subscription` model. It must be added in P11-02. The enforcement code in P11-03 must gate app password creation against this limit. Confirm where app passwords are currently stored (likely a separate model not yet in the schema) before P11-03 begins.

4. **vCard bulk import for Pro**: Confirm whether this requires a new `ImportFormat` enum value or whether it reuses `VCARD_4` (which exists as an export format but not an import format). This is a schema and parser question for the import pipeline, not just an entitlement question.

5. **Merge 30-day undo**: Confirm that the existing `syncTombstoneAt` field on `Contact` is the intended mechanism for the undo window, or whether a separate `MergeUndo` model is needed. This affects P11-03 and the merge pipeline.

6. **Teams expansion beyond 25**: Define the commercial process for expanding the member slot limit. The `memberSlotsLimit` field on `Group` allows a custom value to be set without a schema change, but the upgrade flow and admin tooling for this are out of scope for Phase 11.

7. **Shared book CardDAV endpoint for Teams**: Confirm whether team-level CardDAV sync accounts are in scope for Phase 11 schema work (P11-02) or deferred to Phase 14. The `GroupAddressBook` model scaffold includes this concept but the sync infrastructure wiring is not Phase 11 work.

---

## Acceptance Criteria
- Every existing entitlement field in the `Subscription` model (`contactsLimit`, `monthlyImportLimit`, `syncAccountsLimit`, `advancedMergeEnabled`, `premiumExportEnabled`, `cardDavSyncEnabled`) is explicitly mapped to all four tiers in this document with a concrete value or null.
- Every new entitlement field proposed for P11-02 (`appPasswordsLimit`, `familyGroupEnabled`, `teamsEnabled`, `sharedAddressBooksLimit`, `memberSlotsLimit`, `activityLogRetentionDays`, `liveShareEnabled`, `staticShareEnabled`) is defined for all four tiers with a concrete value or null.
- Null semantics are documented for every field that uses null as a meaningful value (unlimited or not applicable).
- Cross-tier sharing rules are unambiguous: which plans can send live shares, which can receive, what happens on downgrade.
- One-group-per-user rule is stated and the enforcement expectation is clear.
- Downgrade paths for Family-to-Pro and Teams-to-Pro are described at a level of detail sufficient for P11-03 to implement without additional research.
- All uncertain boundaries are listed explicitly in the "Uncertain Boundaries" section rather than left implicit.
- The document is agreed by at least the engineering lead and product owner before P11-02 begins.

## Risks and Open Questions
- PLUS to PRO migration: if any PLUS subscribers exist, silent migration without communication is unacceptable. Must be coordinated.
- The Family member reversion-to-Free on group dissolution is potentially surprising to members who joined expecting ongoing access. The product must communicate this clearly in the invite acceptance flow (Phase 13).
- Null-as-unlimited semantics in enforcement code are easy to get wrong. Every place in the codebase that reads `contactsLimit` or `monthlyImportLimit` must be audited for `=== null` guards, not `=== 0` or `=== undefined`.
- The relationship between personal Pro entitlements and group membership entitlements for Family and Teams members needs careful handling in `getUserBillingContext`. The function currently reads from `user.subscriptions` directly; for group members it must also resolve group membership and derive entitlements from the group owner's subscription.
- Teams audit log (unlimited retention) will grow without bound. This is acceptable per the product decision but the operational cost should be flagged to infrastructure.

## Outcome
This ticket produces a frozen, agreed feature matrix that all Phase 11 downstream tickets and Phase 12–14 features can reference without ambiguity.

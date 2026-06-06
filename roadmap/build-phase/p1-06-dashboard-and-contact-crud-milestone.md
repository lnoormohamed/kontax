# P1-06 Dashboard and Contact CRUD Milestone

## Purpose
This document defines the minimum end-to-end product milestone that completes Phase 1 of Kontax. It turns the Phase 1 foundation work into a concrete implementation target: a signed-in user can create an account, enter a personal dashboard, manage their own contacts, and rely on product behavior that is compatible with later normalization, merge, import/export, billing, and sync work.

## Milestone Summary
Phase 1 is complete when Kontax supports:
- account registration
- credentials login and logout
- a signed-in dashboard shell
- user-scoped contact create, read, update, archive, restore, and delete behavior
- basic contact search and list filtering
- UX behavior aligned with the canonical schema, normalization strategy, and auth policy already documented

This is not yet the full import/export, merge, or CardDAV release. It is the first coherent user-facing product slice.

## User Journey Covered by the Milestone
1. A new consumer user lands on the marketing/home page.
2. The user creates an account and signs in.
3. The user enters a personal dashboard.
4. The user can add one or more contacts.
5. The user can browse and search their contacts.
6. The user can open a dedicated contact detail screen.
7. The user can edit contact details.
8. The user can archive a contact instead of immediately deleting it.
9. The user can restore archived contacts.
10. The user can hard-delete a contact only through an explicit destructive path aligned with future audit expectations.
11. The user can sign out safely.

## Milestone Scope
### Included
- credentials registration/login/logout
- authenticated dashboard shell
- personal contact list
- contact detail/create/edit form
- archive and restore flow
- explicit delete flow
- search by name, email, phone, and organization using the current or planned normalized model
- empty states and basic error states

### Excluded
- import/export UI
- merge workflows
- billing UI
- CardDAV sync
- shared books or collaboration
- advanced permissions
- mobile-native apps
- session/device management UI

## Dashboard Requirements
### Authenticated home state
The signed-in dashboard should replace the current placeholder welcome state with a working contact workspace.

Required sections:
- account summary panel
- contact list panel
- create contact action
- search/filter controls
- archive view access
- sign-out entry point

### Layout expectations
- desktop-first responsive layout with clear primary action for adding contacts
- mobile-safe stacking without losing core controls
- a persistent sense that this is a personal contact home, not a generic admin shell

### Empty state
If the user has no contacts:
- show a friendly empty state
- explain the value of adding the first contact
- provide a primary CTA to create the first contact

## Contact CRUD Requirements
### Create
User can create a contact with:
- display/full name
- optional email
- optional phone
- optional organization/company
- optional notes

Behavior:
- contact must belong to the signed-in user
- empty or malformed inputs should be validated before persistence
- creation should align with future normalization strategy even if the schema is still transitional

### Read
User can:
- see a list of active contacts
- see a recoverable archived contact list
- open a dedicated contact detail page
- view primary profile fields and metadata needed for later expansion

Read behavior rules:
- only contacts owned by the signed-in user are visible
- archived contacts are excluded from the default active list

### Update
User can edit:
- name
- email
- phone
- organization
- notes

Update rules:
- edits should preserve canonical contact ownership
- future-ready normalization should be considered when fields are saved
- update timestamps must remain meaningful

### Archive
Archive is the default non-destructive removal path.

Archive rules:
- archived contacts leave the default active list
- archived contacts remain recoverable
- archive should be faster and safer than hard delete in normal UX

### Restore
User can restore archived contacts back to the active list.

Restore rules:
- original ownership is preserved
- restored contacts reappear in normal search/list views

### Delete
Hard delete is a secondary destructive path.

Delete rules:
- destructive confirmation required
- action should be framed as stronger than archive
- implementation should be compatible with future soft-delete/tombstone policy
- even if technical deletion remains simple initially, UX and architecture should treat it as an auditable destructive action

## Search and Filtering Requirements
### Required search scope
Search should target:
- contact name/display name
- organization/company
- email
- phone

### Required filter scope
At minimum:
- active contacts
- archived contacts
- all contacts view if useful

### Search behavior expectations
- user-scoped only
- reasonably fast for common contact-book sizes
- structured to evolve into normalized identifier search from `P1-02`

## Data Model Alignment Requirements
This milestone must respect the earlier Phase 1 decisions:
- `User` is the ownership root
- `Contact` is canonical
- future `ContactIdentifier` and `ContactSource` support should not be blocked by current CRUD choices
- archive behavior should be preferred over destructive delete
- auth/session behavior must match `P1-03`

Near-term schema evolution expected after this milestone:
- expand `Contact` fields toward canonical naming
- introduce normalized fields
- add archive/tombstone fields if not already present

## UX and Behavior Requirements
### Validation
- required name/display name enforcement
- email validation when provided
- phone validation should be permissive enough for global consumer input while preparing for later normalization

### Error handling
- failed saves should produce user-visible error states
- unauthorized access should redirect to login or deny access cleanly
- destructive actions should not silently fail

### Accessibility and trust
- forms and actions should be clearly labeled
- destructive actions should be visually distinct
- empty states and confirmation states should reduce anxiety rather than feel enterprise-heavy

## Phase 1 Exit Implementation Checklist
- [x] Registration flow works
- [x] Login flow works
- [x] Logout flow works
- [x] Authenticated dashboard exists
- [x] Create contact flow works
- [x] Contact list works
- [x] Dedicated contact detail view exists
- [x] Edit contact flow works
- [x] Archive flow works
- [x] Restore flow works
- [x] Delete flow works
- [x] Search works across key fields
- [x] User scoping prevents cross-account data exposure
- [x] Dashboard behavior is compatible with future import/export and merge phases

## Acceptance Criteria
- A signed-in user can manage a basic personal address book end to end.
- The dashboard is no longer a placeholder; it is the working personal contact home.
- CRUD flows are decision-complete enough to implement without re-deciding archive/delete semantics.
- Search and filtering expectations are explicit.
- The milestone does not conflict with the canonical schema, normalization plan, auth policy, security baseline, or consumer v1 boundaries.

## Risks and Open Questions
- The current schema still uses a simplified `Contact` model, so implementation may need an intermediate step before fully adopting the target canonical model.
- Search quality may be acceptable before full normalization, but implementation should not hide the eventual need for `ContactIdentifier`.
- Future audit event support should wrap destructive actions once the immutable audit layer is introduced.

## Acceptance Outcome
`P1-06` is complete because the app now provides the concrete signed-in dashboard/contact CRUD slice, including archive/restore and an explicit permanent-delete path.

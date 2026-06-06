# P1-05 Consumer V1 Boundaries

## Purpose
This document defines what Kontax v1 is and is not. It locks the consumer-first SaaS scope so Phase 1-5 implementation decisions stay focused, avoid accidental team-product drift, and preserve a clean path to future expansion without forcing that complexity into the initial release.

## Product Positioning
Kontax v1 is:
- a consumer-first contact home
- focused on personal relationship memory, lightweight organization, and data portability
- single-user owned in its first release
- privacy-conscious and portability-friendly

Kontax v1 is not:
- a team CRM
- a collaborative workspace platform
- a family-sharing product at launch
- a sales automation system
- a full sync hub in the earliest shipping milestone

## Core Audience
Primary audience:
- individual users who want a better personal contacts system
- freelancers, founders, creators, and professionals managing their own relationship network
- users who care about import/export and long-term portability

Secondary audience to remain compatible with later:
- households or families that may want shared books eventually
- small teams that could later benefit from shared ownership

V1 should optimize for the primary audience only.

## V1 Product Promise
Kontax v1 should promise:
- secure account creation and sign-in
- a clean personal contact dashboard
- user-owned contact CRUD
- import/export groundwork
- trustworthy duplicate handling groundwork
- a product structure that can grow into subscriptions and sync later

Kontax v1 should not promise:
- shared address books
- team permissions
- enterprise identity or compliance
- real-time collaboration
- full mobile-native sync on day one

## Explicit In-Scope for V1
- single-user account ownership
- credentials-based auth
- personal dashboard shell
- contact creation, editing, listing, searching, archiving, and deletion policy groundwork
- contact normalization groundwork
- import/export-first portability strategy
- merge planning and duplicate detection foundations
- billing schema readiness in early architecture, not necessarily billing UI immediately

## Explicit Out-of-Scope for V1
- workspaces and org membership
- role-based access control for multiple collaborators
- household/family shared books
- team inboxes, CRM pipelines, opportunity tracking, or sales workflows
- advanced workflow automation
- CardDAV sync as an initial shipping dependency
- enterprise audit/compliance packaging
- customer-managed keys or advanced regulated-data controls

## Ownership and Collaboration Boundaries
### Ownership
- Every record in v1 is owned by one `User`.
- No cross-user shared ownership is introduced.
- Subscription ownership also maps 1:1 to the user account in v1.

### Collaboration
- No user invites
- No shared contact books
- No permission matrix
- No delegated contact editing

Future compatibility rule:
- future shared books or workspaces must be additive layers above the current user-owned model
- nothing in v1 UX should pretend collaboration already exists

## Consumer Experience Boundaries
### Tone and workflow
Kontax should feel like:
- a personal relationship vault
- simple and calm rather than enterprise-heavy
- protective of the user’s data and control

Kontax should not feel like:
- a sales command center
- a corporate directory manager
- a back-office admin system

### Data portability stance
- import/export should be a core value, not an afterthought
- users should never feel locked in
- portability comes before CardDAV sync in the implementation sequence

## Mobile and Sync Boundaries
- iPhone and Android sync are future-facing roadmap items, not v1 blocking scope
- v1 should prepare identifiers and models for future CardDAV
- v1 should not delay launch waiting for protocol sync complexity
- import/export should act as the practical first portability path

## Billing and SaaS Boundaries
- Kontax is still planned as SaaS from the beginning
- billing schema and entitlement planning belong early in architecture
- monetization must not block the core value of secure personal contact management
- subscription logic should not reshape user ownership or contact data model in v1

## Security and Privacy Boundaries
- practical strong defaults are in scope now
- full field-level encryption is not required in v1
- privacy-sensitive handling of imports, exports, passwords, and future sync credentials is in scope
- advanced enterprise-grade compliance packaging is out of scope

## Feature Triage Rules
Use these rules when deciding whether a feature belongs in v1:
- If it strengthens personal contact storage, search, portability, or trust, it is likely in scope.
- If it introduces team coordination, multi-user permissions, or CRM workflow complexity, it is out of scope.
- If it is required to avoid schema rework later, it may be planned now but not necessarily built now.
- If it adds major sync complexity before import/export and merge are stable, it should be deferred.

## Future-Compatible but Deferred
These should remain visible as future-compatible but clearly deferred:
- shared/family contact books
- workspace or org accounts
- role-based collaboration
- passkeys/social login
- CardDAV account setup and sync
- mobile-native apps
- advanced encrypted fields
- enterprise admin controls

## Risks if Scope Drifts
- team/workspace work too early will complicate schema and UX
- early CardDAV commitment can delay launch and destabilize contact model decisions
- CRM feature drift can obscure the consumer value proposition
- overbuilding enterprise security controls too early can slow practical delivery without improving the v1 user experience

## Decision Rules for Later Phases
- Phase 2 billing must still assume one user owns one account.
- Phase 3 import/export should optimize for consumer portability, not bulk enterprise migration only.
- Phase 4 merge must assume consumer-style messy data and personal duplicates.
- Phase 5 sync should be introduced as a careful expansion, not a definition of the product itself.

## Acceptance Outcome
`P1-05` is complete when this boundary document is used to accept or reject roadmap work, keeping Kontax aligned with a single-user, consumer-first, portability-focused SaaS scope for v1.

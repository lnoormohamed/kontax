# P13-07 Design Brief: Family Plan Surfaces

## Purpose
This ticket is a design deliverable: a comprehensive brief covering every user-facing surface introduced by Phase 13. The designer receives this brief as the primary input for creating mockups, components, and interaction states for the family plan product. The brief covers onboarding, invite flows, workspace integration, contact detail views, group management, change propagation banners, and destructive action confirmations. It distinguishes owner, admin, and member perspectives throughout, and establishes tone guidance for the family-focused product language.

## Background
Phase 13 introduces the first multi-user sharing product in Kontax. The existing product is deeply individual — contacts belong to one user, the workspace is scoped to one user's data, and all settings are about that user's account. Family sharing breaks this paradigm and introduces:
- A shared space that co-exists with private space
- Roles with different capabilities (owner, admin, member, view-only member)
- Attribution on shared actions ("Sarah updated this contact")
- Social flows (inviting people, accepting invites, leaving groups)
- Destructive actions affecting other people's access (remove member, delete group)

The design must handle the full range of these scenarios while maintaining a warm, personal tone that feels appropriate for a product used by families rather than enterprise teams. The visual language should evoke shared ownership and trust, not corporate access control.

P13-05 and P13-06 are the implementation tickets for the surfaces described in this brief. P13-07 is complete when the designer has signed off on all surfaces and implementation can begin (or validate in-progress work against the brief).

## Scope

**In scope:**
- All surfaces listed in the Design / Implementation Spec section below
- Owner, admin, and member view distinctions for each surface
- Empty states, loading states, and error states for each surface
- Destructive action confirmation patterns
- Tone and copywriting guidance
- Accessibility requirements for interactive elements

**Out of scope:**
- Pricing page and upgrade flow (Phase 11, P11-04)
- CardDAV settings UI (Phase 9)
- Specific visual styling (colors, typography — those follow the existing Kontax design system)
- Mobile app (Kontax is a web app; mobile-responsive is in scope but native app is not)

## Design / Implementation Spec

### Tone and Language Guidance

**Voice:** Warm, direct, and human. Write as if explaining to a friend, not as a software manual.

**Avoid:** Corporate jargon ("permissions have been modified", "access has been revoked"), passive voice, technical terms exposed to users ("GroupMember", "inviteStatus", "canEdit").

**Prefer:**
- "Sarah can see and edit the family book" over "canEdit: true"
- "Remove from family group" over "Revoke membership"
- "You're view-only" over "Edit permission: false"
- "Your family book" over "shared address book"

**Pronouns and possessives:** Use the family group name wherever possible — "Smith Family" not "the family group." Fall back to "your family" when the group name is too long or unavailable.

**Error states:** Friendly and actionable. "This invite has expired — ask [Owner Name] to send a new one." Not: "Error 400: token expired."

---

### Surface 1: Family Plan Onboarding (Empty State)

**Context:** A user just upgraded to a Family plan (or was on Family plan at launch) and has not yet created a family group.

**Trigger:** Settings page, Family section. User sees a Family plan badge on their subscription but no group exists.

**What to design:**

**Empty state component** inside the settings page Family section:
- Illustration: warm, abstract representation of connected people (not a generic "no data" empty state — this is an invitation to start something)
- Headline: "Start sharing contacts with your family"
- Subtext: "Create a family group and invite up to 5 family members. You'll all share one contact book — changes anyone makes appear for everyone."
- Primary CTA button: "Create family group"
- Secondary link (small, below button): "Learn how family sharing works" (links to help docs)

**"Create family group" modal or inline form:**
- Single text input: "Group name" (placeholder: "e.g. Smith Family")
- Helper text below input: "Your family members will see this name."
- "Create group" button (primary)
- "Cancel" link
- On submit: show loading state on button, then transition to the group settings page with a success toast "Smith Family created"

**States to design:**
- Default (empty input)
- Input filled
- Submitting (button loading)
- Error (name too long, name required)

---

### Surface 2: Invite Flow

#### 2a. Sending an Invite (Owner/Admin)

**Location:** `/settings/family` — "Invite member" form section

**Form layout:**
- Label: "Invite by email"
- Email input (type="email")
- "Send invite" button
- Inline error states (invalid email, already invited, invitee in another family, group full)

**Pending invites list** (below the form):
- Each row: email address, "Sent [X] days ago", status chip, [Resend] [Cancel] actions
- Status chips: "Pending" (neutral/yellow), "Declined" (muted/gray)
- Declined rows: no action buttons, muted styling
- Empty state when no pending invites: "No pending invites"

**Group full state:**
- Form is hidden when the group is at 6 members (5 accepted + owner)
- Replace form area with: "Your family group is full (6/6 members)." with a note about the member limit

#### 2b. Invite Email (Recipient's Inbox)

Not a UI component — an email template. Design requirements for the email:

- From name: "Kontax"
- Subject: "{InviterName} invited you to join {GroupName}"
- Preview text: "Start sharing contacts with your family."
- Header: Kontax wordmark
- Body: short paragraph in plain language (see P13-02 for copy template)
- Two call-to-action buttons: "Accept Invitation" (primary, large) and "Decline" (secondary, smaller)
- If invitee has no Kontax account: additional note below CTAs: "You don't have a Kontax account yet — click Accept to create one."
- Footer: "This invite expires in 48 hours. If you didn't expect this email, you can ignore it."

**Design the email template** in a way that renders cleanly in Gmail, Apple Mail, and Outlook. Use table-based email HTML with inline styles. Match the Kontax brand color palette.

#### 2c. Accept Screen (Invitee's Browser)

**Route:** `/invite/accept?token=...`

**State 1 — Token valid, user not logged in:**
- Clean, centered page (not the main app chrome)
- Kontax wordmark
- Headline: "[GroupName] invited you"
- Subtext: "[InviterName] is inviting you to join their family contacts."
- If user has account: "Sign in to accept" (leads to login with return URL)
- If new user (`?register=true`): inline registration form (name + password, email shown as read-only)
- "Accept and Join" button (after login or registration)

**State 2 — Token valid, user logged in as correct email:**
- Confirmation view: group name, who invited them, "You'll be able to view and edit shared family contacts."
- "Accept Invitation" button (primary)
- "Decline" text link (secondary)

**State 3 — Token expired:**
- Friendly error: "This invite has expired."
- Subtext: "Invitations expire after 48 hours. Ask [InviterName] to send a new one."
- No action buttons (there is nothing useful to do)

**State 4 — Token already used:**
- "This invite has already been accepted."
- Link to sign in and go to workspace (if not logged in)

**State 5 — Email mismatch:**
- "This invite was sent to [inviteEmail], but you're signed in as [userEmail]."
- "Sign out and sign in with [inviteEmail] to accept."

#### 2d. Decline Screen

- Clean page, Kontax wordmark
- "Decline invitation to [GroupName]?"
- "You won't have access to the family address book. You can ask [InviterName] to invite you again later."
- "Decline" button (secondary/destructive)
- "Never mind, take me to accept" link

---

### Surface 3: Workspace Integration

#### 3a. Contact List with Family Badge

**Contact row anatomy (updated):**
```
[Avatar] [Name]           [Family badge?]    [Email]    [...]
```

- "Family" badge: small pill/chip — 4px border radius, 12px font, appears to the right of the contact name
- Badge color: warm accent color distinct from sync source badges (suggest a soft orange or amber — not the blue used for CardDAV sources)
- Badge text: "Family" (not "Shared" — "Family" reinforces the context)
- Badge is only visible on shared contacts; private contacts have no badge
- When contact is archived: show archived state badge instead of or in addition to Family badge (discuss with eng — P13-03 allows archived shared contacts to remain visible)

#### 3b. View Toggle (Private / Family / All)

**Component:** Segmented control / button group

```
[All]  [Private]  [Family]
```

- "All" is the default active state on first load
- Inactive tabs: muted text, no background
- Active tab: solid background (use existing selected tab style from the design system)
- The toggle row appears directly above the contact search bar
- Hide the entire toggle (show nothing) for users who are not family group members

**Empty states for each tab:**
- Private tab, no private contacts: "You don't have any private contacts yet. [Import contacts] or [Add a contact]"
- Family tab, no shared contacts: "Your family book is empty. [Add a contact to the family book] or [Copy a contact to family]"
- All tab, no contacts at all: existing empty state

#### 3c. Create Contact Target Selector

When the user opens the "New contact" form or flow, if they are a family member with canEdit: true, show a destination selector before or within the form:

**Design option A — Destination selector at the top of the form:**
```
Save to:
( ) Private contacts (default)
( ) Family book — Smith Family
```
Radio buttons or a segmented control. "Private contacts" selected by default.

**Design option B — Selector as a dropdown in the form footer:**
"Add to: [Private contacts ▾]" — clicking opens a dropdown with the two options.

Either approach is acceptable. Consult with engineering on implementation preference (P13-03 uses a `targetAddressBook` param in the API, which both designs map to equally well).

**View-only members:** Do not show the target selector. "Private contacts" is the only destination and no selector is needed.

---

### Surface 4: Contact Detail for Shared Contact

**Location:** Contact detail page / sheet, when the displayed contact is a shared contact (isShared: true)

#### 4a. Family Address Book Source Badge

In the sources section of the contact detail:

```
[Family icon] Family address book · Smith Family
```

The family icon should be distinct from the CardDAV sync source icon (which uses a sync/cloud metaphor). Suggest a small "people" or "house" icon. Use the same warm accent color as the Family badge in the contact list.

This badge appears alongside (not instead of) other source badges if the contact also has a sync source.

#### 4b. Last Updated By Attribution

Below the Family source badge or in a metadata row:

```
Last updated by Sarah Kim · 3 days ago
```

- User name: show display name of the group member who last edited
- Timestamp: relative ("3 days ago", "just now", "yesterday") with absolute tooltip on hover
- If the last event was a creation rather than an update: "Added by Sarah Kim · 3 days ago"
- If no attribution available: omit this row entirely (do not show "Unknown")

#### 4c. Edit and Action Buttons — canEdit: false State

For view-only members, the contact detail toolbar should clearly indicate the read-only state:

- "Edit" button: hidden (remove from the toolbar, don't just disable — disabled buttons with no tooltip are confusing)
- "Archive" / "Delete" button: hidden
- Add a small informational chip or subtitle near the top of the contact detail:
  ```
  [Eye icon] View only · You don't have edit access to this family book.
  ```
  This chip is small and non-intrusive — it should not dominate the contact detail view.

- Export button: still visible (view-only members can export shared contacts)
- "Share" button (if applicable): still visible

#### 4d. "Add to Family Book" Action on Private Contacts

For private contacts (isShared: false) when the user is a family member with canEdit: true:

In the contact detail toolbar or the contact's action menu (ellipsis menu), add:
```
[Family icon] Add to family book
```

After clicking:
- Show a confirmation popover or small modal:
  ```
  Add to Smith Family?
  
  A copy will be added to your family book. Changes to the
  family copy won't affect your private contact.
  
  [Cancel]  [Add to family book]
  ```
- On success: toast notification "Added to Smith Family. The shared copy is independent."
- On error (already in book): "This contact is already in your family book."

**Do not show this action** if:
- The user is not a family group member
- The user is view-only (canEdit: false)
- The contact is already in the family book (show "Already in family book" as a disabled state instead of hiding the action, so the user knows it's there)

---

### Surface 5: Family Group Management Page

**Route:** `/settings/family`

**Page layout:**
- Standard settings page layout (sidebar nav + main content area, consistent with existing settings pages)
- Page title: "[GroupName] · Family Group"
- Three to four sections (see below)

#### 5a. Members Section

**Section header:** "Members (N/6)"

**Member list item design:**
```
[Avatar] Name             [Role badge]   Joined Jan 2025   [canEdit toggle]   [Actions ▾]
         email@address.com
```

**Role badges:**
- OWNER: amber/gold filled badge ("Owner")
- ADMIN: blue filled badge ("Admin")
- MEMBER: gray outlined badge ("Member")

**canEdit toggle:**
- Switch component (on/off) with label "Can edit"
- When off: label changes to "View only"
- Owner's own row: no toggle (owner always has full access)
- Admin toggling another admin's canEdit: only if acting user is OWNER

**Actions dropdown (ellipsis or three-dot menu):**
- For OWNER viewing an ADMIN row: "Demote to Member", "Remove from group"
- For OWNER viewing a MEMBER row: "Promote to Admin", "Remove from group"
- For ADMIN viewing a MEMBER row: "Remove from group"
- For anyone viewing their own row: "Leave group" (ADMIN/MEMBER only)

#### 5b. Pending Invites Section

**Section header:** "Invitations" (with count if > 0)

**Pending invite list item:**
```
[Email icon] friend@email.com    Sent 3 days ago    [Pending chip]   [Resend] [Cancel]
```

**Chips:**
- Pending: yellow/amber chip
- Declined: muted gray chip

**Cancelled state:** rows are removed from the list immediately after cancellation (optimistic UI).

#### 5c. Invite New Member Form

**Shown for:** OWNER and ADMIN

```
Invite someone to Smith Family
[Email input field]  [Send invite button]
```

Error messages inline:
- "Please enter a valid email address."
- "[Email] is already in Smith Family."
- "Your family group is full — you've reached the 6-member limit."
- "[Email] is already in another family group and can't join a second one."

**Disabled state when group is full:** Show the form greyed out with explanatory text instead of removing it entirely.

#### 5d. Danger Zone

Standard danger zone section (red/coral background border, warning icon):

**For MEMBER/ADMIN:**
```
Leave Smith Family

If you leave, you'll lose access to the family address book.
Your private contacts won't be affected.

[Leave Smith Family] (destructive button)
```

**For OWNER:**
```
Transfer ownership

Transfer this family group to another member. Your plan will change to Pro.

[Transfer ownership] (secondary destructive)
```

and:

```
Delete Smith Family

Permanently delete the family group and all shared contacts.
All members will lose access. This cannot be undone.

[Delete Smith Family] (destructive button)
```

#### 5e. Confirmation Dialogs

**Remove member confirmation:**
```
Modal title: Remove Sarah Kim?
Body: Sarah will lose access to the family address book right away.
      Her private contacts won't be affected.
Actions: [Cancel] [Remove]
```

**Leave group confirmation:**
```
Modal title: Leave Smith Family?
Body: You'll lose access to the family address book right away.
      Your private contacts won't be affected.
Actions: [Cancel] [Leave group]
```

**Delete group confirmation:**
```
Modal title: Delete Smith Family?
Body: 
  This will permanently delete the shared family address book and all [N] contacts in it.
  All 6 members will lose access immediately.
  Your private contacts won't be affected.
  
  This cannot be undone.

Typed confirmation input:
  Label: "Type 'Smith Family' to confirm"
  Input (type="text")
  
Actions: [Cancel] [Delete Smith Family] (Delete button is disabled until typed confirmation matches)
```

**Transfer ownership confirmation:**
```
Modal title: Transfer ownership to [Name]?
Body:
  [Name] will become the owner of Smith Family and take over the Family plan billing.
  You'll become an Admin member.
  
  If [Name] cancels their Family plan, all members will lose access to the shared book.
  
Typed confirmation input:
  Label: "Type '[Name]' to confirm"
  Input

Actions: [Cancel] [Transfer ownership]
```

---

### Surface 6: Change Propagation Banner

**Location:** Top of the contacts workspace, between the page header and the view toggle

**Appearance:** Non-blocking banner (not a modal, not a blocking overlay)

```
[Refresh icon] Your family book was updated by Sarah.   [Refresh contacts]   [×]
```

- Background: soft warm color (suggest the same warm accent used for Family badges, at low opacity)
- Text: concise attribution if available ("updated by Sarah") or generic ("Your family book was updated")
- "Refresh contacts" button: clicking re-fetches the contact list and dismisses the banner
- "×" button: dismisses the banner without refreshing
- Auto-dismiss: do NOT auto-dismiss. The user should choose when to refresh. Auto-refresh could interrupt what they're doing.
- Accessibility: `role="status"` and `aria-live="polite"` so screen readers announce it without interrupting current focus
- Position: banner slides in from the top (CSS transition) — do not use a toast for this because toasts disappear and the user may miss them. This banner should persist until dismissed.

**Multiple updates:** If the shared book is updated multiple times while the banner is showing, the banner text updates but does not stack (one banner max). "Your family book has been updated several times." if > 3 updates arrive before the user dismisses.

---

### Owner View vs Member View Summary

| Surface | Owner sees | Admin sees | Member sees | View-only member sees |
|---|---|---|---|---|
| Settings family section | Group name, member count, Manage link | Same | Group name, member count, Manage link | Same |
| Management page — members | All controls | Invite/remove MEMBERs, toggle canEdit for MEMBERs | Read-only list + Leave button | Same as MEMBER |
| Management page — invite form | Yes | Yes | No | No |
| Management page — danger zone | Leave (can't — must transfer first), Transfer, Delete | Leave | Leave | Leave |
| Workspace view toggle | All / Private / Family | Same | Same | Same |
| Workspace create contact | Private + Family options | Same | Same | Private only |
| Contact detail — shared | Full edit/archive actions | Same | Same | View-only chip, no edit |
| Contact detail — Add to family book | Yes | Yes | Yes | No |

---

### Accessibility Requirements

- All interactive elements have visible focus rings
- Role badges are not conveyed by color alone — include text label
- canEdit toggle has an accessible label: "Allow Sarah to edit the family book" (not just "toggle")
- Confirmation dialogs trap focus while open and return focus to the trigger element when closed
- The "Family book updated" banner uses `aria-live="polite"` and does not interrupt user interactions
- Family badge in contact list is visible at 4.5:1 contrast ratio against the row background
- All destructive action confirmation inputs have `autocomplete="off"` to prevent browsers from auto-filling the confirmation text

---

## Acceptance Criteria

- Design brief covers all six surface categories (onboarding, invite flow, workspace integration, contact detail, management page, propagation banner)
- Owner, admin, and member views are explicitly distinguished in the brief for every surface where they differ
- Every destructive action (remove member, leave group, delete group, transfer ownership) has a specified confirmation pattern
- Empty states are defined for: no group (onboarding), no shared contacts (family tab), no pending invites (management page)
- Tone guidance is written and actionable — copywriters and engineers implementing copy can follow it without asking clarifying questions
- The design brief is signed off by the lead designer before P13-05 and P13-06 implementation reviews begin
- All interactive states are specified: default, hover/focus, active, loading, error, disabled

## Risks and Open Questions

- **"Family" vs "Shared" language:** The brief uses "Family" consistently (Family book, Family badge). If the same infrastructure is reused for Teams (Phase 14) where "Shared" or "Team" is more appropriate, the copy will need to branch. Confirm with product whether the term "Family book" is hardcoded for FAMILY groups or whether it should derive from the GroupAddressBook.name (which could be set to any value). The implementation uses GroupAddressBook.name, so the display should too — "Smith Family's book" not just "Family book".
- **The Family badge color:** The brief recommends a warm amber/orange accent. Confirm this does not conflict with any existing badge or status color in the Kontax design system (e.g., if amber is already used for warnings, use a different hue).
- **Attribution text from actorDetail:** The actorDetail field is `"{Name} via Family Book"`. Extracting the name for display (substring before " via Family Book") is fragile if the format ever changes. Consider storing the actor's userId separately in the payload so the UI can look up the display name freshly rather than parsing the actorDetail string.
- **Owner transfer "coming soon" state:** The design must include a graceful coming-soon state for ownership transfer. Confirm with PM whether this state should be hidden entirely (no button) or shown as a disabled button with a "coming soon" tooltip.

## Outcome
The designer has a complete, tone-guided brief covering all Phase 13 user-facing surfaces, with explicit role-based distinctions and confirmation patterns for all destructive actions.

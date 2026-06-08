# P12-07 Design Brief: Sharing UI

## Purpose
This ticket produces the design brief that guides the visual design of all Phase 12 sharing surfaces. The engineering tickets P12-02 through P12-06 implement the functional structure of sharing; this brief ensures the designer has complete coverage of every surface, state, and user perspective before mockups are produced. A complete brief prevents mid-design course corrections caused by missing edge cases, unspecified plan-gate states, or visual ambiguity between sharing-related badges and existing sync badges from Phases 9 and 10.

## Background
Phase 9 introduced CardDAV server sync and Phase 10 introduced source badges on contacts showing where each contact came from (manual, imported, synced). These source badges use a specific visual language — a small icon and label in the contact detail header — that must not be confused with the new "Live from [Owner]" badge introduced in Phase 12. Both badges appear on contacts, both relate to external data sources, and both involve sync concepts. The distinction must be visually unambiguous to users.

Phase 11 established the four plan tiers: Free, Pro, Family, Teams. Sharing features are plan-gated, and the design must handle the locked state for Free users in a way that is informative and motivating rather than frustrating or confusing. The pattern established for other plan gates (activity log, advanced merge) should be referenced for consistency.

The contact detail page design in the current app is the reference baseline. The sharing section is additive — it must integrate visually with the existing page layout without disrupting the established hierarchy.

## Scope

**In scope:**
- Share action button: placement, style, and trigger behavior on contact detail
- Share sheet: three-option layout, option labels, descriptions, plan-gate locked states for Free
- vCard link display: URL preview, copy button, expiry indicator, download count, revoke action
- Active shares list on contact detail (owner view): row layout for vCard links and account shares, status indicators, revoke action
- "Live from [Owner]" badge: style, placement, content, distinction from sync badges
- "Shared by [Owner]" badge for static received contacts
- Incoming shares notification: badge in workspace header, visual treatment
- Pending shares page: card layout, contact preview, share type badge, accept/decline actions
- Historical shares section on pending shares page
- Empty states for sharing section, pending shares page
- Plan-gate states: locked option treatment in share sheet, upgrade CTA in sharing section
- Error and loading states for all sharing actions
- Mobile-first responsive behavior for share sheet and pending shares page
- Annotation guidance for engineers implementing P12-05 and P12-06

**Out of scope:**
- Pricing page or upgrade flow design (Phase 11, P11-04)
- Email notification templates (engineering concern in P12-06)
- The underlying contact detail page layout beyond what is needed to integrate the sharing section
- Icons and illustrations (source from existing icon library — do not introduce new ones unless strictly necessary)

---

## Design / Implementation Spec

This section documents the design requirements for each surface. The designer will produce mockups based on these requirements. Engineers implementing P12-05 and P12-06 should treat the completed mockups as authoritative for visual decisions, with this spec as the content and behavioral guide.

### 1. Share Action Button

**Placement:** The share button appears in the contact detail header action area — the same row as the edit button. It uses a share/export icon. Label: "Share" on larger viewports; icon-only on mobile (with tooltip "Share contact").

**Style:** Secondary button (not primary — the primary action in the contact detail is "Edit"). Consistent with the secondary button style elsewhere in the app.

**Trigger:** Opens the share sheet. On mobile, the sheet slides up from the bottom. On desktop (>768px), the sheet appears as a dropdown or popover anchored to the button.

**When no shares exist:** The button label may optionally include a subtle indicator, but this is not required. Keep the button simple.

**When active shares exist:** Consider adding a subtle badge (a small dot or number) to the share button to indicate there are active shares. This is optional and the designer should assess whether it adds clarity or clutter given the sharing section on the detail page already shows the list.

### 2. Share Sheet

The share sheet is a contained overlay showing three options. Design principles:
- Each option should read as an independent action with a clear label and short description.
- The plan gate (locked) state for Free users must be integrated directly into the option, not shown as a separate overlay.
- The sheet must not feel like a settings panel — it should feel like a fast, purposeful action menu.

**Option 1: Copy share link**
- Available to all plans.
- Icon: link or chain icon (from existing library).
- Label: "Copy share link"
- Description: "Anyone with the link can download this contact."
- Sub-state for Free: show a small inline note below the description: "Link expires in 7 days." Use a neutral/informational tone, not a warning.
- Sub-state for Pro+ with no active link: description as above.
- Sub-state for Pro+ with active link: show a mini preview inline: `aB3xQ7mZ…  ·  2 downloads  ·  No expiry`. Tapping the option copies the URL immediately.
- Sub-state for Pro+ who wants to set expiry: a "Set expiry" secondary action beneath the option expands an inline date picker. This is an optional interaction; the default is to copy the link without setting an expiry.

**Option 2: Share with a Kontax user — Static**
- Free plan: locked state (see Locked State treatment below).
- Pro+: tap opens an inline email input below the option (the sheet expands to accommodate it). Input has a "Send" action. The keyboard appears on mobile.
- Label: "Send a contact copy"
- Description: "The recipient gets an independent copy of this contact."
- Icon: person-plus icon.

**Option 3: Share with a Kontax user — Live**
- Free plan: locked state.
- Pro+: tap opens an inline email input, same as Option 2.
- Label: "Share live contact"
- Description: "Their copy stays updated when you edit this contact. Both parties need a paid plan."
- Icon: a sync/cycle icon (distinct from the CardDAV sync icon used in Phase 9 — must use a different icon so there is no confusion between account-level CardDAV sync and per-contact live sharing).

**Locked State Treatment:**
- The option is visible but visually dimmed (reduced opacity — approximately 50%).
- A "Pro" plan badge appears inline to the right of the option label. Use the existing plan badge style if one exists, otherwise design a small pill badge.
- A lock icon appears to the left of the option icon (or replaces it).
- Tapping a locked option does not activate the input — it shows an inline upgrade prompt directly within the option area: "Available on Pro. [View Pro plans →]"
- The "View Pro plans" CTA opens the pricing page.
- Do not collapse locked options or put them behind a "Show more" — they should always be visible so Free users can see what upgrading would unlock.

**Sheet Dimensions:**
- Mobile: full-width bottom sheet with rounded top corners. Maximum height: 60% of viewport. Scrollable if content overflows.
- Desktop: popover, minimum width 320px, maximum width 400px.
- Sheet header: "Share {contactFirstName}" with a close button (X). No heavy shadow or decorative elements.

### 3. Active Shares List on Contact Detail (Owner View)

**Section placement:** Below the contact fields section, before the activity log. The section header is "Sharing". If the contact has no active shares, the section shows the empty state and the "Share contact" button. If there are active shares, the list is shown followed by the "Share contact" button.

**Section structure for a contact with mixed shares:**

```
Sharing
────────────────────────────────────────────────

vCard links
  [VCardLinkRow]
  [VCardLinkRow]

Shared with Kontax users
  [AccountShareRow]
  [AccountShareRow]

[Share contact ↗]
```

If there are only vCard links, do not show the "Shared with Kontax users" sub-header (and vice versa). Only show sub-headers when both types are present.

**VCardLinkRow layout (horizontal):**

```
[link icon]  aB3xQ7mZ…                              [copy] [revoke]
             Expires in 4 days  ·  7 downloads  ·  Created 2 days ago
```

- Token preview in monospace or code style.
- Copy icon button: copies URL, shows "Copied" for 1.5 seconds.
- Revoke button: text link style ("Revoke"), in a destructive/warning color. Only shown for ACTIVE status.
- Status for non-ACTIVE rows: show a "Revoked" or "Expired" pill badge instead of the revoke button.
- The row for an EXPIRED vCard link should be visually de-emphasized (lower contrast) to indicate it is no longer functional.

**AccountShareRow layout:**

```
[avatar]  Jane Smith                    [Static]  [Active ●]
          Primary email or phone                  [Revoke]
```

For Live shares with accepted status:
```
[avatar]  Jane Smith                    [Live]   [Active ●]
          jane@example.com             Synced 3 min ago   [Revoke]
```

For pending status:
```
[avatar]  alex@company.com              [Live]   [Pending ◌]
          Sent 2 hours ago                       [Cancel]
```

For declined status:
```
[avatar]  Bob Jones                     [Static]  [Declined ✕]
          Declined 1 day ago
```

**Type badges:**
- "Static" badge: neutral/gray pill. Communicates that this is a one-time delivery.
- "Live" badge: a distinct color, ideally one that reads as "active/connected." Blue or teal works well. The badge must not use the same color as the CardDAV sync status indicator in Phase 9 — verify with the existing design system colors.

**Status indicators:**
- Active ●: green dot or green text. For account shares, "Active" after acceptance. For vCard links, "Active" while not expired.
- Pending ◌: amber/yellow. Awaiting recipient action.
- Declined ✕: red or neutral. Terminal state.
- Revoked: neutral gray. Terminal state.
- Expired: neutral gray. Terminal state.

### 4. "Live from [Owner]" Badge — Recipient Perspective

This is the most sensitive visual design challenge in Phase 12 because it must be clearly different from:
- The CardDAV sync account badge from Phase 9 (e.g. "Synced from iCloud")
- The import source badge from Phase 10 (e.g. "Imported from CSV")

**Positioning:** Directly below the contact avatar and display name, above the field list. It appears as a distinct banner/callout, not an inline badge.

**Visual treatment:** A contained row with a background color that differentiates it from both the CardDAV badge (which uses the sync account's brand color or a generic sync color) and the import badge (which uses a neutral import color). Proposed: use a soft purple or indigo tint. This color should be new to the app's palette for this specific concept.

**Content:**
```
↻  Live contact from Jane Smith
   Last updated 3 minutes ago   ·   [Unlink]
```

The ↻ icon (or equivalent "live/sync in a circle" icon) should be distinct from the CardDAV sync icon used in Phase 9. If the Phase 9 sync badge uses ↻, use a different icon here (e.g. a chain link with a refresh indicator, or a "share with sync" compound icon).

**"Shared by [Owner]" badge — for static received contacts:**
```
   Shared by Jane Smith · Received 5 days ago
```

This is a simpler, non-interactive badge. It uses a neutral background (no color tint needed — it is terminal/read-only). No icon beyond a standard person/share icon. No action button.

**Visual differentiation table:**

| Badge type | Color | Icon | Interactive |
|---|---|---|---|
| CardDAV sync (Phase 9) | Blue/provider brand color | Cloud sync icon | No (links to sync settings) |
| Import source (Phase 10) | Neutral gray | Upload/import icon | No |
| Live from owner (Phase 12) | Soft purple/indigo | Live share icon (NEW) | Yes (Unlink button) |
| Shared by owner — static (Phase 12) | Neutral gray | Share icon | No |

The designer must verify this table against the actual Phase 9/10 badge designs and adjust as needed. The core requirement is that a user who has CardDAV synced contacts, imported contacts, and live-shared contacts in their account can visually distinguish between all three source types without reading the label text.

**Edit lock indicators on SHARED_LIVE contacts:**
- All shared field inputs render with a lock icon appended to the field label.
- The lock icon tooltip: "Managed by {ownerName}"
- The "My notes" / private notes field renders normally without a lock icon.
- The edit action in the contact header: replace the "Edit" button with a "Manage" button that opens a small sheet showing the live badge details and the unlink option. This prevents users from accidentally trying to edit a field and getting a confusing error.

### 5. Incoming Shares Notification Badge

**Placement:** In the workspace header/navigation bar, near the user avatar or in the main navigation. Exact placement depends on the current header layout — attach to the most prominent navigation element.

**Style:** Red notification dot (no number) when count is 1–3. Number badge when count is 4+. The badge must not overflow or clip into adjacent elements.

**Behavior:** Clicking the badge navigates to `/contacts/shares/pending`.

**Accessibility:** The navigation element containing the badge must have `aria-label="Pending contact shares: {N}"`.

### 6. Pending Shares Page

**Page header:**
- Title: "Shared with you"
- Sub-header count: "3 pending"

**PendingShareCard layout:**

```
┌─────────────────────────────────────────────────────────────────┐
│  [avatar]  Jane Smith  ·  Sent 2 hours ago           [Live ↻]  │
│────────────────────────────────────────────────────────────────│
│  [contact avatar / initials]                                    │
│  Alex Johnson                                                   │
│  Acme Corp  ·  VP of Sales                                      │
│  +1 (555) 123-4567                                              │
│  alex@acme.com                                                  │
│                                                                 │
│  ↻  Live contact — will stay in sync with Jane's edits.        │
│                                                                 │
│  [Accept]          [Decline]                                    │
└─────────────────────────────────────────────────────────────────┘
```

The contact preview section is a mini contact card with the same field layout as the contact list item view. Avatar/initials takes the same size as the contact list avatars.

**Card states:**
- Default: as above.
- Accepting (loading): both buttons disabled, spinner inside "Accept" button.
- Declining (confirming): "Are you sure? The sender will be notified." · "Yes, decline" · "Cancel" — inline, no modal.
- Accepted (exiting): card animates out (slide down + fade) after a 0.5s success flash.
- Declined (exiting): same animation after 0.5s.

**Card type variants:**
- Static share: no live sync note. Sub-header shows [Static].
- Live share on paid plan recipient: shows the live sync note.
- Live share on Free plan recipient: shows the Free plan warning note.

**Historical section:**
Rows, not cards. More compact. Read-only. No actions.

```
Alex Johnson   ·   from Jane Smith   ·   Accepted · 3 days ago   [View contact →]
Priya Mehta    ·   from Bob Jones    ·   Declined · 1 week ago
```

**Empty state:**
```
[Illustration: a simple inbox/envelope or person-share icon]
No pending shares
Contacts shared with you by Kontax users will appear here.
```

### 7. Plan-Gate States in Sharing Section on Contact Detail

**Free user with no shares:**
- Shows "Copy share link" button prominently.
- Below it, a section with a light background: "Share directly with other Kontax users — available on Pro" with an "Upgrade" button.

**Free user after creating a vCard link:**
- Shows the vCard link row with expiry countdown.
- Still shows the upgrade CTA below.

**Pro+ user with no shares:**
- Simple: "No active shares yet." + "Share contact" button.

**Pro+ user mid-share-creation (email input open):**
- The share sheet is expanded with the inline email input visible.

### 8. Loading and Skeleton States

- Sharing section skeleton: two rows of approximate height matching a vCard link row, with standard skeleton shimmer animation.
- Pending shares page: three skeleton cards while data loads.
- Button loading: spinner replaces button text, button width stays fixed to prevent layout shift.

---

## Acceptance Criteria

- The design brief covers all eight surfaces listed in the Scope section.
- Each surface includes specifications for all relevant plan tiers (Free, Pro+) and user perspectives (owner, recipient).
- The "Live from [Owner]" badge is visually distinct from the CardDAV sync badge (Phase 9) and the import source badge (Phase 10) — documented in a comparison table or side-by-side illustration.
- Locked states for Free users are designed as informative and motivating, not hidden or broken.
- Every interactive state (default, hover, loading, success, error) is documented for share creation, revocation, accept, and decline actions.
- Empty states are designed for all surfaces (sharing section, pending shares page).
- The share sheet is designed for both mobile (bottom sheet) and desktop (popover) viewport sizes.
- The brief distinguishes clearly between the owner perspective and the recipient perspective on all surfaces.
- Engineers implementing P12-05 and P12-06 can use the brief and resulting mockups without needing additional design clarification for any documented state.

---

## Risks and Open Questions

- **Phase 9/10 badge visual collision** — the designer must review the existing source badge implementation before finalizing the "Live from [Owner]" badge. If the current Phase 9/10 badges already use the intended color or icon, an alternative must be chosen. This review should happen before mockup production begins.
- **Share sheet email input on mobile** — on mobile, the inline email input within the share sheet (a bottom sheet) will cause the keyboard to appear. The bottom sheet must scroll or resize to keep the input and send button above the keyboard. This is a non-trivial interaction detail — the designer should specify the exact keyboard-aware behavior and the engineer should test it on real devices.
- **"Manage" button vs "Edit" button on live contacts** — replacing the standard "Edit" button with "Manage" on live contacts is a significant UX change. The designer should evaluate whether this disrupts muscle memory enough to warrant a different approach (e.g., keeping "Edit" but showing a lock indicator when edit mode is entered and a field is non-editable).
- **Multiple live shares from different senders** — a user could theoretically accept live shares from multiple senders for the same person (e.g., two colleagues both sharing a contact for the same person). In this case, the contact has two "Live from" badges. Design should specify how this is displayed — two stacked banners, or a combined banner? For v1, consider limiting to one live share per contact on the recipient side.
- **Notification badge position** — the brief must specify where the notification badge sits relative to the existing workspace header elements. Confirm there is a placeholder in the current header design before finalizing placement.
- **Dark mode** — if the app supports dark mode, the sharing badge colors (especially the soft purple/indigo for the live badge) must have dark mode variants. Confirm whether dark mode is in scope for Phase 12 or whether sharing UI ships light-mode only with dark mode as a follow-up.

---

## Outcome

The designer has a complete, unambiguous brief covering every sharing UI surface, all plan-gate states, owner and recipient perspectives, and the visual distinction between sharing badges and existing sync/import badges — enabling the full sharing UI to be designed and handed off to engineering without gaps.

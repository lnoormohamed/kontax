# P12-05 Share Management UI on Contact Detail

## Purpose
This ticket implements the complete sharing UI surface on the contact detail page, giving contact owners a single place to see all active and past shares for a contact, initiate new shares, and revoke existing ones. Without this management layer, users have no visibility into who they have shared a contact with, no way to audit download counts on vCard links, and no way to revoke access. Clear share management is essential for user trust and for the product to be usable in professional and privacy-conscious scenarios.

## Background
Phases P12-02, P12-03, and P12-04 implement the server-side mechanics for all three sharing modes. This ticket is the UI layer that surfaces those mechanics consistently. The design brief in P12-07 provides the visual specifications; this ticket is the engineering implementation of those designs within the existing Next.js + React contact detail page.

The existing contact detail page already renders contact fields, the activity log, and sync source badges from Phase 10. The "Sharing" section is a new collapsible panel added below or alongside the existing sections. The panel must be present for all users (Free, Pro, Family, Teams) but its content and available actions differ by plan tier.

Phase 12-06 handles the incoming share notification badge in the workspace header and the dedicated pending shares view. This ticket handles only the outbound (owner-perspective) share management on the contact detail page, plus the "Live from [Owner]" badge on the recipient's contact detail.

## Scope

**In scope:**
- "Sharing" section on the contact detail page (owner perspective)
- Active vCard link display: token preview, created date, expiry, download count, revoke button
- Active account shares display: recipient name/email, type badge, status, last synced (for Live), revoke/unlink button
- Share action button: opens share sheet with three options (plan-gated)
- Share sheet: "Copy share link", "Share with a Kontax user — Static", "Share with a Kontax user — Live"
- Plan gate rendering: disabled options with upgrade CTA for Free users
- "Live from [Owner]" badge on recipient's SHARED_LIVE contact detail page
- Last-synced timestamp display on live contacts (recipient perspective)
- Share creation confirmation states (spinner, success, error)
- Revoke confirmation dialog (to prevent accidental revocation)
- Empty state for the sharing section (no shares yet)
- Loading/skeleton states for the sharing section

**Out of scope:**
- Incoming share notifications and accept/decline flow (P12-06)
- Design specifications (P12-07)
- Email notifications (P12-03, P12-06)
- Propagation status details beyond "last synced" (P12-08 adds error states)

---

## Design / Implementation Spec

### Data Loading

The contact detail page must fetch sharing data alongside the contact. Add a `shares` query to the contact detail data loader:

```typescript
// In the contact detail server component data fetch
const [contact, shares] = await Promise.all([
  getContact(contactId, userId),
  getContactShares(contactId, userId),
]);
```

`getContactShares` returns:

```typescript
type ShareSummary = {
  id: string;
  shareType: "VCARD_LINK" | "STATIC_COPY" | "LIVE_SYNC";
  status: "ACTIVE" | "REVOKED" | "EXPIRED" | "DECLINED";
  token: string | null;              // First 8 chars only — never send full token to client
  recipientName: string | null;      // Resolved from recipientUserId.name
  recipientEmail: string | null;
  createdAt: string;                 // ISO timestamp
  expiresAt: string | null;
  revokedAt: string | null;
  downloadCount: number;
  lastPushedAt: string | null;
  lastErrorAt: string | null;        // From P12-08 — may be null if not yet implemented
  lastErrorCode: string | null;
  recipientAccepted: boolean;        // recipientContactId !== null
};
```

**Security: Never return the full token in the API response.** The full token is only needed to construct the share URL. Instead, return the first 8 characters for display and the full URL. Construct the URL server-side and return it:

```typescript
shareUrl: share.token ? `${process.env.NEXT_PUBLIC_APP_URL}/share/${share.token}` : null,
tokenPreview: share.token ? share.token.substring(0, 8) + "…" : null,
```

Only ACTIVE shares need the full URL. For REVOKED and EXPIRED shares, `shareUrl` can be null — the URL no longer works.

Filter shares for display:

- Owner view: show ACTIVE shares (all types), plus REVOKED and EXPIRED vCard links from the last 30 days (so owners can see recently-expired links), and DECLINED account shares.
- Do not show shares older than 90 days that are in a terminal state — this keeps the list clean.

### Component Architecture

```
ContactDetail (Server Component)
└── ContactSharingSection (Client Component)
    ├── ShareActionButton
    │   └── ShareSheet (popover/bottom-sheet)
    │       ├── CopyShareLinkOption
    │       ├── StaticShareOption
    │       └── LiveShareOption
    ├── VCardLinksList
    │   └── VCardLinkRow (one per active/recent vCard link)
    │       └── RevocationConfirmDialog
    └── AccountSharesList
        └── AccountShareRow (one per account share)
            └── RevocationConfirmDialog
```

All share mutation actions (create, revoke, unlink) use React transitions with `useTransition` to show optimistic loading states without blocking the UI.

### ContactSharingSection

The section renders inside the contact detail layout. It is visible to all users but its content varies:

**Free plan:**
```
Sharing
─────────────────────────────
[Active vCard link if present]
  └── aB3xQ7mZ…  · Expires in 4 days · 2 downloads  [Revoke]
[Upgrade prompt for account sharing]
  "Share directly with Kontax users. Available on Pro."
  [Upgrade to Pro →]
[Share button] → opens sheet with Copy link enabled, others locked
```

**Pro+ plan with no shares:**
```
Sharing
─────────────────────────────
No active shares.
[Share contact]
```

**Pro+ plan with shares:**
```
Sharing
─────────────────────────────
vCard links
  aB3xQ7mZ…  · No expiry · 14 downloads  [Revoke]

Shared with Kontax users
  Jane Smith  ·  Static  ·  Accepted
  alex@example.com  ·  Live  ·  Pending
  Bob Jones  ·  Live  ·  Active  ·  Synced 2 min ago   [Revoke]
[Share contact]
```

### VCardLinkRow Component

Props: `share: ShareSummary`

Display:
- Token preview: monospace, e.g. `aB3xQ7mZ…`
- Copy button: clicking copies the full share URL to clipboard. Shows a "Copied" flash animation for 1.5 seconds.
- Status badge: "Active" (green), "Expired" (neutral), "Revoked" (red)
- Expiry line: "Expires in N days" / "Expired N days ago" / "No expiry"
- Download count: "N downloads" (singular "1 download", plural otherwise)
- Created date: "Created N days ago" (relative, with absolute date on hover)
- Revoke button: only shown when status is ACTIVE

Revoke flow:
1. User clicks "Revoke"
2. Confirmation dialog: "Revoke this share link? Anyone with the link will no longer be able to download the contact. This cannot be undone."
3. Confirm: calls `revokeShareLink(shareId)` via server action, updates share status optimistically.
4. Row transitions to "Revoked" state. Does not disappear immediately — remains visible for 5 seconds with the revoked badge, then fades out or collapses.

### AccountShareRow Component

Props: `share: ShareSummary`

Display varies by status:

**Pending (not yet accepted):**
- Recipient identifier: name (if known) or email
- Type badge: "Static" or "Live"
- Status: "Pending" (amber badge)
- Sent date: "Sent N hours ago"
- No last-synced (not yet connected)
- Cancel button: cancels the pending share (sets status REVOKED, notifies recipient)

**Active (accepted):**
- Recipient name
- Type badge
- Status: "Active" (green badge)
- For Live shares: "Synced N minutes ago" (from `lastPushedAt`) or "Awaiting first sync"
- For Static shares: "Accepted N days ago" — no ongoing sync status
- Revoke button (Live) or no action (Static accepted — share is terminal, owner has no further control)

**Declined:**
- Recipient identifier
- Status: "Declined" (red badge)
- No actions available

**Error state (from P12-08):**
- For Live shares: "Sync paused · {human-readable error}" — rendered in P12-08 but the row component must reserve space for this state

### Share Sheet

The share sheet is triggered by the "Share contact" button. On mobile, it appears as a bottom sheet. On desktop, it appears as a popover attached to the button.

```
Share {contactDisplayName}
──────────────────────────────

◎ Copy share link
  Anyone with the link can download this contact.
  [Your plan: link expires in 7 days]   ← only for Free
  [Active link: aB3xQ7mZ…  ·  2 downloads]  ← if one exists

─ Share with a Kontax user ───────────────

◎ Static copy           [Pro]
  Send a one-time copy to a Kontax account.
  {locked state for Free: 🔒 Upgrade to Pro →}

◎ Live sync             [Pro]
  Contact stays updated when you make changes.
  Recipient must also be on a paid plan.
  {locked state for Free: 🔒 Upgrade to Pro →}
```

Locked state behavior for Free users:
- The option label is visible but dimmed.
- A lock icon and "Pro" badge appear to the right of the label.
- Clicking the locked option shows an inline upgrade prompt: "Static sharing is available on the Pro plan. [View plans]"
- Do not disable the click target — let the user click and see the explanation.

When "Copy share link" is clicked:
- If no active vCard link exists: calls `createVCardShareLink()`, shows a brief spinner, then copies the URL.
- If an active link exists: copies the existing URL immediately.
- Shows "Copied to clipboard!" confirmation inline in the sheet.

When "Static copy" or "Live sync" is clicked (Pro+ users):
- An email input appears inline below the option.
- Input: standard email field with validation.
- "Send" button: triggers `createStaticShare` or `createLiveShare` respectively.
- Success state: "Share sent to {name/email}" — sheet remains open for a moment, then closes.
- Error states: displayed inline below the input.

### "Live from [Owner]" Badge — Recipient Perspective

When the contact detail page is loaded for a contact with `sourceType: "SHARED_LIVE"`:

Display at the top of the contact detail (below the avatar and display name, above the field list):

```
╔═══════════════════════════════════════════════════╗
║  ↻  Live contact from Jane Smith                  ║
║     Last updated 3 minutes ago · [Unlink]         ║
╚═══════════════════════════════════════════════════╝
```

This is a distinct visual treatment from the sync account source badges introduced in Phase 9/10. The design spec (P12-07) defines the exact style; the engineering requirement is that:

1. It appears only for `sourceType === "SHARED_LIVE"` contacts.
2. It shows the owner's name (from `contact.sourceDetail`).
3. It shows the `lastPushedAt` timestamp from the corresponding `ContactShare` record.
4. It includes an "Unlink" action that calls `unlinkLiveShare(shareId)` and navigates to the contact after conversion.

Finding the share ID from the recipient's perspective: query `ContactShare` where `recipientContactId = contact.id` and `status = "ACTIVE"`. There should be exactly one such record.

For `sourceType === "SHARED_STATIC"` contacts: show a simpler, non-interactive badge:

```
  Shared by Jane Smith · Received 5 days ago
```

No unlink option for static shares — the contact is already independent. The user can archive or delete it normally.

### Edit Right Indicators

For SHARED_LIVE contacts in the recipient's view:

- All shared field inputs appear with a lock icon and are non-interactive.
- A tooltip on locked fields: "This field is kept in sync by the contact owner and cannot be edited."
- The "My notes" / `privateNotes` field (if implemented in P12-04) appears as fully editable.
- The standard edit button in the contact header is hidden; it is replaced by a "Manage" button that opens a sheet showing the live share badge, last sync time, and the unlink option.

### Empty State

When a contact has no shares at all:

```
Sharing
───────────────────────────────
Share this contact with anyone.
[Share contact]
```

When a Free user has no shares and views the sharing section:

```
Sharing
───────────────────────────────
No active links.
[Copy share link]  ← creates a vCard link

──────────────────
Share directly with other Kontax users (Pro)
[Upgrade to Pro →]
```

### Plan Upgrade CTA Wiring

When a Free user clicks a locked sharing option or the "Upgrade to Pro" CTA in the sharing section, they are navigated to the pricing/upgrade page. The upgrade page receives a `?from=contact-share` query parameter so it can display a contextual message: "Unlock direct contact sharing with Pro."

### Accessibility

- All share action buttons must have descriptive `aria-label` attributes: `aria-label="Revoke share link created on [date]"`.
- The confirmation dialogs must trap focus when open.
- The share sheet must be dismissible via Escape key.
- The "Copied to clipboard" toast must use `role="status"` and `aria-live="polite"` so screen readers announce it.

### Loading and Error States

- The sharing section shows a skeleton loader while share data is being fetched.
- Failed share creation shows an inline error below the email input: "Failed to send share. Please try again."
- Revocation failures show a toast error: "Couldn't revoke this share. Please try again."
- The revoke confirmation dialog's confirm button shows a spinner while the revocation is in progress, and disables itself to prevent double-clicks.

---

## Acceptance Criteria

- The "Sharing" section appears on all contact detail pages for all plan tiers.
- Free plan users see their active vCard links and an upgrade prompt for account sharing. No account sharing controls are rendered as broken or empty — they show the locked state with the upgrade CTA.
- Pro+ users see all active vCard links and account shares for the contact.
- The full vCard share token is never sent to the client; only the first 8 characters + "…" are displayed.
- Clicking "Copy share link" copies the full share URL to the clipboard and shows a "Copied" confirmation.
- The revoke confirmation dialog appears before any revocation is executed.
- After revoking a vCard link, the row shows a "Revoked" badge; the link no longer works (HTTP 410).
- Account share rows display the correct status badge (Pending/Active/Declined) and update when status changes.
- The "Live from [Owner]" badge appears on SHARED_LIVE contacts in the recipient's account.
- The "Unlink" action on a SHARED_LIVE contact calls `unlinkLiveShare` and converts the contact to SHARED_STATIC.
- SHARED_LIVE contacts have all shared fields locked for editing; the private notes field is editable.
- The share sheet shows the correct locked/unlocked state for each option based on the user's plan.
- All interactive elements in the sharing section are keyboard-accessible.
- The sharing section skeleton loader appears while data is loading and is replaced by content when ready.

---

## Risks and Open Questions

- **Token URL construction on the client** — the full share URL must be constructed server-side and returned as part of the share summary. Ensure the `NEXT_PUBLIC_APP_URL` environment variable is accessible and correct in all environments. A wrong value here produces broken share links.
- **`lastPushedAt` display accuracy** — the "Last synced N minutes ago" text is derived from `lastPushedAt` which is a server timestamp. The relative time display must handle cases where `lastPushedAt` is null (not yet synced after acceptance), far in the past (owner has not updated the contact), or very recent.
- **Concurrent revocation** — if two browser tabs are open to the same contact detail and both click "Revoke" on the same share, both will attempt to revoke. The server action is idempotent (setting an already-revoked share to revoked is a no-op), so this is safe but the UI should handle the case gracefully.
- **P12-07 design dependency** — this ticket implements the share management UI, but the exact visual design is defined in P12-07. If P12-07 is not complete before implementation begins, use placeholder styles that match the existing contact detail page aesthetic. Do not block implementation on P12-07 being final — the component structure is the deliverable of this ticket.
- **Share section position on contact detail** — the contact detail page currently has fields, source badges, and activity log sections. Where does the sharing section sit in the hierarchy? Proposed: after source badges, before the activity log. If the designer places it differently in P12-07, the component is easy to reorder since it is self-contained.

---

## Outcome

Contact owners have a complete, plan-aware sharing management panel on the contact detail page, and recipients see a clear "Live from [Owner]" badge with an unlink option on their connected contacts.

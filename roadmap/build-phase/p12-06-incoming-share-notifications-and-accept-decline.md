# P12-06 Incoming Share Notifications and Accept/Decline Flow

## Purpose
This ticket implements everything the recipient experiences when someone shares a contact with them: the in-app notification badge that tells them a share is waiting, the dedicated pending shares view where they can review and act on incoming shares, and the full accept/decline interaction flow. Without this surface, shares created in P12-03 and P12-04 would arrive invisibly — recipients would have no way to know they have pending contacts to review. The notification and accept/decline UI is the recipient's entry point to the sharing feature, and its clarity and responsiveness directly affects how trustworthy and usable the feature feels.

## Background
Phases P12-03 and P12-04 defined that a pending `ContactShare` for an existing Kontax user is identified by `recipientContactId === null` and `status === ACTIVE`. The in-app notification system in this ticket queries this condition to determine the badge count and populate the pending shares list.

Phase P12-03's `createStaticShare` and P12-04's `createLiveShare` both create an in-app notification by virtue of leaving the share in the pending state. This ticket does not require those actions to write to a separate notification table — the `ContactShare` record itself is the notification record.

The transactional email provider dependency was flagged in P12-03. This ticket depends on that email provider being configured. The UI notification flow must work independently of email — email is a supplementary notification channel, not the only one.

## Scope

**In scope:**
- Notification badge count in the workspace header (count of pending incoming shares)
- Dedicated `/contacts/shares/pending` page (or route under settings/notifications)
- Pending share list: sender name, contact display name, share type, sent date
- Contact preview on each pending share: key contact fields (name, company, primary phone, primary email) derived from `contactSnapshot`
- Accept action: calls `acceptShare` (P12-03) or `acceptLiveShare` (P12-04) depending on `shareType`
- Decline action: calls `declineShare` (P12-03), available for both share types
- Post-accept navigation: navigate to the new contact in the recipient's contact list
- Post-decline feedback: the declined row animates out, replaced by a "Declined" confirmation
- Badge count real-time update after accept/decline
- Email notification sent to recipient when a share arrives (transactional email, using provider from P12-03)
- Registration deep link handling: `?pendingShare={shareId}` on the registration page surfaces the pending share after signup
- Empty state for no pending shares
- Historical view: list of recently accepted or declined shares (last 30 days) — read-only, no actions

**Out of scope:**
- Push notifications (mobile app) — web only in Phase 12
- Real-time websocket badge updates — polling acceptable for MVP
- Notification preferences (ability to opt out of share notification emails)
- Bulk accept/decline
- The full contact detail page for the contact being shared — just a preview in the pending list

---

## Design / Implementation Spec

### Badge Count in Workspace Header

The workspace header (persistent navigation element visible across all pages) must show a badge count when the user has pending incoming shares.

**Data query:**
```typescript
async function getPendingShareCount(userId: string): Promise<number> {
  return prisma.contactShare.count({
    where: {
      recipientUserId: userId,
      status: "ACTIVE",
      recipientContactId: null,
      shareType: { in: ["STATIC_COPY", "LIVE_SYNC"] },
    },
  });
}
```

This count is loaded as part of the workspace layout data fetch — it renders as a server component number passed as a prop to the header client component.

**Polling for real-time updates:** The badge count is fetched on each full page load. For a live badge update without full page reload, implement a lightweight polling mechanism:

```typescript
// In the workspace header client component
useEffect(() => {
  const interval = setInterval(async () => {
    const count = await fetchPendingShareCount(); // lightweight fetch to /api/shares/pending-count
    setPendingCount(count);
  }, 30_000); // Poll every 30 seconds
  return () => clearInterval(interval);
}, []);
```

A 30-second polling interval is acceptable for MVP. Real-time websocket push is a future enhancement. The polling must stop when the user navigates away or the component unmounts.

**Badge rendering:**
- Zero count: no badge shown
- Count 1–9: number badge (e.g. `3`)
- Count 10+: `9+` badge to prevent overflow

The badge uses the same visual style as other notification badges in the app (error state color — typically red or orange). Exact style per P12-07.

### /contacts/shares/pending Route

This is a dedicated page accessible from the notification badge (clicking the badge navigates here) and from the settings or notifications section.

**Route:** `/contacts/shares/pending`

**Page structure:**

```
Shared with you
──────────────────────────────────────────────────

Pending (3)
──────────────────────────────────────
[PendingShareCard]
[PendingShareCard]
[PendingShareCard]

Recently acted on (last 30 days)
──────────────────────────────────────
[HistoricalShareRow] · Accepted · Jane Smith · Contact name
[HistoricalShareRow] · Declined · Bob Jones · Another contact
```

Empty state (no pending, no history):
```
Shared with you
──────────────────────────────────────────────────

No pending shares.
Contacts shared with you by other Kontax users will appear here.
```

### PendingShareCard Component

Each pending share renders as a card with:

**Header:**
- Sender avatar (initials-based if no profile photo) + sender display name
- Share type badge: "Static" (neutral) or "Live" (distinct color — per P12-07)
- Sent date: "Sent 2 hours ago"

**Contact preview** (derived from `contactSnapshot`):
- Display name (prominent)
- Company / job title (if present)
- Primary phone (if present)
- Primary email (if present)
- Avatar / initials

**Actions:**
- "Accept" button (primary)
- "Decline" button (secondary/ghost)

**Live share additional context:**
If `shareType === "LIVE_SYNC"`, show a note below the contact preview:

```
↻  Live contact — this contact will update automatically when {senderName} makes changes.
   Both you and {senderName} need to be on a paid plan for live sharing to work.
```

If the recipient's current plan is Free, show:
```
↻  Live contact — but your plan doesn't support live sync.
   If you accept, you'll receive a static copy instead.
   The sender will be notified.
```

This is informational, not a blocking gate. The recipient can still accept; the server action handles the fallback.

### Accept Flow

Clicking "Accept" on a pending share card:

1. Show a loading spinner on the button, disable both buttons.
2. Call `acceptShare(shareId)` (for `STATIC_COPY`) or `acceptLiveShare(shareId)` (for `LIVE_SYNC`).
3. On success:
   - Remove the card from the pending list with a smooth exit animation.
   - Show a toast: "Contact added — {contactDisplayName}" with a "View" action link.
   - Update the badge count (decrement by 1).
   - Navigate to the new contact if the user clicks "View" in the toast, otherwise stay on the pending shares page.
4. On `convertedToStatic: true` response from `acceptLiveShare`:
   - Show the same success toast but add a note: "Accepted as a static copy because your current plan doesn't support live sync."
5. On error:
   - Re-enable both buttons.
   - Show an inline error below the card: "Couldn't accept this share. Please try again."
   - Specific error handling:
     - `PLAN_GATE_LIVE_SHARE` (should not occur since the server falls back to static, but handle defensively): "Upgrade to Pro to accept live shares."
     - `SHARE_ALREADY_ACCEPTED`: "This share was already accepted." — refresh the list.
     - Generic: "Something went wrong. Please try again."

### Decline Flow

Clicking "Decline":

1. Show a confirmation inline below the card (not a modal — keep the interaction lightweight): "Are you sure? The sender will be notified."
   - "Yes, decline" button
   - "Cancel" button
2. On "Yes, decline":
   - Show loading spinner.
   - Call `declineShare(shareId)`.
   - On success: remove card from pending list with exit animation. Show a brief "Declined" toast.
   - Update badge count.
3. On "Cancel": dismiss the confirmation inline, return to normal card state.

### Email Notification — Share Arrival

When `createStaticShare` or `createLiveShare` creates a share for an existing Kontax user, send a transactional email:

**Template: share-notification**

Subject: `{senderName} shared a contact with you on Kontax`

Body:

```
Hi {recipientName},

{senderName} has shared a contact with you on Kontax.

Contact: {contactDisplayName}
{Company: {company} if present}
Share type: Static copy / Live sync

[View and Accept →]

---
If you didn't expect this, you can decline the share when you log in.
Kontax · Unsubscribe from share notifications
```

The CTA links to `{APP_URL}/contacts/shares/pending`. Include the share ID as a query param for deep linking: `{APP_URL}/contacts/shares/pending?highlight={shareId}` to scroll to and highlight the specific pending share.

**Template: invite-to-register** (for non-account recipients — defined in P12-03 but confirmed here)

Subject: `{senderName} wants to share a contact with you on Kontax`

Body:

```
Hi,

{senderName} has shared a contact with you on Kontax, a contacts management app.

Contact: {contactDisplayName}
{Company: {company} if present}

To receive this contact, create a free Kontax account:
[Create account and receive contact →]

The link above includes your share so the contact will be waiting for you after signup.
```

The CTA links to `{APP_URL}/register?pendingShare={shareId}`.

### Email Delivery Error Handling

If the transactional email provider is not configured, or if the send call fails:

- Log a structured warning: `{ event: "share_email_failed", shareId, recipientEmail, error }`
- Do not throw — the share creation succeeds regardless of email delivery
- Do not retry automatically in this ticket (P12-08's retry infrastructure could be extended to cover email retries in a future phase)

### Registration Deep Link Handling

The registration page accepts `?pendingShare={shareId}` as a query parameter. After successful registration:

1. If the new account's email matches a pending share's `recipientEmail`:
   - Run the linkage update (P12-03): `prisma.contactShare.updateMany({ where: { recipientEmail: newUser.email, status: "ACTIVE" }, data: { recipientUserId: newUser.id } })`.
   - Redirect to `/contacts/shares/pending?highlight={shareId}`.
2. If the share ID from the URL is valid and the email matches: also navigate directly to the pending share.
3. If the share has expired or the email does not match: ignore the query param silently — do not show a confusing error on the registration success page.

The redirect after registration must pass through the normal onboarding flow if one exists. The pending share view is shown after onboarding completes, not in the middle of it.

### `?highlight={shareId}` Parameter on Pending Shares Page

When the page is loaded with `?highlight={shareId}`:

1. Scroll to the matching pending share card.
2. Apply a brief highlight animation (e.g. blue border pulse for 2 seconds).
3. This is purely a UX enhancement — if the share has already been acted on, the highlight silently does nothing.

### Historical Share View

Below the pending shares section, show shares that were accepted or declined in the last 30 days:

```typescript
const historicalShares = await prisma.contactShare.findMany({
  where: {
    recipientUserId: userId,
    status: { in: ["DECLINED"] },
    // OR status ACTIVE with recipientContactId not null (accepted)
    // Complex OR query — use two queries and merge in application layer
  },
  orderBy: { updatedAt: "desc" },
  take: 20,
});
```

The historical view is read-only. Each row shows:
- Sender name
- Contact display name (from snapshot or linked contact)
- Outcome: "Accepted {N} days ago" or "Declined {N} days ago"
- For accepted shares: a "View contact" link to the new contact in the recipient's account

### Notification Badge Update After Actions

The badge count in the workspace header must update immediately when the user accepts or declines a share from the pending shares page. Options:

- **Option A (preferred):** The pending shares page is a Server Component that re-renders on action. When `acceptShare` or `declineShare` completes, `router.refresh()` is called in the client component, which triggers a full server component re-render including the updated badge count.
- **Option B:** Maintain badge count in a React Context that wraps the workspace layout. The accept/decline actions decrement the count optimistically.

Option A is simpler and consistent with the Next.js App Router pattern already used in the app. Option B provides a smoother optimistic update but adds client-side state management complexity. Use Option A for MVP.

### Notification Access Points

The notification badge in the workspace header links to `/contacts/shares/pending`. Additionally:

- When a user first logs in after receiving a share, show an in-app banner at the top of the contacts list: "You have {N} pending contact shares. [View now]." The banner appears once per session (stored in sessionStorage) and auto-dismisses after 10 seconds or on user interaction.
- The banner is only shown if `pendingCount > 0`.

---

## Acceptance Criteria

- Users with pending incoming shares see a notification badge in the workspace header showing the correct count.
- The badge count decrements immediately after accepting or declining a share.
- The pending shares page shows all pending shares with sender name, contact preview, share type, and sent date.
- Live share cards show an explanation of live sync behavior and a plan warning if the recipient is on Free.
- Accepting a static share creates the contact in the recipient's account and navigates to it (via "View" toast action).
- Accepting a live share as a Free plan user creates a static copy and shows a "converted to static" notice.
- Declining a share requires inline confirmation and notifies the sender.
- Email notifications are sent when a share arrives (requires email provider to be configured).
- Non-account recipients receive an invite email with a working registration deep link.
- After registration via a deep link, the pending share is immediately visible in the pending shares view.
- The `?highlight={shareId}` parameter scrolls to and highlights the specified share.
- Historical shares (accepted/declined in the last 30 days) are visible in the lower section with a "View contact" link for accepted ones.
- The in-app banner appears on the contacts list when the user logs in with pending shares.
- All actions (accept, decline) have correct loading and error states.
- The pending shares page renders an empty state when there are no pending shares and no recent history.

---

## Risks and Open Questions

- **Email provider not configured** — the app must start and function without an email provider. Share creation must succeed and in-app notifications must work even when email delivery is skipped. Add a `SHARE_EMAIL_ENABLED` feature flag or check for provider configuration at runtime.
- **Polling interval vs real-time** — 30-second polling for the badge count means a user could wait up to 30 seconds to see a new badge after a share arrives. This is acceptable for MVP. If users perceive this as a problem, the polling interval can be reduced or replaced with Server-Sent Events.
- **Non-account invite expiry** — pending invites to non-account recipients have no expiry in v1 (flagged in P12-03). If the recipient registers months later, the pending share will still be there. The historical view should cap non-account invite display at 30 days even if the share is still technically ACTIVE.
- **`contactSnapshot` as contact preview** — the pending share card derives the contact preview from `share.contactSnapshot`. This must be parseable without the full Prisma Contact model. Ensure the snapshot serialization format (from P12-01) includes at minimum `displayName`, `givenName`, `familyName`, `organizationName`, `jobTitle`, and the first phone/email identifiers.
- **Batch registration linkage** — if multiple pending shares have the same `recipientEmail` and the user registers, `updateMany` links all of them atomically. This is correct behavior. Confirm that all linked shares appear in the pending view after registration, not just the one referenced in the query param.
- **Transactional email template management** — the email templates need to be created in the email provider's template system (or as code templates). This is a dependency on the email provider setup. Track this as a separate task within this ticket.

---

## Outcome

Recipients are notified in-app and by email when a contact is shared with them, can review a preview of the incoming contact, and can accept or decline with clear feedback — creating the complete recipient-side experience for the sharing feature.

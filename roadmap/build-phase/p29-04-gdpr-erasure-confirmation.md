# P29-04 — GDPR Erasure Confirmation Email

## Purpose

After a user's account deletion completes (the 30-day grace period in P18-09 expires and the deletion job runs), send a confirmation email that documents: what was deleted, when it was deleted, and that no personal data remains on Kontax's servers. This satisfies GDPR Article 17 (right to erasure) and the accountability obligation to provide evidence of deletion.

## Background

P18-09 implemented the account deletion flow: the user requests deletion, a 30-day grace period starts, and a scheduled CRON job runs the cascade deletion on the scheduled date. This ticket adds the confirmation email sent after the deletion completes. The email is sent to the user's last known email address before the account is hard-deleted.

## Scope

**In scope:**
- `AccountDeletionCompleteTemplate` React Email template
- `sendAccountDeletionConfirmationEmail(email, deletedAt)` callable — called by the P18-09 deletion CRON after the cascade completes
- The email is sent to the user's `email` field, which must be captured before the `User` row is deleted

**Out of scope:**
- The deletion CRON itself (P18-09)
- The account deletion request UI (P18-09)

---

## Design / Implementation Spec

### Template

`src/emails/account-deletion-complete.tsx`:

```tsx
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "./_components/email-layout";
import { tokens } from "./_tokens";

interface AccountDeletionCompleteTemplateProps {
  deletedAt: Date;
  email: string; // the deleted account email, for the user's records
}

export function AccountDeletionCompleteTemplate({
  deletedAt, email,
}: AccountDeletionCompleteTemplateProps) {
  return (
    <EmailLayout preview="Your Kontax account has been permanently deleted">
      <Text style={{ color: tokens.ink, fontSize: "20px", fontWeight: "600", margin: "0 0 16px" }}>
        Your account has been deleted
      </Text>
      <Text style={{ color: tokens.secondary, fontSize: "14px", lineHeight: "22px", margin: "0 0 16px" }}>
        Your Kontax account ({email}) has been permanently deleted as requested.
        All associated data has been removed from our servers.
      </Text>

      <Section style={{ backgroundColor: "#f4f4f5", borderRadius: "6px",
        padding: "12px 16px", marginBottom: "24px" }}>
        <Text style={{ color: tokens.secondary, fontSize: "13px", margin: "0 0 4px" }}>
          Account: {email}
        </Text>
        <Text style={{ color: tokens.secondary, fontSize: "13px", margin: "0 0 4px" }}>
          Deleted on: {deletedAt.toUTCString()}
        </Text>
        <Text style={{ color: tokens.secondary, fontSize: "13px", margin: "0" }}>
          Data removed: contacts, activity log, sync accounts, billing history
        </Text>
      </Section>

      <Text style={{ color: tokens.secondary, fontSize: "14px", lineHeight: "22px", margin: "0 0 16px" }}>
        If you didn't request this deletion or believe this is an error, please contact
        Kontax support immediately at{" "}
        <a href="mailto:support@kontax.app" style={{ color: tokens.blue }}>
          support@kontax.app
        </a>.
      </Text>

      <Text style={{ color: tokens.muted, fontSize: "12px" }}>
        This is a confirmation of account deletion. No further emails will be sent
        to this address from Kontax.
      </Text>
    </EmailLayout>
  );
}
```

### Callable function

```typescript
// src/server/notifications.ts (or a new deletion-notifications.ts)

export async function sendAccountDeletionConfirmationEmail(params: {
  email: string;
  deletedAt: Date;
}): Promise<void> {
  const { html, text } = await renderEmail(
    <AccountDeletionCompleteTemplate
      email={params.email}
      deletedAt={params.deletedAt}
    />
  );

  // Note: do NOT look up the user in the DB — the account has already been deleted.
  // Pass the email address directly from the caller (captured before deletion).
  await sendEmail({
    to: params.email,
    subject: "Your Kontax account has been permanently deleted",
    html,
    text,
  });
}
```

### Integration point in P18-09 CRON

In the deletion CRON job, after the cascade delete completes:

```typescript
// Capture the email BEFORE deleting the user row
const userEmail = user.email;
const deletedAt = new Date();

// Perform cascade deletion (contacts, activity events, sync accounts, etc.)
await performCascadeDeletion(user.id);

// Delete the user row
await db.user.delete({ where: { id: user.id } });

// Send confirmation to the now-deleted address
await sendAccountDeletionConfirmationEmail({
  email: userEmail,
  deletedAt,
});
```

The email send is fire-and-forget (`void sendAccountDeletionConfirmationEmail(...)`) — a failed send does not re-trigger the deletion.

---

## Acceptance Criteria

- `AccountDeletionCompleteTemplate` renders a confirmation email with the deleted email address, deletion timestamp, and a list of removed data types.
- `sendAccountDeletionConfirmationEmail` sends to the provided email address without a DB lookup.
- The email subject is "Your Kontax account has been permanently deleted".
- The email includes a contact address for disputes.
- The template previews correctly in the React Email dev server.
- The P18-09 CRON calls `sendAccountDeletionConfirmationEmail` after the cascade delete, with the email captured before the user row is removed.

---

## Risks and Open Questions

- **Suppression check:** `sendEmail` calls `isEmailSuppressed`, which looks up the User row. Since the user is deleted before the email is sent, the lookup will return `null` — and `null?.emailStatus` is `undefined`, not `BOUNCED`. Confirm that `isEmailSuppressed` handles a not-found user gracefully (returns `false`, allowing the send). Add a null-safe guard if needed.
- **GDPR audit log:** consider storing a record of the deletion confirmation in a separate `DeletionRecord` table (not on `User`, which is deleted) for compliance auditing. This is a P2 hardening step.

# P20-10 — SES Bounce & Complaint Handling

## Purpose

Amazon SES will suspend a sending account if too many bounced emails are sent to invalid addresses, or if recipients mark emails as spam. This ticket implements the SNS webhook that receives bounce/complaint notifications from SES and suppresses future sends to those addresses. Without this, a bad address in the user database causes repeated bounces that damage sender reputation and risk SES account suspension.

## Background

SES publishes bounce and complaint events to an SNS topic (`kontax-email-events`, configured in P20-01). SNS delivers those events as HTTP POST requests to a Kontax endpoint. The endpoint processes the notification and updates `User.emailStatus` to suppress future sends.

## Scope

**In scope:**
- `User.emailStatus` field addition to the schema (`EMAIL_OK | BOUNCED | COMPLAINED`)
- `POST /api/ses/events` SNS webhook endpoint
- SNS subscription confirmation (SNS sends a SubscriptionConfirmation message on first delivery)
- Update `isEmailSuppressed` stub in `src/server/email.ts` (P20-02) with real DB lookup
- Settings page note: if a user's email is bounced, show a banner prompting them to update their email address

**Out of scope:**
- Manual suppression (admin can use P21-05 to lock accounts; email suppression is automatic)
- Soft bounce handling (only hard bounces cause suppression in v1)

---

## Design / Implementation Spec

### Schema change

Add to `User` model:

```prisma
enum EmailStatus {
    OK
    BOUNCED
    COMPLAINED
}

// On User model:
emailStatus EmailStatus @default(OK)
```

Run: `prisma migrate dev --name add-user-email-status`

### SNS webhook endpoint

`src/app/api/ses/events/route.ts`:

```typescript
export async function POST(req: NextRequest) {
  const body = await req.json();
  const messageType = req.headers.get("x-amz-sns-message-type");

  // SNS subscription confirmation — must fetch the URL to confirm
  if (messageType === "SubscriptionConfirmation") {
    await fetch(body.SubscribeURL);
    return NextResponse.json({ confirmed: true });
  }

  if (messageType !== "Notification") {
    return NextResponse.json({ ignored: true });
  }

  const message = JSON.parse(body.Message) as SesNotification;

  if (message.notificationType === "Bounce") {
    const hardBounces = message.bounce.bouncedRecipients.filter(
      (r) => message.bounce.bounceType === "Permanent"
    );
    for (const recipient of hardBounces) {
      await db.user.updateMany({
        where: { email: recipient.emailAddress.toLowerCase() },
        data: { emailStatus: "BOUNCED" },
      });
    }
  }

  if (message.notificationType === "Complaint") {
    for (const recipient of message.complaint.complainedRecipients) {
      await db.user.updateMany({
        where: { email: recipient.emailAddress.toLowerCase() },
        data: { emailStatus: "COMPLAINED" },
      });
    }
  }

  return NextResponse.json({ processed: true });
}
```

### Replace `isEmailSuppressed` stub

In `src/server/email.ts`, replace the stub with:

```typescript
async function isEmailSuppressed(email: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { emailStatus: true },
  });
  return user?.emailStatus === "BOUNCED" || user?.emailStatus === "COMPLAINED";
}
```

### Settings banner for bounced email

If `user.emailStatus === "BOUNCED"`, show a banner in settings:
```
⚠ Your email address bounced. Some Kontax notifications may not be reaching you.
Please update your email address in account settings.
[Update email →]
```

---

## Acceptance Criteria

- `User.emailStatus` field exists in the schema; migration applied.
- The SNS endpoint confirms the subscription on first delivery.
- Hard bounces set `emailStatus = BOUNCED`; complaints set `emailStatus = COMPLAINED`.
- `isEmailSuppressed` returns `true` for BOUNCED and COMPLAINED addresses.
- `sendEmail` (P20-02) skips sending to suppressed addresses.
- The settings page shows a banner when `emailStatus = BOUNCED`.
- The `/api/ses/events` endpoint is excluded from session auth middleware (add to `PUBLIC_PATHS` in P18-10).

---

## Risks and Open Questions

- **SNS signature verification:** SNS messages can be spoofed if the endpoint doesn't verify the SNS message signature. For v1, rely on the SNS subscription URL being secret (not guessable). For production hardening, add SNS message signature verification using `@aws-sdk/sns-message-validator`.
- **Complaint handling:** when a user marks a Kontax email as spam, future transactional emails (verification, password reset) are also suppressed. This could lock a user out if they can't receive a password reset link. Consider a `COMPLAINED_TRANSACTIONAL_OK` status that suppresses marketing but not security emails in v2.

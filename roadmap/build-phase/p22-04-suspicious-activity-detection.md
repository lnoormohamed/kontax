# P22-04 — Suspicious Activity Detection

## Purpose

Detect patterns that indicate an account may be compromised or misused, and generate a `UserNotification` and email alert when they are found. Detection runs synchronously as a post-mutation hook in the relevant server actions — fast enough to fire immediately without introducing significant latency.

## Background

`ActivityEvent` (P10-01) records every contact mutation. `UserSession` (P18-06) records device logins with IP and user-agent. `sendSuspiciousActivityEmail` (P20-07) is the email callable. `createNotification` (P22-01) is the in-app callable.

## Scope

**In scope:**
- Rule 1: bulk delete — more than 10 contacts deleted within 60 seconds
- Rule 2: new device login — `UserSession` created from an IP not seen in the last 30 days
- Rule 3: repeated failed logins — more than 5 failed login attempts within 1 hour
- `emitSuspiciousActivityAlert(userId, type, detail)` — shared function called by all rules
- Detection runs as a post-mutation side-effect; never blocks the mutation

---

## Design / Implementation Spec

### `emitSuspiciousActivityAlert`

`src/server/suspicious-activity.ts`:

```typescript
export async function emitSuspiciousActivityAlert(params: {
  userId: string;
  type: "BULK_DELETE" | "NEW_DEVICE_LOGIN" | "REPEATED_FAILED_LOGIN";
  description: string;
  deviceHint?: string | null;
  ipAddress?: string | null;
}): Promise<void> {
  // In-app notification
  await createNotification({
    userId: params.userId,
    category: "SECURITY",
    title: "Unusual activity detected",
    body: params.description,
    actionUrl: "/settings/security?tab=activity",
  });

  // Email
  await sendSuspiciousActivityEmail({
    userId: params.userId,
    activityDescription: params.description,
    deviceHint: params.deviceHint,
    ipAddress: params.ipAddress,
    occurredAt: new Date(),
  });

  // ActivityEvent for audit trail
  await db.activityEvent.create({
    data: {
      userId: params.userId,
      eventType: "CONTACT_DELETED", // reuse closest type; Phase 22 adds SUSPICIOUS_ACTIVITY if needed
      actor: "SYSTEM",
      payload: { suspicious: true, type: params.type, description: params.description },
    },
  });
}
```

### Rule 1: Bulk delete detection

In the `deleteContact` or bulk delete server action, after the deletion is committed:

```typescript
async function checkBulkDeleteRule(userId: string): Promise<void> {
  const oneMinuteAgo = new Date(Date.now() - 60_000);
  const recentDeletes = await db.activityEvent.count({
    where: {
      userId,
      eventType: "CONTACT_DELETED",
      createdAt: { gte: oneMinuteAgo },
    },
  });

  if (recentDeletes >= 10) {
    await emitSuspiciousActivityAlert({
      userId,
      type: "BULK_DELETE",
      description: `${recentDeletes} contacts were deleted in the last 60 seconds.`,
    });
  }
}
```

Emit at the 10th deletion within the window — not on every subsequent deletion (check for "exactly 10" not ">= 10" to avoid multiple alerts).

### Rule 2: New device login detection

In the NextAuth `jwt` callback (P18-06) when a `UserSession` is created, add:

```typescript
async function checkNewDeviceRule(userId: string, ipAddress: string | null, userAgent: string | null, jti: string): Promise<void> {
  if (!ipAddress) return;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const seenBefore = await db.userSession.count({
    where: {
      userId,
      ipAddress,
      createdAt: { gte: thirtyDaysAgo },
      jti: { not: jti }, // exclude the just-created session
    },
  });

  if (seenBefore === 0) {
    const deviceHint = parseDeviceHint(userAgent);
    await emitSuspiciousActivityAlert({
      userId,
      type: "NEW_DEVICE_LOGIN",
      description: `A new device signed into your account.`,
      deviceHint,
      ipAddress,
    });
  }
}
```

### Rule 3: Repeated failed login detection

In the NextAuth `authorize` callback, after a failed password check:

```typescript
// Track failed attempts in Redis (using the rate limiter from P18-10)
const failedAttempts = await rateLimiters.passwordChange.limit(`failed-login:${email}`);
if (failedAttempts.remaining === 0) {
  // Find the user and emit an alert
  const user = await db.user.findUnique({ where: { email } });
  if (user) {
    await emitSuspiciousActivityAlert({
      userId: user.id,
      type: "REPEATED_FAILED_LOGIN",
      description: `Multiple failed login attempts were detected on your account.`,
    });
  }
}
```

---

## Acceptance Criteria

- Deleting 10+ contacts within 60 seconds triggers a `BULK_DELETE` alert (in-app + email).
- Signing in from an IP not seen in the last 30 days triggers a `NEW_DEVICE_LOGIN` alert.
- 5+ failed login attempts within 1 hour triggers a `REPEATED_FAILED_LOGIN` alert.
- Each rule fires at most once per event window — no alert spam.
- Alerts do not block the underlying mutation that triggered them.
- Security category notifications bypass the preference check and always fire.

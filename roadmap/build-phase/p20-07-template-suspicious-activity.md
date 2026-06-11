# P20-07 — Template: Suspicious Activity Alert

## Purpose

When Phase 22 (P22-04/P22-05) detects suspicious activity and raises an alert, it needs to send an email alongside the in-app notification. This ticket creates the email template and the callable function that Phase 22 uses — it is a dependency for P22-05 (suspicious activity alert).

## Scope

**In scope:**
- `SuspiciousActivityTemplate` React Email component
- `sendSuspiciousActivityEmail(userId, activityType, detail)` callable function
- "Wasn't me — secure my account" CTA that links to the password reset flow

---

## Design / Implementation Spec

### Template

```tsx
// src/emails/suspicious-activity.tsx
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "./_components/email-layout";
import { EmailButton } from "./_components/email-button";
import { tokens } from "./_tokens";

interface SuspiciousActivityTemplateProps {
  activityDescription: string; // e.g. "A new device signed into your account"
  deviceHint?: string | null;   // e.g. "Chrome on Windows"
  ipAddress?: string | null;
  occurredAt: Date;
  secureAccountUrl: string;     // /forgot-password or /settings/security
}

export function SuspiciousActivityTemplate({
  activityDescription, deviceHint, ipAddress, occurredAt, secureAccountUrl,
}: SuspiciousActivityTemplateProps) {
  return (
    <EmailLayout preview="Security alert — unusual activity on your Kontax account">
      <Text style={{ color: tokens.red, fontSize: "13px", fontWeight: "600", margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        Security Alert
      </Text>
      <Text style={{ color: tokens.ink, fontSize: "20px", fontWeight: "600", margin: "0 0 16px" }}>
        Unusual activity detected
      </Text>
      <Text style={{ color: tokens.secondary, fontSize: "14px", lineHeight: "22px", margin: "0 0 16px" }}>
        {activityDescription}
      </Text>
      {(deviceHint || ipAddress) && (
        <Section style={{ backgroundColor: "#f4f4f5", borderRadius: "6px", padding: "12px 16px", marginBottom: "24px" }}>
          {deviceHint && (
            <Text style={{ color: tokens.secondary, fontSize: "13px", margin: "0 0 4px" }}>
              Device: {deviceHint}
            </Text>
          )}
          {ipAddress && (
            <Text style={{ color: tokens.secondary, fontSize: "13px", margin: "0" }}>
              IP address: {ipAddress}
            </Text>
          )}
          <Text style={{ color: tokens.muted, fontSize: "12px", margin: "8px 0 0" }}>
            {occurredAt.toUTCString()}
          </Text>
        </Section>
      )}
      <Text style={{ color: tokens.secondary, fontSize: "14px", margin: "0 0 24px" }}>
        If this was you, no action is needed. If you don't recognise this activity,
        secure your account immediately.
      </Text>
      <Section style={{ marginBottom: "24px" }}>
        <EmailButton href={secureAccountUrl}>Secure my account →</EmailButton>
      </Section>
      <Text style={{ color: tokens.muted, fontSize: "12px" }}>
        Security alerts cannot be unsubscribed from.
      </Text>
    </EmailLayout>
  );
}

export default SuspiciousActivityTemplate;
```

### `sendSuspiciousActivityEmail` callable

```typescript
// src/server/notifications.ts (new file, shared by Phase 22)

export async function sendSuspiciousActivityEmail(params: {
  userId: string;
  activityDescription: string;
  deviceHint?: string | null;
  ipAddress?: string | null;
  occurredAt: Date;
}): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { email: true, name: true },
  });
  if (!user) return;

  const { html, text } = await renderEmail(
    <SuspiciousActivityTemplate
      activityDescription={params.activityDescription}
      deviceHint={params.deviceHint}
      ipAddress={params.ipAddress}
      occurredAt={params.occurredAt}
      secureAccountUrl={`${process.env.APP_URL}/forgot-password`}
    />
  );

  await sendEmail({
    to: user.email,
    subject: "Security alert — unusual activity on your Kontax account",
    html,
    text,
  });
}
```

Phase 22 (P22-05) calls `sendSuspiciousActivityEmail` when a suspicious activity event is detected.

---

## Acceptance Criteria

- `SuspiciousActivityTemplate` renders a red "Security Alert" label, activity description, device/IP detail block, and a "Secure my account" CTA.
- `sendSuspiciousActivityEmail` is callable with a userId and sends to that user's verified email.
- Security alert emails cannot be suppressed by notification preferences — they always send.
- The template is previewed correctly in the React Email dev server.

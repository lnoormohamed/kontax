# P20-04 — Template: Email Verification

## Purpose

Replace the console-log stub in `sendVerificationEmail` (P18-04) with a real React Email template delivered via SES. This is the most critical email Kontax sends — without it, new users cannot verify their address, and the email verification gate (P18-04) is useless in production.

## Background

P18-04 implemented the verification token flow and called `sendVerificationEmail`, but that function currently logs to the console. In production, unverified users are blocked from certain actions (contact sharing, sync, plan upgrade). The verification email must be reliable, fast, and visually trustworthy — a user who can't find or click this email cannot use the product.

Two code paths call this function: (1) registration, where the token is valid for 72 hours; (2) email change (P18-03), where the token is sent to the new address and is valid for only 24 hours. The template must handle both.

## Scope

**In scope:**
- `VerifyEmailTemplate` React Email component
- Wire `sendVerificationEmail` in `src/server/email-verification.ts` to use `renderEmail` + `sendEmail`
- Two variants: SIGNUP (72-hour link) and EMAIL_CHANGE (24-hour link)

---

## Design / Implementation Spec

### Template

```tsx
// src/emails/verify-email.tsx
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "./_components/email-layout";
import { EmailButton } from "./_components/email-button";
import { tokens } from "./_tokens";

interface VerifyEmailTemplateProps {
  name: string | null;
  verifyUrl: string;
  type: "SIGNUP" | "EMAIL_CHANGE";
  expiryHours: number; // 72 for SIGNUP, 24 for EMAIL_CHANGE
}

export function VerifyEmailTemplate({
  name, verifyUrl, type, expiryHours,
}: VerifyEmailTemplateProps) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const heading = type === "SIGNUP"
    ? "Confirm your email address"
    : "Confirm your new email address";
  const body = type === "SIGNUP"
    ? "You created a Kontax account. Click the button below to verify your email address."
    : "You requested to change your Kontax email address. Click the button below to confirm the new address.";

  return (
    <EmailLayout preview={heading}>
      <Text style={{ color: tokens.muted, fontSize: "14px", margin: "0 0 8px" }}>{greeting}</Text>
      <Text style={{ color: tokens.ink, fontSize: "20px", fontWeight: "600", margin: "0 0 16px" }}>
        {heading}
      </Text>
      <Text style={{ color: tokens.secondary, fontSize: "14px", lineHeight: "22px", margin: "0 0 24px" }}>
        {body}
      </Text>
      <Section style={{ marginBottom: "24px" }}>
        <EmailButton href={verifyUrl}>Verify email address →</EmailButton>
      </Section>
      <Text style={{ color: tokens.muted, fontSize: "12px" }}>
        This link expires in {expiryHours} hours. If you didn't create a Kontax account,
        you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

export default VerifyEmailTemplate;
```

### Wire into `sendVerificationEmail`

In `src/server/email-verification.ts`, replace the console-log send with:

```typescript
import { renderEmail } from "~/server/render-email";
import { sendEmail } from "~/server/email";
import { VerifyEmailTemplate } from "~/emails/verify-email";

// Inside sendVerificationEmail, replace the console.log with:
const expiryHours = type === "SIGNUP" ? 72 : 24;
const subject = type === "SIGNUP"
  ? "Confirm your Kontax email address"
  : "Confirm your new Kontax email address";

const { html, text } = await renderEmail(
  <VerifyEmailTemplate
    name={user.name}
    verifyUrl={verificationUrl}
    type={type}
    expiryHours={expiryHours}
  />
);

await sendEmail({ to: targetEmail, subject, html, text });
```

---

## Acceptance Criteria

- `sendVerificationEmail` sends a real email via `sendEmail` (and thus SES in production).
- The email renders correctly in major clients; the CTA button links to the correct verification URL.
- The subject line and body correctly reflect SIGNUP vs EMAIL_CHANGE type.
- The expiry time (72h / 24h) is correctly stated in the email body.
- In development (no SES configured), the email content is logged to console — verification still works.
- A re-sent verification (user clicks "resend" from the banner) uses the same function and replaces the previous token.

---

## Risks and Open Questions

- **Email deliverability at signup:** the verification email is sent synchronously inside the registration handler. If SES is slow or unavailable, the registration request will time out. Consider fire-and-forget (`void sendEmail(...)`) and let the user resend if needed — the registration itself should not fail because of an email.
- **Token exposure in URL:** the verification token is passed as a query parameter in plaintext. This is standard and acceptable — the token is short-lived (72h) and single-use. Ensure the token is invalidated on first use (P18-04 handles this).
- **EMAIL_CHANGE vs SIGNUP subject line:** the `targetEmail` for EMAIL_CHANGE is the new (unverified) address, not the current address. Confirm that `sendVerificationEmail` passes the new address as the `to` field, not the current address on the `User` record.

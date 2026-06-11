# P20-05 — Template: Password Reset

## Purpose

Wire the `requestPasswordReset` function (P18-05) to send a real password reset email via the SES transport (P20-02) using a React Email template. The 15-minute expiry window makes it critical that the email arrives promptly — SES typically delivers within seconds.

## Background

P18-05 implemented the forgot-password token flow but called a console-log stub for the email. In production, a user who forgets their password has no way to recover their account without this email. The 15-minute expiry is intentionally aggressive — it limits the attack surface of a token leaked via email server logs or forwarded email threads.

The email is also used as the recovery path in the P22-06 account lockdown flow ("wasn't me — secure my account"). In that context, the user's existing sessions are already invalidated before the email is sent, so the reset email is the only way back into the account. Reliability is non-negotiable.

## Scope

**In scope:**
- `PasswordResetTemplate` React Email component
- Wire `requestPasswordReset` in `src/app/actions/account.ts` to use `renderEmail` + `sendEmail`

---

## Design / Implementation Spec

### Template

```tsx
// src/emails/password-reset.tsx
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "./_components/email-layout";
import { EmailButton } from "./_components/email-button";
import { tokens } from "./_tokens";

interface PasswordResetTemplateProps {
  resetUrl: string;
}

export function PasswordResetTemplate({ resetUrl }: PasswordResetTemplateProps) {
  return (
    <EmailLayout preview="Reset your Kontax password">
      <Text style={{ color: tokens.ink, fontSize: "20px", fontWeight: "600", margin: "0 0 16px" }}>
        Reset your password
      </Text>
      <Text style={{ color: tokens.secondary, fontSize: "14px", lineHeight: "22px", margin: "0 0 24px" }}>
        We received a request to reset your Kontax password. Click the button below to set a new
        password. This link expires in 15 minutes.
      </Text>
      <Section style={{ marginBottom: "24px" }}>
        <EmailButton href={resetUrl}>Reset password →</EmailButton>
      </Section>
      <Text style={{ color: tokens.muted, fontSize: "12px" }}>
        If you didn't request a password reset, you can safely ignore this email.
        Your password has not been changed.
      </Text>
    </EmailLayout>
  );
}

export default PasswordResetTemplate;
```

### Wire into `requestPasswordReset`

In `src/app/actions/account.ts`, after creating the `PasswordResetToken` row:

```typescript
const { html, text } = await renderEmail(<PasswordResetTemplate resetUrl={resetUrl} />);
await sendEmail({
  to: user.email,
  subject: "Reset your Kontax password",
  html,
  text,
});
```

---

## Acceptance Criteria

- `requestPasswordReset` sends a real email via SES in production; logs to console in dev.
- The reset URL in the email correctly points to `/reset-password?token={plaintext}`.
- The email subject and body are clear about the 15-minute expiry.
- The email is sent even if the user's name is null (no personalisation in this template).
- If the email address is not in the database, the function returns silently — no error, no "user not found" response (prevents user enumeration).
- The email is sent as fire-and-forget — a slow SES response does not block the HTTP response.

---

## Risks and Open Questions

- **Rate limiting the forgot-password endpoint:** without rate limiting, an attacker can flood a target's inbox with reset emails. P18-10's rate limiter should cover the `/api/auth/forgot-password` route. Confirm the rate limit applies before this ticket ships.
- **Token in email logs:** SES may log the full email body including the token. Acceptable for v1. In a later hardening pass, consider a signed URL approach where the token is not present in the email body verbatim.
- **Account lockdown scenario:** when `lockdownAccount` (P22-06) calls `requestPasswordReset`, the user's email address may have been recently changed and not yet re-verified. Confirm that `requestPasswordReset` uses the canonical `User.email` field, which only updates after verification succeeds (P18-03), not the pending new address.

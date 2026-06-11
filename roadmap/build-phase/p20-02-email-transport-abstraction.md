# P20-02 — Email Transport Abstraction

## Purpose

All email sending in Kontax must go through a single `sendEmail` function. This centralises transport configuration (SES in production, console log in development), error handling, and the suppression list check (P20-10). Without this abstraction, every caller would need to handle transport switching and suppression independently.

## Background

The current codebase has at least two places that send email: P18-04 (verification emails) and P12-06 (share invite emails). Both use ad-hoc console-log stubs today. This ticket creates the single transport function they all converge on.

## Scope

**In scope:**
- `sendEmail(params)` function — the one function all callers use
- SES SDK client (`@aws-sdk/client-ses`)
- Console fallback transport for dev/test
- Suppression list check (calls into the User.emailStatus check added in P20-10; stubs to `allowed` until P20-10 ships)
- Structured error logging; never throw — always return a result object

**Out of scope:**
- Email templates (P20-03 onward)
- Bounce/complaint handling (P20-10)

---

## Design / Implementation Spec

### Install AWS SES SDK

```bash
npm install @aws-sdk/client-ses
```

### `sendEmail` function

`src/server/email.ts`:

```typescript
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string; // plain-text fallback — required
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

let _sesClient: SESClient | null = null;

function getSesClient(): SESClient {
  if (!_sesClient) {
    _sesClient = new SESClient({
      region: process.env.AWS_SES_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _sesClient;
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  // Suppression check — P20-10 implements isEmailSuppressed; stub returns false until then
  const suppressed = await isEmailSuppressed(params.to);
  if (suppressed) {
    console.warn(`[email] suppressed send to ${params.to}`);
    return { success: false, error: "EMAIL_SUPPRESSED" };
  }

  // Console fallback in development
  if (!SES_CONFIGURED) {
    console.log(`[email:dev] TO: ${params.to} | SUBJECT: ${params.subject}`);
    console.log(`[email:dev] TEXT:\n${params.text}`);
    return { success: true, messageId: "dev-console" };
  }

  try {
    const command = new SendEmailCommand({
      Source: process.env.EMAIL_FROM!,
      Destination: { ToAddresses: [params.to] },
      Message: {
        Subject: { Data: params.subject, Charset: "UTF-8" },
        Body: {
          Html: { Data: params.html, Charset: "UTF-8" },
          Text: { Data: params.text, Charset: "UTF-8" },
        },
      },
    });
    const result = await getSesClient().send(command);
    return { success: true, messageId: result.MessageId };
  } catch (err) {
    console.error(`[email] failed to send to ${params.to}:`, err);
    return { success: false, error: String(err) };
  }
}

// Stub — P20-10 replaces this with a real DB lookup
async function isEmailSuppressed(_email: string): Promise<boolean> {
  return false;
}
```

### Update existing callers

After this ticket ships, update P18-04 (`sendVerificationEmail`) and P12-06 (share invite) to call `sendEmail` with rendered HTML/text. They currently use console.log directly — replace with `sendEmail` calls. The template rendering (HTML/text content) comes from P20-03 onward; for now pass simple string content.

---

## Acceptance Criteria

- `sendEmail` sends via SES when `SES_CONFIGURED` is true; logs to console when false.
- A failed SES send returns `{ success: false, error: "..." }` and never throws.
- Suppressed addresses return `{ success: false, error: "EMAIL_SUPPRESSED" }` without attempting a send.
- The SES client is a singleton — not re-created per email.
- Existing callers (P18-04, P12-06) are updated to use `sendEmail`.

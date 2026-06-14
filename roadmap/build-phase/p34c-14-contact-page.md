# P34C-14 — /contact Page

## Purpose

Create `src/app/(marketing)/contact/page.tsx` — a support contact form that
gives visitors a way to reach the team without needing an email client. Reduces
friction for support enquiries, keeps communication in one place (via the
existing SES infrastructure), and gives the team structured information about
the nature of each enquiry.

## Background

The existing SES infrastructure (Phase P26 / email-ses-deployment.md) already
sends transactional emails from `noreply@vexon.co`. The contact form reuses
this infrastructure with a new template. No new SES configuration is required
unless a dedicated `support@` address is not yet set up.

This ticket has no design brief dependency — the layout is straightforward
enough to implement from the spec below.

## Scope

**In scope**
- `src/app/(marketing)/contact/page.tsx`.
- `src/app/api/contact/route.ts` — POST handler.
- `src/emails/contact-form-submission.tsx` — React Email template.
- Rate limiting (3 submissions per IP per hour).
- Honeypot field for spam prevention.
- Success state after submission.

**Out of scope**
- CRM integration (e.g. writing submissions to a database).
- Auto-reply to the submitter (send the internal notification only for launch).
- CAPTCHA (honeypot is sufficient for launch volume).
- File attachments.

## Design / Implementation Spec

### Form fields

```tsx
type ContactFormValues = {
  name: string;               // required
  email: string;              // required, email format
  subject: ContactSubject;    // required, from dropdown
  message: string;            // required, min 20 chars
  // honeypot:
  website: string;            // hidden field; must be empty on submit
};

type ContactSubject =
  | "general"
  | "billing"
  | "technical"
  | "feature"
  | "security";
```

Subject dropdown options:
- "General enquiry"
- "Billing question"
- "Technical issue"
- "Feature request"
- "Security report" (if selected, add a note: "For security vulnerabilities,
  you may also email security@getkontax.com directly.")

### Page layout

```
"Get in touch"
"We read every message and aim to respond within 1 business day."

┌──────────────────────────────────┐
│  Name            [____________]  │
│  Email           [____________]  │
│  Subject         [▼ Choose one]  │
│  Message         [              ]│
│                  [              ]│
│                  [              ]│
│  [Send message →]                │
└──────────────────────────────────┘

Response time note below the form.
```

Form wrapper: `max-w-xl mx-auto`. Uses the marketing page white background.

### Honeypot field

```tsx
{/* Honeypot — hidden from real users, filled by bots */}
<input
  type="text"
  name="website"
  tabIndex={-1}
  autoComplete="off"
  aria-hidden="true"
  className="absolute opacity-0 h-0 w-0 pointer-events-none"
/>
```

If `website` is non-empty on the server, return `{ success: true }` silently
(do not actually send the email, but don't reveal the rejection to the bot).

### API route — `src/app/api/contact/route.ts`

```ts
import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit"; // or existing rate-limit util

export async function POST(req: NextRequest) {
  // 1. Rate limit: 3 per IP per hour
  const ip = req.headers.get("x-forwarded-for") ?? "unknown";
  const limited = await checkRateLimit(ip, { max: 3, window: "1h" });
  if (limited) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    );
  }

  const body = await req.json();

  // 2. Honeypot check
  if (body.website) {
    return NextResponse.json({ success: true }); // silent discard
  }

  // 3. Validate
  const { name, email, subject, message } = body;
  if (!name || !email || !subject || !message || message.length < 20) {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  // 4. Send email via SES
  await sendContactFormEmail({ name, email, subject, message });

  return NextResponse.json({ success: true });
}
```

The rate limit implementation should use the same utility already in the app
(check for an existing `rateLimit` or `checkRateLimit` helper). If none exists,
use a simple in-memory store for launch (acceptable for low-volume launch traffic;
replace with Redis/Upstash before scaling).

### Email template — `src/emails/contact-form-submission.tsx`

React Email template structure:

```
Subject: [Kontax Contact Form] {subject} from {name}

Body:
  New contact form submission

  Name:     {name}
  Email:    {email}
  Subject:  {subject}
  Message:
  ---
  {message}
  ---

  Reply directly to this email to respond to {name}.
```

Set `Reply-To: {email}` header so the team can reply directly to the submitter
from their email client.

**Destination**: send to `support@getkontax.com` (or the team inbox). This
alias must exist before the form is live.

### Success state

After successful submission, the form is replaced with:

```
"Message sent!"
"Thanks for reaching out. We'll get back to you within 1 business day."
[Send another message]
```

Implemented as a `submitted` state in the client form component.

### Client component

The form is a client component (`"use client"`) with `useState` for the
submission state and local validation before the POST. Use the app's existing
`<Input>`, `<Textarea>`, and `<Select>` components (or marketing-specific
equivalents if the app components pull in auth providers).

### Response time note

Below the form (or in the page copy):
```
"We aim to respond within 1 business day. For security vulnerabilities,
 email security@getkontax.com."
```

## Acceptance Criteria

- [ ] Page exists at `/contact` with the four form fields (name, email, subject,
      message) and a submit button.
- [ ] Subject dropdown has all five options including "Security report".
- [ ] Honeypot field is present and invisible to users.
- [ ] Submitting with all fields filled sends an email to the support inbox.
- [ ] Rate limit rejects a 4th submission within 1 hour from the same IP with
      a 429 response and user-visible error message.
- [ ] Success state replaces the form after submission.
- [ ] `support@getkontax.com` alias is live before this page ships.
- [ ] Reply-To header is set to the submitter's email.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Rate limit implementation**: if no existing rate-limit utility covers the
  marketing API route, implement a simple in-memory store for launch. This will
  not persist across server restarts and will not work across multiple instances
  — acceptable for initial launch traffic, but note the limitation.
- **Support inbox**: `support@getkontax.com` must be a live alias to a real
  inbox before the page ships. Track in P34D.
- **Subject labels**: the subject dropdown strings should match how the team
  wants to categorise enquiries. Review with the team before finalising.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: document the contact form email
      routing (SES → support inbox) and how to change the destination address
- [x] Internal · engineering — docs/: document the contact form API route and
      rate-limit approach

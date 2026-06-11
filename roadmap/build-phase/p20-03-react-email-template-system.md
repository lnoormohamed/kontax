# P20-03 — React Email Template System

## Purpose

Establish the shared layout and component library that all Kontax email templates are built from. Without a common layout, individual templates diverge in visual style, have inconsistent spacing, and break in different email clients. React Email (the `@react-email/components` package) provides a set of cross-client-compatible primitives and lets templates be developed and previewed as React components in the browser.

## Background

React Email compiles React components to HTML + plain-text strings that are safe to pass to SES. It handles the email rendering quirks (inline styles, table-based layout, MSO conditionals for Outlook) that make hand-crafted email HTML fragile. Templates are previewed locally at `http://localhost:3001` via the React Email dev server.

## Scope

**In scope:**
- Install `@react-email/components` and `react-email`
- Shared `EmailLayout` component — header (Kontax logo + wordmark), body, footer
- Shared `EmailButton` component — CTA button with consistent styling
- `renderEmail(component)` utility — renders a React Email component to `{ html, text }`
- Preview server setup (`email:preview` npm script)
- Brand tokens for email: colours, typography, border radius (email-safe values)

**Out of scope:**
- Individual template content (P20-04 onward)

---

## Design / Implementation Spec

### Install

```bash
npm install @react-email/components react-email
```

Add to `package.json` scripts:
```json
"email:preview": "email dev --dir src/emails"
```

### Directory structure

```
src/emails/
  _components/
    email-layout.tsx      ← shared wrapper
    email-button.tsx      ← CTA button component
    email-divider.tsx     ← horizontal rule
  verify-email.tsx        ← P20-04
  password-reset.tsx      ← P20-05
  share-invite.tsx        ← P20-06
  suspicious-activity.tsx ← P20-07
  billing-event.tsx       ← P20-08
  digest.tsx              ← P20-09
```

### `EmailLayout`

```tsx
// src/emails/_components/email-layout.tsx
import {
  Body, Container, Head, Html, Preview,
  Section, Text, Hr, Img,
} from "@react-email/components";

interface EmailLayoutProps {
  preview: string;       // preview text shown in inbox before opening
  children: React.ReactNode;
}

export function EmailLayout({ preview, children }: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={headerStyle}>
            <Img
              src={`${process.env.APP_URL}/logo-email.png`}
              width={120}
              height={32}
              alt="Kontax"
            />
          </Section>
          <Hr style={dividerStyle} />

          {/* Body */}
          <Section style={contentStyle}>
            {children}
          </Section>

          <Hr style={dividerStyle} />

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Kontax · You're receiving this because you have an account at kontax.app
            </Text>
            <Text style={footerTextStyle}>
              <a href="{{{unsubscribeUrl}}}" style={footerLinkStyle}>
                Unsubscribe from non-security emails
              </a>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Email-safe inline styles — no Tailwind in email
const bodyStyle = { backgroundColor: "#f4f4f5", margin: "0", padding: "0" };
const containerStyle = {
  backgroundColor: "#ffffff",
  maxWidth: "600px",
  margin: "32px auto",
  borderRadius: "8px",
  border: "1px solid #e4e4e7",
};
const headerStyle = { padding: "24px 32px" };
const contentStyle = { padding: "24px 32px" };
const footerStyle = { padding: "16px 32px 24px" };
const dividerStyle = { borderColor: "#e4e4e7", margin: "0" };
const footerTextStyle = { color: "#71717a", fontSize: "12px", lineHeight: "20px", margin: "4px 0" };
const footerLinkStyle = { color: "#71717a" };
```

### `EmailButton`

```tsx
// src/emails/_components/email-button.tsx
import { Button } from "@react-email/components";

interface EmailButtonProps {
  href: string;
  children: React.ReactNode;
}

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <Button
      href={href}
      style={{
        backgroundColor: "#4158f4",
        borderRadius: "6px",
        color: "#ffffff",
        display: "inline-block",
        fontSize: "14px",
        fontWeight: "600",
        padding: "12px 24px",
        textDecoration: "none",
      }}
    >
      {children}
    </Button>
  );
}
```

### `renderEmail` utility

```typescript
// src/server/render-email.ts
import { render } from "@react-email/components";
import type { ReactElement } from "react";

export async function renderEmail(
  component: ReactElement,
): Promise<{ html: string; text: string }> {
  const html = await render(component);
  const text = await render(component, { plainText: true });
  return { html, text };
}
```

Usage in a template caller:
```typescript
const { html, text } = await renderEmail(
  <VerifyEmailTemplate name={user.name} verifyUrl={verifyUrl} />
);
await sendEmail({ to: user.email, subject: "Confirm your email", html, text });
```

### Brand tokens for email

Email clients ignore Tailwind. All styles must be inline. Define a token object:

```typescript
// src/emails/_tokens.ts
export const tokens = {
  ink: "#1d2823",
  secondary: "#5c655e",
  muted: "#8b938c",
  hairline: "#d8ddd6",
  blue: "#4158f4",
  green: "#17352e",
  red: "#dc2626",
  amber: "#d97706",
  bgPage: "#f4f4f5",
  bgCard: "#ffffff",
  fontFamily: "Geist, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
};
```

---

## Acceptance Criteria

- `npm run email:preview` starts the React Email dev server and shows template previews.
- `EmailLayout` renders consistently in Gmail, Apple Mail, and Outlook (verified via Litmus or email-on-acid, or manually).
- `renderEmail` returns both `html` and `text` strings for any React Email component.
- `EmailButton` renders as a blue CTA button with correct padding.
- Brand tokens are applied consistently across all shared components.

# P20-06 — Template: Contact Share Invite

## Purpose

Phase 12 (P12-06) already sends share notification emails but uses an ad-hoc console-log stub. This ticket replaces that stub with a proper React Email template delivered via the SES transport. Two variants are needed: an invite to an existing Kontax user (with a "View and accept" CTA) and an invite to a non-Kontax user (with a "Create account and receive contact" CTA).

## Scope

**In scope:**
- `ShareInviteTemplate` React Email component — two variants: existing user and new user
- Wire `src/server/contact-shares.ts` (or wherever the share email is called) to use `renderEmail` + `sendEmail`

---

## Design / Implementation Spec

### Template

```tsx
// src/emails/share-invite.tsx
import { Text, Section } from "@react-email/components";
import { EmailLayout } from "./_components/email-layout";
import { EmailButton } from "./_components/email-button";
import { tokens } from "./_tokens";

interface ShareInviteTemplateProps {
  senderName: string;
  contactDisplayName: string;
  contactCompany?: string | null;
  shareType: "STATIC_COPY" | "LIVE_SYNC";
  ctaUrl: string;
  isExistingUser: boolean;
}

export function ShareInviteTemplate({
  senderName, contactDisplayName, contactCompany,
  shareType, ctaUrl, isExistingUser,
}: ShareInviteTemplateProps) {
  const subject_preview = `${senderName} shared a contact with you`;

  return (
    <EmailLayout preview={subject_preview}>
      <Text style={{ color: tokens.ink, fontSize: "20px", fontWeight: "600", margin: "0 0 8px" }}>
        {senderName} shared a contact with you
      </Text>
      <Text style={{ color: tokens.secondary, fontSize: "14px", lineHeight: "22px", margin: "0 0 16px" }}>
        {senderName} shared <strong>{contactDisplayName}</strong>
        {contactCompany ? ` (${contactCompany})` : ""} with you on Kontax.
      </Text>
      {shareType === "LIVE_SYNC" && (
        <Text style={{ color: tokens.secondary, fontSize: "13px", margin: "0 0 16px", fontStyle: "italic" }}>
          This is a live contact — updates made by {senderName} will automatically appear in your account.
        </Text>
      )}
      <Section style={{ marginBottom: "24px" }}>
        <EmailButton href={ctaUrl}>
          {isExistingUser ? "View and accept →" : "Create account and receive contact →"}
        </EmailButton>
      </Section>
      {!isExistingUser && (
        <Text style={{ color: tokens.muted, fontSize: "12px" }}>
          Kontax is a contacts management app. Creating an account is free.
        </Text>
      )}
      <Text style={{ color: tokens.muted, fontSize: "12px" }}>
        If you didn't expect this, you can safely ignore this email.
      </Text>
    </EmailLayout>
  );
}

export default ShareInviteTemplate;
```

### Wire into share logic

In `src/server/contact-shares.ts` (or `src/app/actions/shares.ts`), find the `sendShareInviteEmail` call added in P12-06 and replace the stub with:

```typescript
const isExistingUser = !!recipientUserId;
const ctaUrl = isExistingUser
  ? `${APP_URL}/contacts/shares/pending?highlight=${shareId}`
  : `${APP_URL}/register?pendingShare=${shareId}`;

const { html, text } = await renderEmail(
  <ShareInviteTemplate
    senderName={senderName}
    contactDisplayName={contactDisplayName}
    contactCompany={contactCompany}
    shareType={shareType}
    ctaUrl={ctaUrl}
    isExistingUser={isExistingUser}
  />
);

await sendEmail({
  to: recipientEmail,
  subject: `${senderName} shared a contact with you on Kontax`,
  html,
  text,
});
```

---

## Acceptance Criteria

- Existing Kontax users receive the "View and accept" variant with a link to `/contacts/shares/pending`.
- Non-Kontax users receive the "Create account" variant with a link to `/register?pendingShare=...`.
- Live sync shares include an explanatory note about automatic updates.
- The email is never thrown — a failed send is logged and the share action succeeds regardless.

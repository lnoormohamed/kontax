import * as React from "react";

import { EmailButton } from "./_components/email-button";
import {
  EmailDetailBlock,
  EmailFootnote,
  EmailHeading,
  EmailSectionLabel,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";
import { tokens } from "./_tokens";

interface EmailChangeNoticeProps {
  /** The address this notice is sent to — the account's current address. */
  currentEmail: string;
  /** The address the account is being moved to. */
  newEmail: string;
  /** Pre-formatted timestamp string. */
  requestedAt: string;
  /** One-time link that cancels or reverses the change. */
  revertUrl: string;
  /** Hours until `revertUrl` expires. */
  expiresHours?: number;
}

/**
 * P48-03 — sent to the OLD address whenever an email change is requested.
 *
 * Previously this was a `console.log`, so an attacker with a hijacked session
 * could move the account to their own address and the real owner would never
 * hear about it. This is the notice plus the "this wasn't me" escape hatch: the
 * link cancels the pending change, or restores the previous address if the
 * change has already been confirmed, and signs every session out.
 */
export default function EmailChangeNotice({
  currentEmail,
  newEmail,
  requestedAt,
  revertUrl,
  expiresHours = 24,
}: EmailChangeNoticeProps) {
  return (
    <EmailLayout
      preview="Someone requested a change to your Kontax email address"
      unsubscribe={false}
    >
      <EmailSectionLabel color={tokens.red}>Security alert</EmailSectionLabel>
      <EmailHeading>Your email address is being changed</EmailHeading>
      <EmailText>
        A request was made to change the email address on your Kontax account. The new
        address has to be confirmed before the change takes effect. If you made this
        request, no action is needed.
      </EmailText>
      <EmailDetailBlock
        rows={[
          ["Current address", currentEmail],
          ["New address", newEmail],
          ["Requested", requestedAt],
        ]}
      />
      <EmailText color={tokens.ink}>
        If you didn&rsquo;t request this, use the link below. It cancels the change,
        restores this address if the change has already gone through, and signs out
        every device on the account.
      </EmailText>
      <EmailButton href={revertUrl} tone="red">
        This wasn&rsquo;t me — undo it →
      </EmailButton>
      <EmailFootnote>
        This link expires in {expiresHours} hours and can be used once. Afterwards, reset
        your password to regain control of the account. For your protection, security
        alerts can&rsquo;t be unsubscribed from.
      </EmailFootnote>
    </EmailLayout>
  );
}

EmailChangeNotice.PreviewProps = {
  currentEmail: "old@example.com",
  newEmail: "new@example.com",
  requestedAt: "Jun 11, 2026 · 9:14 AM GMT",
  revertUrl: "https://getkontax.com/settings/account/revert-email?token=preview",
} satisfies EmailChangeNoticeProps;

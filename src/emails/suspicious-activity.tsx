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

interface SuspiciousActivityProps {
  /** Short description of what happened, e.g. "A new device just signed in". */
  activity: string;
  device: string;
  ipAddress: string;
  /** Pre-formatted timestamp string. */
  time: string;
  secureUrl: string;
}

/** Suspicious-activity security alert (P20-07). Cannot be unsubscribed from. */
export default function SuspiciousActivity({
  activity,
  device,
  ipAddress,
  time,
  secureUrl,
}: SuspiciousActivityProps) {
  return (
    <EmailLayout
      preview="Security alert — unusual activity on your Kontax account"
      unsubscribe={false}
    >
      <EmailSectionLabel color={tokens.red}>Security alert</EmailSectionLabel>
      <EmailHeading>Unusual activity detected</EmailHeading>
      <EmailText>{activity} If this was you, no action is needed.</EmailText>
      <EmailDetailBlock
        rows={[
          ["Device", device],
          ["IP address", ipAddress],
          ["Time", time],
        ]}
      />
      <EmailText color={tokens.ink}>
        If you don&rsquo;t recognise this, secure your account now.
      </EmailText>
      <EmailButton href={secureUrl} tone="red">
        Secure my account →
      </EmailButton>
      <EmailFootnote>
        For your protection, security alerts can&rsquo;t be unsubscribed from.
      </EmailFootnote>
    </EmailLayout>
  );
}

SuspiciousActivity.PreviewProps = {
  activity: "A new device just signed in to your Kontax account.",
  device: "Chrome on Windows",
  ipAddress: "203.0.113.42",
  time: "Jun 11, 2026 · 9:14 AM GMT",
  secureUrl: "https://kontax.app/settings/security",
} satisfies SuspiciousActivityProps;

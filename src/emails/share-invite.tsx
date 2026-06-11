import * as React from "react";

import { EmailButton } from "./_components/email-button";
import {
  EmailDetailBlock,
  EmailFootnote,
  EmailHeading,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";

interface ShareInviteProps {
  /** Whether the recipient already has a Kontax account. */
  recipientExists: boolean;
  senderName: string;
  contactName: string;
  company?: string;
  /** Human-readable share type, e.g. "Live · syncs both ways". */
  shareType: string;
  /** Whether this is a live (two-way syncing) share. */
  live: boolean;
  actionUrl: string;
}

/** Share invite (P20-06). Covers existing-user and new-user variants. */
export default function ShareInvite({
  recipientExists,
  senderName,
  contactName,
  company,
  shareType,
  live,
  actionUrl,
}: ShareInviteProps) {
  const rows: [string, string][] = [
    ["Contact", contactName],
    ...(company ? ([["Company", company]] as [string, string][]) : []),
    ["Share type", shareType],
  ];

  return (
    <EmailLayout preview={`${senderName} shared a contact with you`}>
      <EmailHeading>{senderName} shared a contact with you</EmailHeading>
      <EmailText>
        {recipientExists
          ? `Accept to add it to your address book.${live ? " Updates will sync automatically." : ""}`
          : "Create a free account to receive it. Kontax is a free contacts app — no credit card required."}
      </EmailText>
      <EmailDetailBlock rows={rows} />
      <EmailButton href={actionUrl}>
        {recipientExists
          ? "View and accept →"
          : "Create account and receive contact →"}
      </EmailButton>
      <EmailFootnote>
        If you weren&rsquo;t expecting this, you can ignore this email.
      </EmailFootnote>
    </EmailLayout>
  );
}

ShareInvite.PreviewProps = {
  recipientExists: true,
  senderName: "Dana Whitfield",
  contactName: "Marcus Reyes",
  company: "Northwind Studio",
  shareType: "Live · syncs both ways",
  live: true,
  actionUrl: "https://kontax.app/shares",
} satisfies ShareInviteProps;

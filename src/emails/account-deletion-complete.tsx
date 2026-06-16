import { Link, Section, Text } from "@react-email/components";
import * as React from "react";

import {
  EmailDetailBlock,
  EmailHeading,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";
import { tokens } from "./_tokens";

interface AccountDeletionCompleteProps {
  email: string;
  deletedAt: Date;
}

export default function AccountDeletionComplete({
  email,
  deletedAt,
}: AccountDeletionCompleteProps) {
  return (
    <EmailLayout
      preview="Your Kontax account has been permanently deleted"
      unsubscribe={false}
    >
      <EmailHeading>Your account has been deleted</EmailHeading>

      <EmailText>
        Your Kontax account ({email}) has been permanently deleted as requested.
        All associated data has been removed from our servers.
      </EmailText>

      <EmailDetailBlock
        rows={[
          ["Account", email],
          ["Deleted on", deletedAt.toUTCString()],
          ["Data removed", "Contacts, activity log, sync accounts, billing history"],
        ]}
      />

      <EmailText>
        If you didn&rsquo;t request this deletion or believe this is an error, please
        contact Kontax support immediately at{" "}
        <Link href="mailto:support@getkontax.com" style={{ color: tokens.blue }}>
          support@getkontax.com
        </Link>
        .
      </EmailText>

      <Section>
        <Text
          style={{
            fontSize: "12px",
            lineHeight: "20px",
            color: tokens.muted,
            margin: 0,
          }}
        >
          This is a one-time confirmation of account deletion. No further emails
          will be sent to this address from Kontax.
        </Text>
      </Section>
    </EmailLayout>
  );
}

AccountDeletionComplete.PreviewProps = {
  email: "user@example.com",
  deletedAt: new Date("2026-06-14T10:00:00Z"),
} satisfies AccountDeletionCompleteProps;

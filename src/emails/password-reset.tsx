import * as React from "react";

import { EmailButton } from "./_components/email-button";
import {
  EmailFootnote,
  EmailHeading,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";

interface PasswordResetProps {
  resetUrl: string;
}

/** Password reset (P20-05). */
export default function PasswordReset({ resetUrl }: PasswordResetProps) {
  return (
    <EmailLayout preview="Reset your Kontax password">
      <EmailHeading>Reset your password</EmailHeading>
      <EmailText>
        Click below to set a new password. This link expires in 15 minutes.
      </EmailText>
      <EmailButton href={resetUrl}>Reset password →</EmailButton>
      <EmailFootnote>
        If you didn&rsquo;t request this, ignore this email — your password
        hasn&rsquo;t changed.
      </EmailFootnote>
    </EmailLayout>
  );
}

PasswordReset.PreviewProps = {
  resetUrl: "https://kontax.app/reset-password?token=preview",
} satisfies PasswordResetProps;

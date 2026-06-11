import * as React from "react";

import { EmailButton } from "./_components/email-button";
import {
  EmailFootnote,
  EmailHeading,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";

interface VerifyEmailProps {
  variant?: "signup" | "email-change";
  verifyUrl: string;
  /** Hours until the link expires — 72 for signup, 24 for an email change. */
  expiresHours?: number;
}

/** Email verification (P20-04). Covers the SIGNUP and EMAIL_CHANGE variants. */
export default function VerifyEmail({
  variant = "signup",
  verifyUrl,
  expiresHours = variant === "email-change" ? 24 : 72,
}: VerifyEmailProps) {
  const isChange = variant === "email-change";
  return (
    <EmailLayout
      preview={
        isChange
          ? "Confirm your new Kontax email address"
          : "Confirm your Kontax email address"
      }
    >
      <EmailHeading>
        {isChange
          ? "Confirm your new email address"
          : "Confirm your email address"}
      </EmailHeading>
      <EmailText>
        {isChange
          ? "Confirm this new address to finish updating the email on your Kontax account."
          : "Confirm this is your address to finish setting up your Kontax account."}
      </EmailText>
      <EmailButton href={verifyUrl}>Verify email address →</EmailButton>
      <EmailFootnote>
        This link expires in {expiresHours} hours.{" "}
        {isChange
          ? "If you didn't request this change, you can safely ignore this email — your address won't change."
          : "If you didn't request this, you can safely ignore this email."}
      </EmailFootnote>
    </EmailLayout>
  );
}

VerifyEmail.PreviewProps = {
  variant: "signup",
  verifyUrl: "https://kontax.app/verify-email?token=preview",
} satisfies VerifyEmailProps;

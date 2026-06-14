import * as React from "react";

import AccountDeletionComplete from "~/emails/account-deletion-complete";
import { sendEmail } from "~/server/email";
import { renderEmail } from "~/server/render-email";

export async function sendAccountDeletionConfirmationEmail(params: {
  email: string;
  deletedAt: Date;
}): Promise<void> {
  const { html, text } = await renderEmail(
    React.createElement(AccountDeletionComplete, {
      email: params.email,
      deletedAt: params.deletedAt,
    }),
  );

  await sendEmail({
    to: params.email,
    subject: "Your Kontax account has been permanently deleted",
    html,
    text,
    // The user row is gone — isEmailSuppressed will find no user and return
    // false, so this email always sends. No bypassSuppression needed.
  });
}

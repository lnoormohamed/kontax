import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

import { env } from "~/env";

type EmailArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

let client: SESv2Client | null = null;

const getClient = () => {
  if (!env.AWS_REGION) {
    return null;
  }
  // AWS credentials are resolved from the default provider chain (env vars /
  // shared config / IAM role) — no need to pass them explicitly.
  client ??= new SESv2Client({ region: env.AWS_REGION });
  return client;
};

export const isEmailConfigured = () => Boolean(env.AWS_REGION && env.SES_FROM_ADDRESS);

/**
 * Send a transactional email via AWS SES (P12-06). A no-op when SES isn't
 * configured (no AWS_REGION / SES_FROM_ADDRESS) so the rest of the flow — share
 * creation, in-app notifications — never depends on email being set up. Never
 * throws: failures are logged and swallowed so a share is never blocked by email.
 */
export const sendEmail = async ({ to, subject, html, text }: EmailArgs): Promise<boolean> => {
  const ses = getClient();
  if (!ses || !env.SES_FROM_ADDRESS) {
    console.info(`[email] SES not configured — skipping "${subject}" to ${to}`);
    return false;
  }

  try {
    await ses.send(
      new SendEmailCommand({
        FromEmailAddress: env.SES_FROM_ADDRESS,
        Destination: { ToAddresses: [to] },
        Content: {
          Simple: {
            Subject: { Data: subject, Charset: "UTF-8" },
            Body: {
              Html: { Data: html, Charset: "UTF-8" },
              Text: { Data: text, Charset: "UTF-8" },
            },
          },
        },
      }),
    );
    return true;
  } catch (error) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, error);
    return false;
  }
};

export const appUrl = () => env.APP_URL ?? "https://kontax.app";

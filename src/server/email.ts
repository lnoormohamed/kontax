import { SendEmailCommand, SESv2Client } from "@aws-sdk/client-sesv2";

import { db } from "~/server/db";
import { env } from "~/env";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string; // plain-text fallback — required
  /**
   * Skip the bounce/complaint suppression check (P20-10). Reserved for messages
   * the user must receive regardless of email status — e.g. account-suspension
   * notices (P20-08). Defaults to false.
   */
  bypassSuppression?: boolean;
}

interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email is "configured" only when all four SES env vars are present (P20-01).
 * When false, sendEmail logs to the console instead of calling SES, so dev and
 * unconfigured self-hosted deployments work without AWS credentials.
 */
export const SES_CONFIGURED =
  !!env.AWS_ACCESS_KEY_ID &&
  !!env.AWS_SECRET_ACCESS_KEY &&
  !!env.AWS_SES_REGION &&
  !!env.EMAIL_FROM;

if (!SES_CONFIGURED) {
  console.warn(
    "[email] SES not configured — emails will be logged to console only",
  );
}

// Singleton SESv2 client — created on first live send, never per-email.
let client: SESv2Client | null = null;

const getClient = (): SESv2Client => {
  client ??= new SESv2Client({
    region: env.AWS_SES_REGION!,
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
    },
  });
  return client;
};

/**
 * Suppression-list check (P20-10). Returns true when the recipient's address has
 * hard-bounced or filed a complaint, so we stop sending to it and protect sender
 * reputation. Addresses with no matching user (e.g. share invites to non-users)
 * are not suppressed.
 */
async function isEmailSuppressed(email: string): Promise<boolean> {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { emailStatus: true },
  });
  return user?.emailStatus === "BOUNCED" || user?.emailStatus === "COMPLAINED";
}

/**
 * The single transport all email callers converge on (P20-02). Sends via AWS
 * SES when SES_CONFIGURED, otherwise logs to the console. Never throws —
 * failures are returned as { success: false, error } so a share, verification,
 * or invite is never blocked by email.
 */
export const sendEmail = async ({
  to,
  subject,
  html,
  text,
  bypassSuppression = false,
}: SendEmailParams): Promise<SendEmailResult> => {
  if (!bypassSuppression && (await isEmailSuppressed(to))) {
    console.warn(`[email] suppressed send to ${to}`);
    return { success: false, error: "EMAIL_SUPPRESSED" };
  }

  if (!SES_CONFIGURED) {
    console.log(`[email:dev] TO: ${to} | SUBJECT: ${subject}`);
    console.log(`[email:dev] TEXT:\n${text}`);
    return { success: true, messageId: "dev-console" };
  }

  try {
    const result = await getClient().send(
      new SendEmailCommand({
        FromEmailAddress: env.EMAIL_FROM!,
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
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, error);
    return { success: false, error: String(error) };
  }
};

export const appUrl = () => env.APP_URL ?? "https://vexon.co";

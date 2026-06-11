import SuspiciousActivity from "~/emails/suspicious-activity";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";
import { renderEmail } from "~/server/render-email";

/**
 * Send a suspicious-activity security alert email (P20-07). Shared entry point
 * that Phase 22 (P22-05) calls when an anomaly is detected. Always sends to the
 * user's canonical address — security alerts ignore notification preferences.
 * Fire-and-forget at the call site; this never throws (sendEmail swallows
 * transport errors).
 */
export async function sendSuspiciousActivityEmail(params: {
  userId: string;
  activityDescription: string;
  deviceHint?: string | null;
  ipAddress?: string | null;
  occurredAt: Date;
}): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: params.userId },
    select: { email: true },
  });
  if (!user) return;

  const { html, text } = await renderEmail(
    SuspiciousActivity({
      activity: params.activityDescription,
      device: params.deviceHint ?? "Unknown device",
      ipAddress: params.ipAddress ?? "Unknown",
      time: params.occurredAt.toUTCString(),
      secureUrl: `${appUrl()}/forgot-password`,
    }),
  );

  await sendEmail({
    to: user.email,
    subject: "Security alert — unusual activity on your Kontax account",
    html,
    text,
  });
}

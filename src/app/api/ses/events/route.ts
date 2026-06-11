import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/server/db";

export const dynamic = "force-dynamic";

// Minimal shapes for the SES notification payload SNS delivers (P20-10).
interface SnsEnvelope {
  Type?: string;
  SubscribeURL?: string;
  Message?: string;
}

interface SesBounceNotification {
  notificationType: "Bounce";
  bounce: {
    bounceType: "Permanent" | "Transient" | "Undetermined";
    bouncedRecipients: { emailAddress: string }[];
  };
}

interface SesComplaintNotification {
  notificationType: "Complaint";
  complaint: { complainedRecipients: { emailAddress: string }[] };
}

type SesNotification =
  | SesBounceNotification
  | SesComplaintNotification
  | { notificationType: string };

/**
 * SNS webhook for SES bounce & complaint events (P20-10). SES publishes to the
 * `kontax-email-events` SNS topic (P20-01), which POSTs here. Hard bounces and
 * complaints mark the recipient's `emailStatus` so future sends are suppressed.
 *
 * This route is excluded from session auth (see PUBLIC_PATHS in middleware).
 * v1 trusts the (unguessable) endpoint URL; production hardening should verify
 * the SNS message signature.
 */
export async function POST(req: NextRequest) {
  // SNS sets the message type in a header; fall back to the body's Type field.
  const body = (await req.json()) as SnsEnvelope;
  const messageType =
    req.headers.get("x-amz-sns-message-type") ?? body.Type ?? "";

  // First delivery: confirm the subscription by fetching the SubscribeURL.
  if (messageType === "SubscriptionConfirmation") {
    if (body.SubscribeURL) {
      await fetch(body.SubscribeURL).catch((err) =>
        console.error("[ses-events] subscription confirm failed:", err),
      );
    }
    return NextResponse.json({ confirmed: true });
  }

  if (messageType !== "Notification" || !body.Message) {
    return NextResponse.json({ ignored: true });
  }

  let message: SesNotification;
  try {
    message = JSON.parse(body.Message) as SesNotification;
  } catch {
    return NextResponse.json({ ignored: true });
  }

  if (message.notificationType === "Bounce") {
    const { bounce } = message as SesBounceNotification;
    // Only hard (Permanent) bounces suppress — transient bounces may recover.
    if (bounce.bounceType === "Permanent") {
      for (const r of bounce.bouncedRecipients) {
        await db.user.updateMany({
          where: { email: r.emailAddress.toLowerCase() },
          data: { emailStatus: "BOUNCED" },
        });
      }
    }
  } else if (message.notificationType === "Complaint") {
    const { complaint } = message as SesComplaintNotification;
    for (const r of complaint.complainedRecipients) {
      await db.user.updateMany({
        where: { email: r.emailAddress.toLowerCase() },
        data: { emailStatus: "COMPLAINED" },
      });
    }
  }

  return NextResponse.json({ processed: true });
}

import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/server/db";
import { isSnsHttpsUrl, verifySnsSignature } from "~/server/sns-verify";

export const dynamic = "force-dynamic";
// X509Certificate / createVerify (used by verifySnsSignature) require the Node
// runtime; be explicit rather than relying on the default.
export const runtime = "nodejs";

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
 * This route is excluded from session auth (see PUBLIC_PATHS in middleware). It
 * is public, so every message is authenticated via its SNS signature (SEC-03)
 * before we act on it — otherwise an attacker could forge bounce/complaint
 * notifications to suppress any user's email, or trigger SSRF via SubscribeURL.
 */
export async function POST(req: NextRequest) {
  let body: SnsEnvelope & Record<string, unknown>;
  try {
    body = (await req.json()) as SnsEnvelope & Record<string, unknown>;
  } catch {
    // Empty or malformed body — never from real SNS. Return 400 (not 500) so it
    // isn't treated as a server fault that SNS would keep retrying.
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Authenticate: reject anything that isn't a signature-valid SNS message.
  const authentic = await verifySnsSignature(body);
  if (!authentic) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 403 });
  }

  // Type is signature-covered, so trust the body field over the header now.
  const messageType = typeof body.Type === "string" ? body.Type : "";

  // First delivery: confirm the subscription by fetching the SubscribeURL. The
  // URL is signature-covered, but enforce the AWS-SNS host allowlist before the
  // fetch as belt-and-braces against SSRF.
  if (messageType === "SubscriptionConfirmation") {
    if (isSnsHttpsUrl(body.SubscribeURL)) {
      await fetch(body.SubscribeURL!).catch((err) =>
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

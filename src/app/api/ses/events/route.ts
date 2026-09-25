import { type NextRequest, NextResponse } from "next/server";

import { env } from "~/env";
import { db } from "~/server/db";
import { getRedis } from "~/server/rate-limit";
import { isSnsHttpsUrl, verifySnsSignature } from "~/server/sns-verify";

// P49A-08: bind this webhook to Kontax's own SNS topic(s) — without this, a
// validly-signed message from ANY SNS topic in ANY AWS account (attacker's own
// included) would be processed, since the signature only proves "genuinely
// from SNS", not "from our topic". SES_SNS_TOPIC_ARN is a comma-separated
// allow-list; deliberately optional in src/env.js and NOT required at boot —
// prod doesn't set it today, and a required-at-boot var here would take the
// whole site down. So this fails CLOSED instead: unset means every message is
// rejected, logged once, rather than "accept anything, unchecked".
const ALLOWED_SNS_TOPIC_ARNS = new Set(
  (env.SES_SNS_TOPIC_ARN ?? "")
    .split(",")
    .map((arn) => arn.trim())
    .filter(Boolean),
);

let warnedMissingTopicAllowlist = false;

function isAllowedSnsTopic(topicArn: unknown): boolean {
  if (ALLOWED_SNS_TOPIC_ARNS.size === 0) {
    if (!warnedMissingTopicAllowlist) {
      warnedMissingTopicAllowlist = true;
      console.warn(
        "[ses-events] SES_SNS_TOPIC_ARN is not set — rejecting every SNS message " +
          "until it's configured (see roadmap/runbooks/ses-setup.md).",
      );
    }
    return false;
  }
  return typeof topicArn === "string" && ALLOWED_SNS_TOPIC_ARNS.has(topicArn);
}

// P48-17: SNS is at-least-once delivery and can also legitimately redeliver a
// message it never got an ack for — signature + Timestamp freshness
// (sns-verify.ts) alone don't stop a genuine SNS redelivery, or a captured
// message replayed inside the freshness window, from being processed twice.
// `SET NX EX` on the MessageId makes processing idempotent: the first delivery
// claims the id, every later delivery of the same id is a no-op. Redis is
// required in production (see rate-limit.ts), so this only silently skips
// dedupe in dev/test where REDIS_URL is unset — signature + freshness still
// apply there.
const MESSAGE_ID_DEDUPE_TTL_SECONDS = 24 * 60 * 60;

async function claimMessageIdOnce(messageId: string | undefined): Promise<boolean> {
  if (!messageId) return true; // nothing to dedupe on; let it through
  const redis = getRedis();
  if (!redis) return true; // no shared store available — skip dedupe, don't fail closed
  const result = await redis.set(
    `sns:msgid:${messageId}`,
    "1",
    "EX",
    MESSAGE_ID_DEDUPE_TTL_SECONDS,
    "NX",
  );
  return result === "OK";
}

export const dynamic = "force-dynamic";
// X509Certificate / createVerify (used by verifySnsSignature) require the Node
// runtime; be explicit rather than relying on the default.
export const runtime = "nodejs";

// Minimal shapes for the SES notification payload SNS delivers (P20-10).
interface SnsEnvelope {
  Type?: string;
  SubscribeURL?: string;
  Message?: string;
  MessageId?: string;
  TopicArn?: string;
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

  // Authenticate: reject anything that isn't a signature-valid, fresh SNS message.
  const authentic = await verifySnsSignature(body);
  if (!authentic) {
    return NextResponse.json({ error: "signature verification failed" }, { status: 403 });
  }

  // P49A-08: TopicArn is part of the signed payload (see SIGNABLE_KEYS in
  // sns-verify.ts), so it's trustworthy now that the signature has verified —
  // this check MUST run after verifySnsSignature, never before. Reject before
  // the SubscribeURL fetch and before touching any Bounce/Complaint data, so a
  // validly-signed message from a topic that isn't ours never confirms a
  // subscription or writes to the DB. No PII in the log — TopicArn is an ARN,
  // never an email address.
  if (!isAllowedSnsTopic(body.TopicArn)) {
    console.warn(`[ses-events] rejected: TopicArn not in allow-list (type=${body.Type ?? "unknown"})`);
    return NextResponse.json({ error: "topic not allowed" }, { status: 403 });
  }

  // P48-17: dedupe by MessageId (signature-covered) so a genuine SNS
  // redelivery or a captured-and-replayed message (within the freshness
  // window) is processed at most once.
  const firstDelivery = await claimMessageIdOnce(body.MessageId);
  if (!firstDelivery) {
    return NextResponse.json({ deduped: true });
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

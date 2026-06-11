import type { SubscriptionPlan } from "../../generated/prisma";
import BillingEvent from "~/emails/billing-event";
import { db } from "~/server/db";
import { appUrl, sendEmail } from "~/server/email";
import { renderEmail } from "~/server/render-email";

// Plan presentation + ranking, local to the email layer so it doesn't couple to
// the webhook handlers (which would create an import cycle).
const PLAN_DISPLAY: Record<SubscriptionPlan, string> = {
  FREE: "Free",
  PRO: "Kontax Pro",
  FAMILY: "Kontax Family",
  TEAMS: "Kontax Teams",
};
const PLAN_RANK: Record<SubscriptionPlan, number> = {
  FREE: 0,
  PRO: 1,
  FAMILY: 2,
  TEAMS: 3,
};

const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);

async function emailFor(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  return user?.email ?? null;
}

/** Payment failed — prompt to update the payment method before grace ends (P20-08). */
export async function sendPaymentFailedEmail(params: {
  userId: string;
  graceEndsAt: Date;
  planName: SubscriptionPlan;
}): Promise<void> {
  const to = await emailFor(params.userId);
  if (!to) return;

  const graceDays = Math.max(
    1,
    Math.ceil((params.graceEndsAt.getTime() - Date.now()) / 86_400_000),
  );
  const { html, text } = await renderEmail(
    BillingEvent({
      type: "payment-failed",
      planName: PLAN_DISPLAY[params.planName],
      graceDays,
      graceDate: fmtDate(params.graceEndsAt),
      updateUrl: `${appUrl()}/settings`,
    }),
  );
  await sendEmail({
    to,
    subject: "Action required: your Kontax payment failed",
    html,
    text,
  });
}

/** Trial ending in N days — prompt to add a payment method (P20-08). */
export async function sendTrialEndingEmail(params: {
  userId: string;
  daysLeft: number;
  trialEndsAt: Date;
}): Promise<void> {
  const to = await emailFor(params.userId);
  if (!to) return;

  const { html, text } = await renderEmail(
    BillingEvent({
      type: "trial-ending",
      planName: "Kontax Pro",
      daysLeft: params.daysLeft,
      endDate: fmtDate(params.trialEndsAt),
      updateUrl: `${appUrl()}/settings`,
    }),
  );
  await sendEmail({
    to,
    subject: `Your Kontax Pro trial ends in ${params.daysLeft} day${params.daysLeft === 1 ? "" : "s"}`,
    html,
    text,
  });
}

/** Plan changed — upgrade confirmation or downgrade summary (P20-08). */
export async function sendPlanChangedEmail(params: {
  userId: string;
  fromPlan: SubscriptionPlan;
  toPlan: SubscriptionPlan;
}): Promise<void> {
  const to = await emailFor(params.userId);
  if (!to) return;

  const isUpgrade = PLAN_RANK[params.toPlan] > PLAN_RANK[params.fromPlan];

  if (isUpgrade) {
    const { html, text } = await renderEmail(
      BillingEvent({
        type: "plan-upgraded",
        planName: PLAN_DISPLAY[params.toPlan],
      }),
    );
    await sendEmail({
      to,
      subject: `Welcome to ${PLAN_DISPLAY[params.toPlan]}`,
      html,
      text,
    });
    return;
  }

  const changes =
    params.toPlan === "FREE"
      ? [
          "Live sharing is paused — existing shares are now read-only",
          "Sync runs once daily instead of in real time",
          "All your contacts are kept — nothing was deleted",
        ]
      : [
          `Your plan moved from ${PLAN_DISPLAY[params.fromPlan]} to ${PLAN_DISPLAY[params.toPlan]}`,
        ];

  const { html, text } = await renderEmail(
    BillingEvent({
      type: "plan-downgraded",
      toPlan: PLAN_DISPLAY[params.toPlan],
      changes,
      settingsUrl: `${appUrl()}/settings`,
    }),
  );
  await sendEmail({ to, subject: "Your Kontax plan has changed", html, text });
}

/**
 * Account scheduled for deletion — 30-day countdown with a cancel link (P20-08
 * / P18-09).
 */
export async function sendAccountDeletionScheduledEmail(params: {
  userId: string;
  scheduledDeleteAt: Date;
}): Promise<void> {
  const to = await emailFor(params.userId);
  if (!to) return;

  const { html, text } = await renderEmail(
    BillingEvent({
      type: "account-deletion",
      scheduledDeleteDate: fmtDate(params.scheduledDeleteAt),
      cancelUrl: `${appUrl()}/login`,
    }),
  );
  await sendEmail({
    to,
    subject: "Your Kontax account is scheduled for deletion",
    html,
    text,
  });
}

/**
 * Account suspended by an admin (P20-08, called by P21-05). Bypasses the
 * suppression check — the user must be told even if their address has bounced.
 */
export async function sendAccountSuspendedEmail(params: {
  userId: string;
  reason: string;
}): Promise<void> {
  const to = await emailFor(params.userId);
  if (!to) return;

  const { html, text } = await renderEmail(
    BillingEvent({
      type: "account-suspended",
      reason: params.reason,
      supportUrl: `${appUrl()}/support`,
    }),
  );
  await sendEmail({
    to,
    subject: "Your Kontax account has been suspended",
    html,
    text,
    bypassSuppression: true,
  });
}

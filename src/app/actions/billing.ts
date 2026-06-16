"use server";

import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getStripeClient } from "~/server/stripe";
import { ensureStripeCustomer, ensureTeamStripeCustomer } from "~/server/stripe-customers";
import { getStripePriceIdAsync } from "~/server/stripe-prices";
import { ensurePendingTeamGroup } from "~/server/team-provisioning";

const CheckoutInputSchema = z.object({
  plan: z.enum(["PRO", "FAMILY", "TEAMS"]),
  interval: z.enum(["MONTHLY", "YEARLY"]),
  seats: z.number().int().min(3).max(500).optional(),
});

const isLegacyManualSubscription = (subscriptionId: string | null | undefined) =>
  !!subscriptionId && subscriptionId.startsWith("manual_");

export async function createCheckoutSession(input: {
  plan: string;
  interval: string;
  seats?: number;
}): Promise<{ url: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  const userId = session.user.id;

  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) return { error: "INVALID_PLAN" };
  const { plan, interval, seats } = parsed.data;
  const quantity = plan === "TEAMS" ? Math.max(3, seats ?? 3) : 1;

  // If the user already has an active paid subscription, send them to the portal.
  // P34F-02: a Teams subscription is org-anchored — check the user's owned team
  // group's subscription, not the user's personal one.
  if (plan === "TEAMS") {
    const teamGroup = await db.group.findFirst({
      where: { ownerId: userId, type: "TEAM" },
      select: { id: true },
    });
    if (teamGroup) {
      const groupSub = await db.subscription.findFirst({
        where: {
          groupId: teamGroup.id,
          status: { in: ["ACTIVE", "TRIALING"] },
          plan: { not: "FREE" },
        },
        select: { id: true, providerSubscriptionId: true },
      });
      if (groupSub && !isLegacyManualSubscription(groupSub.providerSubscriptionId)) {
        return { error: "USE_CUSTOMER_PORTAL" };
      }
    }
  } else {
    const activeSub = await db.subscription.findFirst({
      where: {
        userId,
        status: { in: ["ACTIVE", "TRIALING"] },
        plan: { not: "FREE" },
      },
      select: { id: true, providerSubscriptionId: true },
    });
    if (activeSub && !isLegacyManualSubscription(activeSub.providerSubscriptionId)) {
      return { error: "USE_CUSTOMER_PORTAL" };
    }
  }

  // 14-day trial for first-time Pro subscribers (no previous non-incomplete Pro sub).
  const isFirstTimePro =
    plan === "PRO" &&
    !(await db.subscription.findFirst({
      where: { userId, plan: "PRO", status: { not: "INCOMPLETE" } },
      select: { id: true },
    }));

  let priceId: string;
  try {
    priceId = await getStripePriceIdAsync(plan, interval);
  } catch {
    return { error: "BILLING_NOT_CONFIGURED" };
  }

  // P34F-02 (Option A): for Teams, provision the org's group + Stripe customer
  // BEFORE checkout so billing anchors to the group, not the person.
  let stripeCustomerId: string;
  let teamGroupId: string | null = null;
  try {
    if (plan === "TEAMS") {
      teamGroupId = await ensurePendingTeamGroup(userId);
      stripeCustomerId = await ensureTeamStripeCustomer(teamGroupId);
    } else {
      stripeCustomerId = await ensureStripeCustomer(userId);
    }
  } catch {
    return { error: "BILLING_NOT_CONFIGURED" };
  }

  const stripe = getStripeClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  // P26-14: Family/Teams checkouts land on the dedicated getting-started wizard;
  // all other plans return to settings as before.
  const successUrl =
    plan === "FAMILY"
      ? `${appUrl}/welcome/family?checkout=success`
      : plan === "TEAMS"
        ? `${appUrl}/welcome/teams?checkout=success`
        : `${appUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`;

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity }],
      success_url: successUrl,
      cancel_url: `${appUrl}/pricing?cancelled=1`,
      subscription_data: {
        trial_period_days: isFirstTimePro ? 14 : undefined,
        // P34F-02: Teams subscriptions are resolved back to the org via
        // kontaxGroupId (no kontaxUserId); personal plans keep kontaxUserId.
        metadata:
          plan === "TEAMS"
            ? { kontaxGroupId: teamGroupId!, plan }
            : { kontaxUserId: userId, plan },
      },
      allow_promotion_codes: true,
      billing_address_collection: "auto",
    });

    if (!checkoutSession.url) return { error: "SESSION_URL_MISSING" };
    return { url: checkoutSession.url };
  } catch {
    return { error: "STRIPE_ERROR" };
  }
}

/**
 * Fetches the live usage data needed to populate the downgrade confirmation modal.
 * Called from the pricing page when the user clicks "Downgrade to Free".
 */
export async function getDowngradeSummary(): Promise<
  | {
      syncConnections: number;
      liveContacts: number;
      totalContacts: number;
      contactLimit: number;
      familyMembers: number | null;
    }
  | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  const userId = session.user.id;

  const [syncConnections, liveContacts, totalContacts, familyGroup] = await Promise.all([
    db.syncAccount.count({ where: { userId, status: "ACTIVE" } }),
    db.contactShare.count({
      where: { recipientUserId: userId, shareType: "LIVE_SYNC", status: "ACTIVE" },
    }),
    db.contact.count({ where: { userId } }),
    db.groupMember.findFirst({
      where: { userId, inviteStatus: "ACCEPTED", role: "OWNER" },
      select: { group: { select: { type: true, _count: { select: { members: true } } } } },
    }),
  ]);

  const familyMembers =
    familyGroup?.group.type === "FAMILY"
      ? Math.max(0, familyGroup.group._count.members - 1)
      : null;

  return { syncConnections, liveContacts, totalContacts, contactLimit: 500, familyMembers };
}

/**
 * Open the Stripe-hosted customer portal where the user manages payment method,
 * invoices, plan changes and cancellation. The portal is the single destination
 * for every "Manage billing / Update payment method / Keep my plan" CTA across
 * the P19-DB02 surfaces — the app never mutates subscription rows directly.
 */
export async function createBillingPortalSession(): Promise<
  { url: string } | { error: string }
> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  const userId = session.user.id;

  const customer = await db.subscriptionCustomer.findUnique({
    where: { userId },
    select: { providerCustomerId: true },
  });
  if (!customer) return { error: "NO_BILLING_ACCOUNT" };

  let stripe: ReturnType<typeof getStripeClient>;
  try {
    stripe = getStripeClient();
  } catch {
    return { error: "BILLING_NOT_CONFIGURED" };
  }

  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  try {
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customer.providerCustomerId,
      return_url: `${appUrl}/settings?portal=returned`,
    });
    if (!portalSession.url) return { error: "SESSION_URL_MISSING" };
    return { url: portalSession.url };
  } catch {
    return { error: "STRIPE_ERROR" };
  }
}

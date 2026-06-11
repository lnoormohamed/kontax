"use server";

import { z } from "zod";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { getStripeClient } from "~/server/stripe";
import { ensureStripeCustomer } from "~/server/stripe-customers";
import { getStripePriceId } from "~/server/stripe-prices";

const CheckoutInputSchema = z.object({
  plan: z.enum(["PRO", "FAMILY", "TEAMS"]),
  interval: z.enum(["MONTHLY", "YEARLY"]),
});

export async function createCheckoutSession(input: {
  plan: string;
  interval: string;
}): Promise<{ url: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "UNAUTHORIZED" };
  const userId = session.user.id;

  const parsed = CheckoutInputSchema.safeParse(input);
  if (!parsed.success) return { error: "INVALID_PLAN" };
  const { plan, interval } = parsed.data;

  // If the user already has an active paid subscription, send them to the portal
  const activeSub = await db.subscription.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "TRIALING"] },
      plan: { not: "FREE" },
    },
    select: { id: true },
  });
  if (activeSub) return { error: "USE_CUSTOMER_PORTAL" };

  let priceId: string;
  try {
    priceId = getStripePriceId(plan, interval);
  } catch {
    return { error: "BILLING_NOT_CONFIGURED" };
  }

  let stripeCustomerId: string;
  try {
    stripeCustomerId = await ensureStripeCustomer(userId);
  } catch {
    return { error: "BILLING_NOT_CONFIGURED" };
  }

  const stripe = getStripeClient();
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pricing?cancelled=1`,
      subscription_data: {
        metadata: { kontaxUserId: userId, plan },
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
      return_url: `${appUrl}/settings`,
    });
    if (!portalSession.url) return { error: "SESSION_URL_MISSING" };
    return { url: portalSession.url };
  } catch {
    return { error: "STRIPE_ERROR" };
  }
}

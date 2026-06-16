import { db } from "~/server/db";
import { getStripeClient } from "~/server/stripe";

const isLegacyManualStripeCustomer = (customerId: string) =>
  customerId.startsWith("manual_");

export async function ensureStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripeClient();

  const existing = await db.subscriptionCustomer.findUnique({
    where: { userId },
    select: { id: true, providerCustomerId: true },
  });
  if (existing && !isLegacyManualStripeCustomer(existing.providerCustomerId)) {
    return existing.providerCustomerId;
  }

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { kontaxUserId: userId },
  });

  if (existing) {
    await db.subscriptionCustomer.update({
      where: { id: existing.id },
      data: {
        provider: "STRIPE",
        providerCustomerId: customer.id,
        billingEmail: user.email,
      },
    });
  } else {
    await db.subscriptionCustomer.create({
      data: {
        userId,
        provider: "STRIPE",
        providerCustomerId: customer.id,
        billingEmail: user.email,
      },
    });
  }

  return customer.id;
}

// P34F-02: org-anchored billing. The Stripe customer for a Teams plan represents
// the Group, not a person — so it survives members (and the owner) coming and
// going. Metadata carries kontaxGroupId (no kontaxUserId); the webhook resolver
// branches on the SubscriptionCustomer.groupId column to route events to the org.
export async function ensureTeamStripeCustomer(groupId: string): Promise<string> {
  const stripe = getStripeClient();

  const existing = await db.subscriptionCustomer.findUnique({
    where: { groupId },
    select: { id: true, providerCustomerId: true },
  });
  if (existing && !isLegacyManualStripeCustomer(existing.providerCustomerId)) {
    return existing.providerCustomerId;
  }

  const group = await db.group.findUniqueOrThrow({
    where: { id: groupId },
    select: { name: true, owner: { select: { email: true } } },
  });

  const customer = await stripe.customers.create({
    // Billing contact starts as the owner's email; editable in the portal. The
    // anchor is the group, not this email.
    email: group.owner.email,
    name: group.name,
    metadata: { kontaxGroupId: groupId },
  });

  if (existing) {
    await db.subscriptionCustomer.update({
      where: { id: existing.id },
      data: {
        provider: "STRIPE",
        providerCustomerId: customer.id,
        billingEmail: group.owner.email,
      },
    });
  } else {
    await db.subscriptionCustomer.create({
      data: {
        groupId,
        provider: "STRIPE",
        providerCustomerId: customer.id,
        billingEmail: group.owner.email,
      },
    });
  }

  return customer.id;
}

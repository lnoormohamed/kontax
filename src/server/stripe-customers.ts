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

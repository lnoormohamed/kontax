import { db } from "~/server/db";
import { getStripeClient } from "~/server/stripe";

export async function ensureStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripeClient();

  const existing = await db.subscriptionCustomer.findUnique({
    where: { userId },
    select: { providerCustomerId: true },
  });
  if (existing) return existing.providerCustomerId;

  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, name: true },
  });

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.name ?? undefined,
    metadata: { kontaxUserId: userId },
  });

  await db.subscriptionCustomer.create({
    data: {
      userId,
      provider: "STRIPE",
      providerCustomerId: customer.id,
      billingEmail: user.email,
    },
  });

  return customer.id;
}

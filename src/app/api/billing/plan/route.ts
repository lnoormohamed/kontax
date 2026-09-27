import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";

/**
 * P38-10 — tiny plan lookup for statically rendered pages (the /pricing page
 * highlights the visitor's current plan without forcing the whole page
 * dynamic). Anonymous visitors get { plan: null }.
 *
 * P49A-19 (Fable review): `paymentLapse` is the plan held back by an unpaid
 * invoice past the 3-day grace ({ plan } or null), so /pricing offers
 * "Update payment method" rather than a checkout that would start a second
 * subscription.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ plan: null, paymentLapse: null });
  }
  try {
    const context = await getUserBillingContext(session.user.id);
    return NextResponse.json(
      {
        plan: context.plan,
        paymentLapse: context.paymentLapse ? { plan: context.paymentLapse.plan } : null,
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch {
    return NextResponse.json({ plan: null, paymentLapse: null });
  }
}

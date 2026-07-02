import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";

/**
 * P38-10 — tiny plan lookup for statically rendered pages (the /pricing page
 * highlights the visitor's current plan without forcing the whole page
 * dynamic). Anonymous visitors get { plan: null }.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ plan: null });
  }
  try {
    const context = await getUserBillingContext(session.user.id);
    return NextResponse.json(
      { plan: context.plan },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch {
    return NextResponse.json({ plan: null });
  }
}

import { type NextRequest, NextResponse } from "next/server";

import { getClientIp } from "~/lib/client-ip";
import { db } from "~/server/db";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;

  // P48-10: unauthenticated counter — rate-limit per client IP. Respond 200
  // either way so the public card never leaks whether a click was counted.
  const ip = getClientIp(req.headers);
  if (ip) {
    const rl = await checkRateLimit(rateLimiters.cardClick, `ip:${ip}`);
    if (!rl.allowed) return NextResponse.json({ ok: true });
  }

  await db.user
    .update({
      where: { username: username.toLowerCase() },
      data: { addToKontaxClicks: { increment: 1 } },
    })
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}

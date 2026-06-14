import { type NextRequest, NextResponse } from "next/server";

import { db } from "~/server/db";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  await db.user
    .update({
      where: { username: username.toLowerCase() },
      data: { addToKontaxClicks: { increment: 1 } },
    })
    .catch(() => undefined);
  return NextResponse.json({ ok: true });
}

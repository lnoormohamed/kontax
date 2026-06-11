import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";
import { sendVerificationEmail } from "~/server/email-verification";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const rl = await checkRateLimit(rateLimiters.registration, `ip:${ip}`);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: "Too many accounts created from this IP. Please try again later." },
      { status: 429 },
    );
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const parsedBody = registerSchema.safeParse(rawBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      { message: "Please provide a valid name, email, and password." },
      { status: 400 },
    );
  }

  const existingUser = await db.user.findUnique({
    where: {
      email: parsedBody.data.email,
    },
  });

  if (existingUser) {
    return NextResponse.json(
      { message: "An account with that email already exists." },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(parsedBody.data.password, 12);

  const user = await db.user.create({
    data: {
      email: parsedBody.data.email,
      name: parsedBody.data.name,
      password: passwordHash,
    },
    select: { id: true },
  });

  // P12-06: link any pending shares sent to this email before the recipient had
  // an account, so they appear in "Shared with me" on first login.
  await db.contactShare.updateMany({
    where: {
      recipientEmail: parsedBody.data.email,
      recipientUserId: null,
      status: "ACTIVE",
    },
    data: { recipientUserId: user.id },
  });

  // P13-02: link pending family invites addressed to this email to the new
  // account so the join link resolves to them after registration.
  await db.groupMember.updateMany({
    where: {
      invitedEmail: parsedBody.data.email,
      userId: null,
      inviteStatus: "PENDING",
    },
    data: { userId: user.id },
  });

  // Send verification email — failure must never block registration
  sendVerificationEmail(user.id, "SIGNUP").catch((err: unknown) =>
    console.warn("[Kontax] Failed to send verification email:", err),
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

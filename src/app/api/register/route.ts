import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { db } from "~/server/db";

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
  name: z.string().trim().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
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

  return NextResponse.json({ ok: true }, { status: 201 });
}

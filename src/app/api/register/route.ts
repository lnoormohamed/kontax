import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getClientIp } from "~/lib/client-ip";
import { seedDefaultBooksForNewUser } from "~/server/address-books";
import { db } from "~/server/db";
import { sendVerificationEmail } from "~/server/email-verification";
import { checkRateLimit, rateLimiters } from "~/server/rate-limit";

// P48-17: same constraint as updateProfile (account.ts) — Unicode letters/
// marks/digits, spaces, and common name punctuation only. Without this a
// freshly-registered name could carry arbitrary text into share-invite and
// family/team-invite emails and in-app notifications from day one.
const NAME_PATTERN = /^[\p{L}\p{M}\p{N} .'\-,]+$/u;

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8),
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .regex(NAME_PATTERN, "Name may only contain letters, numbers, spaces, and . ' - ,")
    .optional(),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers) ?? "unknown";

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
      // P40-08: born into the books model — the migration explainer never shows.
      preferences: { booksNative: true },
    },
    select: { id: true },
  });

  // P40-05: seed the Personal + Work book pair for the new account. Non-blocking —
  // if it fails, getUserDefaultBook() lazily provisions a default book later, so a
  // transient hiccup here must never fail an otherwise-valid registration.
  await seedDefaultBooksForNewUser(user.id).catch((err: unknown) =>
    console.warn("[Kontax] Failed to seed default books:", err),
  );

  // P48-03: pending shares (P12-06) and family invites (P13-02) addressed to
  // this email are NO LONGER claimed here. At this point `emailVerified` is
  // null — anyone who knows an address that has contacts shared to it could
  // register with it and immediately read them. The linking now runs in the
  // SIGNUP branch of `verifyEmailToken`, once the address is proven.

  // Send verification email — failure must never block registration
  sendVerificationEmail(user.id, "SIGNUP").catch((err: unknown) =>
    console.warn("[Kontax] Failed to send verification email:", err),
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}

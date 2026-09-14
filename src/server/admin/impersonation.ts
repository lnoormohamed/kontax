import "server-only";

import { createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "~/env";

// P21-07: impersonation is carried in a separate signed, httpOnly cookie — NOT
// the auth JWT — so the admin's real identity/role is never lost. auth() reads
// this cookie and, only when the real user is ADMIN, resolves the session to the
// impersonated user (read-only).

const COOKIE = "kontax_imp";
const TTL_SECONDS = 30 * 60; // 30-minute impersonation window

// P48-16: the signing key is derived from AUTH_SECRET with HKDF rather than
// being AUTH_SECRET itself, so the impersonation cookie MAC is domain-separated
// from the session JWT signature. There is deliberately no fallback: this
// cookie elevates an admin into another user's account, so an unset AUTH_SECRET
// must be a hard failure, not a well-known hard-coded secret anyone could forge
// a token with.
const HKDF_INFO = "kontax:impersonation";

let cachedKey: Buffer | null = null;

function getSigningKey(): Buffer {
  if (cachedKey) return cachedKey;

  const secret = env.AUTH_SECRET;
  if (!secret) {
    throw new Error(
      "AUTH_SECRET is required to sign impersonation cookies. Set AUTH_SECRET (generate with `npx auth secret`).",
    );
  }

  cachedKey = Buffer.from(
    hkdfSync("sha256", Buffer.from(secret, "utf8"), Buffer.alloc(0), HKDF_INFO, 32),
  );
  return cachedKey;
}

type ImpersonationPayload = { adminId: string; targetId: string; exp: number };

function sign(value: string): string {
  return createHmac("sha256", getSigningKey()).update(value).digest("base64url");
}

function encode(payload: ImpersonationPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): ImpersonationPayload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  // An unset AUTH_SECRET makes `sign` throw. On the *verify* path that must
  // read as "not impersonating", never as an unhandled error on every request.
  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as ImpersonationPayload;
    if (!payload.adminId || !payload.targetId) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function setImpersonation(adminId: string, targetId: string): Promise<void> {
  const token = encode({ adminId, targetId, exp: Date.now() + TTL_SECONDS * 1000 });
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_SECONDS,
  });
}

export async function clearImpersonation(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE);
}

export async function readImpersonation(): Promise<{ adminId: string; targetId: string; exp: number } | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const payload = decode(token);
  return payload ? { adminId: payload.adminId, targetId: payload.targetId, exp: payload.exp } : null;
}

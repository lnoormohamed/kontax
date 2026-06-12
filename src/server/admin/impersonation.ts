import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "~/env";

// P21-07: impersonation is carried in a separate signed, httpOnly cookie — NOT
// the auth JWT — so the admin's real identity/role is never lost. auth() reads
// this cookie and, only when the real user is ADMIN, resolves the session to the
// impersonated user (read-only).

const COOKIE = "kontax_imp";
const TTL_SECONDS = 30 * 60; // 30-minute impersonation window
const SECRET = env.AUTH_SECRET ?? "kontax-dev-impersonation-secret";

type ImpersonationPayload = { adminId: string; targetId: string; exp: number };

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

function encode(payload: ImpersonationPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): ImpersonationPayload | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
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

export async function readImpersonation(): Promise<{ adminId: string; targetId: string } | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const payload = decode(token);
  return payload ? { adminId: payload.adminId, targetId: payload.targetId } : null;
}

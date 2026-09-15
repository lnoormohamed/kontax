import { getClientIp } from "~/lib/client-ip";
import { verifyCardDavCredentials } from "~/server/app-passwords";
import { checkRateLimit, peekRateLimit, rateLimiters } from "~/server/rate-limit";
import {
  forbiddenDavResponse,
  tooManyRequestsDavResponse,
  unauthorizedDavResponse,
} from "~/server/dav/responses";

type DavAuthResult = {
  userId: string;
  appPasswordId: string;
};

// P48-09: this module is the Next-side twin of the DAV auth pipeline in
// `server.mjs`, reachable only through the `/.well-known/carddav` route
// fallback. The hand-rolled in-memory buckets it used to keep (never pruned,
// per-process, keyed on the proxy's IP) are gone; it now shares the
// Redis-backed limiters and key layout, so failures recorded on either side
// count toward the same buckets.
const getRequestIp = (request: Request) => getClientIp(request.headers) ?? "unknown";

const decodeBasicAuth = (header: string) => {
  if (!header.startsWith("Basic ")) {
    return null;
  }

  const encoded = header.slice("Basic ".length).trim();
  const decoded = Buffer.from(encoded, "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  return {
    email: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
};

export async function requireDavAuth(
  request: Request,
  expectedUserId?: string,
): Promise<DavAuthResult | Response> {
  const authorization = request.headers.get("authorization");
  const credentials = authorization ? decodeBasicAuth(authorization) : null;

  if (!credentials) {
    return unauthorizedDavResponse();
  }

  const normalizedEmail = credentials.email.trim().toLowerCase();
  const ip = getRequestIp(request);
  const pairKey = `${ip}:${normalizedEmail}`;

  // P48-09: peek before verifying so a *successful* login is never charged a
  // point, and consume only on failure.
  const [pair, byIp] = await Promise.all([
    peekRateLimit(rateLimiters.davAuthByPair, pairKey),
    peekRateLimit(rateLimiters.davAuthByIp, ip),
  ]);

  if (!pair.allowed || !byIp.allowed) {
    return tooManyRequestsDavResponse();
  }

  const result = await verifyCardDavCredentials(normalizedEmail, credentials.password);

  if (!result) {
    await Promise.all([
      checkRateLimit(rateLimiters.davAuthByPair, pairKey),
      checkRateLimit(rateLimiters.davAuthByIp, ip),
    ]);
    return unauthorizedDavResponse();
  }

  if (expectedUserId && result.userId !== expectedUserId) {
    return forbiddenDavResponse();
  }

  await Promise.all([
    rateLimiters.davAuthByPair.delete(pairKey).catch(() => undefined),
    rateLimiters.davAuthByIp.delete(ip).catch(() => undefined),
  ]);

  return result;
}

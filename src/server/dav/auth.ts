import { verifyCardDavCredentials } from "~/server/app-passwords";
import {
  forbiddenDavResponse,
  tooManyRequestsDavResponse,
  unauthorizedDavResponse,
} from "~/server/dav/responses";

type DavAuthResult = {
  userId: string;
  appPasswordId: string;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 15 * 60 * 1000;
const IP_FAILURE_LIMIT = 20;
const EMAIL_FAILURE_LIMIT = 10;
const buckets = new Map<string, RateLimitBucket>();

const getRequestIp = (request: Request) => {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwardedFor ?? request.headers.get("x-real-ip") ?? "unknown";
};

const getBucket = (key: string) => {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const next = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, next);
    return next;
  }

  return current;
};

const isLimited = (key: string, limit: number) => getBucket(key).count >= limit;

const recordFailure = (key: string) => {
  const bucket = getBucket(key);
  bucket.count += 1;
};

const resetBucket = (key: string) => {
  buckets.delete(key);
};

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
  const ipKey = `ip:${getRequestIp(request)}`;
  const emailKey = `email:${normalizedEmail}`;

  if (isLimited(ipKey, IP_FAILURE_LIMIT) || isLimited(emailKey, EMAIL_FAILURE_LIMIT)) {
    return tooManyRequestsDavResponse();
  }

  const result = await verifyCardDavCredentials(normalizedEmail, credentials.password);

  if (!result) {
    recordFailure(ipKey);
    recordFailure(emailKey);
    return unauthorizedDavResponse();
  }

  if (expectedUserId && result.userId !== expectedUserId) {
    return forbiddenDavResponse();
  }

  resetBucket(ipKey);
  resetBucket(emailKey);

  return result;
}

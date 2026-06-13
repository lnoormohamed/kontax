// Shared signed OAuth `state` for sync connectors (Google P27-01, Microsoft
// P27-04). The state round-trips through the provider's consent screen, so it
// must be tamper-proof: HMAC-SHA256 over { userId, returnTo, nonce, iat } with
// AUTH_SECRET, short TTL on verify.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "~/env";

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class OAuthStateError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "OAuthStateError";
    this.code = code;
  }
}

type OAuthStatePayload = {
  userId: string;
  returnTo: string;
  nonce: string;
  iat: number;
};

const getStateSecret = () => {
  if (!env.AUTH_SECRET) {
    throw new OAuthStateError(
      "OAUTH_STATE_UNCONFIGURED",
      "AUTH_SECRET must be set to sign OAuth state.",
    );
  }
  return env.AUTH_SECRET;
};

const signState = (body: string) =>
  createHmac("sha256", getStateSecret()).update(body).digest("base64url");

export const encodeOAuthState = (input: { userId: string; returnTo: string }) => {
  const payload: OAuthStatePayload = {
    userId: input.userId,
    returnTo: input.returnTo,
    nonce: randomBytes(16).toString("base64url"),
    iat: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${signState(body)}`;
};

export const decodeOAuthState = (
  token: string,
): { userId: string; returnTo: string } => {
  const [body, sig] = token.split(".", 2);
  if (!body || !sig) {
    throw new OAuthStateError("OAUTH_STATE_INVALID", "Malformed OAuth state.");
  }

  const expected = signState(body);
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    throw new OAuthStateError("OAUTH_STATE_INVALID", "OAuth state signature mismatch.");
  }

  const payload = JSON.parse(
    Buffer.from(body, "base64url").toString("utf8"),
  ) as OAuthStatePayload;

  if (Date.now() - payload.iat > OAUTH_STATE_TTL_MS) {
    throw new OAuthStateError("OAUTH_STATE_EXPIRED", "OAuth state has expired.");
  }

  return { userId: payload.userId, returnTo: payload.returnTo };
};

// SEC-03 — Amazon SNS message signature verification.
//
// The SES events webhook (src/app/api/ses/events/route.ts) is public and was
// trusting any POST. That allowed (a) SSRF via the SubscriptionConfirmation
// `SubscribeURL` and (b) forged bounce/complaint notifications that could mark
// any user's email as BOUNCED. This module authenticates that a message genuinely
// came from SNS before the route acts on it.
//
// Algorithm per the AWS SNS docs: rebuild the canonical "string to sign" from a
// fixed, ordered subset of fields, fetch the signing certificate (only from an
// AWS SNS host — never an attacker-supplied one, which would itself be an SSRF),
// and verify the RSA signature. SignatureVersion "1" uses SHA1, "2" uses SHA256.
import { createVerify, X509Certificate } from "node:crypto";

// SubscribeURL and SigningCertURL must both point at an AWS SNS endpoint.
const SNS_HOST_RE = /^sns\.[a-z0-9-]+\.amazonaws\.com$/;

export type SnsMessage = Record<string, unknown> & {
  Type?: string;
  SignatureVersion?: string;
  Signature?: string;
  SigningCertURL?: string;
};

// Fields included in the signature, in the exact order AWS specifies. Optional
// fields (e.g. Subject) are skipped when absent.
const SIGNABLE_KEYS: Record<string, string[]> = {
  Notification: ["Message", "MessageId", "Subject", "Timestamp", "TopicArn", "Type"],
  SubscriptionConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
  UnsubscribeConfirmation: [
    "Message",
    "MessageId",
    "SubscribeURL",
    "Timestamp",
    "Token",
    "TopicArn",
    "Type",
  ],
};

// Signing certs are long-lived; cache by URL to avoid refetching per message.
const certCache = new Map<string, string>();

/** True only for `https://sns.<region>.amazonaws.com/...` URLs. */
export const isSnsHttpsUrl = (raw: string | undefined | null): boolean => {
  if (!raw) return false;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  return url.protocol === "https:" && SNS_HOST_RE.test(url.hostname);
};

const fetchSigningCert = async (url: string): Promise<string | null> => {
  const cached = certCache.get(url);
  if (cached) return cached;
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) return null;
  const pem = await res.text();
  certCache.set(url, pem);
  return pem;
};

const buildStringToSign = (msg: SnsMessage, type: string): string | null => {
  const keys = SIGNABLE_KEYS[type];
  if (!keys) return null;
  let out = "";
  for (const key of keys) {
    const value = msg[key];
    if (value === undefined || value === null) continue; // optional (e.g. Subject)
    out += `${key}\n${String(value)}\n`;
  }
  return out;
};

/**
 * Returns true only when `msg` carries a valid SNS signature from an AWS signing
 * certificate. Fails closed on any error (bad URL, fetch failure, bad signature).
 */
export async function verifySnsSignature(msg: SnsMessage): Promise<boolean> {
  const type = typeof msg.Type === "string" ? msg.Type : "";
  const signature = typeof msg.Signature === "string" ? msg.Signature : "";
  const certUrl = typeof msg.SigningCertURL === "string" ? msg.SigningCertURL : "";

  if (!type || !signature || !isSnsHttpsUrl(certUrl)) return false;

  const stringToSign = buildStringToSign(msg, type);
  if (stringToSign === null) return false;

  const pem = await fetchSigningCert(certUrl);
  if (!pem) return false;

  try {
    const publicKey = new X509Certificate(pem).publicKey;
    const algorithm = msg.SignatureVersion === "2" ? "RSA-SHA256" : "RSA-SHA1";
    const verifier = createVerify(algorithm);
    verifier.update(stringToSign, "utf8");
    verifier.end();
    return verifier.verify(publicKey, signature, "base64");
  } catch {
    return false;
  }
}

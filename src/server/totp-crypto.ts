/**
 * AES-256-GCM encryption for TOTP secrets and pending-enrolment tokens.
 * The key is a 64-char hex string from TOTP_ENCRYPTION_KEY env var (32 bytes).
 * Format: iv(12 bytes) | authTag(16 bytes) | ciphertext — base64url encoded.
 */
import crypto from "crypto";
import * as OTPAuth from "otpauth";

function getKey(): Buffer {
  const hex = process.env.TOTP_ENCRYPTION_KEY;
  if (!hex?.length || hex.length !== 64) {
    // In dev without the key set, use a deterministic dev-only key (never for prod)
    if (process.env.NODE_ENV === "production") {
      throw new Error("TOTP_ENCRYPTION_KEY must be a 64-char hex string in production");
    }
    return Buffer.alloc(32, 0x42); // dev placeholder
  }
  return Buffer.from(hex, "hex");
}

export function encryptTotp(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptTotp(stored: string): string {
  const key = getKey();
  const buf = Buffer.from(stored, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}

/** Encrypt a JSON payload (for short-lived pending tokens) */
export function encryptPayload(payload: Record<string, unknown>): string {
  return encryptTotp(JSON.stringify(payload));
}

export function decryptPayload<T = Record<string, unknown>>(token: string): T {
  return JSON.parse(decryptTotp(token)) as T;
}

// ── TOTP helpers ──────────────────────────────────────────────────────────────

export function createTotpSecret(): string {
  return new OTPAuth.Secret({ size: 20 }).base32;
}

export function generateTotpUri(secret: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Kontax",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.toString();
}

export function verifyTotpToken(secret: string, code: string): boolean {
  const totp = new OTPAuth.TOTP({
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  return totp.validate({ token: code, window: 1 }) !== null;
}

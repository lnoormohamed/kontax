import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    AUTH_SECRET: z.string().optional(),
    DATABASE_URL: z.string().url(),
    SYNC_CREDENTIAL_ENCRYPTION_KEY: z.string().min(32).optional(),
    SYNC_CREDENTIAL_ENCRYPTION_KEY_ID: z.string().optional(),
    // P48-16: credential keyring — "id:hex64,id:hex64", first entry is the
    // current (encrypting) key. Supersedes the single-key vars above, which
    // stay supported for backward compatibility.
    SYNC_CREDENTIAL_ENCRYPTION_KEYS: z.string().optional(),
    // P48-16: deployment environment marker. `production` makes the required-env
    // assertion and the REDIS_URL guard fire even when NODE_ENV is not
    // "production" (e.g. a script run against prod).
    KONTAX_DEPLOY_ENV: z.string().optional(),
    // Transactional email via AWS SES (P20-01). All optional — when unset, email
    // is logged to console (dev) and the app falls back to in-app notifications.
    // SES_CONFIGURED (src/server/email.ts) treats email as live only when all
    // four are present.
    AWS_ACCESS_KEY_ID: z.string().optional(),
    AWS_SECRET_ACCESS_KEY: z.string().optional(),
    AWS_SES_REGION: z.string().optional(),
    EMAIL_FROM: z.string().email().optional(),
    APP_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    // Rate limiting — self-hosted Valkey (P18-10). Falls back to in-memory if unset.
    REDIS_URL: z.string().optional(),
    // Blob storage — self-hosted MinIO (P18-01). Falls back to URL-only if unset.
    MINIO_ENDPOINT: z.string().url().optional(),
    MINIO_ACCESS_KEY: z.string().optional(),
    MINIO_SECRET_KEY: z.string().optional(),
    MINIO_BUCKET: z.string().optional(),
    MINIO_PUBLIC_URL: z.string().url().optional(),
    // TOTP encryption key — 64-char hex string (P18-07). Required in production.
    TOTP_ENCRYPTION_KEY: z.string().length(64).optional(),
    // P48-16: TOTP keyring — "id:hex64,id:hex64", first entry is current.
    TOTP_ENCRYPTION_KEYS: z.string().optional(),
    // Cron job secret — guards /api/cron/* routes (P18-10).
    CRON_SECRET: z.string().optional(),
    // Stripe billing (P19). All optional — billing features degrade gracefully when unset.
    STRIPE_SECRET_KEY: z.string().min(1).optional(),
    STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
    STRIPE_PRICE_ID_PRO_MONTHLY: z.string().min(1).optional(),
    STRIPE_PRICE_ID_PRO_YEARLY: z.string().min(1).optional(),
    STRIPE_PRICE_ID_FAMILY_MONTHLY: z.string().min(1).optional(),
    STRIPE_PRICE_ID_FAMILY_YEARLY: z.string().min(1).optional(),
    STRIPE_PRICE_ID_TEAMS_MONTHLY: z.string().min(1).optional(),
    STRIPE_PRICE_ID_TEAMS_YEARLY: z.string().min(1).optional(),
    // Google Contacts OAuth connector (P27-01). All optional — the Google sync
    // connector is only offered when all three are set (see isGoogleSyncConfigured).
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    GOOGLE_REDIRECT_URI: z.string().url().optional(),
    // Microsoft Outlook/Graph OAuth connector (P27-04). All optional — the
    // Outlook connector is only offered when client id/secret/redirect are set
    // (see isMicrosoftSyncConfigured). TENANT_ID defaults to "common".
    MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
    MICROSOFT_CLIENT_SECRET: z.string().min(1).optional(),
    MICROSOFT_TENANT_ID: z.string().min(1).optional(),
    MICROSOFT_REDIRECT_URI: z.string().url().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // P46-02: public origin of the media (MinIO/CDN) host that serves avatars,
    // so the client + server agree on which avatar URLs are "ours" (direct load
    // + thumb) vs external (proxied). Only needed when the media host differs
    // from the built-in `media.getkontax.com`; set it to the origin of
    // `MINIO_PUBLIC_URL`. Must be public (NEXT_PUBLIC_) so it's inlined at build.
    // Intentionally NOT `.url()`: a malformed value must never crash app boot
    // (it's an optional display var). Consumers — avatar-src.ts, next.config.js,
    // middleware.ts — all parse it through a try/caught `new URL()` and fall back
    // to the legacy media host, so a bad value degrades gracefully to the default
    // instead of taking down the whole site.
    NEXT_PUBLIC_MEDIA_HOST: z.string().optional(),
    // Display-only price strings shown on the pricing page (P19-08).
    // Keep server-side Stripe price IDs separate — only display strings are public.
    NEXT_PUBLIC_PRICE_PRO_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_PRICE_PRO_YEARLY: z.string().optional(),
    NEXT_PUBLIC_PRICE_FAMILY_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_PRICE_FAMILY_YEARLY: z.string().optional(),
    NEXT_PUBLIC_PRICE_TEAMS_MONTHLY: z.string().optional(),
    NEXT_PUBLIC_PRICE_TEAMS_YEARLY: z.string().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    AUTH_SECRET: process.env.AUTH_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    SYNC_CREDENTIAL_ENCRYPTION_KEY: process.env.SYNC_CREDENTIAL_ENCRYPTION_KEY,
    SYNC_CREDENTIAL_ENCRYPTION_KEY_ID: process.env.SYNC_CREDENTIAL_ENCRYPTION_KEY_ID,
    SYNC_CREDENTIAL_ENCRYPTION_KEYS: process.env.SYNC_CREDENTIAL_ENCRYPTION_KEYS,
    KONTAX_DEPLOY_ENV: process.env.KONTAX_DEPLOY_ENV,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    AWS_SES_REGION: process.env.AWS_SES_REGION,
    EMAIL_FROM: process.env.EMAIL_FROM,
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    REDIS_URL: process.env.REDIS_URL,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
    MINIO_BUCKET: process.env.MINIO_BUCKET,
    MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL,
    TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY,
    TOTP_ENCRYPTION_KEYS: process.env.TOTP_ENCRYPTION_KEYS,
    CRON_SECRET: process.env.CRON_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID_PRO_MONTHLY: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
    STRIPE_PRICE_ID_PRO_YEARLY: process.env.STRIPE_PRICE_ID_PRO_YEARLY,
    STRIPE_PRICE_ID_FAMILY_MONTHLY: process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY,
    STRIPE_PRICE_ID_FAMILY_YEARLY: process.env.STRIPE_PRICE_ID_FAMILY_YEARLY,
    STRIPE_PRICE_ID_TEAMS_MONTHLY: process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY,
    STRIPE_PRICE_ID_TEAMS_YEARLY: process.env.STRIPE_PRICE_ID_TEAMS_YEARLY,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
    MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID,
    MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET,
    MICROSOFT_TENANT_ID: process.env.MICROSOFT_TENANT_ID,
    MICROSOFT_REDIRECT_URI: process.env.MICROSOFT_REDIRECT_URI,
    NEXT_PUBLIC_MEDIA_HOST: process.env.NEXT_PUBLIC_MEDIA_HOST,
    NEXT_PUBLIC_PRICE_PRO_MONTHLY: process.env.NEXT_PUBLIC_PRICE_PRO_MONTHLY,
    NEXT_PUBLIC_PRICE_PRO_YEARLY: process.env.NEXT_PUBLIC_PRICE_PRO_YEARLY,
    NEXT_PUBLIC_PRICE_FAMILY_MONTHLY: process.env.NEXT_PUBLIC_PRICE_FAMILY_MONTHLY,
    NEXT_PUBLIC_PRICE_FAMILY_YEARLY: process.env.NEXT_PUBLIC_PRICE_FAMILY_YEARLY,
    NEXT_PUBLIC_PRICE_TEAMS_MONTHLY: process.env.NEXT_PUBLIC_PRICE_TEAMS_MONTHLY,
    NEXT_PUBLIC_PRICE_TEAMS_YEARLY: process.env.NEXT_PUBLIC_PRICE_TEAMS_YEARLY,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

/**
 * P48-16 — secrets that must be present in production.
 *
 * `@t3-oss/env-nextjs@0.12` has no schema-level refinement hook (`extends` only
 * merges extra objects, and `createFinalSchema` only landed in 0.13), and a
 * per-variable `z.string()` cannot express "required only in production"
 * without breaking dev. So the cross-field rule lives in this assertion, which
 * runs at module scope below — `~/env` is imported by every server entry point,
 * so a production process with a missing secret dies at boot with one clear
 * message instead of failing later at the first email, sync or login.
 *
 * Each of these has a silent-but-broken failure mode when unset in production:
 * unsigned/forgeable tokens, links pointing at the wrong domain, credentials
 * encrypted under the JWT signing secret, unguarded cron endpoints, or
 * per-process rate limits.
 */
export function assertProductionEnv() {
  const isProductionDeploy = (() => {
    // KONTAX_DEPLOY_ENV decides when set (staging runs NODE_ENV=production but
    // is not production); NODE_ENV only when it is unset. Same rule as
    // scripts/runtime/start-production.mjs.
    const deployEnv = (process.env.KONTAX_DEPLOY_ENV ?? "").trim().toLowerCase();
    return deployEnv ? deployEnv === "production" : process.env.NODE_ENV === "production";
  })();

  if (!isProductionDeploy) return;

  /** @type {Array<[string, string | undefined, string]>} */
  const required = [
    ["AUTH_SECRET", process.env.AUTH_SECRET, "signs session JWTs and derives the impersonation HMAC key"],
    ["APP_URL", process.env.APP_URL, "public origin used for email CTAs, OAuth redirects and share links"],
    [
      "TOTP_ENCRYPTION_KEY",
      process.env.TOTP_ENCRYPTION_KEYS ?? process.env.TOTP_ENCRYPTION_KEY,
      "encrypts stored TOTP secrets at rest (or set the TOTP_ENCRYPTION_KEYS keyring)",
    ],
    [
      "SYNC_CREDENTIAL_ENCRYPTION_KEY",
      process.env.SYNC_CREDENTIAL_ENCRYPTION_KEYS ?? process.env.SYNC_CREDENTIAL_ENCRYPTION_KEY,
      "encrypts stored provider credentials at rest (or set the SYNC_CREDENTIAL_ENCRYPTION_KEYS keyring)",
    ],
    ["CRON_SECRET", process.env.CRON_SECRET, "guards the /api/cron/* endpoints"],
    ["REDIS_URL", process.env.REDIS_URL, "shared rate-limit store"],
  ];

  const missing = required.filter(([, value]) => !value?.trim());

  if (missing.length > 0) {
    const detail = missing.map(([name, , why]) => `  - ${name}: ${why}`).join("\n");
    throw new Error(
      `Missing required production environment variable(s):\n${detail}\n` +
        "See roadmap/runbooks/env-secrets.md. Set them, or (for a build step only) set SKIP_ENV_VALIDATION=1.",
    );
  }
}

// Server-side only: the client bundle imports this module for NEXT_PUBLIC_* vars
// and has no access to server secrets. `SKIP_ENV_VALIDATION` exempts `next build`.
if (typeof window === "undefined" && !process.env.SKIP_ENV_VALIDATION) {
  assertProductionEnv();
}

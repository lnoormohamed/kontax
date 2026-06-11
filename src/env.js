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
    // Transactional email via AWS SES (P12-06). All optional — when unset, email
    // is skipped and the app falls back to in-app notifications only.
    AWS_REGION: z.string().optional(),
    SES_FROM_ADDRESS: z.string().email().optional(),
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
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
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
    AWS_REGION: process.env.AWS_REGION,
    SES_FROM_ADDRESS: process.env.SES_FROM_ADDRESS,
    APP_URL: process.env.APP_URL,
    NODE_ENV: process.env.NODE_ENV,
    REDIS_URL: process.env.REDIS_URL,
    MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
    MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY,
    MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY,
    MINIO_BUCKET: process.env.MINIO_BUCKET,
    MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL,
    TOTP_ENCRYPTION_KEY: process.env.TOTP_ENCRYPTION_KEY,
    CRON_SECRET: process.env.CRON_SECRET,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_ID_PRO_MONTHLY: process.env.STRIPE_PRICE_ID_PRO_MONTHLY,
    STRIPE_PRICE_ID_PRO_YEARLY: process.env.STRIPE_PRICE_ID_PRO_YEARLY,
    STRIPE_PRICE_ID_FAMILY_MONTHLY: process.env.STRIPE_PRICE_ID_FAMILY_MONTHLY,
    STRIPE_PRICE_ID_FAMILY_YEARLY: process.env.STRIPE_PRICE_ID_FAMILY_YEARLY,
    STRIPE_PRICE_ID_TEAMS_MONTHLY: process.env.STRIPE_PRICE_ID_TEAMS_MONTHLY,
    STRIPE_PRICE_ID_TEAMS_YEARLY: process.env.STRIPE_PRICE_ID_TEAMS_YEARLY,
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

import { headers } from "next/headers";

/**
 * Returns the public origin (scheme + host) for the current request.
 *
 * Resolution order:
 * 1. APP_URL env var — set this in production to avoid relying on reverse-proxy
 *    headers. e.g. APP_URL=https://kontax.vexon.co
 * 2. x-forwarded-proto + x-forwarded-host headers forwarded by the proxy.
 * 3. Scheme inferred from hostname: localhost → http, everything else → https.
 *
 * The env-var approach is the most reliable in Coolify / Traefik deployments
 * where the internal scheme is http even for TLS-terminated public traffic.
 */
export const getPublicOrigin = async (): Promise<string> => {
  // Explicit override always wins — set APP_URL in Coolify env variables.
  const appUrl = process.env.APP_URL?.replace(/\/$/, "");
  if (appUrl) return appUrl;

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const forwardedProto = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto ?? (host.startsWith("localhost") ? "http" : "https");

  return `${proto}://${host}`;
};

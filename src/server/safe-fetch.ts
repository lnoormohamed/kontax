import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

/**
 * P48-04 — SSRF-hardened outbound HTTP for every user- or remote-influenced
 * URL (CardDAV servers, discovered hrefs, vCard PHOTO URIs, pasted avatars).
 *
 * This server sits on a private LAN next to internal services (MinIO,
 * Proxmox, Coolify, Postgres, Redis), so a naive fetcher is an internal network
 * scanner. Guards, in order:
 *   - scheme https only in production (http only behind KONTAX_ALLOW_INSECURE_OUTBOUND),
 *     no credentials in the URL, no `localhost` / `.local` / `.internal`
 *   - DNS-resolve the host and reject if ANY answer is private/reserved
 *   - connect to the resolved IP directly (Host/SNI pinned) so a re-resolving
 *     DNS record cannot rebind to an internal address mid-request
 *   - never follow redirects automatically: each hop is re-validated from
 *     scratch, capped at MAX_REDIRECTS, and Authorization is dropped when the
 *     hop leaves the original origin
 *   - cap response size and total time
 *
 * `safe-image-fetch.ts` layers the image-specific policy (default ports only,
 * image/* content-type) on top of the primitives exported here.
 */

export const MAX_REDIRECTS = 3;

/** Exported for tests. True for loopback/private/link-local/reserved ranges. */
export function isPrivateIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127) return true; // this-net, 10/8, loopback
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
    if (a === 169 && b === 254) return true; // link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true; // 192.168/16
    if (a === 192 && b === 0) return true; // 192.0.0/24 + 192.0.2/24 doc
    if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
    if (a >= 224) return true; // multicast + reserved
    return false;
  }
  if (version === 6) {
    const lower = ip.toLowerCase();
    if (lower === "::" || lower === "::1") return true; // unspecified, loopback
    if (lower.startsWith("::ffff:")) return isPrivateIp(lower.slice(7)); // v4-mapped
    if (/^f[cd]/.test(lower)) return true; // unique-local fc00::/7
    if (/^fe[89ab]/.test(lower)) return true; // link-local fe80::/10
    if (lower.startsWith("ff")) return true; // multicast
    if (lower.startsWith("64:ff9b:")) return isPrivateIp(nat64ToV4(lower)); // NAT64 well-known prefix
    return false;
  }
  return true; // not an IP — treat as unsafe when used where an IP is expected
}

function nat64ToV4(v6: string): string {
  // 64:ff9b::a.b.c.d or 64:ff9b::xxxx:yyyy — best-effort; unknown shapes are private.
  const tail = v6.split("::")[1] ?? "";
  if (tail.includes(".")) return tail;
  const [hi = "0", lo = "0"] = tail.split(":");
  const h = parseInt(hi, 16);
  const l = parseInt(lo, 16);
  if (Number.isNaN(h) || Number.isNaN(l)) return "0.0.0.0";
  return `${(h >> 8) & 255}.${h & 255}.${(l >> 8) & 255}.${l & 255}`;
}

export type UrlValidation = { ok: true; url: URL } | { ok: false; reason: string };

/** True when plain http:// outbound is permitted (local dev only). */
export function insecureOutboundAllowed(): boolean {
  const flag = process.env.KONTAX_ALLOW_INSECURE_OUTBOUND;
  if (flag === "1" || flag === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export type OutboundUrlPolicy = {
  /** Allow http:// (default: only when `insecureOutboundAllowed()`). */
  allowHttp?: boolean;
  /** Restrict to the scheme's default port (image proxy). Default false. */
  defaultPortOnly?: boolean;
};

/**
 * Exported for tests. Structural checks that need no network access.
 * Rejects non-http(s), credentials in the URL, local/internal hostnames and
 * private IP literals. Port policy is caller-selectable because self-hosted
 * CardDAV servers legitimately run on non-default ports.
 */
export function validateOutboundUrl(raw: string, policy: OutboundUrlPolicy = {}): UrlValidation {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  const allowHttp = policy.allowHttp ?? insecureOutboundAllowed();
  if (url.protocol === "http:") {
    if (!allowHttp) return { ok: false, reason: "http not allowed; use https" };
  } else if (url.protocol !== "https:") {
    return { ok: false, reason: "unsupported scheme" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials in URL" };
  }
  if (policy.defaultPortOnly && url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) {
    return { ok: false, reason: "non-default port" };
  }
  const host = url.hostname.toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return { ok: false, reason: "forbidden host" };
  }
  const bare = host.replace(/^\[|\]$/g, "");
  if (isIP(bare) && isPrivateIp(bare)) {
    return { ok: false, reason: "private address" };
  }
  return { ok: true, url };
}

/** Resolve a hostname and return one public address, or null if any answer is private. */
export async function resolvePublicAddress(hostname: string): Promise<string | null> {
  const bare = hostname.replace(/^\[|\]$/g, "");
  if (isIP(bare)) return isPrivateIp(bare) ? null : bare;
  let addresses: { address: string }[];
  try {
    addresses = await lookup(bare, { all: true });
  } catch {
    return null;
  }
  if (addresses.length === 0) return null;
  // Reject if ANY answer is private — split-horizon answers must not slip through.
  if (addresses.some((a) => isPrivateIp(a.address))) return null;
  return addresses[0]!.address;
}

export class SafeFetchError extends Error {
  readonly kind: "blocked" | "timeout" | "too_large" | "network" | "too_many_redirects";
  constructor(kind: SafeFetchError["kind"], message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.kind = kind;
  }
}

export type SafeFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: Buffer | string;
  /** Cap on response bytes. Default 10 MB. */
  maxBytes?: number;
  /** Total budget across all hops. Default 15 s. */
  timeoutMs?: number;
  policy?: OutboundUrlPolicy;
  /** Follow 3xx redirects (re-validated per hop). Default true. */
  followRedirects?: boolean;
};

export type SafeFetchResponse = {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  /** URL of the final response (after redirects). */
  url: string;
  ok: boolean;
};

/**
 * Perform a pinned, validated outbound request. Throws `SafeFetchError` for
 * blocked URLs, timeouts, oversize bodies, redirect loops and transport errors;
 * HTTP error statuses are returned, not thrown (callers map them).
 */
export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResponse> {
  const {
    method = "GET",
    headers = {},
    body,
    maxBytes = 10 * 1024 * 1024,
    timeoutMs = 15_000,
    policy = {},
    followRedirects = true,
  } = options;
  const deadline = Date.now() + timeoutMs;
  let current = rawUrl;
  let currentHeaders = { ...headers };
  let currentMethod = method;
  let currentBody = body;
  const initialOrigin = (() => {
    try {
      return new URL(rawUrl).origin;
    } catch {
      return "";
    }
  })();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const validated = validateOutboundUrl(current, policy);
    if (!validated.ok) throw new SafeFetchError("blocked", validated.reason);
    const { url } = validated;

    const address = await resolvePublicAddress(url.hostname);
    if (!address) throw new SafeFetchError("blocked", "unresolvable or private address");

    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new SafeFetchError("timeout", "timeout");

    const res = await requestPinned(url, address, {
      method: currentMethod,
      headers: currentHeaders,
      body: currentBody,
      timeoutMs: remaining,
      maxBytes,
    });

    const location = res.headers.location;
    if (followRedirects && res.status >= 301 && res.status <= 308 && location) {
      const nextUrl = new URL(location, url).toString();
      // Drop credentials when the redirect leaves the origin the caller vetted.
      if (new URL(nextUrl).origin !== initialOrigin) {
        currentHeaders = stripHeaders(currentHeaders, ["authorization"]);
      }
      // 301/302/303 on a non-GET become GET without a body (browser semantics).
      if (res.status !== 307 && res.status !== 308 && currentMethod !== "GET" && currentMethod !== "HEAD") {
        currentMethod = "GET";
        currentBody = undefined;
        currentHeaders = stripHeaders(currentHeaders, ["content-type", "content-length"]);
      }
      current = nextUrl;
      continue;
    }

    return {
      status: res.status,
      headers: res.headers,
      body: res.body,
      url: url.toString(),
      ok: res.status >= 200 && res.status < 300,
    };
  }
  throw new SafeFetchError("too_many_redirects", "too many redirects");
}

/** Low-level pinned request (exported for the image proxy). */
export function requestPinned(
  url: URL,
  address: string,
  opts: {
    method: string;
    headers: Record<string, string>;
    body?: Buffer | string;
    timeoutMs: number;
    maxBytes: number;
  },
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const bodyBytes =
      opts.body === undefined ? undefined : Buffer.isBuffer(opts.body) ? opts.body : Buffer.from(opts.body, "utf8");
    const headers: Record<string, string> = {
      "User-Agent": "Kontax/1.0",
      ...opts.headers,
      Host: url.host, // host[:port], overriding any caller-supplied value
    };
    if (bodyBytes && !("Content-Length" in headers) && !("content-length" in headers)) {
      headers["Content-Length"] = String(bodyBytes.byteLength);
    }
    const request = transport.request(
      {
        // Connect straight to the vetted IP; keep name-based routing intact
        // via Host header + TLS servername so certificates still validate.
        host: address,
        servername: isHttps ? url.hostname : undefined,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: opts.method,
        headers,
        timeout: opts.timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > opts.maxBytes) {
            request.destroy(new SafeFetchError("too_large", "response too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({ status, headers: res.headers, body: Buffer.concat(chunks) });
        });
        res.on("error", (err) => reject(wrapError(err)));
      },
    );
    request.on("timeout", () => request.destroy(new SafeFetchError("timeout", "timeout")));
    request.on("error", (err) => reject(wrapError(err)));
    if (bodyBytes) request.write(bodyBytes);
    request.end();
  });
}

function stripHeaders(headers: Record<string, string>, names: string[]): Record<string, string> {
  const drop = new Set(names.map((n) => n.toLowerCase()));
  return Object.fromEntries(Object.entries(headers).filter(([k]) => !drop.has(k.toLowerCase())));
}

function wrapError(err: unknown): SafeFetchError {
  if (err instanceof SafeFetchError) return err;
  // Never propagate Node's error text (it embeds the resolved host:port).
  return new SafeFetchError("network", "network error");
}

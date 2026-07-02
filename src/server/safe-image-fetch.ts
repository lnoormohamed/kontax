import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

/**
 * P38-08 follow-up — SSRF-hardened fetching of user-supplied image URLs.
 *
 * This server sits on a private LAN next to internal services (MinIO,
 * Proxmox, Coolify), so a naive URL fetcher is an internal network scanner.
 * Guards, in order:
 *   - scheme http/https only, no credentials in the URL, default ports only
 *   - DNS-resolve the host and reject if ANY answer is private/reserved
 *   - connect to the resolved IP directly (Host/SNI pinned) so a re-resolving
 *     DNS record cannot rebind to an internal address mid-request
 *   - follow at most 3 redirects, re-validating every hop from scratch
 *   - require an image/* content-type; cap response size and total time
 *
 * The proxy route re-encodes whatever this returns through sharp, so raw
 * third-party bytes are never served to clients.
 */

const MAX_REDIRECTS = 3;

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
    return false;
  }
  return true; // not an IP — treat as unsafe when used where an IP is expected
}

export type UrlValidation = { ok: true; url: URL } | { ok: false; reason: string };

/** Exported for tests. Structural checks that need no network access. */
export function validateImageUrl(raw: string): UrlValidation {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "invalid URL" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "unsupported scheme" };
  }
  if (url.username || url.password) {
    return { ok: false, reason: "credentials in URL" };
  }
  if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) {
    return { ok: false, reason: "non-default port" };
  }
  if (!url.hostname || url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    return { ok: false, reason: "forbidden host" };
  }
  if (isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateIp(url.hostname.replace(/^\[|\]$/g, ""))) {
    return { ok: false, reason: "private address" };
  }
  return { ok: true, url };
}

async function resolvePublicAddress(hostname: string): Promise<string | null> {
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

export type FetchedImage = { body: Buffer; contentType: string };

export async function fetchExternalImage(
  rawUrl: string,
  {
    maxBytes = 5 * 1024 * 1024,
    timeoutMs = 6_000,
  }: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<FetchedImage> {
  const deadline = Date.now() + timeoutMs;
  let current = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const validated = validateImageUrl(current);
    if (!validated.ok) throw new Error(`blocked: ${validated.reason}`);
    const { url } = validated;

    const address = await resolvePublicAddress(url.hostname);
    if (!address) throw new Error("blocked: unresolvable or private address");

    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("timeout");

    const response = await requestPinned(url, address, remaining, maxBytes);
    if (response.redirect) {
      current = new URL(response.redirect, url).toString();
      continue;
    }
    if (!response.contentType.toLowerCase().startsWith("image/")) {
      throw new Error("not an image");
    }
    return { body: response.body, contentType: response.contentType };
  }
  throw new Error("too many redirects");
}

function requestPinned(
  url: URL,
  address: string,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ body: Buffer; contentType: string; redirect: string | null }> {
  return new Promise((resolve, reject) => {
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const request = transport.request(
      {
        // Connect straight to the vetted IP; keep name-based routing intact
        // via Host header + TLS servername so certificates still validate.
        host: address,
        servername: isHttps ? url.hostname : undefined,
        port: url.port || (isHttps ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "GET",
        headers: {
          Host: url.hostname,
          Accept: "image/*",
          "User-Agent": "Kontax-ImageProxy/1.0",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 301 && status <= 308 && res.headers.location) {
          res.resume();
          resolve({ body: Buffer.alloc(0), contentType: "", redirect: res.headers.location });
          return;
        }
        if (status !== 200) {
          res.resume();
          reject(new Error(`upstream status ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        let received = 0;
        res.on("data", (chunk: Buffer) => {
          received += chunk.length;
          if (received > maxBytes) {
            request.destroy(new Error("image too large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          resolve({
            body: Buffer.concat(chunks),
            contentType: res.headers["content-type"] ?? "",
            redirect: null,
          });
        });
        res.on("error", reject);
      },
    );
    request.on("timeout", () => request.destroy(new Error("timeout")));
    request.on("error", reject);
    request.end();
  });
}

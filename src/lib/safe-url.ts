/**
 * P49A-13 (SEC P2: `javascript:` URLs accepted for website fields).
 *
 * `new URL()` — what zod's `.url()` and the old `isValidUrl` relied on —
 * happily parses `javascript:alert(1)`, `data:text/html,…` and friends, so a
 * contact's website could carry script into the one place websites are
 * rendered as links (the public card at /u/[username]). Two layers:
 *
 *   - input: `isSafeWebUrl` (http/https only) where a full URL is required,
 *     and `hasDangerousUrlScheme` for free-text entry fields, which also accept
 *     scheme-less values such as "example.com";
 *   - render: `safeExternalHref` — only http(s) (or a bare host, given
 *     https://) ever becomes an href, whatever is already stored.
 *
 * Parsing goes through the WHATWG URL parser, the same one the browser applies
 * to an href, so tricks like leading whitespace, embedded tabs/newlines or
 * mixed case in the scheme are seen exactly as the browser would see them.
 */

const WEB_PROTOCOLS = new Set(["http:", "https:"]);

// Schemes that execute or embed content when followed from a link.
const DANGEROUS_PROTOCOLS = new Set(["javascript:", "vbscript:", "data:", "file:", "blob:"]);

const parse = (value: string): URL | null => {
  try {
    return new URL(value.trim());
  } catch {
    return null;
  }
};

/** An absolute http:// or https:// URL. */
export function isSafeWebUrl(value: string): boolean {
  const url = parse(value);
  return url !== null && WEB_PROTOCOLS.has(url.protocol);
}

/**
 * True when `value` would be read by a browser as a URL with a scheme that
 * runs or embeds content. Scheme-less text ("example.com") is not dangerous.
 */
export function hasDangerousUrlScheme(value: string): boolean {
  const url = parse(value);
  return url !== null && DANGEROUS_PROTOCOLS.has(url.protocol);
}

// A bare host with an optional path, e.g. "example.com" or "www.example.co.uk/me".
const BARE_HOST = /^[a-z0-9](?:[a-z0-9-]{0,62}\.)+[a-z]{2,63}(?:[/?#]\S*)?$/i;

/**
 * The href to render for a stored website, or null to render it as plain text.
 * http(s) URLs pass through (normalised by the URL parser); a bare host gets
 * https://; everything else — including every dangerous scheme — is refused.
 */
export function safeExternalHref(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const url = parse(trimmed);
  if (url) return WEB_PROTOCOLS.has(url.protocol) ? url.href : null;
  if (BARE_HOST.test(trimmed)) {
    const withScheme = parse(`https://${trimmed}`);
    return withScheme ? withScheme.href : null;
  }
  return null;
}

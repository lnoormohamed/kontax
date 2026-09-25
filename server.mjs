import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import next from "next";
import bcrypt from "bcryptjs";
import Redis from "ioredis";
import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";

import { Prisma, PrismaClient } from "./generated/prisma/index.js";
import { getRequestIp } from "./src/server/dav/client-ip.mjs";
import {
  DAV_BODY_LIMITS,
  decodePathSegment,
  extractRequestedPropNames,
  hasDoctypeOrEntity,
  hrefToSyncUid,
  parseReportRequest,
} from "./src/server/dav/parse.mjs";
import {
  DAV_CREDENTIAL_CACHE_TTL_MS,
  DAV_CREDENTIAL_CACHE_TTL_SECONDS,
  davCredentialAppPasswordIndexKey,
  davCredentialCacheKey,
  davCredentialMemoryGet,
  davCredentialMemorySet,
  davCredentialRedisKey,
  davCredentialUserIndexKey,
} from "./src/server/dav/credential-cache.mjs";
import {
  buildDavContactWriteData,
  getVCardUid,
  isGroupVCard,
  serializeContactToVCard,
} from "./src/server/dav/vcard.mjs";

// P48-15: this process is the actual Node entrypoint (`npm start` /
// `node server.mjs`) — log fatals instead of letting them vanish silently.
process.on("unhandledRejection", (reason) => {
  console.error("[Kontax] fatal unhandledRejection:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("[Kontax] fatal uncaughtException:", error);
  process.exit(1);
});

const dev = process.env.NODE_ENV !== "production";
// Bind to all interfaces. Docker sets HOSTNAME to the container id, so the old
// `process.env.HOSTNAME ?? "0.0.0.0"` bound to the container's eth0 address
// only and the in-container health check (127.0.0.1:3000) was refused —
// which made Coolify roll back the P48 deploy. BIND_HOST overrides for dev.
const hostname = process.env.BIND_HOST ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();
// P48-12: see the Host pinning block before handle() at the bottom of this file.
const appUrlHost =
  process.env.APP_URL && URL.canParse(process.env.APP_URL)
    ? new URL(process.env.APP_URL).host
    : null;
// Hosts Next may see unchanged: the app origin and the `api.` alias that
// src/middleware.ts rewrites to /api/* (pinning that one would break the REST
// API host). Anything else is pinned to the app origin.
const allowedHosts = appUrlHost ? new Set([appUrlHost, `api.${appUrlHost}`]) : null;

const DAV_CAPABILITY_HEADER = "1, addressbook";
const DAV_REALM = 'Basic realm="Kontax CardDAV"';
const DUMMY_BCRYPT_HASH =
  "$2b$12$3Y0mFQ0M0l9n4Y3Q6p0g2uh2jQ7JmYI3d2eY0m4rA4Aq0vN5iVfL2";

// P48-08: request-body caps, applied at every DAV call site.
const MAX_QUERY_BODY_BYTES = DAV_BODY_LIMITS.query; // PROPFIND / REPORT — 64 KB
const MAX_PUT_BODY_BYTES = DAV_BODY_LIMITS.put; // PUT — 1 MB
// P48-08: what we are willing to persist into SyncConflict.remoteSnapshot.
const MAX_CONFLICT_SNAPSHOT_BYTES = 64 * 1024;

// P48-09: DAV auth brute-force limits.
//
// `src/server/rate-limit.ts` owns the equivalent limiters for the Next side, but
// this file is plain ESM and cannot import TypeScript, so the limiters are built
// here against the same `rate-limiter-flexible` + ioredis stack. Key layout is
// `dav:ip:<ip>` and `dav:pair:<ip>:<email>`.
//
// The pair bucket is the one that actually blocks (10 failures / 15 min): a burst
// from one shared Cloudflare edge IP must not lock every other user behind it.
// The IP bucket is a much looser backstop (100 failures / 15 min).
const DAV_AUTH_WINDOW_SECONDS = 15 * 60;
const DAV_PAIR_FAILURE_LIMIT = 10;
const DAV_IP_FAILURE_LIMIT = 100;
// P48 review: `cf-connecting-ip` is only trustworthy while the origin is reachable
// solely through Cloudflare. If it ever is not, a client can mint a fresh IP per
// request and the two IP-keyed buckets never fill. This per-email bucket does
// not depend on the IP at all, so a single account can never be brute-forced
// past 50 failures per window whatever the header says.
const DAV_EMAIL_FAILURE_LIMIT = 50;
// P48-09: at most one `lastUsedAt` write per app password per 5 minutes.
const LAST_USED_DEBOUNCE_MS = 5 * 60 * 1000;

const davRedis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      enableOfflineQueue: false,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    })
  : null;

if (davRedis) {
  // Never let a Redis blip take the HTTP server down; the limiters fall back to
  // their in-memory insurance limiter and the credential cache degrades to the
  // in-process map.
  davRedis.on("error", (error) => {
    console.error("DAV Redis error", error.message);
  });
}

const makeDavLimiter = (points, keyPrefix) => {
  const memory = new RateLimiterMemory({ points, duration: DAV_AUTH_WINDOW_SECONDS, keyPrefix });
  if (!davRedis) return memory;
  return new RateLimiterRedis({
    storeClient: davRedis,
    points,
    duration: DAV_AUTH_WINDOW_SECONDS,
    keyPrefix,
    insuranceLimiter: memory,
  });
};

// RateLimiterMemory expires its own entries, so neither fallback leaks (the old
// hand-rolled `buckets` Map was never pruned).
const davPairLimiter = makeDavLimiter(DAV_PAIR_FAILURE_LIMIT, "dav:pair");
const davIpLimiter = makeDavLimiter(DAV_IP_FAILURE_LIMIT, "dav:ip");
const davEmailLimiter = makeDavLimiter(DAV_EMAIL_FAILURE_LIMIT, "dav:email");

// appPasswordId -> epoch ms of the last `lastUsedAt` write made by this process.
const lastUsedWrites = new Map();

const normalizeToken = (value) => value.replaceAll("-", "").replaceAll(" ", "").trim();
const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

// P48-09: DAV responses are written by this file and never pass through Next's
// middleware, so they carried none of its security headers. Add them here.
// `extra` is spread last so a handler can still override Cache-Control etc.
const davHeaders = (extra = {}) => ({
  DAV: DAV_CAPABILITY_HEADER,
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  ...extra,
});

const send = (res, status, body = "", headers = {}) => {
  const responseBody = body ?? "";
  res.writeHead(status, davHeaders(headers));
  res.end(responseBody);
  return true;
};

const unauthorized = (res) =>
  send(res, 401, "Unauthorized", {
    "Content-Type": "text/plain; charset=utf-8",
    "WWW-Authenticate": DAV_REALM,
  });

const forbidden = (res) =>
  send(res, 403, "Forbidden", {
    "Content-Type": "text/plain; charset=utf-8",
  });

const tooManyRequests = (res, retryAfterSeconds = DAV_AUTH_WINDOW_SECONDS) =>
  send(res, 429, "Too many requests", {
    "Content-Type": "text/plain; charset=utf-8",
    "Retry-After": String(Math.max(1, Math.ceil(retryAfterSeconds))),
  });

// P48-09: malformed percent-escapes / NUL bytes in a resource name used to throw
// out of decodeURIComponent and surface as a 500 with a stack trace.
const badRequest = (res, message) =>
  send(res, 400, message ?? "Bad request", {
    "Content-Type": "text/plain; charset=utf-8",
  });

const conflict = (res, message) =>
  send(res, 409, message ?? "Conflict", {
    "Content-Type": "text/plain; charset=utf-8",
  });

const methodNotAllowed = (res, allow) =>
  send(res, 405, "Method not allowed", {
    Allow: allow,
    "Content-Type": "text/plain; charset=utf-8",
  });

const options = (res, allow) =>
  send(res, 200, null, {
    Allow: allow,
    "Content-Length": "0",
  });

const xmlResponse = (res, body) =>
  send(res, 207, body, {
    "Content-Type": "application/xml; charset=utf-8",
  });

const notFound = (res) =>
  send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });

const notModified = (res, etag) =>
  send(res, 304, null, etag ? { ETag: etag } : {});

const preconditionFailed = (res) =>
  send(
    res,
    412,
    '<?xml version="1.0" encoding="utf-8"?><d:error xmlns:d="DAV:"><d:precondition-failed/></d:error>',
    { "Content-Type": "application/xml; charset=utf-8" },
  );

const unprocessable = (res, message) =>
  send(res, 422, message ?? "Unprocessable content", {
    "Content-Type": "text/plain; charset=utf-8",
  });

const unsupportedMediaType = (res) =>
  send(res, 415, "Unsupported media type", {
    "Content-Type": "text/plain; charset=utf-8",
  });

const vcardResponse = (res, body, etag) =>
  send(res, 200, body, {
    "Content-Type": "text/vcard; charset=utf-8",
    ETag: etag,
  });

const decodeBasicAuth = (header) => {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const decoded = Buffer.from(header.slice("Basic ".length).trim(), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex < 0) {
    return null;
  }

  return {
    email: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
};

// P48-09: `getRequestIp` now lives in ./src/server/dav/client-ip.mjs and prefers
// `cf-connecting-ip` — see the comment there for why the old
// x-forwarded-for-first order collapsed every client into one bucket.

const getPublicRequestUrl = (req) => {
  const configuredOrigin = process.env.APP_URL ?? process.env.AUTH_URL;

  if (configuredOrigin) {
    return new URL(req.url ?? "/", configuredOrigin);
  }

  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? `localhost:${port}`;
  const forwardedProto = req.headers["x-forwarded-proto"]?.split(",")[0]?.trim();
  const fallbackProto =
    host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  const cloudflareScheme = (() => {
    const value = req.headers["cf-visitor"];

    if (!value) {
      return null;
    }

    try {
      return JSON.parse(value).scheme;
    } catch {
      return null;
    }
  })();
  const proto = forwardedProto ?? cloudflareScheme ?? fallbackProto;

  return new URL(req.url ?? "/", `${proto}://${host}`);
};

// P48-09: read a previously verified (email, token) pair. Redis when available
// (survives a restart and is shared across instances), otherwise the in-process
// map that `src/server/app-passwords.ts` can also reach through globalThis.
const readCachedCredential = async (cacheKey) => {
  if (davRedis) {
    try {
      const raw = await davRedis.get(davCredentialRedisKey(cacheKey));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.userId && parsed?.appPasswordId) {
          return { userId: parsed.userId, appPasswordId: parsed.appPasswordId };
        }
      }
      return null;
    } catch (error) {
      console.error("DAV credential cache read failed", error);
      // fall through to the memory store
    }
  }

  const entry = davCredentialMemoryGet(cacheKey);
  return entry ? { userId: entry.userId, appPasswordId: entry.appPasswordId } : null;
};

const writeCachedCredential = async (cacheKey, value) => {
  davCredentialMemorySet(cacheKey, value, DAV_CREDENTIAL_CACHE_TTL_MS);

  if (!davRedis) return;

  try {
    // Entry plus the two revocation indexes, all on the same TTL.
    await davRedis
      .multi()
      .set(
        davCredentialRedisKey(cacheKey),
        JSON.stringify(value),
        "EX",
        DAV_CREDENTIAL_CACHE_TTL_SECONDS,
      )
      .sadd(davCredentialAppPasswordIndexKey(value.appPasswordId), cacheKey)
      .expire(davCredentialAppPasswordIndexKey(value.appPasswordId), DAV_CREDENTIAL_CACHE_TTL_SECONDS)
      .sadd(davCredentialUserIndexKey(value.userId), cacheKey)
      .expire(davCredentialUserIndexKey(value.userId), DAV_CREDENTIAL_CACHE_TTL_SECONDS)
      .exec();
  } catch (error) {
    console.error("DAV credential cache write failed", error);
  }
};

// P48-09: iOS sends many requests per sync cycle; one `lastUsedAt` UPDATE each
// was pure write amplification. At most one write per app password per 5 minutes.
const touchLastUsedAt = async (appPasswordId) => {
  const now = Date.now();
  const previous = lastUsedWrites.get(appPasswordId) ?? 0;

  if (now - previous < LAST_USED_DEBOUNCE_MS) return;
  lastUsedWrites.set(appPasswordId, now);

  // Bound the map: an instance can only ever hold as many entries as there are
  // app passwords that authenticated in the last window, but be defensive.
  if (lastUsedWrites.size > 10_000) {
    for (const [id, at] of lastUsedWrites) {
      if (now - at >= LAST_USED_DEBOUNCE_MS) lastUsedWrites.delete(id);
    }
  }

  try {
    await prisma.appPassword.update({
      where: { id: appPasswordId },
      data: { lastUsedAt: new Date(now) },
    });
  } catch (error) {
    console.error("Failed to update app password lastUsedAt", error);
  }
};

// P48-09: this is the single DAV credential verifier.
// `verifyCardDavCredentials` in `src/server/app-passwords.ts` is the Next-side
// twin, reachable only through the `/.well-known/carddav` route fallback; both
// reject LOCKED accounts and both keep the dummy-hash compare.
const verifyCardDavCredentials = async (normalizedEmail, plaintext) => {
  const normalizedToken = normalizeToken(plaintext);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, lifecycleState: true, scheduledDeleteAt: true },
  });

  // P48-09: exactly one bcrypt compare on every failure path. Previously an
  // unknown email cost one dummy compare but a *known* email with zero app
  // passwords cost none — a timing oracle for account enumeration.
  // P48-02 follow-up: an account in its deletion grace period is read-only
  // plus cancel on the web and refused on the REST API; device sync is refused
  // too so a scheduled account cannot keep writing over CardDAV.
  if (!user || user.lifecycleState === "LOCKED" || user.scheduledDeleteAt) {
    await bcrypt.compare(normalizedToken, DUMMY_BCRYPT_HASH);
    return null;
  }

  const appPasswords = await prisma.appPassword.findMany({
    where: {
      userId: user.id,
      revokedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      hashedPassword: true,
    },
  });

  if (appPasswords.length === 0) {
    await bcrypt.compare(normalizedToken, DUMMY_BCRYPT_HASH);
    return null;
  }

  for (const appPassword of appPasswords) {
    const matches = await bcrypt.compare(normalizedToken, appPassword.hashedPassword);

    if (!matches) {
      continue;
    }

    return {
      userId: user.id,
      appPasswordId: appPassword.id,
    };
  }

  return null;
};

const consumeDavFailure = async (ip, pairKey, emailKey) => {
  await Promise.all([
    davPairLimiter.consume(pairKey, 1).catch(() => undefined),
    davIpLimiter.consume(ip, 1).catch(() => undefined),
    davEmailLimiter.consume(emailKey, 1).catch(() => undefined),
  ]);
};

const resetDavFailures = async (ip, pairKey, emailKey) => {
  await Promise.all([
    davPairLimiter.delete(pairKey).catch(() => undefined),
    davIpLimiter.delete(ip).catch(() => undefined),
    davEmailLimiter.delete(emailKey).catch(() => undefined),
  ]);
};

// Blocked? Peek without consuming so a *successful* login is never penalised.
const davLimitRetryAfterSeconds = async (ip, pairKey, emailKey) => {
  const [pair, byIp, byEmail] = await Promise.all([
    davPairLimiter.get(pairKey).catch(() => null),
    davIpLimiter.get(ip).catch(() => null),
    davEmailLimiter.get(emailKey).catch(() => null),
  ]);

  const blocked = [
    pair && pair.remainingPoints <= 0 ? pair.msBeforeNext : 0,
    byIp && byIp.remainingPoints <= 0 ? byIp.msBeforeNext : 0,
    byEmail && byEmail.remainingPoints <= 0 ? byEmail.msBeforeNext : 0,
  ].filter((ms) => typeof ms === "number" && ms > 0);

  return blocked.length > 0 ? Math.max(...blocked) / 1000 : null;
};

const requireDavAuth = async (req, res, expectedUserId) => {
  const credentials = decodeBasicAuth(req.headers.authorization);

  if (!credentials) {
    unauthorized(res);
    return null;
  }

  const normalizedEmail = credentials.email.trim().toLowerCase();
  const normalizedToken = normalizeToken(credentials.password);
  const ip = getRequestIp(req);
  const pairKey = `${ip}:${normalizedEmail}`;
  const cacheKey = davCredentialCacheKey(normalizedEmail, normalizedToken);

  // Fast path: a credential we verified in the last 10 minutes. No bcrypt, no
  // rate-limit round trip, no `lastUsedAt` write beyond the 5-minute debounce.
  let result = await readCachedCredential(cacheKey);

  if (!result) {
    // Peek (never consume) before the user lookup and bcrypt, so a blocked key
    // reaches neither the database nor the expensive compare — and a successful
    // authentication is never charged a point.
    const retryAfter = await davLimitRetryAfterSeconds(ip, pairKey, normalizedEmail);

    if (retryAfter !== null) {
      tooManyRequests(res, retryAfter);
      return null;
    }

    result = await verifyCardDavCredentials(normalizedEmail, credentials.password);

    if (!result) {
      await consumeDavFailure(ip, pairKey, normalizedEmail);
      unauthorized(res);
      return null;
    }

    await writeCachedCredential(cacheKey, result);
    await resetDavFailures(ip, pairKey, normalizedEmail);
  }

  if (expectedUserId && result.userId !== expectedUserId) {
    forbidden(res);
    return null;
  }

  void touchLastUsedAt(result.appPasswordId);

  return result;
};

const renderProp = (prop) => {
  switch (prop.name) {
    case "displayname":
      return `<d:displayname>${escapeXml(prop.value)}</d:displayname>`;
    case "resourcetype":
      return `<d:resourcetype>${prop.types
        .map((type) => (type === "collection" ? "<d:collection/>" : "<card:addressbook/>"))
        .join("")}</d:resourcetype>`;
    case "current-user-principal":
      return `<d:current-user-principal><d:href>${escapeXml(prop.href)}</d:href></d:current-user-principal>`;
    case "addressbook-home-set":
      return `<card:addressbook-home-set><d:href>${escapeXml(prop.href)}</d:href></card:addressbook-home-set>`;
    case "supported-address-data":
      return '<card:supported-address-data><card:address-data-type content-type="text/vcard" version="3.0"/><card:address-data-type content-type="text/vcard" version="4.0"/></card:supported-address-data>';
    case "getctag":
      return `<cs:getctag>${escapeXml(prop.value)}</cs:getctag>`;
    case "getetag":
      return `<d:getetag>${escapeXml(prop.value)}</d:getetag>`;
    case "address-data":
      return `<card:address-data>${escapeXml(prop.value)}</card:address-data>`;
    case "current-user-privilege-set":
      // P23-07: read-only books advertise read-only privileges so iOS/macOS show a
      // lock and block edits; writable books advertise read + write.
      return prop.readOnly
        ? "<d:current-user-privilege-set><d:privilege><d:read/></d:privilege></d:current-user-privilege-set>"
        : "<d:current-user-privilege-set><d:privilege><d:read/></d:privilege><d:privilege><d:write/></d:privilege></d:current-user-privilege-set>";
    default:
      return "";
  }
};

const renderNotFoundProp = (name) => `<d:${escapeXml(name)}/>`;

// P48-08: a request body is read only through here, always with a byte cap.
// Without one, a handful of parallel multi-megabyte PROPFINDs from a single
// valid app password stalled the thread that also serves every Next.js page.
class BodyTooLargeError extends Error {
  constructor(maxBytes) {
    super(`Request body exceeds ${maxBytes} bytes`);
    this.name = "BodyTooLargeError";
    this.maxBytes = maxBytes;
  }
}

const readRequestBody = async (req, maxBytes) => {
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    throw new TypeError("readRequestBody requires a positive byte cap");
  }

  // Reject on the declared length before reading a single byte — this is what
  // turns a 4 MB pathological PROPFIND into a sub-millisecond 413.
  const declared = Number.parseInt(req.headers["content-length"] ?? "", 10);

  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new BodyTooLargeError(maxBytes);
  }

  const chunks = [];
  let total = 0;

  // Chunked / unset Content-Length: stop as soon as the running total goes over.
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;

    if (total > maxBytes) {
      throw new BodyTooLargeError(maxBytes);
    }

    chunks.push(buffer);
  }

  return Buffer.concat(chunks).toString("utf8");
};

// Answer 413 and tear the connection down rather than draining whatever the
// client is still streaming at us. `destroySoon` flushes the response first.
const payloadTooLarge = (res, maxBytes) => {
  send(res, 413, `Request body exceeds ${maxBytes} bytes`, {
    "Content-Type": "text/plain; charset=utf-8",
    Connection: "close",
  });

  const socket = res.socket;

  if (socket && !socket.destroyed) {
    if (typeof socket.destroySoon === "function") socket.destroySoon();
    else socket.end();
  }

  return true;
};

// Returns the body, or `null` when a 413 has already been written (the caller
// must then return `true` to stop routing). Note: an empty body is `""`, so
// callers compare against `null` explicitly.
const readCappedBody = async (req, res, maxBytes) => {
  try {
    return await readRequestBody(req, maxBytes);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      payloadTooLarge(res, maxBytes);
      return null;
    }
    throw error;
  }
};

// PROPFIND / REPORT: capped read plus a DTD reject. Entities are never expanded
// here, so classic XXE is not reachable — but a DOCTYPE has no legitimate place
// in a DAV request, so treat it as malformed.
const readDavQueryBody = async (req, res) => {
  const body = await readCappedBody(req, res, MAX_QUERY_BODY_BYTES);

  if (body === null) return null;

  if (hasDoctypeOrEntity(body)) {
    badRequest(res, "XML document type declarations are not accepted");
    return null;
  }

  return body;
};

// PROPFIND: capped read + DTD reject + linear prop-name extraction.
// Returns `{ handled: true }` when a 4xx has already been written.
const readRequestedPropNames = async (req, res) => {
  const body = await readDavQueryBody(req, res);

  if (body === null) return { handled: true, names: null };

  return { handled: false, names: extractRequestedPropNames(body) };
};

const splitDavProps = (props, requestedNames) => {
  if (!requestedNames) {
    return {
      props,
      notFoundProps: [],
    };
  }

  const supported = new Set(props.map((prop) => prop.name));

  return {
    props: props.filter((prop) => requestedNames.includes(prop.name)),
    notFoundProps: requestedNames.filter((name) => !supported.has(name)),
  };
};

const buildPropfindResponse = (responses) => {
  const body = responses
    .map((response) => {
      // P48-08: addressbook-multiget reports a bare status for hrefs the client
      // asked for that no longer resolve (RFC 6352 §8.7).
      if (response.status) {
        return `<d:response><d:href>${escapeXml(response.href)}</d:href><d:status>${escapeXml(response.status)}</d:status></d:response>`;
      }

      const okProps = response.props.map(renderProp).join("");
      const notFoundProps = response.notFoundProps?.map(renderNotFoundProp).join("") ?? "";
      const okPropstat = okProps
        ? `<d:propstat><d:prop>${okProps}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>`
        : "";
      const notFoundPropstat = notFoundProps
        ? `<d:propstat><d:prop>${notFoundProps}</d:prop><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat>`
        : "";

      return `<d:response><d:href>${escapeXml(response.href)}</d:href>${okPropstat}${notFoundPropstat}</d:response>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav" xmlns:cs="http://calendarserver.org/ns/">${body}</d:multistatus>`;
};

// P48-08: REPORT responses.
//
// `addressbook-multiget` now returns only the resources the client named instead
// of the whole collection (P14 debt — iOS asks for a handful per cycle), with a
// bare 404 status for hrefs that no longer resolve. `sync-collection` and
// `addressbook-query` keep today's full-collection behaviour.
//
// Requested props are honoured where the client listed them, but an empty
// intersection falls back to sending everything rather than an empty response —
// a parse surprise must never silently blank a client's address book.
const buildReportResponses = (contacts, report, hrefFor) => {
  const propsFor = (contact) => {
    const all = [
      { name: "getetag", value: etagForContact(contact) },
      { name: "address-data", value: serializeContactToVCard(contact) },
    ];
    const names = report?.propNames;

    if (!names) return { props: all, notFoundProps: [] };

    const filtered = all.filter((prop) => names.includes(prop.name));
    return { props: filtered.length > 0 ? filtered : all, notFoundProps: [] };
  };

  if (report?.type !== "addressbook-multiget" || report.hrefs.length === 0) {
    return contacts.map((contact) => ({ href: hrefFor(contact), ...propsFor(contact) }));
  }

  const byUid = new Map(contacts.map((contact) => [contact.syncUid, contact]));
  const responses = [];
  const seen = new Set();

  for (const href of report.hrefs) {
    if (seen.has(href)) continue;
    seen.add(href);

    const uid = hrefToSyncUid(href);
    const contact = uid === null ? undefined : byUid.get(uid);

    if (!contact) {
      responses.push({ href, status: "HTTP/1.1 404 Not Found", props: [], notFoundProps: [] });
      continue;
    }

    responses.push({ href: hrefFor(contact), ...propsFor(contact) });
  }

  return responses;
};

// P18-11: CTag is now per-book (was per-user)
// P23-07: resolve which contacts belong to a personal Kontax-server book. A book
// with sourceBookIds aggregates contacts from those books; otherwise it scopes to
// its own contacts (bookId = book.id). A null book means the legacy "all contacts".
// P48-09: every branch carries `userId`. The sourceBookIds branch dropped it,
// which would have let a caller reach another user's contacts if a book ever
// aggregated ids it does not own.
const bookScopeWhere = (userId, book) => {
  if (!book) return { userId };
  if (Array.isArray(book.sourceBookIds) && book.sourceBookIds.length > 0) {
    return { userId, bookId: { in: book.sourceBookIds } };
  }
  return { userId, bookId: book.id };
};

const computeAddressBookCTag = async (userId, book) => {
  const mostRecent = await prisma.contact.findFirst({
    where: bookScopeWhere(userId, book),
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return mostRecent?.updatedAt.toISOString() ?? "empty";
};

const getPrincipalUserId = (pathname) => pathname.match(/^\/dav\/principals\/([^/]+)\/?$/)?.[1];
const getAddressBookUserId = (pathname) => pathname.match(/^\/dav\/addressbooks\/([^/]+)\/?$/)?.[1];

// P18-11: dynamic bookSlug (was hardcoded "default"; slug "default" preserved for device compat)
const getCollectionParams = (pathname) => {
  // Exclude known non-personal slugs (family, team-*)
  const match = pathname.match(/^\/dav\/addressbooks\/([^/]+)\/([^/]+)\/?$/);
  if (!match) return null;
  const slug = match[2];
  if (slug === 'family' || slug?.startsWith('team-')) return null;
  return { userId: match[1], bookSlug: slug };
};
// Legacy compat — keep for callers that only need userId
const getCollectionUserId = (pathname) => getCollectionParams(pathname)?.userId ?? null;

// P48-09: `invalid: true` instead of throwing out of decodeURIComponent — the
// handler answers 400 rather than a 500 with a stack trace.
const getResourceParams = (pathname) => {
  const match = pathname.match(/^\/dav\/addressbooks\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  const slug = match[2];
  if (slug === 'family' || slug?.startsWith('team-')) return null;
  const rawUid = match[3];
  const uid = decodePathSegment(rawUid.endsWith(".vcf") ? rawUid.slice(0, -4) : rawUid);
  if (uid === null) return { userId: match[1], bookSlug: slug, uid: null, invalid: true };
  return { userId: match[1], bookSlug: slug, uid };
};

// P18-11: resolve AddressBook row by userId + slug (creates default if missing)
const resolveAddressBook = async (userId, slug) => {
  const book = await prisma.addressBook.findUnique({
    where: { userId_slug: { userId, slug } },
  });
  if (book && !book.archivedAt) return book;
  // Auto-create default book on first CardDAV access if migration hasn't run yet
  if (slug === 'default') {
    return prisma.addressBook.upsert({
      where: { userId_slug: { userId, slug: 'default' } },
      update: {},
      create: { userId, name: 'All Contacts', slug: 'default', isDefault: true },
    });
  }
  return null;
};

// --- vCard serialization / parsing (self-contained for the Node DAV adapter) ---

const etagForContact = (contact) => `"v${contact.syncVersion}"`;

// P18-11: use dynamic slug in URLs
const contactResourceHref = (userId, syncUid, bookSlug = 'default') =>
  `/dav/addressbooks/${userId}/${bookSlug}/${encodeURIComponent(syncUid)}.vcf`;

// P13-08: family shared book exposed as a second collection per member.
const getFamilyCollectionUserId = (pathname) =>
  pathname.match(/^\/dav\/addressbooks\/([^/]+)\/family\/?$/)?.[1];
const getFamilyResourceParams = (pathname) => {
  const match = pathname.match(/^\/dav\/addressbooks\/([^/]+)\/family\/([^/]+)$/);
  if (!match) {
    return null;
  }
  const rawUid = match[2];
  const uid = decodePathSegment(rawUid.endsWith(".vcf") ? rawUid.slice(0, -4) : rawUid);
  if (uid === null) return { userId: match[1], uid: null, invalid: true };
  return { userId: match[1], uid };
};
const familyResourceHref = (userId, syncUid) =>
  `/dav/addressbooks/${userId}/family/${encodeURIComponent(syncUid)}.vcf`;

// P14-09: each accessible team book exposed as /dav/addressbooks/{userId}/team-{bookId}/
const getTeamCollectionParams = (pathname) => {
  const m = pathname.match(/^\/dav\/addressbooks\/([^/]+)\/team-([^/]+)\/?$/);
  return m ? { userId: m[1], bookId: m[2] } : null;
};
const getTeamResourceParams = (pathname) => {
  const m = pathname.match(/^\/dav\/addressbooks\/([^/]+)\/team-([^/]+)\/([^/]+)$/);
  if (!m) {
    return null;
  }
  const raw = m[3];
  const uid = decodePathSegment(raw.endsWith(".vcf") ? raw.slice(0, -4) : raw);
  if (uid === null) return { userId: m[1], bookId: m[2], uid: null, invalid: true };
  return { userId: m[1], bookId: m[2], uid };
};
const teamResourceHref = (userId, bookId, syncUid) =>
  `/dav/addressbooks/${userId}/team-${bookId}/${encodeURIComponent(syncUid)}.vcf`;

// P49A-02: vCard parse/serialize (grouped properties, full-replace PUT data,
// year-less birthdays, escaping) lives in src/server/dav/vcard.mjs.

// P18-11 / P23-07: contacts in a personal book — its own, or aggregated from
// sourceBookIds. `book` may be null (legacy default = all of the user's contacts).
const fetchActiveContacts = (userId, book) =>
  prisma.contact.findMany({
    where: { ...bookScopeWhere(userId, book), archivedAt: null, syncTombstoneAt: null },
    orderBy: { syncUid: "asc" },
  });

// P13-08: the user's accepted family book (owner id + default book + edit right).
const getFamilyBookForUser = async (userId) => {
  const member = await prisma.groupMember.findFirst({
    where: { userId, inviteStatus: "ACCEPTED", group: { type: "FAMILY" } },
    include: {
      group: { select: { ownerId: true, defaultAddressBookId: true, name: true } },
    },
  });
  if (!member?.group?.defaultAddressBookId) {
    return null;
  }
  return {
    ownerId: member.group.ownerId,
    bookId: member.group.defaultAddressBookId,
    canEdit: member.canEdit,
    groupName: member.group.name,
  };
};

const fetchFamilyContacts = (bookId) =>
  prisma.contact.findMany({
    where: {
      archivedAt: null,
      syncTombstoneAt: null,
      groupContacts: { some: { groupAddressBookId: bookId } },
    },
    orderBy: { syncUid: "asc" },
  });

const computeFamilyCTag = async (bookId) => {
  const mostRecent = await prisma.contact.findFirst({
    where: { groupContacts: { some: { groupAddressBookId: bookId } } },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return mostRecent?.updatedAt.toISOString() ?? "empty";
};

// Best-effort activity attribution for a family-book change made over CardDAV.
const emitFamilyDavEvent = async (userId, contactId, eventType) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const name = user?.name?.trim() ?? user?.email ?? "A family member";
    await prisma.activityEvent.create({
      data: {
        userId,
        contactId,
        eventType,
        actor: "FAMILY_MEMBER",
        actorDetail: `${name} via Family Book (CardDAV)`,
        payload: {},
      },
    });
  } catch (error) {
    console.error("Failed to log family CardDAV event", error);
  }
};

// P14-09: a user's accessible team book (TEAM, not archived, member can VIEW/EDIT).
const getTeamBookAccess = async (userId, bookId) => {
  const book = await prisma.groupAddressBook.findFirst({
    where: { id: bookId, archivedAt: null, group: { type: "TEAM" } },
    include: { group: { select: { id: true, name: true, ownerId: true } } },
  });
  if (!book) {
    return null;
  }
  const member = await prisma.groupMember.findFirst({
    where: { groupId: book.group.id, userId, inviteStatus: "ACCEPTED" },
    select: { role: true, addressBookPermissions: true },
  });
  if (!member) {
    return null;
  }
  const manager = member.role === "OWNER" || member.role === "ADMIN";
  const perms = member.addressBookPermissions ?? {};
  const perm = manager ? "EDIT" : (perms[bookId] ?? "EDIT");
  if (perm === "NONE") {
    return null;
  }
  return {
    bookId,
    name: book.name,
    teamName: book.group.name,
    ownerId: book.group.ownerId,
    canEdit: perm === "EDIT",
  };
};

// All team books the user can access (for the home-set listing).
const getUserTeamBooks = async (userId) => {
  const members = await prisma.groupMember.findMany({
    where: { userId, inviteStatus: "ACCEPTED", group: { type: "TEAM" } },
    include: {
      group: {
        select: {
          name: true,
          addressBooks: { where: { archivedAt: null }, select: { id: true, name: true } },
        },
      },
    },
  });
  const out = [];
  for (const m of members) {
    const manager = m.role === "OWNER" || m.role === "ADMIN";
    const perms = m.addressBookPermissions ?? {};
    for (const b of m.group.addressBooks) {
      const perm = manager ? "EDIT" : (perms[b.id] ?? "EDIT");
      if (perm !== "NONE") {
        out.push({ bookId: b.id, name: b.name, teamName: m.group.name });
      }
    }
  }
  return out;
};

const fetchTeamBookContacts = (bookId) =>
  prisma.contact.findMany({
    where: {
      archivedAt: null,
      syncTombstoneAt: null,
      groupContacts: { some: { groupAddressBookId: bookId } },
    },
    orderBy: { syncUid: "asc" },
  });

const computeTeamBookCTag = async (bookId) => {
  const mostRecent = await prisma.contact.findFirst({
    where: { groupContacts: { some: { groupAddressBookId: bookId } } },
    orderBy: { updatedAt: "desc" },
    select: { updatedAt: true },
  });
  return mostRecent?.updatedAt.toISOString() ?? "empty";
};

const emitTeamDavEvent = async (userId, contactId, eventType, label) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    });
    const name = user?.name?.trim() ?? user?.email ?? "A team member";
    await prisma.activityEvent.create({
      data: {
        userId,
        contactId,
        eventType,
        actor: "TEAM_MEMBER",
        actorDetail: `${name} · ${label} (CardDAV)`,
        payload: {},
      },
    });
  } catch (error) {
    console.error("Failed to log team CardDAV event", error);
  }
};

// P9-08: record an inbound device-write conflict (stale If-Match on PUT/DELETE).
// Default resolution is last-write-wins (server is authoritative); the record is
// kept OPEN for the Phase 10 activity log / review UI. Never throws into the
// request path — a failed log must not turn a 412 into a 500.
// P48-08: PUT bodies are capped at 1 MB, but a stale If-Match persists the body
// verbatim — cap what reaches the DB at 64 KB so a client that loops on a
// conflict cannot grow SyncConflict without bound.
const truncateConflictSnapshot = (vcard) => {
  if (typeof vcard !== "string" || vcard.length === 0) return undefined;

  const bytes = Buffer.byteLength(vcard, "utf8");

  if (bytes <= MAX_CONFLICT_SNAPSHOT_BYTES) {
    return { rawVCard: vcard };
  }

  return {
    rawVCard: Buffer.from(vcard, "utf8")
      .subarray(0, MAX_CONFLICT_SNAPSHOT_BYTES)
      .toString("utf8"),
    truncated: true,
    originalBytes: bytes,
  };
};

const logDeviceWriteConflict = async ({ contact, appPasswordId, clientEtag, incomingVCard, conflictType }) => {
  try {
    await prisma.syncConflict.create({
      data: {
        conflictType: conflictType ?? "VERSION_MISMATCH",
        conflictSource: "INBOUND_DEVICE",
        status: "OPEN",
        resolutionStrategy: "KEEP_LOCAL",
        contactId: contact.id,
        appPasswordId: appPasswordId ?? null,
        localSyncVersion: contact.syncVersion ?? null,
        remoteETag: clientEtag ?? null,
        localSnapshot: JSON.parse(JSON.stringify(contact)),
        remoteSnapshot: truncateConflictSnapshot(incomingVCard),
        detectedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Failed to log device-write conflict", error);
  }
};

const handleWellKnown = async (req, res, requestUrl) => {
  if (requestUrl.pathname !== "/.well-known/carddav") {
    return false;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return methodNotAllowed(res, "GET, HEAD");
  }

  const authResult = await requireDavAuth(req, res);

  if (!authResult) {
    return true;
  }

  // P48-09: relative Location. The absolute form was built from the request
  // Host when APP_URL/AUTH_URL was unset, so a forged Host header could aim a
  // client's redirect at another origin.
  return send(res, 301, req.method === "HEAD" ? null : "Moved permanently", {
    Location: `/dav/principals/${authResult.userId}/`,
    "Content-Type": "text/plain; charset=utf-8",
  });
};

const handlePrincipal = async (req, res, requestUrl) => {
  const userId = getPrincipalUserId(requestUrl.pathname);

  if (!userId) {
    return false;
  }

  const allow = "OPTIONS, PROPFIND";

  if (req.method === "OPTIONS") {
    return options(res, allow);
  }

  if (req.method !== "PROPFIND") {
    return methodNotAllowed(res, allow);
  }

  const authResult = await requireDavAuth(req, res, userId);

  if (!authResult) {
    return true;
  }

  const depth = req.headers.depth ?? "0";

  if (depth === "infinity") {
    return forbidden(res);
  }

  if (depth !== "0") {
    return send(res, 400, "Unsupported Depth", { "Content-Type": "text/plain; charset=utf-8" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }

  const propNamesResult = await readRequestedPropNames(req, res);
  if (propNamesResult.handled) return true;
  const requestedNames = propNamesResult.names;
  const props = [
    { name: "current-user-principal", href: `/dav/principals/${user.id}/` },
    { name: "addressbook-home-set", href: `/dav/addressbooks/${user.id}/` },
    { name: "displayname", value: user.name ?? user.email },
  ];

  return xmlResponse(
    res,
    buildPropfindResponse([
      {
        href: `/dav/principals/${user.id}/`,
        ...splitDavProps(props, requestedNames),
      },
    ]),
  );
};

const handleAddressBooks = async (req, res, requestUrl) => {
  const userId = getAddressBookUserId(requestUrl.pathname);

  if (!userId) {
    return false;
  }

  const allow = "OPTIONS, PROPFIND";

  if (req.method === "OPTIONS") {
    return options(res, allow);
  }

  if (req.method !== "PROPFIND") {
    return methodNotAllowed(res, allow);
  }

  const authResult = await requireDavAuth(req, res, userId);

  if (!authResult) {
    return true;
  }

  const depth = req.headers.depth ?? "0";

  if (depth === "infinity") {
    return forbidden(res);
  }

  if (depth !== "0" && depth !== "1") {
    return send(res, 400, "Unsupported Depth", { "Content-Type": "text/plain; charset=utf-8" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }

  const propNamesResult = await readRequestedPropNames(req, res);
  if (propNamesResult.handled) return true;
  const requestedNames = propNamesResult.names;
  const homeHref = `/dav/addressbooks/${user.id}/`;
  const homeProps = [
    { name: "displayname", value: "Address Books" },
    { name: "resourcetype", types: ["collection"] },
    { name: "current-user-principal", href: `/dav/principals/${user.id}/` },
  ];
  const responses = [
    {
      href: homeHref,
      ...splitDavProps(homeProps, requestedNames),
    },
  ];

  if (depth === "1") {
    // P18-11: list all non-archived personal books dynamically
    const personalBooks = await prisma.addressBook.findMany({
      where: { userId: user.id, archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    for (const pb of personalBooks) {
      const bookProps = [
        { name: "displayname", value: pb.name },
        { name: "resourcetype", types: ["collection", "addressbook"] },
        { name: "getctag", value: await computeAddressBookCTag(user.id, pb) },
        { name: "supported-address-data" },
        // P23-07: signal read-only books so iOS/macOS show them as non-editable.
        { name: "current-user-privilege-set", readOnly: pb.deviceWritable === false },
      ];
      responses.push({
        href: `${homeHref}${pb.slug}/`,
        ...splitDavProps(bookProps, requestedNames),
      });
    }
    // If no books yet (pre-migration), surface the legacy default
    if (personalBooks.length === 0) {
      const defaultProps = [
        { name: "displayname", value: "All Contacts" },
        { name: "resourcetype", types: ["collection", "addressbook"] },
        { name: "getctag", value: await computeAddressBookCTag(user.id, null) },
        { name: "supported-address-data" },
      ];
      responses.push({ href: `${homeHref}default/`, ...splitDavProps(defaultProps, requestedNames) });
      // (legacy default is always writable; no privilege-set override needed)
    }

    // P13-08: surface the shared family book as a second collection.
    const familyBook = await getFamilyBookForUser(user.id);
    if (familyBook) {
      const familyProps = [
        { name: "displayname", value: `${familyBook.groupName} (Family)` },
        { name: "resourcetype", types: ["collection", "addressbook"] },
        { name: "getctag", value: await computeFamilyCTag(familyBook.bookId) },
        { name: "supported-address-data" },
      ];
      responses.push({
        href: `${homeHref}family/`,
        ...splitDavProps(familyProps, requestedNames),
      });
    }

    // P14-09: surface each accessible team book as its own collection.
    const teamBooks = await getUserTeamBooks(user.id);
    for (const tb of teamBooks) {
      const teamProps = [
        { name: "displayname", value: `${tb.teamName} · ${tb.name}` },
        { name: "resourcetype", types: ["collection", "addressbook"] },
        { name: "getctag", value: await computeTeamBookCTag(tb.bookId) },
        { name: "supported-address-data" },
      ];
      responses.push({
        href: `${homeHref}team-${tb.bookId}/`,
        ...splitDavProps(teamProps, requestedNames),
      });
    }
  }

  return xmlResponse(res, buildPropfindResponse(responses));
};

const handleFamilyCollection = async (req, res, requestUrl) => {
  const userId = getFamilyCollectionUserId(requestUrl.pathname);
  if (!userId) {
    return false;
  }
  const allow = "OPTIONS, PROPFIND, REPORT";
  if (req.method === "OPTIONS") {
    return options(res, allow);
  }
  if (req.method !== "PROPFIND" && req.method !== "REPORT") {
    return methodNotAllowed(res, allow);
  }

  const authResult = await requireDavAuth(req, res, userId);
  if (!authResult) {
    return true;
  }
  const familyBook = await getFamilyBookForUser(userId);
  if (!familyBook) {
    return notFound(res);
  }

  const collectionHref = `/dav/addressbooks/${userId}/family/`;

  if (req.method === "PROPFIND") {
    const depth = req.headers.depth ?? "0";
    if (depth === "infinity") {
      return forbidden(res);
    }
    if (depth !== "0" && depth !== "1") {
      return send(res, 400, "Unsupported Depth", { "Content-Type": "text/plain; charset=utf-8" });
    }
    const propNamesResult = await readRequestedPropNames(req, res);
    if (propNamesResult.handled) return true;
    const requestedNames = propNamesResult.names;
    const collectionProps = [
      { name: "displayname", value: `${familyBook.groupName} (Family)` },
      { name: "resourcetype", types: ["collection", "addressbook"] },
      { name: "getctag", value: await computeFamilyCTag(familyBook.bookId) },
      { name: "supported-address-data" },
    ];
    const responses = [
      {
        href: collectionHref,
        ...splitDavProps(collectionProps, requestedNames),
      },
    ];
    if (depth === "1") {
      const contacts = await fetchFamilyContacts(familyBook.bookId);
      for (const contact of contacts) {
        const props = [{ name: "getetag", value: etagForContact(contact) }];
        responses.push({
          href: familyResourceHref(userId, contact.syncUid),
          ...splitDavProps(props, requestedNames),
        });
      }
    }
    return xmlResponse(res, buildPropfindResponse(responses));
  }

  // REPORT (addressbook-query / addressbook-multiget)
  const reportBody = await readDavQueryBody(req, res);
  if (reportBody === null) return true;
  const report = parseReportRequest(reportBody);
  const contacts = await fetchFamilyContacts(familyBook.bookId);
  const responses = buildReportResponses(contacts, report, (contact) =>
    familyResourceHref(userId, contact.syncUid),
  );
  return xmlResponse(res, buildPropfindResponse(responses));
};

const handleFamilyResource = async (req, res, requestUrl) => {
  const params = getFamilyResourceParams(requestUrl.pathname);
  if (!params) {
    return false;
  }
  // P48-09: undecodable resource name → 400, not a 500 with a stack trace.
  if (params.invalid) {
    return badRequest(res, "Invalid resource name");
  }
  const { userId, uid } = params;
  const allow = "OPTIONS, GET, PUT, DELETE";
  if (req.method === "OPTIONS") {
    return options(res, allow);
  }
  if (!["GET", "HEAD", "PUT", "DELETE"].includes(req.method)) {
    return methodNotAllowed(res, allow);
  }
  const authResult = await requireDavAuth(req, res, userId);
  if (!authResult) {
    return true;
  }
  const familyBook = await getFamilyBookForUser(userId);
  if (!familyBook) {
    return notFound(res);
  }

  // A contact in this user's family book, matched by its sync UID.
  const findInBook = () =>
    prisma.contact.findFirst({
      where: { syncUid: uid, groupContacts: { some: { groupAddressBookId: familyBook.bookId } } },
    });
  const existing = await findInBook();

  if (req.method === "GET" || req.method === "HEAD") {
    if (!existing || existing.archivedAt || existing.syncTombstoneAt) {
      return notFound(res);
    }
    const etag = etagForContact(existing);
    const ifNoneMatch = req.headers["if-none-match"];
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
      return notModified(res, etag);
    }
    return vcardResponse(res, req.method === "HEAD" ? null : serializeContactToVCard(existing), etag);
  }

  // Writes require edit rights on the family book.
  if (!familyBook.canEdit) {
    return forbidden(res);
  }

  if (req.method === "PUT") {
    const body = await readCappedBody(req, res, MAX_PUT_BODY_BYTES);
    if (body === null) return true;
    if (isGroupVCard(body)) {
      return unsupportedMediaType(res);
    }
    const bodyUid = getVCardUid(body);
    if (bodyUid && bodyUid !== uid) {
      return unprocessable(res, "UID in vCard body does not match the resource URL.");
    }
    const ifMatch = req.headers["if-match"];
    const ifNoneMatch = req.headers["if-none-match"];
    if (ifMatch) {
      if (!existing || existing.syncTombstoneAt) {
        return preconditionFailed(res);
      }
      if (!ifMatch.split(",").map((v) => v.trim()).includes(etagForContact(existing))) {
        await logDeviceWriteConflict({
          contact: existing,
          appPasswordId: authResult.appPasswordId,
          clientEtag: ifMatch,
          incomingVCard: body,
          conflictType: "VERSION_MISMATCH",
        });
        return preconditionFailed(res);
      }
    }
    if (ifNoneMatch === "*" && existing && !existing.syncTombstoneAt) {
      return preconditionFailed(res);
    }

    // P49A-02: core DAV columns are replaced (absent → cleared); extended ones
    // only when present. See src/server/dav/vcard.mjs.
    const fields = buildDavContactWriteData(body, { jsonNull: Prisma.DbNull, existing });

    if (!existing) {
      // Device added a contact to the family collection → create in the book,
      // owned (nominally) by the group owner, linked via GroupContact.
      const created = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: {
            userId: familyBook.ownerId,
            syncUid: uid,
            syncVersion: 1,
            sourceType: "SYNC_CARDDAV",
            sourceDetail: `${familyBook.groupName} (family book)`,
            ...fields,
          },
        });
        await tx.groupContact.create({
          data: { groupAddressBookId: familyBook.bookId, contactId: contact.id, addedByUserId: userId },
        });
        return contact;
      });
      await emitFamilyDavEvent(userId, created.id, "CONTACT_CREATED");
      return send(res, 201, null, { ETag: etagForContact(created) });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.contact.findFirst({
        where: { id: existing.id },
        select: { id: true, syncVersion: true },
      });
      return tx.contact.update({
        where: { id: current.id },
        data: {
          ...fields,
          syncVersion: (current.syncVersion ?? 0) + 1,
          syncTombstoneAt: null,
          archivedAt: null,
        },
      });
    });
    await emitFamilyDavEvent(userId, updated.id, "CONTACT_UPDATED");
    return send(res, 204, null, { ETag: etagForContact(updated) });
  }

  // DELETE → soft-archive the shared contact (other members see it archived).
  if (!existing || existing.syncTombstoneAt) {
    return notFound(res);
  }
  const ifMatch = req.headers["if-match"];
  if (ifMatch && !ifMatch.split(",").map((v) => v.trim()).includes(etagForContact(existing))) {
    await logDeviceWriteConflict({
      contact: existing,
      appPasswordId: authResult.appPasswordId,
      clientEtag: ifMatch,
      incomingVCard: null,
      conflictType: "DELETE_CONFLICT",
    });
    return preconditionFailed(res);
  }
  const now = new Date();
  await prisma.contact.update({
    where: { id: existing.id },
    data: {
      syncTombstoneAt: now,
      archivedAt: existing.archivedAt ?? now,
      syncVersion: existing.syncVersion + 1,
    },
  });
  await emitFamilyDavEvent(userId, existing.id, "CONTACT_ARCHIVED");
  return send(res, 204, null);
};

const handleTeamCollection = async (req, res, requestUrl) => {
  const params = getTeamCollectionParams(requestUrl.pathname);
  if (!params) {
    return false;
  }
  const { userId, bookId } = params;
  const allow = "OPTIONS, PROPFIND, REPORT";
  if (req.method === "OPTIONS") {
    return options(res, allow);
  }
  if (req.method !== "PROPFIND" && req.method !== "REPORT") {
    return methodNotAllowed(res, allow);
  }
  const authResult = await requireDavAuth(req, res, userId);
  if (!authResult) {
    return true;
  }
  const access = await getTeamBookAccess(userId, bookId);
  if (!access) {
    return notFound(res);
  }
  const collectionHref = `/dav/addressbooks/${userId}/team-${bookId}/`;
  const label = `${access.teamName} · ${access.name}`;

  if (req.method === "PROPFIND") {
    const depth = req.headers.depth ?? "0";
    if (depth === "infinity") {
      return forbidden(res);
    }
    if (depth !== "0" && depth !== "1") {
      return send(res, 400, "Unsupported Depth", { "Content-Type": "text/plain; charset=utf-8" });
    }
    const propNamesResult = await readRequestedPropNames(req, res);
    if (propNamesResult.handled) return true;
    const requestedNames = propNamesResult.names;
    const collectionProps = [
      { name: "displayname", value: label },
      { name: "resourcetype", types: ["collection", "addressbook"] },
      { name: "getctag", value: await computeTeamBookCTag(bookId) },
      { name: "supported-address-data" },
    ];
    const responses = [
      { href: collectionHref, ...splitDavProps(collectionProps, requestedNames) },
    ];
    if (depth === "1") {
      const contacts = await fetchTeamBookContacts(bookId);
      for (const contact of contacts) {
        responses.push({
          href: teamResourceHref(userId, bookId, contact.syncUid),
          ...splitDavProps([{ name: "getetag", value: etagForContact(contact) }], requestedNames),
        });
      }
    }
    return xmlResponse(res, buildPropfindResponse(responses));
  }

  // REPORT (addressbook-query / addressbook-multiget)
  const reportBody = await readDavQueryBody(req, res);
  if (reportBody === null) return true;
  const report = parseReportRequest(reportBody);
  const contacts = await fetchTeamBookContacts(bookId);
  const responses = buildReportResponses(contacts, report, (contact) =>
    teamResourceHref(userId, bookId, contact.syncUid),
  );
  return xmlResponse(res, buildPropfindResponse(responses));
};

const handleTeamResource = async (req, res, requestUrl) => {
  const params = getTeamResourceParams(requestUrl.pathname);
  if (!params) {
    return false;
  }
  // P48-09: undecodable resource name → 400, not a 500 with a stack trace.
  if (params.invalid) {
    return badRequest(res, "Invalid resource name");
  }
  const { userId, bookId, uid } = params;
  const allow = "OPTIONS, GET, PUT, DELETE";
  if (req.method === "OPTIONS") {
    return options(res, allow);
  }
  if (!["GET", "HEAD", "PUT", "DELETE"].includes(req.method)) {
    return methodNotAllowed(res, allow);
  }
  const authResult = await requireDavAuth(req, res, userId);
  if (!authResult) {
    return true;
  }
  const access = await getTeamBookAccess(userId, bookId);
  if (!access) {
    return notFound(res);
  }
  const label = `${access.teamName} · ${access.name}`;
  const existing = await prisma.contact.findFirst({
    where: { syncUid: uid, groupContacts: { some: { groupAddressBookId: bookId } } },
  });

  if (req.method === "GET" || req.method === "HEAD") {
    if (!existing || existing.archivedAt || existing.syncTombstoneAt) {
      return notFound(res);
    }
    const etag = etagForContact(existing);
    const ifNoneMatch = req.headers["if-none-match"];
    if (ifNoneMatch && ifNoneMatch.split(",").map((v) => v.trim()).includes(etag)) {
      return notModified(res, etag);
    }
    return vcardResponse(res, req.method === "HEAD" ? null : serializeContactToVCard(existing), etag);
  }

  // Writes require EDIT permission on the book.
  if (!access.canEdit) {
    return forbidden(res);
  }

  if (req.method === "PUT") {
    const body = await readCappedBody(req, res, MAX_PUT_BODY_BYTES);
    if (body === null) return true;
    if (isGroupVCard(body)) {
      return unsupportedMediaType(res);
    }
    const bodyUid = getVCardUid(body);
    if (bodyUid && bodyUid !== uid) {
      return unprocessable(res, "UID in vCard body does not match the resource URL.");
    }
    const ifMatch = req.headers["if-match"];
    const ifNoneMatch = req.headers["if-none-match"];
    if (ifMatch) {
      if (!existing || existing.syncTombstoneAt) {
        return preconditionFailed(res);
      }
      if (!ifMatch.split(",").map((v) => v.trim()).includes(etagForContact(existing))) {
        await logDeviceWriteConflict({
          contact: existing,
          appPasswordId: authResult.appPasswordId,
          clientEtag: ifMatch,
          incomingVCard: body,
          conflictType: "VERSION_MISMATCH",
        });
        return preconditionFailed(res);
      }
    }
    if (ifNoneMatch === "*" && existing && !existing.syncTombstoneAt) {
      return preconditionFailed(res);
    }
    // P49A-02: core DAV columns are replaced (absent → cleared); extended ones
    // only when present. See src/server/dav/vcard.mjs.
    const fields = buildDavContactWriteData(body, { jsonNull: Prisma.DbNull, existing });

    if (!existing) {
      const created = await prisma.$transaction(async (tx) => {
        const contact = await tx.contact.create({
          data: {
            userId: access.ownerId,
            syncUid: uid,
            syncVersion: 1,
            sourceType: "SYNC_CARDDAV",
            sourceDetail: label,
            ...fields,
          },
        });
        await tx.groupContact.create({
          data: { groupAddressBookId: bookId, contactId: contact.id, addedByUserId: userId },
        });
        return contact;
      });
      await emitTeamDavEvent(userId, created.id, "CONTACT_CREATED", label);
      return send(res, 201, null, { ETag: etagForContact(created) });
    }

    const updated = await prisma.contact.update({
      where: { id: existing.id },
      data: {
        ...fields,
        syncVersion: (existing.syncVersion ?? 0) + 1,
        syncTombstoneAt: null,
        archivedAt: null,
      },
    });
    await emitTeamDavEvent(userId, updated.id, "CONTACT_UPDATED", label);
    return send(res, 204, null, { ETag: etagForContact(updated) });
  }

  // DELETE → soft-archive the team contact.
  if (!existing || existing.syncTombstoneAt) {
    return notFound(res);
  }
  const ifMatch = req.headers["if-match"];
  if (ifMatch && !ifMatch.split(",").map((v) => v.trim()).includes(etagForContact(existing))) {
    await logDeviceWriteConflict({
      contact: existing,
      appPasswordId: authResult.appPasswordId,
      clientEtag: ifMatch,
      incomingVCard: null,
      conflictType: "DELETE_CONFLICT",
    });
    return preconditionFailed(res);
  }
  const now = new Date();
  await prisma.contact.update({
    where: { id: existing.id },
    data: {
      syncTombstoneAt: now,
      archivedAt: existing.archivedAt ?? now,
      syncVersion: existing.syncVersion + 1,
    },
  });
  await emitTeamDavEvent(userId, existing.id, "CONTACT_ARCHIVED", label);
  return send(res, 204, null);
};

const handleAddressBookCollection = async (req, res, requestUrl) => {
  // P18-11: dynamic bookSlug instead of hardcoded "default"
  const params = getCollectionParams(requestUrl.pathname);
  if (!params) return false;
  const { userId, bookSlug } = params;

  const allow = "OPTIONS, PROPFIND, REPORT";
  if (req.method === "OPTIONS") return options(res, allow);
  if (req.method !== "PROPFIND" && req.method !== "REPORT") return methodNotAllowed(res, allow);

  const authResult = await requireDavAuth(req, res, userId);
  if (!authResult) return true;

  // Resolve the AddressBook by slug (auto-creates default if missing)
  const book = await resolveAddressBook(userId, bookSlug);
  if (!book) return notFound(res);

  const collectionHref = `/dav/addressbooks/${userId}/${bookSlug}/`;

  if (req.method === "PROPFIND") {
    const depth = req.headers.depth ?? "0";
    if (depth === "infinity") return forbidden(res);
    if (depth !== "0" && depth !== "1") {
      return send(res, 400, "Unsupported Depth", { "Content-Type": "text/plain; charset=utf-8" });
    }
    const propNamesResult = await readRequestedPropNames(req, res);
    if (propNamesResult.handled) return true;
    const requestedNames = propNamesResult.names;
    const collectionProps = [
      { name: "displayname", value: book.name },
      { name: "resourcetype", types: ["collection", "addressbook"] },
      { name: "getctag", value: await computeAddressBookCTag(userId, book) },
      { name: "supported-address-data" },
      // P23-07: read-only signal for non-writable books.
      { name: "current-user-privilege-set", readOnly: book.deviceWritable === false },
    ];
    const responses = [{ href: collectionHref, ...splitDavProps(collectionProps, requestedNames) }];

    if (depth === "1") {
      const contacts = await fetchActiveContacts(userId, book);
      for (const contact of contacts) {
        responses.push({
          href: contactResourceHref(userId, contact.syncUid, bookSlug),
          ...splitDavProps([{ name: "getetag", value: etagForContact(contact) }], requestedNames),
        });
      }
    }
    return xmlResponse(res, buildPropfindResponse(responses));
  }

  // REPORT (addressbook-query / addressbook-multiget / sync-collection)
  const reportBody = await readDavQueryBody(req, res);
  if (reportBody === null) return true;
  const report = parseReportRequest(reportBody);
  const contacts = await fetchActiveContacts(userId, book);
  const responses = buildReportResponses(contacts, report, (contact) =>
    contactResourceHref(userId, contact.syncUid, bookSlug),
  );
  return xmlResponse(res, buildPropfindResponse(responses));
};

const handleContactResource = async (req, res, requestUrl) => {
  const params = getResourceParams(requestUrl.pathname);

  if (!params) {
    return false;
  }

  // P48-09: undecodable resource name → 400, not a 500 with a stack trace.
  if (params.invalid) {
    return badRequest(res, "Invalid resource name");
  }

  const { userId, bookSlug, uid } = params;
  const allow = "OPTIONS, GET, PUT, DELETE";

  if (req.method === "OPTIONS") {
    return options(res, allow);
  }

  if (!["GET", "HEAD", "PUT", "DELETE"].includes(req.method)) {
    return methodNotAllowed(res, allow);
  }

  const authResult = await requireDavAuth(req, res, userId);

  if (!authResult) {
    return true;
  }

  // P18-11: resolve book for scoping contact queries
  const book = await resolveAddressBook(userId, bookSlug ?? 'default');
  if (!book) return notFound(res);

  // P23-07: reject device writes to read-only books.
  if ((req.method === "PUT" || req.method === "DELETE") && book.deviceWritable === false) {
    return forbidden(res);
  }

  // P48-09: scope the lookup to the book in the URL. It used to match on
  // `{ userId, syncUid }` alone, so a PUT under a writable slug could edit a
  // contact that actually lives in a `deviceWritable = false` book — the
  // read-only flag checked above was bypassable by addressing the same UID
  // through any other collection.
  let existing = await prisma.contact.findFirst({
    where: { ...bookScopeWhere(userId, book), syncUid: uid },
  });

  // P48-09: resolve what a PUT is actually allowed to touch through this URL.
  if (req.method === "PUT") {
    if (existing && existing.bookId !== book.id) {
      // Aggregate book (sourceBookIds): readable through this collection, but a
      // write here is ambiguous about which underlying book it lands in.
      return conflict(res, "Contact belongs to a different address book.");
    }

    if (!existing) {
      const elsewhere = await prisma.contact.findFirst({
        where: { userId, syncUid: uid },
        select: { id: true, bookId: true },
      });

      if (elsewhere?.bookId != null) {
        // The UID exists, but in another book — refuse rather than create a
        // duplicate or edit across the read-only boundary.
        return conflict(res, "Contact belongs to a different address book.");
      }

      if (elsewhere) {
        // Legacy contact from before per-book scoping (bookId null). Adopt it
        // into the book it was written through instead of duplicating it.
        existing = await prisma.contact.findFirst({ where: { id: elsewhere.id } });
      }
    }
  }

  if (req.method === "GET" || req.method === "HEAD") {
    if (!existing || existing.archivedAt || existing.syncTombstoneAt) {
      return notFound(res);
    }

    const etag = etagForContact(existing);
    const ifNoneMatch = req.headers["if-none-match"];

    if (ifNoneMatch && ifNoneMatch.split(",").map((value) => value.trim()).includes(etag)) {
      return notModified(res, etag);
    }

    return vcardResponse(res, req.method === "HEAD" ? null : serializeContactToVCard(existing), etag);
  }

  if (req.method === "PUT") {
    const body = await readCappedBody(req, res, MAX_PUT_BODY_BYTES);
    if (body === null) return true;

    if (isGroupVCard(body)) {
      return unsupportedMediaType(res);
    }

    const bodyUid = getVCardUid(body);

    if (bodyUid && bodyUid !== uid) {
      return unprocessable(res, "UID in vCard body does not match the resource URL.");
    }

    const ifMatch = req.headers["if-match"];
    const ifNoneMatch = req.headers["if-none-match"];

    if (ifMatch) {
      if (!existing || existing.syncTombstoneAt) {
        return preconditionFailed(res);
      }
      if (!ifMatch.split(",").map((value) => value.trim()).includes(etagForContact(existing))) {
        // Stale ETag → version conflict. Record it, then 412 (last-write-wins).
        await logDeviceWriteConflict({
          contact: existing,
          appPasswordId: authResult.appPasswordId,
          clientEtag: ifMatch,
          incomingVCard: body,
          conflictType: "VERSION_MISMATCH",
        });
        return preconditionFailed(res);
      }
    }

    if (ifNoneMatch === "*" && existing && !existing.syncTombstoneAt) {
      return preconditionFailed(res);
    }

    // P49A-02: a PUT replaces every CORE DAV column — a property the device
    // left out of the body clears it (it used to survive and reappear on the
    // next fetch). EXTENDED columns (nickname, phonetic names, department) are
    // only written when the body carries them, so a client that doesn't model
    // them can't wipe them. Stored per-entry metadata (phone e164 etc.) is kept
    // for unchanged entries. Columns the mapping does not own are left
    // untouched. The display name is always derived when FN is missing.
    const fields = buildDavContactWriteData(body, { jsonNull: Prisma.DbNull, existing });

    if (!existing) {
      const created = await prisma.contact.create({
        data: {
          userId,
          syncUid: uid,
          syncVersion: 1,
          bookId: book.id, // P18-11
          ...fields,
        },
      });

      return send(res, 201, null, { ETag: etagForContact(created) });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.contact.findFirst({
        where: { id: existing.id },
        select: { id: true, syncVersion: true, bookId: true },
      });

      return tx.contact.update({
        where: { id: current.id },
        data: {
          ...fields,
          // P48-09: adopt a legacy book-less contact into this book.
          ...(current.bookId === null ? { bookId: book.id } : {}),
          syncVersion: (current.syncVersion ?? 0) + 1,
          syncTombstoneAt: null,
          archivedAt: null,
        },
      });
    });

    return send(res, 204, null, { ETag: etagForContact(updated) });
  }

  // DELETE
  if (!existing || existing.syncTombstoneAt) {
    return notFound(res);
  }

  const ifMatch = req.headers["if-match"];

  if (
    ifMatch &&
    !ifMatch.split(",").map((value) => value.trim()).includes(etagForContact(existing))
  ) {
    // Device is deleting a contact that changed server-side since its last sync.
    await logDeviceWriteConflict({
      contact: existing,
      appPasswordId: authResult.appPasswordId,
      clientEtag: ifMatch,
      incomingVCard: null,
      conflictType: "DELETE_CONFLICT",
    });
    return preconditionFailed(res);
  }

  const now = new Date();
  await prisma.contact.update({
    where: { id: existing.id },
    data: {
      syncTombstoneAt: now,
      archivedAt: existing.archivedAt ?? now,
      syncVersion: existing.syncVersion + 1,
    },
  });

  return send(res, 204, null);
};

const handleDavRequest = async (req, res) => {
  const requestUrl = getPublicRequestUrl(req);

  if (await handleWellKnown(req, res, requestUrl)) {
    return true;
  }

  if (await handlePrincipal(req, res, requestUrl)) {
    return true;
  }

  if (await handleFamilyResource(req, res, requestUrl)) {
    return true;
  }

  if (await handleFamilyCollection(req, res, requestUrl)) {
    return true;
  }

  if (await handleTeamResource(req, res, requestUrl)) {
    return true;
  }

  if (await handleTeamCollection(req, res, requestUrl)) {
    return true;
  }

  if (await handleContactResource(req, res, requestUrl)) {
    return true;
  }

  if (await handleAddressBookCollection(req, res, requestUrl)) {
    return true;
  }

  if (await handleAddressBooks(req, res, requestUrl)) {
    return true;
  }

  return false;
};

await app.prepare();

const server = createServer(async (req, res) => {
  try {
    if (await handleDavRequest(req, res)) {
      return;
    }

    // P48-12: pin Host/X-Forwarded-Host to APP_URL before Next sees the
    // request. On custom servers Next trusts the client-supplied
    // `x-forwarded-host` when checking Server Action origins
    // (GHSA-89xv-2m56-2m9x). Fails open when APP_URL is unset — P48-16
    // makes APP_URL required.
    if (appUrlHost && allowedHosts) {
      const forwarded = req.headers["x-forwarded-host"];
      const presented = (Array.isArray(forwarded) ? forwarded[0] : forwarded) ?? req.headers.host ?? "";
      const pinned = allowedHosts.has(presented.toLowerCase()) ? presented.toLowerCase() : appUrlHost;
      req.headers.host = pinned;
      req.headers["x-forwarded-host"] = pinned;
    }

    await handle(req, res);
  } catch (error) {
    console.error("Unhandled server error", error);

    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal server error");
    } else {
      res.end();
    }
  }
});

// P48-08: explicit timeouts. Node's defaults let a slow or stalled client hold a
// request open indefinitely, which on a single-threaded server that also serves
// every Next.js page is a denial-of-service primitive.
//
// requestTimeout  — whole request (headers + body) must arrive within 30 s.
// headersTimeout  — headers alone within 15 s (slowloris).
// keepAliveTimeout — 65 s, comfortably above the 60 s idle timeout of the
//                    Cloudflare → NPM → Traefik chain in front of us, so the
//                    proxy always closes an idle connection before we do and
//                    clients never see a race-condition 502.
server.requestTimeout = 30_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 65_000;

server.listen(port, hostname, () => {
  console.log(`Kontax server ready on http://${hostname}:${port}`);
});

// P49A-04: graceful shutdown. On SIGTERM (forwarded by
// scripts/runtime/start-production.mjs, PID 1 in the container):
//   1. flag the process as shutting down — the Next side (sync-runner's lease
//      keeper, the export jobs) checks the flag before claiming new work;
//   2. stop accepting connections (server.close) and drop idle keep-alives;
//   3. wait up to SHUTDOWN_GRACE_MS for in-flight jobs and requests;
//   4. disconnect and exit. Work still running at the deadline is abandoned;
//      its sync job is reclaimed once its lease lapses (reclaimExpiredSyncJobs).
// The flag lives on globalThis under the key src/server/process-lifecycle.ts
// uses, because this file and the Next bundle load separate module instances.
const SHUTDOWN_GRACE_MS = (() => {
  const parsed = Number.parseInt(process.env.SHUTDOWN_GRACE_MS ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 20_000;
})();

const getProcessLifecycle = () => {
  const key = Symbol.for("kontax.processLifecycle");
  globalThis[key] ??= { shuttingDown: false, inFlight: new Map() };
  return globalThis[key];
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let shutdownPromise = null;

const shutdown = (signal) => {
  // Idempotent: Ctrl-C delivers SIGINT to the whole process group, so the
  // server can see it both directly and forwarded by the start script.
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    const startedAt = Date.now();
    const deadline = startedAt + SHUTDOWN_GRACE_MS;
    const lifecycle = getProcessLifecycle();
    lifecycle.shuttingDown = true;
    console.log(
      `[Kontax] ${signal} received — draining: no new connections or job claims; waiting up to ${Math.round(SHUTDOWN_GRACE_MS / 1000)} s for in-flight work.`,
    );

    let httpClosed = false;
    server.close(() => {
      httpClosed = true;
    });

    while (Date.now() < deadline && (lifecycle.inFlight.size > 0 || !httpClosed)) {
      // Keep-alive sockets that go idle mid-drain would hold close() open.
      server.closeIdleConnections();
      await delay(200);
    }

    if (lifecycle.inFlight.size > 0 || !httpClosed) {
      const running = [...lifecycle.inFlight.values()];
      console.warn(
        `[Kontax] shutdown grace period (${Math.round(SHUTDOWN_GRACE_MS / 1000)} s) elapsed; exiting with ${running.length} job(s) still running${running.length ? ` (${running.join(", ")})` : ""} and HTTP ${httpClosed ? "closed" : "connections still open"}. Interrupted sync jobs are reclaimed when their lease expires.`,
      );
      server.closeAllConnections();
      // Expire the abandoned sync jobs' leases now, so the next drain (on the
      // replacement container) reclaims them at once instead of ~10 min later.
      const abandonedSyncJobIds = running
        .filter((label) => label.startsWith("sync-job:"))
        .map((label) => label.slice("sync-job:".length));
      if (abandonedSyncJobIds.length > 0) {
        await prisma.syncJob
          .updateMany({
            where: { id: { in: abandonedSyncJobIds }, status: "RUNNING" },
            data: { leaseExpiresAt: new Date() },
          })
          .catch((error) => console.error("[Kontax] could not release abandoned sync leases", error));
      }
    } else {
      console.log(`[Kontax] drained cleanly in ${Date.now() - startedAt} ms.`);
    }

    await prisma.$disconnect().catch(() => undefined);
    if (davRedis) {
      davRedis.disconnect();
    }
    process.exit(0);
  })();

  return shutdownPromise;
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

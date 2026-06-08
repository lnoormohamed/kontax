import { createServer } from "node:http";
import { Buffer } from "node:buffer";
import next from "next";
import bcrypt from "bcryptjs";

import { PrismaClient } from "./generated/prisma/index.js";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const prisma = new PrismaClient();

const DAV_CAPABILITY_HEADER = "1, addressbook";
const DAV_REALM = 'Basic realm="Kontax CardDAV"';
const DUMMY_BCRYPT_HASH =
  "$2b$12$3Y0mFQ0M0l9n4Y3Q6p0g2uh2jQ7JmYI3d2eY0m4rA4Aq0vN5iVfL2";
const WINDOW_MS = 15 * 60 * 1000;
const IP_FAILURE_LIMIT = 20;
const EMAIL_FAILURE_LIMIT = 10;
const buckets = new Map();

const normalizeToken = (value) => value.replaceAll("-", "").replaceAll(" ", "").trim();
const escapeXml = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const getBucket = (key) => {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    const nextBucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, nextBucket);
    return nextBucket;
  }

  return current;
};

const isLimited = (key, limit) => getBucket(key).count >= limit;
const recordFailure = (key) => {
  getBucket(key).count += 1;
};
const resetBucket = (key) => buckets.delete(key);

const davHeaders = (extra = {}) => ({
  DAV: DAV_CAPABILITY_HEADER,
  "Cache-Control": "no-cache, no-store",
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

const tooManyRequests = (res) =>
  send(res, 429, "Too many requests", {
    "Content-Type": "text/plain; charset=utf-8",
    "Retry-After": "900",
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

const getRequestIp = (req) => {
  const forwardedFor = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  return forwardedFor ?? req.headers["x-real-ip"] ?? req.socket.remoteAddress ?? "unknown";
};

const verifyCardDavCredentials = async (email, plaintext) => {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = normalizeToken(plaintext);
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (!user) {
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

  for (const appPassword of appPasswords) {
    const matches = await bcrypt.compare(normalizedToken, appPassword.hashedPassword);

    if (!matches) {
      continue;
    }

    await prisma.appPassword.update({
      where: { id: appPassword.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      userId: user.id,
      appPasswordId: appPassword.id,
    };
  }

  return null;
};

const requireDavAuth = async (req, res, expectedUserId) => {
  const credentials = decodeBasicAuth(req.headers.authorization);

  if (!credentials) {
    unauthorized(res);
    return null;
  }

  const normalizedEmail = credentials.email.trim().toLowerCase();
  const ipKey = `ip:${getRequestIp(req)}`;
  const emailKey = `email:${normalizedEmail}`;

  if (isLimited(ipKey, IP_FAILURE_LIMIT) || isLimited(emailKey, EMAIL_FAILURE_LIMIT)) {
    tooManyRequests(res);
    return null;
  }

  const result = await verifyCardDavCredentials(normalizedEmail, credentials.password);

  if (!result) {
    recordFailure(ipKey);
    recordFailure(emailKey);
    unauthorized(res);
    return null;
  }

  if (expectedUserId && result.userId !== expectedUserId) {
    forbidden(res);
    return null;
  }

  resetBucket(ipKey);
  resetBucket(emailKey);
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
    default:
      return "";
  }
};

const buildPropfindResponse = (responses) => {
  const body = responses
    .map((response) => {
      const okProps = response.props.map(renderProp).join("");
      return `<d:response><d:href>${escapeXml(response.href)}</d:href><d:propstat><d:prop>${okProps}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:" xmlns:card="urn:ietf:params:xml:ns:carddav" xmlns:cs="http://calendarserver.org/ns/">${body}</d:multistatus>`;
};

const computeAddressBookCTag = async (userId) => {
  const mostRecent = await prisma.contact.findFirst({
    where: {
      userId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      updatedAt: true,
    },
  });

  return mostRecent?.updatedAt.toISOString() ?? "empty";
};

const getPrincipalUserId = (pathname) => pathname.match(/^\/dav\/principals\/([^/]+)\/?$/)?.[1];
const getAddressBookUserId = (pathname) => pathname.match(/^\/dav\/addressbooks\/([^/]+)\/?$/)?.[1];

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

  const location = new URL(`/dav/principals/${authResult.userId}/`, requestUrl);
  return send(res, 301, req.method === "HEAD" ? null : "Moved permanently", {
    Location: location.toString(),
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

  if (depth !== "0" && depth !== "infinity") {
    return send(res, 400, "Unsupported Depth", { "Content-Type": "text/plain; charset=utf-8" });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
  }

  return xmlResponse(
    res,
    buildPropfindResponse([
      {
        href: `/dav/principals/${user.id}/`,
        props: [
          { name: "current-user-principal", href: `/dav/principals/${user.id}/` },
          { name: "addressbook-home-set", href: `/dav/addressbooks/${user.id}/` },
          { name: "displayname", value: user.name ?? user.email },
        ],
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

  const homeHref = `/dav/addressbooks/${user.id}/`;
  const responses = [
    {
      href: homeHref,
      props: [
        { name: "displayname", value: "Address Books" },
        { name: "resourcetype", types: ["collection"] },
        { name: "current-user-principal", href: `/dav/principals/${user.id}/` },
      ],
    },
  ];

  if (depth === "1") {
    responses.push({
      href: `${homeHref}default/`,
      props: [
        { name: "displayname", value: "Kontax" },
        { name: "resourcetype", types: ["collection", "addressbook"] },
        { name: "getctag", value: await computeAddressBookCTag(user.id) },
        { name: "supported-address-data" },
      ],
    });
  }

  return xmlResponse(res, buildPropfindResponse(responses));
};

const handleDavRequest = async (req, res) => {
  const host = req.headers.host ?? `localhost:${port}`;
  const requestUrl = new URL(req.url ?? "/", `http://${host}`);

  if (await handleWellKnown(req, res, requestUrl)) {
    return true;
  }

  if (await handlePrincipal(req, res, requestUrl)) {
    return true;
  }

  if (await handleAddressBooks(req, res, requestUrl)) {
    return true;
  }

  return false;
};

await app.prepare();

createServer(async (req, res) => {
  try {
    if (await handleDavRequest(req, res)) {
      return;
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
}).listen(port, hostname, () => {
  console.log(`Kontax server ready on http://${hostname}:${port}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

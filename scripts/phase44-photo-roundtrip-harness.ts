// P44-01 — Provider photo round-trip QA harness.
//
// Empirically answers, per sync provider: "if we push photo X and pull it
// back, what do we get?" It pushes a reference image set to a *dedicated test
// account*, pulls each photo back, and records mutation evidence (byte
// stability, dimensions, format transcoding, EXIF survival, identifier
// stability) into a JSON evidence file, then renders a per-provider photo
// capability document. The findings feed P44-02 (change detection / echo
// suppression) and the 34I capability registry.
//
// This script deliberately uses NO product sync code paths for photo bodies —
// the product strips photos today. It builds raw vCards / calls the People
// API photo endpoints directly, so it measures the provider, not our mapper.
//
// SAFETY: push/cleanup WRITE to the provider account. Only ever point this at
// a dedicated test account (the --confirm-test-account flag is required).
//
// Usage (see docs/photo-capability/README.md for the full runbook):
//   npm run qa:phase44:photos -- --mode=selftest
//   npm run qa:phase44:photos -- --account=<syncAccountId> --mode=status
//   npm run qa:phase44:photos -- --account=<id> --mode=push --confirm-test-account
//   npm run qa:phase44:photos -- --account=<id> --mode=pull --label=24h
//   npm run qa:phase44:photos -- --account=<id> --mode=report
//   npm run qa:phase44:photos -- --account=<id> --mode=cleanup --confirm-test-account

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { auth as googleAuth, people, type people_v1 } from "@googleapis/people";
import sharp from "sharp";

import { PrismaClient } from "../generated/prisma/index.js";
import {
  decryptGoogleSyncCredential,
  decryptSyncCredentialPayload,
  encryptGoogleSyncCredential,
} from "../src/server/sync-credentials";

// ── CLI plumbing (same conventions as phase37-phone-qa-harness) ──────────────

const getArg = (name: string, fallback: string | undefined = undefined) => {
  const prefix = `--${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
};

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const mode = (getArg("mode", "status") ?? "status").toLowerCase();
const accountId = getArg("account");
const runLabel = getArg("label");
const heicFile = getArg("heic-file");
const vcardFlavor = getArg("vcard", "3") === "4" ? 4 : 3;
const jsonOutput = hasFlag("json");

const USER_AGENT = "KontaxPhotoQA/P44-01";
const MARKER_PREFIX = "kontax-p44";
const UID_PREFIX = "kontax-p44-photoqa";

// ── Reference image set ───────────────────────────────────────────────────────
// All generated images are 4:3 (non-square) on purpose: providers that crop to
// square (Google is documented to) are then detectable from returned
// dimensions alone. Each image carries an EXIF marker (Copyright) and a
// per-image visual pattern so every file has unique bytes.

type ReferenceSpec = {
  id: string;
  format: "jpeg" | "png" | "webp";
  width: number;
  height: number;
  noise?: boolean;
  quality?: number;
};

const REFERENCE_SPECS: ReferenceSpec[] = [
  { id: "jpeg-100", format: "jpeg", width: 100, height: 75 },
  { id: "jpeg-512", format: "jpeg", width: 512, height: 384 },
  { id: "jpeg-1024", format: "jpeg", width: 1024, height: 768 },
  { id: "jpeg-2048", format: "jpeg", width: 2048, height: 1536 },
  { id: "png-512", format: "png", width: 512, height: 384 },
  { id: "webp-512", format: "webp", width: 512, height: 384 },
  // High-frequency noise compresses poorly → reliably lands above 1 MB. Used
  // to probe provider size limits.
  { id: "jpeg-large", format: "jpeg", width: 2448, height: 1836, noise: true, quality: 98 },
];

type ReferenceImage = {
  id: string;
  format: string;
  mime: string;
  vcardType: string;
  width: number | null;
  height: number | null;
  byteLength: number;
  sha256: string;
  exifMarker: string;
  buffer: Buffer;
};

const MIME_BY_FORMAT: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

const VCARD_TYPE_BY_FORMAT: Record<string, string> = {
  jpeg: "JPEG",
  png: "PNG",
  webp: "WEBP",
  heic: "HEIC",
  heif: "HEIC",
};

const sha256 = (buffer: Buffer) => createHash("sha256").update(buffer).digest("hex");

// Deterministic per-image colors derived from the image id, so every
// reference image has distinct pixel content without any randomness.
const colorsForId = (id: string) => {
  const digest = createHash("sha256").update(id).digest();
  const channel = (index: number) => 40 + (digest[index]! % 176);
  return {
    background: { r: channel(0), g: channel(1), b: channel(2) },
    rects: [0, 1, 2, 3].map((n) => ({
      fill: `rgb(${channel(3 + n)},${channel(7 + n)},${channel(11 + n)})`,
    })),
  };
};

const markerSvg = (id: string, width: number, height: number) => {
  const { rects } = colorsForId(id);
  const cell = Math.max(4, Math.round(width / 8));
  const blocks = rects
    .map(
      (rect, index) =>
        `<rect x="${index * cell}" y="${index * cell}" width="${cell * 2}" height="${cell * 2}" fill="${rect.fill}"/>`,
    )
    .join("");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${blocks}</svg>`,
  );
};

const generateReferenceImage = async (spec: ReferenceSpec): Promise<ReferenceImage> => {
  const marker = `${MARKER_PREFIX} ${spec.id}`;
  const { background } = colorsForId(spec.id);

  let base = sharp({
    create: {
      width: spec.width,
      height: spec.height,
      channels: 3,
      background,
      ...(spec.noise ? { noise: { type: "gaussian" as const, mean: 128, sigma: 30 } } : {}),
    },
  }).composite([{ input: markerSvg(spec.id, spec.width, spec.height), top: 0, left: 0 }]);

  if (spec.format === "jpeg") {
    base = base.jpeg({ quality: spec.quality ?? 90 });
  } else if (spec.format === "png") {
    base = base.png();
  } else {
    base = base.webp({ quality: spec.quality ?? 90 });
  }

  const buffer = await base
    .withExif({ IFD0: { Copyright: marker, Software: "kontax-p44-harness" } })
    .toBuffer();

  return {
    id: spec.id,
    format: spec.format,
    mime: MIME_BY_FORMAT[spec.format]!,
    vcardType: VCARD_TYPE_BY_FORMAT[spec.format]!,
    width: spec.width,
    height: spec.height,
    byteLength: buffer.byteLength,
    sha256: sha256(buffer),
    exifMarker: marker,
    buffer,
  };
};

const loadHeicReference = async (filePath: string): Promise<ReferenceImage> => {
  const buffer = readFileSync(filePath);
  let width: number | null = null;
  let height: number | null = null;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
  } catch {
    // sharp builds without an HEVC decoder cannot inspect HEIC — dimensions
    // stay unknown, the round-trip evidence is still valid.
  }
  return {
    id: "heic-file",
    format: "heic",
    mime: "image/heic",
    vcardType: "HEIC",
    width,
    height,
    byteLength: buffer.byteLength,
    sha256: sha256(buffer),
    // No EXIF marker injected — we measure the user-supplied file as-is.
    exifMarker: "",
    buffer,
  };
};

const generateReferenceSet = async (): Promise<ReferenceImage[]> => {
  const images = await Promise.all(REFERENCE_SPECS.map(generateReferenceImage));
  if (heicFile) {
    images.push(await loadHeicReference(heicFile));
  }
  return images;
};

// Stats extracted from bytes a provider returned.
type ReturnedPhotoStats = {
  sha256: string;
  byteLength: number;
  width: number | null;
  height: number | null;
  format: string | null;
  exifMarkerSurvived: boolean | null;
};

const statsForReturnedBytes = async (
  buffer: Buffer,
  exifMarker: string,
): Promise<ReturnedPhotoStats> => {
  let width: number | null = null;
  let height: number | null = null;
  let format: string | null = null;
  let exifMarkerSurvived: boolean | null = null;
  try {
    const meta = await sharp(buffer).metadata();
    width = meta.width ?? null;
    height = meta.height ?? null;
    format = meta.format ?? null;
    exifMarkerSurvived = exifMarker
      ? Boolean(meta.exif?.includes(exifMarker))
      : null;
  } catch {
    // Unparseable bytes — record hashes only; format stays null.
  }
  return {
    sha256: sha256(buffer),
    byteLength: buffer.byteLength,
    width,
    height,
    format,
    exifMarkerSurvived,
  };
};

// ── vCard PHOTO build & parse (harness-local, not product code) ───────────────

// RFC 6350/2426 folding: lines longer than 75 octets continue on the next
// line prefixed with a single space. PHOTO base64 payloads are pure ASCII so
// character counts equal octet counts.
const foldVCardLine = (line: string) => {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(` ${rest.slice(0, 74)}`);
    rest = rest.slice(74);
  }
  if (rest.length > 0) parts.push(` ${rest}`);
  return parts.join("\r\n");
};

const buildPhotoVCard = ({
  uid,
  image,
  flavor,
}: {
  uid: string;
  image: ReferenceImage;
  flavor: 3 | 4;
}) => {
  const fn = `P44 Photo QA ${image.id}`;
  const base64 = image.buffer.toString("base64");
  const photoLine =
    flavor === 4
      ? `PHOTO:data:${image.mime};base64,${base64}`
      : `PHOTO;ENCODING=b;TYPE=${image.vcardType}:${base64}`;

  const lines = [
    "BEGIN:VCARD",
    `VERSION:${flavor === 4 ? "4.0" : "3.0"}`,
    "PRODID:-//Kontax//P44 Photo QA//EN",
    `UID:${uid}`,
    `FN:${fn}`,
    `N:Photo QA;P44;;;`,
    photoLine,
    "END:VCARD",
  ];
  return lines.map(foldVCardLine).join("\r\n") + "\r\n";
};

type ExtractedPhoto = {
  raw: string;
  kind: "inline-b64" | "data-uri" | "uri" | "unknown";
  mime: string | null;
  bytes: Buffer | null;
  uri: string | null;
};

const unfoldVCard = (text: string) => text.replace(/\r?\n[ \t]/g, "");

const extractVCardPhoto = (vcardText: string): ExtractedPhoto | null => {
  const lines = unfoldVCard(vcardText).split(/\r?\n/);
  const photoLine = lines.find((line) => /^(?:[^.;:]+\.)?PHOTO[;:]/i.test(line));
  if (!photoLine) return null;

  const colonIndex = photoLine.indexOf(":");
  const propPart = photoLine.slice(0, colonIndex);
  const value = photoLine.slice(colonIndex + 1);
  const params = propPart.split(";").slice(1);

  let encodingB64 = false;
  let typeParam: string | null = null;
  let valueUri = false;
  for (const param of params) {
    const [rawKey, rawValue] = param.includes("=")
      ? [param.slice(0, param.indexOf("=")), param.slice(param.indexOf("=") + 1)]
      : [null, param];
    const key = rawKey?.toUpperCase() ?? null;
    const paramValue = rawValue.replace(/^"|"$/g, "");
    if (key === "ENCODING" && /^(b|base64)$/i.test(paramValue)) encodingB64 = true;
    if (key === null && /^base64$/i.test(paramValue)) encodingB64 = true; // vCard 2.1 style
    if (key === "TYPE") typeParam = paramValue;
    if (key === null && !encodingB64) typeParam = paramValue; // vCard 2.1 bare type token
    if (key === "VALUE" && /^uri$/i.test(paramValue)) valueUri = true;
  }

  // data: URI (vCard 4)
  const dataUriMatch = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(value);
  if (dataUriMatch) {
    const [, mime, isB64, payload] = dataUriMatch;
    return {
      raw: photoLine,
      kind: "data-uri",
      mime: mime ?? null,
      bytes: isB64 ? Buffer.from(payload!.replace(/\s+/g, ""), "base64") : null,
      uri: null,
    };
  }

  if (valueUri || /^https?:\/\//i.test(value)) {
    return { raw: photoLine, kind: "uri", mime: null, bytes: null, uri: value };
  }

  if (encodingB64 || /^[A-Za-z0-9+/=\s]+$/.test(value)) {
    const bytes = Buffer.from(value.replace(/\s+/g, ""), "base64");
    return {
      raw: photoLine,
      kind: encodingB64 ? "inline-b64" : "unknown",
      mime: typeParam
        ? (MIME_BY_FORMAT[typeParam.toLowerCase()] ?? `image/${typeParam.toLowerCase()}`)
        : null,
      bytes: bytes.byteLength > 0 ? bytes : null,
      uri: null,
    };
  }

  return { raw: photoLine, kind: "unknown", mime: null, bytes: null, uri: null };
};

const extractVCardVersion = (vcardText: string): string | null => {
  const match = /^VERSION:(.+)$/m.exec(unfoldVCard(vcardText));
  return match ? match[1]!.trim() : null;
};

// ── CardDAV transport (raw, basic-auth — mirrors src/server/carddav.ts) ──────

type CardDavCreds = { username: string; password: string };

const basicAuthHeader = (credentials: CardDavCreds) =>
  `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`, "utf8").toString("base64")}`;

const ensureTrailingSlash = (value: string) => (value.endsWith("/") ? value : `${value}/`);

const putVCard = async ({
  href,
  credentials,
  body,
}: {
  href: string;
  credentials: CardDavCreds;
  body: string;
}) => {
  const bodyBytes = Buffer.from(body, "utf-8");
  const response = await fetch(href, {
    method: "PUT",
    headers: {
      Authorization: basicAuthHeader(credentials),
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Length": String(bodyBytes.byteLength),
      "User-Agent": USER_AGENT,
    },
    body: bodyBytes,
    cache: "no-store",
  });
  return { status: response.status, ok: response.ok, etag: response.headers.get("etag") };
};

const getVCard = async ({ href, credentials }: { href: string; credentials: CardDavCreds }) => {
  const response = await fetch(href, {
    method: "GET",
    headers: {
      Authorization: basicAuthHeader(credentials),
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });
  const text = response.ok ? await response.text() : null;
  return {
    status: response.status,
    ok: response.ok,
    etag: response.headers.get("etag"),
    text,
  };
};

const deleteVCard = async ({ href, credentials }: { href: string; credentials: CardDavCreds }) => {
  const response = await fetch(href, {
    method: "DELETE",
    headers: {
      Authorization: basicAuthHeader(credentials),
      "User-Agent": USER_AGENT,
    },
    cache: "no-store",
  });
  // 404 = already gone, treat as success (same as product deleteCardDavContact).
  return { status: response.status, ok: response.ok || response.status === 404 };
};

// ── Google transport ──────────────────────────────────────────────────────────

const getGooglePeopleService = async (
  db: PrismaClient,
  account: { id: string; credentialReference: string | null },
) => {
  if (!account.credentialReference) {
    throw new Error("Google sync account has no stored credentials.");
  }
  const credential = decryptGoogleSyncCredential(account.credentialReference);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  // The client id/secret are only needed to REFRESH the token. A still-valid
  // access token (e.g. freshly refreshed by the prod sync runner) works with
  // a bare OAuth2 client, which matters because the OAuth client secret only
  // exists in the prod deployment's env. The redirect URI is never used by a
  // refresh, so it stays optional.
  const client =
    clientId && clientSecret
      ? new googleAuth.OAuth2(clientId, clientSecret, redirectUri)
      : new googleAuth.OAuth2();
  client.setCredentials({
    access_token: credential.accessToken,
    refresh_token: credential.refreshToken,
    expiry_date: credential.expiryDate ?? undefined,
    scope: credential.scope,
  });

  const expired = !credential.expiryDate || Date.now() > credential.expiryDate - 60_000;
  if (expired) {
    if (!clientId || !clientSecret) {
      throw new Error(
        "Stored Google access token is expired and GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set locally, so it cannot be refreshed. Either add them to .env.local, or trigger a sync for this account on the deployment (which refreshes and persists the token) and re-run within an hour.",
      );
    }
    const refreshed = await client.refreshAccessToken();
    const next = refreshed.credentials;
    // Persist the refreshed token back, exactly like the product connector, so
    // the test account stays healthy for real sync runs too.
    const enc = encryptGoogleSyncCredential({
      ...credential,
      accessToken: next.access_token ?? credential.accessToken,
      refreshToken: next.refresh_token ?? credential.refreshToken,
      expiryDate: next.expiry_date ?? credential.expiryDate,
      scope: next.scope ?? credential.scope,
    });
    await db.syncAccount.update({
      where: { id: account.id },
      data: {
        credentialReference: enc.credentialReference,
        encryptionKeyRef: enc.encryptionKeyRef,
        credentialUpdatedAt: new Date(),
        credentialLastValidatedAt: new Date(),
      },
    });
    client.setCredentials(next);
  }

  return people({ version: "v1", auth: client });
};

const pickContactPhoto = (person: people_v1.Schema$Person | undefined) => {
  const photos = person?.photos ?? [];
  return photos.find((photo) => !photo.default) ?? photos[0] ?? null;
};

// Google photo URLs usually end with a size directive (`=s100`). Stripping it
// and requesting `=s0` returns the stored (largest) rendition.
const googlePhotoUrlBase = (url: string) => url.replace(/=[-a-z0-9]+$/i, "");

const fetchBytes = async (url: string, credentials?: CardDavCreds) => {
  const attempt = async (withAuth: boolean) => {
    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        ...(withAuth && credentials ? { Authorization: basicAuthHeader(credentials) } : {}),
      },
      cache: "no-store",
    });
    if (!response.ok) {
      return { status: response.status, buffer: null as Buffer | null, authed: withAuth };
    }
    return {
      status: response.status,
      buffer: Buffer.from(await response.arrayBuffer()),
      authed: withAuth,
    };
  };
  // Providers that re-host photos (iCloud does) usually guard them with the
  // same credentials as the address book — try authenticated first when we
  // have credentials, fall back to a plain fetch.
  if (credentials) {
    const authed = await attempt(true);
    if (authed.buffer) return authed;
    const plain = await attempt(false);
    return plain.buffer ? plain : authed;
  }
  return attempt(false);
};

// ── Evidence file ─────────────────────────────────────────────────────────────

type PushResult = {
  imageId: string;
  ok: boolean;
  httpStatus: number | null;
  error: string | null;
  remote: {
    uid?: string;
    href?: string;
    etag?: string | null;
    resourceName?: string;
    photoUrl?: string | null;
  };
};

type PullResult = {
  imageId: string;
  found: boolean;
  error: string | null;
  photo: ReturnedPhotoStats | null;
  matchesPushedBytes: boolean | null;
  matchesPreviousPull: boolean | null;
  identifier: Record<string, string | null>;
  identifierStableWithinRun: boolean | null;
  extra: Record<string, unknown>;
};

type Evidence = {
  harness: "phase44-photo-roundtrip";
  version: 1;
  account: {
    id: string;
    provider: string;
    label: string;
    baseUrl: string;
    addressBookUrl: string | null;
    userEmail: string | null;
  };
  providerKey: string;
  vcardFlavor: 3 | 4;
  referenceImages: Omit<ReferenceImage, "buffer">[];
  push: { at: string; results: PushResult[] } | null;
  pulls: { label: string; at: string; results: PullResult[] }[];
  cleanup: { at: string; results: { imageId: string; ok: boolean; error: string | null }[] } | null;
};

const providerKeyFor = (provider: string, baseUrl: string) => {
  if (provider === "GOOGLE") return "google";
  if (provider !== "CARDDAV") return provider.toLowerCase();
  let host = "unknown";
  try {
    host = new URL(baseUrl).hostname.replace(/^www\./, "");
  } catch {
    // keep "unknown"
  }
  if (host.endsWith("icloud.com")) return "carddav-icloud";
  return `carddav-${host.replace(/[^a-z0-9.-]/gi, "")}`;
};

const evidenceDir = path.join(process.cwd(), "docs", "photo-capability");

const evidencePathFor = (providerKey: string, accountId: string) =>
  getArg("evidence") ??
  path.join(evidenceDir, `evidence-${providerKey}-${accountId}.json`);

const loadEvidence = (filePath: string): Evidence | null => {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, "utf8")) as Evidence;
};

const saveEvidence = (filePath: string, evidence: Evidence) => {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(evidence, null, 2) + "\n", "utf8");
};

const stripBuffer = (image: ReferenceImage): Omit<ReferenceImage, "buffer"> => {
  const { buffer: _buffer, ...rest } = image;
  return rest;
};

// ── Account loading ───────────────────────────────────────────────────────────

const loadAccount = async (db: PrismaClient) => {
  if (!accountId) {
    console.error("Missing --account=<syncAccountId>. Use --mode=selftest to run without one.");
    process.exit(1);
  }
  const account = await db.syncAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      provider: true,
      label: true,
      baseUrl: true,
      addressBookUrl: true,
      credentialReference: true,
      status: true,
      user: { select: { email: true } },
    },
  });
  if (!account) {
    console.error(`SyncAccount not found: ${accountId}`);
    process.exit(1);
  }
  return account;
};

const requireWriteConfirmation = (account: { label: string; provider: string; user: { email: string | null } }) => {
  console.log("");
  console.log("⚠️  This mode WRITES to the remote provider account:");
  console.log(`    provider: ${account.provider}`);
  console.log(`    label:    ${account.label}`);
  console.log(`    owner:    ${account.user.email ?? "unknown"}`);
  console.log("");
  if (!hasFlag("confirm-test-account")) {
    console.error(
      "Refusing to write. Re-run with --confirm-test-account ONLY if this is a dedicated test account (never a real user's account).",
    );
    process.exit(1);
  }
};

// ── Push ─────────────────────────────────────────────────────────────────────

const pushCardDav = async (
  account: { addressBookUrl: string | null; credentialReference: string | null; id: string },
  images: ReferenceImage[],
): Promise<PushResult[]> => {
  if (!account.addressBookUrl) {
    throw new Error("CardDAV account has no addressBookUrl — run discovery/connect first.");
  }
  if (!account.credentialReference) {
    throw new Error("CardDAV account has no stored credentials.");
  }
  const creds = decryptSyncCredentialPayload(account.credentialReference);
  const collectionUrl = ensureTrailingSlash(account.addressBookUrl);
  const results: PushResult[] = [];

  for (const image of images) {
    const uid = `${UID_PREFIX}-${account.id}-${image.id}`;
    const href = new URL(`${encodeURIComponent(uid)}.vcf`, collectionUrl).toString();
    const body = buildPhotoVCard({ uid, image, flavor: vcardFlavor as 3 | 4 });
    try {
      const response = await putVCard({ href, credentials: creds, body });
      results.push({
        imageId: image.id,
        ok: response.ok,
        httpStatus: response.status,
        error: response.ok ? null : `HTTP ${response.status}`,
        remote: { uid, href, etag: response.etag },
      });
      console.log(
        `  push ${image.id.padEnd(10)} ${response.ok ? "OK " : "FAIL"} HTTP ${response.status} (${Math.round(image.byteLength / 1024)} KB)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        imageId: image.id,
        ok: false,
        httpStatus: null,
        error: message,
        remote: { uid, href },
      });
      console.log(`  push ${image.id.padEnd(10)} ERROR ${message}`);
    }
  }
  return results;
};

const pushGoogle = async (
  db: PrismaClient,
  account: { id: string; credentialReference: string | null },
  images: ReferenceImage[],
): Promise<PushResult[]> => {
  const svc = await getGooglePeopleService(db, account);
  const results: PushResult[] = [];

  for (const image of images) {
    try {
      const created = await svc.people.createContact({
        personFields: "names,metadata",
        requestBody: {
          names: [{ givenName: "P44 Photo QA", familyName: image.id }],
        },
      });
      const resourceName = created.data.resourceName;
      if (!resourceName) throw new Error("createContact returned no resourceName");

      const uploaded = await svc.people.updateContactPhoto({
        resourceName,
        requestBody: {
          photoBytes: image.buffer.toString("base64"),
          personFields: "photos,metadata",
        },
      });
      const photo = pickContactPhoto(uploaded.data.person ?? undefined);
      results.push({
        imageId: image.id,
        ok: true,
        httpStatus: 200,
        error: null,
        remote: { resourceName, photoUrl: photo?.url ?? null },
      });
      console.log(
        `  push ${image.id.padEnd(10)} OK  ${resourceName} (${Math.round(image.byteLength / 1024)} KB)`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status =
        typeof error === "object" && error !== null
          ? (((error as { code?: unknown }).code ??
              (error as { response?: { status?: unknown } }).response?.status) as number | null)
          : null;
      results.push({
        imageId: image.id,
        ok: false,
        httpStatus: typeof status === "number" ? status : null,
        error: message,
        remote: {},
      });
      console.log(`  push ${image.id.padEnd(10)} ERROR ${message}`);
    }
  }
  return results;
};

// ── Pull ─────────────────────────────────────────────────────────────────────

const previousPullSha = (evidence: Evidence, imageId: string): string | null => {
  for (let i = evidence.pulls.length - 1; i >= 0; i -= 1) {
    const result = evidence.pulls[i]!.results.find((entry) => entry.imageId === imageId);
    if (result?.photo?.sha256) return result.photo.sha256;
  }
  return null;
};

const pullCardDav = async (
  account: { credentialReference: string | null },
  evidence: Evidence,
): Promise<PullResult[]> => {
  const creds = decryptSyncCredentialPayload(account.credentialReference!);
  const results: PullResult[] = [];

  for (const pushResult of evidence.push!.results) {
    const reference = evidence.referenceImages.find((image) => image.id === pushResult.imageId)!;
    if (!pushResult.ok || !pushResult.remote.href) {
      results.push({
        imageId: pushResult.imageId,
        found: false,
        error: "not pushed (push failed)",
        photo: null,
        matchesPushedBytes: null,
        matchesPreviousPull: null,
        identifier: {},
        identifierStableWithinRun: null,
        extra: {},
      });
      continue;
    }
    try {
      const first = await getVCard({ href: pushResult.remote.href, credentials: creds });
      if (!first.ok || !first.text) {
        results.push({
          imageId: pushResult.imageId,
          found: false,
          error: `GET HTTP ${first.status}`,
          photo: null,
          matchesPushedBytes: null,
          matchesPreviousPull: null,
          identifier: {},
          identifierStableWithinRun: null,
          extra: {},
        });
        continue;
      }
      const photo = extractVCardPhoto(first.text);
      // Immediate second GET with no writes in between: does the identifier
      // (etag) or the PHOTO value itself drift on a no-op re-pull?
      const second = await getVCard({ href: pushResult.remote.href, credentials: creds });
      const secondPhoto = second.text ? extractVCardPhoto(second.text) : null;
      const identifierStableWithinRun =
        second.ok && first.etag === second.etag && photo?.raw === secondPhoto?.raw;

      let photoStats: ReturnedPhotoStats | null = null;
      let uriFetchStatus: number | null = null;
      let uriFetchAuthed: boolean | null = null;
      if (photo?.bytes) {
        photoStats = await statsForReturnedBytes(photo.bytes, reference.exifMarker);
      } else if (photo?.uri) {
        const fetched = await fetchBytes(photo.uri, creds);
        uriFetchStatus = fetched.status;
        uriFetchAuthed = fetched.authed;
        if (fetched.buffer) {
          photoStats = await statsForReturnedBytes(fetched.buffer, reference.exifMarker);
        }
      }

      const prevSha = previousPullSha(evidence, pushResult.imageId);
      results.push({
        imageId: pushResult.imageId,
        found: Boolean(photo),
        error: photo ? null : "vCard returned without a PHOTO property",
        photo: photoStats,
        matchesPushedBytes: photoStats ? photoStats.sha256 === reference.sha256 : null,
        matchesPreviousPull: photoStats && prevSha ? photoStats.sha256 === prevSha : null,
        identifier: {
          etag: first.etag,
          photoRawSha256: photo ? sha256(Buffer.from(photo.raw, "utf8")) : null,
          photoUri: photo?.uri ?? null,
        },
        identifierStableWithinRun,
        extra: {
          returnedVCardVersion: extractVCardVersion(first.text),
          photoKind: photo?.kind ?? null,
          photoMime: photo?.mime ?? null,
          uriFetchStatus,
          uriFetchAuthed,
        },
      });
    } catch (error) {
      results.push({
        imageId: pushResult.imageId,
        found: false,
        error: error instanceof Error ? error.message : String(error),
        photo: null,
        matchesPushedBytes: null,
        matchesPreviousPull: null,
        identifier: {},
        identifierStableWithinRun: null,
        extra: {},
      });
    }
  }
  return results;
};

const pullGoogle = async (
  db: PrismaClient,
  account: { id: string; credentialReference: string | null },
  evidence: Evidence,
): Promise<PullResult[]> => {
  const svc = await getGooglePeopleService(db, account);
  const results: PullResult[] = [];

  for (const pushResult of evidence.push!.results) {
    const reference = evidence.referenceImages.find((image) => image.id === pushResult.imageId)!;
    if (!pushResult.ok || !pushResult.remote.resourceName) {
      results.push({
        imageId: pushResult.imageId,
        found: false,
        error: "not pushed (push failed)",
        photo: null,
        matchesPushedBytes: null,
        matchesPreviousPull: null,
        identifier: {},
        identifierStableWithinRun: null,
        extra: {},
      });
      continue;
    }
    try {
      const resourceName = pushResult.remote.resourceName;
      const first = await svc.people.get({ resourceName, personFields: "photos,metadata" });
      const photo = pickContactPhoto(first.data);
      // Second no-op read: does the photo URL / person etag drift between
      // reads with no writes?
      const second = await svc.people.get({ resourceName, personFields: "photos,metadata" });
      const secondPhoto = pickContactPhoto(second.data);
      const identifierStableWithinRun =
        Boolean(photo?.url) &&
        photo?.url === secondPhoto?.url &&
        first.data.etag === second.data.etag;

      let photoStats: ReturnedPhotoStats | null = null;
      let defaultUrlDims: string | null = null;
      let fetchedVariant: string | null = null;
      if (photo?.url) {
        // The stored rendition (`=s0`) is what change detection would hash;
        // also record the default-URL rendition's dimensions for the doc.
        const original = await fetchBytes(`${googlePhotoUrlBase(photo.url)}=s0`);
        const fallback = original.buffer ? null : await fetchBytes(photo.url);
        const buffer = original.buffer ?? fallback?.buffer ?? null;
        fetchedVariant = original.buffer ? "s0" : fallback?.buffer ? "default-url" : null;
        if (buffer) {
          photoStats = await statsForReturnedBytes(buffer, reference.exifMarker);
        }
        const asIs = await fetchBytes(photo.url);
        if (asIs.buffer) {
          const asIsStats = await statsForReturnedBytes(asIs.buffer, reference.exifMarker);
          defaultUrlDims = `${asIsStats.width}x${asIsStats.height} ${asIsStats.format}`;
        }
      }

      const prevSha = previousPullSha(evidence, pushResult.imageId);
      results.push({
        imageId: pushResult.imageId,
        found: Boolean(photo?.url),
        error: photo?.url ? null : "person has no non-default photo",
        photo: photoStats,
        matchesPushedBytes: photoStats ? photoStats.sha256 === reference.sha256 : null,
        matchesPreviousPull: photoStats && prevSha ? photoStats.sha256 === prevSha : null,
        identifier: {
          personEtag: first.data.etag ?? null,
          photoUrl: photo?.url ?? null,
          photoUrlBase: photo?.url ? googlePhotoUrlBase(photo.url) : null,
          photoSourceId: photo?.metadata?.source?.id ?? null,
        },
        identifierStableWithinRun,
        extra: { defaultUrlDims, fetchedVariant },
      });
    } catch (error) {
      results.push({
        imageId: pushResult.imageId,
        found: false,
        error: error instanceof Error ? error.message : String(error),
        photo: null,
        matchesPushedBytes: null,
        matchesPreviousPull: null,
        identifier: {},
        identifierStableWithinRun: null,
        extra: {},
      });
    }
  }
  return results;
};

// ── Cleanup ──────────────────────────────────────────────────────────────────

const cleanupRemote = async (
  db: PrismaClient,
  account: { id: string; provider: string; credentialReference: string | null },
  evidence: Evidence,
) => {
  const results: { imageId: string; ok: boolean; error: string | null }[] = [];
  if (!evidence.push) return results;

  if (account.provider === "GOOGLE") {
    const svc = await getGooglePeopleService(db, account);
    for (const pushResult of evidence.push.results) {
      if (!pushResult.remote.resourceName) continue;
      try {
        await svc.people.deleteContact({ resourceName: pushResult.remote.resourceName });
        results.push({ imageId: pushResult.imageId, ok: true, error: null });
        console.log(`  delete ${pushResult.imageId.padEnd(10)} OK`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const alreadyGone = /404|not found/i.test(message);
        results.push({ imageId: pushResult.imageId, ok: alreadyGone, error: alreadyGone ? null : message });
        console.log(`  delete ${pushResult.imageId.padEnd(10)} ${alreadyGone ? "OK (already gone)" : `ERROR ${message}`}`);
      }
    }
    return results;
  }

  const creds = decryptSyncCredentialPayload(account.credentialReference!);
  for (const pushResult of evidence.push.results) {
    if (!pushResult.remote.href) continue;
    try {
      const response = await deleteVCard({ href: pushResult.remote.href, credentials: creds });
      results.push({
        imageId: pushResult.imageId,
        ok: response.ok,
        error: response.ok ? null : `HTTP ${response.status}`,
      });
      console.log(`  delete ${pushResult.imageId.padEnd(10)} ${response.ok ? "OK" : `FAIL HTTP ${response.status}`}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ imageId: pushResult.imageId, ok: false, error: message });
      console.log(`  delete ${pushResult.imageId.padEnd(10)} ERROR ${message}`);
    }
  }
  return results;
};

// ── Report rendering ─────────────────────────────────────────────────────────

const yesNo = (value: boolean | null | undefined) =>
  value === true ? "yes" : value === false ? "no" : "—";

const kb = (bytes: number | null | undefined) =>
  bytes == null ? "—" : `${Math.round(bytes / 1024)} KB`;

const renderReport = (evidence: Evidence): string => {
  const lines: string[] = [];
  const providerTitle =
    evidence.providerKey === "google"
      ? "Google (People API)"
      : evidence.providerKey === "carddav-icloud"
        ? "iCloud (CardDAV)"
        : `${evidence.account.baseUrl} (CardDAV)`;

  lines.push(`# Photo capability — ${providerTitle}`);
  lines.push("");
  lines.push("> Generated by `scripts/phase44-photo-roundtrip-harness.ts` (P44-01).");
  lines.push(`> Evidence: \`docs/photo-capability/${path.basename(evidencePathFor(evidence.providerKey, evidence.account.id))}\``);
  lines.push(`> Account: ${evidence.account.label} · vCard flavor pushed: ${evidence.vcardFlavor}.0 (CardDAV only)`);
  lines.push("");

  lines.push("## Reference set");
  lines.push("");
  lines.push("| Image | Format | Dimensions | Size | SHA-256 (8) |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const image of evidence.referenceImages) {
    lines.push(
      `| ${image.id} | ${image.format} | ${image.width ?? "?"}×${image.height ?? "?"} | ${kb(image.byteLength)} | \`${image.sha256.slice(0, 8)}\` |`,
    );
  }
  lines.push("");

  if (evidence.push) {
    lines.push(`## Push acceptance (${evidence.push.at})`);
    lines.push("");
    lines.push("| Image | Accepted | HTTP | Error |");
    lines.push("| --- | --- | --- | --- |");
    for (const result of evidence.push.results) {
      lines.push(
        `| ${result.imageId} | ${yesNo(result.ok)} | ${result.httpStatus ?? "—"} | ${result.error ?? "—"} |`,
      );
    }
    lines.push("");
  }

  for (const pull of evidence.pulls) {
    lines.push(`## Pull — ${pull.label} (${pull.at})`);
    lines.push("");
    lines.push(
      "| Image | Found | Returned format | Returned dims | Size | Bytes == pushed | EXIF marker | == previous pull | Identifier stable (no-op re-pull) |",
    );
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const result of pull.results) {
      const dims =
        result.photo?.width != null ? `${result.photo.width}×${result.photo.height}` : "—";
      lines.push(
        `| ${result.imageId} | ${yesNo(result.found)} | ${result.photo?.format ?? "—"} | ${dims} | ${kb(result.photo?.byteLength)} | ${yesNo(result.matchesPushedBytes)} | ${yesNo(result.photo?.exifMarkerSurvived)} | ${yesNo(result.matchesPreviousPull)} | ${yesNo(result.identifierStableWithinRun)} |`,
      );
    }
    lines.push("");
  }

  // Auto-derived capability summary — the answers P44-02 needs.
  lines.push("## Capability summary (auto-derived)");
  lines.push("");
  const lastPull = evidence.pulls[evidence.pulls.length - 1];
  const acceptedFormats = new Set<string>();
  let maxAcceptedBytes = 0;
  let minRejectedBytes: number | null = null;
  let anyRejected = false;
  for (const result of evidence.push?.results ?? []) {
    const reference = evidence.referenceImages.find((image) => image.id === result.imageId)!;
    if (result.ok) {
      acceptedFormats.add(reference.format);
      maxAcceptedBytes = Math.max(maxAcceptedBytes, reference.byteLength);
    } else {
      anyRejected = true;
      minRejectedBytes = Math.min(minRejectedBytes ?? Infinity, reference.byteLength);
    }
  }
  const bytesStable = lastPull
    ? lastPull.results.filter((entry) => entry.matchesPushedBytes === true).length
    : 0;
  const bytesTotal = lastPull
    ? lastPull.results.filter((entry) => entry.matchesPushedBytes !== null).length
    : 0;
  const squared = lastPull
    ? lastPull.results.some((entry) => {
        const reference = evidence.referenceImages.find((image) => image.id === entry.imageId);
        return (
          entry.photo?.width != null &&
          entry.photo.width === entry.photo.height &&
          reference?.width !== reference?.height
        );
      })
    : false;
  const exifSurvived = lastPull
    ? lastPull.results.filter((entry) => entry.photo?.exifMarkerSurvived === true).length
    : 0;
  const identifierStable = lastPull
    ? lastPull.results.every((entry) => entry.identifierStableWithinRun !== false)
    : null;
  const crossPullComparisons = lastPull
    ? lastPull.results.filter((entry) => entry.matchesPreviousPull !== null)
    : [];
  const asyncReprocess =
    crossPullComparisons.length > 0
      ? crossPullComparisons.some((entry) => entry.matchesPreviousPull === false)
      : null;

  lines.push(`- **Formats accepted:** ${[...acceptedFormats].join(", ") || "none recorded"}${anyRejected ? " (some pushes rejected — see acceptance table)" : ""}`);
  lines.push(
    `- **Largest accepted upload:** ${kb(maxAcceptedBytes)}${minRejectedBytes != null ? ` (smallest rejected probe: ${kb(minRejectedBytes)} — the cap lies between)` : ""}`,
  );
  lines.push(`- **Bytes stable through round-trip:** ${bytesTotal ? `${bytesStable}/${bytesTotal} images returned byte-identical` : "no pull recorded"}`);
  lines.push(`- **Crops to square:** ${squared ? "YES — returned images are square from non-square input" : "not observed"}`);
  lines.push(`- **EXIF survives:** ${bytesTotal ? `${exifSurvived}/${bytesTotal} images kept the EXIF marker` : "no pull recorded"}`);
  lines.push(`- **Identifier stable on no-op re-pull:** ${identifierStable == null ? "no pull recorded" : identifierStable ? "yes" : "NO — identifier drifts without writes (unusable for change detection as-is)"}`);
  lines.push(
    `- **Async re-processing (bytes changed between pulls):** ${asyncReprocess == null ? "unknown — run a second pull ≥24h after push (`--mode=pull --label=24h`)" : asyncReprocess ? "YES — provider re-processed after initial pull" : "not observed between recorded pulls"}`,
  );
  lines.push("");
  lines.push("## Reviewer notes");
  lines.push("");
  lines.push("<!-- Human analysis: which identifier should P44-02 use for change");
  lines.push("detection on this provider, size caps to apply on outbound push,");
  lines.push("any anomalies in the tables above. -->");
  lines.push("");
  return lines.join("\n");
};

// ── Modes ────────────────────────────────────────────────────────────────────

const printImageTable = (images: ReferenceImage[]) => {
  console.log("Reference image set:");
  for (const image of images) {
    console.log(
      `  ${image.id.padEnd(10)} ${image.format.padEnd(5)} ${String(image.width ?? "?").padStart(4)}×${String(image.height ?? "?").padEnd(5)} ${kb(image.byteLength).padStart(8)}  sha=${image.sha256.slice(0, 12)}`,
    );
  }
};

const runSelftest = async () => {
  const images = await generateReferenceSet();
  printImageTable(images);
  console.log("");

  let failures = 0;
  const check = (label: string, ok: boolean) => {
    console.log(`  ${ok ? "PASS" : "FAIL"} ${label}`);
    if (!ok) failures += 1;
  };

  const large = images.find((image) => image.id === "jpeg-large")!;
  check("jpeg-large exceeds 1 MB", large.byteLength > 1_048_576);

  for (const image of images) {
    if (image.format === "heic") continue;
    const meta = await sharp(image.buffer).metadata();
    check(
      `${image.id} EXIF marker embedded`,
      Boolean(meta.exif?.includes(image.exifMarker)),
    );
    for (const flavor of [3, 4] as const) {
      const vcard = buildPhotoVCard({ uid: `${UID_PREFIX}-selftest-${image.id}`, image, flavor });
      check(
        `${image.id} v${flavor} folded lines ≤ 76 chars`,
        vcard.split("\r\n").every((line) => line.length <= 76),
      );
      const extracted = extractVCardPhoto(vcard);
      check(
        `${image.id} v${flavor} PHOTO round-trips byte-identical`,
        Boolean(extracted?.bytes && sha256(extracted.bytes) === image.sha256),
      );
    }
  }

  // Deterministic regeneration: the same spec must produce identical bytes.
  const regenerated = await generateReferenceImage(REFERENCE_SPECS[1]!);
  check(
    "reference generation is deterministic",
    regenerated.sha256 === images.find((image) => image.id === regenerated.id)!.sha256,
  );

  console.log("");
  if (failures > 0) {
    console.log(`Selftest FAILED (${failures} check(s)).`);
    process.exitCode = 1;
  } else {
    console.log("Selftest passed.");
  }
};

const main = async () => {
  if (mode === "images") {
    printImageTable(await generateReferenceSet());
    return;
  }
  if (mode === "selftest") {
    await runSelftest();
    return;
  }

  const db = new PrismaClient();
  try {
    const account = await loadAccount(db);
    const providerKey = providerKeyFor(account.provider, account.baseUrl);
    const evidencePath = evidencePathFor(providerKey, account.id);
    let evidence = loadEvidence(evidencePath);

    if (account.provider === "MICROSOFT") {
      console.error(
        "MICROSOFT is out of P44-01 scope (Google + iCloud CardDAV + generic CardDAV). Graph photo endpoints get their own pass later.",
      );
      process.exit(1);
    }

    if (mode === "status") {
      const summary = {
        account: {
          id: account.id,
          provider: account.provider,
          label: account.label,
          status: account.status,
          owner: account.user.email,
        },
        providerKey,
        evidencePath,
        pushed: evidence?.push ? evidence.push.results.filter((entry) => entry.ok).length : 0,
        pulls: evidence?.pulls.map((pull) => ({ label: pull.label, at: pull.at })) ?? [],
        cleanedUp: Boolean(evidence?.cleanup),
      };
      if (jsonOutput) {
        console.log(JSON.stringify(summary, null, 2));
        return;
      }
      console.log(`Account:   ${summary.account.label} (${summary.account.provider}, ${summary.account.status})`);
      console.log(`Owner:     ${summary.account.owner ?? "unknown"}`);
      console.log(`Provider:  ${providerKey}`);
      console.log(`Evidence:  ${evidencePath}${existsSync(evidencePath) ? "" : " (none yet)"}`);
      if (evidence) {
        console.log(`Pushed:    ${summary.pushed} image(s)`);
        console.log(`Pulls:     ${summary.pulls.map((pull) => pull.label).join(", ") || "none"}`);
        console.log(`Cleanup:   ${summary.cleanedUp ? "done" : "not run"}`);
      }
      return;
    }

    if (mode === "push") {
      requireWriteConfirmation(account);
      if (evidence?.push && !hasFlag("force")) {
        console.error(
          `Evidence at ${evidencePath} already has a push run. Run --mode=cleanup first (or --force to overwrite — on Google this creates duplicate test contacts).`,
        );
        process.exit(1);
      }
      const images = await generateReferenceSet();
      printImageTable(images);
      console.log("");
      console.log(`Pushing to ${account.provider} (${account.label})…`);

      const pushResults =
        account.provider === "GOOGLE"
          ? await pushGoogle(db, account, images)
          : await pushCardDav(account, images);

      evidence = {
        harness: "phase44-photo-roundtrip",
        version: 1,
        account: {
          id: account.id,
          provider: account.provider,
          label: account.label,
          baseUrl: account.baseUrl,
          addressBookUrl: account.addressBookUrl,
          userEmail: account.user.email,
        },
        providerKey,
        vcardFlavor: vcardFlavor as 3 | 4,
        referenceImages: images.map(stripBuffer),
        push: { at: new Date().toISOString(), results: pushResults },
        pulls: [],
        cleanup: null,
      };
      saveEvidence(evidencePath, evidence);

      // First pull immediately — the "initial" observation the 24h pull is
      // later compared against.
      console.log("");
      console.log("Initial pull…");
      const pullResults =
        account.provider === "GOOGLE"
          ? await pullGoogle(db, account, evidence)
          : await pullCardDav(account, evidence);
      evidence.pulls.push({ label: "initial", at: new Date().toISOString(), results: pullResults });
      saveEvidence(evidencePath, evidence);

      for (const result of pullResults) {
        console.log(
          `  pull ${result.imageId.padEnd(10)} ${result.found ? "OK " : "MISS"} bytes==pushed:${yesNo(result.matchesPushedBytes)} dims:${result.photo?.width ?? "?"}×${result.photo?.height ?? "?"} fmt:${result.photo?.format ?? "?"} exif:${yesNo(result.photo?.exifMarkerSurvived)}`,
        );
      }
      console.log("");
      console.log(`Evidence written: ${evidencePath}`);
      console.log("Re-pull in ≥24h with:  --mode=pull --label=24h   (some providers re-process asynchronously)");
      return;
    }

    if (mode === "pull") {
      if (!evidence?.push) {
        console.error(`No push run recorded in ${evidencePath} — run --mode=push first.`);
        process.exit(1);
      }
      const label = runLabel ?? `pull-${evidence.pulls.length + 1}`;
      console.log(`Pulling (${label}) from ${account.provider} (${account.label})…`);
      const pullResults =
        account.provider === "GOOGLE"
          ? await pullGoogle(db, account, evidence)
          : await pullCardDav(account, evidence);
      evidence.pulls.push({ label, at: new Date().toISOString(), results: pullResults });
      saveEvidence(evidencePath, evidence);

      for (const result of pullResults) {
        console.log(
          `  pull ${result.imageId.padEnd(10)} ${result.found ? "OK " : "MISS"} bytes==pushed:${yesNo(result.matchesPushedBytes)} ==prev-pull:${yesNo(result.matchesPreviousPull)} dims:${result.photo?.width ?? "?"}×${result.photo?.height ?? "?"} fmt:${result.photo?.format ?? "?"} exif:${yesNo(result.photo?.exifMarkerSurvived)} id-stable:${yesNo(result.identifierStableWithinRun)}`,
        );
      }
      console.log("");
      console.log(`Evidence updated: ${evidencePath}`);
      return;
    }

    if (mode === "cleanup") {
      requireWriteConfirmation(account);
      if (!evidence?.push) {
        console.error(`No push run recorded in ${evidencePath} — nothing to clean up.`);
        process.exit(1);
      }
      console.log(`Deleting harness test contacts from ${account.provider} (${account.label})…`);
      const results = await cleanupRemote(db, account, evidence);
      evidence.cleanup = { at: new Date().toISOString(), results };
      saveEvidence(evidencePath, evidence);
      const failed = results.filter((entry) => !entry.ok);
      console.log("");
      console.log(
        failed.length === 0
          ? "All harness contacts deleted."
          : `${failed.length} deletion(s) failed — re-run cleanup or remove manually.`,
      );
      return;
    }

    if (mode === "report") {
      if (!evidence) {
        console.error(`No evidence at ${evidencePath} — run --mode=push first.`);
        process.exit(1);
      }
      const reportPath = path.join(evidenceDir, `${providerKey}.md`);
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(reportPath, renderReport(evidence), "utf8");
      console.log(`Capability doc written: ${reportPath}`);
      if (evidence.pulls.length < 2) {
        console.log(
          "Note: only one pull recorded — the async-reprocessing question needs a second pull ≥24h after push.",
        );
      }
      return;
    }

    console.error(`Unknown mode: ${mode} (expected status|images|selftest|push|pull|cleanup|report)`);
    process.exit(1);
  } finally {
    await db.$disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

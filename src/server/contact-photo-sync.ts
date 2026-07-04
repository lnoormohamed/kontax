// P44-03/04 — contact photo sync core.
//
// One module for both directions. It owns: normalization (re-encode to a
// canonical form, cap dimensions, strip EXIF for privacy), MinIO storage under
// the existing P38-08 avatar key convention (so thumbnails render through the
// same path — no second pipeline), the per-link photo shadow, and the pure
// change-detection decision table from docs/adr/0001.
//
// The decision table and the shadow helpers are provider-agnostic; the runner
// feeds them a `RemotePhotoState` extracted per provider (Google photo resource
// identifier vs CardDAV decoded-PHOTO content hash — ADR §3.3).

import { createHash } from "crypto";
import { createId } from "@paralleldrive/cuid2";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { getAvatarThumbUrl } from "~/lib/avatar-thumb";

// ── Canonical form ─────────────────────────────────────────────────────────
// A single normalization serves both storage and outbound push: 1024px-capped
// JPEG stays comfortably under every P44-01 provider cap (iCloud rejects >1MB;
// a 1024 q82 JPEG is ~100–300KB) and re-encodes deterministically, minimizing
// the echo surface. EXIF is stripped by sharp's default (metadata not copied).
const CANONICAL_MAX_DIM = 1024;
const CANONICAL_QUALITY = 82;
const THUMB_SIZE = 96; // matches src/app/api/upload/avatar/route.ts (P38-08)

export type NormalizedPhoto = {
  bytes: Buffer;
  sha256: string;
  width: number | null;
  height: number | null;
  ext: "jpg";
  mediaType: "image/jpeg";
};

export const hashBytes = (bytes: Buffer): string =>
  createHash("sha256").update(bytes).digest("hex");

/**
 * Re-encode to the canonical form. Returns null if the bytes are not a decodable
 * image (a corrupt or unsupported payload must never crash a sync run).
 */
export async function normalizeContactPhoto(bytes: Buffer): Promise<NormalizedPhoto | null> {
  try {
    const out = await sharp(bytes)
      .rotate() // bake in EXIF orientation before we drop EXIF
      .resize(CANONICAL_MAX_DIM, CANONICAL_MAX_DIM, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: CANONICAL_QUALITY })
      .toBuffer({ resolveWithObject: true });
    return {
      bytes: out.data,
      sha256: hashBytes(out.data),
      width: out.info.width ?? null,
      height: out.info.height ?? null,
      ext: "jpg",
      mediaType: "image/jpeg",
    };
  } catch (error) {
    console.warn("[Kontax] contact photo normalize failed — skipping photo", error);
    return null;
  }
}

// ── MinIO storage ──────────────────────────────────────────────────────────
function getS3(): S3Client | null {
  if (!process.env.MINIO_ENDPOINT) return null;
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT,
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });
}

const bucket = () => process.env.MINIO_BUCKET ?? "kontax-uploads";

/** Extract our object key from an avatar URL when it points at our storage. */
const avatarKeyFromUrl = (url: string): string | null =>
  /\/(avatars\/[^?]+)/.exec(url)?.[1] ?? null;

const streamToBuffer = async (body: unknown): Promise<Buffer> => {
  if (body instanceof Buffer) return body;
  if (body && typeof (body as { transformToByteArray?: unknown }).transformToByteArray === "function") {
    const arr = await (body as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
    return Buffer.from(arr);
  }
  throw new Error("Unsupported S3 body stream");
};

/**
 * Store a normalized photo for a contact under the P38-08 key convention
 * (`avatars/<contactId>/<cuid>.jpg` + a `-thumb.webp` sibling) so existing
 * renderers and `getAvatarThumbUrl` work unchanged. Returns the public URL, or
 * null when MinIO is not configured (dev without storage — the sync run simply
 * leaves `avatarUrl` untouched).
 */
export async function storeContactPhoto(
  contactId: string,
  normalized: NormalizedPhoto,
): Promise<string | null> {
  const s3 = getS3();
  if (!s3) {
    console.warn("[Kontax] MINIO_ENDPOINT not configured — inbound contact photo not stored");
    return null;
  }
  const key = `avatars/${contactId}/${createId()}.${normalized.ext}`;

  let thumb: Buffer | null = null;
  try {
    thumb = await sharp(normalized.bytes)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    console.warn("[Kontax] contact photo thumbnail failed — serving original only", error);
  }

  await Promise.all([
    s3.send(new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      Body: normalized.bytes,
      ContentType: normalized.mediaType,
    })),
    thumb
      ? s3.send(new PutObjectCommand({
          Bucket: bucket(),
          Key: key.replace(/\.[a-z0-9]+$/i, "-thumb.webp"),
          Body: thumb,
          ContentType: "image/webp",
        }))
      : Promise.resolve(),
  ]);

  return `${process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT}/${key}`;
}

/** Best-effort removal of a previously-synced photo (+ its thumb). Never throws. */
export async function deleteContactPhoto(avatarUrl: string): Promise<void> {
  const s3 = getS3();
  const key = avatarKeyFromUrl(avatarUrl);
  if (!s3 || !key) return;
  const thumbKey = key.replace(/\.[a-z0-9]+$/i, "-thumb.webp");
  await Promise.allSettled([
    s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })),
    s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: thumbKey })),
  ]);
}

/**
 * Load the canonical bytes behind an `avatarUrl` for hashing / outbound push.
 * Fetches from MinIO when the URL is ours, else over HTTP (pasted external URL).
 * Returns null on any failure — callers treat "can't load" as "no local photo".
 */
export async function loadAvatarBytes(avatarUrl: string): Promise<Buffer | null> {
  try {
    const key = avatarKeyFromUrl(avatarUrl);
    const s3 = getS3();
    if (key && s3) {
      const res = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      return await streamToBuffer(res.Body);
    }
    const res = await fetch(avatarUrl);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch (error) {
    console.warn("[Kontax] failed to load avatar bytes", error);
    return null;
  }
}

// ── Photo shadow (docs/adr/0001 §3.4) ────────────────────────────────────────
export type PhotoSignalKind = "resourceIdentifier" | "contentHash";

export type PhotoShadow = {
  /** Which signal is authoritative for this provider (from the capability registry). */
  signalKind: PhotoSignalKind;
  /** Google: photo resource token. CardDAV: sha256 of decoded PHOTO bytes. null = provider held no photo. */
  remoteSignal: string | null;
  /** sha256 of the bytes the provider returned after our last push/pull (diagnostic + Google tie-breaker). */
  remoteCanonicalHash: string | null;
  /** The avatarUrl we last reconciled — a cheap local-change gate (string compare, no fetch). */
  localAvatarUrl: string | null;
  /** sha256 of the canonical local image last reconciled. */
  localPhotoHash: string | null;
  lastSyncedRemoteAt: string | null;
  /** Latched when a push is rejected (e.g. iCloud >1MB → 403) so we don't retry every cycle. */
  lastPushRejected: boolean;
};

/** Parse an untyped JSON shadow (Prisma `Json?`) into a PhotoShadow, or null. */
export function parsePhotoShadow(raw: unknown): PhotoShadow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const kind = r.signalKind;
  if (kind !== "resourceIdentifier" && kind !== "contentHash") return null;
  return {
    signalKind: kind,
    remoteSignal: typeof r.remoteSignal === "string" ? r.remoteSignal : null,
    remoteCanonicalHash: typeof r.remoteCanonicalHash === "string" ? r.remoteCanonicalHash : null,
    localAvatarUrl: typeof r.localAvatarUrl === "string" ? r.localAvatarUrl : null,
    localPhotoHash: typeof r.localPhotoHash === "string" ? r.localPhotoHash : null,
    lastSyncedRemoteAt: typeof r.lastSyncedRemoteAt === "string" ? r.lastSyncedRemoteAt : null,
    lastPushRejected: r.lastPushRejected === true,
  };
}

// ── Change detection & decision table (docs/adr/0001 §4) ─────────────────────
/** What the provider currently holds for this contact's photo. */
export type RemotePhotoState = {
  hasPhoto: boolean;
  /** Provider-appropriate signal for the current remote photo (per signalKind). */
  signal: string | null;
};

/** Per-side change classification against the shadow. */
export type SideChange = "absent" | "same" | "changed" | "deleted";

export type PhotoAction =
  | "noop"
  | "pull"
  | "pull-delete"
  | "push"
  | "push-delete"
  | "conflict";

/** Classify the local side: current avatarUrl/hash vs the shadow. */
export function classifyLocal(
  hasLocalPhoto: boolean,
  localMatchesShadow: boolean,
  shadowHadLocalPhoto: boolean,
): SideChange {
  if (hasLocalPhoto) return localMatchesShadow ? "same" : "changed";
  return shadowHadLocalPhoto ? "deleted" : "absent";
}

/** Classify the remote side: current provider signal vs the shadow. */
export function classifyRemote(
  remote: RemotePhotoState,
  shadow: PhotoShadow | null,
): SideChange {
  const shadowHadRemote = Boolean(shadow?.remoteSignal);
  if (remote.hasPhoto) {
    if (shadow && remote.signal != null && remote.signal === shadow.remoteSignal) return "same";
    return "changed";
  }
  return shadowHadRemote ? "deleted" : "absent";
}

// 4×4 table — rows local, cols remote. See docs/adr/0001 §4.
const DECISION: Record<SideChange, Record<SideChange, PhotoAction>> = {
  absent: { absent: "noop", same: "noop", changed: "pull", deleted: "noop" },
  same: { absent: "noop", same: "noop", changed: "pull", deleted: "pull-delete" },
  changed: { absent: "push", same: "push", changed: "conflict", deleted: "conflict" },
  deleted: { absent: "noop", same: "push-delete", changed: "conflict", deleted: "noop" },
};

export type SyncCapability = { canPull: boolean; canPush: boolean };

/**
 * The pure decision: given the classified sides and what this run is allowed to
 * do (syncDirection / photo-excluded already folded into `cap`), return the
 * action. A write the direction disallows degrades to noop; conflicts always
 * surface (they are recorded, not written). Photo-excluded callers pass
 * `{canPull:false, canPush:false}` → always noop.
 */
export function decidePhotoAction(
  local: SideChange,
  remote: SideChange,
  cap: SyncCapability,
): PhotoAction {
  const action = DECISION[local][remote];
  if ((action === "pull" || action === "pull-delete") && !cap.canPull) return "noop";
  if ((action === "push" || action === "push-delete") && !cap.canPush) return "noop";
  return action;
}

// ── Reconciliation (provider-agnostic) ───────────────────────────────────────
/** The provider-canonical copy a push settles on, used to seed the shadow. */
export type PushSeed = {
  remoteSignal: string | null;
  remoteCanonicalHash: string | null;
  /** New provider etag if the push changed it (CardDAV card PUT / Google photo update). */
  remoteETag?: string | null;
};

export type PhotoReconcileInput = {
  contactId: string;
  avatarUrl: string | null;
  shadow: PhotoShadow | null;
  signalKind: PhotoSignalKind;
  remote: RemotePhotoState;
  cap: SyncCapability;
  /** Fetch the remote photo bytes (for a pull). Provider-specific. */
  loadRemoteBytes: () => Promise<Buffer | null>;
  /** Push the canonical JPEG and read back the provider copy → seed. Provider-specific. */
  pushCanonical: (jpegBase64: string) => Promise<PushSeed>;
  /** Remove the remote photo. Provider-specific. */
  deleteRemote: () => Promise<void>;
};

export type PhotoReconcileResult = {
  action: PhotoAction;
  /** New avatarUrl when it changed (pull → url, pull-delete → null). undefined = unchanged. */
  avatarUrl?: string | null;
  /** New shadow to persist (null = clear the shadow). undefined = leave shadow untouched. */
  shadow?: PhotoShadow | null;
  /** New provider etag to write to the link, when a push/delete changed it. */
  remoteETag?: string | null;
  activity: "pulled" | "deleted-local" | "pushed" | "deleted-remote" | null;
  conflict: boolean;
};

const NOOP = (action: PhotoAction): PhotoReconcileResult => ({ action, activity: null, conflict: false });

/**
 * Run the full change-detection → action for one link. Pure except for the
 * injected provider closures + MinIO I/O; never throws (provider/storage
 * failures degrade to noop and are logged), so one bad photo can't fail a sync.
 */
export async function reconcileContactPhoto(input: PhotoReconcileInput): Promise<PhotoReconcileResult> {
  const { contactId, avatarUrl, shadow, signalKind, remote, cap } = input;

  // Classify local. The common no-op path is a pure string compare (no fetch).
  const hasLocalPhoto = avatarUrl != null;
  const shadowHadLocalPhoto = Boolean(shadow?.localPhotoHash);
  let canonicalLocal: NormalizedPhoto | null = null;
  let localMatchesShadow = false;
  if (hasLocalPhoto) {
    if (shadow && avatarUrl === shadow.localAvatarUrl) {
      localMatchesShadow = true;
    } else {
      const bytes = await loadAvatarBytesSafe(avatarUrl);
      canonicalLocal = bytes ? await normalizeContactPhoto(bytes) : null;
      if (!canonicalLocal) return NOOP("noop"); // avatarUrl set but unreadable — don't reason
      localMatchesShadow = canonicalLocal.sha256 === shadow?.localPhotoHash;
    }
  }
  const local = classifyLocal(hasLocalPhoto, localMatchesShadow, shadowHadLocalPhoto);
  const remoteState = classifyRemote(remote, shadow);
  const action = decidePhotoAction(local, remoteState, cap);

  try {
    switch (action) {
      case "noop":
        return NOOP("noop");

      case "conflict":
        return { action, activity: null, conflict: true };

      case "pull": {
        const raw = await input.loadRemoteBytes();
        const normalized = raw ? await normalizeContactPhoto(raw) : null;
        if (!raw || !normalized) return NOOP("noop");
        const url = await storeContactPhoto(contactId, normalized);
        if (!url) return NOOP("noop"); // no storage — leave avatarUrl untouched
        if (avatarUrl) void deleteContactPhoto(avatarUrl); // best-effort cleanup of prior ours
        return {
          action,
          avatarUrl: url,
          shadow: {
            signalKind,
            remoteSignal: remote.signal,
            remoteCanonicalHash: hashBytes(raw),
            localAvatarUrl: url,
            localPhotoHash: normalized.sha256,
            lastSyncedRemoteAt: null,
            lastPushRejected: false,
          },
          activity: "pulled",
          conflict: false,
        };
      }

      case "pull-delete": {
        if (avatarUrl) void deleteContactPhoto(avatarUrl);
        return { action, avatarUrl: null, shadow: null, activity: "deleted-local", conflict: false };
      }

      case "push": {
        if (!canonicalLocal) return NOOP("noop"); // defensive — push implies a changed local photo
        let seed: PushSeed;
        try {
          seed = await input.pushCanonical(canonicalLocal.bytes.toString("base64"));
        } catch (error) {
          console.warn("[Kontax] contact photo push rejected — latching to avoid retry loop", error);
          return {
            action,
            shadow: {
              signalKind,
              remoteSignal: shadow?.remoteSignal ?? null,
              remoteCanonicalHash: shadow?.remoteCanonicalHash ?? null,
              localAvatarUrl: avatarUrl,
              localPhotoHash: canonicalLocal.sha256,
              lastSyncedRemoteAt: shadow?.lastSyncedRemoteAt ?? null,
              lastPushRejected: true,
            },
            activity: null,
            conflict: false,
          };
        }
        return {
          action,
          shadow: {
            signalKind,
            remoteSignal: seed.remoteSignal,
            remoteCanonicalHash: seed.remoteCanonicalHash,
            localAvatarUrl: avatarUrl,
            localPhotoHash: canonicalLocal.sha256,
            lastSyncedRemoteAt: null,
            lastPushRejected: false,
          },
          remoteETag: seed.remoteETag,
          activity: "pushed",
          conflict: false,
        };
      }

      case "push-delete": {
        await input.deleteRemote();
        return { action, shadow: null, activity: "deleted-remote", conflict: false };
      }
    }
  } catch (error) {
    console.warn(`[Kontax] contact photo ${action} failed for ${contactId} — skipping`, error);
    return NOOP("noop");
  }
}

const loadAvatarBytesSafe = async (url: string | null): Promise<Buffer | null> =>
  url ? loadAvatarBytes(url) : null;

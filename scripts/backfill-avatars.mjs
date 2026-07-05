#!/usr/bin/env node
/**
 * P46-DB02 / P46-03 — one-off avatar storage backfill (two jobs, one script).
 *
 * Job 1 — re-normalize raw originals:
 *   Scan the MinIO `avatars/` prefix for canonical objects whose bytes are NOT
 *   in our canonical form (extension is not `.jpg`, OR the image is oversized
 *   (>1024px on a side), OR it still carries EXIF metadata). For each, download,
 *   re-encode to the canonical form (sharp: rotate → resize 1024 inside/no-enlarge
 *   → jpeg q82), overwrite the object, and regenerate its `-thumb.webp` sibling
 *   (96×96 cover webp q80). `-thumb.webp` siblings are themselves skipped in this
 *   job — they are regenerated from their parent, never treated as originals.
 *
 * Job 2 — sweep orphaned objects:
 *   List every `avatars/` object and delete those not referenced by any
 *   `Contact.avatarUrl` or `User.avatarUrl`. Referencing is matched on the
 *   `avatars/<owner>/<cuid>` path portion, ignoring the `-thumb` suffix and the
 *   extension, so an object and its thumb live or die with their DB reference.
 *
 * ── KEY-STABILITY CHOICE (read before touching Job 1) ────────────────────────
 * A canonical key looks like `avatars/<ownerId>/<cuid>.<ext>`, and that key is
 * baked verbatim into `avatarUrl` values in the DB. If Job 1 renamed a `.png`
 * original to `.jpg` we would have to rewrite every referencing `avatarUrl` row
 * in lock-step (and risk a torn state if the run dies mid-way). To avoid that,
 * Job 1 KEEPS THE ORIGINAL KEY AND EXTENSION and overwrites its BYTES with the
 * normalized JPEG payload, setting ContentType `image/jpeg`. So a
 * `…/<cuid>.png` object may afterwards hold JPEG bytes — intentional: the URL /
 * key never changes, so no DB write is needed and the job stays purely a storage
 * operation. Renderers serve by URL and sniff content, so the stale `.png`
 * extension is cosmetic.
 *
 * ── SAFETY (repo standing note) ──────────────────────────────────────────────
 * STAGING FIRST. DRY-RUN BEFORE COMMIT. Default mode mutates nothing and only
 * prints a report. `--commit` applies and is RESUMABLE: already-canonical
 * objects are skipped (idempotent re-encode detection), so a re-run after a
 * crash is safe and cheap. Every mutation is logged.
 *
 * Requires MINIO_ENDPOINT / MINIO_ACCESS_KEY / MINIO_SECRET_KEY (+ optional
 * MINIO_BUCKET, default `kontax-uploads`) and DATABASE_URL (points at staging
 * per .env). If MINIO_ENDPOINT is unset the script prints a note and exits 0,
 * matching how the app degrades without storage.
 *
 * Usage:
 *   Dry-run (default, safe):
 *     node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/backfill-avatars.mjs
 *   Commit (staging, after reviewing the dry-run):
 *     node --env-file-if-exists=.env --env-file-if-exists=.env.local scripts/backfill-avatars.mjs --commit
 */

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { PrismaClient } from "../generated/prisma/index.js";

// ── Canonical form (mirrors src/server/contact-photo-sync.ts) ────────────────
const CANONICAL_MAX_DIM = 1024;
const CANONICAL_QUALITY = 82;
const THUMB_SIZE = 96;

const COMMIT = process.argv.includes("--commit");
const prisma = new PrismaClient();
const log = (msg) => console.log(`[backfill-avatars] ${msg}`);

// ── MinIO client (mirrors src/server/contact-photo-sync.ts getS3()) ──────────
if (!process.env.MINIO_ENDPOINT) {
  console.log(
    "[backfill-avatars] MINIO_ENDPOINT not configured — nothing to do (this is how the app degrades without storage). Exiting.",
  );
  process.exit(0);
}

const s3 = new S3Client({
  endpoint: process.env.MINIO_ENDPOINT,
  region: "us-east-1",
  credentials: {
    accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
    secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
  },
  forcePathStyle: true,
});
const bucket = process.env.MINIO_BUCKET ?? "kontax-uploads";

// Extract our object key from an avatar URL when it points at our storage
// (mirrors avatarKeyFromUrl in contact-photo-sync.ts).
const avatarKeyFromUrl = (url) => /\/(avatars\/[^?]+)/.exec(url ?? "")?.[1] ?? null;

// Identity of an object independent of `-thumb` suffix and extension:
// `avatars/<owner>/<cuid>`. Used to pair thumbs with parents and to match DB refs.
const THUMB_SUFFIX = "-thumb";
const baseIdentity = (key) => {
  // strip extension
  let base = key.replace(/\.[a-z0-9]+$/i, "");
  // strip trailing -thumb
  if (base.endsWith(THUMB_SUFFIX)) base = base.slice(0, -THUMB_SUFFIX.length);
  return base;
};
const isThumbKey = (key) => /-thumb\.webp$/i.test(key);
const thumbKeyFor = (key) => key.replace(/\.[a-z0-9]+$/i, "-thumb.webp");
const extOf = (key) => (/\.([a-z0-9]+)$/i.exec(key)?.[1] ?? "").toLowerCase();

const fmtBytes = (n) => {
  if (n < 1024) return `${n} B`;
  const mb = n / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(n / 1024).toFixed(1)} KB`;
};

// ── Object listing (paginated) ───────────────────────────────────────────────
async function listAvatarObjects() {
  const objects = [];
  let ContinuationToken;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: "avatars/",
        ContinuationToken,
      }),
    );
    for (const o of res.Contents ?? []) {
      if (o.Key) objects.push({ key: o.Key, size: o.Size ?? 0 });
    }
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);
  return objects;
}

const getBytes = async (key) => {
  const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
};

// ── Canonical-form detection ─────────────────────────────────────────────────
// An original needs re-normalization if ANY of:
//   - extension is not jpg/jpeg (non-canonical container), OR
//   - either dimension exceeds CANONICAL_MAX_DIM (oversized), OR
//   - the file still carries EXIF metadata (privacy — must be stripped).
// Returns { needs: boolean, reason: string }.
async function needsNormalize(key, bytes) {
  const ext = extOf(key);
  if (ext !== "jpg" && ext !== "jpeg") return { needs: true, reason: `ext .${ext || "?"}` };
  let meta;
  try {
    meta = await sharp(bytes).metadata();
  } catch {
    // Undecodable — leave it alone (Job 2 handles it if orphaned); don't crash.
    return { needs: false, reason: "undecodable" };
  }
  if ((meta.width ?? 0) > CANONICAL_MAX_DIM || (meta.height ?? 0) > CANONICAL_MAX_DIM) {
    return { needs: true, reason: `oversized ${meta.width}x${meta.height}` };
  }
  if (meta.exif || meta.orientation != null) {
    return { needs: true, reason: "carries EXIF" };
  }
  return { needs: false, reason: "canonical" };
}

async function reencode(bytes) {
  const out = await sharp(bytes)
    .rotate()
    .resize(CANONICAL_MAX_DIM, CANONICAL_MAX_DIM, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: CANONICAL_QUALITY })
    .toBuffer();
  return out;
}

async function makeThumb(jpegBytes) {
  return sharp(jpegBytes)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
    .webp({ quality: 80 })
    .toBuffer();
}

// ── Referenced-key set from the DB ───────────────────────────────────────────
async function loadReferencedIdentities() {
  const [users, contacts] = await Promise.all([
    prisma.user.findMany({ where: { avatarUrl: { not: null } }, select: { avatarUrl: true } }),
    prisma.contact.findMany({ where: { avatarUrl: { not: null } }, select: { avatarUrl: true } }),
  ]);
  const identities = new Set();
  for (const row of [...users, ...contacts]) {
    const key = avatarKeyFromUrl(row.avatarUrl);
    if (key) identities.add(baseIdentity(key));
  }
  return identities;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Scanning bucket ${bucket}/avatars …\n`);

  const [objects, referenced] = await Promise.all([
    listAvatarObjects(),
    loadReferencedIdentities(),
  ]);

  // Split thumbs from originals; index thumbs by parent identity so Job 2 can
  // pair them and Job 1 can regenerate them without treating them as originals.
  const originals = objects.filter((o) => !isThumbKey(o.key));
  const thumbs = objects.filter((o) => isThumbKey(o.key));
  const thumbByIdentity = new Map();
  for (const t of thumbs) thumbByIdentity.set(baseIdentity(t.key), t);

  // ── Job 1: re-normalize raw originals ──────────────────────────────────────
  let rawCount = 0;
  let rawBytesBefore = 0;
  let rawBytesAfter = 0; // running estimate/actual of normalized payload sizes
  let rawNormalized = 0;
  let rawSkipped = 0;
  let rawFailed = 0;
  const toNormalize = [];

  for (const obj of originals) {
    // Only consider objects that are still referenced — normalizing an orphan
    // is wasted work (Job 2 deletes it). This also keeps re-runs cheap.
    if (!referenced.has(baseIdentity(obj.key))) continue;
    let bytes;
    try {
      bytes = await getBytes(obj.key);
    } catch (err) {
      rawFailed += 1;
      log(`Job1 GET failed ${obj.key}: ${err.message}`);
      continue;
    }
    const verdict = await needsNormalize(obj.key, bytes);
    if (!verdict.needs) {
      rawSkipped += 1;
      continue;
    }
    rawCount += 1;
    rawBytesBefore += obj.size || bytes.length;
    // Compute the normalized payload so the dry-run estimate is real, not a guess.
    let normalized;
    try {
      normalized = await reencode(bytes);
    } catch (err) {
      rawFailed += 1;
      rawCount -= 1;
      rawBytesBefore -= obj.size || bytes.length;
      log(`Job1 re-encode failed ${obj.key} (${verdict.reason}): ${err.message}`);
      continue;
    }
    rawBytesAfter += normalized.length;
    toNormalize.push({ key: obj.key, normalized, reason: verdict.reason });
  }

  // ── Job 2: sweep orphaned objects ──────────────────────────────────────────
  // An original is orphaned when its identity has no DB reference. Its thumb (if
  // any) is swept with it. We report per top-level object (the original), and
  // fold the thumb's bytes into the reclaim so the estimate matches reality.
  const orphans = [];
  let orphanCount = 0;
  let orphanBytes = 0;
  for (const obj of originals) {
    if (referenced.has(baseIdentity(obj.key))) continue;
    orphanCount += 1;
    orphanBytes += obj.size;
    const pairedThumb = thumbByIdentity.get(baseIdentity(obj.key));
    if (pairedThumb) orphanBytes += pairedThumb.size;
    orphans.push({ key: obj.key, thumbKey: pairedThumb?.key ?? null });
  }
  // Also catch stray thumbs whose parent original is already gone but whose
  // identity is unreferenced (dangling thumbs).
  for (const t of thumbs) {
    const id = baseIdentity(t.key);
    if (referenced.has(id)) continue;
    const hasOriginal = originals.some((o) => baseIdentity(o.key) === id);
    if (hasOriginal) continue; // already accounted for via its original
    orphanCount += 1;
    orphanBytes += t.size;
    orphans.push({ key: t.key, thumbKey: null });
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  const totalReclaim = (rawBytesBefore - rawBytesAfter) + orphanBytes;
  console.log(
    `raw originals    ${String(rawCount).padStart(3)} objects   ${fmtBytes(rawBytesBefore)}`,
  );
  console.log(
    `  → re-normalize   ${String(rawCount).padEnd(3)}           est → ${fmtBytes(rawBytesAfter)}`,
  );
  console.log(
    `orphaned          ${String(orphanCount).padStart(2)} objects    ${fmtBytes(orphanBytes)}`,
  );
  console.log(
    `  → delete          ${String(orphanCount).padEnd(2)}           reclaim ${fmtBytes(orphanBytes)}`,
  );
  console.log(`\ntotal reclaim:  ~${fmtBytes(totalReclaim)}`);

  if (!COMMIT) {
    console.log("DRY RUN — no objects written or deleted.");
    console.log("re-run with --commit (staging) to apply.");
    return;
  }

  // ── Commit: Job 1 (re-normalize) ───────────────────────────────────────────
  console.log("\n--commit — applying …");
  for (const item of toNormalize) {
    try {
      // Overwrite bytes at the SAME key (see KEY-STABILITY CHOICE above); force
      // ContentType image/jpeg regardless of the object's stale extension.
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: item.key,
          Body: item.normalized,
          ContentType: "image/jpeg",
        }),
      );
      const thumb = await makeThumb(item.normalized);
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: thumbKeyFor(item.key),
          Body: thumb,
          ContentType: "image/webp",
        }),
      );
      rawNormalized += 1;
      log(`normalized ${item.key} (${item.reason}) + thumb`);
    } catch (err) {
      rawFailed += 1;
      log(`Job1 write FAILED ${item.key}: ${err.message}`);
    }
  }

  // ── Commit: Job 2 (delete orphans) ─────────────────────────────────────────
  let orphanDeleted = 0;
  for (const orphan of orphans) {
    try {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: orphan.key }));
      log(`deleted orphan ${orphan.key}`);
      // Delete the paired thumb explicitly when we found one; otherwise attempt
      // the conventional thumb key best-effort (harmless if it doesn't exist).
      const tk = orphan.thumbKey ?? (isThumbKey(orphan.key) ? null : thumbKeyFor(orphan.key));
      if (tk) {
        try {
          await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: tk }));
          log(`deleted orphan thumb ${tk}`);
        } catch {
          /* thumb may not exist — best-effort */
        }
      }
      orphanDeleted += 1;
    } catch (err) {
      log(`Job2 delete FAILED ${orphan.key}: ${err.message}`);
    }
  }

  console.log(
    `\ndone: normalized=${rawNormalized} skipped-canonical=${rawSkipped} ` +
      `orphans-deleted=${orphanDeleted} failed=${rawFailed}`,
  );
  if (rawFailed > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

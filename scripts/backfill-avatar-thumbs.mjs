#!/usr/bin/env node
/**
 * P38-08 — backfill 96×96 webp thumbnails for existing Kontax-hosted avatars.
 *
 * Scans User.avatarUrl and Contact.avatarUrl for MinIO-hosted keys
 * (`avatars/<userId>/<id>.<ext>`), and for each writes the
 * `…-thumb.webp` sibling if missing. External (pasted) avatar URLs are
 * skipped — the UI falls back to the original for those by design.
 *
 * Idempotent; safe to re-run. Requires MINIO_ENDPOINT / MINIO_ACCESS_KEY /
 * MINIO_SECRET_KEY (+ optional MINIO_BUCKET, MINIO_PUBLIC_URL) and
 * DATABASE_URL.
 *
 * Usage: node scripts/backfill-avatar-thumbs.mjs [--dry-run]
 */

import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";

import { PrismaClient } from "../generated/prisma/index.js";

const DRY_RUN = process.argv.includes("--dry-run");
const THUMB_SIZE = 96;
const KEY_RE = /(avatars\/[^/]+\/[^/]+)\.(jpe?g|png|webp|gif)$/i;

const prisma = new PrismaClient();
const log = (msg) => console.log(`[avatar-thumbs] ${msg}`);

if (!process.env.MINIO_ENDPOINT) {
  console.error("[avatar-thumbs] MINIO_ENDPOINT not configured.");
  process.exit(1);
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

const keyFromUrl = (url) => {
  const match = KEY_RE.exec(url ?? "");
  return match ? { base: match[1], ext: match[2] } : null;
};

async function objectExists(key) {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function processUrl(url, stats) {
  const parsed = keyFromUrl(url);
  if (!parsed) {
    stats.external += 1;
    return;
  }
  const originalKey = `${parsed.base}.${parsed.ext}`;
  const thumbKey = `${parsed.base}-thumb.webp`;
  if (await objectExists(thumbKey)) {
    stats.existing += 1;
    return;
  }
  if (DRY_RUN) {
    log(`would create ${thumbKey}`);
    stats.created += 1;
    return;
  }
  try {
    const original = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: originalKey }));
    const body = Buffer.from(await original.Body.transformToByteArray());
    const thumb = await sharp(body)
      .rotate()
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: thumbKey,
      Body: thumb,
      ContentType: "image/webp",
    }));
    stats.created += 1;
    log(`created ${thumbKey}`);
  } catch (error) {
    stats.failed += 1;
    log(`FAILED ${originalKey}: ${error.message}`);
  }
}

async function main() {
  const [users, contacts] = await Promise.all([
    prisma.user.findMany({
      where: { avatarUrl: { not: null } },
      select: { avatarUrl: true },
    }),
    prisma.contact.findMany({
      where: { avatarUrl: { not: null } },
      select: { avatarUrl: true },
    }),
  ]);
  const urls = [...new Set([...users, ...contacts].map((r) => r.avatarUrl).filter(Boolean))];
  log(`${urls.length} distinct avatar URLs (${users.length} users, ${contacts.length} contacts)${DRY_RUN ? " [dry run]" : ""}`);

  const stats = { created: 0, existing: 0, external: 0, failed: 0 };
  for (const url of urls) {
    await processUrl(url, stats);
  }
  log(`done: created=${stats.created} existing=${stats.existing} external=${stats.external} failed=${stats.failed}`);
  if (stats.failed > 0) process.exitCode = 1;
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });

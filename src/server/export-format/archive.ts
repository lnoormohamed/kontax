// P45: the archive serialization — zip with manifest.json + contacts/ +
// media/ (+ optional vcards/ fallback). Container spec is
// docs/contact-export-format-spec.md §7 (P45-03): ordinal contact filenames,
// content-addressed media dedup, and a manifest `integrity` block whose
// per-entry sha256 + byte length make a truncated archive detectable.
//
// Two writers share one manifest shape:
//   • buildKontaxArchive — buffers the whole zip in memory. For single-contact
//     / small synchronous exports (and the selftest).
//   • streamKontaxArchive — pulls each photo just-in-time and appends it with
//     per-entry backpressure, so a 10k-contact book never holds more than one
//     photo at a time (spec §7.8). The async export job uses this.

import { once } from "events";
import { createHash } from "crypto";
import { ZipArchive } from "archiver";
import { PassThrough, Transform, type Writable } from "stream";

import {
  ARCHIVE_CONTACTS_DIR,
  ARCHIVE_INTEGRITY_ALGORITHM,
  ARCHIVE_MANIFEST_NAME,
  ARCHIVE_MANIFEST_TYPE,
  ARCHIVE_MEDIA_DIR,
  ARCHIVE_VCARDS_NAME,
  contactOrdinal,
  ext,
  FORMAT_VERSION,
  FORMAT_VERSION_KEY,
  PROD_ID,
} from "./constants";
import type { KontaxCard } from "./card";

export type ArchiveMediaFile = { sha256: string; extension: string; bytes: Buffer };

export type ArchiveLabelRegistryEntry = { name: string; color: string; position?: number };

/** One `integrity.entries[]` row: the packed path plus a checksum over its bytes. */
export type ArchiveIntegrityEntry = { path: string; sha256: string; bytes: number };

export type ArchiveManifestExtras = {
  /** Deduplicated label registry, hoisted to the manifest (spec §7.2, a SHOULD). */
  labelRegistry?: ArchiveLabelRegistryEntry[];
  /** Book descriptions, hoisted to the manifest (spec §7.2). */
  books?: Array<{ name: string; description?: string | null }>;
};

export type BuildArchiveInput = ArchiveManifestExtras & {
  cards: KontaxCard[];
  media: ArchiveMediaFile[];
  /** Optional vCard 3.0 compatibility projection (vcards/contacts.vcf). */
  vcardFallback?: string | null;
  exportedAt: Date;
};

export const mediaRefPath = (sha256: string, extension: string) =>
  `${ARCHIVE_MEDIA_DIR}${sha256}.${extension}`;

const sha256Hex = (bytes: Buffer) =>
  createHash(ARCHIVE_INTEGRITY_ALGORITHM).update(bytes).digest("hex");

/** The manifest object — the archive's envelope + integrity root (spec §7.2). */
function buildManifest(params: {
  exportedAt: Date;
  contactCount: number;
  photoCount: number;
  integrityEntries: ArchiveIntegrityEntry[];
  extras: ArchiveManifestExtras;
}): Record<string, unknown> {
  const manifest: Record<string, unknown> = {
    "@type": ARCHIVE_MANIFEST_TYPE,
    [FORMAT_VERSION_KEY]: FORMAT_VERSION,
    [ext("exportedAt")]: params.exportedAt.toISOString(),
    exporter: PROD_ID,
    counts: { contacts: params.contactCount, photos: params.photoCount },
    integrity: { algorithm: ARCHIVE_INTEGRITY_ALGORITHM, entries: params.integrityEntries },
  };
  const registry = params.extras.labelRegistry;
  if (registry && registry.length > 0) {
    manifest[ext("labels")] = Object.fromEntries(
      registry.map((entry, i) => [
        `l${i + 1}`,
        {
          name: entry.name,
          color: entry.color,
          ...(typeof entry.position === "number" ? { position: entry.position } : {}),
        },
      ]),
    );
  }
  const bookDescriptions = (params.extras.books ?? []).filter((b) => b.description);
  if (bookDescriptions.length > 0) {
    manifest[ext("books")] = bookDescriptions.map((b) => ({ name: b.name, description: b.description }));
  }
  return manifest;
}

/**
 * Build the archive fully in memory and return it as a Buffer. Suitable for
 * single-/few-contact synchronous exports; bulk exports use
 * `streamKontaxArchive`. Manifest first — all integrity is known up front here.
 */
export async function buildKontaxArchive(input: BuildArchiveInput): Promise<Buffer> {
  // Content is the identity, not the filename: ordinals are just a stable,
  // sortable order. Width widens with the count so lexical order == numeric.
  const contactFiles = input.cards.map((card, index) => {
    const body = Buffer.from(JSON.stringify(card, null, 2), "utf8");
    return { path: `${ARCHIVE_CONTACTS_DIR}${contactOrdinal(index, input.cards.length)}.json`, body };
  });

  // media/ is content-addressed — two contacts sharing a photo store it once.
  const mediaByPath = new Map<string, Buffer>();
  for (const file of input.media) {
    const path = mediaRefPath(file.sha256, file.extension);
    if (!mediaByPath.has(path)) mediaByPath.set(path, file.bytes);
  }

  const vcardBody = input.vcardFallback != null ? Buffer.from(input.vcardFallback, "utf8") : null;

  const integrityEntries: ArchiveIntegrityEntry[] = [
    ...contactFiles.map((f) => ({ path: f.path, sha256: sha256Hex(f.body), bytes: f.body.length })),
    ...[...mediaByPath.entries()].map(([path, bytes]) => ({ path, sha256: sha256Hex(bytes), bytes: bytes.length })),
    ...(vcardBody ? [{ path: ARCHIVE_VCARDS_NAME, sha256: sha256Hex(vcardBody), bytes: vcardBody.length }] : []),
  ];

  const manifest = buildManifest({
    exportedAt: input.exportedAt,
    contactCount: contactFiles.length,
    photoCount: mediaByPath.size,
    integrityEntries,
    extras: input,
  });

  return new Promise((resolve, reject) => {
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    pass.on("data", (chunk: Buffer) => chunks.push(chunk));
    pass.on("end", () => resolve(Buffer.concat(chunks)));
    pass.on("error", reject);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", reject);
    archive.pipe(pass);

    // Fixed entry timestamp keeps a given card-set → byte-stable archive, so the
    // committed worked-example fixture (spec §7.8) is reproducible.
    const date = input.exportedAt;
    archive.append(JSON.stringify(manifest, null, 2), { name: ARCHIVE_MANIFEST_NAME, date });
    for (const file of contactFiles) archive.append(file.body, { name: file.path, date });
    for (const [path, bytes] of mediaByPath) archive.append(bytes, { name: path, date });
    if (vcardBody) archive.append(vcardBody, { name: ARCHIVE_VCARDS_NAME, date });

    void archive.finalize();
  });
}

// ── streaming writer (spec §7.8) ──────────────────────────────────────────────

/** One contact's contribution to the archive, produced lazily by the caller. */
export type ArchiveEntry = { card: KontaxCard; media: ArchiveMediaFile | null };

export type StreamArchiveInput = ArchiveManifestExtras & {
  /** Lazy per-contact source — a photo is fetched only as its entry is reached. */
  entries: AsyncIterable<ArchiveEntry>;
  /** Contact count, known up front, for ordinal width + manifest counts. */
  total: number;
  vcardFallback?: string | null;
  exportedAt: Date;
  onProgress?: (done: number) => void | Promise<void>;
};

export type StreamArchiveResult = { contactCount: number; photoCount: number; byteLength: number };

/**
 * Stream the archive to `out`, holding at most one photo in memory at a time.
 * The manifest is written **last** (order-independent for readers — the zip
 * central directory is read by name) because its integrity table is only fully
 * known once every entry has been hashed on the way through.
 */
export async function streamKontaxArchive(
  input: StreamArchiveInput,
  out: Writable,
): Promise<StreamArchiveResult> {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      byteLength += chunk.length;
      cb(null, chunk);
    },
  });
  let byteLength = 0;

  const done = new Promise<void>((resolve, reject) => {
    out.on("finish", resolve);
    out.on("close", resolve);
    out.on("error", reject);
    counter.on("error", reject);
    archive.on("error", reject);
  });
  archive.pipe(counter).pipe(out);

  const date = input.exportedAt;
  // Serialized appends: only one entry is ever outstanding, so waiting for the
  // archiver's "entry" event bounds queued source buffers to one at a time.
  const append = async (source: Buffer, name: string) => {
    archive.append(source, { name, date });
    await once(archive, "entry");
  };

  const integrityEntries: ArchiveIntegrityEntry[] = [];
  const seenMedia = new Set<string>();
  let contactCount = 0;
  let photoCount = 0;

  for await (const entry of input.entries) {
    if (entry.media) {
      const path = mediaRefPath(entry.media.sha256, entry.media.extension);
      if (!seenMedia.has(path)) {
        seenMedia.add(path);
        photoCount += 1;
        integrityEntries.push({ path, sha256: sha256Hex(entry.media.bytes), bytes: entry.media.bytes.length });
        await append(entry.media.bytes, path);
      }
    }
    const body = Buffer.from(JSON.stringify(entry.card, null, 2), "utf8");
    const path = `${ARCHIVE_CONTACTS_DIR}${contactOrdinal(contactCount, input.total)}.json`;
    integrityEntries.push({ path, sha256: sha256Hex(body), bytes: body.length });
    await append(body, path);
    contactCount += 1;
    if (input.onProgress && (contactCount % 25 === 0 || contactCount === input.total)) {
      await input.onProgress(contactCount);
    }
  }

  if (input.vcardFallback != null) {
    const body = Buffer.from(input.vcardFallback, "utf8");
    integrityEntries.push({ path: ARCHIVE_VCARDS_NAME, sha256: sha256Hex(body), bytes: body.length });
    await append(body, ARCHIVE_VCARDS_NAME);
  }

  const manifest = buildManifest({
    exportedAt: input.exportedAt,
    contactCount,
    photoCount,
    integrityEntries,
    extras: input,
  });
  await append(Buffer.from(JSON.stringify(manifest, null, 2), "utf8"), ARCHIVE_MANIFEST_NAME);

  await archive.finalize();
  await done;
  return { contactCount, photoCount, byteLength };
}

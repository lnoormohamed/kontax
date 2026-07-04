// P45: the archive serialization — zip with manifest.json + contacts/ +
// media/ (+ optional vcards/ fallback). Container spec is
// docs/contact-export-format-spec.md §7 (P45-03): ordinal contact filenames,
// content-addressed media dedup, and a manifest `integrity` block whose
// per-entry sha256 + byte length make a truncated archive detectable.

import { createHash } from "crypto";
import { ZipArchive } from "archiver";
import { PassThrough } from "stream";

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

export type BuildArchiveInput = {
  cards: KontaxCard[];
  media: ArchiveMediaFile[];
  /** Optional vCard 3.0 compatibility projection (vcards/contacts.vcf). */
  vcardFallback?: string | null;
  /** Deduplicated label registry, hoisted to the manifest (spec §7.2, a SHOULD). */
  labelRegistry?: ArchiveLabelRegistryEntry[];
  /** Book descriptions, hoisted to the manifest (spec §7.2). */
  books?: Array<{ name: string; description?: string | null }>;
  exportedAt: Date;
};

/** One `integrity.entries[]` row: the packed path plus a checksum over its bytes. */
export type ArchiveIntegrityEntry = { path: string; sha256: string; bytes: number };

export const mediaRefPath = (sha256: string, extension: string) =>
  `${ARCHIVE_MEDIA_DIR}${sha256}.${extension}`;

const sha256Hex = (bytes: Buffer) =>
  createHash(ARCHIVE_INTEGRITY_ALGORITHM).update(bytes).digest("hex");

/**
 * Build the archive from cards + resolved media. Returns a Buffer today (the
 * caller uploads it to MinIO); P45-04 swaps in a streamed writer. The manifest
 * — including the full `integrity` table — is assembled from the already-known
 * checksums before any entry is written, so streaming never needs a second
 * pass over the bytes.
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

  const vcardBody =
    input.vcardFallback != null ? Buffer.from(input.vcardFallback, "utf8") : null;

  // integrity covers every packed entry except the manifest itself (a manifest
  // can't checksum the document it lives in).
  const integrityEntries: ArchiveIntegrityEntry[] = [
    ...contactFiles.map((f) => ({ path: f.path, sha256: sha256Hex(f.body), bytes: f.body.length })),
    ...[...mediaByPath.entries()].map(([path, bytes]) => ({
      path,
      sha256: sha256Hex(bytes),
      bytes: bytes.length,
    })),
    ...(vcardBody
      ? [{ path: ARCHIVE_VCARDS_NAME, sha256: sha256Hex(vcardBody), bytes: vcardBody.length }]
      : []),
  ];

  const manifest: Record<string, unknown> = {
    "@type": ARCHIVE_MANIFEST_TYPE,
    [FORMAT_VERSION_KEY]: FORMAT_VERSION,
    [ext("exportedAt")]: input.exportedAt.toISOString(),
    exporter: PROD_ID,
    counts: {
      contacts: contactFiles.length,
      photos: mediaByPath.size,
    },
    integrity: {
      algorithm: ARCHIVE_INTEGRITY_ALGORITHM,
      entries: integrityEntries,
    },
  };
  if (input.labelRegistry && input.labelRegistry.length > 0) {
    manifest[ext("labels")] = Object.fromEntries(
      input.labelRegistry.map((entry, i) => [
        `l${i + 1}`,
        {
          name: entry.name,
          color: entry.color,
          ...(typeof entry.position === "number" ? { position: entry.position } : {}),
        },
      ]),
    );
  }
  const bookDescriptions = (input.books ?? []).filter((b) => b.description);
  if (bookDescriptions.length > 0) {
    manifest[ext("books")] = bookDescriptions.map((b) => ({
      name: b.name,
      description: b.description,
    }));
  }

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

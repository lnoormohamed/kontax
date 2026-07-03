// P45: the archive serialization — zip with manifest.json + contacts/ +
// media/ (+ optional vcards/ fallback). Interface fixed by spec §7; container
// hardening (checksums, streaming strategy) is P45-03's scope.

import { ZipArchive } from "archiver";
import { PassThrough } from "stream";

import {
  ARCHIVE_CONTACTS_DIR,
  ARCHIVE_MANIFEST_NAME,
  ARCHIVE_MEDIA_DIR,
  ARCHIVE_VCARDS_NAME,
  ext,
  FORMAT_VERSION,
  PROD_ID,
} from "./constants";
import type { KontaxCard } from "./card";

export type ArchiveMediaFile = { sha256: string; extension: string; bytes: Buffer };

export type BuildArchiveInput = {
  cards: KontaxCard[];
  media: ArchiveMediaFile[];
  /** Optional vCard 3.0 compatibility projection (vcards/contacts.vcf). */
  vcardFallback?: string | null;
  exportedAt: Date;
};

export const mediaRefPath = (sha256: string, extension: string) =>
  `${ARCHIVE_MEDIA_DIR}${sha256}.${extension}`;

export async function buildKontaxArchive(input: BuildArchiveInput): Promise<Buffer> {
  const manifest = {
    [ext("formatVersion")]: FORMAT_VERSION,
    [ext("exportedAt")]: input.exportedAt.toISOString(),
    exporter: PROD_ID,
    counts: {
      contacts: input.cards.length,
      photos: input.media.length,
    },
  };

  return new Promise((resolve, reject) => {
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    pass.on("data", (chunk: Buffer) => chunks.push(chunk));
    pass.on("end", () => resolve(Buffer.concat(chunks)));
    pass.on("error", reject);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", reject);
    archive.pipe(pass);

    archive.append(JSON.stringify(manifest, null, 2), { name: ARCHIVE_MANIFEST_NAME });

    input.cards.forEach((card, index) => {
      const ordinal = String(index + 1).padStart(4, "0");
      archive.append(JSON.stringify(card, null, 2), {
        name: `${ARCHIVE_CONTACTS_DIR}${ordinal}.json`,
      });
    });

    // media/ is content-addressed — two contacts sharing a photo store it once.
    const seen = new Set<string>();
    for (const file of input.media) {
      const path = mediaRefPath(file.sha256, file.extension);
      if (seen.has(path)) continue;
      seen.add(path);
      archive.append(file.bytes, { name: path });
    }

    if (input.vcardFallback) {
      archive.append(input.vcardFallback, { name: ARCHIVE_VCARDS_NAME });
    }

    void archive.finalize();
  });
}

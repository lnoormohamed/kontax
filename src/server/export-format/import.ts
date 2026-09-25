// P45-DB01 Surface 5: commit side of the Kontax-format import. Takes the
// ImportedCardContact rows produced by parse.ts and lands them as Contact
// rows, mirroring the CSV commit route's ImportJob lifecycle and activity
// events so rollback/history work unchanged.

import { createId } from "@paralleldrive/cuid2";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import {
  contactLimitMessage,
  getContactCapacityFor,
  getImportCapacity,
  lockUserForPlanCheck,
} from "~/server/billing";
import { db } from "~/server/db";
import { normalizeContactPhoto } from "~/server/contact-photo-sync";
import type { ImportedCardContact } from "./parse";

// ── imported-photo upload ────────────────────────────────────────────────────
// Same S3 + 96px webp thumb convention as src/app/api/upload/avatar/route.ts
// (key avatars/{userId}/{cuid}.{ext}, sibling <key minus ext>-thumb.webp).
//
// P48-11 item 1: an imported photo's bytes and claimed mediaType are both
// attacker-controlled (a crafted .kontax archive/document). Previously the
// raw bytes were uploaded with `ContentType: mediaType` straight from the
// import file — a `data:text/html;base64,…` or `image/svg+xml` photo became
// a public object served as HTML/SVG on the media host (stored XSS/phishing
// on media.getkontax.com). Every photo now goes through the same
// `normalizeContactPhoto` re-encode the CardDAV/Google photo sync uses
// (src/server/contact-photo-sync.ts): sharp decodes it and re-encodes to a
// canonical JPEG, so only bytes that are genuinely a raster image are ever
// stored, always with a matching, safe content type.

const THUMB_SIZE = 96;

function getS3(): S3Client | null {
  if (!process.env.MINIO_ENDPOINT) return null;
  return new S3Client({
    endpoint: process.env.MINIO_ENDPOINT,
    region: "us-east-1", // MinIO ignores region but SDK requires it
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY ?? "",
      secretAccessKey: process.env.MINIO_SECRET_KEY ?? "",
    },
    forcePathStyle: true,
  });
}

export type SavedImportedAvatar = {
  /** Public URL of the stored (re-encoded) photo, or null if nothing was stored. */
  url: string | null;
  /**
   * True when the contact *had* a photo but it was rejected — not a
   * decodable raster image, or too large/corrupt for sharp to re-encode.
   * False covers both "no photo" and "MinIO isn't configured" — neither is
   * a per-contact problem worth warning about.
   */
  rejected: boolean;
};

/**
 * Upload an imported contact photo to MinIO (original + 96px webp thumb).
 * The bytes are always re-encoded through `normalizeContactPhoto` first — see
 * the module note above — so only a genuinely decodable raster image is ever
 * stored, always as a canonical JPEG. Returns `{ url: null, rejected: true }`
 * when the bytes can't be decoded as an image at all, and `{ url: null,
 * rejected: false }` when MinIO is unconfigured (the import proceeds without
 * photos in that case, same as before).
 */
export async function saveImportedAvatar(
  userId: string,
  bytes: Buffer,
): Promise<SavedImportedAvatar> {
  const normalized = await normalizeContactPhoto(bytes);
  if (!normalized) return { url: null, rejected: true };

  const s3 = getS3();
  if (!s3) return { url: null, rejected: false };

  const key = `avatars/${userId}/${createId()}.${normalized.ext}`;
  const bucket = process.env.MINIO_BUCKET ?? "kontax-uploads";

  // Thumbnailing failure (extremely unlikely — normalized.bytes just came
  // out of sharp) must not block the import — renderers fall back to the
  // original when the thumb 404s.
  let thumbBody: Buffer | null = null;
  try {
    thumbBody = await sharp(normalized.bytes)
      .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    console.warn("[Kontax] imported-photo thumbnail generation failed — serving original only", error);
  }

  try {
    await Promise.all([
      s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: normalized.bytes,
        ContentType: normalized.mediaType,
        // Both types here are always in the raster allowlist post-normalize —
        // never served as an attachment fallback that could trigger a
        // content-type sniff, and never anything but an image.
        ContentDisposition: "inline",
      })),
      thumbBody
        ? s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key.replace(/\.[a-z0-9]+$/i, "-thumb.webp"),
            Body: thumbBody,
            ContentType: "image/webp",
            ContentDisposition: "inline",
          }))
        : Promise.resolve(),
    ]);
  } catch (error) {
    console.warn("[Kontax] imported-photo upload failed — importing contact without photo", error);
    return { url: null, rejected: false };
  }

  return { url: `${process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT}/${key}`, rejected: false };
}

// ── commit ───────────────────────────────────────────────────────────────────

const CHUNK_SIZE = 50;

const asJsonArray = <T>(value: T[]) => (value.length > 0 ? value : undefined);

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export type KontaxImportResult = {
  importedCount: number;
  skippedCount: number;
  jobId: string;
  /** Human-readable per-contact warnings for photos that could not be imported. */
  photoWarnings: string[];
  /** P49A-06: contacts left out because the plan's contact cap was reached (included in skippedCount). */
  capSkippedCount: number;
  /** User-facing cap message when capSkippedCount > 0, else null. */
  limitMessage: string | null;
};

const MAX_REPORTED_PHOTO_WARNINGS = 50;

/**
 * P48-11 item 6: marks an error whose message is safe (already
 * curated/user-facing) to return as-is. Everything else thrown out of the
 * try block below is treated as an unexpected failure — logged server-side,
 * masked with a fixed message for the caller.
 */
export class KontaxImportError extends Error {}

/**
 * Land parsed Kontax-format contacts for a user. Creates an ImportJob (so the
 * existing rollback route + import history apply), upserts label-registry
 * entries, resolves books, uploads photos, and writes one CONTACT_IMPORTED
 * activity event per contact — mirroring the CSV commit route.
 */
export async function commitKontaxImport(
  userId: string,
  contacts: ImportedCardContact[],
  sourceDetail: string,
  options?: {
    sourceFileName?: string;
    sourceFileSizeBytes?: number;
    skippedCount?: number;
  },
): Promise<KontaxImportResult> {
  const sourceFileName = options?.sourceFileName ?? sourceDetail;
  const parseSkippedCount = options?.skippedCount ?? 0;

  // ImportFormat has only CSV_GENERIC and ImportSourceProfile has no Kontax
  // value (both enums are role-locked, see KontaxExportKind note in the
  // schema) — GENERIC is the least-wrong profile; sourceDetail on the
  // contacts carries the real provenance ("kontax-archive"/"kontax-document").
  const job = await db.importJob.create({
    data: {
      userId,
      format: "CSV_GENERIC",
      status: "PROCESSING",
      sourceProfile: "GENERIC",
      sourceFileName,
      sourceFileSizeBytes: options?.sourceFileSizeBytes,
      rowCount: contacts.length + parseSkippedCount,
      previewContactCount: contacts.length,
      startedAt: new Date(),
    },
  });

  try {
    if (contacts.length === 0) {
      throw new KontaxImportError("No importable contacts were found in that file.");
    }

    // P49A-06 (Fable review): over the contact cap no longer fails the import
    // — only what fits is created (enforced per chunk below, inside the insert
    // transaction) — so this rejects only a read-only account, the monthly
    // import limit, or an account with no room at all.
    try {
      await getImportCapacity(userId, contacts.length);
    } catch (error) {
      // billing.ts throws plain Error with a curated, user-safe plan-limit
      // message — safe to surface, but re-tagged so the route can tell it
      // apart from an unexpected DB/S3 failure further down.
      throw new KontaxImportError(
        error instanceof Error ? error.message : "Import limit reached.",
      );
    }

    // Label registry: exported registry entries win only for labels the user
    // doesn't already have — never recolor existing labels. Names on contacts
    // without a registry entry are left to the lazy ensureLabelRegistry
    // backfill (they still land in Contact.labels below).
    const registryByKey = new Map<string, { name: string; color: string; position?: number }>();
    for (const contact of contacts) {
      for (const entry of contact.labelRegistry) {
        const key = entry.name.trim().toLowerCase();
        if (key && !registryByKey.has(key)) registryByKey.set(key, entry);
      }
    }
    if (registryByKey.size > 0) {
      const existing = await db.label.findMany({
        where: { userId },
        select: { name: true, position: true },
      });
      const existingNames = new Set(existing.map((l) => l.name.toLowerCase()));
      let pos = existing.reduce((max, l) => Math.max(max, l.position), -1) + 1;
      const toCreate = [...registryByKey.entries()]
        .filter(([key]) => !existingNames.has(key))
        .map(([, entry]) => ({
          userId,
          name: entry.name,
          color: entry.color,
          position: pos++,
        }));
      if (toCreate.length > 0) {
        await db.label.createMany({ data: toCreate, skipDuplicates: true });
      }
    }

    // Books: exact-name match against the user's books; fall back to the
    // default book, else null.
    const books = await db.addressBook.findMany({
      where: { userId, archivedAt: null },
      select: { id: true, name: true, isDefault: true },
    });
    const bookIdByName = new Map(books.map((b) => [b.name, b.id]));
    const defaultBookId = books.find((b) => b.isDefault)?.id ?? null;
    // The contact's home book: its first named book that resolves, else the
    // account default. Its `bookId` column + primary membership.
    const resolveBookId = (contact: ImportedCardContact): string | null => {
      const first = contact.books[0];
      return (first ? bookIdByName.get(first) : undefined) ?? defaultBookId;
    };
    // All books this contact belongs to (Phase 40 multi-book), by name, keeping
    // only names that match an existing book in the target account. Non-matching
    // names are dropped rather than auto-creating books on import.
    const resolveAllBookIds = (contact: ImportedCardContact): string[] => {
      const ids = new Set<string>();
      const primary = resolveBookId(contact);
      if (primary) ids.add(primary);
      for (const name of contact.books) {
        const id = bookIdByName.get(name);
        if (id) ids.add(id);
      }
      return [...ids];
    };

    // Capture each created contact with its source card so we can dual-write
    // memberships (primary + Phase-40 secondaries) after the rows land.
    const landed: Array<{ id: string; source: ImportedCardContact; primaryBookId: string | null }> = [];

    // createMany can't carry per-contact photo URLs, so: upload photos for a
    // chunk, then create that chunk's contacts in one transaction.
    let importedCount = 0;
    let capSkippedCount = 0;
    let capLimit: { planLabel: string; limit: number } | null = null;
    const photoWarnings: string[] = [];
    for (const fullGroup of chunk(contacts, CHUNK_SIZE)) {
      // P49A-06 (Fable review): create only what fits under the contact cap.
      // An unlocked read first so photos aren't uploaded for contacts that
      // can't land; the locked re-check inside the insert transaction below is
      // authoritative (a concurrent create may have used the room meanwhile).
      if (capLimit) {
        capSkippedCount += fullGroup.length;
        continue;
      }
      const estimate = await getContactCapacityFor(db, userId);
      const group =
        estimate.remaining === null ? fullGroup : fullGroup.slice(0, estimate.remaining);
      if (group.length < fullGroup.length && estimate.limit !== null) {
        capLimit = { planLabel: estimate.planLabel, limit: estimate.limit };
        capSkippedCount += fullGroup.length - group.length;
      }
      if (group.length === 0) continue;

      const avatarUrls: Array<string | null> = [];
      for (const contact of group) {
        if (!contact.photo) {
          avatarUrls.push(null);
          continue;
        }
        const { url, rejected } = await saveImportedAvatar(userId, contact.photo.bytes);
        avatarUrls.push(url);
        if (rejected && photoWarnings.length < MAX_REPORTED_PHOTO_WARNINGS) {
          photoWarnings.push(
            `Photo for "${contact.fullName}" could not be imported — not a readable image.`,
          );
        }
      }

      const created = await db.$transaction(async (tx) => {
        await lockUserForPlanCheck(tx, userId);
        const capacity = await getContactCapacityFor(tx, userId);
        const fits =
          capacity.remaining === null ? group.length : Math.min(group.length, capacity.remaining);
        if (fits < group.length && capacity.limit !== null) {
          capLimit = { planLabel: capacity.planLabel, limit: capacity.limit };
          capSkippedCount += group.length - fits;
        }
        const rows: Array<{ id: string }> = [];
        for (const [index, contact] of group.slice(0, fits).entries()) {
          rows.push(await tx.contact.create({
            data: {
              userId,
              importJobId: job.id,
              bookId: resolveBookId(contact),
              fullName: contact.fullName,
              firstName: contact.firstName,
              middleName: contact.middleName,
              lastName: contact.lastName,
              phoneticFirstName: contact.phoneticFirstName,
              phoneticLastName: contact.phoneticLastName,
              namePrefix: contact.namePrefix,
              nameSuffix: contact.nameSuffix,
              nickname: contact.nickname,
              company: contact.company,
              phoneticCompany: contact.phoneticCompany,
              department: contact.department,
              jobTitle: contact.jobTitle,
              email: contact.emailEntries[0]?.value ?? null,
              phone: contact.phoneEntries[0]?.value ?? null,
              website: contact.websiteEntries[0]?.value ?? null,
              address: contact.addressEntries[0]?.formatted ?? null,
              birthday: contact.birthday,
              notes: contact.notes,
              isFavorite: contact.isFavorite,
              isEmergency: contact.isEmergency,
              avatarUrl: avatarUrls[index],
              emailEntries: asJsonArray(contact.emailEntries),
              phoneEntries: asJsonArray(contact.phoneEntries),
              websiteEntries: asJsonArray(contact.websiteEntries),
              addressEntries: asJsonArray(contact.addressEntries),
              significantDates: asJsonArray(contact.significantDates),
              relatedPeople: asJsonArray(contact.relatedPeople),
              customFields: asJsonArray(contact.customFields),
              labels: asJsonArray(contact.labels),
              // SourceType has no plain IMPORT value — IMPORT_CSV is the
              // least-wrong existing member for file imports.
              sourceType: "IMPORT_CSV" as const,
              sourceDetail,
              lastMutatedBy: "IMPORT_CSV" as const,
              lastMutatedByDetail: sourceDetail,
            },
            select: { id: true },
          }));
        }
        return rows;
      }, { timeout: 60_000 });
      created.forEach((row, index) => {
        const source = group[index]!;
        landed.push({ id: row.id, source, primaryBookId: resolveBookId(source) });
      });
      importedCount += created.length;
    }
    const skippedCount = parseSkippedCount + capSkippedCount;
    const limitMessage =
      capSkippedCount > 0 && capLimit
        ? contactLimitMessage(capLimit.planLabel, capLimit.limit)
        : null;

    // Mirror the CSV commit route: one CONTACT_IMPORTED event per contact.
    if (landed.length > 0) {
      await db.activityEvent.createMany({
        data: landed.map((c) => ({
          userId,
          contactId: c.id,
          eventType: "CONTACT_IMPORTED" as const,
          actor: "IMPORT" as const,
          actorDetail: sourceFileName,
          payload: { importJobId: job.id, sourceFileName },
        })),
      });
      // P40-06/Phase-40: dual-write memberships. The home book is primary; any
      // additional books the card listed (that exist in this account) are
      // secondary memberships so a multi-book contact round-trips.
      const memberships = landed.flatMap((c) => {
        const allBookIds = resolveAllBookIds(c.source);
        return allBookIds.map((addressBookId) => ({
          contactId: c.id,
          addressBookId,
          isPrimary: addressBookId === c.primaryBookId,
        }));
      });
      if (memberships.length > 0) {
        await db.contactBookMembership.createMany({ data: memberships, skipDuplicates: true });
      }
    }

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        importedCount,
        skippedCount,
        errorSummary: limitMessage
          ? `${capSkippedCount} contact${capSkippedCount === 1 ? "" : "s"} not imported: ${limitMessage}`
          : undefined,
        committedAt: new Date(),
        completedAt: new Date(),
      },
    });

    const cappedWarnings =
      photoWarnings.length >= MAX_REPORTED_PHOTO_WARNINGS
        ? [...photoWarnings, "Additional photo warnings were omitted."]
        : photoWarnings;
    return {
      importedCount,
      skippedCount,
      jobId: job.id,
      photoWarnings: cappedWarnings,
      capSkippedCount,
      limitMessage,
    };
  } catch (error) {
    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        errorSummary: error instanceof Error ? error.message : "Import failed.",
        committedAt: new Date(),
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

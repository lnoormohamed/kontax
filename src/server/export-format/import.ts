// P45-DB01 Surface 5: commit side of the Kontax-format import. Takes the
// ImportedCardContact rows produced by parse.ts and lands them as Contact
// rows, mirroring the CSV commit route's ImportJob lifecycle and activity
// events so rollback/history work unchanged.

import { createId } from "@paralleldrive/cuid2";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";

import { assertCanImportContacts } from "~/server/billing";
import { db } from "~/server/db";
import type { ImportedCardContact } from "./parse";

// ── imported-photo upload ────────────────────────────────────────────────────
// Same S3 + 96px webp thumb convention as src/app/api/upload/avatar/route.ts
// (key avatars/{userId}/{cuid}.{ext}, sibling <key minus ext>-thumb.webp).

const THUMB_SIZE = 96;

const EXT_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

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

/**
 * Upload an imported contact photo to MinIO (original + 96px webp thumb).
 * Returns the public URL, or null when MinIO is unconfigured — the import
 * proceeds without photos in that case.
 */
export async function saveImportedAvatar(
  userId: string,
  bytes: Buffer,
  mediaType: string,
): Promise<string | null> {
  const s3 = getS3();
  if (!s3) return null;

  const ext = EXT_MAP[mediaType] ?? "jpg";
  const key = `avatars/${userId}/${createId()}.${ext}`;
  const bucket = process.env.MINIO_BUCKET ?? "kontax-uploads";

  // Thumbnailing failure (corrupt but plausibly-typed bytes) must not block
  // the import — renderers fall back to the original when the thumb 404s.
  let thumbBody: Buffer | null = null;
  try {
    thumbBody = await sharp(bytes)
      .rotate() // respect EXIF orientation
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
        Body: bytes,
        ContentType: mediaType,
      })),
      thumbBody
        ? s3.send(new PutObjectCommand({
            Bucket: bucket,
            Key: key.replace(/\.[a-z0-9]+$/i, "-thumb.webp"),
            Body: thumbBody,
            ContentType: "image/webp",
          }))
        : Promise.resolve(),
    ]);
  } catch (error) {
    console.warn("[Kontax] imported-photo upload failed — importing contact without photo", error);
    return null;
  }

  return `${process.env.MINIO_PUBLIC_URL ?? process.env.MINIO_ENDPOINT}/${key}`;
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
};

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
  const skippedCount = options?.skippedCount ?? 0;

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
      rowCount: contacts.length + skippedCount,
      previewContactCount: contacts.length,
      startedAt: new Date(),
    },
  });

  try {
    if (contacts.length === 0) {
      throw new Error("No importable contacts were found in that file.");
    }

    await assertCanImportContacts(userId, contacts.length);

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
    const resolveBookId = (contact: ImportedCardContact): string | null => {
      const first = contact.books[0];
      return (first ? bookIdByName.get(first) : undefined) ?? defaultBookId;
    };

    // createMany can't carry per-contact photo URLs, so: upload photos for a
    // chunk, then create that chunk's contacts in one transaction.
    let importedCount = 0;
    for (const group of chunk(contacts, CHUNK_SIZE)) {
      const avatarUrls: Array<string | null> = [];
      for (const contact of group) {
        avatarUrls.push(
          contact.photo
            ? await saveImportedAvatar(userId, contact.photo.bytes, contact.photo.mediaType)
            : null,
        );
      }

      await db.$transaction(
        group.map((contact, index) =>
          db.contact.create({
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
          }),
        ),
      );
      importedCount += group.length;
    }

    // Mirror the CSV commit route: one CONTACT_IMPORTED event per contact.
    const importedContacts = await db.contact.findMany({
      where: { userId, importJobId: job.id },
      select: { id: true, bookId: true },
    });
    if (importedContacts.length > 0) {
      await db.activityEvent.createMany({
        data: importedContacts.map((contact) => ({
          userId,
          contactId: contact.id,
          eventType: "CONTACT_IMPORTED" as const,
          actor: "IMPORT" as const,
          actorDetail: sourceFileName,
          payload: { importJobId: job.id, sourceFileName },
        })),
      });
      // P40-06: dual-write primary memberships for imported personal contacts
      // (each is new with a single book, so its membership is primary).
      const withBook = importedContacts.filter(
        (c): c is { id: string; bookId: string } => c.bookId !== null,
      );
      if (withBook.length > 0) {
        await db.contactBookMembership.createMany({
          data: withBook.map((c) => ({
            contactId: c.id,
            addressBookId: c.bookId,
            isPrimary: true,
          })),
          skipDuplicates: true,
        });
      }
    }

    await db.importJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        importedCount,
        skippedCount,
        committedAt: new Date(),
        completedAt: new Date(),
      },
    });

    return { importedCount, skippedCount, jobId: job.id };
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

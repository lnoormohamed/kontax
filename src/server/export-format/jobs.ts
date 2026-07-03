// P45 Surface 4: async Kontax Archive export jobs. Estimate up front, stream
// in the background, notify on completion, time-boxed download (7 days).
// Runs through the same claim-based seam as the GDPR data-export job so the
// cron runner (LXC 152) can drive it; an in-process kick keeps dev working.

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { db } from "~/server/db";
import { createNotification } from "~/server/notifications";
import {
  contactsToVCard,
  type ContactAddressEntryInput,
  type ContactDateEntryInput,
  type ContactValueEntryInput,
  type PortableContactInput,
} from "~/server/contact-portability";
import { buildKontaxArchive } from "./archive";
import {
  buildCards,
  loadExportableContacts,
  type ExportContactsFilter,
  type ExportedContactRow,
} from "./export";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const asValueEntries = (value: unknown): ContactValueEntryInput[] =>
  Array.isArray(value)
    ? value.flatMap((item) =>
        isRecord(item) && typeof item.value === "string" && item.value.trim()
          ? [{
              label: typeof item.label === "string" ? item.label : "",
              value: item.value,
              isPrimary: item.isPrimary === true,
            }]
          : [],
      )
    : [];

const asAddressEntries = (value: unknown): ContactAddressEntryInput[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (!isRecord(item)) return [];
        const s = (v: unknown) => (typeof v === "string" ? v : "");
        const formatted =
          s(item.formatted) ||
          [s(item.street), [s(item.city), s(item.state)].filter(Boolean).join(", "), s(item.postcode), s(item.country)]
            .filter(Boolean)
            .join(", ");
        if (!formatted) return [];
        return [{
          label: s(item.label),
          formatted,
          streetLine1: s(item.street) || undefined,
          cityOrTown: s(item.city) || undefined,
          stateOrProvince: s(item.state) || undefined,
          postcode: s(item.postcode) || undefined,
          countryOrRegion: s(item.country) || undefined,
        }];
      })
    : [];

const asDateEntries = (value: unknown): ContactDateEntryInput[] =>
  Array.isArray(value)
    ? value.flatMap((item) => {
        if (!isRecord(item)) return [];
        const date = typeof item.value === "string" ? item.value : typeof item.date === "string" ? item.date : "";
        if (!date.trim()) return [];
        return [{
          label: typeof item.label === "string" ? item.label : "Other",
          date,
          isPrimary: item.isPrimary === true,
        }];
      })
    : [];

const toPortableContact = (c: ExportedContactRow): PortableContactInput => ({
  fullName: c.fullName,
  firstName: c.firstName,
  middleName: c.middleName,
  lastName: c.lastName,
  phoneticFirstName: c.phoneticFirstName,
  phoneticLastName: c.phoneticLastName,
  namePrefix: c.namePrefix,
  nameSuffix: c.nameSuffix,
  nickname: c.nickname,
  email: c.email,
  phone: c.phone,
  company: c.company,
  department: c.department,
  phoneticCompany: c.phoneticCompany,
  jobTitle: c.jobTitle,
  website: c.website,
  birthday: c.birthday,
  address: c.address,
  notes: c.notes,
  emailEntries: asValueEntries(c.emailEntries),
  phoneEntries: asValueEntries(c.phoneEntries),
  websiteEntries: asValueEntries(c.websiteEntries),
  addressEntries: asAddressEntries(c.addressEntries),
  significantDates: asDateEntries(c.significantDates),
});

// Presigned-URL ceiling is 7 days — exactly the design's "expires in 7 days".
const DOWNLOAD_TTL_SECONDS = 7 * 24 * 60 * 60;

// Honest averages for the up-front estimate (photos dominate archive size).
const EST_BYTES_PER_PHOTO = 200 * 1024;
const EST_BYTES_PER_CONTACT = 2 * 1024;

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

export type ArchiveEstimate = {
  contactCount: number;
  photoCount: number;
  estimatedBytes: number;
  estimatedBytesWithoutPhotos: number;
};

export async function estimateArchiveExport(
  userId: string,
  filter: ExportContactsFilter,
): Promise<ArchiveEstimate> {
  const where = {
    userId,
    mergedIntoContactId: null,
    ...(filter.includeArchived ? {} : { archivedAt: null }),
    ...(filter.ids && filter.ids.length > 0 ? { id: { in: filter.ids } } : {}),
    ...(filter.bookId ? { bookId: filter.bookId } : {}),
  };
  const [contactCount, photoCount] = await Promise.all([
    db.contact.count({ where }),
    db.contact.count({ where: { ...where, avatarUrl: { not: null } } }),
  ]);
  const base = contactCount * EST_BYTES_PER_CONTACT;
  return {
    contactCount,
    photoCount,
    estimatedBytes: base + photoCount * EST_BYTES_PER_PHOTO,
    estimatedBytesWithoutPhotos: base,
  };
}

export type CreateArchiveJobInput = {
  includePhotos: boolean;
  includeVcardFallback: boolean;
  includeArchived?: boolean;
  contactIds?: string[];
  bookId?: string;
  filterQuery?: string;
};

export async function createKontaxArchiveJob(userId: string, input: CreateArchiveJobInput) {
  const estimate = await estimateArchiveExport(userId, {
    ids: input.contactIds,
    bookId: input.bookId,
    includeArchived: input.includeArchived,
  });

  const job = await db.kontaxExportJob.create({
    data: {
      userId,
      kind: "ARCHIVE",
      status: "PENDING",
      includeArchived: input.includeArchived ?? false,
      includePhotos: input.includePhotos,
      includeVcardFallback: input.includeVcardFallback,
      contactIds: input.contactIds && input.contactIds.length > 0 ? input.contactIds : undefined,
      bookId: input.bookId,
      filterQuery: input.filterQuery,
      totalCount: estimate.contactCount,
      photoCount: estimate.photoCount,
    },
  });

  // In-process kick so dev/staging work without the cron seam; the cron
  // runner picks up anything this process drops (deploy restarts, crashes).
  void processKontaxExportJob(job.id).catch((error) => {
    console.error("[Kontax] archive export job kick failed", error);
  });

  return job;
}

/** Atomically claim the job (PENDING → PROCESSING); false if already claimed. */
async function claimJob(jobId: string): Promise<boolean> {
  const result = await db.kontaxExportJob.updateMany({
    where: { id: jobId, status: "PENDING" },
    data: { status: "PROCESSING", startedAt: new Date() },
  });
  return result.count === 1;
}

export async function processKontaxExportJob(jobId: string): Promise<void> {
  if (!(await claimJob(jobId))) return;
  const job = await db.kontaxExportJob.findUniqueOrThrow({ where: { id: jobId } });

  try {
    const filter: ExportContactsFilter = {
      ids: Array.isArray(job.contactIds) ? (job.contactIds as string[]) : undefined,
      bookId: job.bookId ?? undefined,
      includeArchived: job.includeArchived,
    };
    const { contacts, labelRegistry, bookNames } = await loadExportableContacts(job.userId, filter);
    const exportedAt = new Date();

    await db.kontaxExportJob.update({
      where: { id: jobId },
      data: { totalCount: contacts.length },
    });

    const { cards, media, photoCount } = await buildCards(contacts, {
      labelRegistry,
      bookNames,
      mode: "archive",
      includePhotos: job.includePhotos,
      exportedAt,
      onProgress: async (done) => {
        // Cancelled from the UI? Stop packing (job row deleted or FAILED).
        const current = await db.kontaxExportJob.findUnique({
          where: { id: jobId },
          select: { status: true },
        });
        if (!current || current.status !== "PROCESSING") {
          throw new JobCancelledError();
        }
        await db.kontaxExportJob.update({
          where: { id: jobId },
          data: { progressCount: done },
        });
      },
    });

    const vcardFallback = job.includeVcardFallback
      ? contactsToVCard(contacts.map(toPortableContact))
      : null;

    const zip = await buildKontaxArchive({ cards, media, vcardFallback, exportedAt });

    const s3 = getS3();
    if (!s3) throw new Error("MinIO is not configured — set MINIO_ENDPOINT.");
    const key = `exports/kontax-archive/${job.userId}-${jobId}.zip`;
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: zip,
        ContentType: "application/zip",
      }),
    );
    const downloadUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket(), Key: key }),
      { expiresIn: DOWNLOAD_TTL_SECONDS },
    );

    const completedAt = new Date();
    const expiresAt = new Date(completedAt.getTime() + DOWNLOAD_TTL_SECONDS * 1000);
    await db.kontaxExportJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt,
        expiresAt,
        downloadUrl,
        fileSizeBytes: zip.length,
        exportedCount: cards.length,
        photoCount,
        progressCount: cards.length,
      },
    });

    const sizeMb = Math.max(1, Math.round(zip.length / (1024 * 1024)));
    await createNotification({
      userId: job.userId,
      category: "PRODUCT_UPDATES",
      title: "Your Kontax Archive is ready",
      body: `${cards.length.toLocaleString()} contacts (${sizeMb} MB). The download link is valid for 7 days.`,
      actionUrl: "/import-export",
    });
  } catch (error) {
    if (error instanceof JobCancelledError) return;
    console.error("[Kontax] archive export job failed", error);
    await db.kontaxExportJob
      .update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          errorSummary: error instanceof Error ? error.message.slice(0, 500) : "Unknown error",
          completedAt: new Date(),
        },
      })
      .catch(() => undefined);
    await createNotification({
      userId: job.userId,
      category: "PRODUCT_UPDATES",
      title: "Export didn't finish",
      body: "Something interrupted the archive export — your contacts are untouched. Try again from the export page.",
      actionUrl: "/import-export",
    }).catch(() => undefined);
  }
}

class JobCancelledError extends Error {
  constructor() {
    super("Job cancelled");
  }
}

/** Cron seam: claim + process the oldest pending job; true if one was processed. */
export async function processNextKontaxExportJob(): Promise<boolean> {
  const next = await db.kontaxExportJob.findFirst({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!next) return false;
  await processKontaxExportJob(next.id);
  return true;
}

/** Mark READY links whose presigned URL has lapsed; re-runnable afterwards. */
export async function expireKontaxExportJobs(): Promise<number> {
  const result = await db.kontaxExportJob.updateMany({
    where: { status: "COMPLETED", expiresAt: { lt: new Date() }, downloadUrl: { not: null } },
    data: { downloadUrl: null },
  });
  return result.count;
}

export async function cancelKontaxExportJob(userId: string, jobId: string): Promise<boolean> {
  const result = await db.kontaxExportJob.updateMany({
    where: { id: jobId, userId, status: { in: ["PENDING", "PROCESSING"] } },
    data: { status: "FAILED", errorSummary: "Cancelled", completedAt: new Date() },
  });
  return result.count === 1;
}

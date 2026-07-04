// P45: assembly layer — load a user's contacts and produce Card documents
// (bare or archive-mode) with photos resolved. The privacy rule is inherited
// from the read path (spec §9): this queries the exporting user's own rows;
// when Phase 40's shared-book read helper lands, it slots in here.

import { db } from "~/server/db";
import { contactToCard, type CardPhoto, type KontaxCard } from "./card";
import { mediaRefPath, type ArchiveMediaFile } from "./archive";
import { loadContactPhoto } from "./photo";

export const EXPORT_CONTACT_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  phoneticFirstName: true,
  phoneticLastName: true,
  namePrefix: true,
  nameSuffix: true,
  nickname: true,
  email: true,
  phone: true,
  website: true,
  address: true,
  birthday: true,
  company: true,
  phoneticCompany: true,
  jobTitle: true,
  department: true,
  emailEntries: true,
  phoneEntries: true,
  websiteEntries: true,
  addressEntries: true,
  significantDates: true,
  relatedPeople: true,
  customFields: true,
  labels: true,
  notes: true,
  isFavorite: true,
  isEmergency: true,
  avatarUrl: true,
  sourceType: true,
  sourceDetail: true,
  createdAt: true,
  updatedAt: true,
  bookId: true,
} as const;

export type ExportContactsFilter = {
  ids?: string[];
  bookId?: string;
  includeArchived?: boolean;
  q?: string;
};

export async function loadExportableContacts(userId: string, filter: ExportContactsFilter = {}) {
  const [contacts, labelRows, books] = await Promise.all([
    db.contact.findMany({
      where: {
        userId,
        mergedIntoContactId: null,
        ...(filter.includeArchived ? {} : { archivedAt: null }),
        ...(filter.ids && filter.ids.length > 0 ? { id: { in: filter.ids } } : {}),
        // P40-06: filter by membership so a multi-book contact exports under any
        // of its books (bookId only knows its primary/home book).
        ...(filter.bookId
          ? { bookMemberships: { some: { addressBookId: filter.bookId } } }
          : {}),
        ...(filter.q
          ? {
              OR: [
                { fullName: { contains: filter.q, mode: "insensitive" as const } },
                { email: { contains: filter.q, mode: "insensitive" as const } },
                { company: { contains: filter.q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: EXPORT_CONTACT_SELECT,
      orderBy: { fullName: "asc" },
    }),
    db.label.findMany({
      where: { userId },
      select: { name: true, color: true, position: true },
      orderBy: { position: "asc" },
    }),
    db.addressBook.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);

  const bookNames = new Map(books.map((b) => [b.id, b.name]));
  return { contacts, labelRegistry: labelRows, bookNames };
}

export type ExportedContactRow = Awaited<ReturnType<typeof loadExportableContacts>>["contacts"][number];

export type BuiltCards = {
  cards: KontaxCard[];
  media: ArchiveMediaFile[];
  photoCount: number;
};

export async function buildCards(
  contacts: ExportedContactRow[],
  context: {
    labelRegistry: Array<{ name: string; color: string; position: number }>;
    bookNames: Map<string, string>;
    mode: "bare" | "archive";
    includePhotos: boolean;
    exportedAt: Date;
    onProgress?: (done: number) => void | Promise<void>;
  },
): Promise<BuiltCards> {
  const cards: KontaxCard[] = [];
  const media: ArchiveMediaFile[] = [];
  const seenMedia = new Set<string>();
  let photoCount = 0;
  let done = 0;

  for (const contact of contacts) {
    let photo: CardPhoto | null = null;
    if (context.includePhotos && contact.avatarUrl) {
      const loaded = await loadContactPhoto(contact.avatarUrl);
      if (loaded) {
        photoCount += 1;
        if (context.mode === "bare") {
          photo = {
            mode: "dataUrl",
            bytes: loaded.bytes,
            mediaType: loaded.mediaType,
            sha256: loaded.sha256,
            width: loaded.width,
            height: loaded.height,
          };
        } else {
          photo = {
            mode: "ref",
            uri: mediaRefPath(loaded.sha256, loaded.extension),
            mediaType: loaded.mediaType,
            sha256: loaded.sha256,
            width: loaded.width,
            height: loaded.height,
          };
          if (!seenMedia.has(loaded.sha256)) {
            seenMedia.add(loaded.sha256);
            media.push({ sha256: loaded.sha256, extension: loaded.extension, bytes: loaded.bytes });
          }
        }
      }
    }

    cards.push(
      contactToCard(contact, {
        exportedAt: context.exportedAt,
        photo,
        labelRegistry: context.labelRegistry,
        books: contact.bookId && context.bookNames.has(contact.bookId)
          ? [context.bookNames.get(contact.bookId)!]
          : [],
      }),
    );

    done += 1;
    if (context.onProgress && (done % 25 === 0 || done === contacts.length)) {
      await context.onProgress(done);
    }
  }

  return { cards, media, photoCount };
}

/** Filename-safe slug for single-contact downloads (daniel-cho.json). */
export const contactFileSlug = (fullName: string) =>
  fullName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "contact";

// P45: assembly layer — load a user's contacts and produce Card documents
// (bare or archive-mode) with photos resolved. The privacy rule is inherited
// from the read path (spec §9): this queries the exporting user's own rows;
// when Phase 40's shared-book read helper lands, it slots in here.

import { db } from "~/server/db";
import { buildPrivateOverlay } from "~/lib/contact-private-fields";
import { contactToCard, type CardPhoto, type KontaxCard } from "./card";
import { mediaRefPath, type ArchiveEntry, type ArchiveMediaFile } from "./archive";
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

  // Privacy scoping (spec §9): an export is a projection of what the exporting
  // user can see. We route through the single P40-02 overlay helper — the same
  // visibility rule every read consumer uses — merging only *this* user's own
  // private-field rows onto the shared Contact row. Another member's private
  // fields are never loaded (the query is scoped to `userId`), so a non-owner's
  // export can't contain them. Today this is a verified no-op (no private rows
  // exist until Phase 40's write path lands); it establishes the correct read
  // seam now so the exporter never grows its own ad-hoc privacy filter.
  await mergeOwnPrivateFields(userId, contacts);

  const bookNames = new Map(books.map((b) => [b.id, b.name]));
  return { contacts, labelRegistry: labelRows, bookNames };
}

/** Field families that map onto an array-shaped Contact JSON column. */
const PRIVATE_OVERLAY_TARGETS = {
  EMAIL: "emailEntries",
  PHONE: "phoneEntries",
  ADDRESS: "addressEntries",
  CUSTOM: "customFields",
  LABEL: "labels",
} as const;

const appendOverlay = (existing: unknown, extra: unknown[] | undefined): unknown => {
  if (!extra || extra.length === 0) return existing;
  return [...(Array.isArray(existing) ? existing : []), ...extra];
};

/**
 * Merge the exporting user's own private-field overlay onto each contact's
 * array-shaped JSON columns via `buildPrivateOverlay` (the one visibility gate).
 * Scalar families (NOTE/BIRTHDAY) are left to the shared layer — their private
 * overlay semantics belong to Phase 40's read model, not the exporter.
 */
async function mergeOwnPrivateFields(
  userId: string,
  contacts: Array<{ id: string }>,
): Promise<void> {
  if (contacts.length === 0) return;
  const rows = await db.contactPrivateField.findMany({
    where: { userId, contactId: { in: contacts.map((c) => c.id) } },
    select: { contactId: true, userId: true, fieldType: true, label: true, value: true, position: true },
  });
  if (rows.length === 0) return;

  const byContact = new Map<string, typeof rows>();
  for (const row of rows) {
    (byContact.get(row.contactId) ?? byContact.set(row.contactId, []).get(row.contactId)!).push(row);
  }
  for (const contact of contacts) {
    const contactRows = byContact.get(contact.id);
    if (!contactRows) continue;
    const overlay = buildPrivateOverlay(contactRows, userId);
    const columns = contact as unknown as Record<string, unknown>;
    for (const [fieldType, column] of Object.entries(PRIVATE_OVERLAY_TARGETS)) {
      columns[column] = appendOverlay(columns[column], overlay[fieldType as keyof typeof overlay]);
    }
  }
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

/**
 * Archive-mode card source for `streamKontaxArchive` — the same projection as
 * `buildCards` but lazy: each contact's photo is fetched only as its entry is
 * yielded, then handed off and released, so a bulk export never holds more than
 * one photo in memory (spec §7.8). Book/registry context is identical.
 */
export async function* iterateArchiveEntries(
  contacts: ExportedContactRow[],
  context: {
    labelRegistry: Array<{ name: string; color: string; position: number }>;
    bookNames: Map<string, string>;
    includePhotos: boolean;
    exportedAt: Date;
  },
): AsyncGenerator<ArchiveEntry> {
  for (const contact of contacts) {
    let photo: CardPhoto | null = null;
    let media: ArchiveMediaFile | null = null;
    if (context.includePhotos && contact.avatarUrl) {
      const loaded = await loadContactPhoto(contact.avatarUrl);
      if (loaded) {
        photo = {
          mode: "ref",
          uri: mediaRefPath(loaded.sha256, loaded.extension),
          mediaType: loaded.mediaType,
          sha256: loaded.sha256,
          width: loaded.width,
          height: loaded.height,
        };
        media = { sha256: loaded.sha256, extension: loaded.extension, bytes: loaded.bytes };
      }
    }
    const card = contactToCard(contact, {
      exportedAt: context.exportedAt,
      photo,
      labelRegistry: context.labelRegistry,
      books:
        contact.bookId && context.bookNames.has(contact.bookId)
          ? [context.bookNames.get(contact.bookId)!]
          : [],
    });
    yield { card, media };
  }
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

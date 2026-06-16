import type { Prisma } from "../../generated/prisma";

type Tx = Prisma.TransactionClient;

// JSON columns store `null` when empty; Prisma create wants `undefined` to skip.
const jsonOrUndef = (v: unknown) => (v == null ? undefined : (v as never));

// Fields copied from a shared family contact into the personal snapshot. Kept in
// sync with addContactToFamilyBook's COPY_SELECT (src/app/actions/family.ts) so a
// leave-copy is as faithful as "Add to family book".
const COPY_SELECT = {
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
  emailEntries: true,
  phone: true,
  phoneEntries: true,
  company: true,
  phoneticCompany: true,
  jobTitle: true,
  department: true,
  website: true,
  websiteEntries: true,
  birthday: true,
  address: true,
  addressEntries: true,
  significantDates: true,
  relatedPeople: true,
  customFields: true,
  notes: true,
} as const;

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

// Find a personal-book slug that doesn't collide for this user (smith-family,
// smith-family-2, …). Respects AddressBook @@unique([userId, slug]).
async function uniqueBookSlug(tx: Tx, userId: string, base: string): Promise<string> {
  const root = slugify(base) || "family";
  let slug = root;
  for (let i = 2; ; i++) {
    const clash = await tx.addressBook.findUnique({
      where: { userId_slug: { userId, slug } },
      select: { id: true },
    });
    if (!clash) return slug;
    slug = `${root}-${i}`;
  }
}

// P34F-07: snapshot a shared family book into a private AddressBook for one user.
// Used both when a single member LEAVES (one copy) and, when the dissolution flow
// exists, per-member on full dissolution. sourceGroupBookId is preserved so a
// later re-subscribe can re-promote these contacts (p18-11). Returns the new
// AddressBook id, or null if the shared book had no contacts (nothing to keep).
export async function snapshotFamilyBookForUser(
  tx: Tx,
  args: { bookId: string; targetUserId: string; groupName: string },
): Promise<string | null> {
  const shared = await tx.groupContact.findMany({
    where: { groupAddressBookId: args.bookId },
    select: { contact: { select: COPY_SELECT } },
  });
  if (shared.length === 0) return null;

  const slug = await uniqueBookSlug(tx, args.targetUserId, args.groupName);
  const personalBook = await tx.addressBook.create({
    data: {
      userId: args.targetUserId,
      name: args.groupName,
      slug,
      isDefault: false,
      sourceGroupBookId: args.bookId,
    },
    select: { id: true },
  });

  for (const { contact } of shared) {
    await tx.contact.create({
      data: {
        userId: args.targetUserId,
        bookId: personalBook.id,
        fullName: contact.fullName,
        firstName: contact.firstName,
        middleName: contact.middleName,
        lastName: contact.lastName,
        phoneticFirstName: contact.phoneticFirstName,
        phoneticLastName: contact.phoneticLastName,
        namePrefix: contact.namePrefix,
        nameSuffix: contact.nameSuffix,
        nickname: contact.nickname,
        email: contact.email,
        emailEntries: jsonOrUndef(contact.emailEntries),
        phone: contact.phone,
        phoneEntries: jsonOrUndef(contact.phoneEntries),
        company: contact.company,
        phoneticCompany: contact.phoneticCompany,
        jobTitle: contact.jobTitle,
        department: contact.department,
        website: contact.website,
        websiteEntries: jsonOrUndef(contact.websiteEntries),
        birthday: contact.birthday,
        address: contact.address,
        addressEntries: jsonOrUndef(contact.addressEntries),
        significantDates: jsonOrUndef(contact.significantDates),
        relatedPeople: jsonOrUndef(contact.relatedPeople),
        customFields: jsonOrUndef(contact.customFields),
        notes: contact.notes,
        sourceType: "MANUAL",
        sourceDetail: `${args.groupName} (kept copy)`,
        lastMutatedBy: "MANUAL",
      },
    });
  }

  return personalBook.id;
}

import type { Prisma } from "../../generated/prisma";
import { projectContactForSharing, resolveEffectiveSharingPolicy } from "~/lib/sharing-policy";
import { setPrimaryMembership } from "~/server/contact-book-membership";

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
//
// Contact-cap EXCEPTION (P49A-06, Fable review): this is the one create path
// that deliberately does NOT check `contactsLimit`. A departing / dissolved
// member's copy of the family book is data preservation, not a new write the
// member chose — refusing (or truncating) it at the Free cap would silently
// destroy contacts they had access to. The member may end up over the cap;
// every other create path then refuses further creates until they are under
// it (nothing is ever deleted for being over). Documented in
// roadmap/build-phase/p49a-06-entitlements-teams-caps-locks.md.
export async function snapshotFamilyBookForUser(
  tx: Tx,
  args: { bookId: string; targetUserId: string; groupName: string },
): Promise<string | null> {
  const shared = await tx.groupContact.findMany({
    where: { groupAddressBookId: args.bookId },
    select: { contact: { select: COPY_SELECT } },
  });
  if (shared.length === 0) return null;

  // P48-07: never carry the departing member's policy-private fields (notes,
  // personal phone, home address, birthday, labels, custom fields) into their
  // kept personal copy — same projection as addContactToFamilyBook's COPY_SELECT,
  // resolved for this member/book so a defense-in-depth re-filter is always
  // applied, even though the shared row should already be filtered at add-time.
  const groupAddressBook = await tx.groupAddressBook.findUnique({
    where: { id: args.bookId },
    select: { groupId: true, minimumSharingPolicy: true },
  });
  const groupMember = groupAddressBook
    ? await tx.groupMember.findFirst({
        where: { groupId: groupAddressBook.groupId, userId: args.targetUserId },
        select: { sharingPolicy: true },
      })
    : null;
  const policy = resolveEffectiveSharingPolicy(
    groupMember?.sharingPolicy ?? null,
    groupAddressBook?.minimumSharingPolicy ?? null,
  );

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

  for (const raw of shared) {
    const contact = projectContactForSharing(raw.contact, policy, "family");
    const copy = await tx.contact.create({
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
      select: { id: true },
    });
    // P40-06: dual-write the primary membership for the kept personal copy.
    await setPrimaryMembership(tx, copy.id, personalBook.id);
  }

  return personalBook.id;
}

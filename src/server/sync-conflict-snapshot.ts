// Shared SyncConflict snapshot helpers, used by every connector (CardDAV in
// sync-runner.ts, Google in google-sync.ts) so the localSnapshot shape the
// P23-05 resolution UI reads is identical across providers.
import { Prisma } from "../../generated/prisma";
import {
  parseContactDateEntries,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";

// Contact fields needed to detect conflicts and build a local snapshot.
export const contactConflictSelect = Prisma.validator<Prisma.ContactSelect>()({
  id: true,
  syncUid: true,
  syncVersion: true,
  updatedAt: true,
  archivedAt: true,
  fullName: true,
  firstName: true,
  middleName: true,
  lastName: true,
  namePrefix: true,
  nameSuffix: true,
  nickname: true,
  email: true,
  emailAddresses: true,
  phone: true,
  phoneNumbers: true,
  company: true,
  jobTitle: true,
  website: true,
  birthday: true,
  significantDates: true,
  address: true,
  postalAddresses: true,
  notes: true,
});

export type ContactConflictSnapshotInput = {
  id: string;
  syncUid: string;
  syncVersion: number;
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  email: string | null;
  emailAddresses: unknown;
  phone: string | null;
  phoneNumbers: unknown;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  birthday: string | null;
  significantDates?: unknown;
  address: string | null;
  postalAddresses: unknown;
  notes: string | null;
};

export const buildLocalConflictSnapshot = (contact: ContactConflictSnapshotInput) => ({
  id: contact.id,
  syncUid: contact.syncUid,
  syncVersion: contact.syncVersion,
  fullName: contact.fullName,
  firstName: contact.firstName,
  middleName: contact.middleName,
  lastName: contact.lastName,
  namePrefix: contact.namePrefix,
  nameSuffix: contact.nameSuffix,
  nickname: contact.nickname,
  email: contact.email,
  emailAddresses: parseContactStringArray(contact.emailAddresses),
  phone: contact.phone,
  phoneNumbers: parseContactStringArray(contact.phoneNumbers),
  company: contact.company,
  jobTitle: contact.jobTitle,
  website: contact.website,
  birthday: contact.birthday,
  significantDates: parseContactDateEntries(contact.significantDates),
  address: contact.address,
  postalAddresses: parseContactPostalAddresses(contact.postalAddresses),
  notes: contact.notes,
});

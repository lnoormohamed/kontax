// Shared SyncConflict snapshot helpers, used by every connector (CardDAV in
// sync-runner.ts, Google in google-sync.ts) so the localSnapshot shape the
// P23-05 resolution UI reads is identical across providers.
import { Prisma } from "../../generated/prisma";
import { readMultiValueFields } from "~/server/contact-multi-values";
import { parseContactDateEntries } from "~/server/contact-portability";

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
  emailEntries: true,
  phone: true,
  phoneNumbers: true,
  phoneEntries: true,
  company: true,
  jobTitle: true,
  website: true,
  websiteEntries: true,
  birthday: true,
  significantDates: true,
  address: true,
  postalAddresses: true,
  addressEntries: true,
  notes: true,
  avatarUrl: true, // P44-05: photo shown side-by-side in the conflict review
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
  emailEntries?: unknown;
  phone: string | null;
  phoneNumbers: unknown;
  phoneEntries?: unknown;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  websiteEntries?: unknown;
  birthday: string | null;
  significantDates?: unknown;
  address: string | null;
  postalAddresses: unknown;
  addressEntries?: unknown;
  notes: string | null;
  avatarUrl?: string | null;
};

// P49A-10: multi-value fields come from the canonical reader — the typed
// entries plus the legacy keys (still read by the resolution UI) derived from
// them — so "keep local" restores exactly what the contact held.
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
  ...readMultiValueFields(contact),
  company: contact.company,
  jobTitle: contact.jobTitle,
  birthday: contact.birthday,
  significantDates: parseContactDateEntries(contact.significantDates),
  notes: contact.notes,
  avatarUrl: contact.avatarUrl ?? null,
});

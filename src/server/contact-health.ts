type SyncAttentionLink = {
  lastSyncedAt?: Date | null;
  lastErrorCode?: string | null;
  syncAccount?: {
    status?: string | null;
    lastSucceededAt?: Date | null;
  } | null;
};

export type ContactHealthKey =
  | "missing-methods"
  | "missing-context"
  | "unlabeled"
  | "missing-dates"
  | "sync-attention";

export type ContactHealthShape = {
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  birthday?: string | null;
  labels?: unknown;
  significantDates?: unknown;
  syncLinks?: SyncAttentionLink[] | null;
};

const STALE_SYNC_DAYS = 45;

const isBlank = (value: string | null | undefined) => (value?.trim().length ?? 0) === 0;

const asObjectArray = <T extends Record<string, unknown>>(value: unknown): T[] =>
  Array.isArray(value) ? value.filter((entry): entry is T => Boolean(entry) && typeof entry === "object") : [];

const nonEmptyDates = (value: unknown) =>
  asObjectArray<{ date?: unknown }>(value).filter(
    (entry) => typeof entry.date === "string" && entry.date.trim().length > 0,
  );

const nonEmptyLabels = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];

export const hasMissingContactMethods = (contact: ContactHealthShape) =>
  isBlank(contact.email) || isBlank(contact.phone);

export const hasWeakMetadataCoverage = (contact: ContactHealthShape) =>
  isBlank(contact.company) && isBlank(contact.jobTitle) && isBlank(contact.department);

export const hasNoLabels = (contact: ContactHealthShape) => nonEmptyLabels(contact.labels).length === 0;

export const hasIncompleteDates = (contact: ContactHealthShape) =>
  isBlank(contact.birthday) && nonEmptyDates(contact.significantDates).length === 0;

export const hasSyncAttention = (contact: ContactHealthShape, now = new Date()) => {
  if (!contact.syncLinks || contact.syncLinks.length === 0) {
    return false;
  }

  const staleCutoff = new Date(now.getTime() - STALE_SYNC_DAYS * 86_400_000);

  return contact.syncLinks.some((link) => {
    if (link.lastErrorCode) return true;

    const status = link.syncAccount?.status ?? null;
    if (status && ["ERROR", "NEEDS_REAUTH", "PAUSED"].includes(status)) {
      return true;
    }

    const freshestSync = link.lastSyncedAt ?? link.syncAccount?.lastSucceededAt ?? null;
    return !freshestSync || freshestSync < staleCutoff;
  });
};

export const matchesContactHealth = (
  contact: ContactHealthShape,
  key: ContactHealthKey,
  now = new Date(),
) => {
  switch (key) {
    case "missing-methods":
      return hasMissingContactMethods(contact);
    case "missing-context":
      return hasWeakMetadataCoverage(contact);
    case "unlabeled":
      return hasNoLabels(contact);
    case "missing-dates":
      return hasIncompleteDates(contact);
    case "sync-attention":
      return hasSyncAttention(contact, now);
  }
};

export const countContactsByHealth = (
  contacts: ContactHealthShape[],
  now = new Date(),
): Record<ContactHealthKey, number> => ({
  "missing-methods": contacts.filter((contact) => hasMissingContactMethods(contact)).length,
  "missing-context": contacts.filter((contact) => hasWeakMetadataCoverage(contact)).length,
  unlabeled: contacts.filter((contact) => hasNoLabels(contact)).length,
  "missing-dates": contacts.filter((contact) => hasIncompleteDates(contact)).length,
  "sync-attention": contacts.filter((contact) => hasSyncAttention(contact, now)).length,
});

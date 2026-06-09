import type { FieldDiff } from "./payload-schemas";

export type { FieldDiff } from "./payload-schemas";

// System/internal fields that should never appear in a user-facing diff.
const IGNORED_FIELDS = new Set<string>([
  "id",
  "userId",
  "createdAt",
  "updatedAt",
  "syncVersion",
  "syncUid",
  "syncTombstoneAt",
  "importJobId",
  "mergedIntoContactId",
  // source tracking (P10-03) — tracked separately, not a content change
  "sourceType",
  "sourceDetail",
  "lastMutatedBy",
  "lastMutatedByDetail",
]);

// Structural equality that handles Prisma Json values (objects/arrays) and
// scalars. Avoids JSON.stringify comparison since object key order is not stable.
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }
  // treat null and undefined as equivalent ("not set")
  if (a == null || b == null) {
    return a == null && b == null;
  }
  if (a instanceof Date || b instanceof Date) {
    const at = a instanceof Date ? a.getTime() : a;
    const bt = b instanceof Date ? b.getTime() : b;
    return at === bt;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }
  if (typeof a === "object") {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;
    const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
    for (const key of keys) {
      if (!deepEqual(aObj[key], bObj[key])) {
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * Field-level diff between two versions of a contact. Returns only changed
 * fields (ignoring internal/system fields); empty array means nothing changed,
 * in which case callers must NOT emit a CONTACT_UPDATED event.
 */
export function computeContactDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) {
      continue;
    }
    if (!deepEqual(before[key], after[key])) {
      diffs.push({ field: key, before: before[key] ?? null, after: after[key] ?? null });
    }
  }

  return diffs;
}

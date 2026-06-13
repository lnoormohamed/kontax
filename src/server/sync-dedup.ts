// P27-08 — Post-import deduplication for OAuth sync connectors.
//
// After an initial full import (Google P27-01 / Outlook P27-04), run the
// canonical merge-suggestion engine and record how many of the resulting OPEN
// suggestions involve contacts from the freshly-imported account, so the sync
// UI can surface a "you may have duplicates" banner. Best-effort and
// non-blocking: a failure here never fails the (already-succeeded) sync job.
import { refreshMergeSuggestionsForUser } from "~/server/contact-merge";
import { db } from "~/server/db";

// The merge engine is O(n²) over the user's whole library and runs inline in the
// sync worker; above this size we skip the auto-dedup to protect the worker (the
// user can still trigger a manual merge refresh from the merge review page).
const DEDUP_MAX_CONTACTS = 3000;

export const runPostImportDeduplication = async (params: {
  userId: string;
  syncAccountId: string;
  syncJobId: string;
  source: string;
}): Promise<number> => {
  const contactCount = await db.contact.count({
    where: { userId: params.userId, archivedAt: null },
  });
  if (contactCount > DEDUP_MAX_CONTACTS) {
    // Too large to scan inline — leave the count at 0 (no banner) and skip.
    return 0;
  }

  // Reuse the canonical engine (full refresh + OPEN/STALE reconciliation) so
  // the merge-review queue stays consistent with manual refreshes.
  await refreshMergeSuggestionsForUser(params.userId, params.source);

  // Count OPEN suggestions that involve a contact linked to this sync account —
  // i.e. duplicates attributable to this import.
  const links = await db.syncContactLink.findMany({
    where: { syncAccountId: params.syncAccountId },
    select: { contactId: true },
  });
  const linkedContactIds = links.map((l) => l.contactId);

  const count =
    linkedContactIds.length === 0
      ? 0
      : await db.mergeSuggestion.count({
          where: {
            userId: params.userId,
            status: "OPEN",
            OR: [
              { leftContactId: { in: linkedContactIds } },
              { rightContactId: { in: linkedContactIds } },
            ],
          },
        });

  await db.syncJob.update({
    where: { id: params.syncJobId },
    data: { duplicatesDetectedCount: count },
  });

  return count;
};

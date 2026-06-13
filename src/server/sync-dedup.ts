// P27-08 — Post-import deduplication for OAuth sync connectors.
//
// After an initial full import (Google P27-01 / Outlook P27-04), run the
// canonical merge-suggestion engine and record how many of the resulting OPEN
// suggestions involve contacts from the freshly-imported account, so the sync
// UI can surface a "you may have duplicates" banner. Best-effort and
// non-blocking: a failure here never fails the (already-succeeded) sync job.
import { refreshMergeSuggestionsForUser } from "~/server/contact-merge";
import { db } from "~/server/db";

export const runPostImportDeduplication = async (params: {
  userId: string;
  syncAccountId: string;
  syncJobId: string;
  source: string;
}): Promise<number> => {
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

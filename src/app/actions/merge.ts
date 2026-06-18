"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { mergeContactsForUser } from "~/server/contact-merge";

export async function dismissMergeSuggestion(
  contactAId: string,
  contactBId: string,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const userId = session.user.id;
  // Normalise order so (A,B) and (B,A) always produce the same row.
  const [aId, bId] = [contactAId, contactBId].sort() as [string, string];

  await db.mergeDismissal.upsert({
    where: { userId_contactAId_contactBId: { userId, contactAId: aId, contactBId: bId } },
    update: { dismissedAt: new Date() },
    create: { userId, contactAId: aId, contactBId: bId },
  });
}

export async function createManualMergeSuggestion(
  contactAId: string,
  contactBId: string,
): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const userId = session.user.id;
  const [aId, bId] = [contactAId, contactBId].sort() as [string, string];
  const pairKey = `${aId}::${bId}`;

  const suggestion = await db.mergeSuggestion.upsert({
    where: { userId_pairKey: { userId, pairKey } },
    update: { status: "OPEN", source: "MANUAL" },
    create: {
      userId,
      leftContactId: aId,
      rightContactId: bId,
      pairKey,
      score: 0,
      confidence: "LOW",
      hardMatch: false,
      signals: [],
      reasons: [],
      source: "MANUAL",
    },
  });

  return suggestion.id;
}

export async function quickMergeSuggestion(
  suggestionId: string,
): Promise<{ survivingContactId: string; decisionId: string | undefined }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthenticated");

  const userId = session.user.id;

  const suggestion = await db.mergeSuggestion.findFirst({
    where: { id: suggestionId, userId },
    select: {
      id: true,
      status: true,
      leftContactId: true,
      rightContactId: true,
      leftContact: { select: { id: true, createdAt: true, archivedAt: true, mergedIntoContactId: true } },
      rightContact: { select: { id: true, createdAt: true, archivedAt: true, mergedIntoContactId: true } },
    },
  });

  if (!suggestion) throw new Error("Suggestion not found.");

  // Already resolved (e.g. marked STALE by a previous merge in the same batch
  // because one contact was absorbed) — skip gracefully.
  if (suggestion.status !== "OPEN") {
    return { survivingContactId: suggestion.leftContactId, decisionId: undefined };
  }

  // Either contact absorbed by an earlier pair in the batch — skip.
  const leftAbsorbed = !!suggestion.leftContact.archivedAt || !!suggestion.leftContact.mergedIntoContactId;
  const rightAbsorbed = !!suggestion.rightContact.archivedAt || !!suggestion.rightContact.mergedIntoContactId;
  if (leftAbsorbed || rightAbsorbed) {
    await db.mergeSuggestion.update({
      where: { id: suggestion.id },
      data: { status: "STALE", reviewedAt: new Date() },
    });
    return { survivingContactId: suggestion.leftContactId, decisionId: undefined };
  }

  // Older contact wins as primary (was added first)
  const primaryIsLeft =
    suggestion.leftContact.createdAt <= suggestion.rightContact.createdAt;
  const primaryContactId = primaryIsLeft
    ? suggestion.leftContactId
    : suggestion.rightContactId;
  const secondaryContactId = primaryIsLeft
    ? suggestion.rightContactId
    : suggestion.leftContactId;

  let result;
  try {
    result = await mergeContactsForUser({
      userId,
      primaryContactId,
      secondaryContactId,
      suggestionId: suggestion.id,
      source: "quick-merge",
    });
  } catch (e) {
    console.error("[quickMergeSuggestion] mergeContactsForUser threw:", e);
    throw new Error(
      `Merge failed: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return { survivingContactId: result.survivingContactId, decisionId: result.decisionId };
}

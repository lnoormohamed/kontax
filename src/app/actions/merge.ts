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
    where: { id: suggestionId, userId, status: "OPEN" },
    select: {
      id: true,
      leftContactId: true,
      rightContactId: true,
      leftContact: { select: { id: true, createdAt: true } },
      rightContact: { select: { id: true, createdAt: true } },
    },
  });

  if (!suggestion) throw new Error("Suggestion not found.");

  // If either contact was already absorbed by a previous merge in the same
  // batch, mark this suggestion stale and return — don't error the whole group.
  const bothActive = await db.contact.count({
    where: {
      id: { in: [suggestion.leftContactId, suggestion.rightContactId] },
      archivedAt: null,
      mergedIntoContactId: null,
    },
  });
  if (bothActive < 2) {
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

  const result = await mergeContactsForUser({
    userId,
    primaryContactId,
    secondaryContactId,
    suggestionId: suggestion.id,
    source: "quick-merge",
  });

  return { survivingContactId: result.survivingContactId, decisionId: result.decisionId };
}

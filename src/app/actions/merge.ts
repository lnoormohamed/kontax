"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

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

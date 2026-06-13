"use server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

// P26-04: mutations for the first-run onboarding checklist. Each lazily creates
// the UserOnboardingState row. They return nothing — the client drives the UI
// optimistically and these just persist the state for subsequent sessions.

/** Record that the user has visited the contacts list with >= 1 contact. No-op once set. */
export async function recordOnboardingExplored(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  const existing = await db.userOnboardingState.findUnique({
    where: { userId },
    select: { exploredAt: true },
  });
  if (existing?.exploredAt) return;

  const now = new Date();
  await db.userOnboardingState.upsert({
    where: { userId },
    create: { userId, exploredAt: now },
    update: { exploredAt: now },
  });
}

/** Permanently dismiss the checklist (the × or the completion-card "Dismiss"). */
export async function dismissOnboardingChecklist(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  const now = new Date();
  await db.userOnboardingState.upsert({
    where: { userId },
    create: { userId, dismissedAt: now },
    update: { dismissedAt: now },
  });
}

/** Mark the checklist complete (all steps done + success card shown/auto-hidden). */
export async function completeOnboardingChecklist(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;

  const now = new Date();
  await db.userOnboardingState.upsert({
    where: { userId },
    create: { userId, completedAt: now },
    update: { completedAt: now },
  });
}

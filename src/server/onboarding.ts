import { db } from "~/server/db";

// P26-04: first-run onboarding checklist.
//
// Three of the four steps are derived live from existing data (you have an
// account, you have a contact, you have a healthy sync account); only the
// route-visit "explore" trigger and the dismiss/complete lifecycle are
// persisted in UserOnboardingState. The row is created lazily — a brand-new
// user has no row and simply sees the full checklist.

export type OnboardingStepId = "account" | "contact" | "sync" | "explore";

export type OnboardingStep = {
  id: OnboardingStepId;
  label: string;
  /** CTA link label for an incomplete step (null for the always-done account step). */
  cta: string | null;
  href: string | null;
  done: boolean;
};

export type OnboardingChecklist = {
  /** Render the card at all (false once dismissed or completed). */
  show: boolean;
  /** All four steps done → show the success variant. */
  allDone: boolean;
  steps: OnboardingStep[];
  doneCount: number;
  total: number;
  /**
   * The visit-with-a-contact "explore" trigger has not been persisted yet.
   * The client records it on mount so the step stays complete on later visits.
   */
  needsExploreRecord: boolean;
};

export async function getOnboardingChecklist(opts: {
  userId: string;
  hasContact: boolean;
  hasSync: boolean;
}): Promise<OnboardingChecklist> {
  const state = await db.userOnboardingState.findUnique({
    where: { userId: opts.userId },
    select: { exploredAt: true, dismissedAt: true, completedAt: true },
  });

  const exploredAt = state?.exploredAt ?? null;
  const dismissed = Boolean(state?.dismissedAt);
  const completed = Boolean(state?.completedAt);

  // "Explore your contacts" completes on a single visit to the contacts list
  // with >= 1 contact present — which is exactly the context this card renders
  // in. Treat it as done if already recorded, or completable on this visit.
  const exploreDone = Boolean(exploredAt) || opts.hasContact;

  const steps: OnboardingStep[] = [
    { id: "account", label: "Create your account", cta: null, href: null, done: true },
    { id: "contact", label: "Add your first contact", cta: "Add contact", href: "/contacts/new", done: opts.hasContact },
    { id: "sync", label: "Connect a sync account", cta: "Connect device", href: "/sync", done: opts.hasSync },
    { id: "explore", label: "Explore your contacts", cta: "Take a look", href: "/contacts", done: exploreDone },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const show = !dismissed && !completed;
  const needsExploreRecord = show && opts.hasContact && !exploredAt;

  return { show, allDone, steps, doneCount, total: steps.length, needsExploreRecord };
}

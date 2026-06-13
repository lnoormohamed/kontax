import { redirect } from "next/navigation";

import { UpgradeOnboarding } from "~/app/welcome/_components/upgrade-onboarding";
import { auth } from "~/server/auth";
import { getUserBillingContext } from "~/server/billing";
import { db } from "~/server/db";

// P26-14: Family/Teams getting-started wizard, reached from the Stripe checkout
// success_url for those plans (/welcome/family, /welcome/teams).
export default async function WelcomePage({
  params,
}: {
  params: Promise<{ plan: string }>;
}) {
  const { plan: planParam } = await params;
  const plan = planParam === "family" ? "FAMILY" : planParam === "teams" ? "TEAMS" : null;
  if (!plan) redirect("/settings");

  const session = await auth();
  if (!session?.user?.id) redirect(`/login?next=/welcome/${planParam}`);
  const userId = session.user.id;

  const billing = await getUserBillingContext(userId);
  const entitled =
    plan === "FAMILY" ? billing.entitlements.familyGroupEnabled : billing.entitlements.teamsEnabled;
  // Webhook race: if the subscription hasn't activated yet, fall back to settings
  // (the success banner shows there); the user can re-enter setup from there.
  if (!entitled) redirect("/settings?billing=success");

  const state = await db.userOnboardingState.findUnique({
    where: { userId },
    select: { upgradeOnboardingCompletedAt: true, upgradeOnboardingPlan: true },
  });
  if (state?.upgradeOnboardingCompletedAt && state.upgradeOnboardingPlan === plan) {
    redirect(plan === "FAMILY" ? "/settings/family" : "/settings/teams");
  }

  return <UpgradeOnboarding plan={plan} />;
}

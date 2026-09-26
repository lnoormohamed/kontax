import { type Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthCard } from "~/app/_components/auth-card";
import { AuthShell } from "~/app/_components/auth-ui";
import { safeInternalPath } from "~/lib/safe-internal-path";
import { auth } from "~/server/auth";
import { CardRegisterContext } from "./card-register-context";

export const metadata: Metadata = {
  title: "Get started",
  description: "Create a free Kontax account. No credit card required.",
  alternates: { canonical: "/register" },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const params = searchParams ? await searchParams : undefined;
  const rawNext = params?.next;
  const nextParam = Array.isArray(rawNext) ? rawNext[0] : rawNext;
  // P48-03: `startsWith("/")` also accepted `//evil.com` and `/\evil.com`.
  const next = nextParam ? safeInternalPath(nextParam, "/contacts") : undefined;
  const rawPlan = params?.plan;
  const plan = Array.isArray(rawPlan) ? rawPlan[0] : rawPlan;

  const rawPrefill = params?.prefill;
  const prefillParam = Array.isArray(rawPrefill) ? rawPrefill[0] : rawPrefill;

  if (session?.user) {
    // P48-02: pending-deletion sessions belong on the cancel screen.
    if (session.pendingDeletion) {
      redirect("/account-pending-deletion");
    }
    // Logged-in users visiting /register?prefill go straight to create contact with the data
    if (prefillParam) {
      redirect(`/contacts/new?prefill=${encodeURIComponent(prefillParam)}`);
    }
    redirect(next ?? "/contacts");
  }

  return (
    <AuthShell>
      {prefillParam && <CardRegisterContext prefillParam={prefillParam} />}
      <AuthCard mode="register" next={next} plan={plan} />
    </AuthShell>
  );
}

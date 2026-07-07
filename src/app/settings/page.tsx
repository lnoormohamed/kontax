import Link from "next/link";
import { redirect } from "next/navigation";

import { redirectToLogin } from "~/server/auth/require-page-auth";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { MobileSettingsNav } from "~/app/settings/_components/mobile-settings-nav";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { SETTINGS_NAV } from "~/lib/settings-nav";

// P46-13 / DB07 §4 — /settings is a NAV INDEX on both breakpoints; billing
// lives at /settings/billing (the #plan-billing anchor is dead). One URL, one
// meaning. Legacy Stripe returns that still target /settings?billing=success
// or ?portal=returned are forwarded to the billing page.

export default async function SettingsIndexPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user?.id) return redirectToLogin("/settings");

  const sp = searchParams ? await searchParams : undefined;
  if (sp?.billing === "success" || sp?.portal === "returned") {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      if (typeof v === "string") params.set(k, v);
    }
    redirect(`/settings/billing?${params.toString()}`);
  }

  const planSummary = await getUserPlanSummary(session.user.id);
  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  return (
    <>
      {/* Mobile index — the shared SETTINGS_NAV as a card list (P46-12) */}
      <MobileSettingsNav
        email={session.user.email ?? ""}
        name={userLabel}
        plan={planSummary.planLabel}
      />

      {/* Desktop index — same config, a card grid in the content area */}
      <div className="hidden lg:block">
        <h1 className="text-2xl font-semibold text-[#1d2823]">Settings</h1>
        <p className="mt-1 text-sm text-[#5c655e]">Everything about your account, data and plan.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {SETTINGS_NAV.map((entry) => (
            <Link
              key={entry.id}
              href={entry.route}
              className="flex items-center gap-3.5 rounded-2xl border border-[#d8ddd6] bg-white p-4 no-underline transition hover:bg-[#f6f7f4]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f2f4f0]">
                <WorkspaceIcon name={entry.icon} size={19} className="text-[#5c655e]" strokeWidth={1.7} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-[15px] font-semibold text-[#1d2823]">
                  {entry.label}
                  {entry.gate === "pro" ? (
                    <span className="rounded-full bg-[#edf0fe] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#4158f4]">
                      Pro
                    </span>
                  ) : null}
                </span>
                <span className="block truncate text-[12.5px] text-[#8b938c]">{entry.sub}</span>
              </span>
              <WorkspaceIcon name="chevronRight" size={17} className="shrink-0 text-[#d8ddd6]" strokeWidth={1.7} />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { updatePhoneticSettings } from "~/app/actions/settings";
import { signOut } from "~/server/auth";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const getLifecycleTone = (label: string) => {
  if (label.toLowerCase().includes("active") || label.toLowerCase().includes("trial")) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (label.toLowerCase().includes("grace")) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
};

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const planSummary = await getUserPlanSummary(session.user.id);
  const userSettings = await db.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      autoFillPhoneticNames: true,
    },
  });
  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";

  const handleSignOut = async () => {
    "use server";

    await signOut({ redirectTo: "/login" });
  };

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(201,214,170,0.45),_transparent_26%),linear-gradient(180deg,#eff3ea_0%,#f8fafc_38%,#f6f5f0_100%)] px-4 py-6 text-slate-900 lg:px-6 lg:py-8">
      <div className="mx-auto grid w-full max-w-5xl gap-6">
        <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
          <Link className="text-sm font-semibold text-[#4158f4] hover:text-[#3248db]" href="/">
            ← Back to contacts
          </Link>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#e3e8ff] text-2xl font-semibold text-[#4158f4]">
              {getInitials(userLabel)}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Settings
              </p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-900">
                Account and workspace settings
              </h1>
              <p className="mt-2 text-sm text-slate-500">{session.user.email}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-6">
            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Plan and limits</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Workspace controls now live here instead of competing with the contacts list.
                  </p>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getLifecycleTone(
                    planSummary.lifecyclePolicy.label,
                  )}`}
                >
                  {planSummary.lifecyclePolicy.label}
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Contacts used
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {planSummary.contactsUsed} / {planSummary.entitlements.contactsLimit}
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#f7f8ff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Monthly imports
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {planSummary.importedThisMonth} / {planSummary.entitlements.monthlyImportLimit}
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#fbfcf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Export access
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {planSummary.lifecyclePolicy.canUseBasicExport ? "Available" : "Restricted"}
                  </p>
                </div>
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#fdf9f1] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Sync accounts
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">
                    {planSummary.entitlements.syncAccountsLimit} available on plan
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-6 text-slate-500">
                {planSummary.lifecyclePolicy.description}
              </p>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm">
              <div>
                <p className="text-lg font-semibold text-slate-900">Pinyin and name readings</p>
                <p className="mt-1 text-sm text-slate-500">
                  Auto-fill pinyin for Chinese names, with fallback name readings for other non-Latin scripts, only when those fields are still blank.
                </p>
              </div>

              <form action={updatePhoneticSettings} className="mt-5">
                <label className="flex items-start gap-3 rounded-[1.4rem] border border-[#d8ddd6] bg-[#f8faf8] px-4 py-4 text-sm text-slate-700">
                  <input
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#4158f4] focus:ring-[#4158f4]"
                    defaultChecked={userSettings?.autoFillPhoneticNames ?? false}
                    name="autoFillPhoneticNames"
                    type="checkbox"
                    value="true"
                  />
                  <span>
                    Enable automatic pinyin and name-reading fill for first name, last name, and company when those fields are empty.
                  </span>
                </label>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Chinese names use real pinyin generation. Other non-Latin scripts still get a best-effort transliterated reading, and manual contact edits always win.
                </p>
              <button
                className="mt-4 rounded-[1.2rem] bg-[#17352e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#20443b]"
                type="submit"
              >
                Save pinyin settings
              </button>
              </form>
            </div>
          </div>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Quick links
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <Link
                  className="rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/import-export"
                >
                  Import and export
                </Link>
                <Link
                  className="rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/sync"
                >
                  Sync center
                </Link>
                <Link
                  className="rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/merge/manual"
                >
                  Manual merge
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Session
              </p>
              <p className="mt-3 text-sm text-slate-500">
                Sign out here so the contacts workspace can stay focused on the dataset itself.
              </p>
              <form action={handleSignOut} className="mt-4">
                <button
                  className="w-full rounded-[1.2rem] border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#c9d0c9] hover:bg-slate-50"
                  type="submit"
                >
                  Sign out
                </button>
              </form>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

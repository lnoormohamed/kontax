import Link from "next/link";
import { redirect } from "next/navigation";

import { AppPasswordManager } from "~/app/_components/app-password-manager";
import { updatePhoneticSettings } from "~/app/actions/settings";
import { canCreateAppPassword, listUserAppPasswords } from "~/server/app-passwords";
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
  const [appPasswords, appPasswordAllowance] = await Promise.all([
    listUserAppPasswords(session.user.id),
    canCreateAppPassword(session.user.id),
  ]);
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
                Account, preferences, and plan
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                This is the quieter side of Kontax: account details, phonetic behavior, plan
                visibility, and session controls, all kept out of the main contact workspace.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <a
              className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white"
              href="#settings-account"
            >
              Account
            </a>
            <a
              className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white"
              href="#settings-preferences"
            >
              Preferences
            </a>
            <a
              className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white"
              href="#settings-plan"
            >
              Plan
            </a>
            <a
              className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1.5 text-sm text-slate-600 transition hover:bg-white"
              href="#settings-session"
            >
              Session
            </a>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-6">
            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm" id="settings-account">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Account</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Identity and sign-in basics now live in one place instead of being scattered
                    across the workspace.
                  </p>
                </div>
                <span className="rounded-full border border-[#d8ddd6] bg-[#f8faf8] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Consumer account
                </span>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Display name
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-900">{userLabel}</p>
                </div>
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#f7f8ff] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Account email
                  </p>
                  <p className="mt-2 break-all text-lg font-semibold text-slate-900">
                    {session.user.email}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm" id="settings-preferences">
              <div>
                <p className="text-lg font-semibold text-slate-900">Preferences</p>
                <p className="mt-1 text-sm text-slate-500">
                  Personal behavior settings that shape how Kontax helps you, without changing the
                  structure of your contacts.
                </p>
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-[#d8ddd6] bg-[#fbfcf8] p-4">
                <p className="text-sm font-semibold text-slate-900">Phonetic names</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Kontax can suggest phonetic readings for first name, last name, and company when
                  those phonetic fields are still blank. Any value you enter manually always wins.
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
                    Auto-fill phonetic first name, phonetic last name, and phonetic company when
                    those fields are empty.
                  </span>
                </label>
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Chinese names use dedicated phonetic generation. Other non-Latin scripts use a
                  best-effort transliterated reading so contacts can still sort and search more naturally.
                </p>
                <button
                  className="mt-4 rounded-[1.2rem] bg-[#17352e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#20443b]"
                  type="submit"
                >
                  Save preferences
                </button>
              </form>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-sm" id="settings-plan">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold text-slate-900">Plan and limits</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Billing visibility and usage gates live here so the main product stays centered
                    on contacts instead of account administration.
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
                <p className="text-lg font-semibold text-slate-900">Device app passwords</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create revocable device-specific passwords for CardDAV clients so your main
                  Kontax login password never has to live inside a phone or sync app.
                </p>
              </div>

              <div className="mt-5 rounded-[1.4rem] border border-[#d8ddd6] bg-[#fbfcf8] p-4">
                <p className="text-sm font-semibold text-slate-900">Current allowance</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  {appPasswordAllowance.limit == null
                    ? `Your ${planSummary.planLabel} plan can create unlimited active app passwords.`
                    : `Your ${planSummary.planLabel} plan allows ${appPasswordAllowance.limit} active app password${appPasswordAllowance.limit === 1 ? "" : "s"}. You currently have ${appPasswordAllowance.current}.`}
                </p>
              </div>

              <div className="mt-5">
                <AppPasswordManager
                  allowance={appPasswordAllowance}
                  appPasswords={appPasswords}
                />
              </div>
            </div>
          </div>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Quick links</p>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Jump to the parts of Kontax that sit next to settings most often: portability,
                sync, and data cleanup.
              </p>
              <div className="mt-3 grid gap-2 text-sm">
                <Link
                  className="rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/import-export"
                >
                  Import and export center
                </Link>
                <Link
                  className="rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/sync"
                >
                  Device and sync center
                </Link>
                <Link
                  className="rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/merge/manual"
                >
                  Manual merge review
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm" id="settings-session">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Session</p>
              <p className="mt-3 text-sm text-slate-500">
                Use this for sign-out and account-session actions without putting account controls
                back inside the contact workspace.
              </p>
              <div className="mt-4 rounded-[1.3rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
                <p className="text-sm font-semibold text-slate-900">{session.user.email}</p>
                <p className="mt-1 text-sm text-slate-500">Signed in to Kontax on this browser session.</p>
                <form action={handleSignOut} className="mt-4">
                  <button
                    className="w-full rounded-[1.2rem] border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#c9d0c9] hover:bg-slate-50"
                    type="submit"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                Settings posture
              </p>
              <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
                <p>Account and plan controls now stay off the main contacts page.</p>
                <p>Preferences are separated from billing so they are easier to understand at a glance.</p>
                <p>This gives us a calmer shell for later settings growth without cluttering the workspace.</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

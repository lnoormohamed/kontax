import Link from "next/link";

import { archiveContact, createContact, restoreContact } from "~/app/actions/contacts";
import { MergeSuggestionDismissButton } from "~/app/_components/merge-suggestion-dismiss-button";
import { MergeSuggestionRefreshButton } from "~/app/_components/merge-suggestion-refresh-button";
import type { BillingLifecycleState } from "~/server/billing";
import type { PersistedMergeSuggestion } from "~/server/contact-merge";

type DashboardContact = {
  id: string;
  fullName: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  website: string | null;
  birthday: string | null;
  address: string | null;
  notes: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
};

type PlanSummary = {
  planLabel: string;
  lifecycleState: BillingLifecycleState;
  lifecycleLabel: string;
  lifecycleDescription: string;
  canWrite: boolean;
  canUseBasicExport: boolean;
  contactsUsed: number;
  contactsRemaining: number;
  contactsLimit: number;
  importedThisMonth: number;
  monthlyImportLimit: number;
  premiumExportEnabled: boolean;
};

type ContactDashboardProps = {
  activeContacts: DashboardContact[];
  archivedContacts: DashboardContact[];
  query: string;
  userLabel: string;
  planSummary: PlanSummary;
  mergeSuggestions: PersistedMergeSuggestion[];
  mergeSuggestionsRefreshed: boolean;
};

const formatTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);

const getInitials = (value: string) =>
  value
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const ContactRow = ({ contact }: { contact: DashboardContact }) => (
  <article className="grid gap-4 border-t border-white/10 px-4 py-4 text-sm text-slate-300 lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(160px,0.9fr)_minmax(220px,1.1fr)_auto] lg:items-center lg:px-6">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan-300/15 text-sm font-semibold text-cyan-100">
        {getInitials(contact.fullName)}
      </div>
      <div>
        <p className="font-semibold text-white">{contact.fullName}</p>
        <p className="text-xs text-slate-500">
          Updated {formatTimestamp(contact.updatedAt)}
          {contact.nickname ? ` · ${contact.nickname}` : ""}
        </p>
      </div>
    </div>

    <p className="break-words text-slate-300">{contact.email ?? "No email"}</p>
    <p className="text-slate-300">{contact.phone ?? "No phone"}</p>
    <div>
      <p className="text-slate-300">{contact.company ?? "No company"}</p>
      <p className="text-xs text-slate-500">{contact.jobTitle ?? "No role"}</p>
    </div>

    <div className="flex flex-wrap gap-2 lg:justify-end">
      <Link
        className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
        href={`/contacts/${contact.id}`}
      >
        Open
      </Link>
      {contact.archivedAt ? (
        <form action={restoreContact}>
          <input name="contactId" type="hidden" value={contact.id} />
          <button
            className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
            type="submit"
          >
            Restore
          </button>
        </form>
      ) : (
        <form action={archiveContact}>
          <input name="contactId" type="hidden" value={contact.id} />
          <button
            className="rounded-full border border-amber-300/30 px-3 py-2 text-xs font-semibold text-amber-200 transition hover:border-amber-200 hover:text-white"
            type="submit"
          >
            Archive
          </button>
        </form>
      )}
    </div>
  </article>
);

export function ContactDashboard({
  activeContacts,
  archivedContacts,
  query,
  userLabel,
  planSummary,
  mergeSuggestions,
  mergeSuggestionsRefreshed,
}: ContactDashboardProps) {
  const visibleCount = activeContacts.length + archivedContacts.length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.14),_transparent_35%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_30px_120px_rgba(2,8,23,0.35)] backdrop-blur">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.32em] text-cyan-200">Kontax contacts</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">
                Contact index for {userLabel}
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300 sm:text-base">
                Search, scan, and manage your contacts from a denser list-first workspace that is
                ready for imports, merges, billing rules, and future sync.
              </p>
            </div>

            <div className="grid gap-3 rounded-[1.5rem] border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300 sm:grid-cols-2 lg:min-w-[360px]">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Plan</p>
                <p className="mt-2 text-lg font-semibold text-white">{planSummary.planLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Lifecycle</p>
                <p className="mt-2 text-lg font-semibold text-white">{planSummary.lifecycleLabel}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Contacts</p>
                <p className="mt-2 text-white">
                  {planSummary.contactsUsed} / {planSummary.contactsLimit}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Imports this month</p>
                <p className="mt-2 text-white">
                  {planSummary.importedThisMonth} / {planSummary.monthlyImportLimit}
                </p>
              </div>
            </div>
          </div>
        </section>

        {mergeSuggestionsRefreshed ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Duplicate suggestions refreshed successfully.
          </div>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/90 p-5 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Views</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-4">
                  <p className="font-semibold text-white">All contacts</p>
                  <p className="mt-1 text-slate-300">{visibleCount} visible in the current workspace</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">Active</p>
                  <p className="mt-1 text-slate-400">{activeContacts.length} contacts</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="font-semibold text-white">Archived</p>
                  <p className="mt-1 text-slate-400">{archivedContacts.length} contacts</p>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Quick actions</p>
              <div className="mt-4 grid gap-3">
                <Link
                  className="rounded-full bg-cyan-300 px-4 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-200"
                  href="/merge/manual"
                >
                  Manual merge
                </Link>
                <Link
                  className="rounded-full border border-white/10 px-4 py-3 text-center font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                  href="/import-export"
                >
                  Import / export
                </Link>
                <Link
                  className="rounded-full border border-white/10 px-4 py-3 text-center font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                  href="/sync"
                >
                  Sync center
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Quick add</p>
              <p className="mt-3 text-sm text-slate-400">
                Keep first-touch contact creation lightweight, then open the detail page for richer
                fields later.
              </p>
              {!planSummary.canWrite ? (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3 text-sm text-amber-100">
                  This account is currently read-only. Reactivate billing before creating or
                  editing contacts.
                </div>
              ) : null}
              <form action={createContact} className="mt-4 grid gap-3">
                <input
                  className="rounded-2xl border border-white/10 bg-[#08101c] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                  name="fullName"
                  placeholder="Full name"
                  required
                  type="text"
                />
                <input
                  className="rounded-2xl border border-white/10 bg-[#08101c] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                  name="email"
                  placeholder="Email"
                  type="email"
                />
                <input
                  className="rounded-2xl border border-white/10 bg-[#08101c] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                  name="phone"
                  placeholder="Phone"
                  type="text"
                />
                <input
                  className="rounded-2xl border border-white/10 bg-[#08101c] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                  name="company"
                  placeholder="Company"
                  type="text"
                />
                <button
                  className="rounded-full bg-white px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!planSummary.canWrite}
                  type="submit"
                >
                  {planSummary.canWrite ? "Create contact" : "Read-only account"}
                </button>
              </form>
            </div>
          </aside>

          <section className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Contacts</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    {query ? `Results for \"${query}\"` : "List view"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {query
                      ? `${visibleCount} matching contacts across active and archived records.`
                      : `You have room for ${planSummary.contactsRemaining} more contacts on the ${planSummary.planLabel} plan.`}
                  </p>
                </div>

                <form className="flex w-full max-w-2xl gap-3" method="get">
                  <input
                    className="w-full rounded-full border border-white/10 bg-[#08101c] px-5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    defaultValue={query}
                    name="q"
                    placeholder="Search by name, email, phone, company, or role"
                    type="search"
                  />
                  <button
                    className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                    type="submit"
                  >
                    Search
                  </button>
                </form>
              </div>

              <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#08101c]/80">
                <div className="hidden border-b border-white/10 px-6 py-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 lg:grid lg:grid-cols-[minmax(220px,1.4fr)_minmax(180px,1fr)_minmax(160px,0.9fr)_minmax(220px,1.1fr)_auto]">
                  <p>Name</p>
                  <p>Email</p>
                  <p>Phone</p>
                  <p>Job title and company</p>
                  <p className="text-right">Actions</p>
                </div>

                {activeContacts.length === 0 ? (
                  <div className="px-6 py-10 text-sm text-slate-400">
                    No active contacts match this view yet.
                  </div>
                ) : (
                  activeContacts.map((contact) => <ContactRow contact={contact} key={contact.id} />)
                )}
              </div>
            </div>

            {archivedContacts.length > 0 ? (
              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(2,8,23,0.28)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Archived</p>
                    <h3 className="mt-2 text-2xl font-semibold text-white">Reversible cleanup</h3>
                  </div>
                  <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                    {archivedContacts.length} archived
                  </span>
                </div>
                <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#08101c]/80">
                  {archivedContacts.map((contact) => (
                    <ContactRow contact={contact} key={contact.id} />
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300 shadow-[0_20px_80px_rgba(2,8,23,0.25)]">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Merge and fix</p>
              <p className="mt-3 text-sm text-slate-400">
                Review likely duplicates from the list workspace and keep merge decisions auditable.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <MergeSuggestionRefreshButton />
                <span className="text-xs text-slate-500">
                  {mergeSuggestions.length} open suggestion{mergeSuggestions.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300 shadow-[0_20px_80px_rgba(2,8,23,0.25)]">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Suggestions</p>
              {mergeSuggestions.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-[#08101c]/70 p-4 text-slate-400">
                  No open duplicate suggestions are showing up right now.
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {mergeSuggestions.map((suggestion) => (
                    <article
                      className="rounded-2xl border border-white/10 bg-[#08101c]/70 p-4"
                      key={suggestion.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-white">
                          {suggestion.leftContact.fullName} ↔ {suggestion.rightContact.fullName}
                        </p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                            suggestion.confidence === "high"
                              ? "border border-rose-300/30 bg-rose-300/10 text-rose-100"
                              : "border border-amber-300/30 bg-amber-300/10 text-amber-100"
                          }`}
                        >
                          {suggestion.confidence}
                        </span>
                      </div>
                      <p className="mt-2 text-xs uppercase tracking-[0.24em] text-slate-500">
                        Score {suggestion.score} · {suggestion.hardMatch ? "hard match" : "review"}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300">
                        {suggestion.reasons.slice(0, 2).map((reason) => (
                          <p key={reason}>{reason}</p>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
                          href={`/merge-suggestions/${suggestion.id}`}
                        >
                          Review
                        </Link>
                        <MergeSuggestionDismissButton suggestionId={suggestion.id} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 text-sm text-slate-300 shadow-[0_20px_80px_rgba(2,8,23,0.25)]">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Account posture</p>
              <p className="mt-3 text-sm text-slate-400">{planSummary.lifecycleDescription}</p>
              <div className="mt-4 rounded-2xl border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
                <p>Writes allowed: {planSummary.canWrite ? "Yes" : "No"}</p>
                <p className="mt-1">Basic export preserved: {planSummary.canUseBasicExport ? "Yes" : "No"}</p>
                <p className="mt-1">Premium vCard export: {planSummary.premiumExportEnabled ? "Enabled" : "Upgrade required"}</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

import Link from "next/link";

import { archiveContact, createContact, restoreContact } from "~/app/actions/contacts";
import { MergeSuggestionDismissButton } from "~/app/_components/merge-suggestion-dismiss-button";
import { MergeSuggestionRefreshButton } from "~/app/_components/merge-suggestion-refresh-button";
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

const ContactCard = ({ contact }: { contact: DashboardContact }) => (
  <article className="rounded-[2rem] border border-white/10 bg-[#08101c]/85 p-6 shadow-[0_20px_60px_rgba(2,8,23,0.28)]">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-2xl font-semibold text-white">{contact.fullName}</h3>
          {contact.nickname ? (
            <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">
              {contact.nickname}
            </span>
          ) : null}
          {contact.archivedAt ? (
            <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
              Archived
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-slate-400">Last updated {formatTimestamp(contact.updatedAt)}</p>
      </div>

      <Link
        className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
        href={`/contacts/${contact.id}`}
      >
        Open details
      </Link>
    </div>

    <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Email</p>
        <p className="mt-2 break-words text-white">{contact.email ?? "Not added yet"}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Phone</p>
        <p className="mt-2 text-white">{contact.phone ?? "Not added yet"}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Company</p>
        <p className="mt-2 text-white">{contact.company ?? "Not added yet"}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Role</p>
        <p className="mt-2 text-white">{contact.jobTitle ?? "Not added yet"}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Website</p>
        <p className="mt-2 break-words text-white">{contact.website ?? "Not added yet"}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Birthday</p>
        <p className="mt-2 text-white">{contact.birthday ?? "Not added yet"}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4 sm:col-span-2">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Address</p>
        <p className="mt-2 whitespace-pre-wrap text-white">{contact.address ?? "Not added yet"}</p>
      </div>
      <div className="rounded-2xl border border-white/8 bg-white/5 p-4 sm:col-span-2">
        <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Notes</p>
        <p className="mt-2 whitespace-pre-wrap text-white">{contact.notes ?? "No notes yet"}</p>
      </div>
    </div>

    <div className="mt-5 flex flex-wrap gap-3">
      {contact.archivedAt ? (
        <form action={restoreContact}>
          <input name="contactId" type="hidden" value={contact.id} />
          <button
            className="rounded-full bg-cyan-300 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
            type="submit"
          >
            Restore
          </button>
        </form>
      ) : (
        <form action={archiveContact}>
          <input name="contactId" type="hidden" value={contact.id} />
          <button
            className="rounded-full border border-amber-300/30 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-200 hover:text-white"
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_35%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-12">
        <section className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur lg:grid-cols-[1.4fr_0.6fr] lg:items-end">
          <div className="space-y-3">
            <p className="text-sm uppercase tracking-[0.32em] text-cyan-200">Kontax dashboard</p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Welcome back, {userLabel}
            </h1>
            <p className="max-w-2xl text-sm text-slate-300 sm:text-base">
              Add people fast, recover archived entries when you need them, and keep one contact
              home that is ready for import, merge, billing, and sync layers next.
            </p>
          </div>

          <div className="grid gap-3 rounded-[1.75rem] border border-white/10 bg-[#08101c] p-5 text-sm text-slate-300">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Plan</p>
              <p className="mt-2 text-3xl font-semibold text-white">{planSummary.planLabel}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Contacts</p>
              <p className="mt-2 text-sm text-white">
                {planSummary.contactsUsed} / {planSummary.contactsLimit}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Imports this month</p>
              <p className="mt-2 text-sm text-white">
                {planSummary.importedThisMonth} / {planSummary.monthlyImportLimit}
              </p>
            </div>
          </div>
        </section>

        {mergeSuggestionsRefreshed ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Duplicate suggestions refreshed successfully.
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/90 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">New contact</p>
                <h2 className="text-2xl font-semibold text-white">Capture someone important</h2>
                <p className="text-sm text-slate-400">
                  Save the essentials now. Contact creation is now plan-aware so billing and product
                  limits stay honest as we grow into premium features.
                </p>
              </div>

              <form action={createContact} className="mt-6 grid gap-4 lg:grid-cols-2">
                <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                  <span>Full name</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="fullName"
                    placeholder="Ada Lovelace"
                    required
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Nickname</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="nickname"
                    placeholder="Ada"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Email</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="email"
                    placeholder="ada@example.com"
                    type="email"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Phone</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="phone"
                    placeholder="+44 20 7946 0958"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Company</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="company"
                    placeholder="Analytical Engines Ltd"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Job title</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="jobTitle"
                    placeholder="Mathematician"
                    type="text"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Website</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="website"
                    placeholder="https://example.com"
                    type="url"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Birthday</span>
                  <input
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="birthday"
                    type="date"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                  <span>Address</span>
                  <textarea
                    className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="address"
                    placeholder="123 Example Street&#10;London&#10;SW1A 1AA"
                  />
                </label>

                <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                  <span>Notes</span>
                  <textarea
                    className="min-h-28 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="notes"
                    placeholder="Where you met, relationship context, or follow-up notes"
                  />
                </label>

                <button
                  className="mt-2 rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100 lg:col-span-2"
                  type="submit"
                >
                  Save contact
                </button>
              </form>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Portability</p>
              <p className="mt-4 text-sm text-slate-300">
                CSV import plus CSV export are now part of the app, and vCard export is ready as a
                premium path.
              </p>
              <Link
                className="mt-5 inline-flex rounded-full border border-white/10 px-4 py-2 font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                href="/import-export"
              >
                Open import / export center
              </Link>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Sync foundation</p>
              <p className="mt-4 text-sm text-slate-300">
                Ticket `P5-01`: start capturing CardDAV account topology now so jobs, conflicts,
                encryption, and device compatibility can layer on top of a stable sync model.
              </p>
              <Link
                className="mt-5 inline-flex rounded-full border border-white/10 px-4 py-2 font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                href="/sync"
              >
                Open sync center
              </Link>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Possible duplicates</p>
              <p className="mt-4 text-sm text-slate-300">
                Ticket `P4-02`: duplicate suggestions now have a tracked lifecycle with refresh,
                open, dismissed, and stale states so later merge flows can build on saved review
                items instead of one-off scans.
              </p>
              <MergeSuggestionRefreshButton />
              {mergeSuggestions.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-[#08101c]/70 p-4 text-slate-400">
                  No open duplicate suggestions are showing up right now.
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {mergeSuggestions.map((suggestion) => (
                    <article
                      className="rounded-2xl border border-white/10 bg-[#08101c]/70 p-4"
                      key={`${suggestion.leftContact.id}-${suggestion.rightContact.id}`}
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
                        Score {suggestion.score} · {suggestion.hardMatch ? "hard match" : "review"} · scanned{" "}
                        {formatTimestamp(suggestion.generatedAt)}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-300">
                        {suggestion.reasons.map((reason) => (
                          <p key={reason}>{reason}</p>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          className="rounded-full bg-cyan-300 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
                          href={`/merge-suggestions/${suggestion.id}`}
                        >
                          Review merge
                        </Link>
                        <Link
                          className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                          href={`/contacts/${suggestion.leftContact.id}`}
                        >
                          Open first
                        </Link>
                        <Link
                          className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                          href={`/contacts/${suggestion.rightContact.id}`}
                        >
                          Open second
                        </Link>
                        <MergeSuggestionDismissButton suggestionId={suggestion.id} />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Manual merge</p>
              <p className="mt-4 text-sm text-slate-300">
                Ticket `P4-03`: choose any two active contacts and review a deterministic merge
                preview even when they were not surfaced as an automatic suggestion.
              </p>
              <Link
                className="mt-5 inline-flex rounded-full border border-white/10 px-4 py-2 font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                href="/merge/manual"
              >
                Open manual merge
              </Link>
            </div>
          </aside>

          <section className="grid gap-5">
            <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_80px_rgba(2,8,23,0.35)] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Your contacts</p>
                <h2 className="mt-2 text-2xl font-semibold text-white">
                  {query ? `Results for “${query}”` : "Everything in one place"}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {query
                    ? `${visibleCount} matching contacts across active and archived views.`
                    : `You have room for ${planSummary.contactsRemaining} more contacts on the ${planSummary.planLabel} plan.`}
                </p>
              </div>

              <form className="flex w-full max-w-xl gap-3 sm:w-auto" method="get">
                <input
                  className="w-full rounded-full border border-white/10 bg-[#08101c] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                  defaultValue={query}
                  name="q"
                  placeholder="Search by name, email, phone, or company"
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

            {visibleCount === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-white/15 bg-[#08101c]/80 p-10 text-center">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">No contacts yet</p>
                <h3 className="mt-3 text-2xl font-semibold text-white">
                  {query ? "No matches right now" : "Start with your first person"}
                </h3>
                <p className="mx-auto mt-3 max-w-xl text-sm text-slate-400">
                  {query
                    ? "Try a different search term or clear the filter to see your full list again."
                    : "Add one contact from the form on the left and we’ll build the rest of the workflow from this stable foundation."}
                </p>
              </div>
            ) : (
              <div className="grid gap-8">
                <section className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Active</h3>
                    <p className="text-sm text-slate-400">{activeContacts.length} visible</p>
                  </div>
                  {activeContacts.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-white/15 bg-[#08101c]/70 p-6 text-sm text-slate-400">
                      No active contacts match this view.
                    </div>
                  ) : (
                    activeContacts.map((contact) => <ContactCard contact={contact} key={contact.id} />)
                  )}
                </section>

                <section className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xl font-semibold text-white">Archived</h3>
                    <p className="text-sm text-slate-400">{archivedContacts.length} recoverable</p>
                  </div>
                  {archivedContacts.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-white/15 bg-[#08101c]/70 p-6 text-sm text-slate-400">
                      Archived contacts will appear here when you tuck someone away instead of deleting them.
                    </div>
                  ) : (
                    archivedContacts.map((contact) => <ContactCard contact={contact} key={contact.id} />)
                  )}
                </section>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

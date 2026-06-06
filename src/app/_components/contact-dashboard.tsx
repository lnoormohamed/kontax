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

const getLifecycleTone = (state: BillingLifecycleState) => {
  if (state === "ACTIVE" || state === "TRIALING") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (state === "GRACE") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-rose-200 bg-rose-50 text-rose-700";
};

const getContactMeta = (contact: DashboardContact) => {
  const parts = [contact.email, contact.phone, contact.company].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "No primary contact method yet";
};

const ContactRow = ({ contact }: { contact: DashboardContact }) => (
  <article className="grid gap-4 border-t border-slate-200 px-4 py-4 text-sm text-slate-600 transition hover:bg-slate-50 lg:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_minmax(180px,0.8fr)_minmax(220px,1fr)_auto] lg:items-center lg:px-6">
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">
        {getInitials(contact.fullName)}
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900">{contact.fullName}</p>
        <p className="truncate text-xs text-slate-500">
          {contact.nickname ? `${contact.nickname} · ` : ""}Updated {formatTimestamp(contact.updatedAt)}
        </p>
      </div>
    </div>

    <p className="truncate text-slate-600">{contact.email ?? "No email"}</p>
    <p className="truncate text-slate-600">{contact.phone ?? "No phone"}</p>
    <div className="min-w-0">
      <p className="truncate text-slate-700">{contact.jobTitle ?? "No role"}</p>
      <p className="truncate text-xs text-slate-500">{contact.company ?? "No company"}</p>
    </div>

    <div className="flex flex-wrap gap-2 lg:justify-end">
      <Link
        className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
        href={`/contacts/${contact.id}`}
      >
        Open
      </Link>
      {contact.archivedAt ? (
        <form action={restoreContact}>
          <input name="contactId" type="hidden" value={contact.id} />
          <button
            className="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500"
            type="submit"
          >
            Restore
          </button>
        </form>
      ) : (
        <form action={archiveContact}>
          <input name="contactId" type="hidden" value={contact.id} />
          <button
            className="rounded-full border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-50"
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
    <main className="min-h-screen bg-[#f3f7fb] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
        <section className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <aside className="grid gap-5 self-start xl:sticky xl:top-24">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">Workspace</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">Contacts</h1>
              <p className="mt-2 text-sm text-slate-500">
                {userLabel}, this is your list-first contact home for quick scanning, quick capture, and safer cleanup.
              </p>
              <div className="mt-5">
                <Link
                  className="inline-flex w-full items-center justify-center rounded-[1.3rem] bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-500"
                  href="#quick-add"
                >
                  Create contact
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Views</p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-[1.35rem] bg-sky-50 px-4 py-3 text-slate-900 ring-1 ring-sky-100">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold">All contacts</span>
                    <span className="text-sm text-slate-500">{visibleCount}</span>
                  </div>
                </div>
                <div className="rounded-[1.35rem] px-4 py-3 text-slate-600 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Active</span>
                    <span>{activeContacts.length}</span>
                  </div>
                </div>
                <div className="rounded-[1.35rem] px-4 py-3 text-slate-600 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">Archived</span>
                    <span>{archivedContacts.length}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Fix and manage</p>
              <div className="mt-3 grid gap-2 text-sm">
                <Link
                  className="rounded-[1.35rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/merge/manual"
                >
                  Manual merge
                </Link>
                <Link
                  className="rounded-[1.35rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/import-export"
                >
                  Import and export
                </Link>
                <Link
                  className="rounded-[1.35rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/sync"
                >
                  Sync center
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm" id="quick-add">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">Quick add</p>
              <p className="mt-2 text-sm text-slate-500">
                Capture a contact fast here, then open the detail page when you want all the richer Phase 6 fields.
              </p>
              {!planSummary.canWrite ? (
                <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  This account is read-only right now.
                </div>
              ) : null}
              <form action={createContact} className="mt-4 grid gap-3">
                <input
                  className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white"
                  name="fullName"
                  placeholder="Full name"
                  required
                  type="text"
                />
                <input
                  className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white"
                  name="email"
                  placeholder="Email"
                  type="email"
                />
                <input
                  className="rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white"
                  name="phone"
                  placeholder="Phone"
                  type="text"
                />
                <button
                  className="rounded-[1.25rem] bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!planSummary.canWrite}
                  type="submit"
                >
                  {planSummary.canWrite ? "Save quick contact" : "Read-only account"}
                </button>
              </form>
            </div>
          </aside>

          <section className="grid gap-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">Contact list</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {query ? `Results for "${query}"` : `Contacts (${activeContacts.length})`}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {query
                      ? `${visibleCount} matches across active and archived records.`
                      : `You can still add ${planSummary.contactsRemaining} more contacts on your current plan.`}
                  </p>
                </div>

                <form className="flex w-full max-w-3xl gap-3" method="get">
                  <input
                    className="w-full rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:bg-white"
                    defaultValue={query}
                    name="q"
                    placeholder="Search contacts by name, email, phone, company, role, or address"
                    type="search"
                  />
                  <button
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                    type="submit"
                  >
                    Search
                  </button>
                </form>
              </div>
            </div>

            {mergeSuggestionsRefreshed ? (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
                Duplicate suggestions refreshed successfully.
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                <div className="flex items-center gap-3">
                  <p className="text-sm font-semibold text-slate-900">Primary contacts</p>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                    {activeContacts.length} records
                  </span>
                </div>
                <p className="text-xs uppercase tracking-[0.22em] text-slate-400">
                  List-first workspace
                </p>
              </div>

              <div className="hidden border-b border-slate-200 px-6 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400 lg:grid lg:grid-cols-[minmax(220px,1.2fr)_minmax(220px,1fr)_minmax(180px,0.8fr)_minmax(220px,1fr)_auto]">
                <p>Name</p>
                <p>Email</p>
                <p>Phone</p>
                <p>Job title and company</p>
                <p className="text-right">Actions</p>
              </div>

              {activeContacts.length === 0 ? (
                <div className="px-6 py-12 text-sm text-slate-500">No active contacts match this view yet.</div>
              ) : (
                activeContacts.map((contact) => <ContactRow contact={contact} key={contact.id} />)
              )}
            </div>

            {archivedContacts.length > 0 ? (
              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Archived contacts</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Reversible cleanup stays close to the main list instead of disappearing into a separate tool.
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {archivedContacts.length} archived
                  </span>
                </div>
                {archivedContacts.map((contact) => (
                  <ContactRow contact={contact} key={contact.id} />
                ))}
              </div>
            ) : null}
          </section>

          <aside className="grid gap-5 self-start xl:sticky xl:top-24">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">Account</p>
                  <h3 className="mt-2 text-xl font-semibold text-slate-900">{planSummary.planLabel}</h3>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getLifecycleTone(
                    planSummary.lifecycleState,
                  )}`}
                >
                  {planSummary.lifecycleLabel}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{planSummary.lifecycleDescription}</p>
              <div className="mt-4 grid gap-3 rounded-[1.5rem] bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <span>Contacts used</span>
                  <span className="font-semibold text-slate-900">
                    {planSummary.contactsUsed} / {planSummary.contactsLimit}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Imports this month</span>
                  <span className="font-semibold text-slate-900">
                    {planSummary.importedThisMonth} / {planSummary.monthlyImportLimit}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Basic export</span>
                  <span className="font-semibold text-slate-900">
                    {planSummary.canUseBasicExport ? "Available" : "Restricted"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Premium vCard export</span>
                  <span className="font-semibold text-slate-900">
                    {planSummary.premiumExportEnabled ? "Enabled" : "Upgrade required"}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">Merge and fix</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Keep duplicate review visible from the same list workspace.
                  </p>
                </div>
                <MergeSuggestionRefreshButton />
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-900">Open suggestions</p>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                  {mergeSuggestions.length}
                </span>
              </div>
              {mergeSuggestions.length === 0 ? (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No duplicate suggestions are open right now.
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {mergeSuggestions.map((suggestion) => (
                    <article className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4" key={suggestion.id}>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">
                          {suggestion.leftContact.fullName} ↔ {suggestion.rightContact.fullName}
                        </p>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                            suggestion.confidence === "high"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {suggestion.confidence}
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Score {suggestion.score} · {suggestion.hardMatch ? "hard match" : "review"}
                      </p>
                      <div className="mt-3 grid gap-2 text-sm text-slate-600">
                        {suggestion.reasons.slice(0, 2).map((reason) => (
                          <p key={reason}>{reason}</p>
                        ))}
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          className="rounded-full bg-sky-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-500"
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

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600">List posture</p>
              <div className="mt-4 space-y-3 text-sm text-slate-500">
                <p>The homepage is now optimized for scanning, quick contact actions, and staying close to merge and archive workflows.</p>
                <p>Richer Phase 6 detail still lives one click away inside the contact page instead of overwhelming the main list view.</p>
                <p>{activeContacts[0] ? getContactMeta(activeContacts[0]) : "Add a contact to start filling the list."}</p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

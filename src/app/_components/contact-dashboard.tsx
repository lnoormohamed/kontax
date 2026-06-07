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

const getContactSignals = (contact: DashboardContact) =>
  [
    contact.nickname ? `Known as ${contact.nickname}` : null,
    contact.notes ? "Has notes" : null,
    contact.address ? "Has address" : null,
    contact.website ? "Has website" : null,
    contact.birthday ? "Birthday saved" : null,
  ].filter(Boolean) as string[];

const getPreviewLine = (contact: DashboardContact) => {
  if (contact.notes?.trim()) {
    return contact.notes.trim();
  }

  if (contact.address?.trim()) {
    return contact.address.trim();
  }

  if (contact.jobTitle?.trim() || contact.company?.trim()) {
    return [contact.jobTitle, contact.company].filter(Boolean).join(" at ");
  }

  if (contact.website?.trim()) {
    return contact.website.trim();
  }

  return "Open this contact to fill in more context, addresses, notes, and sync metadata.";
};

const ContactRow = ({ contact }: { contact: DashboardContact }) => {
  const signals = getContactSignals(contact).slice(0, 3);

  return (
    <article className="border-b border-[#d9ddd8] px-4 py-4 transition hover:bg-[#faf8f2] last:border-b-0 sm:px-5 xl:px-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto] xl:items-center">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#dcefe8] text-sm font-semibold text-[#145c4f]">
              {getInitials(contact.fullName)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-base font-semibold text-[#1f2937]">{contact.fullName}</p>
                {contact.archivedAt ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                    Archived
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-sm text-slate-500">
                {contact.nickname ? `${contact.nickname} · ` : ""}Updated {formatTimestamp(contact.updatedAt)}
              </p>
              <p className="mt-2 truncate text-sm text-slate-600">{getPreviewLine(contact)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-1 text-sm">
          <p className="font-medium text-slate-700">{contact.email ?? "No email saved"}</p>
          <p className="text-slate-500">{contact.phone ?? "No phone saved"}</p>
        </div>

        <div className="min-w-0 space-y-2">
          <div>
            <p className="truncate text-sm font-medium text-slate-700">{contact.jobTitle ?? "No role yet"}</p>
            <p className="truncate text-sm text-slate-500">{contact.company ?? "No company saved"}</p>
          </div>
          {signals.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {signals.map((signal) => (
                <span
                  className="rounded-full border border-[#d7e6df] bg-[#f3fbf7] px-2.5 py-1 text-[11px] font-medium text-[#38685f]"
                  key={signal}
                >
                  {signal}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Needs more detail</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          <Link
            className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[#2c8c74] hover:text-[#145c4f]"
            href={`/contacts/${contact.id}`}
          >
            Open
          </Link>
          {contact.archivedAt ? (
            <form action={restoreContact}>
              <input name="contactId" type="hidden" value={contact.id} />
              <button
                className="rounded-full bg-[#1f7a67] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#176454]"
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
      </div>
    </article>
  );
};

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
  const focusedContact = activeContacts[0] ?? archivedContacts[0] ?? null;
  const needsDetailsCount = activeContacts.filter((contact) => !contact.email && !contact.phone).length;
  const withCompanyCount = activeContacts.filter((contact) => contact.company).length;
  const withNotesCount = activeContacts.filter((contact) => contact.notes).length;

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f5efe6_0%,#edf3ef_36%,#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
        <section className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)_360px]">
          <aside className="grid gap-4 self-start xl:sticky xl:top-24">
            <div className="overflow-hidden rounded-[2rem] border border-[#d8ddd6] bg-[#17352e] text-white shadow-[0_20px_60px_rgba(23,53,46,0.16)]">
              <div className="border-b border-white/10 px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#9fd6c6]">Kontax</p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">Your contact desk</h1>
                <p className="mt-2 text-sm text-[#d6e6df]">
                  {userLabel}, this home is now tuned for faster scanning, faster edits, and less hunting.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/10 text-sm">
                <div className="bg-[#17352e] px-5 py-4">
                  <p className="text-[#9fd6c6]">Visible</p>
                  <p className="mt-2 text-2xl font-semibold">{visibleCount}</p>
                </div>
                <div className="bg-[#17352e] px-5 py-4">
                  <p className="text-[#9fd6c6]">Plan space</p>
                  <p className="mt-2 text-2xl font-semibold">{planSummary.contactsRemaining}</p>
                </div>
              </div>
              <div className="px-5 py-4">
                <Link
                  className="inline-flex w-full items-center justify-center rounded-[1.25rem] bg-[#f7c66b] px-4 py-3 text-sm font-semibold text-[#2f2410] transition hover:bg-[#f2b94a]"
                  href="#quick-add"
                >
                  Create contact
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-sm">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Smart views</p>
              <div className="mt-3 grid gap-2 text-sm">
                <div className="rounded-[1.3rem] bg-[#eef8f4] px-4 py-3 ring-1 ring-[#d2e8df]">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-semibold text-slate-900">All contacts</span>
                    <span className="text-slate-500">{visibleCount}</span>
                  </div>
                </div>
                <div className="rounded-[1.3rem] px-4 py-3 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700">Needs details</span>
                    <span className="text-slate-500">{needsDetailsCount}</span>
                  </div>
                </div>
                <div className="rounded-[1.3rem] px-4 py-3 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700">With company</span>
                    <span className="text-slate-500">{withCompanyCount}</span>
                  </div>
                </div>
                <div className="rounded-[1.3rem] px-4 py-3 ring-1 ring-slate-200">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-700">Archived</span>
                    <span className="text-slate-500">{archivedContacts.length}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-sm">
              <p className="px-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Navigation</p>
              <div className="mt-3 grid gap-2 text-sm">
                <Link
                  className="rounded-[1.3rem] px-4 py-3 text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  href="/merge/manual"
                >
                  Manual merge
                </Link>
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
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">Account</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">{planSummary.planLabel}</h2>
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${getLifecycleTone(
                    planSummary.lifecycleState,
                  )}`}
                >
                  {planSummary.lifecycleLabel}
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{planSummary.lifecycleDescription}</p>
              <div className="mt-4 grid gap-3 rounded-[1.4rem] bg-[#f8f7f3] p-4 text-sm text-slate-600">
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
              </div>
            </div>
          </aside>

          <section className="grid gap-5">
            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">Main list</p>
                  <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                    {query ? `Results for "${query}"` : "Contacts"}
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    {query
                      ? `${visibleCount} matches across active and archived records.`
                      : "A denser list view keeps names, context, and actions visible without burying the detail page."}
                  </p>
                </div>

                <form className="flex w-full max-w-3xl gap-3" method="get">
                  <input
                    className="w-full rounded-full border border-slate-200 bg-[#f8f7f3] px-5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#67b59f] focus:bg-white"
                    defaultValue={query}
                    name="q"
                    placeholder="Search by name, nickname, email, phone, company, role, website, or address"
                    type="search"
                  />
                  <button
                    className="rounded-full bg-[#17352e] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#20443b]"
                    type="submit"
                  >
                    Search
                  </button>
                </form>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Active book</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{activeContacts.length}</p>
                  <p className="mt-1 text-sm text-slate-500">Ready for quick scan and edits</p>
                </div>
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#fcfaf5] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Need enrichment</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{needsDetailsCount}</p>
                  <p className="mt-1 text-sm text-slate-500">No primary email or phone yet</p>
                </div>
                <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#f7f7fb] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Memory captured</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">{withNotesCount}</p>
                  <p className="mt-1 text-sm text-slate-500">Contacts already carrying notes</p>
                </div>
              </div>
            </div>

            {mergeSuggestionsRefreshed ? (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 shadow-sm">
                Duplicate suggestions refreshed successfully.
              </div>
            ) : null}

            <div className="overflow-hidden rounded-[2rem] border border-[#d8ddd6] bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8ddd6] px-5 py-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Primary list</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Your active directory stays front and center with quick actions on every row.
                  </p>
                </div>
                <span className="rounded-full bg-[#eef8f4] px-3 py-1 text-xs font-medium text-[#145c4f]">
                  {activeContacts.length} active
                </span>
              </div>

              {activeContacts.length === 0 ? (
                <div className="px-6 py-12 text-sm text-slate-500">No active contacts match this view yet.</div>
              ) : (
                activeContacts.map((contact) => <ContactRow contact={contact} key={contact.id} />)
              )}
            </div>

            {archivedContacts.length > 0 ? (
              <div className="overflow-hidden rounded-[2rem] border border-[#d8ddd6] bg-white shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#d8ddd6] px-5 py-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Archived contacts</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Deletes stay reversible and close to the main list instead of falling into a hidden bin.
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
            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm" id="quick-add">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">Quick add</p>
              <p className="mt-2 text-sm text-slate-500">
                Capture someone from the homepage, then jump into the detail page when you want richer fields.
              </p>
              {!planSummary.canWrite ? (
                <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  This account is read-only right now.
                </div>
              ) : null}
              <form action={createContact} className="mt-4 grid gap-3">
                <input
                  className="rounded-[1.2rem] border border-slate-200 bg-[#f8f7f3] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#67b59f] focus:bg-white"
                  name="fullName"
                  placeholder="Full name"
                  required
                  type="text"
                />
                <input
                  className="rounded-[1.2rem] border border-slate-200 bg-[#f8f7f3] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#67b59f] focus:bg-white"
                  name="email"
                  placeholder="Email"
                  type="email"
                />
                <input
                  className="rounded-[1.2rem] border border-slate-200 bg-[#f8f7f3] px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#67b59f] focus:bg-white"
                  name="phone"
                  placeholder="Phone"
                  type="text"
                />
                <button
                  className="rounded-[1.2rem] bg-[#17352e] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!planSummary.canWrite}
                  type="submit"
                >
                  {planSummary.canWrite ? "Save contact" : "Read-only account"}
                </button>
              </form>
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">Preview</p>
              {focusedContact ? (
                <div className="mt-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.35rem] bg-[#dcefe8] text-base font-semibold text-[#145c4f]">
                      {getInitials(focusedContact.fullName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-semibold text-slate-900">{focusedContact.fullName}</p>
                      <p className="mt-1 text-sm text-slate-500">{getContactMeta(focusedContact)}</p>
                      <p className="mt-1 text-sm text-slate-400">Updated {formatTimestamp(focusedContact.updatedAt)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 rounded-[1.5rem] bg-[#f8f7f3] p-4 text-sm text-slate-600">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">Company</span>
                      <span className="text-right font-medium text-slate-800">
                        {focusedContact.company ?? "Not set"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">Role</span>
                      <span className="text-right font-medium text-slate-800">
                        {focusedContact.jobTitle ?? "Not set"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">Website</span>
                      <span className="text-right font-medium text-slate-800">
                        {focusedContact.website ?? "Not set"}
                      </span>
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-slate-400">Birthday</span>
                      <span className="text-right font-medium text-slate-800">
                        {focusedContact.birthday ?? "Not set"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[1.5rem] border border-[#d8ddd6] bg-[#fcfcfa] p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Context</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{getPreviewLine(focusedContact)}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className="rounded-full bg-[#1f7a67] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#176454]"
                      href={`/contacts/${focusedContact.id}`}
                    >
                      Open detail
                    </Link>
                    {focusedContact.archivedAt ? (
                      <form action={restoreContact}>
                        <input name="contactId" type="hidden" value={focusedContact.id} />
                        <button
                          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#2c8c74] hover:text-[#145c4f]"
                          type="submit"
                        >
                          Restore
                        </button>
                      </form>
                    ) : (
                      <form action={archiveContact}>
                        <input name="contactId" type="hidden" value={focusedContact.id} />
                        <button
                          className="rounded-full border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:border-amber-400 hover:bg-amber-50"
                          type="submit"
                        >
                          Archive
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  Add a contact and this panel will become your quick preview space.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-[#d8ddd6] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#1f7a67]">Merge watch</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Keep duplicate review visible without leaving the list workspace.
                  </p>
                </div>
                <MergeSuggestionRefreshButton />
              </div>

              <div className="mt-4 flex items-center justify-between rounded-[1.4rem] bg-[#f8f7f3] px-4 py-3">
                <span className="text-sm font-medium text-slate-700">Open suggestions</span>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm">
                  {mergeSuggestions.length}
                </span>
              </div>

              {mergeSuggestions.length === 0 ? (
                <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                  No duplicate suggestions are open right now.
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {mergeSuggestions.slice(0, 3).map((suggestion) => (
                    <article className="rounded-[1.5rem] border border-[#d8ddd6] bg-[#fcfcfa] p-4" key={suggestion.id}>
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
                          className="rounded-full bg-[#1f7a67] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#176454]"
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
          </aside>
        </section>
      </div>
    </main>
  );
}

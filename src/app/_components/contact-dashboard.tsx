import Link from "next/link";

import { archiveContact, createContact, restoreContact } from "~/app/actions/contacts";

type DashboardContact = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
  archivedAt: Date | null;
  updatedAt: Date;
};

type ContactDashboardProps = {
  activeContacts: DashboardContact[];
  archivedContacts: DashboardContact[];
  query: string;
  userLabel: string;
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
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Active contacts</p>
              <p className="mt-2 text-3xl font-semibold text-white">{activeContacts.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Archived contacts</p>
              <p className="mt-2 text-3xl font-semibold text-white">{archivedContacts.length}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/90 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <div className="space-y-2">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">New contact</p>
                <h2 className="text-2xl font-semibold text-white">Capture someone important</h2>
                <p className="text-sm text-slate-400">
                  Save the essentials now. The archive-safe lifecycle and billing-ready schema are
                  now in place without forcing extra complexity into the first-use experience.
                </p>
              </div>

              <form action={createContact} className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm text-slate-200">
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
                  <span>Notes</span>
                  <textarea
                    className="min-h-28 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="notes"
                    placeholder="Where you met, relationship context, or follow-up notes"
                  />
                </label>

                <button
                  className="mt-2 rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100"
                  type="submit"
                >
                  Save contact
                </button>
              </form>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Phase progress</p>
              <ul className="mt-4 grid gap-3 text-sm text-slate-300">
                <li>Phase 1 now covers reversible archive and a dedicated contact detail view.</li>
                <li>Phase 2 billing entities are seeded in Prisma for entitlements and lifecycle work.</li>
                <li>Next phases can add import, export, merge, and sync without ownership redesign.</li>
              </ul>
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
                    : "Active contacts stay front and center while archived entries remain recoverable."}
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

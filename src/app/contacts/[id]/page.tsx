import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  archiveContact,
  undoMergeContacts,
  permanentlyDeleteContact,
  restoreContact,
  updateContact,
} from "~/app/actions/contacts";
import { auth } from "~/server/auth";
import { db } from "~/server/db";

type ContactDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatTimestamp = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);

export default async function ContactDetailPage({ params, searchParams }: ContactDetailPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const savedParam = resolvedSearchParams?.saved;
  const saveState = Array.isArray(savedParam) ? savedParam[0] : savedParam;
  const wasSaved = saveState === "1";
  const mergedParam = resolvedSearchParams?.merged;
  const mergedState = Array.isArray(mergedParam) ? mergedParam[0] : mergedParam;
  const wasMerged = mergedState === "1";
  const mergeUndoneParam = resolvedSearchParams?.mergeUndone;
  const mergeUndoneState = Array.isArray(mergeUndoneParam)
    ? mergeUndoneParam[0]
    : mergeUndoneParam;
  const wasMergeUndone = mergeUndoneState === "1";
  const decisionParam = resolvedSearchParams?.decisionId;
  const decisionId = Array.isArray(decisionParam) ? decisionParam[0] : decisionParam;
  const contact = await db.contact.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
    select: {
      id: true,
      fullName: true,
      nickname: true,
      email: true,
      phone: true,
      company: true,
      jobTitle: true,
      website: true,
      birthday: true,
      address: true,
      notes: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!contact) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-cyan-200 hover:text-cyan-100" href="/">
              ← Back to dashboard
            </Link>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-4xl font-semibold tracking-tight text-white">{contact.fullName}</h1>
              {contact.archivedAt ? (
                <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                  Archived
                </span>
              ) : (
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Active
                </span>
              )}
            </div>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Edit the canonical details here, archive when you want a reversible cleanup path, and
              reserve permanent deletion for true removal.
            </p>
          </div>

          <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-[#08101c] p-4 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Created:</span> {formatTimestamp(contact.createdAt)}
            </p>
            <p>
              <span className="text-slate-500">Updated:</span> {formatTimestamp(contact.updatedAt)}
            </p>
          </div>
        </div>

        {wasSaved ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Contact changes saved successfully.
          </div>
        ) : null}
        {wasMerged ? (
          <div className="rounded-[1.75rem] border border-cyan-300/25 bg-cyan-300/10 p-4 text-sm text-cyan-100 shadow-[0_20px_60px_rgba(34,211,238,0.12)]">
            Merge completed successfully. You can undo this merge from the merge audit card below
            while we are still in the Phase 4 reversible merge model.
          </div>
        ) : null}
        {wasMergeUndone ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            Merge undo completed. The archived secondary contact has been restored and the primary
            contact has been rolled back to its pre-merge state.
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
            <div className="space-y-2">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Contact details</p>
              <h2 className="text-2xl font-semibold text-white">Update this record</h2>
            </div>

            <form action={updateContact} className="mt-6 grid gap-4 lg:grid-cols-2">
              <input name="contactId" type="hidden" value={contact.id} />
              <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}?saved=1`} />

              <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                <span>Full name</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.fullName}
                  name="fullName"
                  required
                  type="text"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                <span>Nickname</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.nickname ?? ""}
                  name="nickname"
                  type="text"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                <span>Email</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.email ?? ""}
                  name="email"
                  type="email"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                <span>Phone</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.phone ?? ""}
                  name="phone"
                  type="text"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                <span>Company</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.company ?? ""}
                  name="company"
                  type="text"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                <span>Job title</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.jobTitle ?? ""}
                  name="jobTitle"
                  type="text"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                <span>Website</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.website ?? ""}
                  name="website"
                  type="url"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200">
                <span>Birthday</span>
                <input
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.birthday ?? ""}
                  name="birthday"
                  type="date"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                <span>Address</span>
                <textarea
                  className="min-h-24 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.address ?? ""}
                  name="address"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-200 lg:col-span-2">
                <span>Notes</span>
                <textarea
                  className="min-h-36 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
                  defaultValue={contact.notes ?? ""}
                  name="notes"
                />
              </label>

              <div className="lg:col-span-2">
                <button
                  className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                  type="submit"
                >
                  Save changes
                </button>
              </div>
            </form>
          </div>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Lifecycle</p>
              <div className="mt-4 grid gap-3">
                {contact.archivedAt ? (
                  <form action={restoreContact}>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                    <button
                      className="w-full rounded-full bg-cyan-300 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
                      type="submit"
                    >
                      Restore contact
                    </button>
                  </form>
                ) : (
                  <form action={archiveContact}>
                    <input name="contactId" type="hidden" value={contact.id} />
                    <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                    <button
                      className="w-full rounded-full border border-amber-300/30 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-200 hover:text-white"
                      type="submit"
                    >
                      Archive contact
                    </button>
                  </form>
                )}
                <p className="text-sm text-slate-400">
                  Archive is reversible and keeps the record available for later restore.
                </p>
                {!contact.archivedAt ? (
                  <Link
                    className="inline-flex rounded-full border border-white/10 px-4 py-3 text-center text-sm font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                    href={`/merge/manual?left=${contact.id}`}
                  >
                    Start manual merge
                  </Link>
                ) : null}
              </div>
            </div>

            {decisionId ? (
              <div className="rounded-[2rem] border border-cyan-300/20 bg-cyan-300/5 p-6 text-sm text-slate-300">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Merge audit</p>
                <p className="mt-4 text-sm text-slate-300">
                  Ticket `P4-05`: this merge stored a reversible snapshot so you can roll back the
                  primary record and restore the archived secondary record if needed.
                </p>
                <form action={undoMergeContacts} className="mt-4">
                  <input name="decisionId" type="hidden" value={decisionId} />
                  <input name="redirectTo" type="hidden" value={`/contacts/${contact.id}`} />
                  <button
                    className="w-full rounded-full border border-cyan-300/30 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200 hover:text-white"
                    type="submit"
                  >
                    Undo last merge
                  </button>
                </form>
              </div>
            ) : null}

            <div className="rounded-[2rem] border border-rose-300/20 bg-rose-300/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-rose-200">Danger zone</p>
              <p className="mt-4 text-sm text-slate-300">
                Permanent delete removes this record completely. Use archive unless you want true removal.
              </p>
              <form action={permanentlyDeleteContact} className="mt-4">
                <input name="contactId" type="hidden" value={contact.id} />
                <input name="redirectTo" type="hidden" value="/" />
                <button
                  className="w-full rounded-full border border-rose-300/40 px-4 py-3 text-sm font-semibold text-rose-200 transition hover:border-rose-200 hover:text-white"
                  type="submit"
                >
                  Permanently delete
                </button>
              </form>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

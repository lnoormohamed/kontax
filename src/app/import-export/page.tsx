import Link from "next/link";
import { redirect } from "next/navigation";

import { ImportJobRollbackButton } from "~/app/_components/import-job-rollback-button";
import { ImportPreviewForm } from "~/app/_components/import-preview-form";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";

type ImportExportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ImportExportPage({ searchParams }: ImportExportPageProps) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const importedParam = resolvedSearchParams?.imported;
  const importedValue = Array.isArray(importedParam) ? importedParam[0] : importedParam;
  const importCompleted = importedValue === "1";
  const rolledBackParam = resolvedSearchParams?.rolledBack;
  const rolledBackValue = Array.isArray(rolledBackParam) ? rolledBackParam[0] : rolledBackParam;
  const rollbackCompleted = rolledBackValue === "1";

  const [planSummary, importJobs, exportJobs] = await Promise.all([
    getUserPlanSummary(session.user.id),
    db.importJob.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.exportJob.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.18),_transparent_30%),linear-gradient(180deg,#020617_0%,#07111d_45%,#0f172a_100%)] text-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-8 lg:px-10 lg:py-12">
        <div className="flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-[0_30px_120px_rgba(2,8,23,0.45)] backdrop-blur sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link className="text-sm font-semibold text-cyan-200 hover:text-cyan-100" href="/">
              ← Back to dashboard
            </Link>
            <p className="mt-4 text-sm uppercase tracking-[0.35em] text-cyan-200">Import / export</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
              Move contacts in and out without losing control.
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300 sm:text-base">
              This first Phase 3 slice supports generic CSV import, CSV export for everyone, and
              premium vCard export for Apple and wider address-book portability.
            </p>
          </div>

          <div className="grid gap-2 rounded-[1.5rem] border border-white/10 bg-[#08101c] p-5 text-sm text-slate-300">
            <p>
              <span className="text-slate-500">Plan:</span> {planSummary.planLabel}
            </p>
            <p>
              <span className="text-slate-500">Contacts:</span> {planSummary.contactsUsed} / {planSummary.entitlements.contactsLimit}
            </p>
            <p>
              <span className="text-slate-500">Monthly imports:</span> {planSummary.importedThisMonth} / {planSummary.entitlements.monthlyImportLimit}
            </p>
          </div>
        </div>

        {importCompleted ? (
          <div className="rounded-[1.75rem] border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm text-emerald-100 shadow-[0_20px_60px_rgba(16,185,129,0.12)]">
            Import completed successfully.
          </div>
        ) : null}
        {rollbackCompleted ? (
          <div className="rounded-[1.75rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100 shadow-[0_20px_60px_rgba(251,191,36,0.12)]">
            Import rollback completed. Imported contacts from that job were archived.
          </div>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="grid gap-6">
            <ImportPreviewForm />

            <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Recent import jobs</p>
              <div className="mt-4 grid gap-3 text-sm text-slate-300">
                {importJobs.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-slate-400">
                    No imports yet.
                  </p>
                ) : (
                  importJobs.map((job) => (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" key={job.id}>
                      <p className="font-semibold text-white">{job.sourceFileName ?? "CSV import"}</p>
                      <p className="mt-1 text-slate-400">
                        {job.status} · imported {job.importedCount} of {job.rowCount} rows
                      </p>
                      <p className="mt-1 text-slate-500">
                        {(job.sourceProfile ?? "GENERIC").toLowerCase()} profile · previewed{" "}
                        {job.previewContactCount} contacts · {job.warningCount} warnings
                      </p>
                      <p className="mt-1 text-slate-500">
                        {job.previewedAt
                          ? `Previewed ${job.previewedAt.toLocaleString()}`
                          : "Preview pending"}
                        {job.committedAt ? ` · committed ${job.committedAt.toLocaleString()}` : ""}
                      </p>
                      {job.rolledBackAt ? (
                        <p className="mt-1 text-amber-200">
                          Rolled back {job.rolledBackCount} contacts on {job.rolledBackAt.toLocaleString()}
                        </p>
                      ) : null}
                      {job.errorSummary ? <p className="mt-2 text-amber-200">{job.errorSummary}</p> : null}
                      {job.status === "COMPLETED" &&
                      job.importedCount > 0 &&
                      job.rolledBackAt == null ? (
                        <ImportJobRollbackButton jobId={job.id} />
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Export</p>
              <p className="mt-4 text-sm text-slate-400">
                Ticket `P3-03`: export all active contacts, include archived contacts in CSV, or
                export a filtered subset by search term.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Ticket `P3-06`: import history now keeps rollback context so users can safely
                reverse a bulk import by archiving the contacts that job created.
              </p>
              <form
                action="/api/exports/contacts/csv"
                className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                method="get"
              >
                <label className="grid gap-2 text-sm text-slate-200">
                  <span>Filter contacts before export</span>
                  <input
                    className="rounded-full border border-white/10 bg-[#08101c] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                    name="q"
                    placeholder="Search by name, email, phone, or company"
                    type="text"
                  />
                </label>
                <label className="flex items-center gap-3 text-sm text-slate-300">
                  <input
                    className="h-4 w-4 rounded border-white/10 bg-[#08101c] text-cyan-300"
                    name="includeArchived"
                    type="checkbox"
                    value="true"
                  />
                  <span>Include archived contacts in CSV export</span>
                </label>
                <button
                  className="rounded-full bg-cyan-300 px-4 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-200"
                  type="submit"
                >
                  Download CSV export
                </button>
              </form>
              {planSummary.entitlements.premiumExportEnabled ? (
                <form
                  action="/api/exports/contacts/vcard"
                  className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-white/5 p-4"
                  method="get"
                >
                  <label className="grid gap-2 text-sm text-slate-200">
                    <span>Filter vCard export</span>
                    <input
                      className="rounded-full border border-white/10 bg-[#08101c] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
                      name="q"
                      placeholder="Search active contacts before exporting"
                      type="text"
                    />
                  </label>
                  <button
                    className="rounded-full border border-white/10 px-4 py-3 text-center font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                    type="submit"
                  >
                    Download vCard export
                  </button>
                </form>
              ) : (
                <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                  vCard export unlocks on Plus and Pro plans.
                </div>
              )}
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Recent export jobs</p>
              <div className="mt-4 grid gap-3">
                {exportJobs.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-4 text-slate-400">
                    No exports yet.
                  </p>
                ) : (
                  exportJobs.map((job) => (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4" key={job.id}>
                      <p className="font-semibold text-white">
                        {job.resultFileName ?? job.format}
                      </p>
                      <p className="mt-1 text-slate-400">
                        {job.status} · exported {job.exportedCount} contacts
                      </p>
                      <p className="mt-1 text-slate-500">
                        Filter: {job.filterQuery?.trim() ? job.filterQuery : "all contacts"}
                      </p>
                      {job.errorSummary ? <p className="mt-2 text-amber-200">{job.errorSummary}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

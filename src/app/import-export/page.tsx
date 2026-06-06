import Link from "next/link";
import { redirect } from "next/navigation";

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
                      {job.errorSummary ? <p className="mt-2 text-amber-200">{job.errorSummary}</p> : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <aside className="grid gap-6 self-start">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
              <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Export</p>
              <div className="mt-4 grid gap-3">
                <a
                  className="rounded-full bg-cyan-300 px-4 py-3 text-center font-semibold text-slate-950 transition hover:bg-cyan-200"
                  href="/api/exports/contacts/csv"
                >
                  Download CSV export
                </a>
                {planSummary.entitlements.premiumExportEnabled ? (
                  <a
                    className="rounded-full border border-white/10 px-4 py-3 text-center font-semibold text-white transition hover:border-cyan-300 hover:text-cyan-100"
                    href="/api/exports/contacts/vcard"
                  >
                    Download vCard export
                  </a>
                ) : (
                  <div className="rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                    vCard export unlocks on Plus and Pro plans.
                  </div>
                )}
              </div>
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
                      <p className="font-semibold text-white">{job.format}</p>
                      <p className="mt-1 text-slate-400">
                        {job.status} · exported {job.exportedCount} contacts
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

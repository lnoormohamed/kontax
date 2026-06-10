import Link from "next/link";
import { redirect } from "next/navigation";

import { AppShell } from "~/app/_components/app-shell";
import { ExportCard } from "~/app/_components/export-card";
import { ImportJobRollbackButton } from "~/app/_components/import-job-rollback-button";
import { ImportPreviewForm } from "~/app/_components/import-preview-form";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { auth } from "~/server/auth";
import { getUserPlanSummary } from "~/server/billing";
import { db } from "~/server/db";

type ImportExportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const formatHistoryDate = (value: Date) =>
  new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(value);

const PROFILE_LABEL: Record<string, string> = {
  GENERIC: "Generic",
  GOOGLE: "Google",
  APPLE: "Apple",
  OUTLOOK: "Outlook",
};

function QuotaStat({ used, cap, reset }: { used: number; cap: number | null; reset: string }) {
  if (cap === null) {
    return (
      <section className="rounded-2xl border border-[#d8ddd6] bg-[#fbfcf9] px-5 py-[18px]">
        <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">This month</div>
        <div className="mt-3 text-[24px] font-bold tracking-[-0.01em] text-[#1d2823]">Unlimited</div>
        <div className="mt-1 text-[13px] text-[#5c655e]">imports on your plan.</div>
      </section>
    );
  }
  const pct = cap > 0 ? Math.min(100, Math.round((used / cap) * 100)) : 0;
  return (
    <section className="rounded-2xl border border-[#d8ddd6] bg-[#fbfcf9] px-5 py-[18px]">
      <div className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">This month</div>
      <div className="mt-3 flex items-baseline gap-1.5 tabular-nums">
        <span className="text-[26px] font-bold tracking-[-0.01em] text-[#1d2823]">{used}</span>
        <span className="text-[15px] font-semibold text-[#8b938c]">of {cap} imports used</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e9ece7]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 100 ? "#bf8526" : "#4158f4" }} />
      </div>
      <div className="mt-2.5 text-[12.5px] leading-[1.5] text-[#5c655e]">
        Resets <b className="text-[#1d2823]">{reset}</b>.{" "}
        <Link className="font-semibold text-[#4158f4]" href="/pricing">Upgrade</Link> for unlimited.
      </div>
    </section>
  );
}

export default async function ImportExportPage({ searchParams }: ImportExportPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const params = searchParams ? await searchParams : undefined;
  const rolledBackParam = params?.rolledBack;
  const rolledBack = (Array.isArray(rolledBackParam) ? rolledBackParam[0] : rolledBackParam) === "1";

  const [planSummary, importJobs, contactsCount] = await Promise.all([
    getUserPlanSummary(userId),
    // History shows committed imports only — abandoned previews never reach commit.
    db.importJob.findMany({ where: { userId, committedAt: { not: null } }, orderBy: { createdAt: "desc" }, take: 6 }),
    db.contact.count({ where: { userId, archivedAt: null } }),
  ]);

  const cap = planSummary.entitlements.monthlyImportLimit;
  const used = planSummary.importedThisMonth;
  const remaining = cap === null ? Infinity : cap - used;
  const gate: "none" | "near" | "limit" = cap === null ? "none" : remaining <= 0 ? "limit" : remaining === 1 ? "near" : "none";

  const now = new Date();
  const resetDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }).format(
    new Date(now.getFullYear(), now.getMonth() + 1, 1),
  );

  const userLabel = session.user.name?.trim() ?? session.user.email?.split("@")[0] ?? "Kontax";
  const account = { name: userLabel, email: session.user.email ?? "", plan: planSummary.planLabel };

  return (
    <AppShell account={account}>
      <div className="mx-auto grid w-full max-w-[1060px] content-start gap-4 px-9 pb-24 pt-8">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8b938c]">Data</div>
            <h1 className="mt-1.5 text-[clamp(23px,2.5vw,29px)] font-semibold tracking-[-0.02em] text-[#1d2823]">
              Import &amp; export
            </h1>
            <p className="mt-2 text-[14.5px] leading-[1.5] text-[#5c655e]">
              Bring contacts in from a CSV file, or export your contacts to CSV or vCard.
            </p>
          </div>

          {rolledBack ? (
            <div className="flex items-center gap-2.5 rounded-[11px] bg-[#e3efe7] px-3.5 py-2.5 text-[13.5px] font-medium text-[#1c6b48]">
              <WorkspaceIcon name="check" size={16} strokeWidth={2.2} />
              Import undone. The imported contacts were archived.
            </div>
          ) : null}

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.85fr)_minmax(0,1fr)]">
            <ImportPreviewForm gate={gate} quota={{ used, cap: cap ?? 0, reset: resetDate }} />

            <div className="grid content-start gap-4">
              <ExportCard hasContacts={contactsCount > 0} premiumExport={planSummary.entitlements.premiumExportEnabled} />
              <QuotaStat cap={cap} reset={resetDate} used={used} />
            </div>
          </div>

          {/* Import history (full width) */}
          <section className="rounded-2xl border border-[#d8ddd6] bg-white px-6 pb-3.5 pt-[22px] shadow-[0_1px_2px_rgba(20,30,25,0.03)]">
            <div className="mb-3.5 flex items-center gap-2.5">
              <WorkspaceIcon name="archive" size={15} />
              <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">Import history</span>
            </div>
            {importJobs.length === 0 ? (
              <div className="py-7 text-center text-[14px] text-[#8b938c]">No imports yet.</div>
            ) : (
              <div>
                <div className="grid grid-cols-[132px_minmax(0,1.5fr)_116px_76px_104px_48px] gap-x-3.5 border-b-[1.5px] border-[#e9ece7] px-3 pb-2.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#8b938c]">
                  <span>Date</span>
                  <span>File</span>
                  <span>Source</span>
                  <span className="text-right">Count</span>
                  <span>Status</span>
                  <span />
                </div>
                {importJobs.map((job) => {
                  const undone = job.rolledBackAt != null;
                  const canUndo = job.status === "COMPLETED" && job.importedCount > 0 && !undone;
                  return (
                    <div
                      className="grid grid-cols-[132px_minmax(0,1.5fr)_116px_76px_104px_48px] items-center gap-x-3.5 border-b border-[#e9ece7] px-3 py-3 text-[13.5px]"
                      key={job.id}
                    >
                      <span className={`font-medium text-[#5c655e] ${undone ? "line-through" : ""}`}>
                        {formatHistoryDate(job.createdAt)}
                      </span>
                      <span className={`min-w-0 truncate font-semibold ${undone ? "text-[#8b938c] line-through" : "text-[#1d2823]"}`}>
                        {job.sourceFileName ?? "CSV import"}
                      </span>
                      <span className="text-[#5c655e]">{PROFILE_LABEL[job.sourceProfile ?? "GENERIC"] ?? "Generic"}</span>
                      <span className="text-right font-semibold tabular-nums text-[#5c655e]">{job.importedCount}</span>
                      <span>
                        {undone ? (
                          <span className="inline-block rounded-full bg-[#f2f4f0] px-2 py-0.5 text-[11px] font-bold text-[#8b938c]">Undone</span>
                        ) : (
                          <span className="inline-block rounded-full bg-[#e7efe9] px-2 py-0.5 text-[11px] font-bold text-[#17352e]">Imported</span>
                        )}
                      </span>
                      <span className="flex justify-end">
                        {canUndo ? <ImportJobRollbackButton jobId={job.id} /> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
    </AppShell>
  );
}

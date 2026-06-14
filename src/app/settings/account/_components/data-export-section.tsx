"use client";

import { useEffect, useState } from "react";

import { getDataExportStatus, requestDataExport } from "~/app/actions/data-export";
import { ConfirmPasswordModal } from "~/app/_components/confirm-password-modal";

type ExportJob = Awaited<ReturnType<typeof getDataExportStatus>>;

function Spinner({ size = 15 }: { size?: number }) {
  return (
    <span
      className="st-spin inline-block rounded-full"
      style={{
        width: size,
        height: size,
        border: "2px solid rgba(255,255,255,.35)",
        borderTopColor: "#fff",
      }}
    />
  );
}

function SpinnerDark({ size = 16 }: { size?: number }) {
  return (
    <span
      className="st-spin inline-block rounded-full"
      style={{
        width: size,
        height: size,
        border: "2px solid rgba(23,53,46,.2)",
        borderTopColor: "#17352e",
      }}
    />
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRelative(date: Date): string {
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHr = Math.round(diffMin / 60);
  const absDiffMin = Math.abs(diffMin);
  const absDiffHr = Math.abs(diffHr);

  if (diffMs > 0) {
    if (absDiffMin < 2) return "in a moment";
    if (absDiffHr < 2) return `in ${absDiffMin} min`;
    return `in ${absDiffHr} hours`;
  } else {
    if (absDiffMin < 2) return "just now";
    if (absDiffHr < 2) return `${absDiffMin} min ago`;
    if (absDiffHr < 48) return `${absDiffHr} hours ago`;
    return date.toLocaleDateString();
  }
}

export function DataExportSection({ hasPassword }: { hasPassword: boolean }) {
  const [job, setJob] = useState<ExportJob>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [showStepUp, setShowStepUp] = useState(false);

  useEffect(() => {
    getDataExportStatus().then(setJob).catch(console.error);
  }, []);

  useEffect(() => {
    if (!job || job.status === "READY" || job.status === "FAILED" || job.status === "EXPIRED") {
      return;
    }
    const interval = setInterval(() => {
      getDataExportStatus().then(setJob).catch(console.error);
    }, 5_000);
    return () => clearInterval(interval);
  }, [job?.status]);

  const executeRequest = async () => {
    setRequesting(true);
    try {
      await requestDataExport({ includeArchived });
      const updated = await getDataExportStatus();
      setJob(updated);
    } finally {
      setRequesting(false);
    }
  };

  const handleRequest = () => {
    if (hasPassword) { setShowStepUp(true); return; }
    void executeRequest();
  };

  const isIdle = !job || job.status === "EXPIRED" || job.status === "FAILED";
  const isPreparing = job?.status === "PENDING" || job?.status === "PROCESSING";
  const isReady = job?.status === "READY";
  const isFailed = job?.status === "FAILED";
  const isExpired = job?.status === "EXPIRED";

  return (
    <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] md:p-6">
      {showStepUp && (
        <ConfirmPasswordModal
          title="Confirm your identity"
          description="Enter your password to request a data export."
          confirmLabel="Request export"
          onConfirmed={async () => { setShowStepUp(false); await executeRequest(); }}
          onClose={() => setShowStepUp(false)}
        />
      )}
      <p className="mb-1 text-[14.5px] font-semibold text-[#1d2823]">Data export</p>
      <p className="mb-4 max-w-[520px] text-[13px] leading-[1.55] text-[#5c655e]">
        Download all your Kontax data as a ZIP file: contacts (vCard + CSV), activity log,
        billing summary, and account info.
      </p>

      {isExpired && (
        <p className="mb-3 text-[13px] text-[#9a3a23]">
          Your previous export has expired. Request a new one below.
        </p>
      )}

      {isFailed && (
        <div className="mb-4 rounded-[1.2rem] border border-[#ecd0c7] bg-[#f7e9e4] px-4 py-3">
          <p className="text-[13.5px] font-semibold text-[#8f3320]">Export failed</p>
          <p className="mt-0.5 text-[13px] text-[#5c655e]">
            Something went wrong preparing your export. You can try again.
          </p>
        </div>
      )}

      {isIdle && (
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2.5 text-[13.5px] text-[#5c655e]">
            <input
              checked={includeArchived}
              className="h-4 w-4 accent-[#17352e]"
              onChange={(e) => setIncludeArchived(e.target.checked)}
              type="checkbox"
            />
            Include archived contacts
          </label>
          <button
            className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
            disabled={requesting}
            onClick={handleRequest}
            type="button"
          >
            {requesting ? (
              <>
                <Spinner size={14} /> Requesting…
              </>
            ) : (
              "Request data export"
            )}
          </button>
        </div>
      )}

      {isPreparing && (
        <div className="flex items-center gap-3 rounded-[1.2rem] bg-[#f2f4f0] px-4 py-3.5">
          <SpinnerDark size={16} />
          <div>
            <p className="text-[13.5px] font-semibold text-[#1d2823]">Preparing your export…</p>
            <p className="mt-0.5 text-[12px] text-[#8b938c]">
              This usually takes less than a minute. This page updates automatically.
            </p>
          </div>
        </div>
      )}

      {isReady && job && (
        <div className="rounded-[1.2rem] border border-[#b6d9c0] bg-[#e3efe7] px-4 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13.5px] font-semibold text-[#1d2823]">Your export is ready</p>
              <p className="mt-0.5 text-[12px] text-[#5c655e]">
                {job.completedAt && `Prepared ${formatRelative(new Date(job.completedAt))}`}
                {job.expiresAt && ` · Expires ${formatRelative(new Date(job.expiresAt))}`}
                {job.fileSizeBytes && ` · ${formatFileSize(job.fileSizeBytes)}`}
              </p>
            </div>
            <a
              download="kontax-data-export.zip"
              href={job.downloadUrl!}
              className="inline-flex items-center gap-1.5 rounded-[1.2rem] bg-[#17352e] px-4 py-2.5 text-[13.5px] font-semibold text-white no-underline transition hover:bg-[#20443b]"
            >
              <svg
                fill="none"
                height="14"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                viewBox="0 0 24 24"
                width="14"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
              Download
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

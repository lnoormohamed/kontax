"use client";

import Link from "next/link";
import { useRef, useState, type ChangeEvent, type DragEvent } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import {
  FieldMappingStep,
  type ApiColumnMapping,
  type ResolvedMapping,
} from "~/app/_components/import-field-mapping";

type ImportProfile = "GENERIC" | "GOOGLE" | "APPLE" | "OUTLOOK";

type PreviewIssue = { rowNumber: number; severity: "error" | "warning"; message: string };

type PreviewContact = {
  rowNumber: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
};

type PreviewResponse = {
  jobId: string;
  contacts: PreviewContact[];
  totalRows: number;
  skippedCount: number;
  issues: PreviewIssue[];
  profile: ImportProfile;
  canImport: boolean;
  blockingReasons: string[];
  columnMappings: ApiColumnMapping[];
};

const SOURCES: Array<{ id: ImportProfile; label: string }> = [
  { id: "GENERIC", label: "Generic" },
  { id: "GOOGLE", label: "Google" },
  { id: "APPLE", label: "Apple" },
  { id: "OUTLOOK", label: "Outlook" },
];

const formatSize = (bytes?: number) => {
  if (!bytes) return "CSV";
  if (bytes < 1024) return `${bytes} B · CSV`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB · CSV`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB · CSV`;
};

function DocGlyph() {
  return (
    <svg fill="none" height={20} stroke="#5c655e" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.7} viewBox="0 0 24 24" width={20}>
      <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v4h4" />
      <path d="M9 13h6M9 16.5h6" />
    </svg>
  );
}

function StepDot({ n, label, state }: { n: number; label: string; state: "active" | "done" | "future" }) {
  const bg = state === "active" ? "#4158f4" : state === "done" ? "#1f8a5b" : "#fff";
  return (
    <div className="flex shrink-0 flex-col items-center gap-1.5">
      <span
        className={`grid h-6 w-6 place-items-center rounded-full text-[12px] font-bold leading-none ${
          state === "future" ? "border border-[#d8ddd6] text-[#8b938c]" : "text-white"
        }`}
        style={{ background: bg }}
      >
        {state === "done" ? <WorkspaceIcon name="check" size={13} strokeWidth={2.4} /> : n}
      </span>
      <span className={`text-[12px] ${state === "future" ? "font-medium text-[#8b938c]" : "font-semibold text-[#1d2823]"}`}>
        {label}
      </span>
    </div>
  );
}

function StepIndicator({ step }: { step: 1 | 2 | 3 | 4 }) {
  const states: Array<"active" | "done" | "future"> = [
    step > 1 ? "done" : "active",
    step === 2 ? "active" : step > 2 ? "done" : "future",
    step === 3 ? "active" : step > 3 ? "done" : "future",
    step === 4 ? "active" : "future",
  ];
  const line = (i: number) => (states[i] === "done" ? "#1f8a5b" : "#d8ddd6");
  return (
    <div className="flex items-start justify-center px-2 pt-1">
      <StepDot n={1} label="Upload file" state={states[0]!} />
      <span className="mt-[11px] h-0.5 w-full max-w-[72px] rounded" style={{ background: line(0) }} />
      <StepDot n={2} label="Map fields" state={states[1]!} />
      <span className="mt-[11px] h-0.5 w-full max-w-[72px] rounded" style={{ background: line(1) }} />
      <StepDot n={3} label="Preview" state={states[2]!} />
      <span className="mt-[11px] h-0.5 w-full max-w-[72px] rounded" style={{ background: line(2) }} />
      <StepDot n={4} label="Done" state={states[3]!} />
    </div>
  );
}

export function ImportPreviewForm({
  gate,
  quota,
}: {
  /** Free-plan import quota gate. */
  gate: "none" | "near" | "limit";
  quota: { used: number; cap: number; reset: string };
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [resolvedMappings, setResolvedMappings] = useState<ResolvedMapping[]>([]);
  const [profile, setProfile] = useState<ImportProfile>("GENERIC");
  const [csvText, setCsvText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | undefined>(undefined);
  const [paste, setPaste] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [over, setOver] = useState(false);
  const [nearDismissed, setNearDismissed] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmUndo, setConfirmUndo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setCsvText("");
    setFileName(null);
    setFileSize(undefined);
    setPaste("");
    setPreview(null);
    setResolvedMappings([]);
    setError("");
  };

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setFileSize(file.size);
    setCsvText(await file.text());
    setPaste("");
    setError("");
    if (/google/i.test(file.name)) setProfile("GOOGLE");
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    void takeFile(e.dataTransfer.files?.[0]);
  };

  const onPaste = (value: string) => {
    setPaste(value);
    setCsvText(value);
    setFileName(value.trim() ? "pasted-import.csv" : null);
    setFileSize(undefined);
    setError("");
  };

  const canContinue = csvText.trim().length > 0;

  const goPreview = async () => {
    if (!canContinue) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/imports/contacts/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csvText, profile, sourceFileName: fileName ?? "import.csv", sourceFileSizeBytes: fileSize }),
    });
    const data = (await res.json().catch(() => null)) as (PreviewResponse & { message?: string }) | null;
    setBusy(false);
    if (!res.ok || !data) {
      setError(data?.message ?? "Couldn't read this file. Check the format and try again.");
      return;
    }
    setPreview(data);
    setStep(2);
  };

  const doImport = async () => {
    if (!preview) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/imports/contacts/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csvText,
        profile,
        sourceFileName: fileName ?? "import.csv",
        sourceFileSizeBytes: fileSize,
        jobId: preview.jobId,
        columnMappings: resolvedMappings.length > 0 ? resolvedMappings : undefined,
      }),
    });
    const data = (await res.json().catch(() => null)) as { importedCount?: number; message?: string } | null;
    setBusy(false);
    if (!res.ok) {
      setError(data?.message ?? "Import failed.");
      return;
    }
    setImportedCount(data?.importedCount ?? preview.contacts.length);
    setStep(4);
  };

  const doUndo = async () => {
    if (!preview) return;
    setConfirmUndo(false);
    setBusy(true);
    const res = await fetch("/api/imports/contacts/rollback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: preview.jobId }),
    });
    if (res.ok) {
      window.location.href = "/import-export?rolledBack=1";
      return;
    }
    setBusy(false);
    setError("Couldn't undo the import. Try again from the history below.");
  };

  const warnings = preview?.issues.filter((i) => i.severity === "warning") ?? [];
  const warnRows = new Set(warnings.map((w) => w.rowNumber));
  const limited = gate === "limit";

  return (
    <section className="rounded-2xl border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.03)]">
      <StepIndicator step={step} />
      <div className="my-[18px] h-px bg-[#e9ece7]" />

      {error ? (
        <p className="mb-[18px] rounded-[11px] border border-[#ecd0c7] bg-[#f7e9e4] px-[14px] py-2.5 text-[13px] text-[#8f3320]">
          {error}
        </p>
      ) : null}

      {/* ── Step 1 ── */}
      {step === 1 ? (
        <div className="grid gap-[18px]">
          {gate === "near" && !nearDismissed ? (
            <div className="flex items-center gap-2.5 rounded-[10px] border border-[#e9ece7] bg-[#f6edd9] px-3 py-2.5 text-[13px] text-[#7a5a1a]">
              <WorkspaceIcon name="warning" size={16} />
              <span className="flex-1">
                1 import remaining this month.{" "}
                <Link className="font-semibold text-[#4158f4]" href="/pricing">Upgrade</Link> for unlimited imports.
              </span>
              <button aria-label="Dismiss" className="text-[#7a5a1a]" onClick={() => setNearDismissed(true)} type="button">
                <WorkspaceIcon name="x" size={14} />
              </button>
            </div>
          ) : null}

          {limited ? (
            <div className="grid gap-3 rounded-xl border-2 border-dashed border-[#bf8526] bg-[#f6edd9] px-5 py-6 text-center">
              <div className="text-[14px] font-medium text-[#1d2823]">
                You&rsquo;ve used <b>{quota.used} of {quota.cap}</b> imports this month.
              </div>
              <Link
                className="flex h-11 items-center justify-center rounded-[10px] bg-[#4158f4] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8]"
                href="/pricing"
              >
                Upgrade to Pro to import more contacts
              </Link>
              <div className="text-[13px] text-[#5c655e]">
                Your import limit resets on <b className="text-[#1d2823]">{quota.reset}</b>.
              </div>
            </div>
          ) : fileName ? (
            <div className="flex items-center gap-3 rounded-xl border border-[#d8ddd6] bg-[#f2f4f0] px-4 py-3.5">
              <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[9px] border border-[#d8ddd6] bg-white">
                <DocGlyph />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold text-[#1d2823]">{fileName}</span>
                <span className="block text-[12.5px] text-[#8b938c]">{formatSize(fileSize)}</span>
              </span>
              <button
                aria-label="Remove file"
                className="grid h-8 w-8 place-items-center rounded-lg text-[#8b938c] hover:bg-[#f2f4f0]"
                onClick={() => {
                  reset();
                  if (inputRef.current) inputRef.current.value = "";
                }}
                type="button"
              >
                <WorkspaceIcon name="x" size={16} />
              </button>
            </div>
          ) : (
            <button
              className="flex flex-col items-center justify-center gap-3 rounded-[14px] border-2 border-dashed p-5 text-center transition min-h-[64px] md:min-h-[208px] md:p-7"
              onClick={() => inputRef.current?.click()}
              onDragLeave={() => setOver(false)}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
              }}
              onDrop={onDrop}
              style={{ borderColor: over ? "#4158f4" : "#d8ddd6", background: over ? "#edf0fe" : "#f9faf8" }}
              type="button"
            >
              <WorkspaceIcon name="upload" size={36} />
              {over ? (
                <div className="text-[15px] font-semibold text-[#4158f4]">Release to upload</div>
              ) : (
                <>
                  <div className="hidden text-[16px] font-semibold text-[#5c655e] md:block">Drag &amp; drop your CSV file here</div>
                  <div className="text-[14px] text-[#8b938c]">
                    <span className="font-semibold text-[#4158f4]">Choose file</span>
                    <span className="hidden md:inline"> or drag &amp; drop</span>
                  </div>
                  <div className="text-[12px] text-[#8b938c]">CSV files only</div>
                </>
              )}
            </button>
          )}
          <input
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e: ChangeEvent<HTMLInputElement>) => void takeFile(e.target.files?.[0])}
            ref={inputRef}
            type="file"
          />

          {!limited ? (
            <div>
              <button
                className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#5c655e]"
                onClick={() => setShowPaste((o) => !o)}
                type="button"
              >
                <span className={`inline-flex transition-transform ${showPaste ? "rotate-90" : ""}`}>
                  <WorkspaceIcon name="more" size={15} />
                </span>
                Or paste CSV directly
              </button>
              {showPaste ? (
                <textarea
                  className="mt-2.5 min-h-[120px] w-full resize-y rounded-[10px] border border-[#d8ddd6] bg-white px-3.5 py-3 font-mono text-[13px] leading-[1.55] text-[#1d2823] outline-none"
                  onChange={(e) => onPaste(e.target.value)}
                  placeholder={"name,email,phone\nJane Cooper,jane@acme.co,+1 555 0100"}
                  value={paste}
                />
              ) : null}
            </div>
          ) : null}

          {/* source format */}
          <div className="grid gap-2.5" style={{ opacity: limited ? 0.45 : 1, pointerEvents: limited ? "none" : "auto" }}>
            <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8b938c]">Source format</div>
            <div className="grid grid-cols-4 gap-2.5">
              {SOURCES.map((s) => {
                const on = profile === s.id;
                return (
                  <button
                    className="grid h-16 place-items-center gap-1 rounded-[10px] transition"
                    key={s.id}
                    onClick={() => setProfile(s.id)}
                    style={{
                      border: on ? "2px solid #4158f4" : "1px solid #d8ddd6",
                      background: on ? "#edf0fe" : "#fff",
                    }}
                    type="button"
                  >
                    <DocGlyph />
                    <span className="text-[11px] font-semibold" style={{ color: on ? "#4158f4" : "#5c655e" }}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {!limited ? (
            <button
              className="flex h-11 items-center justify-center rounded-[10px] bg-[#4158f4] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canContinue || busy}
              onClick={() => void goPreview()}
              type="button"
            >
              {busy ? "Reading…" : "Continue →"}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* ── Step 2 — map fields ── */}
      {step === 2 && preview ? (
        <FieldMappingStep
          initialMappings={preview.columnMappings}
          onBack={() => setStep(1)}
          onContinue={(mappings) => {
            setResolvedMappings(mappings);
            setStep(3);
          }}
        />
      ) : null}

      {/* ── Step 3 — preview ── */}
      {step === 3 && preview ? (
        <div className="relative grid gap-4">
          <div>
            <div className="text-[13px] text-[#5c655e]">
              {fileName} · {SOURCES.find((s) => s.id === profile)?.label}
            </div>
            <div className="mt-1.5 text-[14.5px] font-semibold tabular-nums">
              <span className="text-[#1d2823]">{preview.contacts.length} contacts found</span>
              <span className="text-[#8b938c]"> · </span>
              <span style={{ color: warnings.length > 0 ? "#bf8526" : "#8b938c" }}>{warnings.length} with warnings</span>
              <span className="text-[#8b938c]"> · </span>
              <span style={{ color: preview.skippedCount > 0 ? "#b5472f" : "#8b938c" }}>{preview.skippedCount} will skip</span>
            </div>
          </div>

          <div style={{ opacity: busy ? 0.4 : 1, pointerEvents: busy ? "none" : "auto" }}>
            <div className="grid grid-cols-[1.3fr_1.6fr_1.2fr_0.9fr] gap-x-3.5 pb-2.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#8b938c]">
              <span>Name</span>
              <span>Email</span>
              <span>Phone</span>
              <span>Company</span>
            </div>
            {preview.contacts.slice(0, 10).map((r) => {
              const warn = warnRows.has(r.rowNumber);
              return (
                <div
                  className="grid grid-cols-[1.3fr_1.6fr_1.2fr_0.9fr] items-center gap-x-3.5 border-b border-[#e9ece7] py-2.5 text-[14px]"
                  key={r.rowNumber}
                  style={warn ? { borderLeft: "3px solid #bf8526", paddingLeft: 10, marginLeft: -10 } : undefined}
                >
                  <span className="flex min-w-0 items-center gap-1.5 truncate font-medium text-[#1d2823]">
                    {warn ? <WorkspaceIcon name="warning" size={14} /> : null}
                    {r.fullName}
                  </span>
                  <span className="truncate text-[#5c655e]">{r.email ?? "—"}</span>
                  <span className="truncate text-[#5c655e]">{r.phone ?? "—"}</span>
                  <span className="truncate text-[#5c655e]">{r.company ?? "—"}</span>
                </div>
              );
            })}
            {preview.contacts.length > 10 ? (
              <div className="pt-2.5 text-[12.5px] text-[#8b938c]">Showing first 10 of {preview.contacts.length}</div>
            ) : null}
          </div>

          {warnings.length > 0 ? (
            <div className="border-l-[3px] border-[#bf8526] pl-3">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-[#7a5a1a]">
                <WorkspaceIcon name="warning" size={15} /> {warnings.length} warnings
              </div>
              <div className="mt-2 grid gap-1.5">
                {warnings.slice(0, 6).map((w) => (
                  <div className="text-[13px] text-[#5c655e]" key={`${w.rowNumber}-${w.message}`}>
                    <b className="font-semibold text-[#1d2823]">Row {w.rowNumber}:</b> {w.message}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {!preview.canImport ? (
            <div className="rounded-xl border border-[#ecd0c7] bg-[#f7e9e4] p-4 text-[13px] text-[#8f3320]">
              <p className="font-semibold">Import blocked</p>
              <ul className="mt-1.5 grid gap-1">
                {preview.blockingReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row">
            <button
              className="h-11 rounded-[10px] border border-[#d8ddd6] bg-white px-[18px] text-[14.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-50"
              disabled={busy}
              onClick={() => setStep(2)}
              type="button"
            >
              ← Back
            </button>
            <button
              className="h-11 flex-1 rounded-[10px] bg-[#4158f4] px-[18px] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy || preview.contacts.length === 0 || !preview.canImport}
              onClick={() => void doImport()}
              type="button"
            >
              {busy ? "Importing…" : `Import ${preview.contacts.length} contacts →`}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Step 4 — success ── */}
      {step === 4 ? (
        <div className="grid gap-[18px]">
          <div className="flex items-center gap-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e3efe7]">
              <WorkspaceIcon name="check" size={20} strokeWidth={2.4} />
            </span>
            <div className="text-[20px] font-semibold tracking-[-0.01em] text-[#1d2823]">Import complete</div>
          </div>
          <div className="text-[16px] leading-[1.5] text-[#5c655e] tabular-nums">
            <div>
              <b className="font-semibold text-[#1d2823]">{importedCount} contacts</b> imported
            </div>
            {preview && preview.skippedCount > 0 ? (
              <div>
                <span className="font-semibold text-[#bf8526]">{preview.skippedCount} skipped</span>
              </div>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2.5 sm:flex-row">
            <Link
              className="flex h-11 items-center justify-center rounded-[10px] bg-[#4158f4] px-[18px] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8]"
              href="/contacts"
            >
              ← View contacts
            </Link>
            <button
              className="h-11 rounded-[10px] border border-[#d8ddd6] bg-white px-[18px] text-[14.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-50"
              disabled={busy}
              onClick={() => setConfirmUndo(true)}
              type="button"
            >
              Undo import
            </button>
          </div>
        </div>
      ) : null}

      {confirmUndo ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(20,30,25,0.42)] p-4" onClick={() => setConfirmUndo(false)}>
          <div className="w-full max-w-[430px] rounded-[18px] bg-white p-6 shadow-[0_24px_60px_rgba(20,30,25,0.25)]" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="mb-3.5 flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#f6edd9]">
                <WorkspaceIcon name="archive" size={20} />
              </span>
              <h3 className="text-[17px] font-semibold text-[#1d2823]">Archive this import?</h3>
            </div>
            <p className="mb-5 text-[14px] leading-[1.55] text-[#5c655e]">
              This will archive the <b className="text-[#1d2823]">{importedCount} contacts</b> added in this import. You can
              restore them from Archived later. Continue?
            </p>
            <div className="flex justify-end gap-2.5">
              <button className="h-[42px] rounded-[10px] px-[18px] text-[14px] font-semibold text-[#5c655e]" onClick={() => setConfirmUndo(false)} type="button">
                Cancel
              </button>
              <button className="h-[42px] rounded-[10px] bg-[#b5472f] px-[18px] text-[14px] font-semibold text-white transition hover:bg-[#9a3a23]" onClick={() => void doUndo()} type="button">
                Yes, archive import
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

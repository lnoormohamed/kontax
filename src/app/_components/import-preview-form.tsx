"use client";

import { useState, type ChangeEvent } from "react";

type ImportProfile = "GENERIC" | "GOOGLE" | "APPLE" | "OUTLOOK";

type PreviewIssue = {
  rowNumber: number;
  severity: "error" | "warning";
  message: string;
};

type PreviewContact = {
  rowNumber: number;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  notes?: string | null;
};

type PreviewResponse = {
  contacts: PreviewContact[];
  totalRows: number;
  skippedCount: number;
  issues: PreviewIssue[];
  profile: ImportProfile;
};

const PROFILE_OPTIONS: Array<{
  value: ImportProfile;
  label: string;
  description: string;
}> = [
  {
    value: "GENERIC",
    label: "Generic CSV",
    description: "Best for hand-made CSV files or exports with simple column names.",
  },
  {
    value: "GOOGLE",
    label: "Google Contacts CSV",
    description: "Uses Google-style name, email, phone, and organization columns.",
  },
  {
    value: "APPLE",
    label: "Apple Contacts CSV",
    description: "Optimized for Apple-style first name, last name, email, and note fields.",
  },
  {
    value: "OUTLOOK",
    label: "Outlook CSV",
    description: "Matches Outlook-style email, phone, and company column names.",
  },
];

export function ImportPreviewForm() {
  const [profile, setProfile] = useState<ImportProfile>("GENERIC");
  const [csvText, setCsvText] = useState("");
  const [sourceFileName, setSourceFileName] = useState("pasted-import.csv");
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setSourceFileName(file.name);
    setCsvText(await file.text());
    setPreview(null);
    setError("");
  };

  const handlePreview = async () => {
    if (!csvText.trim()) {
      setError("Paste CSV data or choose a CSV file before previewing.");
      setPreview(null);
      return;
    }

    setIsPreviewing(true);
    setError("");

    const response = await fetch("/api/imports/contacts/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        csvText,
        profile,
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | (PreviewResponse & { message?: string })
      | { message?: string }
      | null;

    if (!response.ok) {
      setPreview(null);
      setError(data?.message ?? "Preview failed.");
      setIsPreviewing(false);
      return;
    }

    setPreview(data as PreviewResponse);
    setIsPreviewing(false);
  };

  const handleImport = async () => {
    if (!preview) {
      return;
    }

    setIsImporting(true);
    setError("");

    const response = await fetch("/api/imports/contacts/commit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        csvText,
        profile,
        sourceFileName,
      }),
    });

    const data = (await response.json().catch(() => null)) as { message?: string } | null;

    if (!response.ok) {
      setError(data?.message ?? "Import failed.");
      setIsImporting(false);
      return;
    }

    window.location.href = "/import-export?imported=1";
  };

  const selectedProfile =
    PROFILE_OPTIONS.find((option) => option.value === profile) ?? PROFILE_OPTIONS[0];
  const warningCount =
    preview?.issues.filter((issue) => issue.severity === "warning").length ?? 0;
  const errorCount = preview?.issues.filter((issue) => issue.severity === "error").length ?? 0;

  return (
    <div className="grid gap-6">
      <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
        <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Import CSV</p>
        <h2 className="mt-3 text-2xl font-semibold text-white">Preview before you commit</h2>
        <p className="mt-3 text-sm text-slate-400">
          Ticket `P3-02` and `P3-06`: sniff the CSV profile, review the parsed contacts, then
          confirm the import only when the preview looks right.
        </p>

        <div className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm text-slate-200">
            <span>CSV profile</span>
            <select
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-cyan-300"
              onChange={(event) => {
                setProfile(event.target.value as ImportProfile);
                setPreview(null);
                setError("");
              }}
              value={profile}
            >
              {PROFILE_OPTIONS.map((option) => (
                <option className="bg-slate-950 text-white" key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
            <p className="font-semibold text-white">{selectedProfile.label}</p>
            <p className="mt-2 text-slate-400">{selectedProfile.description}</p>
          </div>

          <label className="grid gap-2 text-sm text-slate-200">
            <span>CSV file</span>
            <input
              accept=".csv,text/csv"
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-full file:border-0 file:bg-cyan-300 file:px-4 file:py-2 file:font-semibold file:text-slate-950"
              onChange={handleFileChange}
              type="file"
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-200">
            <span>Or paste CSV directly</span>
            <textarea
              className="min-h-56 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300"
              onChange={(event) => {
                setCsvText(event.target.value);
                setSourceFileName("pasted-import.csv");
                setPreview(null);
                setError("");
              }}
              placeholder={
                "Full Name,Email,Phone,Company,Notes\nAda Lovelace,ada@example.com,+44 20 7946 0958,Analytical Engines Ltd,First imported contact"
              }
              value={csvText}
            />
          </label>

          {error ? (
            <div className="rounded-2xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-100">
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full bg-white px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-100 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isPreviewing}
              onClick={handlePreview}
              type="button"
            >
              {isPreviewing ? "Building preview..." : "Preview import"}
            </button>

            {preview ? (
              <button
                className="rounded-full bg-cyan-300 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isImporting || preview.contacts.length === 0}
                onClick={handleImport}
                type="button"
              >
                {isImporting ? "Importing..." : "Confirm import"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {preview ? (
        <>
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Preview summary</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Rows read</p>
                <p className="mt-2 text-2xl font-semibold text-white">{preview.totalRows}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Ready to import</p>
                <p className="mt-2 text-2xl font-semibold text-white">{preview.contacts.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Warnings</p>
                <p className="mt-2 text-2xl font-semibold text-white">{warningCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[#08101c] p-4">
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Skipped rows</p>
                <p className="mt-2 text-2xl font-semibold text-white">{preview.skippedCount}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-400">
              Ticket `P3-05`: row-level issues are surfaced before commit so the import stays
              deterministic and reviewable.
            </p>
            {errorCount > 0 || warningCount > 0 ? (
              <div className="mt-4 grid gap-3">
                {preview.issues.map((issue) => (
                  <div
                    className={`rounded-2xl border p-4 text-sm ${
                      issue.severity === "error"
                        ? "border-rose-300/20 bg-rose-300/10 text-rose-100"
                        : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                    }`}
                    key={`${issue.severity}-${issue.rowNumber}-${issue.message}`}
                  >
                    <p className="font-semibold">
                      Row {issue.rowNumber} {issue.severity === "error" ? "error" : "warning"}
                    </p>
                    <p className="mt-1">{issue.message}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-[#08101c]/88 p-6 shadow-[0_20px_80px_rgba(2,8,23,0.35)]">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-200">Contacts to import</p>
            <div className="mt-4 grid gap-4">
              {preview.contacts.map((contact) => (
                <article
                  className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300"
                  key={`${contact.rowNumber}-${contact.fullName}-${contact.email ?? contact.phone ?? "contact"}`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.28em] text-cyan-200">
                      Row {contact.rowNumber}
                    </p>
                    <h3 className="text-lg font-semibold text-white">{contact.fullName}</h3>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <p>
                      <span className="text-slate-500">Email:</span> {contact.email ?? "Not provided"}
                    </p>
                    <p>
                      <span className="text-slate-500">Phone:</span> {contact.phone ?? "Not provided"}
                    </p>
                    <p>
                      <span className="text-slate-500">Company:</span> {contact.company ?? "Not provided"}
                    </p>
                    <p>
                      <span className="text-slate-500">Notes:</span> {contact.notes ?? "Not provided"}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

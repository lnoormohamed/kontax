"use client";

import { useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

// Compact read-only metadata row (label · monospace value · copy button that
// flashes a check). Used for CardDAV sync identifiers — ETag / UID.
export function CopyMonoRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };
  const shown = value.length > 22 ? `${value.slice(0, 22)}…` : value;
  return (
    <div className="flex items-center gap-3 px-2 py-1.5">
      <span className="w-[50px] shrink-0 text-[12.5px] text-[#5c655e]">{label}</span>
      <span
        className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-[#1d2823]"
        title={value}
      >
        {shown}
      </span>
      <button
        aria-label={`Copy ${label}`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[7px] text-[#8b938c] transition hover:bg-[#f2f4f0]"
        onClick={handleCopy}
        title={`Copy ${label}`}
        type="button"
      >
        <WorkspaceIcon
          fill="none"
          name={copied ? "check" : "copy"}
          size={15}
          strokeWidth={copied ? 2 : 1.7}
        />
      </button>
    </div>
  );
}

export function CopyField({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <p className="min-w-0 flex-1 break-all font-mono text-sm text-slate-900">{value}</p>
        <button
          aria-label={`Copy ${label.toLowerCase()}`}
          className="shrink-0 rounded-[1rem] border border-[#d8ddd6] bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-[#c9d0c9] hover:bg-slate-50"
          onClick={handleCopy}
          type="button"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {helper ? <p className="mt-2 text-xs leading-5 text-slate-500">{helper}</p> : null}
    </div>
  );
}

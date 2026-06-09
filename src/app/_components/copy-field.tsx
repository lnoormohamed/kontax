"use client";

import { useState } from "react";

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

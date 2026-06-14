"use client";

// P31B-05: filter context bar shown above the contacts list when a label filter
// is active. Shows the label chip, count, a Save-as-list button, and ✕ to clear.

import { useRouter } from "next/navigation";

import { LabelDot } from "~/app/_components/label-chip";
import { paletteSwatch } from "~/app/_components/label-chip";

interface LabelFilterBarProps {
  name: string;
  color: string;
  count: number;
  /** Base href to return to when clearing — e.g. /contacts?tab=people&filter=all */
  clearHref: string;
  onSaveAsList: () => void;
}

export function LabelFilterBar({ name, color, count, clearHref, onSaveAsList }: LabelFilterBarProps) {
  const router = useRouter();
  const p = paletteSwatch(color);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[#e9ece7] bg-white px-4 py-2.5">
      {/* label identity */}
      <span className="flex items-center gap-2">
        <LabelDot col={color} size={11} />
        <span className="text-[15px] font-semibold text-[#1d2823]">{name}</span>
      </span>

      {/* "Label: <name>" chip */}
      <span
        style={{ background: "#edf0fe", color: "#4158f4" }}
        className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
      >
        <span className="font-normal">Label:</span>
        <span>{name}</span>
        <button
          type="button"
          aria-label="Clear label filter"
          className="ml-0.5 grid h-3.5 w-3.5 place-items-center rounded-full opacity-70 transition hover:opacity-100"
          onClick={() => router.push(clearHref)}
          style={{ color: "#4158f4" }}
        >
          ✕
        </button>
      </span>

      <div className="ml-auto flex items-center gap-3">
        <span className="tabular-nums text-[12.5px] text-[#8b938c]">{count} contacts</span>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-lg border border-[#d8ddd6] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          onClick={onSaveAsList}
        >
          Save as list
        </button>
      </div>
    </div>
  );
}

// ── compact mobile variant (46px, single row) ─────────────────────────────────
export function MobileLabelFilterBar({ name, color, count, clearHref, onSaveAsList }: LabelFilterBarProps) {
  const router = useRouter();
  const p = paletteSwatch(color);

  return (
    <div
      style={{ height: 46, background: "#fff", borderBottom: "1px solid #e9ece7" }}
      className="flex shrink-0 items-center gap-2 px-3"
    >
      <span
        style={{ background: p.soft, color: p.text }}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold"
      >
        <LabelDot col={color} size={8} />
        {name}
        <button
          type="button"
          aria-label="Clear label filter"
          onClick={() => router.push(clearHref)}
          className="ml-0.5 grid h-4.5 w-4.5 place-items-center opacity-75 transition hover:opacity-100"
        >
          ✕
        </button>
      </span>
      <span className="tabular-nums text-[12.5px] text-[#8b938c]">{count}</span>
      <button
        type="button"
        className="ml-auto flex items-center gap-1.5 rounded-lg border border-[#d8ddd6] bg-white px-2.5 py-1 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
        onClick={onSaveAsList}
      >
        Save
      </button>
    </div>
  );
}

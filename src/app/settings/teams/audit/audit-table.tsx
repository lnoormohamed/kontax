"use client";

import React, { useState } from "react";

import type { AuditDiff, TeamAuditRow } from "~/server/team-audit";
import { formatFieldLabel } from "~/lib/activity/field-labels";

// ── event tag colours (mirrors tm-audit.jsx design) ──────────────────────────
const EV_TAG: Record<string, { bg: string; fg: string }> = {
  CONTACT_CREATED:  { bg: "#e7efe9", fg: "#17352e" },
  CONTACT_UPDATED:  { bg: "#edf0fe", fg: "#3142c4" },
  CONTACT_ARCHIVED: { bg: "#f6edd9", fg: "#7c5511" },
  CONTACT_RESTORED: { bg: "#e7efe9", fg: "#17352e" },
  CONTACT_MERGED:   { bg: "#efe8db", fg: "#7a6538" },
  CONTACT_IMPORTED: { bg: "#f2f4f0", fg: "#5c655e" },
  SYNC_PUSHED:      { bg: "#f2f4f0", fg: "#5c655e" },
  SYNC_PULLED:      { bg: "#f2f4f0", fg: "#5c655e" },
};

const EVENT_LABEL: Record<string, string> = {
  CONTACT_CREATED:  "Created",
  CONTACT_UPDATED:  "Updated",
  CONTACT_ARCHIVED: "Archived",
  CONTACT_RESTORED: "Restored",
  CONTACT_MERGED:   "Merged",
  CONTACT_IMPORTED: "Imported",
  SYNC_PUSHED:      "Synced (push)",
  SYNC_PULLED:      "Synced (pull)",
};

function eventLabel(t: string) {
  return EVENT_LABEL[t] ?? t;
}

function EvTag({ type }: { type: string }) {
  const { bg, fg } = EV_TAG[type] ?? { bg: "#f2f4f0", fg: "#5c655e" };
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-[6px] px-[7px] py-[2px] text-[11px] font-bold leading-none"
      style={{ background: bg, color: fg }}
    >
      {eventLabel(type)}
    </span>
  );
}

function MemberAvatar({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full bg-[#e7efe9] text-[10px] font-semibold text-[#17352e]">
      {initials}
    </span>
  );
}

function formatDiffValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return v.length === 0 ? "—" : JSON.stringify(v);
  return JSON.stringify(v);
}

function DiffRow({ diff }: { diff: AuditDiff }) {
  return (
    <div className="flex items-baseline gap-3 py-1 text-[12.5px]">
      <span className="w-32 shrink-0 font-medium text-[#5c655e]">
        {formatFieldLabel(diff.field)}
      </span>
      <span className="text-[#aeb4ac] line-through">{formatDiffValue(diff.before)}</span>
      <span className="text-[#aeb4ac]">→</span>
      <span className="font-medium text-[#1d2823]">{formatDiffValue(diff.after)}</span>
    </div>
  );
}

function fmt(d: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function AuditTable({ rows }: { rows: TeamAuditRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (rows.length === 0) {
    return (
      <div className="overflow-hidden rounded-[12px] border border-[#d8ddd6] bg-white">
        <p className="px-5 py-10 text-center text-sm text-[#8b938c]">
          No audit events match these filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[12px] border border-[#d8ddd6] bg-white">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-[#e9ece7] text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8b938c]">
            <th className="px-4 py-2.5">When</th>
            <th className="px-4 py-2.5">Member</th>
            <th className="px-4 py-2.5">Event</th>
            <th className="px-4 py-2.5">Contact</th>
            <th className="px-4 py-2.5">Book</th>
            <th className="w-6 px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isOpen = open.has(r.id);
            const expandable = r.diffs.length > 0;
            return (
              <React.Fragment key={r.id}>
                <tr
                  className={`border-b border-[#f0f2ee] last:border-b-0 ${expandable ? "cursor-pointer hover:bg-[#fbfcfa]" : ""}`}
                  onClick={() => expandable && toggle(r.id)}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#5c655e]">{fmt(r.createdAt)}</td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      <MemberAvatar name={r.memberName} />
                      <span className="text-[#1d2823]">{r.memberName}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-1.5">
                      <EvTag type={r.eventType} />
                      {r.diffs.length > 0 && (
                        <span className="text-[#8b938c]">
                          · {r.diffs.length} {r.diffs.length === 1 ? "field" : "fields"}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#5c655e]">{r.contactName}</td>
                  <td className="px-4 py-2.5 text-[#5c655e]">{r.bookName}</td>
                  <td className="px-4 py-2.5 text-[#aeb4ac]">
                    {expandable && (
                      <svg
                        className={`h-4 w-4 transition-transform ${isOpen ? "rotate-90" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </td>
                </tr>
                {isOpen && expandable && (
                  <tr className="border-b border-[#f0f2ee] bg-[#fbfcfa]">
                    <td colSpan={6} className="px-4 pb-3 pt-1">
                      <div className="divide-y divide-[#f0f2ee]">
                        {r.diffs.map((d, i) => (
                          <DiffRow key={i} diff={d} />
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

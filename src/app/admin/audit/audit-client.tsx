"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AD, AdIcon } from "../_components/admin-icons";

// action key → { label, tone }
const ACTION_META: Record<string, { label: string; tone: string }> = {
  "plan.override": { label: "Plan override", tone: "blue" },
  "account.suspend": { label: "Suspend", tone: "red" },
  "account.delete.schedule": { label: "Schedule deletion", tone: "red" },
  "account.unlock": { label: "Unlock", tone: "green" },
  "impersonation.start": { label: "Impersonation start", tone: "gray" },
  "impersonation.end": { label: "Impersonation end", tone: "gray" },
  "flag.update": { label: "Flag update", tone: "gray" },
  "user.view": { label: "User viewed", tone: "gray" },
};

const TONE_BADGE: Record<string, { bg: string; fg: string }> = {
  blue: { bg: "#eff6ff", fg: "#1d4ed8" },
  red: { bg: "#fef2f2", fg: "#b91c1c" },
  amber: { bg: "#fffbeb", fg: "#b45309" },
  green: { bg: "#f0fdf4", fg: "#15803d" },
  gray: { bg: "#f4f4f5", fg: "#52525b" },
};

function detailsSummary(details: Record<string, unknown>): string {
  return Object.entries(details)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v as string | number | boolean)}`)
    .join("  ·  ");
}

export function AuditFilters({
  actionTypes,
  current,
}: {
  actionTypes: string[];
  current: { action: string; target: string; range: string };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [target, setTarget] = useState(current.target);

  const push = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params?.toString() ?? "");
    for (const [k, v] of Object.entries(patch)) {
      if (v && v !== "all") next.set(k, v);
      else next.delete(k);
    }
    next.delete("page");
    router.push(`/admin/audit?${next.toString()}`);
  };

  return (
    <div className="ad-filterbar">
      <div className="ad-select-wrap">
        <AdIcon name="filter" size={15} c={AD.mute} />
        <select
          className="ad-select"
          value={current.action}
          onChange={(e) => push({ action: e.target.value })}
        >
          <option value="all">All actions</option>
          {actionTypes.map((a) => (
            <option key={a} value={a}>
              {ACTION_META[a]?.label ?? a}
            </option>
          ))}
        </select>
        <AdIcon name="chevd" size={14} c={AD.mute} />
      </div>

      <div className="ad-select-wrap">
        <AdIcon name="calendar" size={15} c={AD.mute} />
        <select
          className="ad-select"
          value={current.range}
          onChange={(e) => push({ range: e.target.value })}
        >
          <option value="all">All time</option>
          <option value="24h">Last 24 hours</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
        </select>
        <AdIcon name="chevd" size={14} c={AD.mute} />
      </div>

      <form
        className="ad-filter-search"
        onSubmit={(e) => {
          e.preventDefault();
          push({ target });
        }}
      >
        <AdIcon name="search" size={15} c={AD.mute} />
        <input
          placeholder="Filter by target user email…"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
        {target && (
          <button
            type="button"
            className="ad-search-clear"
            onClick={() => {
              setTarget("");
              push({ target: "" });
            }}
          >
            <AdIcon name="close" size={13} c={AD.mute} />
          </button>
        )}
      </form>
    </div>
  );
}

export function AuditRow({
  row,
}: {
  row: {
    id: string;
    ts: string;
    adminName: string;
    action: string;
    targetEmail: string | null;
    details: Record<string, unknown>;
  };
}) {
  const [open, setOpen] = useState(false);
  const meta = ACTION_META[row.action] ?? { label: row.action, tone: "gray" };
  const badge = TONE_BADGE[meta.tone] ?? TONE_BADGE.gray!;
  const isSystem = row.adminName === "system";

  return (
    <div className={"ad-audit-row" + (open ? " is-open" : "")}>
      <div className="ad-tr ad-tr--audit ad-row" onClick={() => setOpen((o) => !o)}>
        <span className="ad-cell-muted tnum ad-mono-sm" data-th="Timestamp">
          {row.ts}
        </span>
        <span className="ad-cell" data-th="Admin">
          {isSystem ? <span className="ad-system-tag">system</span> : row.adminName}
        </span>
        <span data-th="Action">
          <span className="ad-action-badge" style={{ background: badge.bg, color: badge.fg }}>
            {row.action}
          </span>
        </span>
        <span className="ad-cell ad-cell-target" data-th="Target">
          {row.targetEmail ?? "—"}
        </span>
        <span className="ad-cell ad-audit-summary" data-th="Details">
          <AdIcon name={open ? "chevu" : "chev"} size={14} c={AD.faint} />
          <span className="ad-cell">{detailsSummary(row.details)}</span>
        </span>
      </div>
      {open && (
        <div className="ad-audit-detail">
          <div className="ad-json-label">details</div>
          <pre className="ad-json">{JSON.stringify(row.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

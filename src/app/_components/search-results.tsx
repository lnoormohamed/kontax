"use client";

// P33-02: shared search UI primitives — result row, snippet, match badge,
// grouped list, skeleton, empty, recents, key legend.
// Used by: desktop header dropdown (P33-03), mobile overlay (P33-04),
// and in-list filter (P33-05).

import { useEffect, useState } from "react";

import type { MatchField, SearchResult } from "~/app/api/contacts/search/route";
import { LabelChip } from "~/app/_components/label-chip";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

// ── Re-export types consumed by parent surfaces ───────────────────────────────
export type { MatchField, SearchResult };

// ── Field metadata ────────────────────────────────────────────────────────────

const FIELD_ORDER: MatchField[] = ["name", "company", "email", "phone", "label", "notes"];

const FIELD_META: Record<MatchField, { label: string; icon: React.ComponentProps<typeof WorkspaceIcon>["name"]; badge: string | null }> = {
  name:    { label: "Name",    icon: "people",    badge: null },
  company: { label: "Company", icon: "briefcase", badge: "company" },
  email:   { label: "Email",   icon: "mail",      badge: "email" },
  phone:   { label: "Phone",   icon: "phone",     badge: "phone" },
  label:   { label: "Label",   icon: "tag",       badge: "label" },
  notes:   { label: "Notes",   icon: "note",      badge: "notes" },
};

// Name shows up to 8 before collapsing; every other group shows 4.
const NAME_CAP = 8;
const GROUP_CAP = 4;

// ── Color tokens (locked light system) ───────────────────────────────────────
const T = {
  ink:   "#1d2823",
  ink2:  "#3d4d40",
  mute:  "#8b938c",
  faint: "#aeb4ac",
  line:  "#d8ddd6",
  line2: "#e9ece7",
  bg:    "#f6f7f4",
  wash:  "#f2f4f0",
  sel:   "#edf0fe",
  blue:  "#4158f4",
};

// ── localStorage helpers ──────────────────────────────────────────────────────

export const RECENTLY_VIEWED_KEY = "kontax-recently-viewed";
export const RECENT_SEARCHES_KEY = "kontax-recent-searches";

export type RecentlyViewedEntry = {
  id: string;
  name: string;
  company: string | null;
};

export function addRecentlyViewed(entry: RecentlyViewedEntry): void {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const existing: RecentlyViewedEntry[] = raw ? (JSON.parse(raw) as RecentlyViewedEntry[]) : [];
    const next = [entry, ...existing.filter((e) => e.id !== entry.id)].slice(0, 8);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function getRecentlyViewed(): RecentlyViewedEntry[] {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? (JSON.parse(raw) as RecentlyViewedEntry[]) : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(q: string): void {
  const term = q.trim();
  if (!term) return;
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const existing: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    const next = [term, ...existing.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, 5);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function removeRecentSearch(term: string): void {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    const existing: string[] = raw ? (JSON.parse(raw) as string[]) : [];
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(existing.filter((t) => t !== term)));
  } catch {
    // ignore
  }
}

// ── Grouping helpers ──────────────────────────────────────────────────────────

export type GroupedSection = {
  field: MatchField;
  label: string;
  rows: SearchResult[];
};

export function groupResults(results: SearchResult[]): GroupedSection[] {
  const buckets = new Map<MatchField, SearchResult[]>();
  for (const r of results) {
    if (!buckets.has(r.matchField)) buckets.set(r.matchField, []);
    buckets.get(r.matchField)!.push(r);
  }
  return FIELD_ORDER.filter((f) => buckets.has(f)).map((f) => ({
    field: f,
    label: FIELD_META[f].label,
    rows: buckets.get(f)!,
  }));
}

// Flatten visible rows across groups for keyboard nav.
export function seVisibleRows(
  sections: GroupedSection[],
  expanded: Record<string, boolean> = {},
): Array<SearchResult & { field: MatchField }> {
  const out: Array<SearchResult & { field: MatchField }> = [];
  for (const s of sections) {
    const cap = s.field === "name" ? NAME_CAP : GROUP_CAP;
    const limit = expanded[s.field] ? Infinity : cap;
    for (const r of s.rows.slice(0, limit)) {
      out.push({ ...r, field: s.field });
    }
  }
  return out;
}

// ── Avatar ────────────────────────────────────────────────────────────────────

const AVATAR_TINTS: Array<[string, string]> = [
  ["#e6ece4", "#3f6b53"],
  ["#e9e7f4", "#5a55a6"],
  ["#f3e7df", "#9a623a"],
  ["#e2edf2", "#3d6f8a"],
  ["#f2e6ea", "#9a4a63"],
  ["#e8efe0", "#5f7a3a"],
  ["#efe9df", "#85703f"],
  ["#e3eef0", "#3f7d7a"],
];

function tintForName(primary: string | null | undefined, fallback?: string | null): [string, string] {
  const src = (primary?.trim() ?? fallback?.trim()) ?? "?";
  let hash = 0;
  for (let i = 0; i < src.length; i++) hash = ((hash * 31) + src.charCodeAt(i)) >>> 0;
  return AVATAR_TINTS[hash % AVATAR_TINTS.length]!;
}

function getInitials(primary: string | null | undefined, fallback?: string | null): string {
  const src = (primary?.trim() ?? fallback?.trim()) ?? "";
  if (!src) return "";
  const parts = src.split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""))
    .toUpperCase();
}

function ContactAvatar({ fullName, company, size }: { fullName: string | null | undefined; company?: string | null; size: number }) {
  const [bg, fg] = tintForName(fullName, company);
  const initials = getInitials(fullName, company);
  return (
    <span
      style={{
        width: size, height: size, borderRadius: "50%",
        background: bg,
        display: "grid", placeItems: "center",
        fontSize: size * 0.36, fontWeight: 600,
        flexShrink: 0, userSelect: "none",
      }}
    >
      {initials ? (
        <span style={{ color: fg }}>{initials}</span>
      ) : (
        <WorkspaceIcon name="person" size={Math.round(size * 0.4)} strokeWidth={1.6} className="text-[#aeb4ac]" />
      )}
    </span>
  );
}

// ── HiAll — marks every occurrence of q in text ───────────────────────────────

export function HiAll({ text, q }: { text: string; q: string }) {
  const s = q.trim().toLowerCase();
  if (!s || !text) return <>{text}</>;
  const out: React.ReactNode[] = [];
  const lower = text.toLowerCase();
  let i = 0, key = 0;
  while (i < text.length) {
    const j = lower.indexOf(s, i);
    if (j < 0) { out.push(text.slice(i)); break; }
    if (j > i) out.push(text.slice(i, j));
    out.push(
      <mark key={key++} style={{ background: "#fff0bf", color: "inherit", borderRadius: 2, padding: "0 1px" }}>
        {text.slice(j, j + s.length)}
      </mark>
    );
    i = j + s.length;
  }
  return <>{out}</>;
}

// ── PhoneHi — bolds the matched digit run inside a formatted phone string ────

export function PhoneHi({ phone, q }: { phone: string; q: string }) {
  const digits = q.replace(/\D/g, "");
  const phoneDigits = phone.replace(/\D/g, "");
  if (digits.length < 2) return <>{phone}</>;
  const start = phoneDigits.indexOf(digits);
  if (start < 0) return <>{phone}</>;
  const end = start + digits.length;
  const nodes: React.ReactNode[] = [];
  let di = 0;
  for (let k = 0; k < phone.length; k++) {
    const ch = phone[k]!;
    const isDigit = ch >= "0" && ch <= "9";
    const on = isDigit && di >= start && di < end;
    nodes.push(
      <span key={k} style={on ? { background: "#fff0bf", color: T.ink, fontWeight: 700, borderRadius: 2 } : undefined}>
        {ch}
      </span>
    );
    if (isDigit) di++;
  }
  return <span style={{ fontVariantNumeric: "tabular-nums" }}>{nodes}</span>;
}

// ── SearchMatchBadge ──────────────────────────────────────────────────────────

function SearchMatchBadge({ field }: { field: MatchField }) {
  const meta = FIELD_META[field];
  if (!meta.badge) return null;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      flexShrink: 0, height: 19, padding: "0 7px",
      borderRadius: 999, background: T.wash, color: T.mute,
      fontSize: 11, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap",
    }}>
      <WorkspaceIcon name={meta.icon} size={11} strokeWidth={2} className="" />
      {meta.badge}
    </span>
  );
}

// ── SearchSnippet ─────────────────────────────────────────────────────────────

type LabelRegistryEntry = { name: string; color: string };

function SearchSnippet({
  result, q, mob, labelRegistry,
}: {
  result: SearchResult;
  q: string;
  mob?: boolean;
  labelRegistry?: LabelRegistryEntry[];
}) {
  const fs = mob ? 13 : 12.5;
  const muted: React.CSSProperties = { fontSize: fs, color: T.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 };

  if (result.matchField === "name") {
    const sub = [result.company, result.email].filter(Boolean).join("  ·  ");
    return <div style={muted}>{sub}</div>;
  }

  if (result.matchField === "company") {
    return <div style={muted}><HiAll text={result.snippet ?? result.company ?? ""} q={q} /></div>;
  }

  if (result.matchField === "email") {
    return <div style={muted}><HiAll text={result.snippet ?? result.email ?? ""} q={q} /></div>;
  }

  if (result.matchField === "phone") {
    return (
      <div style={{ ...muted, color: T.ink2, display: "flex", alignItems: "center", gap: 5 }}>
        <WorkspaceIcon name="phone" size={mob ? 13 : 12} strokeWidth={1.8} className="" />
        <PhoneHi phone={result.snippet ?? result.phone ?? ""} q={q} />
        {result.matchAlt && <span style={{ color: T.faint, fontWeight: 600 }}>· secondary</span>}
      </div>
    );
  }

  if (result.matchField === "label") {
    const labelName = result.snippet ?? "";
    const entry = labelRegistry?.find((l) => l.name === labelName);
    if (entry) {
      return <div style={{ display: "flex" }}><LabelChip name={entry.name} col={entry.color} sz={mob ? "md" : "sm"} /></div>;
    }
    // No registry available: render the label name as plain muted text.
    return <div style={muted}>{labelName}</div>;
  }

  if (result.matchField === "notes") {
    return (
      <div style={{ ...muted, display: "flex", alignItems: "center", gap: 5 }}>
        <WorkspaceIcon name="note" size={mob ? 13 : 12} strokeWidth={1.7} className="" />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          <HiAll text={result.snippet ?? ""} q={q} />
        </span>
      </div>
    );
  }

  return null;
}

// ── SearchResultRow ───────────────────────────────────────────────────────────

interface SearchResultRowProps {
  result: SearchResult;
  q: string;
  active?: boolean;
  onOpen?: (result: SearchResult) => void;
  onHover?: (id: string) => void;
  mob?: boolean;
  labelRegistry?: LabelRegistryEntry[];
}

export function SearchResultRow({ result, q, active, onOpen, onHover, mob, labelRegistry }: SearchResultRowProps) {
  return (
    <div
      onClick={() => onOpen?.(result)}
      onMouseEnter={() => onHover?.(result.id)}
      style={{
        display: "flex", alignItems: "center",
        gap: mob ? 13 : 11,
        height: mob ? 64 : 56,
        padding: mob ? "0 16px" : "0 12px",
        cursor: "pointer",
        background: active ? T.sel : "transparent",
        transition: "background 0.08s",
      }}
      onMouseLeave={undefined}
      className={`se-row${active ? " se-row--active" : ""}`}
    >
      <ContactAvatar fullName={result.name} company={result.company} size={mob ? 44 : 40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            flex: 1, minWidth: 0,
            fontSize: mob ? 15 : 14.5, fontWeight: 600, color: T.ink,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {result.matchField === "name"
              ? <HiAll text={result.name} q={q} />
              : result.name}
          </span>
          {!mob && <SearchMatchBadge field={result.matchField} />}
        </div>
        <div style={{ marginTop: 2 }}>
          <SearchSnippet result={result} q={q} mob={mob} labelRegistry={labelRegistry} />
        </div>
      </div>
      {mob && (
        <WorkspaceIcon name="chevronRight" size={17} strokeWidth={1.8} className="text-[#aeb4ac] shrink-0" />
      )}
    </div>
  );
}

// ── SearchGroupHeader ─────────────────────────────────────────────────────────

function SearchGroupHeader({ field, count, mob }: { field: MatchField; count: number; mob?: boolean }) {
  const meta = FIELD_META[field];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 7,
      padding: mob ? "14px 16px 6px" : "12px 14px 5px",
    }}>
      <WorkspaceIcon name={meta.icon} size={mob ? 14 : 13} strokeWidth={1.8} className="text-[#aeb4ac] shrink-0" />
      <span style={{ fontSize: mob ? 11.5 : 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: T.mute }}>
        {meta.label}
      </span>
      <span style={{ fontSize: 11, fontWeight: 700, color: T.faint, fontVariantNumeric: "tabular-nums" }}>
        {count}
      </span>
      <div style={{ flex: 1, height: 1, background: T.line2 }} />
    </div>
  );
}

// ── SearchMoreRow ─────────────────────────────────────────────────────────────

function SearchMoreRow({ n, field, mob, onExpand }: { n: number; field: MatchField; mob?: boolean; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        width: "100%", height: mob ? 44 : 38,
        padding: mob ? "0 16px 0 73px" : "0 12px 0 63px",
        border: "none", background: "transparent",
        color: T.blue, fontSize: 12.5, fontWeight: 600,
        textAlign: "left", cursor: "pointer",
      }}
    >
      <WorkspaceIcon name="chevronRight" size={14} strokeWidth={2} className="rotate-90" />
      +{n} more in {FIELD_META[field].label}
    </button>
  );
}

// ── SearchResultsList ─────────────────────────────────────────────────────────

interface SearchResultsListProps {
  sections: GroupedSection[];
  q: string;
  activeId?: string | null;
  expanded?: Record<string, boolean>;
  onOpen?: (result: SearchResult) => void;
  onHover?: (id: string) => void;
  onExpand?: (field: MatchField) => void;
  mob?: boolean;
  labelRegistry?: LabelRegistryEntry[];
}

export function SearchResultsList({
  sections, q, activeId, expanded = {}, onOpen, onHover, onExpand, mob, labelRegistry,
}: SearchResultsListProps) {
  return (
    <div>
      {sections.map((s) => {
        const cap = s.field === "name" ? NAME_CAP : GROUP_CAP;
        const isExpanded = expanded[s.field];
        const shown = isExpanded ? s.rows : s.rows.slice(0, cap);
        const hidden = s.rows.length - shown.length;
        return (
          <div key={s.field}>
            <SearchGroupHeader field={s.field} count={s.rows.length} mob={mob} />
            {shown.map((r) => (
              <SearchResultRow
                key={r.id}
                result={r}
                q={q}
                active={activeId === r.id}
                onOpen={onOpen}
                onHover={onHover}
                mob={mob}
                labelRegistry={labelRegistry}
              />
            ))}
            {hidden > 0 && (
              <SearchMoreRow
                n={hidden}
                field={s.field}
                mob={mob}
                onExpand={() => onExpand?.(s.field)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── SearchSkeleton ────────────────────────────────────────────────────────────

function SkeletonRow({ mob }: { mob?: boolean }) {
  return (
    <div style={{
      display: "flex", alignItems: "center",
      gap: mob ? 13 : 11,
      height: mob ? 64 : 56,
      padding: mob ? "0 16px" : "0 12px",
    }}>
      <span style={{ width: mob ? 44 : 40, height: mob ? 44 : 40, borderRadius: "50%", background: T.line2, flexShrink: 0 }} className="animate-pulse" />
      <div style={{ flex: 1 }}>
        <div style={{ height: 10, width: "44%", borderRadius: 5, background: T.line2, marginBottom: 8 }} className="animate-pulse" />
        <div style={{ height: 9, width: "70%", borderRadius: 5, background: T.wash }} className="animate-pulse" />
      </div>
    </div>
  );
}

export function SearchSkeleton({ rows = 4, mob }: { rows?: number; mob?: boolean }) {
  return (
    <div>
      <div style={{ padding: mob ? "14px 16px 6px" : "12px 14px 5px" }}>
        <span style={{ display: "inline-block", height: 9, width: 60, borderRadius: 5, background: T.line2 }} className="animate-pulse" />
      </div>
      {Array.from({ length: rows }).map((_, i) => <SkeletonRow key={i} mob={mob} />)}
    </div>
  );
}

// ── SearchNoMatch ─────────────────────────────────────────────────────────────

export function SearchNoMatch({ q, mob }: { q: string; mob?: boolean }) {
  return (
    <div style={{ display: "grid", placeItems: "center", textAlign: "center", padding: mob ? "70px 34px" : "46px 30px" }}>
      <span style={{
        width: mob ? 60 : 52, height: mob ? 60 : 52,
        borderRadius: mob ? 18 : 15,
        background: T.wash, display: "grid", placeItems: "center", marginBottom: 14,
      }}>
        <WorkspaceIcon name="search" size={mob ? 27 : 24} strokeWidth={1.7} className="text-[#aeb4ac]" />
      </span>
      <p style={{ margin: 0, fontSize: mob ? 16 : 15, fontWeight: 600, color: T.ink }}>
        No contacts match &ldquo;{q}&rdquo;
      </p>
      <p style={{ margin: "8px 0 0", fontSize: 12.5, color: T.mute, lineHeight: 1.55, maxWidth: 248 }}>
        Search a name, company, phone, email, note, or label.
      </p>
    </div>
  );
}

// ── SearchRecentBlock ─────────────────────────────────────────────────────────

interface SearchRecentBlockProps {
  mob?: boolean;
  onPickSearch?: (term: string) => void;
}

export function SearchRecentBlock({ mob, onPickSearch }: SearchRecentBlockProps) {
  const [searches, setSearches] = useState<string[]>([]);
  const [viewed, setViewed] = useState<RecentlyViewedEntry[]>([]);

  useEffect(() => {
    setSearches(getRecentSearches());
    setViewed(getRecentlyViewed());
  }, []);

  const removeSearch = (term: string) => {
    removeRecentSearch(term);
    setSearches((prev) => prev.filter((t) => t !== term));
  };

  if (searches.length === 0 && viewed.length === 0) {
    return (
      <p style={{ margin: "40px 30px 0", fontSize: 13.5, color: T.mute, textAlign: "center", lineHeight: 1.5 }}>
        Search by name, company, phone, email, note, or label.
      </p>
    );
  }

  const head = (label: string) => (
    <div style={{ display: "flex", alignItems: "center", padding: mob ? "14px 16px 6px" : "13px 14px 6px" }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: T.mute }}>
        {label}
      </span>
    </div>
  );

  return (
    <div>
      {searches.length > 0 && (
        <>
          {head("Recent searches")}
          {searches.map((term) => (
            <div
              key={term}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                height: mob ? 48 : 40,
                padding: mob ? "0 16px" : "0 14px",
              }}
              className="se-row"
            >
              <WorkspaceIcon name="clock" size={mob ? 17 : 15} strokeWidth={1.8} className="text-[#aeb4ac] shrink-0" />
              <span
                style={{ flex: 1, fontSize: mob ? 14.5 : 13.5, color: T.ink2, cursor: "pointer" }}
                onClick={() => onPickSearch?.(term)}
              >
                {term}
              </span>
              <button
                type="button"
                aria-label={`Remove ${term}`}
                onClick={() => removeSearch(term)}
                style={{ border: "none", background: "transparent", padding: 2, cursor: "pointer", display: "grid", placeItems: "center" }}
              >
                <WorkspaceIcon name="close" size={14} strokeWidth={1.9} className="text-[#aeb4ac]" />
              </button>
            </div>
          ))}
        </>
      )}
      {viewed.length > 0 && (
        <>
          {head("Recently viewed")}
          {viewed.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                height: mob ? 56 : 48,
                padding: mob ? "0 16px" : "0 14px",
                cursor: "pointer",
              }}
              className="se-row"
              onClick={() => { window.location.href = `/contacts/${entry.id}`; }}
            >
              <ContactAvatar fullName={entry.name} company={entry.company} size={mob ? 38 : 32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: mob ? 14.5 : 13.5, fontWeight: 600, color: T.ink }}>{entry.name}</div>
                {entry.company && (
                  <div style={{ fontSize: mob ? 12.5 : 11.5, color: T.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {entry.company}
                  </div>
                )}
              </div>
              <WorkspaceIcon name="chevronRight" size={mob ? 16 : 14} strokeWidth={1.8} className="text-[#aeb4ac] shrink-0" />
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ── RecentlyViewedTracker ────────────────────────────────────────────────────
// Drop this into any server-rendered contact detail page to record a view.

export function RecentlyViewedTracker({ id, name, company }: RecentlyViewedEntry) {
  useEffect(() => {
    addRecentlyViewed({ id, name, company });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
}

// ── SearchKeyLegend ───────────────────────────────────────────────────────────

function KeyHint({ k }: { k: string }) {
  return (
    <span style={{
      display: "inline-grid", placeItems: "center",
      minWidth: 19, height: 19, padding: "0 5px",
      borderRadius: 5,
      background: "#fff",
      border: `1px solid ${T.line}`,
      boxShadow: `0 1px 0 ${T.line2}`,
      fontFamily: "ui-monospace, monospace",
      fontSize: 11, fontWeight: 500, color: T.ink2, lineHeight: 1,
    }}>
      {k}
    </span>
  );
}

export function SearchKeyLegend() {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 13,
      height: 38, padding: "0 14px",
      borderTop: `1px solid ${T.line2}`,
      background: T.bg,
      overflow: "hidden", flexWrap: "nowrap",
    }}>
      {([["↑↓", "navigate"], ["↵", "open"], ["esc", "clear"]] as [string, string][]).map(([k, l]) => (
        <span key={k} style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.mute, fontWeight: 500, whiteSpace: "nowrap" }}>
          <KeyHint k={k} />{l}
        </span>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { formatFieldLabel } from "~/lib/activity/field-labels";
import { formatAbsoluteTime, formatRelativeTime } from "~/lib/activity/time";

export type FieldDiff = { field: string; before: unknown; after: unknown };

export type ActivityEventRow = {
  id: string;
  eventType: string;
  actor: string;
  actorDetail: string | null;
  payload: unknown;
  createdAt: string;
  contactId: string | null;
  contactName: string | null;
  summary: string;
  actorLabel: string;
  actorIcon: string;
};

// ── filter options ────────────────────────────────────────────────────────────
export const CATEGORY_OPTIONS = [
  { key: "all", label: "All" },
  { key: "edits", label: "Edits" },
  { key: "sync", label: "Sync" },
  { key: "imports", label: "Imports" },
  { key: "merges", label: "Merges" },
  { key: "shares", label: "Shares" },
] as const;

export const ACTOR_OPTIONS = [
  { key: "all", label: "Anyone" },
  { key: "you", label: "You" },
  { key: "sync", label: "Sync" },
  { key: "import", label: "Import" },
  { key: "shared", label: "Shared" },
] as const;

// ── event glyph + tint ────────────────────────────────────────────────────────
type EventMeta = { icon: string; color: string };
const EVENT_META: Record<string, EventMeta> = {
  CONTACT_CREATED: { icon: "plus", color: "#17352e" },
  CONTACT_UPDATED: { icon: "pencil", color: "#4158f4" },
  CONTACT_ARCHIVED: { icon: "archive", color: "#a8741f" },
  CONTACT_RESTORED: { icon: "restore", color: "#17352e" },
  CONTACT_DELETED: { icon: "trash", color: "#b5472f" },
  CONTACT_MERGED: { icon: "merge", color: "#5c655e" },
  CONTACT_MERGE_UNDONE: { icon: "restore", color: "#5c655e" },
  CONTACT_IMPORTED: { icon: "upload", color: "#5c655e" },
  CONTACT_SHARED: { icon: "share", color: "#4158f4" },
  CONTACT_SHARE_RECEIVED: { icon: "download", color: "#4158f4" },
  SYNC_PULLED: { icon: "cloud", color: "#2c7a52" },
  SYNC_PUSHED: { icon: "sync", color: "#2c7a52" },
  SYNC_CONFLICT_DETECTED: { icon: "warning", color: "#a8741f" },
  SYNC_CONFLICT_RESOLVED: { icon: "check", color: "#17352e" },
};
export const eventMeta = (t: string): EventMeta =>
  EVENT_META[t] ?? { icon: "pencil", color: "#4158f4" };

// ── value rendering ───────────────────────────────────────────────────────────
const stringifyScalar = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return typeof v === "symbol" ? v.toString() : `${v as string | number | boolean | bigint}`;
};

export const renderValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length > 0 ? v.map(stringifyScalar).join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  const text = stringifyScalar(v);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

export const getDiffs = (payload: unknown): FieldDiff[] => {
  if (payload && typeof payload === "object" && Array.isArray((payload as { diffs?: unknown }).diffs)) {
    return (payload as { diffs: FieldDiff[] }).diffs;
  }
  return [];
};

// ── diff table ────────────────────────────────────────────────────────────────
function DiffTable({ diffs }: { diffs: FieldDiff[] }) {
  return (
    <div className="mt-2.5 overflow-hidden rounded-[10px] border border-[#e9ece7]">
      {diffs.map((diff, i) => (
        <div
          className="grid gap-3.5 px-3 py-[9px] text-[12.5px]"
          key={i}
          style={{
            gridTemplateColumns: "128px 1fr",
            borderTop: i > 0 ? "1px solid #e9ece7" : "none",
          }}
        >
          <span className="pt-px font-medium text-[#8b938c]">{formatFieldLabel(diff.field)}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-2">
            <span
              className="max-w-[42ch] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-[#b5472f]"
              title={renderValue(diff.before)}
            >
              {renderValue(diff.before)}
            </span>
            <WorkspaceIcon className="shrink-0 text-[#c8cfc6]" name="chevronRight" size={13} strokeWidth={2} />
            <span
              className="max-w-[42ch] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px] text-[#2f7d5b]"
              title={renderValue(diff.after)}
            >
              {renderValue(diff.after)}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

// ── event row ─────────────────────────────────────────────────────────────────
function EventRow({ event }: { event: ActivityEventRow }) {
  const [open, setOpen] = useState(false);
  const diffs = getDiffs(event.payload);
  const expandable = diffs.length > 0;
  const meta = eventMeta(event.eventType);

  return (
    <div
      className="flex gap-3 rounded-[11px] px-3.5 py-3 transition-colors"
      onMouseEnter={
        expandable
          ? (e) => { e.currentTarget.style.background = "#f2f4f0"; }
          : undefined
      }
      onMouseLeave={
        expandable
          ? (e) => { e.currentTarget.style.background = ""; }
          : undefined
      }
    >
      {/* glyph circle */}
      <span
        className="mt-px grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full bg-[#f2f4f0]"
        style={{ color: meta.color }}
      >
        <WorkspaceIcon name={meta.icon} size={14} strokeWidth={1.7} />
      </span>

      {/* body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <p className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-[#1d2823]">
            {/* contact name prefix (global feed only) */}
            {event.contactName && (
              event.contactId ? (
                <><Link
                  className="font-semibold text-[#4158f4] hover:underline"
                  href={`/contacts/${event.contactId}`}
                >{event.contactName}</Link>{" "}</>
              ) : (
                <><span className="font-semibold text-[#8b938c]" title="This contact was permanently deleted">{event.contactName}</span>{" "}</>
              )
            )}
            {/* summary (lowercase first letter when contact name precedes it) */}
            <span className="text-[#5c655e]">
              {event.contactName
                ? event.summary.charAt(0).toLowerCase() + event.summary.slice(1)
                : event.summary}
            </span>
          </p>
          <span
            className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-[#8b938c]"
            title={formatAbsoluteTime(event.createdAt)}
          >
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-[#8b938c]">
          <span>{event.actorLabel}</span>
          {expandable && (
            <>
              <span className="text-[#c8cfc6]">·</span>
              <button
                aria-expanded={open}
                className="inline-flex items-center gap-1 font-semibold text-[#4158f4] hover:underline"
                onClick={() => setOpen((v) => !v)}
                type="button"
              >
                <span
                  style={{
                    display: "inline-flex",
                    transition: "transform .15s ease",
                    transform: open ? "rotate(90deg)" : "none",
                  }}
                >
                  <WorkspaceIcon name="chevronRight" size={12} strokeWidth={2.2} />
                </span>
                {open
                  ? "Hide changes"
                  : `View ${diffs.length} change${diffs.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>

        {open && expandable && <DiffTable diffs={diffs} />}
      </div>
    </div>
  );
}

// ── skeleton rows ─────────────────────────────────────────────────────────────
function SkeletonRows({ count = 6 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i}>
          {i > 0 && <div className="mx-3.5 h-px bg-[#e9ece7]" />}
          <div className="flex animate-pulse gap-3 px-3.5 py-3">
            <span className="h-[28px] w-[28px] shrink-0 rounded-full bg-[#eceee9]" />
            <div className="flex-1 pt-0.5">
              <span className="block h-[11px] w-[52%] rounded-[6px] bg-[#eceee9]" />
              <span className="mt-2 block h-[9px] w-[28%] rounded-[6px] bg-[#eceee9]" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

// ── filter bar (single wrapped row, chips constrained to 760px column) ────────
function FilterBar({
  category,
  actor,
  onCategory,
  onActor,
}: {
  category: string;
  actor: string;
  onCategory: (v: string) => void;
  onActor: (v: string) => void;
}) {
  const Chip = ({
    label,
    active,
    onClick,
  }: {
    label: string;
    active: boolean;
    onClick: () => void;
  }) => (
    <button
      className="inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-full border border-transparent px-[13px] text-[12.5px] font-semibold transition"
      onClick={onClick}
      style={{
        background: active ? "#17352e" : "#f2f4f0",
        color: active ? "#fff" : "#5c655e",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "#e7efe9";
          e.currentTarget.style.color = "#17352e";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "#f2f4f0";
          e.currentTarget.style.color = "#5c655e";
        }
      }}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="border-b border-[#e9ece7]">
      <div
        className="mx-auto flex flex-nowrap items-center gap-[7px] overflow-x-auto px-[18px] py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-x-visible"
        style={{ maxWidth: 760 }}
      >
        <span className="mr-px text-[10px] font-medium uppercase tracking-[0.06em] text-[#8b938c]">
          Type
        </span>
        {CATEGORY_OPTIONS.map((o) => (
          <Chip key={o.key} active={category === o.key} label={o.label} onClick={() => onCategory(o.key)} />
        ))}
        {/* divider between groups */}
        <span className="mx-1 h-[18px] w-px shrink-0 bg-[#e9ece7]" />
        <span className="mr-px text-[10px] font-medium uppercase tracking-[0.06em] text-[#8b938c]">
          By
        </span>
        {ACTOR_OPTIONS.map((o) => (
          <Chip key={o.key} active={actor === o.key} label={o.label} onClick={() => onActor(o.key)} />
        ))}
      </div>
    </div>
  );
}

// ── state blocks ──────────────────────────────────────────────────────────────
function EmptyState({
  kind,
  retention,
  onClear,
  onRetry,
}: {
  kind: "empty" | "filtered" | "error";
  retention?: number | null;
  onClear?: () => void;
  onRetry?: () => void;
}) {
  if (kind === "error") {
    return (
      <div className="mx-[18px] my-5 rounded-[14px] border border-[#d8ddd6] px-7 py-[52px] text-center">
        <span className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-full bg-[#f3e1da] text-[#b5472f]">
          <WorkspaceIcon name="warning" size={21} strokeWidth={1.7} />
        </span>
        <p className="text-[15px] font-semibold text-[#1d2823]">Couldn&apos;t load activity.</p>
        <p className="mx-auto mt-1.5 max-w-[360px] text-[13px] leading-[1.55] text-[#5c655e]">
          Something went wrong fetching your timeline.
        </p>
        <button
          className="mt-3.5 inline-flex items-center gap-1.5 rounded-[9px] border border-[#d8ddd6] bg-white px-4 py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          onClick={onRetry}
          type="button"
        >
          <WorkspaceIcon name="restore" size={15} strokeWidth={1.7} />
          Retry
        </button>
      </div>
    );
  }

  if (kind === "filtered") {
    return (
      <div className="mx-[18px] my-5 rounded-[14px] border border-[#d8ddd6] px-7 py-[52px] text-center">
        <span className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-full bg-[#f2f4f0]">
          {/* inline filter icon — 3 horizontal lines narrowing */}
          <svg fill="none" height="21" stroke="#c8cfc6" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24" width="21">
            <path d="M4 6h16" />
            <path d="M7 12h10" />
            <path d="M10 18h4" />
          </svg>
        </span>
        <p className="text-[15px] font-semibold text-[#1d2823]">No activity matches these filters</p>
        <p className="mx-auto mt-1.5 max-w-[360px] text-[13px] leading-[1.55] text-[#5c655e]">
          Try a different category or actor.
        </p>
        <button
          className="mt-3.5 rounded-[9px] border border-[#d8ddd6] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          onClick={onClear}
          type="button"
        >
          Clear filters
        </button>
      </div>
    );
  }

  // empty (no activity at all)
  return (
    <div className="mx-[18px] my-5 rounded-[14px] border border-[#d8ddd6] px-7 py-[52px] text-center">
      <span className="mx-auto mb-3.5 grid h-11 w-11 place-items-center rounded-full bg-[#f2f4f0] text-[#c8cfc6]">
        <WorkspaceIcon name="clock" size={22} strokeWidth={1.6} />
      </span>
      <p className="text-[15px] font-semibold text-[#1d2823]">No activity yet</p>
      <p className="mx-auto mt-1.5 max-w-[380px] text-[13px] leading-[1.55] text-[#5c655e]">
        {retention === null
          ? "Edits, syncs, imports, merges, and shares show up here."
          : `Edits, syncs, imports, merges, and shares from the last ${retention ?? 365} days show up here.`}
      </p>
    </div>
  );
}

// ── shared data hook ──────────────────────────────────────────────────────────
// One data path for the desktop feed and the mobile event rows (P24B-09): cursor
// pagination, category/actor filters, and plan-driven retention all live here so
// the two presentational layers never diverge.
export type ActivityFeedStatus = "idle" | "loading" | "loadingMore" | "error" | "done";

export function useActivityFeed(retentionDays: number | null = 90) {
  const [events, setEvents] = useState<ActivityEventRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [retention, setRetention] = useState<number | null>(retentionDays);
  const [category, setCategory] = useState("all");
  const [actor, setActor] = useState("all");
  const [status, setStatus] = useState<ActivityFeedStatus>("idle");

  const load = useCallback(
    async (nextCursor: string | null, nextCategory: string, nextActor: string) => {
      setStatus(nextCursor ? "loadingMore" : "loading");
      try {
        const url = new URL("/api/activity", window.location.origin);
        if (nextCursor) url.searchParams.set("cursor", nextCursor);
        if (nextCategory !== "all") url.searchParams.set("category", nextCategory);
        if (nextActor !== "all") url.searchParams.set("actor", nextActor);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          events: ActivityEventRow[];
          nextCursor: string | null;
          hasMore: boolean;
          retentionDays?: number | null;
        };
        if (data.retentionDays !== undefined) setRetention(data.retentionDays);
        setEvents((prev) => (nextCursor ? [...prev, ...data.events] : data.events));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [],
  );

  useEffect(() => { void load(null, category, actor); }, [load, category, actor]);

  const filtering = category !== "all" || actor !== "all";
  const clearFilters = useCallback(() => { setCategory("all"); setActor("all"); }, []);
  const loadMore = useCallback(() => { void load(cursor, category, actor); }, [load, cursor, category, actor]);
  const reload = useCallback(() => { void load(null, category, actor); }, [load, category, actor]);

  const retentionLabel =
    retention === null ? "Showing all activity" : `Showing the last ${retention} days`;

  return {
    events,
    status,
    hasMore,
    retention,
    retentionLabel,
    category,
    actor,
    filtering,
    setCategory,
    setActor,
    clearFilters,
    loadMore,
    reload,
  };
}

// ── main feed ─────────────────────────────────────────────────────────────────
export function ActivityFeed({ retentionDays = 90 }: { retentionDays?: number | null }) {
  const {
    events,
    status,
    hasMore,
    retention,
    retentionLabel,
    category,
    actor,
    filtering,
    setCategory,
    setActor,
    clearFilters: handleClear,
    loadMore,
    reload,
  } = useActivityFeed(retentionDays);

  return (
    <div className="flex flex-col" style={{ minHeight: 0 }}>
      <FilterBar
        actor={actor}
        category={category}
        onActor={setActor}
        onCategory={setCategory}
      />

      <div className="flex-1 overflow-y-auto">
        {/* loading */}
        {(status === "loading" || status === "idle") && (
          <div className="mx-auto mt-3 overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white py-1.5" style={{ maxWidth: 760, margin: "12px 18px 0" }}>
            <SkeletonRows />
          </div>
        )}

        {/* error (no events loaded) */}
        {status === "error" && events.length === 0 && (
          <EmptyState kind="error" onRetry={reload} />
        )}

        {/* empty */}
        {status === "done" && events.length === 0 && (
          <EmptyState
            kind={filtering ? "filtered" : "empty"}
            onClear={handleClear}
            retention={retention}
          />
        )}

        {/* populated */}
        {events.length > 0 && (
          <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px 18px 0" }}>
            <div className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white py-1.5">
              {events.map((event, i) => (
                <div key={event.id}>
                  {i > 0 && <div className="mx-3.5 h-px bg-[#e9ece7]" />}
                  <EventRow event={event} />
                </div>
              ))}

              {status === "loadingMore" && (
                <div>
                  <div className="mx-3.5 h-px bg-[#e9ece7]" />
                  <div className="flex animate-pulse gap-3 px-3.5 py-3">
                    <span className="h-[28px] w-[28px] shrink-0 rounded-full bg-[#eceee9]" />
                    <div className="flex-1 pt-0.5">
                      <span className="block h-[11px] w-[45%] rounded-[6px] bg-[#eceee9]" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* footer */}
            <div
              className="flex flex-col items-center gap-3.5 py-4 pb-7"
            >
              {hasMore ? (
                <button
                  className="rounded-[10px] border border-[#d8ddd6] bg-white px-[18px] py-[9px] text-[13px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0] disabled:opacity-50"
                  disabled={status === "loadingMore"}
                  onClick={loadMore}
                  type="button"
                >
                  {status === "loadingMore" ? "Loading…" : "Load more"}
                </button>
              ) : null}
              <span className="text-[12px] text-[#c8cfc6]">— {retentionLabel} —</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── locked (Free plan) upsell ─────────────────────────────────────────────────
export function ActivityLocked({ planLabel }: { planLabel: string }) {
  return (
    <div className="grid flex-1 place-items-center p-4 sm:p-10">
      <div className="w-full max-w-[460px] overflow-hidden rounded-[18px] border border-[#d8ddd6] bg-white px-6 py-8 text-center shadow-[0_1px_2px_rgba(20,30,25,0.03)] sm:px-9 sm:py-10">
        <span className="mx-auto mb-4 grid h-[60px] w-[60px] place-items-center rounded-full bg-[#e7efe9] text-[#17352e]">
          <WorkspaceIcon name="clock" size={28} strokeWidth={1.6} />
        </span>
        <h2 className="text-[20px] font-bold tracking-tight text-[#1d2823]">
          Activity log is a Pro feature
        </h2>
        <p className="mx-auto mt-2.5 max-w-[380px] text-[14px] leading-[1.6] text-[#5c655e]">
          See every edit, sync, import, merge, and share across all your contacts in one timeline —
          with a year of history and filters.
        </p>
        <Link
          className="mt-5 inline-flex h-[46px] items-center justify-center gap-1.5 rounded-[12px] bg-[#4158f4] px-6 text-[15px] font-semibold text-white transition hover:bg-[#3248db]"
          href="/settings"
        >
          Upgrade to Pro
        </Link>
        <p className="mt-4 text-[12.5px] text-[#8b938c]">
          You&apos;re on the {planLabel} plan.
        </p>
      </div>
    </div>
  );
}

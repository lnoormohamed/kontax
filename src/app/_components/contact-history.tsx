"use client";

import { useCallback, useEffect, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { formatFieldLabel } from "~/lib/activity/field-labels";
import { formatAbsoluteTime, formatRelativeTime } from "~/lib/activity/time";

type FieldDiff = { field: string; before: unknown; after: unknown };

type HistoryEvent = {
  id: string;
  eventType: string;
  actor: string;
  actorDetail: string | null;
  payload: unknown;
  createdAt: string;
  summary: string;
  actorLabel: string;
  actorIcon: string;
};

const ACTIVITY_LOG_START =
  process.env.NEXT_PUBLIC_ACTIVITY_LOG_START_DATE ?? "9 June 2026";

// Event-type → glyph + tint colour for the 28px actor circle.
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
const eventMeta = (t: string): EventMeta =>
  EVENT_META[t] ?? { icon: "pencil", color: "#4158f4" };

// ── value rendering ──────────────────────────────────────────────────────────
const stringifyScalar = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return typeof v === "symbol" ? v.toString() : `${v as string | number | boolean | bigint}`;
};

const renderValue = (v: unknown): string => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length > 0 ? v.map(stringifyScalar).join(", ") : "—";
  if (typeof v === "object") return JSON.stringify(v);
  const text = stringifyScalar(v);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

const getDiffs = (payload: unknown): FieldDiff[] => {
  if (payload && typeof payload === "object" && Array.isArray((payload as { diffs?: unknown }).diffs)) {
    return (payload as { diffs: FieldDiff[] }).diffs;
  }
  return [];
};

// ── diff table ───────────────────────────────────────────────────────────────
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
          <span className="pt-px font-medium text-[#8b938c]">
            {formatFieldLabel(diff.field)}
          </span>
          <span className="flex flex-wrap items-center gap-2 min-w-0">
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

// ── event row ────────────────────────────────────────────────────────────────
function EventRow({ event }: { event: HistoryEvent }) {
  const [open, setOpen] = useState(false);
  const diffs = getDiffs(event.payload);
  const expandable = diffs.length > 0;
  const meta = eventMeta(event.eventType);

  return (
    <div
      className="flex gap-3 rounded-[11px] px-3.5 py-3 transition-colors"
      style={expandable ? { cursor: "default" } : undefined}
      onMouseEnter={
        expandable
          ? (e) => { (e.currentTarget as HTMLDivElement).style.background = "#f2f4f0"; }
          : undefined
      }
      onMouseLeave={
        expandable
          ? (e) => { (e.currentTarget as HTMLDivElement).style.background = ""; }
          : undefined
      }
    >
      {/* glyph circle — color set on span so WorkspaceIcon inherits via currentColor */}
      <span
        className="mt-px grid h-[28px] w-[28px] shrink-0 place-items-center rounded-full bg-[#f2f4f0]"
        style={{ color: meta.color }}
      >
        <WorkspaceIcon name={meta.icon} size={14} strokeWidth={1.7} />
      </span>

      {/* body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <span className="flex-1 min-w-0 text-[13.5px] leading-[1.45] text-[#1d2823]">
            {event.summary}
          </span>
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
                {open ? "Hide changes" : `View ${diffs.length} change${diffs.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>

        {open && expandable && <DiffTable diffs={diffs} />}
      </div>
    </div>
  );
}

// ── skeleton ─────────────────────────────────────────────────────────────────
function SkeletonRows() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="flex gap-3 px-3.5 py-3" key={i}>
          <span className="h-[28px] w-[28px] shrink-0 rounded-full bg-[#eceee9]" />
          <div className="flex-1 pt-1">
            <span className="block h-[11px] w-[52%] rounded-[6px] bg-[#eceee9]" />
            <span className="mt-2 block h-[9px] w-[28%] rounded-[6px] bg-[#eceee9]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────
export function ContactHistory({ contactId }: { contactId: string }) {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "loadingMore" | "error" | "done">("idle");

  const load = useCallback(
    async (nextCursor: string | null) => {
      setStatus(nextCursor ? "loadingMore" : "loading");
      try {
        const url = new URL(`/api/contacts/${contactId}/history`, window.location.origin);
        if (nextCursor) url.searchParams.set("cursor", nextCursor);
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          events: HistoryEvent[];
          nextCursor: string | null;
          hasMore: boolean;
        };
        setEvents((prev) => (nextCursor ? [...prev, ...data.events] : data.events));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [contactId],
  );

  useEffect(() => { void load(null); }, [load]);

  // Loading skeleton
  if (status === "loading" || status === "idle") {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white py-1.5">
        <SkeletonRows />
      </div>
    );
  }

  // Error (empty)
  if (status === "error" && events.length === 0) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white px-6 py-10 text-center">
        <span className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-[#f3e1da] text-[#b5472f]">
          <WorkspaceIcon name="warning" size={20} strokeWidth={1.7} />
        </span>
        <p className="text-[14px] font-semibold text-[#1d2823]">Couldn&apos;t load history.</p>
        <p className="mt-1 text-[13px] text-[#5c655e]">Something went wrong fetching the timeline.</p>
        <button
          className="mt-4 inline-flex items-center gap-1.5 rounded-[9px] border border-[#d8ddd6] bg-white px-4 py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          onClick={() => void load(null)}
          type="button"
        >
          <WorkspaceIcon name="restore" size={14} strokeWidth={1.7} />
          Retry
        </button>
      </div>
    );
  }

  // Empty (no events)
  if (events.length === 0) {
    return (
      <div className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white px-6 py-11 text-center">
        <span className="mx-auto mb-3.5 grid h-[42px] w-[42px] place-items-center rounded-full bg-[#f2f4f0] text-[#c8cfc6]">
          <WorkspaceIcon name="clock" size={21} strokeWidth={1.6} />
        </span>
        <p className="text-[14.5px] font-semibold text-[#1d2823]">
          History starts from {ACTIVITY_LOG_START}
        </p>
        <p className="mx-auto mt-1.5 max-w-[330px] text-[13px] leading-[1.55] text-[#5c655e]">
          Changes made before this date aren&apos;t recorded. New changes appear here going forward.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* event card */}
      <div className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white py-1.5">
        {events.map((event, i) => (
          <div key={event.id}>
            {i > 0 && <div className="mx-3.5 h-px bg-[#e9ece7]" />}
            <EventRow event={event} />
          </div>
        ))}

        {status === "loadingMore" && (
          <div className="mx-3.5 mt-0.5">
            <div className="h-px bg-[#e9ece7]" />
            <div className="flex gap-3 px-0 py-3">
              <span className="h-[28px] w-[28px] shrink-0 animate-pulse rounded-full bg-[#eceee9]" />
              <div className="flex-1 pt-1">
                <span className="block h-[11px] w-[45%] animate-pulse rounded-[6px] bg-[#eceee9]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[12px] text-[#8b938c]">
          History starts from {ACTIVITY_LOG_START}
        </span>
        {hasMore ? (
          <button
            className="rounded-[9px] border border-[#d8ddd6] bg-white px-3.5 py-[7px] text-[12.5px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0] disabled:opacity-50"
            disabled={status === "loadingMore"}
            onClick={() => void load(cursor)}
            type="button"
          >
            {status === "loadingMore" ? "Loading…" : "Load more"}
          </button>
        ) : (
          <span className="text-[12px] text-[#c8cfc6]">— No older history —</span>
        )}
      </div>
    </div>
  );
}

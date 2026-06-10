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

// Event-type → timeline badge icon + colours (mirrors the design EVENT_META).
type EventMeta = { icon: string; bg: string; fg: string };
const EVENT_META: Record<string, EventMeta> = {
  CONTACT_CREATED: { icon: "plus", bg: "#e7efe9", fg: "#17352e" },
  CONTACT_UPDATED: { icon: "pencil", bg: "#e7ecfb", fg: "#4158f4" },
  CONTACT_ARCHIVED: { icon: "archive", bg: "#f6edd9", fg: "#bf8526" },
  CONTACT_RESTORED: { icon: "restore", bg: "#e7efe9", fg: "#17352e" },
  CONTACT_DELETED: { icon: "trash", bg: "#f3e1da", fg: "#b5472f" },
  CONTACT_MERGED: { icon: "merge", bg: "#f2f4f0", fg: "#5c655e" },
  CONTACT_MERGE_UNDONE: { icon: "merge", bg: "#f2f4f0", fg: "#5c655e" },
  CONTACT_IMPORTED: { icon: "download", bg: "#f2f4f0", fg: "#5c655e" },
  CONTACT_SHARED: { icon: "share", bg: "#e7ecfb", fg: "#4158f4" },
  CONTACT_SHARE_RECEIVED: { icon: "share", bg: "#e7ecfb", fg: "#4158f4" },
  SYNC_PULLED: { icon: "cloud", bg: "#f2f4f0", fg: "#5c655e" },
  SYNC_PUSHED: { icon: "cloud", bg: "#f2f4f0", fg: "#5c655e" },
  SYNC_CONFLICT_DETECTED: { icon: "warning", bg: "#f6edd9", fg: "#bf8526" },
  SYNC_CONFLICT_RESOLVED: { icon: "check", bg: "#e7efe9", fg: "#17352e" },
};
const eventMeta = (eventType: string): EventMeta =>
  EVENT_META[eventType] ?? { icon: "pencil", bg: "#e7ecfb", fg: "#4158f4" };

const stringifyScalar = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return typeof value === "symbol"
    ? value.toString()
    : `${value as string | number | boolean | bigint}`;
};

const renderValue = (value: unknown): string => {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(stringifyScalar).join(", ") : "—";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  const text = stringifyScalar(value);
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

const getDiffs = (payload: unknown): FieldDiff[] => {
  if (payload && typeof payload === "object" && Array.isArray((payload as { diffs?: unknown }).diffs)) {
    return (payload as { diffs: FieldDiff[] }).diffs;
  }
  return [];
};

function EventRow({ event, last }: { event: HistoryEvent; last: boolean }) {
  const [open, setOpen] = useState(false);
  const diffs = getDiffs(event.payload);
  const expandable = diffs.length > 0;
  const meta = eventMeta(event.eventType);

  return (
    <div className="relative flex gap-3">
      {/* timeline rail */}
      <div className="flex shrink-0 flex-col items-center">
        <span
          className="z-[1] grid h-[30px] w-[30px] place-items-center rounded-full"
          style={{ background: meta.bg, color: meta.fg }}
        >
          <WorkspaceIcon name={meta.icon} size={15} strokeWidth={1.8} />
        </span>
        {!last ? <span className="my-0.5 w-0.5 flex-1 bg-[#e9ece7]" /> : null}
      </div>

      <div className={`min-w-0 flex-1 ${last ? "" : "pb-[18px]"}`}>
        <div className="flex items-baseline gap-2">
          <p className="flex-1 text-[13.5px] leading-[1.4] text-[#1d2823]">
            <strong className="font-semibold">{event.actorLabel}</strong>{" "}
            <span className="text-[#5c655e]">{event.summary}</span>
          </p>
          <span
            className="shrink-0 whitespace-nowrap text-[12px] text-[#8b938c]"
            title={formatAbsoluteTime(event.createdAt)}
          >
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>

        {expandable ? (
          <>
            <button
              aria-expanded={open}
              className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#4158f4]"
              onClick={() => setOpen((v) => !v)}
              type="button"
            >
              <span
                className={`grid place-items-center transition-transform ${open ? "rotate-90" : ""}`}
              >
                <WorkspaceIcon name="chevronRight" size={13} strokeWidth={2} />
              </span>
              {open
                ? "Hide changes"
                : `View ${diffs.length} ${diffs.length === 1 ? "change" : "changes"}`}
            </button>
            {open ? (
              <div className="mt-2 grid gap-2 rounded-[10px] border border-[#e9ece7] bg-[#f6f7f4] px-3 py-2.5">
                {diffs.map((diff, index) => (
                  <div key={index}>
                    <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8b938c]">
                      {formatFieldLabel(diff.field)}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                      <span className="font-mono text-[#8b938c] line-through">
                        {renderValue(diff.before)}
                      </span>
                      <WorkspaceIcon className="text-[#aeb4ac]" name="chevronRight" size={13} strokeWidth={2} />
                      <span className="font-mono text-[#1d2823]">{renderValue(diff.after)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

function SkeletonTimeline() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="flex gap-3" key={index}>
          <div className="flex shrink-0 flex-col items-center">
            <span className="h-[30px] w-[30px] rounded-full bg-[#eef1ec]" />
            {index < 3 ? <span className="my-0.5 w-0.5 flex-1 bg-[#eef1ec]" /> : null}
          </div>
          <div className="flex-1 pb-[18px]">
            <span className="block h-3 w-2/3 rounded bg-[#eef1ec]" />
            <span className="mt-2 block h-2.5 w-24 rounded bg-[#eef1ec]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function HistoryCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-[#d8ddd6] bg-white px-[22px] py-5">{children}</div>
  );
}

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
        if (nextCursor) {
          url.searchParams.set("cursor", nextCursor);
        }
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          events: HistoryEvent[];
          nextCursor: string | null;
          hasMore: boolean;
        };
        setEvents((current) => (nextCursor ? [...current, ...data.events] : data.events));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [contactId],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  if (status === "loading" || status === "idle") {
    return (
      <HistoryCard>
        <SkeletonTimeline />
      </HistoryCard>
    );
  }

  if (status === "error" && events.length === 0) {
    return (
      <HistoryCard>
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-[#5c655e]">Couldn&apos;t load history.</p>
          <button
            className="rounded-lg border border-[#d8ddd6] px-3 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
            onClick={() => void load(null)}
            type="button"
          >
            Retry
          </button>
        </div>
      </HistoryCard>
    );
  }

  if (events.length === 0) {
    return (
      <div className="rounded-[14px] border border-dashed border-[#d8ddd6] px-6 py-11 text-center">
        <WorkspaceIcon className="mx-auto mb-2 text-[#aeb4ac]" name="clock" size={24} strokeWidth={1.5} />
        <p className="text-sm font-semibold text-[#5c655e]">Nothing here yet</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-[#8b938c]">
          Changes, syncs and merges will show up as you go. History starts from {ACTIVITY_LOG_START}.
        </p>
      </div>
    );
  }

  const oldest = events[events.length - 1];

  return (
    <HistoryCard>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="flex-1 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
          Activity
        </h3>
        <span className="text-[12px] text-[#8b938c]">
          {events.length} {events.length === 1 ? "event" : "events"}
        </span>
      </div>

      {events.map((event, index) => (
        <EventRow event={event} key={event.id} last={index === events.length - 1} />
      ))}

      <div className="mt-2 flex items-center justify-between gap-2.5 border-t border-[#e9ece7] pt-3.5">
        <span className="text-[12px] text-[#8b938c]">
          {hasMore
            ? `Showing the latest ${events.length}`
            : oldest
              ? `History starts ${formatRelativeTime(oldest.createdAt)}`
              : `History starts from ${ACTIVITY_LOG_START}`}
        </span>
        {hasMore ? (
          <button
            className="rounded-lg border border-[#d8ddd6] bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#5c655e] transition hover:bg-[#f2f4f0] disabled:opacity-50"
            disabled={status === "loadingMore"}
            onClick={() => void load(cursor)}
            type="button"
          >
            {status === "loadingMore" ? "Loading…" : "Load more"}
          </button>
        ) : null}
      </div>
    </HistoryCard>
  );
}

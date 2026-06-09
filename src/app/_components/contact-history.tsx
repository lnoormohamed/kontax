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

const stringifyScalar = (value: unknown): string => {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  // value is string | number | boolean | bigint | symbol here
  return typeof value === "symbol" ? value.toString() : `${value as string | number | boolean | bigint}`;
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

function EventRow({ event }: { event: HistoryEvent }) {
  const [open, setOpen] = useState(false);
  const diffs = getDiffs(event.payload);
  const expandable = diffs.length > 0;

  return (
    <li className="border-b border-[#edf0ea] last:border-b-0">
      <button
        aria-expanded={expandable ? open : undefined}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
          expandable ? "hover:bg-[#f2f4f0]" : "cursor-default"
        }`}
        onClick={() => expandable && setOpen((v) => !v)}
        type="button"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f2f4f0] text-[#5c655e]">
          <WorkspaceIcon name={event.actorIcon} size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-[#1d2823]">{event.summary}</span>
          <span className="block text-xs text-[#8b938c]">{event.actorLabel}</span>
        </span>
        <span
          className="shrink-0 text-xs text-[#8b938c]"
          title={formatAbsoluteTime(event.createdAt)}
        >
          {formatRelativeTime(event.createdAt)}
        </span>
        {expandable ? (
          <span className={`shrink-0 text-[#8b938c] transition ${open ? "rotate-180" : ""}`}>▾</span>
        ) : null}
      </button>
      {expandable && open ? (
        <div className="grid gap-1.5 px-3 pb-3 pl-[52px]">
          {diffs.map((diff, index) => (
            <div className="grid grid-cols-[120px_1fr] gap-2 text-xs" key={index}>
              <span className="text-[#8b938c]">{formatFieldLabel(diff.field)}</span>
              <span className="text-[#1d2823]">
                <span className="text-[#b5472f]">{renderValue(diff.before)}</span>
                <span className="mx-1.5 text-[#8b938c]">→</span>
                <span className="text-[#2f7d5b]">{renderValue(diff.after)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <li className="flex items-center gap-3 border-b border-[#edf0ea] px-3 py-3 last:border-b-0" key={index}>
          <span className="h-7 w-7 shrink-0 rounded-full bg-[#eef1ec]" />
          <span className="h-3 flex-1 rounded bg-[#eef1ec]" />
          <span className="h-3 w-16 rounded bg-[#eef1ec]" />
        </li>
      ))}
    </ul>
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
    return <SkeletonRows />;
  }

  if (status === "error" && events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
        <p className="text-sm text-[#5c655e]">Couldn&apos;t load history.</p>
        <button
          className="rounded-lg border border-[#d8ddd6] px-3 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          onClick={() => void load(null)}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f2f4f0] text-[#8b938c]">
          <WorkspaceIcon name="sync" size={18} />
        </span>
        <p className="text-sm font-semibold text-[#1d2823]">History starts from {ACTIVITY_LOG_START}</p>
        <p className="max-w-sm text-xs leading-5 text-[#8b938c]">
          Changes made before this date aren&apos;t recorded. New changes appear here going forward.
        </p>
      </div>
    );
  }

  return (
    <div>
      <ul>
        {events.map((event) => (
          <EventRow event={event} key={event.id} />
        ))}
      </ul>
      <div className="px-3 py-3 text-center">
        {hasMore ? (
          <button
            className="rounded-lg border border-[#d8ddd6] px-4 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-50"
            disabled={status === "loadingMore"}
            onClick={() => void load(cursor)}
            type="button"
          >
            {status === "loadingMore" ? "Loading…" : "Load more"}
          </button>
        ) : (
          <span className="text-xs text-[#aeb4ac]">— No older history —</span>
        )}
      </div>
    </div>
  );
}

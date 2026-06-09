"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { formatFieldLabel } from "~/lib/activity/field-labels";
import { formatAbsoluteTime, formatRelativeTime } from "~/lib/activity/time";

type FieldDiff = { field: string; before: unknown; after: unknown };

type ActivityEventRow = {
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

const CATEGORY_OPTIONS = [
  { key: "all", label: "All" },
  { key: "edits", label: "Edits" },
  { key: "sync", label: "Sync" },
  { key: "imports", label: "Imports" },
  { key: "merges", label: "Merges" },
  { key: "shares", label: "Shares" },
] as const;

const ACTOR_OPTIONS = [
  { key: "all", label: "Anyone" },
  { key: "you", label: "You" },
  { key: "sync", label: "Sync" },
  { key: "import", label: "Import" },
  { key: "shared", label: "Shared" },
] as const;

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
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as { diffs?: unknown }).diffs)
  ) {
    return (payload as { diffs: FieldDiff[] }).diffs;
  }
  return [];
};

function EventRow({ event }: { event: ActivityEventRow }) {
  const [open, setOpen] = useState(false);
  const diffs = getDiffs(event.payload);
  const expandable = diffs.length > 0;

  return (
    <li className="border-b border-[#edf0ea] last:border-b-0">
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#f2f4f0] text-[#5c655e]">
          <WorkspaceIcon name={event.actorIcon} size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[#1d2823]">
            {event.contactId ? (
              <Link className="font-semibold hover:underline" href={`/contacts/${event.contactId}`}>
                {event.contactName ?? "Contact"}
              </Link>
            ) : (
              <span className="font-semibold text-[#5c655e]">
                {event.contactName ?? "Deleted contact"}
              </span>
            )}{" "}
            <span className="text-[#5c655e]">{event.summary}</span>
          </p>
          <p className="mt-0.5 text-xs text-[#8b938c]">{event.actorLabel}</p>
          {expandable ? (
            <button
              aria-expanded={open}
              className="mt-1 text-xs font-semibold text-[#4158f4]"
              onClick={() => setOpen((v) => !v)}
              type="button"
            >
              {open ? "Hide changes" : `View ${diffs.length} ${diffs.length === 1 ? "change" : "changes"}`}
            </button>
          ) : null}
          {expandable && open ? (
            <div className="mt-2 grid gap-1.5">
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
        </div>
        <span
          className="shrink-0 text-xs text-[#8b938c]"
          title={formatAbsoluteTime(event.createdAt)}
        >
          {formatRelativeTime(event.createdAt)}
        </span>
      </div>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul className="animate-pulse">
      {Array.from({ length: 6 }).map((_, index) => (
        <li
          className="flex items-center gap-3 border-b border-[#edf0ea] px-4 py-3.5 last:border-b-0"
          key={index}
        >
          <span className="h-7 w-7 shrink-0 rounded-full bg-[#eef1ec]" />
          <span className="h-3 flex-1 rounded bg-[#eef1ec]" />
          <span className="h-3 w-16 rounded bg-[#eef1ec]" />
        </li>
      ))}
    </ul>
  );
}

function FilterChips({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ key: string; label: string }>;
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = value === option.key;
        return (
          <button
            className={`rounded-full px-3 py-1 text-[12.5px] font-semibold transition ${
              active
                ? "bg-[#17352e] text-white"
                : "bg-[#f2f4f0] text-[#5c655e] hover:bg-[#e7efe9]"
            }`}
            key={option.key}
            onClick={() => onChange(option.key)}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ActivityFeed({ retentionDays = 90 }: { retentionDays?: number | null }) {
  const [events, setEvents] = useState<ActivityEventRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [retention, setRetention] = useState<number | null>(retentionDays);
  const [category, setCategory] = useState("all");
  const [actor, setActor] = useState("all");
  const [status, setStatus] = useState<
    "idle" | "loading" | "loadingMore" | "error" | "done"
  >("idle");

  const load = useCallback(
    async (nextCursor: string | null, nextCategory: string, nextActor: string) => {
      setStatus(nextCursor ? "loadingMore" : "loading");
      try {
        const url = new URL("/api/activity", window.location.origin);
        if (nextCursor) {
          url.searchParams.set("cursor", nextCursor);
        }
        if (nextCategory !== "all") {
          url.searchParams.set("category", nextCategory);
        }
        if (nextActor !== "all") {
          url.searchParams.set("actor", nextActor);
        }
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          events: ActivityEventRow[];
          nextCursor: string | null;
          hasMore: boolean;
          retentionDays?: number | null;
        };
        if (data.retentionDays !== undefined) {
          setRetention(data.retentionDays);
        }
        setEvents((current) => (nextCursor ? [...current, ...data.events] : data.events));
        setCursor(data.nextCursor);
        setHasMore(data.hasMore);
        setStatus("done");
      } catch {
        setStatus("error");
      }
    },
    [],
  );

  useEffect(() => {
    void load(null, category, actor);
  }, [load, category, actor]);

  const filtering = category !== "all" || actor !== "all";

  return (
    <div className="p-4">
      <div className="flex flex-col gap-2.5 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <FilterChips onChange={setCategory} options={CATEGORY_OPTIONS} value={category} />
        <FilterChips onChange={setActor} options={ACTOR_OPTIONS} value={actor} />
      </div>

      <div className="overflow-hidden rounded-[1.2rem] border border-[#d8ddd6] bg-white">
        {status === "loading" || status === "idle" ? (
          <SkeletonRows />
        ) : status === "error" && events.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
            <p className="text-sm text-[#5c655e]">Couldn&apos;t load activity.</p>
            <button
              className="rounded-lg border border-[#d8ddd6] px-3 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
              onClick={() => void load(null, category, actor)}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[#f2f4f0] text-[#8b938c]">
              <WorkspaceIcon name="clock" size={18} />
            </span>
            <p className="text-sm font-semibold text-[#1d2823]">
              {filtering ? "No activity matches these filters" : "No activity yet"}
            </p>
            <p className="max-w-sm text-xs leading-5 text-[#8b938c]">
              {filtering
                ? "Try a different category or actor."
                : retention === null
                  ? "Edits, syncs, imports, merges, and shares show up here."
                  : `Edits, syncs, imports, merges, and shares from the last ${retention} days show up here.`}
            </p>
          </div>
        ) : (
          <>
            <ul>
              {events.map((event) => (
                <EventRow event={event} key={event.id} />
              ))}
            </ul>
            <div className="px-4 py-3 text-center">
              {hasMore ? (
                <button
                  className="rounded-lg border border-[#d8ddd6] px-4 py-1.5 text-xs font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-50"
                  disabled={status === "loadingMore"}
                  onClick={() => void load(cursor, category, actor)}
                  type="button"
                >
                  {status === "loadingMore" ? "Loading…" : "Load more"}
                </button>
              ) : (
                <span className="text-xs text-[#aeb4ac]">
                  {retention === null ? "— Showing all activity —" : `— Showing the last ${retention} days —`}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ActivityLocked({ planLabel }: { planLabel: string }) {
  return (
    <div className="p-4">
      <div className="mx-auto max-w-xl rounded-[1.6rem] border border-[#d8ddd6] bg-white px-6 py-12 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#e7efe9] text-[#17352e]">
          <WorkspaceIcon name="clock" size={22} />
        </span>
        <h2 className="mt-4 text-lg font-semibold text-[#1d2823]">Activity log is a Pro feature</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5c655e]">
          See every edit, sync, import, merge, and share across all your contacts in one timeline —
          with 90 days of history and filters. You&apos;re on the {planLabel} plan.
        </p>
        <Link
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#4158f4] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#3248db]"
          href="/settings"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}

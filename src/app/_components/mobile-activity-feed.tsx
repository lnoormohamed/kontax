"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";

import {
  ACTOR_OPTIONS,
  CATEGORY_OPTIONS,
  eventMeta,
  getDiffs,
  renderValue,
  useActivityFeed,
  type ActivityEventRow,
  type FieldDiff,
} from "~/app/_components/activity-feed";
import { GenuineEmpty } from "~/app/_components/mobile-variance";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { formatFieldLabel } from "~/lib/activity/field-labels";
import { dayGroupLabel, formatAbsoluteTime, formatRelativeTime } from "~/lib/activity/time";

// ── P24B-09 — Activity feed: mobile event rows (md:hidden) ────────────────────
// Purpose-built mobile layer for the design's `mob-activity.jsx` ActivityScreen:
// day-grouped GroupCard rows, scrollable category+actor chips, compact inline
// field-diffs, skeletons, genuine/filtered empty, retention caption, and
// load-more on scroll. Shares the data path with the desktop feed via
// `useActivityFeed` so the two never diverge.

const DAY_ORDER = ["Today", "Yesterday", "Earlier"] as const;

// ── compact stacked field-diff (no wide table) ───────────────────────────────
function DiffStack({ diffs }: { diffs: FieldDiff[] }) {
  const Val = ({ raw, color }: { raw: unknown; color: string }) => {
    const text = renderValue(raw);
    return text === "—" ? (
      <span className="font-sans text-[#aeb4ac]">—</span>
    ) : (
      <span
        className="max-w-[30ch] overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12px]"
        style={{ color }}
        title={text}
      >
        {text}
      </span>
    );
  };
  return (
    <div className="mt-[9px] overflow-hidden rounded-[10px] border border-[#e9ece7] bg-[#f2f4f0]">
      {diffs.map((d, i) => (
        <div className="px-3 py-[9px]" key={i} style={{ borderTop: i > 0 ? "1px solid #e9ece7" : "none" }}>
          <div className="text-[11.5px] font-semibold tracking-[0.01em] text-[#8b938c]">
            {formatFieldLabel(d.field)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Val color="#b5472f" raw={d.before} />
            <WorkspaceIcon className="shrink-0 text-[#aeb4ac]" name="chevronRight" size={12} strokeWidth={2.2} />
            <Val color="#2f7d5b" raw={d.after} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── event row ─────────────────────────────────────────────────────────────────
function EventRow({ event, last }: { event: ActivityEventRow; last: boolean }) {
  const [open, setOpen] = useState(false);
  const diffs = getDiffs(event.payload);
  const expandable = diffs.length > 0;
  const meta = eventMeta(event.eventType);

  return (
    <div className="flex gap-3 px-[15px] py-[13px]" style={{ borderBottom: last ? "none" : "1px solid #e9ece7" }}>
      <span
        className="mt-px grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#f2f4f0]"
        style={{ color: meta.color }}
      >
        <WorkspaceIcon name={meta.icon} size={16} strokeWidth={1.7} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <p className="min-w-0 flex-1 text-[13.5px] leading-[1.45] text-[#5c655e]">
            {event.contactName &&
              (event.contactId ? (
                <>
                  <Link className="text-[14.5px] font-semibold text-[#4158f4] hover:underline" href={`/contacts/${event.contactId}`}>
                    {event.contactName}
                  </Link>{" "}
                  <span className="text-[#aeb4ac]">·</span>{" "}
                </>
              ) : (
                <>
                  <span className="text-[14.5px] font-semibold text-[#8b938c]" title="This contact was permanently deleted">
                    {event.contactName}
                  </span>{" "}
                  <span className="text-[#aeb4ac]">·</span>{" "}
                </>
              ))}
            {event.contactName
              ? event.summary.charAt(0).toLowerCase() + event.summary.slice(1)
              : event.summary}
          </p>
          <span
            className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-[#8b938c]"
            title={formatAbsoluteTime(event.createdAt)}
          >
            {formatRelativeTime(event.createdAt)}
          </span>
        </div>

        <div className="mt-[3px] flex flex-wrap items-center gap-2 text-[12px] text-[#8b938c]">
          <span>{event.actorLabel}</span>
          {expandable && (
            <>
              <span className="text-[#aeb4ac]">·</span>
              <button
                aria-expanded={open}
                className="inline-flex items-center gap-1 font-semibold text-[#4158f4]"
                onClick={() => setOpen((v) => !v)}
                type="button"
              >
                <span
                  style={{
                    display: "inline-flex",
                    transition: "transform .16s ease",
                    transform: open ? "rotate(90deg)" : "none",
                  }}
                >
                  <WorkspaceIcon name="chevronRight" size={12} strokeWidth={2.2} />
                </span>
                {open ? "Hide changes" : `${diffs.length} change${diffs.length === 1 ? "" : "s"}`}
              </button>
            </>
          )}
        </div>

        {open && expandable && <DiffStack diffs={diffs} />}
      </div>
    </div>
  );
}

// ── skeleton row (icon circle + two shimmer lines) ────────────────────────────
function SkeletonRow({ last }: { last: boolean }) {
  return (
    <div className="flex animate-pulse gap-3 px-[15px] py-[13px]" style={{ borderBottom: last ? "none" : "1px solid #e9ece7" }}>
      <span className="mt-px h-8 w-8 shrink-0 rounded-full bg-[#eceee9]" />
      <div className="flex-1 pt-1">
        <span className="block h-[11px] w-[54%] rounded-[6px] bg-[#eceee9]" />
        <span className="mt-[9px] block h-[9px] w-[30%] rounded-[6px] bg-[#eceee9]" />
      </div>
    </div>
  );
}

// ── group header + card chrome (mirrors the design's GroupHeader / GroupCard) ──
function GroupHeader({ label }: { label: string }) {
  return (
    <div className="sticky top-0 z-[1] flex h-7 items-center bg-[#f6f7f4] px-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#8b938c]">{label}</span>
    </div>
  );
}

function GroupCard({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white">{children}</div>;
}

// ── filter chip row (horizontally scrollable, category + actor) ───────────────
function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      className="inline-flex h-[30px] shrink-0 items-center whitespace-nowrap rounded-full border px-[13px] text-[12.5px] font-semibold transition"
      onClick={onClick}
      style={
        active
          ? { background: "#17352e", borderColor: "#17352e", color: "#fff" }
          : { background: "#fff", borderColor: "#d8ddd6", color: "#5c655e" }
      }
      type="button"
    >
      {label}
    </button>
  );
}

function FilterBar({
  category,
  actor,
  filtering,
  onCategory,
  onActor,
  onClear,
}: {
  category: string;
  actor: string;
  filtering: boolean;
  onCategory: (v: string) => void;
  onActor: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="sticky top-0 z-30 flex shrink-0 items-center gap-[7px] overflow-x-auto border-b border-[#d8ddd6] bg-white px-4 py-[11px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <span className="shrink-0 pr-px text-[10px] font-bold uppercase tracking-[0.06em] text-[#8b938c]">Type</span>
      {CATEGORY_OPTIONS.map((o) => (
        <Chip active={category === o.key} key={o.key} label={o.label} onClick={() => onCategory(o.key)} />
      ))}
      <span className="mx-[3px] h-[18px] w-px shrink-0 bg-[#e9ece7]" />
      <span className="shrink-0 pr-px text-[10px] font-bold uppercase tracking-[0.06em] text-[#8b938c]">By</span>
      {ACTOR_OPTIONS.map((o) => (
        <Chip active={actor === o.key} key={o.key} label={o.label} onClick={() => onActor(o.key)} />
      ))}
      {filtering && (
        <button
          className="inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#f2f4f0] px-[11px] text-[12.5px] font-semibold text-[#5c655e]"
          onClick={onClear}
          type="button"
        >
          <svg fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeWidth="2.2" viewBox="0 0 24 24" width="13">
            <path d="M6 6l12 12" />
            <path d="M18 6L6 18" />
          </svg>
          Clear
        </button>
      )}
    </div>
  );
}

// ── filtered-empty (distinct from genuine empty; offers Clear, never upgrade) ──
function FilteredEmpty({ onClear }: { onClear: () => void }) {
  return (
    <div className="grid place-items-center px-[30px] py-10 text-center">
      <span className="mx-auto mb-3.5 grid h-[54px] w-[54px] place-items-center rounded-[15px] bg-[#f2f4f0]">
        <svg fill="none" height="24" stroke="#aeb4ac" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24" width="24">
          <path d="M4 6h16" />
          <path d="M7 12h10" />
          <path d="M10 18h4" />
        </svg>
      </span>
      <div className="text-[16px] font-semibold text-[#1d2823]">No activity matches these filters</div>
      <p className="mx-auto mt-[7px] max-w-[240px] text-[13px] leading-[1.5] text-[#8b938c]">
        Try a different category or actor.
      </p>
      <button
        className="mt-3.5 h-[38px] rounded-[10px] border border-[#d8ddd6] bg-white px-[18px] text-[13px] font-semibold text-[#1d2823]"
        onClick={onClear}
        type="button"
      >
        Clear filters
      </button>
    </div>
  );
}

export function MobileActivityFeed({ retentionDays = 90 }: { retentionDays?: number | null }) {
  const {
    events,
    status,
    hasMore,
    retentionLabel,
    category,
    actor,
    filtering,
    setCategory,
    setActor,
    clearFilters,
    loadMore,
  } = useActivityFeed(retentionDays);

  // Load-more on scroll via a bottom sentinel — works regardless of which
  // ancestor is the scroll container (the dashboard's overflow-y-auto wrapper).
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore || status !== "done") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore();
      },
      { rootMargin: "120px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, status, loadMore]);

  const loading = status === "idle" || status === "loading";

  // bucket loaded events by day, preserving API (reverse-chronological) order
  const groups: { day: string; items: ActivityEventRow[] }[] = [];
  for (const e of events) {
    const day = dayGroupLabel(e.createdAt);
    const tail = groups[groups.length - 1];
    if (tail?.day !== day) groups.push({ day, items: [e] });
    else tail.items.push(e);
  }
  // stable day labelling order even if buckets interleave oddly
  groups.sort((a, b) => DAY_ORDER.indexOf(a.day as never) - DAY_ORDER.indexOf(b.day as never));

  return (
    <div className="flex w-full flex-col md:hidden" style={{ background: "#f6f7f4" }}>
      <FilterBar
        actor={actor}
        category={category}
        filtering={filtering}
        onActor={setActor}
        onCategory={setCategory}
        onClear={clearFilters}
      />

      <div className="pb-6 pt-2">
        {loading ? (
          <>
            <GroupHeader label="Today" />
            <GroupCard>
              {[0, 1, 2].map((i) => (
                <SkeletonRow key={i} last={i === 2} />
              ))}
            </GroupCard>
            <GroupHeader label="Earlier" />
            <GroupCard>
              {[0, 1, 2, 3].map((i) => (
                <SkeletonRow key={i} last={i === 3} />
              ))}
            </GroupCard>
          </>
        ) : events.length === 0 ? (
          filtering ? (
            <FilteredEmpty onClear={clearFilters} />
          ) : (
            <div className="px-4 pt-6">
              <GenuineEmpty
                body="Edits, syncs, imports, merges and shares show up here as you use Kontax."
                icon="clock"
                title="No activity yet"
              />
            </div>
          )
        ) : (
          <>
            {groups.map((g) => (
              <Fragment key={g.day}>
                <GroupHeader label={g.day} />
                <GroupCard>
                  {g.items.map((e, i) => (
                    <EventRow event={e} key={e.id} last={i === g.items.length - 1} />
                  ))}
                </GroupCard>
              </Fragment>
            ))}

            {/* sentinel + load-more spinner */}
            <div ref={sentinel} />
            {status === "loadingMore" && (
              <div className="flex items-center justify-center gap-[9px] px-0 pb-3.5 pt-1.5 text-[#8b938c]">
                <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-[#d8ddd6] border-t-[#17352e]" />
                <span className="text-[12.5px] font-medium">Loading more…</span>
              </div>
            )}
            {!hasMore && status !== "loadingMore" && (
              <div className="px-4 pb-1 pt-1.5 text-center text-[12px] text-[#aeb4ac]">— {retentionLabel} —</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

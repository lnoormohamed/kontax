"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import type { InvestigationTimelineEntry } from "~/server/admin/investigation-timeline";
import { AD, AdIcon } from "./admin-icons";
import { SupportNoteComposer } from "./support-note-composer";

type TimelineFilter = "all" | "notes" | "cases" | "audit" | "sync";

const FILTER_LABELS: Record<TimelineFilter, string> = {
  all: "All",
  notes: "Notes",
  cases: "Cases",
  audit: "Admin actions",
  sync: "Sync activity",
};

const SOURCE_ICON: Record<InvestigationTimelineEntry["source"], string> = {
  notes: "edit",
  cases: "card",
  audit: "audit",
  sync: "sync",
};

export function InvestigationTimeline({
  title = "Investigation timeline",
  entries,
  subjectType,
  subjectId,
  targetUserId,
  placeholder,
  emptyMessage,
}: {
  title?: string;
  entries: InvestigationTimelineEntry[];
  subjectType: string;
  subjectId: string;
  targetUserId?: string | null;
  placeholder: string;
  emptyMessage: string;
}) {
  const [filter, setFilter] = useState<TimelineFilter>("all");

  const counts = useMemo(
    () => ({
      all: entries.length,
      notes: entries.filter((entry) => entry.source === "notes").length,
      cases: entries.filter((entry) => entry.source === "cases").length,
      audit: entries.filter((entry) => entry.source === "audit").length,
      sync: entries.filter((entry) => entry.source === "sync").length,
    }),
    [entries],
  );

  const filteredEntries = useMemo(
    () => (filter === "all" ? entries : entries.filter((entry) => entry.source === filter)),
    [entries, filter],
  );

  return (
    <section className="ad-card">
      <div className="ad-card-head">
        <h3 className="ad-card-title">{title}</h3>
      </div>

      <SupportNoteComposer
        subjectType={subjectType}
        subjectId={subjectId}
        targetUserId={targetUserId ?? null}
        placeholder={placeholder}
      />

      <div className="ad-support-tabs" style={{ marginTop: 14 }}>
        {(["all", "notes", "cases", "audit", "sync"] as TimelineFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            className="ad-support-tab"
            data-active={filter === key ? "1" : "0"}
            onClick={() => setFilter(key)}
          >
            <span>{FILTER_LABELS[key]}</span>
            <span className="ad-support-tab__count tnum">{counts[key]}</span>
          </button>
        ))}
      </div>

      <div className="ad-investigation-list">
        {filteredEntries.length === 0 ? (
          <div className="ad-support-note" style={{ marginTop: 14 }}>
            {emptyMessage}
          </div>
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="ad-investigation-item">
              <div className="ad-investigation-item__rail">
                <span className="ad-investigation-item__icon" data-tone={entry.tone}>
                  <AdIcon
                    name={SOURCE_ICON[entry.source]}
                    size={14}
                    c={
                      entry.tone === "danger"
                        ? AD.red
                        : entry.tone === "warning"
                          ? AD.amber
                          : entry.tone === "success"
                            ? AD.green
                            : entry.tone === "info"
                              ? AD.blue
                              : AD.ink2
                    }
                  />
                </span>
              </div>

              <div className="ad-investigation-item__body">
                <div className="ad-investigation-item__head">
                  <div>
                    <div className="ad-investigation-item__source">{entry.sourceLabel}</div>
                    <div className="ad-investigation-item__title">
                      {entry.href ? (
                        <Link href={entry.href} className="ad-link">
                          {entry.title}
                        </Link>
                      ) : (
                        entry.title
                      )}
                    </div>
                  </div>
                  <div className="ad-investigation-item__when">
                    <div>{entry.when}</div>
                    <div>{entry.atLabel} UTC</div>
                  </div>
                </div>

                <div className="ad-investigation-item__meta">
                  {entry.actor ? `${entry.actor} · ` : ""}
                  {FILTER_LABELS[entry.source]}
                </div>

                {entry.body ? (
                  <div className="ad-investigation-item__text">{entry.body}</div>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

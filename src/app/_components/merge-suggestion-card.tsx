"use client";

import Link from "next/link";
import { useState } from "react";

import { dismissMergeSuggestion } from "~/app/actions/merge";
import type { PersistedMergeSuggestion, SuggestionContact } from "~/server/contact-merge";

// ── Comparison table ─────────────────────────────────────────────────────────

type Field = { key: keyof SuggestionContact; label: string };

const COMPARE_FIELDS: Field[] = [
  { key: "fullName", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "jobTitle", label: "Title" },
  { key: "address", label: "Address" },
  { key: "birthday", label: "Birthday" },
  { key: "notes", label: "Notes" },
];

function truncate(s: string | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function ComparisonTable({ a, b }: { a: SuggestionContact; b: SuggestionContact }) {
  const nameA = a.fullName ?? "Contact A";
  const nameB = b.fullName ?? "Contact B";
  return (
    <>
      {/* Desktop: 3-col table */}
      <table className="mt-3 hidden w-full border-collapse text-[12.5px] md:table">
        <thead>
          <tr className="border-b border-[#edf0ea]">
            <th className="w-[80px] py-1.5 pr-3 text-left text-[12px] font-semibold text-[#8b938c]">
              Field
            </th>
            <th className="py-1.5 pr-3 text-left">
              <div className="text-[12px] font-semibold text-[#8b938c] truncate">{nameA}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#aeb4ac]">Contact A</div>
            </th>
            <th className="py-1.5 text-left">
              <div className="text-[12px] font-semibold text-[#8b938c] truncate">{nameB}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#aeb4ac]">Contact B</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_FIELDS.map(({ key, label }) => {
            const aVal = a[key] as string | null;
            const bVal = b[key] as string | null;
            if (!aVal && !bVal) return null;
            const differs = aVal !== bVal;
            return (
              <tr
                key={key}
                className="border-b border-[#f2f4f0] last:border-b-0"
                style={{ background: differs ? "#fff0bf" : "transparent" }}
              >
                <td className="py-1.5 pr-3 font-medium text-[#8b938c]">{label}</td>
                <td
                  className="py-1.5 pr-3"
                  style={{ color: differs ? "#1d2823" : "#8b938c" }}
                >
                  {truncate(aVal, 80) ?? "—"}
                </td>
                <td
                  className="py-1.5"
                  style={{ color: differs ? "#1d2823" : "#8b938c" }}
                >
                  {truncate(bVal, 80) ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile: stacked dl */}
      <dl className="mt-3 grid gap-3 md:hidden">
        {COMPARE_FIELDS.map(({ key, label }) => {
          const aVal = a[key] as string | null;
          const bVal = b[key] as string | null;
          if (!aVal && !bVal) return null;
          const differs = aVal !== bVal;
          return (
            <div key={key}>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8b938c] mb-1">
                {label}
              </dt>
              {differs ? (
                <dd
                  className="rounded-lg px-2.5 py-2 grid gap-1"
                  style={{ background: "#fff0bf" }}
                >
                  <span className="text-[13px] text-[#1d2823]">
                    {truncate(aVal, 80) ?? "—"}{" "}
                    <span className="text-[11.5px] text-[#8b938c]">· {nameA}</span>
                  </span>
                  <span className="text-[13px] text-[#1d2823]">
                    {truncate(bVal, 80) ?? "—"}{" "}
                    <span className="text-[11.5px] text-[#8b938c]">· {nameB}</span>
                  </span>
                </dd>
              ) : (
                <dd className="text-[13px] text-[#8b938c]">{aVal ?? "—"}</dd>
              )}
            </div>
          );
        })}
      </dl>
    </>
  );
}

// ── Confidence pill ───────────────────────────────────────────────────────────

function ConfidencePill({ confidence }: { confidence: string }) {
  const styles =
    confidence === "high"
      ? "bg-[#eef5ef] text-[#17352e]"
      : confidence === "medium"
        ? "bg-[#f6edd9] text-[#7a5a1a]"
        : "bg-[#f2f4f0] text-[#8b938c]";
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-[6px] px-2 text-[11.5px] font-bold uppercase tracking-[0.02em] ${styles}`}
    >
      {confidence}
    </span>
  );
}

// ── Signal chips ──────────────────────────────────────────────────────────────

function SignalChips({ signals }: { signals: string[] }) {
  if (!signals.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {signals.map((label) => (
        <span
          key={label}
          className="inline-flex h-[20px] items-center rounded-[5px] px-2 text-[11px] font-medium"
          style={{ background: "#f2f4f0", color: "#5c655e" }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}

// ── The card ──────────────────────────────────────────────────────────────────

export function MergeSuggestionCard({
  suggestion,
  onDismissed,
}: {
  suggestion: PersistedMergeSuggestion;
  onDismissed: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState("");

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await Promise.all([
        fetch("/api/merge-suggestions/dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suggestionId: suggestion.id }),
        }).then((r) => {
          if (!r.ok) throw new Error();
        }),
        dismissMergeSuggestion(suggestion.leftContact.id, suggestion.rightContact.id),
      ]);
      onDismissed();
    } catch {
      setError("Couldn't dismiss — try again");
      setDismissing(false);
    }
  };

  return (
    <article
      className="rounded-[14px] border border-[#d8ddd6] bg-white p-4"
      style={{ transition: "opacity 200ms, max-height 200ms" }}
    >
      {/* Header row: confidence + actions */}
      <div className="flex items-center justify-between gap-3">
        <ConfidencePill confidence={suggestion.confidence} />
        <div className="flex items-center gap-2">
          <Link
            className="inline-flex items-center gap-1 rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            href={`/merge-suggestions/${suggestion.id}`}
          >
            Review →
          </Link>
          <button
            className="rounded-[9px] px-3 py-1.5 text-[13px] font-semibold text-[#b5472f] transition hover:bg-[#fdf3f1] disabled:opacity-50"
            disabled={dismissing}
            onClick={handleDismiss}
            type="button"
          >
            {dismissing ? "Dismissing…" : "Not a duplicate"}
          </button>
        </div>
      </div>

      {/* Contact pair */}
      <div className="mt-3 grid grid-cols-[1fr_1px_1fr] items-center gap-4 md:grid-cols-[1fr_1px_1fr]">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d2823]">
            {suggestion.leftContact.fullName ?? "—"}
          </p>
          <p className="truncate text-[12px] text-[#8b938c]">
            {suggestion.leftContact.email ?? suggestion.leftContact.phone ?? ""}
          </p>
        </div>
        <div className="w-px self-stretch bg-[#edf0ea]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d2823]">
            {suggestion.rightContact.fullName ?? "—"}
          </p>
          <p className="truncate text-[12px] text-[#8b938c]">
            {suggestion.rightContact.email ?? suggestion.rightContact.phone ?? ""}
          </p>
        </div>
      </div>

      {/* Mobile: stacked pair */}
      <div className="mt-3 grid gap-3 md:hidden">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d2823]">
            {suggestion.leftContact.fullName ?? "—"}
          </p>
          <p className="truncate text-[12px] text-[#8b938c]">
            {suggestion.leftContact.email ?? suggestion.leftContact.phone ?? ""}
          </p>
        </div>
        <div className="h-px bg-[#f2f4f0]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d2823]">
            {suggestion.rightContact.fullName ?? "—"}
          </p>
          <p className="truncate text-[12px] text-[#8b938c]">
            {suggestion.rightContact.email ?? suggestion.rightContact.phone ?? ""}
          </p>
        </div>
      </div>

      {/* Signal chips */}
      <SignalChips signals={suggestion.displaySignals} />

      {/* Expand toggle + comparison panel */}
      <div className="mt-3 border-t border-[#edf0ea] pt-3">
        <button
          className="flex items-center gap-1 text-[12.5px] font-semibold text-[#4158f4] hover:underline"
          onClick={() => setExpanded((e) => !e)}
          type="button"
        >
          Compare fields {expanded ? "↑" : "↓"}
        </button>
        <div
          className="overflow-hidden transition-all duration-200"
          style={{ maxHeight: expanded ? "800px" : "0px" }}
        >
          <ComparisonTable a={suggestion.leftContact} b={suggestion.rightContact} />
        </div>
      </div>

      {error ? <p className="mt-2 text-[12px] text-[#b5472f]">{error}</p> : null}
    </article>
  );
}

// ── Wrapper with optimistic list ──────────────────────────────────────────────

export function MergeSuggestionList({
  suggestions,
}: {
  suggestions: PersistedMergeSuggestion[];
}) {
  const [visible, setVisible] = useState(() => suggestions.map((s) => s.id));

  const dismiss = (id: string) => setVisible((v) => v.filter((x) => x !== id));

  const shown = suggestions.filter((s) => visible.includes(s.id));

  if (shown.length === 0) {
    return (
      <div className="m-4 rounded-[1.6rem] border border-dashed border-[#d8ddd6] bg-white px-6 py-12 text-center text-sm text-slate-500">
        No duplicates to review. Kontax scans as you add and import contacts — you&apos;re all
        clear.
      </div>
    );
  }

  return (
    <div className="grid gap-3 p-4">
      {shown.map((s) => (
        <MergeSuggestionCard key={s.id} suggestion={s} onDismissed={() => dismiss(s.id)} />
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  dismissMergeSuggestion,
  mergeClusterContacts,
  quickMergeSuggestion,
} from "~/app/actions/merge";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { arePhoneValuesEquivalent } from "~/lib/phone-normalization";
import type {
  PersistedMergeSuggestion,
  SuggestionContact,
} from "~/server/contact-merge";

// Next.js throws this when the browser has a stale bundle from a prior deploy.
const toMergeError = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("was not found on the server") || msg.includes("Server Action")) {
    return "Page is out of date — please hard-refresh (⌘⇧R) and try again.";
  }
  return msg || "Merge failed — try again";
};

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

function getContactDisplayName(contact: SuggestionContact, fallback: string) {
  return (
    contact.fullName?.trim() ||
    contact.company?.trim() ||
    fallback
  );
}

function truncate(s: string | null, max: number): string | null {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function ComparisonTable({ a, b }: { a: SuggestionContact; b: SuggestionContact }) {
  const nameA = getContactDisplayName(a, "Contact A");
  const nameB = getContactDisplayName(b, "Contact B");
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
              <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#aeb4ac]">Base record</div>
            </th>
            <th className="py-1.5 text-left">
              <div className="text-[12px] font-semibold text-[#8b938c] truncate">{nameB}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#aeb4ac]">Merged from</div>
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
                    <span className="text-[11.5px] text-[#8b938c]">· Base record</span>
                  </span>
                  <span className="text-[13px] text-[#1d2823]">
                    {truncate(bVal, 80) ?? "—"}{" "}
                    <span className="text-[11.5px] text-[#8b938c]">· Merged from</span>
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

// ── Lite diff row (always visible, only differing fields) ────────────────────

const LITE_FIELDS: { key: keyof SuggestionContact; label: string }[] = [
  { key: "fullName", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "jobTitle", label: "Title" },
];

const normalizeCompare = (value: string | null | undefined) => value?.trim() ?? "";

function BaseContactPill() {
  return (
    <span className="mt-2 inline-flex h-[20px] items-center rounded-[999px] bg-[#eef5ef] px-2 text-[11px] font-semibold text-[#17352e]">
      Quick merge keeps this record
    </span>
  );
}

function LiteComparison({
  a,
  b,
  suggestion,
}: {
  a: SuggestionContact;
  b: SuggestionContact;
  suggestion: PersistedMergeSuggestion;
}) {
  const summaries = LITE_FIELDS.flatMap(({ key, label }) => {
    const rawA = a[key] as string | null;
    const rawB = b[key] as string | null;
    if (!(rawA || rawB)) return [];
    if (key === "phone" && arePhoneValuesEquivalent(rawA, rawB)) return [];
    if (key !== "phone" && rawA === rawB) return [];

    const mergedValue =
      suggestion.quickMergePreview.mergedContact[key as keyof typeof suggestion.quickMergePreview.mergedContact];
    const mergedText = typeof mergedValue === "string" ? mergedValue : null;
    const preservesBothValues =
      key === "email"
        ? Boolean(
            normalizeCompare(rawA) &&
              normalizeCompare(rawB) &&
              normalizeCompare(rawA).toLowerCase() !== normalizeCompare(rawB).toLowerCase(),
          )
        : key === "phone"
          ? Boolean(
              normalizeCompare(rawA) &&
                normalizeCompare(rawB) &&
                !arePhoneValuesEquivalent(rawA, rawB),
            )
          : false;

    if (preservesBothValues) {
      return [{ key, text: `${label}: keep both values` }];
    }

    const leftMatches =
      normalizeCompare(rawA) !== "" &&
      normalizeCompare(rawA) === normalizeCompare(mergedText);
    const rightMatches =
      normalizeCompare(rawB) !== "" &&
      normalizeCompare(rawB) === normalizeCompare(mergedText);

    if (leftMatches && rightMatches) {
      return [{ key, text: `${label}: keep shared value` }];
    }

    const keptValue = leftMatches ? rawA : rightMatches ? rawB : mergedText;
    return keptValue
      ? [{ key, text: `${label}: keep ${truncate(keptValue, 36)}` }]
      : [];
  });

  if (summaries.length === 0) return null;

  return (
    <div className="mt-3 rounded-[10px] border border-[#edf0ea] bg-[#f9faf8] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#8b938c]">
        Quick merge will keep
      </p>
      <ul className="mt-2 grid gap-1.5 text-[12.5px] text-[#1d2823]">
        {summaries.slice(0, 3).map((summary) => (
          <li key={summary.key} className="flex items-start gap-2">
            <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#17352e]" />
            <span className="min-w-0 truncate">{summary.text}</span>
          </li>
        ))}
      </ul>
      {summaries.length > 3 ? (
        <p className="mt-2 text-[11.5px] text-[#8b938c]">
          +{summaries.length - 3} more default field choices in full comparison
        </p>
      ) : null}
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
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

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

  const handleQuickMerge = () => {
    setMerging(true);
    startTransition(async () => {
      try {
        await quickMergeSuggestion(suggestion.id);
        onDismissed();
        router.refresh();
      } catch (e) {
        setError(toMergeError(e));
        setMerging(false);
      }
    });
  };

  const busy = dismissing || merging;
  const leftDisplayName = getContactDisplayName(suggestion.leftContact, "—");
  const rightDisplayName = getContactDisplayName(suggestion.rightContact, "—");

  return (
    <article
      className="rounded-[14px] border border-[#d8ddd6] bg-white p-4"
      style={{ transition: "opacity 200ms" }}
    >
      {/* Header row: confidence pill + action buttons */}
      <div className="flex items-start justify-between gap-3">
        <ConfidencePill confidence={suggestion.confidence} />
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#17352e] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#20443b] disabled:opacity-50"
            disabled={busy}
            onClick={handleQuickMerge}
            type="button"
          >
            {merging ? (
              <>
                <span className="h-[12px] w-[12px] animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
                Merging…
              </>
            ) : (
              <>
                <WorkspaceIcon name="merge" size={13} strokeWidth={2} />
                Merge
              </>
            )}
          </button>
          <Link
            className="inline-flex items-center gap-1 rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            href={`/merge-suggestions/${suggestion.id}`}
          >
            Review →
          </Link>
          <button
            className="rounded-[9px] px-3 py-1.5 text-[13px] font-semibold text-[#b5472f] transition hover:bg-[#fdf3f1] disabled:opacity-50"
            disabled={busy}
            onClick={handleDismiss}
            type="button"
          >
            {dismissing ? "Dismissing…" : "Not a duplicate"}
          </button>
        </div>
      </div>

      {/* Contact pair — desktop side-by-side */}
      <div className="mt-3 hidden grid-cols-[1fr_1px_1fr] items-center gap-4 md:grid">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d2823]">
            {leftDisplayName}
          </p>
          <p className="truncate text-[12px] text-[#8b938c]">
            {suggestion.leftContact.email ?? suggestion.leftContact.phone ?? ""}
          </p>
          {suggestion.quickMergePreview.survivorSide === "left" ? <BaseContactPill /> : null}
        </div>
        <div className="w-px self-stretch bg-[#edf0ea]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d2823]">
            {rightDisplayName}
          </p>
          <p className="truncate text-[12px] text-[#8b938c]">
            {suggestion.rightContact.email ?? suggestion.rightContact.phone ?? ""}
          </p>
          {suggestion.quickMergePreview.survivorSide === "right" ? <BaseContactPill /> : null}
        </div>
      </div>

      {/* Contact pair — mobile stacked */}
      <div className="mt-3 grid gap-3 md:hidden">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d2823]">
            {leftDisplayName}
          </p>
          <p className="truncate text-[12px] text-[#8b938c]">
            {suggestion.leftContact.email ?? suggestion.leftContact.phone ?? ""}
          </p>
          {suggestion.quickMergePreview.survivorSide === "left" ? <BaseContactPill /> : null}
        </div>
        <div className="h-px bg-[#f2f4f0]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[#1d2823]">
            {rightDisplayName}
          </p>
          <p className="truncate text-[12px] text-[#8b938c]">
            {suggestion.rightContact.email ?? suggestion.rightContact.phone ?? ""}
          </p>
          {suggestion.quickMergePreview.survivorSide === "right" ? <BaseContactPill /> : null}
        </div>
      </div>

      <p className="mt-3 text-[12px] text-[#5c655e]">
        Quick merge keeps the older contact as the base record.
      </p>

      {/* Signal chips */}
      <SignalChips signals={suggestion.displaySignals} />

      {/* Lite always-visible diff (only fields that differ) */}
      <LiteComparison a={suggestion.leftContact} b={suggestion.rightContact} suggestion={suggestion} />

      {/* Full comparison expand */}
      <div className="mt-3 border-t border-[#edf0ea] pt-3">
        <button
          className="flex items-center gap-1 text-[12.5px] font-semibold text-[#4158f4] hover:underline"
          onClick={() => setExpanded((e) => !e)}
          type="button"
        >
          Compare all fields {expanded ? "↑" : "↓"}
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

// ── Identity grouping ─────────────────────────────────────────────────────────
// When multiple pairs share the same contact details on both sides (e.g. 4
// copies of the same person → 6 pair suggestions), collapse them into one card.

function identityKey(s: PersistedMergeSuggestion): string {
  const fp = (c: SuggestionContact) =>
    `${getContactDisplayName(c, "").toLowerCase().trim()}|${(c.email ?? "").toLowerCase().trim()}|${(c.phone ?? "").toLowerCase().trim()}`;
  const [a, b] = [fp(s.leftContact), fp(s.rightContact)].sort();
  return `${a}::${b}`;
}

// ── Group card (N identical pairs) ───────────────────────────────────────────

function MergeSuggestionGroup({
  group,
  onAllDismissed,
}: {
  group: PersistedMergeSuggestion[];
  onAllDismissed: () => void;
}) {
  const router = useRouter();
  const rep = group[0]!;
  const count = group.length;
  const [merging, setMerging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [done, setDone] = useState(0);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const handleMergeAll = () => {
    setMerging(true);
    setDone(0);
    startTransition(async () => {
      try {
        for (const s of group) {
          await quickMergeSuggestion(s.id);
          setDone((n) => n + 1);
        }
        router.refresh();
        onAllDismissed();
      } catch (e) {
        setError(toMergeError(e));
        setMerging(false);
      }
    });
  };

  const handleDismissAll = async () => {
    setDismissing(true);
    try {
      await Promise.all(
        group.map((s) =>
          Promise.all([
            fetch("/api/merge-suggestions/dismiss", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ suggestionId: s.id }),
            }),
            dismissMergeSuggestion(s.leftContact.id, s.rightContact.id),
          ]),
        ),
      );
      onAllDismissed();
    } catch {
      setError("Couldn't dismiss — try again");
      setDismissing(false);
    }
  };

  const busy = merging || dismissing;
  const contact = rep.leftContact;
  const contactDisplayName = getContactDisplayName(contact, "—");

  return (
    <article className="rounded-[14px] border border-[#d8ddd6] bg-white p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ConfidencePill confidence={rep.confidence} />
          <span className="inline-flex h-[22px] items-center rounded-[6px] bg-[#eef1fd] px-2 text-[11.5px] font-bold text-[#4158f4]">
            {count} identical pairs
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#17352e] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#20443b] disabled:opacity-50"
            disabled={busy}
            onClick={handleMergeAll}
            type="button"
          >
            {merging ? (
              <>
                <span className="h-[12px] w-[12px] animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
                {done}/{count}…
              </>
            ) : (
              <>
                <WorkspaceIcon name="merge" size={13} strokeWidth={2} />
                Merge all {count}
              </>
            )}
          </button>
          <Link
            className="inline-flex items-center gap-1 rounded-[9px] border border-[#d8ddd6] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            href={`/merge-suggestions/${rep.id}`}
          >
            Review →
          </Link>
          <button
            className="rounded-[9px] px-3 py-1.5 text-[13px] font-semibold text-[#b5472f] transition hover:bg-[#fdf3f1] disabled:opacity-50"
            disabled={busy}
            onClick={handleDismissAll}
            type="button"
          >
            {dismissing ? "Dismissing…" : "Not duplicates"}
          </button>
        </div>
      </div>

      {/* Identity */}
      <div className="mt-3">
        <p className="text-[14px] font-semibold text-[#1d2823]">{contactDisplayName}</p>
        <p className="text-[12px] text-[#8b938c]">{contact.email ?? contact.phone ?? ""}</p>
        <p className="mt-1 text-[12px] text-[#aeb4ac]">
          {count + 1} copies detected · merging will collapse them into one contact
        </p>
      </div>

      {/* Signal chips from representative pair */}
      <SignalChips signals={rep.displaySignals} />

      {error ? <p className="mt-2 text-[12px] text-[#b5472f]">{error}</p> : null}
    </article>
  );
}

// ── Cluster card (N distinct records of one contact) ─────────────────────────
// Connected suggestions whose records *differ* (typo'd name, empty name,
// phone-as-name…) still describe one real-world contact. Rather than showing
// each pair as an unrelated decision, collapse the component into one card:
// pick the record to keep, fold the rest into it.

function clusterMembers(group: PersistedMergeSuggestion[]): SuggestionContact[] {
  const byId = new Map<string, SuggestionContact>();
  for (const s of group) {
    byId.set(s.leftContact.id, s.leftContact);
    byId.set(s.rightContact.id, s.rightContact);
  }
  return Array.from(byId.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

function MergeSuggestionCluster({
  group,
  onAllDismissed,
  onSuggestionDismissed,
}: {
  group: PersistedMergeSuggestion[];
  onAllDismissed: () => void;
  onSuggestionDismissed: (id: string) => void;
}) {
  const router = useRouter();
  const members = clusterMembers(group);
  const [survivorId, setSurvivorId] = useState(members[0]!.id);
  const [merging, setMerging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  const survivor = members.find((m) => m.id === survivorId) ?? members[0]!;
  const best = group.reduce((a, b) => (b.score > a.score ? b : a), group[0]!);
  const survivorName = getContactDisplayName(survivor, "the selected record");

  const handleMergeCluster = () => {
    setMerging(true);
    setError("");
    startTransition(async () => {
      try {
        const result = await mergeClusterContacts(
          survivor.id,
          members.filter((m) => m.id !== survivor.id).map((m) => m.id),
        );
        router.refresh();
        if (result.failed > 0) {
          setError(
            `${result.failed} record${result.failed === 1 ? "" : "s"} couldn't be merged — rescan and try again.`,
          );
          setMerging(false);
        } else {
          onAllDismissed();
        }
      } catch (e) {
        setError(toMergeError(e));
        setMerging(false);
      }
    });
  };

  const handleDismissAll = async () => {
    setDismissing(true);
    try {
      await Promise.all(
        group.map((s) =>
          Promise.all([
            fetch("/api/merge-suggestions/dismiss", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ suggestionId: s.id }),
            }),
            dismissMergeSuggestion(s.leftContact.id, s.rightContact.id),
          ]),
        ),
      );
      onAllDismissed();
    } catch {
      setError("Couldn't dismiss — try again");
      setDismissing(false);
    }
  };

  const busy = merging || dismissing;

  return (
    <article className="rounded-[14px] border border-[#d8ddd6] bg-white p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ConfidencePill confidence={best.confidence} />
          <span className="inline-flex h-[22px] items-center rounded-[6px] bg-[#eef1fd] px-2 text-[11.5px] font-bold text-[#4158f4]">
            {members.length} records · same contact
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <button
            className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#17352e] px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[#20443b] disabled:opacity-50"
            disabled={busy}
            onClick={handleMergeCluster}
            type="button"
          >
            {merging ? (
              <>
                <span className="h-[12px] w-[12px] animate-spin rounded-full border-[2px] border-white/40 border-t-white" />
                Merging…
              </>
            ) : (
              <>
                <WorkspaceIcon name="merge" size={13} strokeWidth={2} />
                Merge {members.length} into one
              </>
            )}
          </button>
          <button
            className="rounded-[9px] px-3 py-1.5 text-[13px] font-semibold text-[#b5472f] transition hover:bg-[#fdf3f1] disabled:opacity-50"
            disabled={busy}
            onClick={handleDismissAll}
            type="button"
          >
            {dismissing ? "Dismissing…" : "Not duplicates"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-[12.5px] text-[#5c655e]">
        These {members.length} records look like the same contact. Choose the one to keep —
        the others are folded into it, and every step can be undone for 30 days.
      </p>

      {/* Member picker */}
      <div className="mt-3 grid gap-1.5">
        {members.map((member, index) => {
          const selected = member.id === survivor.id;
          const detail = [member.email, member.phone, member.company]
            .filter(Boolean)
            .join(" · ");
          return (
            <label
              className="flex cursor-pointer items-center gap-3 rounded-[10px] border px-3 py-2 transition"
              key={member.id}
              style={{
                borderColor: selected ? "#17352e" : "#e3e7e1",
                background: selected ? "#f2f6f3" : "white",
              }}
            >
              <input
                checked={selected}
                className="accent-[#17352e]"
                disabled={busy}
                name={`cluster-survivor-${group[0]!.id}`}
                onChange={() => setSurvivorId(member.id)}
                type="radio"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold text-[#1d2823]">
                  {getContactDisplayName(member, "(no name)")}
                  {index === 0 ? (
                    <span className="ml-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8b938c]">
                      oldest
                    </span>
                  ) : null}
                </span>
                {detail ? (
                  <span className="block truncate text-[12px] text-[#8b938c]">{detail}</span>
                ) : null}
              </span>
              {selected ? (
                <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.05em] text-[#1f7a67]">
                  Keeps this
                </span>
              ) : null}
            </label>
          );
        })}
      </div>

      <p className="mt-2 text-[12px] text-[#aeb4ac]">
        Merging keeps {survivorName} and preserves emails, phones, and labels from the
        other {members.length - 1} record{members.length === 2 ? "" : "s"}.
      </p>

      {/* Individual pair review */}
      <div className="mt-3 border-t border-[#edf0ea] pt-2">
        <button
          className="text-[12.5px] font-semibold text-[#4158f4] hover:underline"
          onClick={() => setExpanded((v) => !v)}
          type="button"
        >
          {expanded ? "Hide individual pairs ↑" : `Review the ${group.length} pairs individually ↓`}
        </button>
        {expanded ? (
          <div className="mt-3 grid gap-3">
            {group.map((s) => (
              <MergeSuggestionCard
                key={s.id}
                onDismissed={() => onSuggestionDismissed(s.id)}
                suggestion={s}
              />
            ))}
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-2 text-[12px] text-[#b5472f]">{error}</p> : null}
    </article>
  );
}

// ── Wrapper with optimistic list ──────────────────────────────────────────────

const MERGE_SUGGESTION_RENDER_BATCH = 24;

export function MergeSuggestionList({
  suggestions,
  totalCount,
}: {
  suggestions: PersistedMergeSuggestion[];
  totalCount?: number;
}) {
  const [visible, setVisible] = useState(() => suggestions.map((s) => s.id));
  const [visibleGroupCount, setVisibleGroupCount] = useState(MERGE_SUGGESTION_RENDER_BATCH);

  const dismissIds = (ids: string[]) =>
    setVisible((v) => v.filter((x) => !ids.includes(x)));

  const shown = suggestions.filter((s) => visible.includes(s.id));

  if (shown.length === 0) {
    return (
      <div className="m-4 rounded-[1.6rem] border border-dashed border-[#d8ddd6] bg-white px-6 py-12 text-center text-sm text-slate-500">
        No duplicates to review. Kontax scans as you add and import contacts — you&apos;re all
        clear.
      </div>
    );
  }

  // Group connected suggestions — pairs sharing a contact form one cluster
  // (4 records of one contact → up to 6 pairwise suggestions → 1 card).
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while ((parent.get(root) ?? root) !== root) root = parent.get(root)!;
    let cursor = id;
    while (cursor !== root) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  for (const s of shown) {
    const [a, b] = [s.leftContact.id, s.rightContact.id];
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const [rootA, rootB] = [find(a), find(b)];
    if (rootA !== rootB) parent.set(rootB, rootA);
  }
  const groupMap = new Map<string, PersistedMergeSuggestion[]>();
  for (const s of shown) {
    const key = find(s.leftContact.id);
    const bucket = groupMap.get(key) ?? [];
    bucket.push(s);
    groupMap.set(key, bucket);
  }

  const renderItems = Array.from(groupMap.values());
  const visibleItems = renderItems.slice(0, visibleGroupCount);
  const canLoadMore = visibleGroupCount < renderItems.length;
  const hasMoreOnServer = (totalCount ?? suggestions.length) > suggestions.length;

  return (
    <div className="grid gap-3 p-4">
      {visibleItems.map((group) => {
        if (group.length === 1) {
          return (
            <MergeSuggestionCard
              key={group[0]!.id}
              suggestion={group[0]!}
              onDismissed={() => dismissIds([group[0]!.id])}
            />
          );
        }
        // All pairs visually identical (exact copies) → compact batch card;
        // otherwise the records differ and the user should pick a survivor.
        const firstKey = identityKey(group[0]!);
        if (group.every((s) => identityKey(s) === firstKey)) {
          return (
            <MergeSuggestionGroup
              key={group.map((s) => s.id).join(",")}
              group={group}
              onAllDismissed={() => dismissIds(group.map((s) => s.id))}
            />
          );
        }
        return (
          <MergeSuggestionCluster
            key={group.map((s) => s.id).join(",")}
            group={group}
            onAllDismissed={() => dismissIds(group.map((s) => s.id))}
            onSuggestionDismissed={(id) => dismissIds([id])}
          />
        );
      })}
      {canLoadMore ? (
        <div className="flex justify-center pt-1">
          <button
            className="inline-flex h-10 items-center rounded-[10px] border border-[#d8ddd6] bg-white px-4 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            onClick={() =>
              setVisibleGroupCount((count) => count + MERGE_SUGGESTION_RENDER_BATCH)
            }
            type="button"
          >
            Load more duplicates
          </button>
        </div>
      ) : null}
      {hasMoreOnServer && !canLoadMore ? (
        <div className="rounded-[1rem] border border-dashed border-[#d8ddd6] bg-[#f9faf8] px-4 py-3 text-center text-[12.5px] text-[#5c655e]">
          Showing the first {suggestions.length} highest-priority suggestions. Use Rescan to refresh the queue.
        </div>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { dismissMergeSuggestion, quickMergeSuggestion } from "~/app/actions/merge";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import { arePhoneValuesEquivalent, getPhoneValueContext } from "~/lib/phone-normalization";
import type {
  PersistedMergeSuggestion,
  SuggestionContact,
} from "~/server/contact-merge";

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
      Base contact kept
    </span>
  );
}

function KeptPill({ tone }: { tone: "kept" | "same" | "combined" }) {
  const style =
    tone === "kept"
      ? "bg-[#eef5ef] text-[#17352e]"
      : tone === "combined"
        ? "bg-[#edf3ff] text-[#2f4fc7]"
      : "bg-[#f2f4f0] text-[#5c655e]";
  return (
    <span className={`inline-flex h-[18px] items-center rounded-[999px] px-1.5 text-[10px] font-semibold ${style}`}>
      {tone === "kept" ? "Kept" : tone === "combined" ? "Both kept" : "Same"}
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
  const diffs = LITE_FIELDS.filter(({ key }) => {
    const av = a[key] as string | null;
    const bv = b[key] as string | null;
    if (!(av || bv)) return false;
    if (key === "phone") {
      return !arePhoneValuesEquivalent(av, bv);
    }
    return av !== bv;
  });

  if (diffs.length === 0) return null;

  return (
    <div className="mt-3 rounded-[10px] border border-[#edf0ea] bg-[#f9faf8] px-3 py-2.5 grid gap-2">
      {diffs.map(({ key, label }) => {
        const rawA = a[key] as string | null;
        const rawB = b[key] as string | null;
        const av = truncate(rawA, 60);
        const bv = truncate(rawB, 60);
        const phoneMetaA =
          key === "phone" ? getPhoneValueContext(rawA, { peerValue: rawB }) : null;
        const phoneMetaB =
          key === "phone" ? getPhoneValueContext(rawB, { peerValue: rawA }) : null;
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
        const leftMatches =
          !preservesBothValues &&
          normalizeCompare(rawA) !== "" &&
          normalizeCompare(rawA) === normalizeCompare(mergedText);
        const rightMatches =
          !preservesBothValues &&
          normalizeCompare(rawB) !== "" &&
          normalizeCompare(rawB) === normalizeCompare(mergedText);
        const leftTone = preservesBothValues ? "combined" : leftMatches ? (rightMatches ? "same" : "kept") : null;
        const rightTone = preservesBothValues ? "combined" : rightMatches ? (leftMatches ? "same" : "kept") : null;
        return (
          <div key={key} className="grid grid-cols-[52px_1fr_1fr] gap-2 items-baseline">
            <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-[#aeb4ac]">
              {label}
            </span>
            <span
              className={`flex min-w-0 flex-col gap-0.5 ${leftTone === "kept" ? "text-[#1d2823]" : "text-[#5c655e]"}`}
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px]">
                <span className="truncate">{av ?? <span className="text-[#c2c8bf]">—</span>}</span>
                {leftTone ? <KeptPill tone={leftTone} /> : null}
              </span>
              {phoneMetaA?.summary ? (
                <span className="truncate text-[11px] text-[#8a9189]">{phoneMetaA.summary}</span>
              ) : null}
            </span>
            <span
              className={`flex min-w-0 flex-col gap-0.5 ${rightTone === "kept" ? "text-[#1d2823]" : "text-[#5c655e]"}`}
            >
              <span className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px]">
                <span className="truncate">{bv ?? <span className="text-[#c2c8bf]">—</span>}</span>
                {rightTone ? <KeptPill tone={rightTone} /> : null}
              </span>
              {phoneMetaB?.summary ? (
                <span className="truncate text-[11px] text-[#8a9189]">{phoneMetaB.summary}</span>
              ) : null}
            </span>
          </div>
        );
      })}
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
        setError(e instanceof Error ? e.message : "Merge failed — try again");
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
        Quick merge keeps the older contact as the base record and applies the default field choices below.
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
        setError(e instanceof Error ? e.message : "Merge failed — try again");
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

// ── Wrapper with optimistic list ──────────────────────────────────────────────

export function MergeSuggestionList({
  suggestions,
}: {
  suggestions: PersistedMergeSuggestion[];
}) {
  const [visible, setVisible] = useState(() => suggestions.map((s) => s.id));

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

  // Group identical pairs — same contact details on both sides
  const groupMap = new Map<string, PersistedMergeSuggestion[]>();
  for (const s of shown) {
    const key = identityKey(s);
    const bucket = groupMap.get(key) ?? [];
    bucket.push(s);
    groupMap.set(key, bucket);
  }

  const renderItems = Array.from(groupMap.values());

  return (
    <div className="grid gap-3 p-4">
      {renderItems.map((group) =>
        group.length === 1 ? (
          <MergeSuggestionCard
            key={group[0]!.id}
            suggestion={group[0]!}
            onDismissed={() => dismissIds([group[0]!.id])}
          />
        ) : (
          <MergeSuggestionGroup
            key={group.map((s) => s.id).join(",")}
            group={group}
            onAllDismissed={() => dismissIds(group.map((s) => s.id))}
          />
        ),
      )}
    </div>
  );
}

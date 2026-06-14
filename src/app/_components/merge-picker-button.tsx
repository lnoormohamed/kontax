"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { createManualMergeSuggestion } from "~/app/actions/merge";
import type { SearchResult } from "~/app/api/contacts/search/route";

type ContactSnap = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  notes: string | null;
  address: string | null;
  birthday: string | null;
};

// ── Monogram avatar ───────────────────────────────────────────────────────────

const TINTS = [
  { bg: "#d6e7dc", color: "#17352e" },
  { bg: "#d6dffb", color: "#2036a4" },
  { bg: "#fbe9d6", color: "#8c5010" },
  { bg: "#f0d6fb", color: "#6b1a9c" },
  { bg: "#f0f0d6", color: "#6b6b10" },
];
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
function tint(name: string) {
  return TINTS[hash(name) % TINTS.length]!;
}
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const t = tint(name);
  return (
    <span
      style={{
        display: "grid",
        placeItems: "center",
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: "50%",
        background: t.bg,
        color: t.color,
        fontSize: size * 0.36,
        fontWeight: 700,
        letterSpacing: "-0.01em",
      }}
    >
      {initials(name)}
    </span>
  );
}

// ── Comparison table (read-only) ──────────────────────────────────────────────

const FIELDS: { key: keyof ContactSnap; label: string }[] = [
  { key: "fullName", label: "Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "jobTitle", label: "Title" },
  { key: "address", label: "Address" },
  { key: "birthday", label: "Birthday" },
  { key: "notes", label: "Notes" },
];

function truncate(s: string | null, max: number) {
  if (!s) return null;
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function ReadOnlyTable({ a, b }: { a: ContactSnap; b: ContactSnap }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]">
        <thead>
          <tr className="border-b border-[#edf0ea]">
            <th className="w-[70px] py-1.5 pr-3 text-left text-[12px] font-semibold text-[#8b938c]">Field</th>
            <th className="py-1.5 pr-3 text-left">
              <div className="text-[12px] font-semibold text-[#8b938c] truncate max-w-[160px]">{a.fullName ?? "Contact A"}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#aeb4ac]">Contact A</div>
            </th>
            <th className="py-1.5 text-left">
              <div className="text-[12px] font-semibold text-[#8b938c] truncate max-w-[160px]">{b.fullName ?? "Contact B"}</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#aeb4ac]">Contact B</div>
            </th>
          </tr>
        </thead>
        <tbody>
          {FIELDS.map(({ key, label }) => {
            const aVal = a[key];
            const bVal = b[key];
            if (!aVal && !bVal) return null;
            const differs = aVal !== bVal;
            return (
              <tr
                key={key}
                className="border-b border-[#f2f4f0] last:border-b-0"
                style={{ background: differs ? "#fff0bf" : "transparent" }}
              >
                <td className="py-1.5 pr-3 font-medium text-[#8b938c]">{label}</td>
                <td className="py-1.5 pr-3" style={{ color: differs ? "#1d2823" : "#8b938c" }}>
                  {truncate(aVal, 60) ?? "—"}
                </td>
                <td className="py-1.5" style={{ color: differs ? "#1d2823" : "#8b938c" }}>
                  {truncate(bVal, 60) ?? "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Picker modal / sheet ──────────────────────────────────────────────────────

type Step = "search" | "confirm";

function MergePickerOverlay({
  currentContact,
  onClose,
}: {
  currentContact: ContactSnap;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<ContactSnap | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const doSearch = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(query)}&limit=10`);
        if (res.ok) {
          const data = (await res.json()) as SearchResult[];
          setResults(data.filter((r) => r.id !== currentContact.id));
        }
      } finally {
        setLoading(false);
      }
    };
    const timer = setTimeout(() => { void doSearch(); }, 200);
    return () => clearTimeout(timer);
  }, [query, currentContact.id]);

  const handleSelect = async (result: SearchResult) => {
    // Fetch the full contact fields for the comparison table
    const snap: ContactSnap = {
      id: result.id,
      fullName: result.name,
      email: result.email,
      phone: result.phone,
      company: result.company,
      jobTitle: null,
      notes: null,
      address: null,
      birthday: null,
    };
    setSelected(snap);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      const id = await createManualMergeSuggestion(currentContact.id, selected.id);
      router.push(`/merge-suggestions/${id}`);
    } catch {
      setError("Something went wrong — try again");
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Modal (desktop) / Sheet (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:inset-0 md:flex md:items-center md:justify-center md:p-6">
        <div className="w-full rounded-t-[20px] bg-white shadow-[0_24px_70px_rgba(20,30,25,0.28)] md:max-w-[540px] md:rounded-[16px]">
          {step === "search" ? (
            <>
              {/* Header */}
              <div className="relative px-5 pt-5">
                <button
                  className="absolute right-4 top-4 p-1 text-[#5c655e] hover:text-[#1d2823]"
                  onClick={onClose}
                  type="button"
                  aria-label="Close"
                >
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
                <h3 className="text-[17px] font-semibold text-[#1d2823]">Merge with another contact</h3>
              </div>

              {/* Search input */}
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-2 rounded-[10px] border border-[#d8ddd6] bg-white px-3 py-2.5">
                  <svg width={17} height={17} viewBox="0 0 24 24" fill="none" stroke="#8b938c" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3" />
                  </svg>
                  <input
                    ref={inputRef}
                    className="flex-1 bg-transparent text-[14px] text-[#1d2823] placeholder:text-[#8b938c] outline-none"
                    placeholder="Search contacts…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              {/* Results */}
              <div className="max-h-[280px] overflow-y-auto">
                {loading ? (
                  <p className="px-5 py-4 text-[13px] text-[#8b938c]">Searching…</p>
                ) : results.length === 0 && query.trim() ? (
                  <p className="px-5 py-4 text-[13px] text-[#8b938c]">No contacts found</p>
                ) : (
                  results.map((r, i) => (
                    <button
                      key={r.id}
                      className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-[#f6f7f4] transition"
                      style={{ borderBottom: i < results.length - 1 ? "1px solid #f2f4f0" : "none" }}
                      onClick={() => handleSelect(r)}
                      type="button"
                    >
                      <Avatar name={r.name} size={36} />
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-semibold text-[#1d2823]">{r.name}</p>
                        <p className="truncate text-[12px] text-[#8b938c]">
                          {r.email ?? r.phone ?? r.company ?? ""}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>

              <p className="px-5 py-3 text-[11px] text-[#8b938c] border-t border-[#f2f4f0]">
                Search your contacts — current contact excluded.
              </p>
            </>
          ) : (
            <>
              {/* Confirm step */}
              <div className="px-5 pt-5">
                <button
                  className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#5c655e] hover:text-[#1d2823]"
                  onClick={() => { setStep("search"); setSelected(null); }}
                  type="button"
                >
                  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                  Change contact
                </button>
                <h3 className="text-[17px] font-semibold text-[#1d2823]">Merge these two contacts?</h3>
                <p className="mt-1 text-[13px] text-[#5c655e]">You&apos;ll choose which fields to keep on the next page.</p>
              </div>

              <div className="border-t border-[#edf0ea] mx-5 mt-4" />
              <div className="px-5 pb-2 overflow-y-auto max-h-[320px]">
                <ReadOnlyTable a={currentContact} b={selected!} />
              </div>

              {error ? <p className="px-5 text-[12px] text-[#b5472f]">{error}</p> : null}

              <div className="flex justify-end gap-2.5 px-5 py-4 border-t border-[#f2f4f0]">
                <button
                  className="rounded-[9px] border border-[#d8ddd6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1d2823] hover:bg-[#f6f7f4] transition"
                  onClick={onClose}
                  type="button"
                >
                  Cancel
                </button>
                <button
                  className="inline-flex items-center gap-1.5 rounded-[9px] bg-[#17352e] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#0f2620] transition disabled:opacity-50"
                  disabled={submitting}
                  onClick={handleConfirm}
                  type="button"
                >
                  {submitting ? "Loading…" : "Compare & merge →"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Entry point button ────────────────────────────────────────────────────────

export function MergeWithButton({ contact }: { contact: ContactSnap }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className="flex w-full items-center gap-2 rounded-[0.7rem] px-3 py-2 text-left text-sm font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#5c655e" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 4v6a5 5 0 005 5h5" />
          <path d="M17 4v6" />
          <path d="M14 12l3 3-3 3" />
          <path d="M7 4l-2 2M7 4l2 2" />
        </svg>
        Merge with another contact
      </button>
      {open && (
        <MergePickerOverlay currentContact={contact} onClose={() => setOpen(false)} />
      )}
    </>
  );
}

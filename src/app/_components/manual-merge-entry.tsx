"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type ManualMergeOption = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  bookName: string | null;
};

type ManualMergeEntryProps = {
  contacts: ManualMergeOption[];
  leftId: string;
  rightId: string;
};

const COLORS = {
  ink: "#1d2823",
  ink2: "#5c655e",
  mute: "#8b938c",
  line: "#d8ddd6",
  line2: "#e9ece7",
  wash: "#f2f4f0",
  green: "#17352e",
  greenTint: "#e7efe9",
  blue: "#4158f4",
  amber: "#bf8526",
  amberTint: "rgba(191,133,38,0.08)",
} as const;

function buildMeta(contact: ManualMergeOption) {
  return contact.email ?? contact.phone ?? contact.company ?? contact.bookName ?? "No contact details yet";
}

function filterContacts(contacts: ManualMergeOption[], query: string, excludeId: string | null) {
  const trimmed = query.trim().toLowerCase();
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  const pool = excludeId ? contacts.filter((contact) => contact.id !== excludeId) : contacts;
  if (tokens.length === 0) {
    return pool.slice(0, 8);
  }
  return pool
    .filter((contact) => {
      const haystack = [
        contact.fullName,
        contact.email ?? "",
        contact.phone ?? "",
        contact.company ?? "",
        contact.bookName ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    })
    .slice(0, 10);
}

function PickerField({
  label,
  name,
  contacts,
  selectedId,
  otherSelectedId,
  onSelect,
}: {
  label: string;
  name: string;
  contacts: ManualMergeOption[];
  selectedId: string;
  otherSelectedId: string;
  onSelect: (nextId: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedContact = contacts.find((contact) => contact.id === selectedId) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setQuery("");
  }, [selectedContact?.id]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const results = useMemo(
    () => filterContacts(contacts, query, otherSelectedId || null),
    [contacts, otherSelectedId, query],
  );
  const sameAsOther = Boolean(selectedId && otherSelectedId && selectedId === otherSelectedId);

  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-semibold" style={{ color: COLORS.ink }}>
        {label}
      </span>
      <div className="relative" ref={rootRef}>
        <input name={name} type="hidden" value={selectedId} />
        <div
          className="rounded-[14px] border bg-white px-3 py-3 shadow-[0_1px_2px_rgba(20,30,25,0.03)] transition"
          style={{
            borderColor: open ? COLORS.blue : sameAsOther ? "#ecdcb6" : selectedContact ? COLORS.green : COLORS.line,
            boxShadow: open ? "0 0 0 3px rgba(65,88,244,0.14)" : selectedContact ? "0 0 0 3px rgba(23,53,46,0.06)" : undefined,
          }}
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden
              className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
              style={{
                background: selectedContact ? COLORS.greenTint : COLORS.wash,
                color: selectedContact ? COLORS.green : COLORS.mute,
              }}
            >
              {selectedContact
                ? selectedContact.fullName
                    .split(/\s+/)
                    .map((part) => part[0] ?? "")
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : label.slice(-1)}
            </span>
            <div className="min-w-0 flex-1">
              {selectedContact ? (
                <div className="mb-2 rounded-[10px] border px-2.5 py-2" style={{ borderColor: COLORS.line2, background: "#fbfcf9" }}>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-semibold" style={{ color: COLORS.ink }}>
                        {selectedContact.fullName}
                      </p>
                      <p className="truncate text-[12px]" style={{ color: COLORS.ink2 }}>
                        {buildMeta(selectedContact)}
                      </p>
                    </div>
                    <button
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold transition hover:bg-[#edf0fe]"
                      onClick={(event) => {
                        event.preventDefault();
                        onSelect("");
                        setQuery("");
                        setOpen(true);
                        requestAnimationFrame(() => inputRef.current?.focus());
                      }}
                      style={{ color: COLORS.blue }}
                      type="button"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center gap-2 rounded-[10px] border px-2.5 py-2" style={{ borderColor: COLORS.line2, background: "#fff" }}>
                <svg fill="none" height="16" stroke={COLORS.mute} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
                  <path d="M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3" />
                </svg>
                <input
                  aria-expanded={open}
                  aria-label={`${label} search`}
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-[#8b938c]"
                  onChange={(event) => {
                    if (selectedContact && event.target.value !== selectedContact.fullName) {
                      onSelect("");
                    }
                    setQuery(event.target.value);
                    setOpen(true);
                  }}
                  onFocus={() => setOpen(true)}
                  placeholder={selectedContact ? "Change selection…" : "Search by name, email, phone, company"}
                  ref={inputRef}
                  type="text"
                  value={query}
                />
                <button
                  aria-label={open ? "Close search results" : "Open search results"}
                  className="shrink-0 rounded-md p-1 transition hover:bg-[#f2f4f0]"
                  onClick={(event) => {
                    event.preventDefault();
                    setOpen((current) => !current);
                    if (!open) {
                      requestAnimationFrame(() => inputRef.current?.focus());
                    }
                  }}
                  type="button"
                >
                  <svg fill="none" height="14" stroke={COLORS.mute} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="14">
                    <path d={open ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {open ? (
          <div
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 overflow-hidden rounded-[14px] border bg-white shadow-[0_18px_48px_rgba(20,30,25,0.14)]"
            style={{ borderColor: COLORS.line }}
          >
            <div className="max-h-[280px] overflow-y-auto py-1">
              {results.length === 0 ? (
                <div className="px-3 py-3 text-[12.5px]" style={{ color: COLORS.mute }}>
                  No contacts match this search.
                </div>
              ) : (
                results.map((contact) => {
                  const isSelected = selectedId === contact.id;
                  return (
                    <button
                      className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-[#f6f7f4]"
                      key={contact.id}
                      onClick={(event) => {
                        event.preventDefault();
                        onSelect(contact.id);
                        setQuery("");
                        setOpen(false);
                      }}
                      style={{ background: isSelected ? "#eef5ef" : "transparent" }}
                      type="button"
                    >
                      <span
                        aria-hidden
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold"
                        style={{ background: isSelected ? COLORS.greenTint : COLORS.wash, color: isSelected ? COLORS.green : COLORS.ink2 }}
                      >
                        {contact.fullName
                          .split(/\s+/)
                          .map((part) => part[0] ?? "")
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold" style={{ color: COLORS.ink }}>
                          {contact.fullName}
                        </span>
                        <span className="block truncate text-[12px]" style={{ color: COLORS.ink2 }}>
                          {buildMeta(contact)}
                        </span>
                      </span>
                      {isSelected ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]" style={{ background: COLORS.greenTint, color: COLORS.green }}>
                          Selected
                        </span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>
    </label>
  );
}

export function ManualMergeEntry({ contacts, leftId, rightId }: ManualMergeEntryProps) {
  const [leftSelection, setLeftSelection] = useState(leftId);
  const [rightSelection, setRightSelection] = useState(rightId);

  const validPair =
    leftSelection.length > 0 &&
    rightSelection.length > 0 &&
    leftSelection !== rightSelection;

  return (
    <form
      className="mt-5 grid gap-4"
      method="get"
      style={{ alignItems: "end" }}
    >
      <div className="grid gap-4 md:[grid-template-columns:minmax(0,1fr)_auto_minmax(0,1fr)] md:items-end">
        <PickerField
          contacts={contacts}
          label="Contact A"
          name="left"
          onSelect={setLeftSelection}
          otherSelectedId={rightSelection}
          selectedId={leftSelection}
        />

        <span
          aria-hidden
          className="mx-auto grid h-9 w-9 place-items-center rounded-full md:mb-7"
          style={{ background: COLORS.wash }}
        >
          <svg fill="none" height="16" stroke={COLORS.mute} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
            <path d="M7 4v6a5 5 0 005 5h5" />
            <path d="M17 4v6" />
            <path d="M14 12l3 3-3 3" />
            <path d="M7 4l-2 2" />
            <path d="M7 4l2 2" />
          </svg>
        </span>

        <PickerField
          contacts={contacts}
          label="Contact B"
          name="right"
          onSelect={setRightSelection}
          otherSelectedId={leftSelection}
          selectedId={rightSelection}
        />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[11px] px-5 text-[14px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-55"
          disabled={!validPair}
          style={{ background: COLORS.blue }}
          type="submit"
        >
          <svg fill="none" height="16" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
            <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
            <rect height="4" rx="1" width="6" x="9" y="3" />
            <path d="M9 12h6M9 16h4" />
          </svg>
          Load merge preview
        </button>
        <span className="text-[12.5px]" style={{ color: COLORS.ink2 }}>
          {validPair
            ? "Preview stays server-driven — nothing changes until you review the merge."
            : "Pick two different active contacts to load the merge review."}
        </span>
      </div>

      {leftSelection && rightSelection && leftSelection === rightSelection ? (
        <div
          className="rounded-[10px] border px-3.5 py-2.5 text-[13px]"
          style={{
            borderColor: "#ecdcb6",
            background: COLORS.amberTint,
            color: "#7a5512",
          }}
        >
          Choose two different active contacts to review a merge.
        </div>
      ) : null}
    </form>
  );
}

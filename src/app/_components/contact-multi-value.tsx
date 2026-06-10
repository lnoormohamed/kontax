"use client";

import { useState } from "react";

import { updateContactEntries } from "~/app/actions/contacts";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

// Multi-value contact fields (emails / phones / websites / dates / related) and
// structured addresses. Mirrors the locked design's MultiValueGroup + LabelPill
// + AddressBlock. Each group owns its array state and persists the whole array
// via updateContactEntries on every value commit, label change, or removal.

export type SimpleEntry = { label: string; value: string };
export type AddressEntry = {
  label: string;
  street: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
};

export type EntryGroupKey = "emails" | "phones" | "websites" | "dates" | "related";

export const LABEL_OPTIONS: Record<string, string[]> = {
  emails: ["Work", "Personal", "Home", "Other"],
  phones: ["Mobile", "Work", "Home", "Main", "Other"],
  websites: ["Portfolio", "Company", "Blog", "Other"],
  addresses: ["Home", "Work", "Other"],
  related: ["Spouse", "Partner", "Child", "Parent", "Sibling", "Assistant", "Other"],
  dates: ["Anniversary", "Other"],
};

const formatDateDisplay = (value: string): string => {
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value.trim());
  if (!full) return value;
  const [, year, month, day] = full;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
};

// ── Label pill with dropdown picker ─────────────────────────────────────────
function LabelPill({
  label,
  options,
  onPick,
  readOnly,
}: {
  label: string;
  options: string[];
  onPick: (label: string) => void;
  readOnly: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative shrink-0">
      <button
        className="min-w-[54px] rounded-[5px] bg-[#f2f4f0] px-2 py-0.5 text-left text-[11px] font-semibold text-[#5c655e]"
        onClick={(e) => {
          e.stopPropagation();
          if (!readOnly) setOpen((o) => !o);
        }}
        type="button"
      >
        {label}
      </button>
      {open ? (
        <>
          <span className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute left-0 top-[26px] z-40 w-[130px] rounded-[10px] border border-[#d8ddd6] bg-white p-1 shadow-[0_12px_30px_rgba(20,30,25,0.14)]">
            {options.map((opt) => (
              <button
                className={`block w-full rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-[#1d2823] ${
                  opt === label ? "bg-[#f2f4f0]" : "hover:bg-[#f6f7f4]"
                }`}
                key={opt}
                onClick={(e) => {
                  e.stopPropagation();
                  onPick(opt);
                  setOpen(false);
                }}
                type="button"
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </span>
  );
}

function AddLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="ml-[11px] mt-1 inline-flex items-center gap-1.5 rounded-[6px] px-1 py-1 text-[13px] font-medium text-[#4158f4] hover:bg-[#4158f4]/[0.06]"
      onClick={onClick}
      type="button"
    >
      <WorkspaceIcon name="plus" size={14} strokeWidth={2} />
      {label}
    </button>
  );
}

// ── Single editable value row (email / phone / website / date / related) ─────
function MultiRow({
  item,
  type,
  inputType,
  labelOptions,
  editable,
  onChangeLabel,
  onCommitValue,
  onRemove,
}: {
  item: SimpleEntry;
  type: EntryGroupKey;
  inputType: string;
  labelOptions: string[];
  editable: boolean;
  onChangeLabel: (label: string) => void;
  onCommitValue: (value: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(item.value.trim().length === 0 && editable);
  const [draft, setDraft] = useState(item.value);
  const [hover, setHover] = useState(false);

  const has = item.value.trim().length > 0;
  const display = type === "dates" && has ? formatDateDisplay(item.value) : item.value;

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== item.value.trim()) {
      onCommitValue(draft.trim());
    }
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-r-[6px] border-l-2 py-2 pl-[11px] pr-2.5 transition-colors ${
        editing ? "border-[#4158f4] bg-[#4158f4]/[0.05]" : "border-transparent"
      } ${editable && !editing ? "cursor-text" : ""}`}
      onClick={() => {
        if (editable && !editing) {
          setDraft(item.value);
          setEditing(true);
        }
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <LabelPill label={item.label} onPick={onChangeLabel} options={labelOptions} readOnly={!editable} />
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            className="w-full border-none bg-transparent p-0 text-sm leading-[1.45] text-[#1d2823] outline-none"
            onBlur={commit}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                setDraft(item.value);
                setEditing(false);
              }
            }}
            type={inputType}
            value={draft}
          />
        ) : (
          <span
            className={`block break-words text-sm leading-[1.45] ${
              has ? "text-[#1d2823]" : "italic text-[#b9c0b8]"
            }`}
          >
            {has ? display : "Empty — click to add"}
          </span>
        )}
      </div>
      {editable ? (
        <button
          aria-label="Remove"
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[#8b938c] transition-opacity hover:bg-[#f2f4f0] ${
            hover && !editing ? "opacity-100" : "opacity-0"
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          title="Remove"
          type="button"
        >
          <WorkspaceIcon name="x" size={14} strokeWidth={1.8} />
        </button>
      ) : null}
    </div>
  );
}

export function MultiValueGroup({
  contactId,
  group,
  initial,
  defaultLabel,
  addText,
  inputType = "text",
  editable,
}: {
  contactId: string;
  group: EntryGroupKey;
  initial: SimpleEntry[];
  defaultLabel: string;
  addText: string;
  inputType?: string;
  editable: boolean;
}) {
  const [items, setItems] = useState<SimpleEntry[]>(initial);

  const persist = (next: SimpleEntry[]) => {
    void updateContactEntries(contactId, group, next).catch(() => {
      /* surfaced via revalidation; keep optimistic state */
    });
  };

  const setValueAt = (index: number, value: string) => {
    setItems((prev) => {
      const next = prev.map((it, i) => (i === index ? { ...it, value } : it));
      persist(next);
      return next;
    });
  };
  const setLabelAt = (index: number, label: string) => {
    setItems((prev) => {
      const next = prev.map((it, i) => (i === index ? { ...it, label } : it));
      if (next[index]?.value.trim()) persist(next);
      return next;
    });
  };
  const removeAt = (index: number) => {
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      persist(next);
      return next;
    });
  };
  const add = () => setItems((prev) => [...prev, { label: defaultLabel, value: "" }]);

  return (
    <div>
      {items.length === 0 ? (
        <div className="px-3 py-2 text-[13px] italic text-[#b9c0b8]">Not added</div>
      ) : (
        items.map((item, index) => (
          <MultiRow
            editable={editable}
            inputType={inputType}
            item={item}
            key={index}
            labelOptions={LABEL_OPTIONS[group] ?? ["Other"]}
            onChangeLabel={(label) => setLabelAt(index, label)}
            onCommitValue={(value) => setValueAt(index, value)}
            onRemove={() => removeAt(index)}
            type={group}
          />
        ))
      )}
      {editable ? <AddLink label={addText} onClick={add} /> : null}
    </div>
  );
}

// ── Structured address block ────────────────────────────────────────────────
function AddressBlock({
  item,
  editable,
  onSave,
  onChangeLabel,
  onRemove,
}: {
  item: AddressEntry;
  editable: boolean;
  onSave: (next: AddressEntry) => void;
  onChangeLabel: (label: string) => void;
  onRemove: () => void;
}) {
  const empty = !item.street && !item.city && !item.state && !item.postcode && !item.country;
  const [editing, setEditing] = useState(empty && editable);
  const [draft, setDraft] = useState(item);
  const [hover, setHover] = useState(false);

  const formatted = [
    item.street,
    [item.city, item.state].filter(Boolean).join(", "),
    item.postcode,
    item.country,
  ]
    .filter((p) => p?.trim())
    .join(", ");

  const field = (key: keyof AddressEntry, placeholder: string) => (
    <input
      className="w-full rounded-[8px] border border-[#d8ddd6] bg-white px-2.5 py-1.5 text-[13.5px] text-[#1d2823] outline-none focus:border-[#4158f4]"
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setDraft(item);
          setEditing(false);
        }
      }}
      placeholder={placeholder}
      value={draft[key]}
    />
  );

  return (
    <div
      className={`rounded-r-[6px] border-l-2 py-2 pl-[11px] pr-2.5 transition-colors ${
        editing ? "border-[#4158f4] bg-[#4158f4]/[0.05]" : "border-transparent"
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="flex items-center gap-3">
        <LabelPill
          label={item.label}
          onPick={onChangeLabel}
          options={LABEL_OPTIONS.addresses ?? ["Home"]}
          readOnly={!editable}
        />
        {!editing ? (
          <button
            className={`min-w-0 flex-1 break-words text-left text-sm leading-[1.45] ${
              formatted ? "text-[#1d2823]" : "italic text-[#b9c0b8]"
            } ${editable ? "cursor-text" : ""}`}
            onClick={() => {
              if (editable) {
                setDraft(item);
                setEditing(true);
              }
            }}
            type="button"
          >
            {formatted || "Empty — click to add"}
          </button>
        ) : (
          <span className="flex-1" />
        )}
        {editable ? (
          <button
            aria-label="Remove"
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-[6px] text-[#8b938c] transition-opacity hover:bg-[#f2f4f0] ${
              hover && !editing ? "opacity-100" : "opacity-0"
            }`}
            onClick={onRemove}
            title="Remove"
            type="button"
          >
            <WorkspaceIcon name="x" size={14} strokeWidth={1.8} />
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-2 grid gap-2">
          {field("street", "Street")}
          <div className="grid grid-cols-2 gap-2">
            {field("city", "City")}
            {field("state", "State / region")}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {field("postcode", "Postcode")}
            {field("country", "Country")}
          </div>
          <div className="flex items-center gap-2">
            <button
              className="rounded-[8px] bg-[#4158f4] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#3248db]"
              onClick={() => {
                onSave(draft);
                setEditing(false);
              }}
              type="button"
            >
              Done
            </button>
            <button
              className="rounded-[8px] px-3 py-1.5 text-[13px] font-semibold text-[#5c655e] hover:bg-[#f2f4f0]"
              onClick={() => {
                setDraft(item);
                setEditing(false);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AddressGroup({
  contactId,
  initial,
  editable,
}: {
  contactId: string;
  initial: AddressEntry[];
  editable: boolean;
}) {
  const [items, setItems] = useState<AddressEntry[]>(initial);

  const persist = (next: AddressEntry[]) => {
    void updateContactEntries(contactId, "addresses", next).catch(() => {
      /* optimistic */
    });
  };
  const saveAt = (index: number, next: AddressEntry) => {
    setItems((prev) => {
      const updated = prev.map((it, i) => (i === index ? next : it));
      persist(updated);
      return updated;
    });
  };
  const setLabelAt = (index: number, label: string) => {
    setItems((prev) => {
      const updated = prev.map((it, i) => (i === index ? { ...it, label } : it));
      persist(updated);
      return updated;
    });
  };
  const removeAt = (index: number) => {
    setItems((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      persist(updated);
      return updated;
    });
  };
  const add = () =>
    setItems((prev) => [
      ...prev,
      { label: "Home", street: "", city: "", state: "", postcode: "", country: "" },
    ]);

  return (
    <div>
      {items.map((item, index) => (
        <AddressBlock
          editable={editable}
          item={item}
          key={index}
          onChangeLabel={(label) => setLabelAt(index, label)}
          onRemove={() => removeAt(index)}
          onSave={(next) => saveAt(index, next)}
        />
      ))}
      {editable ? <AddLink label="Add address" onClick={add} /> : null}
    </div>
  );
}

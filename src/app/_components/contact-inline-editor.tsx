"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";

import { updateContactEntries, updateContactField } from "~/app/actions/contacts";
import {
  AddressGroup,
  MultiValueGroup,
  type AddressEntry,
  type SimpleEntry,
} from "~/app/_components/contact-multi-value";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

export type InlineEditorContact = {
  id: string;
  fullName: string;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  namePrefix: string | null;
  nameSuffix: string | null;
  nickname: string | null;
  phoneticFirstName: string | null;
  phoneticLastName: string | null;
  phoneticCompany: string | null;
  company: string | null;
  jobTitle: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  birthday: string | null;
  address: string | null;
  notes: string | null;
};

type FieldKey = keyof Omit<InlineEditorContact, "id">;

type FieldDef = {
  key: FieldKey;
  label: string;
  type?: "text" | "email" | "tel" | "url" | "area";
  display?: "date";
};

// Friendly read-mode rendering for stored date values (vCard basic YYYYMMDD,
// extended YYYY-MM-DD, or year-less --MMDD). Falls back to the raw string.
const formatDateDisplay = (value: string): string => {
  const noYear = /^--(\d{2})-?(\d{2})$/.exec(value);
  if (noYear) {
    const [, month, day] = noYear;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2000, Number(month) - 1, Number(day))));
  }
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value);
  if (!full) return value;
  const [, year, month, day] = full;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))));
};

const IDENTITY_FIELDS: FieldDef[] = [
  { key: "fullName", label: "Full name" },
  { key: "firstName", label: "First name" },
  { key: "middleName", label: "Middle name" },
  { key: "lastName", label: "Last name" },
  { key: "namePrefix", label: "Prefix" },
  { key: "nameSuffix", label: "Suffix" },
  { key: "phoneticFirstName", label: "Phonetic first" },
  { key: "phoneticLastName", label: "Phonetic last" },
  { key: "nickname", label: "Nickname" },
];

const WORK_FIELDS: FieldDef[] = [
  { key: "company", label: "Company" },
  { key: "phoneticCompany", label: "Phonetic company" },
  { key: "jobTitle", label: "Job title" },
  { key: "department", label: "Department" },
];

function InlineField({
  contactId,
  field,
  initialValue,
  editable,
  onBuffer,
}: {
  contactId: string;
  field: FieldDef;
  initialValue: string;
  editable: boolean;
  /** Buffered mode: report the committed value up instead of saving immediately. */
  onBuffer?: (value: string) => void;
}) {
  const [value, setValue] = useState(initialValue);
  const [draft, setDraft] = useState(initialValue);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const begin = () => {
    if (!editable) return;
    setDraft(value);
    setEditing(true);
    setStatus("idle");
  };

  const commit = async () => {
    setEditing(false);
    const next = draft.trim();
    if (next === value.trim()) {
      return;
    }
    if (field.key === "fullName" && next.length === 0) {
      setDraft(value); // names can't be blank
      return;
    }
    if (onBuffer) {
      setValue(next);
      onBuffer(next); // buffered — the real save happens on the Save button
      return;
    }
    setStatus("saving");
    try {
      await updateContactField(contactId, field.key, next);
      setValue(next);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("error");
      setDraft(value);
    }
  };

  const isArea = field.type === "area";
  const has = value.trim().length > 0;
  const leftBorder = editing
    ? "border-[#4158f4]"
    : status === "saved"
      ? "border-[#1f8a5b]"
      : "border-transparent";

  return (
    <div
      className={`gap-4 rounded-r-[6px] border-l-2 py-[9px] pl-[11px] pr-3 transition-colors ${leftBorder} ${
        editing ? "bg-[#4158f4]/[0.05]" : ""
      } ${isArea ? "block" : "flex items-start"} ${editable && !editing ? "cursor-text" : ""}`}
      onClick={editing ? undefined : begin}
    >
      <span
        className={`shrink-0 text-[12.5px] leading-[1.45] text-[#5c655e] ${
          isArea ? "mb-1.5 block" : "w-[118px] pt-px"
        }`}
      >
        {field.label}
        {!editable ? <span className="text-[11px] text-[#b9c0b8]"> · read-only</span> : null}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          isArea ? (
            <textarea
              autoFocus
              className="w-full resize-y border-none bg-transparent p-0 text-sm leading-[1.45] text-[#1d2823] outline-none"
              onBlur={() => void commit()}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              value={draft}
            />
          ) : (
            <input
              autoFocus
              className="w-full border-none bg-transparent p-0 text-sm leading-[1.45] text-[#1d2823] outline-none"
              onBlur={() => void commit()}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void commit();
                } else if (e.key === "Escape") {
                  setDraft(value);
                  setEditing(false);
                }
              }}
              type={field.type === "area" ? "text" : (field.type ?? "text")}
              value={draft}
            />
          )
        ) : (
          <span
            className={`block whitespace-pre-wrap break-words text-sm leading-[1.45] ${
              has ? "text-[#1d2823]" : "italic text-[#b9c0b8]"
            }`}
          >
            {has
              ? field.display === "date"
                ? formatDateDisplay(value)
                : value
              : editable
                ? "Not added"
                : "—"}
          </span>
        )}
        {status === "saving" ? (
          <span className="ml-1 text-[11px] text-[#8b938c]">Saving…</span>
        ) : status === "error" ? (
          <span className="ml-1 text-[11px] text-[#b5472f]">Couldn&apos;t save</span>
        ) : null}
      </div>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white">
      <h3 className="px-5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
        {title}
      </h3>
      <div className="mt-3 h-px bg-[#e9ece7]" />
      <div className="px-2 pb-2.5 pt-1.5">{children}</div>
    </section>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-0.5 ml-[13px] mt-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">
      {children}
    </div>
  );
}

const groupDivider = <div className="mx-[11px] my-0.5 h-px bg-[#e9ece7]" />;

// ── Read-mode presentational pieces ─────────────────────────────────────────
const nonEmpty = (v: string | null | undefined) => (v ?? "").trim().length > 0;

const formatAddress = (a: AddressEntry) =>
  [a.street, [a.city, a.state].filter(Boolean).join(", "), a.postcode, a.country]
    .filter((x) => x.trim().length > 0)
    .join("\n");

function ReadRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-[9px] pl-[11px] pr-3">
      <span className="w-[118px] shrink-0 pt-px text-[12.5px] leading-[1.45] text-[#5c655e]">{label}</span>
      <div className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-[1.45] text-[#1d2823]">
        {children}
      </div>
    </div>
  );
}

/** Read-only view of the contact — empty fields, groups, and sections are hidden. */
function ContactReadView({
  contact,
  entries,
}: {
  contact: InlineEditorContact;
  entries: ContactEntries;
}) {
  const identityRows = IDENTITY_FIELDS.filter((f) => nonEmpty(contact[f.key]));
  const workRows = WORK_FIELDS.filter((f) => nonEmpty(contact[f.key]));
  const emails = entries.emails.filter((e) => nonEmpty(e.value));
  const phones = entries.phones.filter((e) => nonEmpty(e.value));
  const websites = entries.websites.filter((e) => nonEmpty(e.value));
  const dates = entries.dates.filter((e) => nonEmpty(e.value));
  const related = entries.related.filter((e) => nonEmpty(e.value));
  const addresses = entries.addresses.filter((a) => formatAddress(a).trim().length > 0);
  const hasMethods = emails.length + phones.length + websites.length > 0;
  const hasPersonal = nonEmpty(contact.birthday) || addresses.length + related.length + dates.length > 0;

  const simpleRows = (items: SimpleEntry[]) =>
    items.map((e, i) => (
      <ReadRow key={`${e.label}-${i}`} label={e.label}>
        {e.value}
      </ReadRow>
    ));

  return (
    <div className="grid gap-4">
      <SectionCard title="Identity">
        {identityRows.map((f) => (
          <ReadRow key={f.key} label={f.label}>
            {f.display === "date" ? formatDateDisplay(contact[f.key] ?? "") : contact[f.key]}
          </ReadRow>
        ))}
      </SectionCard>

      {hasMethods ? (
        <SectionCard title="Contact methods">
          {simpleRows(emails)}
          {phones.length > 0 && emails.length > 0 ? groupDivider : null}
          {simpleRows(phones)}
          {websites.length > 0 && emails.length + phones.length > 0 ? groupDivider : null}
          {simpleRows(websites)}
        </SectionCard>
      ) : null}

      {workRows.length > 0 ? (
        <SectionCard title="Work">
          {workRows.map((f) => (
            <ReadRow key={f.key} label={f.label}>
              {contact[f.key]}
            </ReadRow>
          ))}
        </SectionCard>
      ) : null}

      {hasPersonal ? (
        <SectionCard title="Personal">
          {nonEmpty(contact.birthday) ? (
            <ReadRow label="Birthday">{formatDateDisplay(contact.birthday ?? "")}</ReadRow>
          ) : null}
          {addresses.length > 0 ? (
            <>
              <GroupLabel>Addresses</GroupLabel>
              {addresses.map((a, i) => (
                <ReadRow key={`addr-${i}`} label={a.label || "Address"}>
                  {formatAddress(a)}
                </ReadRow>
              ))}
            </>
          ) : null}
          {related.length > 0 ? (
            <>
              <GroupLabel>Related people</GroupLabel>
              {simpleRows(related)}
            </>
          ) : null}
          {dates.length > 0 ? (
            <>
              <GroupLabel>Significant dates</GroupLabel>
              {dates.map((e, i) => (
                <ReadRow key={`date-${i}`} label={e.label}>
                  {formatDateDisplay(e.value)}
                </ReadRow>
              ))}
            </>
          ) : null}
        </SectionCard>
      ) : null}

      {nonEmpty(contact.notes) ? (
        <SectionCard title="Notes">
          <ReadRow label="">{contact.notes}</ReadRow>
        </SectionCard>
      ) : null}
    </div>
  );
}

function PencilIcon() {
  return (
    <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} viewBox="0 0 24 24" width={15}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg fill="none" height={15} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={15}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export type ContactEntries = {
  emails: SimpleEntry[];
  phones: SimpleEntry[];
  websites: SimpleEntry[];
  addresses: AddressEntry[];
  dates: SimpleEntry[];
  related: SimpleEntry[];
};

// Scalar fields that buffer into the working copy and commit on Save.
const SCALAR_KEYS: FieldKey[] = [
  ...IDENTITY_FIELDS.map((f) => f.key),
  ...WORK_FIELDS.map((f) => f.key),
  "birthday",
  "notes",
];

type GroupKey = "emails" | "phones" | "websites" | "addresses" | "dates" | "related";

type EditorDraft = {
  scalars: Record<FieldKey, string>;
  emails: SimpleEntry[];
  phones: SimpleEntry[];
  websites: SimpleEntry[];
  addresses: AddressEntry[];
  dates: SimpleEntry[];
  related: SimpleEntry[];
};

// ── Edit controller: state shared by the header actions and the editor body ──
type ContactEditCtx = {
  contact: InlineEditorContact;
  entries: ContactEntries;
  editableShared: boolean;
  mode: "read" | "edit";
  draft: EditorDraft | null;
  saving: boolean;
  saveError: string | null;
  enterEdit: () => void;
  cancel: () => void;
  save: () => void;
  setScalar: (key: FieldKey, value: string) => void;
  setGroup: <K extends GroupKey>(key: K, next: EditorDraft[K]) => void;
};

const ContactEditContext = createContext<ContactEditCtx | null>(null);

function useContactEdit() {
  const ctx = useContext(ContactEditContext);
  if (!ctx) throw new Error("useContactEdit must be used within a ContactEditProvider");
  return ctx;
}

/**
 * Owns the buffered edit state. Wrap the detail header + body in this so the
 * header's Edit / Cancel / Save buttons drive the editor below.
 */
export function ContactEditProvider({
  contact,
  entries,
  editableShared,
  children,
}: {
  contact: InlineEditorContact;
  entries: ContactEntries;
  /** false for a live-received contact: shared fields read-only, notes still editable */
  editableShared: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"read" | "edit">("read");
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Warn on tab close / reload while there are unsaved edits.
  useEffect(() => {
    if (mode !== "edit" || !dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [mode, dirty]);

  const enterEdit = () => {
    setDraft({
      scalars: Object.fromEntries(SCALAR_KEYS.map((k) => [k, contact[k] ?? ""])) as Record<
        FieldKey,
        string
      >,
      emails: entries.emails.map((e) => ({ ...e })),
      phones: entries.phones.map((e) => ({ ...e })),
      websites: entries.websites.map((e) => ({ ...e })),
      addresses: entries.addresses.map((a) => ({ ...a })),
      dates: entries.dates.map((e) => ({ ...e })),
      related: entries.related.map((e) => ({ ...e })),
    });
    setDirty(false);
    setSaveError(null);
    setMode("edit");
  };

  const exitToRead = () => {
    setMode("read");
    setDraft(null);
    setDirty(false);
    setSaving(false);
    setSaveError(null);
    setConfirmDiscard(false);
  };

  const setScalar = (key: FieldKey, value: string) => {
    setDirty(true);
    setSaveError(null);
    setDraft((d) => (d ? { ...d, scalars: { ...d.scalars, [key]: value } } : d));
  };
  const setGroup = <K extends GroupKey>(key: K, next: EditorDraft[K]) => {
    setDirty(true);
    setSaveError(null);
    setDraft((d) => (d ? { ...d, [key]: next } : d));
  };

  const cancel = () => {
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    exitToRead();
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setSaveError(null);
    try {
      for (const key of SCALAR_KEYS) {
        const value = (draft.scalars[key] ?? "").trim();
        if (value !== (contact[key] ?? "").trim()) {
          await updateContactField(contact.id, key, value);
        }
      }
      const groups: Array<[GroupKey, unknown[], unknown[]]> = [
        ["emails", draft.emails, entries.emails],
        ["phones", draft.phones, entries.phones],
        ["websites", draft.websites, entries.websites],
        ["addresses", draft.addresses, entries.addresses],
        ["dates", draft.dates, entries.dates],
        ["related", draft.related, entries.related],
      ];
      for (const [group, next, orig] of groups) {
        if (JSON.stringify(next) !== JSON.stringify(orig)) {
          await updateContactEntries(contact.id, group, next);
        }
      }
      exitToRead();
      router.refresh();
    } catch {
      setSaveError("Couldn't save changes — check your connection and try again.");
      setSaving(false);
    }
  };

  return (
    <ContactEditContext.Provider
      value={{
        contact,
        entries,
        editableShared,
        mode,
        draft,
        saving,
        saveError,
        enterEdit,
        cancel,
        save: () => void save(),
        setScalar,
        setGroup,
      }}
    >
      {children}

      {confirmDiscard ? (
        <div
          className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(15,23,42,0.45)] p-4"
          onClick={() => setConfirmDiscard(false)}
        >
          <div
            className="w-full max-w-[400px] rounded-2xl bg-white p-6 shadow-[0_24px_60px_rgba(15,23,42,0.25)]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-[18px] font-semibold text-[#1d2823]">Discard changes?</h3>
            <p className="mt-2 text-[14px] leading-6 text-[#5c655e]">
              You have unsaved edits. If you leave now they&rsquo;ll be lost.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-xl border border-[#d8ddd6] px-4 py-2.5 text-[14px] font-semibold text-[#3a4540] transition hover:bg-[#f6f7f4]"
                onClick={() => setConfirmDiscard(false)}
                type="button"
              >
                Keep editing
              </button>
              <button
                className="rounded-xl bg-[#b5472f] px-4 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#9a3a23]"
                onClick={exitToRead}
                type="button"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ContactEditContext.Provider>
  );
}

/**
 * The detail page's sticky sub-header. In read mode it shows the back link +
 * the read actions (Share / Archive / More) + Edit. In edit mode it transforms:
 * tinted background, an "Editing" pill in place of the back label, and only
 * Cancel / Save on the right.
 */
export function ContactDetailHeaderBar({
  contactName,
  backHref = "/",
  readActions,
}: {
  contactName: string;
  backHref?: string;
  readActions: React.ReactNode;
}) {
  const { mode, saving, enterEdit, cancel, save } = useContactEdit();
  const editing = mode === "edit";

  return (
    <div
      className={`sticky top-0 z-20 flex h-[60px] shrink-0 items-center gap-3 border-b px-4 backdrop-blur transition-colors lg:px-[18px] ${
        editing ? "border-[rgba(65,88,244,0.28)] bg-[#f3f5ff]" : "border-[#d8ddd6] bg-white/95"
      }`}
    >
      {editing ? (
        <div className="flex items-center gap-2">
          <Link
            aria-label="Back to contacts"
            className="flex items-center text-[#5c655e] transition hover:text-[#1d2823]"
            href={backHref}
          >
            <WorkspaceIcon name="back" size={17} />
          </Link>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#c7d0f5] bg-white px-3 py-1 text-[13px] font-semibold text-[#4158f4]">
            <PencilIcon />
            Editing
          </span>
        </div>
      ) : (
        <Link
          className="flex items-center gap-1.5 text-sm font-semibold text-[#5c655e] transition hover:text-[#1d2823]"
          href={backHref}
        >
          <WorkspaceIcon name="back" size={17} />
          Contacts
        </Link>
      )}

      <span className="flex-1 truncate text-center text-[15px] font-semibold text-[#1d2823]">
        {contactName}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        {editing ? (
          <>
            <button
              className="rounded-[8px] px-3 py-1.5 text-[13px] font-semibold text-[#5c655e] transition hover:bg-white/70 hover:text-[#1d2823] disabled:opacity-50"
              disabled={saving}
              onClick={cancel}
              type="button"
            >
              Cancel
            </button>
            <button
              className="flex h-[34px] items-center gap-1.5 rounded-[8px] bg-[#17352e] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={saving}
              onClick={save}
              type="button"
            >
              {saving ? (
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              ) : (
                <CheckIcon />
              )}
              {saving ? "Saving…" : "Save"}
            </button>
          </>
        ) : (
          <>
            {readActions}
            <button
              className="flex h-[34px] items-center gap-1.5 rounded-[8px] bg-[#17352e] px-3 text-[13px] font-semibold text-white transition hover:bg-[#20443b]"
              onClick={enterEdit}
              type="button"
            >
              <PencilIcon />
              Edit
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** The Details-tab body — read view by default, buffered edit fields in edit mode. */
export function ContactInlineEditor() {
  const { contact, entries, editableShared, mode, draft, saveError, setScalar, setGroup } =
    useContactEdit();
  const editable = editableShared;

  return (
    <div className="grid gap-4">
      {!editableShared ? (
        <p className="rounded-[0.9rem] bg-[#eef5ef] px-4 py-2.5 text-[13px] text-[#17352e]">
          This is a live contact — shared fields are read-only and kept in sync by its owner. Your
          notes stay private and editable.
        </p>
      ) : null}

      {saveError ? (
        <p className="rounded-[0.9rem] border border-[#ecd0c7] bg-[#f7e9e4] px-4 py-2.5 text-[13px] text-[#8f3320]">
          {saveError}
        </p>
      ) : null}

      {mode === "read" || !draft ? (
        <ContactReadView contact={contact} entries={entries} />
      ) : (
        <div className="grid gap-4">
          <SectionCard title="Identity">
            {IDENTITY_FIELDS.map((field) => (
              <InlineField
                contactId={contact.id}
                editable={editable}
                field={field}
                initialValue={draft.scalars[field.key] ?? ""}
                key={field.key}
                onBuffer={(v) => setScalar(field.key, v)}
              />
            ))}
          </SectionCard>

          <SectionCard title="Contact methods">
            <MultiValueGroup
              addText="Add email"
              contactId={contact.id}
              defaultLabel="Work"
              editable={editable}
              group="emails"
              initial={draft.emails}
              inputType="email"
              onChange={(n) => setGroup("emails", n)}
            />
            {groupDivider}
            <MultiValueGroup
              addText="Add phone"
              contactId={contact.id}
              defaultLabel="Mobile"
              editable={editable}
              group="phones"
              initial={draft.phones}
              inputType="tel"
              onChange={(n) => setGroup("phones", n)}
            />
            {groupDivider}
            <MultiValueGroup
              addText="Add website"
              contactId={contact.id}
              defaultLabel="Portfolio"
              editable={editable}
              group="websites"
              initial={draft.websites}
              inputType="url"
              onChange={(n) => setGroup("websites", n)}
            />
          </SectionCard>

          <SectionCard title="Work">
            {WORK_FIELDS.map((field) => (
              <InlineField
                contactId={contact.id}
                editable={editable}
                field={field}
                initialValue={draft.scalars[field.key] ?? ""}
                key={field.key}
                onBuffer={(v) => setScalar(field.key, v)}
              />
            ))}
          </SectionCard>

          <SectionCard title="Personal">
            <InlineField
              contactId={contact.id}
              editable={editable}
              field={{ key: "birthday", label: "Birthday", display: "date" }}
              initialValue={draft.scalars.birthday ?? ""}
              onBuffer={(v) => setScalar("birthday", v)}
            />
            {groupDivider}
            <GroupLabel>Addresses</GroupLabel>
            <AddressGroup
              contactId={contact.id}
              editable={editable}
              initial={draft.addresses}
              onChange={(n) => setGroup("addresses", n)}
            />
            {groupDivider}
            <GroupLabel>Related people</GroupLabel>
            <MultiValueGroup
              addText="Add related person"
              contactId={contact.id}
              defaultLabel="Spouse"
              editable={editable}
              group="related"
              initial={draft.related}
              onChange={(n) => setGroup("related", n)}
            />
            {groupDivider}
            <GroupLabel>Significant dates</GroupLabel>
            <MultiValueGroup
              addText="Add date"
              contactId={contact.id}
              defaultLabel="Anniversary"
              editable={editable}
              group="dates"
              initial={draft.dates}
              inputType="date"
              onChange={(n) => setGroup("dates", n)}
            />
          </SectionCard>

          <SectionCard title="Notes">
            <InlineField
              contactId={contact.id}
              editable
              field={{ key: "notes", label: "Notes", type: "area" }}
              initialValue={draft.scalars.notes ?? ""}
              onBuffer={(v) => setScalar("notes", v)}
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}

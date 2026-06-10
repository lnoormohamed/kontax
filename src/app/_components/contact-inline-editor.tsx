"use client";

import { useState } from "react";

import { updateContactField } from "~/app/actions/contacts";
import {
  AddressGroup,
  MultiValueGroup,
  type AddressEntry,
  type SimpleEntry,
} from "~/app/_components/contact-multi-value";

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
}: {
  contactId: string;
  field: FieldDef;
  initialValue: string;
  editable: boolean;
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

export type ContactEntries = {
  emails: SimpleEntry[];
  phones: SimpleEntry[];
  websites: SimpleEntry[];
  addresses: AddressEntry[];
  dates: SimpleEntry[];
  related: SimpleEntry[];
};

export function ContactInlineEditor({
  contact,
  entries,
  editableShared,
}: {
  contact: InlineEditorContact;
  entries: ContactEntries;
  /** false for a live-received contact: shared fields read-only, notes still editable */
  editableShared: boolean;
}) {
  const editable = editableShared;
  return (
    <div className="grid gap-4">
      {!editableShared ? (
        <p className="rounded-[0.9rem] bg-[#eef5ef] px-4 py-2.5 text-[13px] text-[#17352e]">
          This is a live contact — shared fields are read-only and kept in sync by its owner. Your
          notes stay private and editable.
        </p>
      ) : null}

      <SectionCard title="Identity">
        {IDENTITY_FIELDS.map((field) => (
          <InlineField
            contactId={contact.id}
            editable={editable}
            field={field}
            initialValue={contact[field.key] ?? ""}
            key={field.key}
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
          initial={entries.emails}
          inputType="email"
        />
        {groupDivider}
        <MultiValueGroup
          addText="Add phone"
          contactId={contact.id}
          defaultLabel="Mobile"
          editable={editable}
          group="phones"
          initial={entries.phones}
          inputType="tel"
        />
        {groupDivider}
        <MultiValueGroup
          addText="Add website"
          contactId={contact.id}
          defaultLabel="Portfolio"
          editable={editable}
          group="websites"
          initial={entries.websites}
          inputType="url"
        />
      </SectionCard>

      <SectionCard title="Work">
        {WORK_FIELDS.map((field) => (
          <InlineField
            contactId={contact.id}
            editable={editable}
            field={field}
            initialValue={contact[field.key] ?? ""}
            key={field.key}
          />
        ))}
      </SectionCard>

      <SectionCard title="Personal">
        <InlineField
          contactId={contact.id}
          editable={editable}
          field={{ key: "birthday", label: "Birthday", display: "date" }}
          initialValue={contact.birthday ?? ""}
        />
        {groupDivider}
        <GroupLabel>Addresses</GroupLabel>
        <AddressGroup contactId={contact.id} editable={editable} initial={entries.addresses} />
        {groupDivider}
        <GroupLabel>Related people</GroupLabel>
        <MultiValueGroup
          addText="Add related person"
          contactId={contact.id}
          defaultLabel="Spouse"
          editable={editable}
          group="related"
          initial={entries.related}
        />
        {groupDivider}
        <GroupLabel>Significant dates</GroupLabel>
        <MultiValueGroup
          addText="Add date"
          contactId={contact.id}
          defaultLabel="Anniversary"
          editable={editable}
          group="dates"
          initial={entries.dates}
          inputType="date"
        />
      </SectionCard>

      <SectionCard title="Notes">
        <InlineField
          contactId={contact.id}
          editable
          field={{ key: "notes", label: "Notes", type: "area" }}
          initialValue={contact.notes ?? ""}
        />
      </SectionCard>
    </div>
  );
}

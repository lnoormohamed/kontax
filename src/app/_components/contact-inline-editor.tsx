"use client";

import { useState } from "react";

import { updateContactField } from "~/app/actions/contacts";

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
  email: string | null;
  phone: string | null;
  website: string | null;
  birthday: string | null;
  address: string | null;
  notes: string | null;
};

type FieldKey = keyof Omit<InlineEditorContact, "id">;

type FieldDef = { key: FieldKey; label: string; type?: "text" | "email" | "tel" | "url" | "area" };

const SECTIONS: Array<{ id: string; title: string; fields: FieldDef[] }> = [
  {
    id: "identity",
    title: "Identity",
    fields: [
      { key: "fullName", label: "Full name" },
      { key: "firstName", label: "First name" },
      { key: "middleName", label: "Middle name" },
      { key: "lastName", label: "Last name" },
      { key: "namePrefix", label: "Prefix" },
      { key: "nameSuffix", label: "Suffix" },
      { key: "nickname", label: "Nickname" },
      { key: "phoneticFirstName", label: "Phonetic first" },
      { key: "phoneticLastName", label: "Phonetic last" },
    ],
  },
  {
    id: "methods",
    title: "Contact methods",
    fields: [
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "tel" },
      { key: "website", label: "Website", type: "url" },
    ],
  },
  {
    id: "work",
    title: "Work",
    fields: [
      { key: "company", label: "Company" },
      { key: "jobTitle", label: "Job title" },
      { key: "phoneticCompany", label: "Phonetic company" },
    ],
  },
  {
    id: "personal",
    title: "Personal",
    fields: [
      { key: "birthday", label: "Birthday" },
      { key: "address", label: "Address", type: "area" },
    ],
  },
  { id: "notes", title: "Notes", fields: [{ key: "notes", label: "Notes", type: "area" }] },
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
      className={`gap-4 rounded-r-[6px] border-l-2 px-3 py-2 transition-colors ${leftBorder} ${
        editing ? "bg-[#4158f4]/[0.045]" : ""
      } ${isArea ? "block" : "flex items-start"}`}
    >
      <span
        className={`shrink-0 text-[12.5px] text-[#5c655e] ${isArea ? "mb-1.5 block" : "w-[118px] pt-1.5"}`}
      >
        {field.label}
        {!editable ? <span className="text-[11px] text-[#aeb4ac]"> · read-only</span> : null}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          isArea ? (
            <textarea
              autoFocus
              className="w-full resize-y rounded-[0.5rem] border border-[#4158f4] bg-white px-2.5 py-1.5 text-sm text-[#1d2823] outline-none"
              onBlur={() => void commit()}
              onChange={(e) => setDraft(e.target.value)}
              rows={4}
              value={draft}
            />
          ) : (
            <input
              autoFocus
              className="w-full rounded-[0.5rem] border border-[#4158f4] bg-white px-2.5 py-1.5 text-sm text-[#1d2823] outline-none"
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
          <button
            className={`-mx-1 w-[calc(100%+0.5rem)] whitespace-pre-wrap break-words rounded-[0.4rem] px-1 py-0.5 text-left text-sm transition ${
              editable ? "cursor-text hover:bg-[#f6f7f4]" : "cursor-default"
            } ${has ? "text-[#1d2823]" : "italic text-[#aeb4ac]"}`}
            onClick={begin}
            type="button"
          >
            {has ? value : editable ? "Not added" : "—"}
          </button>
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

export function ContactInlineEditor({
  contact,
  editableShared,
}: {
  contact: InlineEditorContact;
  /** false for a live-received contact: shared fields read-only, notes still editable */
  editableShared: boolean;
}) {
  return (
    <div className="grid gap-4">
      {!editableShared ? (
        <p className="rounded-[0.9rem] bg-[#eef5ef] px-4 py-2.5 text-[13px] text-[#17352e]">
          This is a live contact — shared fields are read-only and kept in sync by its owner. Your
          notes stay private and editable.
        </p>
      ) : null}
      {SECTIONS.map((section) => (
        <section
          className="overflow-hidden rounded-[14px] border border-[#d8ddd6] bg-white"
          key={section.id}
        >
          <h3 className="px-5 pt-3.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8b938c]">
            {section.title}
          </h3>
          <div className="mt-3 h-px bg-[#e9ece7]" />
          <div className="px-2 pb-2.5 pt-1.5">
            {section.fields.map((field) => (
              <InlineField
                contactId={contact.id}
                editable={editableShared || field.key === "notes"}
                field={field}
                initialValue={contact[field.key] ?? ""}
                key={field.key}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

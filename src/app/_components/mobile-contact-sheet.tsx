"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { createContact, updateContact } from "~/app/actions/contacts";
import { MobileBottomSheet } from "~/app/_components/mobile-bottom-sheet";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

/**
 * P24B-07 — Create / edit contact bottom sheet (redone per design P24B-DB19).
 *
 * ONE sheet for BOTH create and edit, covering every field the desktop inline
 * editor has (no regressions): Basic Info (always on) · Phones · Emails ·
 * Websites · Address (multi sub-cards) · Dates (birthday + significant) ·
 * Related people · More (notes, name details, work, custom fields).
 *
 * Collapsible section cards with a count pill; sections with data open by
 * default, empty optional sections collapse to a single "+ Add". Real native
 * inputs (≥16px so iOS never zooms; native date picker), inline per-field
 * validation under the field (never an alert), Save pinned above the keyboard.
 * Saves via the same FormData contract as create: createContact / updateContact
 * (+ contactId). The full-page form remains the `?full=1` fallback.
 */

type ValueRow = { label: string; value: string };
type AddressRow = { label: string; street: string; city: string; postcode: string; country: string };

export type ContactSheetInitial = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phones?: ValueRow[];
  emails?: ValueRow[];
  websites?: ValueRow[];
  addresses?: AddressRow[];
  birthday?: string | null;
  significantDates?: ValueRow[];
  relatedPeople?: ValueRow[];
  notes?: string | null;
  // name details
  middleName?: string | null;
  namePrefix?: string | null;
  nameSuffix?: string | null;
  nickname?: string | null;
  phoneticFirstName?: string | null;
  phoneticLastName?: string | null;
  phoneticCompany?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  customFields?: ValueRow[];
};

const PHONE_LABELS = ["Mobile", "Work", "Home", "Main", "iPhone", "Fax", "Other"];
const EMAIL_LABELS = ["Work", "Personal", "Home", "School", "Other"];
const WEBSITE_LABELS = ["Work", "Personal", "Blog", "Portfolio", "Other"];
const ADDRESS_LABELS = ["Home", "Work", "Other"];
const RELATED_LABELS = ["Spouse", "Partner", "Child", "Parent", "Sibling", "Assistant", "Manager", "Friend", "Other"];
const DATE_LABELS = ["Anniversary", "Other"];

// ── shared styles (focus ring + error states need :focus, so inline <style>) ──
const STYLES = `
.mcs-field{ display:block; }
.mcs-flabel{ display:block; font-size:12px; font-weight:600; color:#8b938c; margin:0 0 6px; }
.mcs-input{ width:100%; min-height:48px; border:1.5px solid #d8ddd6; border-radius:11px; background:#fff;
  padding:13px 14px; font-size:16px; color:#1d2823; outline:none; line-height:1.35;
  transition:border-color .12s, box-shadow .12s, background .12s; -webkit-appearance:none; }
textarea.mcs-input{ min-height:84px; resize:vertical; }
.mcs-input::placeholder{ color:#aeb4ac; }
.mcs-input:focus{ border-color:#4158f4; background:#f4f6ff; box-shadow:0 0 0 3px rgba(65,88,244,.12); }
.mcs-input[data-error="1"]{ border-color:#b5472f; background:#fbeee9; box-shadow:0 0 0 3px rgba(181,71,47,.10); }
.mcs-ferr{ display:flex; align-items:center; gap:5px; font-size:12px; color:#b5472f; font-weight:500; margin-top:6px; }
.mcs-pill{ height:32px; border-radius:9px; background:#f2f4f0; border:1px solid #e9ece7; padding:0 8px;
  font-size:12.5px; font-weight:700; color:#5c655e; outline:none; -webkit-appearance:none; flex:0 0 auto; }
.mcs-pill:focus{ border-color:#4158f4; }
.mcs-add{ display:flex; align-items:center; gap:9px; height:42px; border:none; background:transparent; color:#4158f4;
  font-size:14.5px; font-weight:600; padding:0; cursor:pointer; }
.mcs-add-ic{ width:24px; height:24px; border-radius:7px; background:#eef1fe; display:grid; place-items:center; flex:0 0 auto; }
.mcs-remove{ width:30px; height:30px; flex:0 0 auto; display:grid; place-items:center; border:none; background:transparent;
  border-radius:8px; cursor:pointer; }
`;

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multi = false,
  error,
  refCb,
  autoFocus,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multi?: boolean;
  error?: string;
  refCb?: (n: HTMLElement | null) => void;
  autoFocus?: boolean;
}) {
  const common = {
    className: "mcs-input",
    "data-error": error ? 1 : 0,
    value,
    placeholder,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(e.target.value),
  } as const;
  return (
    <label className="mcs-field">
      {label ? <span className="mcs-flabel">{label}</span> : null}
      {multi ? (
        <textarea {...common} ref={refCb} />
      ) : (
        <input
          {...common}
          ref={refCb}
          type={type}
          inputMode={type === "tel" ? "tel" : type === "email" ? "email" : type === "url" ? "url" : undefined}
          autoComplete="off"
          autoCapitalize={type === "email" || type === "url" ? "none" : undefined}
          autoFocus={autoFocus}
        />
      )}
      {error ? (
        <span className="mcs-ferr">
          <WorkspaceIcon name="warning" size={13} className="text-[#b5472f]" />
          {error}
        </span>
      ) : null}
    </label>
  );
}

function LabelPill({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  const opts = options.includes(value) ? options : [value, ...options];
  return (
    <select className="mcs-pill" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Label">
      {opts.map((o) => (
        <option key={o} value={o}>{o}</option>
      ))}
    </select>
  );
}

function Remove({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="mcs-remove" aria-label="Remove" onClick={onClick}>
      <WorkspaceIcon name="close" size={15} className="text-[#8b938c]" />
    </button>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="mcs-add" onClick={onClick}>
      <span className="mcs-add-ic">
        <WorkspaceIcon name="plus" size={16} strokeWidth={2.1} className="text-[#4158f4]" />
      </span>
      {label}
    </button>
  );
}

function Section({
  id,
  title,
  count,
  locked = false,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  locked?: boolean;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = locked || open;
  return (
    <div style={{ marginBottom: 11, border: "1px solid #d8ddd6", borderRadius: 15, background: "#fff", overflow: "hidden" }}>
      <button
        type="button"
        disabled={locked}
        onClick={() => onToggle(id)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 9, height: 52, padding: "0 15px", border: "none", background: "transparent", cursor: locked ? "default" : "pointer" }}
      >
        <span style={{ flex: 1, textAlign: "left", fontSize: 15, fontWeight: 700, color: "#1d2823", letterSpacing: "-0.005em" }}>{title}</span>
        {count && count > 0 ? (
          <span style={{ minWidth: 21, height: 21, padding: "0 6px", borderRadius: 11, background: "#e7efe9", color: "#17352e", fontSize: 11.5, fontWeight: 700, display: "grid", placeItems: "center" }}>{count}</span>
        ) : null}
        {locked ? (
          <span style={{ fontSize: 11, fontWeight: 700, color: "#8b938c" }}>Always on</span>
        ) : (
          <span style={{ display: "grid", placeItems: "center", transition: "transform .18s", transform: isOpen ? "rotate(90deg)" : "none" }}>
            <WorkspaceIcon name="chevronRight" size={19} className="text-[#8b938c]" />
          </span>
        )}
      </button>
      {isOpen ? <div style={{ padding: "2px 15px 16px", display: "flex", flexDirection: "column", gap: 13 }}>{children}</div> : null}
    </div>
  );
}

function MultiEntry({
  rows,
  setRows,
  labels,
  placeholder,
  type,
  addText,
  errorAt,
  refAt,
}: {
  rows: ValueRow[];
  setRows: (r: ValueRow[]) => void;
  labels: string[];
  placeholder: string;
  type: string;
  addText: string;
  errorAt?: (i: number) => string | undefined;
  refAt?: (i: number) => (n: HTMLElement | null) => void;
}) {
  const patch = (i: number, p: Partial<ValueRow>) => setRows(rows.map((r, idx) => (idx === i ? { ...r, ...p } : r)));
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LabelPill value={row.label} options={labels} onChange={(l) => patch(i, { label: l })} />
            <span style={{ flex: 1 }} />
            <Remove onClick={() => setRows(rows.filter((_, idx) => idx !== i))} />
          </div>
          <Field
            value={row.value}
            onChange={(v) => patch(i, { value: v })}
            placeholder={placeholder}
            type={type}
            error={errorAt?.(i)}
            refCb={refAt?.(i)}
          />
        </div>
      ))}
      <AddRow label={addText} onClick={() => setRows([...rows, { label: labels[0]!, value: "" }])} />
    </>
  );
}

const has = (...v: Array<string | null | undefined | unknown[]>) =>
  v.some((x) => (Array.isArray(x) ? x.length > 0 : Boolean(x && String(x).trim())));

const lines = (rows: ValueRow[]) =>
  rows
    .filter((r) => r.value.trim() && r.label.trim())
    .map((r) => `${r.label.trim()} | ${r.value.trim()}`)
    .join("\n");

const extraValues = (rows: ValueRow[], from: number) =>
  rows.slice(from).map((r) => r.value.trim()).filter(Boolean).join("\n");

export function MobileContactSheet({
  isOpen,
  onClose,
  initial,
  target,
}: {
  isOpen: boolean;
  onClose: () => void;
  /** Provide to edit an existing contact; omit to create. */
  initial?: ContactSheetInitial;
  /** Save-to destination for create (private / family / team key). */
  target?: string;
}) {
  const isEdit = Boolean(initial);
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const errRefs = useRef<Record<string, HTMLElement | null>>({});

  const [first, setFirst] = useState(initial?.firstName ?? "");
  const [last, setLast] = useState(initial?.lastName ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [phones, setPhones] = useState<ValueRow[]>(initial?.phones ?? []);
  const [emails, setEmails] = useState<ValueRow[]>(initial?.emails ?? []);
  const [websites, setWebsites] = useState<ValueRow[]>(initial?.websites ?? []);
  const [addresses, setAddresses] = useState<AddressRow[]>(initial?.addresses ?? []);
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [sigDates, setSigDates] = useState<ValueRow[]>(initial?.significantDates ?? []);
  const [related, setRelated] = useState<ValueRow[]>(initial?.relatedPeople ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [middleName, setMiddleName] = useState(initial?.middleName ?? "");
  const [namePrefix, setNamePrefix] = useState(initial?.namePrefix ?? "");
  const [nameSuffix, setNameSuffix] = useState(initial?.nameSuffix ?? "");
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [phoneticFirst, setPhoneticFirst] = useState(initial?.phoneticFirstName ?? "");
  const [phoneticLast, setPhoneticLast] = useState(initial?.phoneticLastName ?? "");
  const [phoneticCompany, setPhoneticCompany] = useState(initial?.phoneticCompany ?? "");
  const [jobTitle, setJobTitle] = useState(initial?.jobTitle ?? "");
  const [department, setDepartment] = useState(initial?.department ?? "");
  const [customFields, setCustomFields] = useState<ValueRow[]>(initial?.customFields ?? []);

  const nameDetailFilled = has(middleName, namePrefix, nameSuffix, nickname, phoneticFirst, phoneticLast, phoneticCompany);
  const moreCount = [notes, jobTitle, department].filter((v) => v.trim()).length + (nameDetailFilled ? 1 : 0) + customFields.length;

  // default-open: data-bearing sections (computed once from the initial)
  const defaultOpen = useMemo<Record<string, boolean>>(
    () => ({
      phones: has(initial?.phones),
      emails: has(initial?.emails),
      websites: has(initial?.websites),
      addresses: has(initial?.addresses),
      dates: has(initial?.birthday, initial?.significantDates),
      related: has(initial?.relatedPeople),
      more: has(
        initial?.notes,
        initial?.jobTitle,
        initial?.department,
        initial?.customFields,
        initial?.middleName,
        initial?.namePrefix,
        initial?.nameSuffix,
        initial?.nickname,
        initial?.phoneticFirstName,
        initial?.phoneticLastName,
        initial?.phoneticCompany,
      ),
    }),
    [initial],
  );
  const [open, setOpen] = useState<Record<string, boolean>>(defaultOpen);
  const [nameOpen, setNameOpen] = useState(nameDetailFilled);
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const canSave = Boolean(first.trim() || last.trim() || company.trim());

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {};
    if (!canSave) e.name = "Add a first or last name, or a company, to save.";
    emails.forEach((m, i) => {
      if (m.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.value.trim())) e[`email-${i}`] = "Enter a valid email address.";
    });
    phones.forEach((p, i) => {
      if (p.value.trim() && p.value.replace(/\D/g, "").length < 4) e[`phone-${i}`] = "Enter a valid phone number.";
    });
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      // open the offending sections and scroll to the first error
      const keys = Object.keys(e);
      setOpen((o) => {
        const next = { ...o };
        if (keys.some((k) => k.startsWith("phone"))) next.phones = true;
        if (keys.some((k) => k.startsWith("email"))) next.emails = true;
        return next;
      });
      const firstKey = keys[0]!;
      requestAnimationFrame(() => errRefs.current[firstKey]?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return;
    }
    setErrors({});
    setFormError(null);

    const fd = new FormData();
    const set = (k: string, v: string | undefined | null) => {
      if (v?.trim()) fd.set(k, v.trim());
    };
    set("firstName", first);
    set("lastName", last);
    set("company", company);

    set("phone", phones[0]?.value);
    set("phoneLabel", phones[0]?.label);
    set("secondaryPhone", phones[1]?.value);
    set("secondaryPhoneLabel", phones[1]?.label);
    set("additionalPhones", extraValues(phones, 2));

    set("email", emails[0]?.value);
    set("emailLabel", emails[0]?.label);
    set("secondaryEmail", emails[1]?.value);
    set("secondaryEmailLabel", emails[1]?.label);
    set("additionalEmails", extraValues(emails, 2));

    set("website", websites[0]?.value);
    set("websiteLabel", websites[0]?.label);
    set("secondaryWebsite", websites[1]?.value);
    set("secondaryWebsiteLabel", websites[1]?.label);
    set("additionalWebsites", extraValues(websites, 2));

    const a0 = addresses[0];
    if (a0) {
      set("addressLabel", a0.label);
      set("streetLine1", a0.street);
      set("cityOrTown", a0.city);
      set("postcode", a0.postcode);
      set("countryOrRegion", a0.country);
    }
    const extraAddr = addresses
      .slice(1)
      .map((a) => [a.street, a.city, a.postcode, a.country].map((x) => x.trim()).filter(Boolean).join(", "))
      .filter(Boolean)
      .join("\n");
    set("additionalAddresses", extraAddr);

    set("birthday", birthday);
    set("significantDates", lines(sigDates));
    set("relatedPeople", lines(related));
    set("customFields", lines(customFields));

    set("middleName", middleName);
    set("namePrefix", namePrefix);
    set("nameSuffix", nameSuffix);
    set("nickname", nickname);
    set("phoneticFirstName", phoneticFirst);
    set("phoneticLastName", phoneticLast);
    set("phoneticCompany", phoneticCompany);
    set("jobTitle", jobTitle);
    set("department", department);
    set("notes", notes);

    if (isEdit && initial) fd.set("contactId", initial.id);
    if (!isEdit && target) fd.set("target", target);

    startTransition(async () => {
      try {
        if (isEdit) await updateContact(fd);
        else await createContact(fd);
        onClose();
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("NEXT_REDIRECT")) {
          onClose();
          router.refresh();
        } else {
          setFormError(msg || "Something went wrong. Please try again.");
        }
      }
    });
  };

  const footer = (
    <button
      type="button"
      disabled={isPending}
      onClick={handleSave}
      style={{
        width: "100%",
        height: 50,
        borderRadius: 13,
        border: "none",
        background: isPending ? "#7d8bf6" : "#4158f4",
        color: "#fff",
        fontSize: 16,
        fontWeight: 600,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        cursor: isPending ? "default" : "pointer",
      }}
    >
      {isPending ? "Saving…" : isEdit ? "Save changes" : "Save contact"}
    </button>
  );

  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit contact" : "New contact"} footer={footer}>
      <style>{STYLES}</style>

      <Section id="basic" title="Basic Info" locked open onToggle={toggle}>
        <Field label="First name" value={first} onChange={setFirst} placeholder="First name" autoFocus={!isEdit} error={errors.name} refCb={(n) => (errRefs.current.name = n)} />
        <Field label="Last name" value={last} onChange={setLast} placeholder="Last name" />
        <Field label="Company" value={company} onChange={setCompany} placeholder="Company" />
      </Section>

      <Section id="phones" title="Phone numbers" count={phones.length} open={open.phones ?? false} onToggle={toggle}>
        <MultiEntry
          rows={phones}
          setRows={setPhones}
          labels={PHONE_LABELS}
          placeholder="Phone number"
          type="tel"
          addText="Add phone number"
          errorAt={(i) => errors[`phone-${i}`]}
          refAt={(i) => (n) => (errRefs.current[`phone-${i}`] = n)}
        />
      </Section>

      <Section id="emails" title="Email addresses" count={emails.length} open={open.emails ?? false} onToggle={toggle}>
        <MultiEntry
          rows={emails}
          setRows={setEmails}
          labels={EMAIL_LABELS}
          placeholder="Email address"
          type="email"
          addText="Add email address"
          errorAt={(i) => errors[`email-${i}`]}
          refAt={(i) => (n) => (errRefs.current[`email-${i}`] = n)}
        />
      </Section>

      <Section id="websites" title="Websites" count={websites.length} open={open.websites ?? false} onToggle={toggle}>
        <MultiEntry rows={websites} setRows={setWebsites} labels={WEBSITE_LABELS} placeholder="Website URL" type="url" addText="Add website" />
      </Section>

      <Section id="addresses" title="Address" count={addresses.length} open={open.addresses ?? false} onToggle={toggle}>
        {addresses.map((a, i) => {
          const patch = (p: Partial<AddressRow>) => setAddresses(addresses.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
          return (
            <div key={i} style={{ border: "1px solid #e9ece7", borderRadius: 12, padding: "10px 13px 14px", background: "#f6f7f4" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <LabelPill value={a.label} options={ADDRESS_LABELS} onChange={(l) => patch({ label: l })} />
                <span style={{ flex: 1 }} />
                <Remove onClick={() => setAddresses(addresses.filter((_, idx) => idx !== i))} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                <Field value={a.street} onChange={(v) => patch({ street: v })} placeholder="Street address" />
                <Field value={a.city} onChange={(v) => patch({ city: v })} placeholder="City" />
                <Field value={a.postcode} onChange={(v) => patch({ postcode: v })} placeholder="Postcode" />
                <Field value={a.country} onChange={(v) => patch({ country: v })} placeholder="Country" />
              </div>
            </div>
          );
        })}
        <AddRow label="Add address" onClick={() => setAddresses([...addresses, { label: "Home", street: "", city: "", postcode: "", country: "" }])} />
      </Section>

      <Section id="dates" title="Dates" count={(birthday ? 1 : 0) + sigDates.length} open={open.dates ?? false} onToggle={toggle}>
        <Field label="Birthday" value={birthday} onChange={setBirthday} type="date" />
        {sigDates.length > 0 ? (
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#aeb4ac", marginTop: 4 }}>Significant dates</div>
        ) : null}
        <MultiEntry rows={sigDates} setRows={setSigDates} labels={DATE_LABELS} placeholder="Date" type="date" addText="Add date" />
      </Section>

      <Section id="related" title="Related people" count={related.length} open={open.related ?? false} onToggle={toggle}>
        <MultiEntry rows={related} setRows={setRelated} labels={RELATED_LABELS} placeholder="Name" type="text" addText="Add person" />
      </Section>

      <Section id="more" title="More" count={moreCount} open={open.more ?? false} onToggle={toggle}>
        <Field label="Notes" value={notes} onChange={setNotes} placeholder="Add a note about this contact…" multi />

        <div style={{ border: "1px solid #e9ece7", borderRadius: 12, overflow: "hidden" }}>
          <button
            type="button"
            onClick={() => setNameOpen((v) => !v)}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 13px", border: "none", background: "#f6f7f4", cursor: "pointer" }}
          >
            <WorkspaceIcon name="person" size={17} className="text-[#8b938c]" />
            <span style={{ flex: 1, textAlign: "left", fontSize: 13.5, fontWeight: 700, color: "#5c655e" }}>Name details</span>
            <span style={{ display: "grid", placeItems: "center", transition: "transform .18s", transform: nameOpen ? "rotate(90deg)" : "none" }}>
              <WorkspaceIcon name="chevronRight" size={18} className="text-[#8b938c]" />
            </span>
          </button>
          {nameOpen ? (
            <div style={{ padding: "12px 13px 14px", display: "flex", flexDirection: "column", gap: 13 }}>
              <Field label="Middle name" value={middleName} onChange={setMiddleName} placeholder="Middle name" />
              <Field label="Prefix" value={namePrefix} onChange={setNamePrefix} placeholder="e.g. Dr, Ms" />
              <Field label="Suffix" value={nameSuffix} onChange={setNameSuffix} placeholder="e.g. Jr, PhD" />
              <Field label="Nickname" value={nickname} onChange={setNickname} placeholder="Nickname" />
              <Field label="Phonetic first name" value={phoneticFirst} onChange={setPhoneticFirst} placeholder="Phonetic spelling" />
              <Field label="Phonetic last name" value={phoneticLast} onChange={setPhoneticLast} placeholder="Phonetic spelling" />
              <Field label="Phonetic company" value={phoneticCompany} onChange={setPhoneticCompany} placeholder="Phonetic spelling" />
            </div>
          ) : null}
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#aeb4ac", marginTop: 4 }}>Work</div>
        <Field label="Job title" value={jobTitle} onChange={setJobTitle} placeholder="Job title" />
        <Field label="Department" value={department} onChange={setDepartment} placeholder="Department" />

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: "#aeb4ac", marginTop: 4 }}>Custom fields</div>
        {customFields.map((cf, i) => {
          const patch = (p: Partial<ValueRow>) => setCustomFields(customFields.map((x, idx) => (idx === i ? { ...x, ...p } : x)));
          return (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "#aeb4ac" }}>Custom</span>
                <Remove onClick={() => setCustomFields(customFields.filter((_, idx) => idx !== i))} />
              </div>
              <Field value={cf.label} onChange={(v) => patch({ label: v })} placeholder="Label (e.g. Pronouns)" />
              <Field value={cf.value} onChange={(v) => patch({ value: v })} placeholder="Value" />
            </div>
          );
        })}
        <AddRow label="Add custom field" onClick={() => setCustomFields([...customFields, { label: "", value: "" }])} />
      </Section>

      {formError ? <p style={{ fontSize: 13, color: "#b5472f", margin: "0 2px 4px" }}>{formError}</p> : null}

      <p style={{ textAlign: "center", fontSize: 13, color: "#8b938c", margin: "4px 0 0" }}>
        Need every field?{" "}
        <Link href={isEdit && initial ? `/contacts/${initial.id}?full=1` : "/contacts/new?full=1"} style={{ color: "#4158f4", fontWeight: 600, textDecoration: "none" }}>
          Open full form
        </Link>
      </p>
    </MobileBottomSheet>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { createContact, updateContact } from "~/app/actions/contacts";
import { MobileBottomSheet } from "~/app/_components/mobile-bottom-sheet";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

/**
 * P24B-07 — Create / edit contact bottom sheet (spec §E3, design EditSheet).
 *
 * Collapsible section cards (Basic Info always-on; Phones, Emails, Address,
 * More), real inputs (≥16px, no iOS zoom), pinned Save above the keyboard
 * (MobileBottomSheet footer + visualViewport offset). Same FormData contract as
 * the full page: create → createContact, edit → updateContact (+ contactId).
 * The full-page form remains the `?full=1` fallback.
 */

type ValueRow = { label: string; value: string };

export type ContactSheetInitial = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phones?: ValueRow[];
  emails?: ValueRow[];
  street?: string | null;
  city?: string | null;
  postcode?: string | null;
  country?: string | null;
  addressLabel?: string | null;
  birthday?: string | null;
  notes?: string | null;
};

const PHONE_LABELS = ["Mobile", "Home", "Work", "Main", "iPhone", "Other"];
const EMAIL_LABELS = ["Home", "Work", "iCloud", "Other"];

const INPUT: React.CSSProperties = {
  width: "100%",
  minHeight: 46,
  border: "1.5px solid #d8ddd6",
  borderRadius: 11,
  background: "#fff",
  padding: "0 14px",
  fontSize: 16,
  color: "#1d2823",
  outline: "none",
};
const LABEL: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#8b938c",
  margin: "0 0 5px",
};
const LABEL_SELECT: React.CSSProperties = {
  height: 46,
  borderRadius: 11,
  border: "1.5px solid #d8ddd6",
  background: "#f6f7f4",
  padding: "0 10px",
  fontSize: 13,
  fontWeight: 600,
  color: "#5c655e",
  outline: "none",
  flexShrink: 0,
};

function joinExtra(rows: ValueRow[], from: number): string {
  return rows.slice(from).map((r) => r.value.trim()).filter(Boolean).join("\n");
}

function Section({
  id,
  title,
  locked = false,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  locked?: boolean;
  open: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const isOpen = locked || open;
  return (
    <div style={{ marginBottom: 10, border: "1px solid #d8ddd6", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
      <button
        type="button"
        disabled={locked}
        onClick={() => onToggle(id)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, height: 48, padding: "0 14px", border: "none", background: "transparent", cursor: locked ? "default" : "pointer" }}
      >
        <span style={{ flex: 1, textAlign: "left", fontSize: 14.5, fontWeight: 700, color: "#1d2823" }}>{title}</span>
        {locked ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: "#8b938c" }}>Always on</span>
        ) : (
          <span style={{ display: "grid", placeItems: "center", transition: "transform .18s", transform: isOpen ? "rotate(-90deg)" : "rotate(90deg)" }}>
            <WorkspaceIcon name="chevronRight" size={18} className="text-[#8b938c]" />
          </span>
        )}
      </button>
      {isOpen ? <div style={{ padding: "4px 14px 16px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</div> : null}
    </div>
  );
}

function MultiValue({
  rows,
  setRows,
  labels,
  placeholder,
  type,
  addText,
}: {
  rows: ValueRow[];
  setRows: (r: ValueRow[]) => void;
  labels: string[];
  placeholder: string;
  type: string;
  addText: string;
}) {
  return (
    <>
      {rows.map((row, i) => (
        <div key={i} style={{ display: "flex", gap: 8 }}>
          <select
            value={row.label}
            onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, label: e.target.value } : r)))}
            style={{ ...LABEL_SELECT, width: 96 }}
          >
            {labels.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <input
            type={type}
            inputMode={type === "tel" ? "tel" : type === "email" ? "email" : undefined}
            value={row.value}
            placeholder={placeholder}
            onChange={(e) => setRows(rows.map((r, idx) => (idx === i ? { ...r, value: e.target.value } : r)))}
            style={INPUT}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => setRows([...rows, { label: labels[0]!, value: "" }])}
        style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, border: "none", background: "transparent", color: "#4158f4", fontSize: 14, fontWeight: 600, padding: 0, cursor: "pointer" }}
      >
        <WorkspaceIcon name="plus" size={17} strokeWidth={2} className="text-[#4158f4]" />
        {addText}
      </button>
    </>
  );
}

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
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  const [open, setOpen] = useState<Record<string, boolean>>({ phones: true, emails: true });
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }));

  const [first, setFirst] = useState(initial?.firstName ?? "");
  const [last, setLast] = useState(initial?.lastName ?? "");
  const [company, setCompany] = useState(initial?.company ?? "");
  const [phones, setPhones] = useState<ValueRow[]>(
    initial?.phones?.length ? initial.phones : [{ label: "Mobile", value: "" }],
  );
  const [emails, setEmails] = useState<ValueRow[]>(
    initial?.emails?.length ? initial.emails : [{ label: "Home", value: "" }],
  );
  const [addrLabel, setAddrLabel] = useState(initial?.addressLabel ?? "Home");
  const [street, setStreet] = useState(initial?.street ?? "");
  const [city, setCity] = useState(initial?.city ?? "");
  const [postcode, setPostcode] = useState(initial?.postcode ?? "");
  const [country, setCountry] = useState(initial?.country ?? "");
  const [birthday, setBirthday] = useState(initial?.birthday ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const canSave = Boolean(first.trim() || last.trim() || company.trim());

  const handleSave = () => {
    if (!canSave) {
      setError("Enter a first or last name, or a company.");
      return;
    }
    setError(null);
    const fd = new FormData();
    const set = (k: string, v: string) => v.trim() && fd.set(k, v.trim());
    set("firstName", first);
    set("lastName", last);
    set("company", company);
    set("phone", phones[0]?.value ?? "");
    set("phoneLabel", phones[0]?.label ?? "");
    set("secondaryPhone", phones[1]?.value ?? "");
    set("secondaryPhoneLabel", phones[1]?.label ?? "");
    set("additionalPhones", joinExtra(phones, 2));
    set("email", emails[0]?.value ?? "");
    set("emailLabel", emails[0]?.label ?? "");
    set("secondaryEmail", emails[1]?.value ?? "");
    set("secondaryEmailLabel", emails[1]?.label ?? "");
    set("additionalEmails", joinExtra(emails, 2));
    set("address", street);
    set("addressLabel", addrLabel);
    set("cityOrTown", city);
    set("postcode", postcode);
    set("countryOrRegion", country);
    set("birthday", birthday);
    set("notes", notes);
    if (isEdit && initial) fd.set("contactId", initial.id);
    if (!isEdit && target) fd.set("target", target);

    startTransition(async () => {
      try {
        if (isEdit) {
          await updateContact(fd);
        } else {
          await createContact(fd);
        }
        // actions redirect on success; if no throw, refresh + close
        onClose();
        router.refresh();
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("NEXT_REDIRECT")) {
          onClose();
          router.refresh();
        } else {
          setError(msg || "Something went wrong. Please try again.");
        }
      }
    });
  };

  // reset the firstRender guard whenever the sheet reopens
  if (!isOpen) firstRender.current = true;

  const footer = (
    <button
      type="button"
      disabled={isPending || !canSave}
      onClick={handleSave}
      style={{
        width: "100%",
        height: 48,
        borderRadius: 12,
        border: "none",
        background: isPending || !canSave ? "#aeb4ac" : "#17352e",
        color: "#fff",
        fontSize: 16,
        fontWeight: 700,
        cursor: isPending || !canSave ? "not-allowed" : "pointer",
      }}
    >
      {isPending ? "Saving…" : isEdit ? "Save changes" : "Save contact"}
    </button>
  );

  return (
    <MobileBottomSheet isOpen={isOpen} onClose={onClose} title={isEdit ? "Edit contact" : "New contact"} footer={footer}>
      <Section id="basic" title="Basic Info" locked open onToggle={toggle}>
        <div>
          <label style={LABEL}>First name</label>
          <input autoFocus={!isEdit} value={first} onChange={(e) => setFirst(e.target.value)} placeholder="Jane" style={INPUT} />
        </div>
        <div>
          <label style={LABEL}>Last name</label>
          <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Smith" style={INPUT} />
        </div>
        <div>
          <label style={LABEL}>Company</label>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Corp" style={INPUT} />
        </div>
      </Section>

      <Section id="phones" title="Phone numbers" open={open.phones ?? false} onToggle={toggle}>
        <MultiValue rows={phones} setRows={setPhones} labels={PHONE_LABELS} placeholder="Phone" type="tel" addText="Add phone number" />
      </Section>

      <Section id="emails" title="Email addresses" open={open.emails ?? false} onToggle={toggle}>
        <MultiValue rows={emails} setRows={setEmails} labels={EMAIL_LABELS} placeholder="Email" type="email" addText="Add email address" />
      </Section>

      <Section id="address" title="Address" open={open.address ?? false} onToggle={toggle}>
        <input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" style={INPUT} />
        <div style={{ display: "flex", gap: 8 }}>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" style={INPUT} />
          <input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" style={INPUT} />
        </div>
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Country" style={INPUT} />
      </Section>

      <Section id="more" title="More — birthday, notes" open={open.more ?? false} onToggle={toggle}>
        <div>
          <label style={LABEL}>Birthday</label>
          <input type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} style={INPUT} />
        </div>
        <div>
          <label style={LABEL}>Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes…" style={{ ...INPUT, minHeight: 80, padding: "12px 14px", resize: "vertical" }} />
        </div>
      </Section>

      {error ? <p style={{ fontSize: 13, color: "#b5472f", margin: "0 2px 4px" }}>{error}</p> : null}

      <p style={{ textAlign: "center", fontSize: 13, color: "#8b938c", margin: "4px 0 0" }}>
        Need every field?{" "}
        <Link href={isEdit && initial ? `/contacts/${initial.id}?full=1` : "/contacts/new?full=1"} style={{ color: "#4158f4", fontWeight: 600, textDecoration: "none" }}>
          Open full form
        </Link>
      </p>
    </MobileBottomSheet>
  );
}

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { createContact } from "~/app/actions/contacts";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

type ValueRow = { label: string; value: string };
type RelatedRow = { relationship: string; name: string };
type DateRow = { label: string; date: string };

const EMAIL_LABELS = ["Home", "Work", "iCloud", "Other"];
const PHONE_LABELS = ["Mobile", "Home", "Work", "Main", "iPhone", "Other"];
const WEB_LABELS = ["Homepage", "Work", "Other"];
const ADDR_LABELS = ["Home", "Work", "Other"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FIELD =
  "w-full rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 py-2.5 text-sm text-[#1d2823] outline-none transition placeholder:text-[#aeb4ac] focus:border-[#4158f4]";
const LABEL_SELECT =
  "rounded-[0.7rem] border border-[#d8ddd6] bg-[#f6f7f4] px-2.5 py-2.5 text-xs font-semibold text-[#5c655e] outline-none focus:border-[#4158f4]";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .map((p) => p.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

const joinExtra = (rows: ValueRow[], from: number) =>
  rows.slice(from).map((r) => r.value.trim()).filter(Boolean).join("\n");

const linePairs = (rows: Array<[string, string]>) =>
  rows
    .filter(([a, b]) => a.trim() && b.trim())
    .map(([a, b]) => `${a.trim()}|${b.trim()}`)
    .join("\n");

function Group({ icon, children }: { icon?: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <div className="flex w-7 shrink-0 justify-center pt-2.5 text-[#8b938c]">
        {icon ? <WorkspaceIcon name={icon} size={18} /> : null}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">{children}</div>
    </div>
  );
}

function MultiValue({
  rows,
  setRows,
  labels,
  type,
  placeholder,
  addText,
}: {
  rows: ValueRow[];
  setRows: (rows: ValueRow[]) => void;
  labels: string[];
  type: string;
  placeholder: string;
  addText: string;
}) {
  const update = (i: number, patch: Partial<ValueRow>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  return (
    <div className="grid gap-2">
      {rows.map((row, i) => (
        <div className="flex items-center gap-2" key={i}>
          <select
            className={LABEL_SELECT}
            onChange={(e) => update(i, { label: e.target.value })}
            value={labels.includes(row.label) ? row.label : labels[0]}
          >
            {labels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          <input
            className={FIELD}
            onChange={(e) => update(i, { value: e.target.value })}
            placeholder={placeholder}
            type={type}
            value={row.value}
          />
          {rows.length > 1 ? (
            <button
              aria-label="Remove"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#8b938c] transition hover:bg-[#f2f4f0] hover:text-[#b5472f]"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              type="button"
            >
              ✕
            </button>
          ) : null}
        </div>
      ))}
      <button
        className="justify-self-start text-[13px] font-semibold text-[#4158f4]"
        onClick={() => setRows([...rows, { label: labels[0]!, value: "" }])}
        type="button"
      >
        + {addText}
      </button>
    </div>
  );
}

export function CreateContactForm({ familyBookName }: { familyBookName?: string | null }) {
  const [mode, setMode] = useState<"person" | "org">("person");
  const [showMore, setShowMore] = useState(false);
  const [target, setTarget] = useState<"private" | "family">("private");

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [middle, setMiddle] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneticFirst, setPhoneticFirst] = useState("");
  const [phoneticLast, setPhoneticLast] = useState("");

  const [company, setCompany] = useState("");
  const [phoneticCompany, setPhoneticCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");

  const [emails, setEmails] = useState<ValueRow[]>([{ label: "Home", value: "" }]);
  const [phones, setPhones] = useState<ValueRow[]>([{ label: "Mobile", value: "" }]);
  const [websites, setWebsites] = useState<ValueRow[]>([{ label: "Homepage", value: "" }]);

  const [addrLabel, setAddrLabel] = useState("Home");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("");

  const [bMonth, setBMonth] = useState("");
  const [bDay, setBDay] = useState("");
  const [bYear, setBYear] = useState("");

  const [notes, setNotes] = useState("");
  const [related, setRelated] = useState<RelatedRow[]>([{ relationship: "Spouse", name: "" }]);
  const [dates, setDates] = useState<DateRow[]>([{ label: "Anniversary", date: "" }]);
  const [customs, setCustoms] = useState<ValueRow[]>([{ label: "", value: "" }]);

  const displayName = mode === "org" ? company : [first, last].filter(Boolean).join(" ");
  const canSave = mode === "org" ? company.trim().length > 0 : Boolean(first.trim() || last.trim());

  const birthday = useMemo(() => {
    if (!bMonth || !bDay) return "";
    const mm = String(Number(bMonth)).padStart(2, "0");
    const dd = String(Number(bDay)).padStart(2, "0");
    return bYear ? `${bYear}-${mm}-${dd}` : `--${mm}-${dd}`;
  }, [bMonth, bDay, bYear]);

  // hidden-input values mapped to the createContact contract
  const hidden: Record<string, string> = {
    firstName: mode === "org" ? "" : first,
    middleName: mode === "org" ? "" : middle,
    lastName: mode === "org" ? "" : last,
    namePrefix: prefix,
    nameSuffix: suffix,
    nickname,
    phoneticFirstName: phoneticFirst,
    phoneticLastName: phoneticLast,
    company,
    phoneticCompany,
    jobTitle,
    email: emails[0]?.value ?? "",
    emailLabel: emails[0]?.label ?? "",
    secondaryEmail: emails[1]?.value ?? "",
    secondaryEmailLabel: emails[1]?.label ?? "",
    additionalEmails: joinExtra(emails, 2),
    phone: phones[0]?.value ?? "",
    phoneLabel: phones[0]?.label ?? "",
    secondaryPhone: phones[1]?.value ?? "",
    secondaryPhoneLabel: phones[1]?.label ?? "",
    additionalPhones: joinExtra(phones, 2),
    website: websites[0]?.value ?? "",
    websiteLabel: websites[0]?.label ?? "",
    secondaryWebsite: websites[1]?.value ?? "",
    secondaryWebsiteLabel: websites[1]?.label ?? "",
    additionalWebsites: joinExtra(websites, 2),
    address: street,
    addressLabel: addrLabel,
    cityOrTown: city,
    postcode,
    countryOrRegion: country,
    birthday,
    notes,
    relatedPeople: linePairs(related.map((r) => [r.relationship, r.name])),
    significantDates: linePairs(dates.map((d) => [d.label, d.date])),
    customFields: linePairs(customs.map((c) => [c.label, c.value])),
  };

  return (
    <div className="text-[#1d2823]">
      <form action={createContact}>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
        <input name="target" type="hidden" value={target} />

        {/* sticky action bar */}
        <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[#d8ddd6] bg-white/95 px-4 backdrop-blur lg:px-6">
          <Link className="text-sm font-semibold text-[#5c655e] transition hover:text-[#1d2823]" href="/">
            Cancel
          </Link>
          <span className="flex-1 text-center text-[15px] font-semibold text-[#1d2823]">
            {displayName.trim() || "New contact"}
          </span>
          <button
            className="rounded-[0.8rem] bg-[#4158f4] px-5 py-2 text-sm font-semibold text-white transition enabled:hover:bg-[#3248db] disabled:cursor-not-allowed disabled:bg-[#c7cdd6]"
            disabled={!canSave}
            type="submit"
          >
            Save contact
          </button>
        </div>

        <div className="mx-auto grid w-full max-w-[600px] gap-5 px-4 py-7 lg:px-0">
          {/* save-to target (Family plan members only) */}
          {familyBookName ? (
            <div className="flex items-center justify-center gap-2 text-[13px]">
              <span className="text-[#8b938c]">Save to</span>
              <div className="inline-flex rounded-[0.7rem] bg-[#f2f4f0] p-0.5 font-semibold">
                {(
                  [
                    ["private", "Private"],
                    ["family", familyBookName],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    className={`rounded-[0.55rem] px-3 py-1 transition ${
                      target === key ? "bg-white text-[#1d2823] shadow-sm" : "text-[#8b938c]"
                    }`}
                    key={key}
                    onClick={() => setTarget(key)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* avatar + person/org toggle */}
          <div className="flex flex-col items-center gap-3">
            <div className="grid h-20 w-20 place-items-center rounded-full bg-[#e7efe9] text-2xl font-semibold text-[#17352e]">
              {displayName.trim() ? initials(displayName) : "+"}
            </div>
            <div className="inline-flex rounded-[0.8rem] bg-[#f2f4f0] p-1 text-[13px] font-semibold">
              {(["person", "org"] as const).map((m) => (
                <button
                  className={`rounded-[0.6rem] px-3.5 py-1.5 transition ${
                    mode === m ? "bg-white text-[#1d2823] shadow-sm" : "text-[#8b938c]"
                  }`}
                  key={m}
                  onClick={() => setMode(m)}
                  type="button"
                >
                  {m === "person" ? "Person" : "Organisation"}
                </button>
              ))}
            </div>
          </div>

          {/* identity */}
          <Group icon="people">
            {mode === "org" ? (
              <input
                className={FIELD}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
                value={company}
              />
            ) : (
              <>
                <input className={FIELD} onChange={(e) => setFirst(e.target.value)} placeholder="First name" value={first} />
                <input className={FIELD} onChange={(e) => setLast(e.target.value)} placeholder="Surname" value={last} />
              </>
            )}
          </Group>

          {/* work */}
          {mode === "org" ? null : (
            <Group icon="archive">
              <input className={FIELD} onChange={(e) => setCompany(e.target.value)} placeholder="Company" value={company} />
              <input className={FIELD} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title" value={jobTitle} />
            </Group>
          )}

          {/* email */}
          <Group icon="bell">
            <MultiValue addText="Add email" labels={EMAIL_LABELS} placeholder="Email" rows={emails} setRows={setEmails} type="email" />
          </Group>

          {/* phone */}
          <Group icon="people">
            <MultiValue addText="Add phone" labels={PHONE_LABELS} placeholder="Phone" rows={phones} setRows={setPhones} type="tel" />
          </Group>

          {/* address */}
          <Group icon="archive">
            <select className={`${LABEL_SELECT} justify-self-start`} onChange={(e) => setAddrLabel(e.target.value)} value={addrLabel}>
              {ADDR_LABELS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <input className={FIELD} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" value={street} />
            <div className="grid grid-cols-2 gap-2">
              <input className={FIELD} onChange={(e) => setCity(e.target.value)} placeholder="City" value={city} />
              <input className={FIELD} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" value={postcode} />
            </div>
            <input className={FIELD} onChange={(e) => setCountry(e.target.value)} placeholder="Country" value={country} />
          </Group>

          {/* birthday */}
          <Group icon="star">
            <div className="grid grid-cols-3 gap-2">
              <select className={FIELD} onChange={(e) => setBMonth(e.target.value)} value={bMonth}>
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)}>{m}</option>
                ))}
              </select>
              <input className={FIELD} inputMode="numeric" onChange={(e) => setBDay(e.target.value)} placeholder="Day" value={bDay} />
              <input className={FIELD} inputMode="numeric" onChange={(e) => setBYear(e.target.value)} placeholder="Year (optional)" value={bYear} />
            </div>
          </Group>

          {/* notes */}
          <Group icon="more">
            <textarea
              className={`${FIELD} min-h-24 resize-y`}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this contact…"
              value={notes}
            />
          </Group>

          {/* show more toggle */}
          <button
            className="justify-self-start text-[13px] font-semibold text-[#4158f4]"
            onClick={() => setShowMore((v) => !v)}
            type="button"
          >
            {showMore ? "− Show less" : "+ Show more"}
          </button>

          {showMore ? (
            <div className="grid gap-5 border-t border-[#edf0ea] pt-5">
              {/* extended identity */}
              <Group icon="people">
                <div className="grid grid-cols-3 gap-2">
                  <input className={FIELD} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix" value={prefix} />
                  <input className={FIELD} onChange={(e) => setMiddle(e.target.value)} placeholder="Middle" value={middle} />
                  <input className={FIELD} onChange={(e) => setSuffix(e.target.value)} placeholder="Suffix" value={suffix} />
                </div>
                <input className={FIELD} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname" value={nickname} />
                <div className="grid grid-cols-2 gap-2">
                  <input className={FIELD} onChange={(e) => setPhoneticFirst(e.target.value)} placeholder="Phonetic first" value={phoneticFirst} />
                  <input className={FIELD} onChange={(e) => setPhoneticLast(e.target.value)} placeholder="Phonetic last" value={phoneticLast} />
                </div>
                <input className={FIELD} onChange={(e) => setPhoneticCompany(e.target.value)} placeholder="Phonetic company" value={phoneticCompany} />
              </Group>

              {/* websites */}
              <Group icon="upload">
                <MultiValue addText="Add website" labels={WEB_LABELS} placeholder="Website" rows={websites} setRows={setWebsites} type="url" />
              </Group>

              {/* related people */}
              <Group icon="people">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">Related people</p>
                {related.map((r, i) => (
                  <div className="flex items-center gap-2" key={i}>
                    <input className={`${LABEL_SELECT} w-28`} onChange={(e) => setRelated(related.map((x, idx) => (idx === i ? { ...x, relationship: e.target.value } : x)))} placeholder="Relation" value={r.relationship} />
                    <input className={FIELD} onChange={(e) => setRelated(related.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" value={r.name} />
                  </div>
                ))}
                <button className="justify-self-start text-[13px] font-semibold text-[#4158f4]" onClick={() => setRelated([...related, { relationship: "Other", name: "" }])} type="button">
                  + Add related person
                </button>
              </Group>

              {/* significant dates */}
              <Group icon="star">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">Significant dates</p>
                {dates.map((d, i) => (
                  <div className="flex items-center gap-2" key={i}>
                    <input className={`${LABEL_SELECT} w-28`} onChange={(e) => setDates(dates.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" value={d.label} />
                    <input className={FIELD} onChange={(e) => setDates(dates.map((x, idx) => (idx === i ? { ...x, date: e.target.value } : x)))} placeholder="YYYY-MM-DD" value={d.date} />
                  </div>
                ))}
                <button className="justify-self-start text-[13px] font-semibold text-[#4158f4]" onClick={() => setDates([...dates, { label: "Other", date: "" }])} type="button">
                  + Add date
                </button>
              </Group>

              {/* custom fields */}
              <Group icon="more">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">Custom fields</p>
                {customs.map((c, i) => (
                  <div className="flex items-center gap-2" key={i}>
                    <input className={`${LABEL_SELECT} w-28`} onChange={(e) => setCustoms(customs.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} placeholder="Label" value={c.label} />
                    <input className={FIELD} onChange={(e) => setCustoms(customs.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))} placeholder="Value" value={c.value} />
                  </div>
                ))}
                <button className="justify-self-start text-[13px] font-semibold text-[#4158f4]" onClick={() => setCustoms([...customs, { label: "", value: "" }])} type="button">
                  + Add custom field
                </button>
              </Group>
            </div>
          ) : null}
        </div>
      </form>
    </div>
  );
}

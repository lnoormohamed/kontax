"use client";

import Link from "next/link";
import { resolveAvatarSrc } from "~/lib/avatar-src";
import { useId, useMemo, useState } from "react";

import { createContact } from "~/app/actions/contacts";
import { AvatarUploadButton } from "~/app/_components/avatar-upload-button";
import { OfflineWriteNote } from "~/app/_components/connection-banner";
import { useOffline } from "~/app/_components/connectivity";
import { PhoneCountryInput } from "~/app/_components/phone-country-input";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import type { CardPrefillData } from "~/app/u/[username]/add-to-kontax";

type ValueRow = { label: string; value: string };
type RelatedRow = { relationship: string; name: string };
type DateRow = { label: string; date: string };

const EMAIL_LABELS = ["Home", "Work", "iCloud", "Other"];
const PHONE_LABELS = ["Mobile", "Home", "Work", "Main", "iPhone", "Other"];
const WEB_LABELS = ["Homepage", "Work", "Other"];
const ADDR_LABELS = ["Home", "Work", "Other"];
const DATE_LABELS = ["Anniversary", "Lunar birthday", "Other"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// P49A-17: text-[16px] (not text-sm/14px) below the sm breakpoint so tapping
// into a field on an iPhone doesn't trigger Safari's auto-zoom; sm: restores
// the original 14px on larger viewports.
const FIELD =
  "w-full rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 py-2.5 text-[16px] sm:text-sm text-[#1d2823] outline-none transition placeholder:text-[#aeb4ac] focus:border-[#4158f4]";
const LABEL_SELECT =
  "rounded-[0.7rem] border border-[#d8ddd6] bg-[#f6f7f4] px-2.5 py-2.5 text-[16px] sm:text-xs font-semibold text-[#5c655e] outline-none focus:border-[#4158f4]";
// Compact small-caps field label, matching the "Related people" /
// "Significant dates" section headers already used further down this form.
const FIELD_LABEL = "mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]";

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

// P49A-17: a compact, visible small-caps label above a single field — this
// form previously had none (placeholder text isn't an accessible name).
function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className={FIELD_LABEL} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
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
  fieldLabel,
}: {
  rows: ValueRow[];
  setRows: (rows: ValueRow[]) => void;
  labels: string[];
  type: string;
  placeholder: string;
  addText: string;
  /** Visible compact label above the group, e.g. "Email" or "Phone". */
  fieldLabel: string;
}) {
  const groupId = useId();
  const update = (i: number, patch: Partial<ValueRow>) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const isPhoneField = type === "tel";
  return (
    <div className="grid gap-2">
      <label className={FIELD_LABEL} htmlFor={`${groupId}-0`}>
        {fieldLabel}
      </label>
      {rows.map((row, i) => {
        const inputId = i === 0 ? `${groupId}-0` : undefined;
        // Row 0 gets the visible label above; later rows (2nd email, 2nd
        // phone, …) get an aria-label instead, so they're still named without
        // repeating the visible label for every row.
        const rowAriaLabel = i === 0 ? undefined : `${fieldLabel} ${i + 1}`;
        return (
          <div className="flex items-center gap-2" key={i}>
            <select
              aria-label={`${fieldLabel} type`}
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
            {isPhoneField ? (
              <PhoneCountryInput
                aria-label={rowAriaLabel}
                id={inputId}
                numberInputClassName="h-[42px] min-w-0 flex-1 border-none bg-white px-3 text-[16px] sm:text-sm text-[#1d2823] outline-none placeholder:text-[#aeb4ac]"
                onChange={(value) => update(i, { value })}
                placeholder={placeholder}
                value={row.value}
                wrapperClassName="min-w-0 flex-1"
              />
            ) : (
              <input
                aria-label={rowAriaLabel}
                className={FIELD}
                id={inputId}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder={placeholder}
                type={type}
                value={row.value}
              />
            )}
            {rows.length > 1 ? (
              <button
                aria-label={`Remove ${fieldLabel.toLowerCase()} ${i + 1}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#8b938c] transition hover:bg-[#f2f4f0] hover:text-[#b5472f]"
                onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
                type="button"
              >
                ✕
              </button>
            ) : null}
          </div>
        );
      })}
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

export function CreateContactForm({
  familyBookName,
  familyCanEdit = true,
  teamBooks = [],
  prefillParam,
}: {
  familyBookName?: string | null;
  familyCanEdit?: boolean;
  teamBooks?: { id: string; name: string }[];
  prefillParam?: string;
}) {
  const uid = useId();
  const fieldId = (name: string) => `${uid}-${name}`;

  // Decode card prefill once on mount (safe: user sees the form before saving)
  const prefill = useMemo<CardPrefillData | null>(() => {
    if (!prefillParam) return null;
    try {
      return JSON.parse(atob(prefillParam)) as CardPrefillData;
    } catch {
      return null;
    }
  }, [prefillParam]);

  const [prefillDismissed, setPrefillDismissed] = useState(false);

  const [mode, setMode] = useState<"person" | "org">("person");
  const [showMore, setShowMore] = useState(false);
  const [target, setTarget] = useState<string>("private");
  const [showAddress, setShowAddress] = useState(false);
  const [showBirthday, setShowBirthday] = useState(false);
  const [showNotes, setShowNotes] = useState(false);

  const [first, setFirst] = useState(prefill?.firstName ?? "");
  const [last, setLast] = useState(prefill?.lastName ?? "");
  const [middle, setMiddle] = useState("");
  const [prefix, setPrefix] = useState("");
  const [suffix, setSuffix] = useState("");
  const [nickname, setNickname] = useState("");
  const [phoneticFirst, setPhoneticFirst] = useState("");
  const [phoneticLast, setPhoneticLast] = useState("");

  const [company, setCompany] = useState(prefill?.company ?? "");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [phoneticCompany, setPhoneticCompany] = useState("");
  const [jobTitle, setJobTitle] = useState(prefill?.jobTitle ?? "");

  const [emails, setEmails] = useState<ValueRow[]>(
    prefill?.emails?.length ? prefill.emails : [{ label: "Home", value: "" }],
  );
  const [phones, setPhones] = useState<ValueRow[]>(
    prefill?.phones?.length ? prefill.phones : [{ label: "Mobile", value: "" }],
  );
  const [websites, setWebsites] = useState<ValueRow[]>(
    prefill?.websites?.length ? prefill.websites : [{ label: "Homepage", value: "" }],
  );

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

  // P42-DB01 Surface 2a: no offline mutation queue — Save is disabled offline
  // and re-enables on reconnect. The draft is held in the open form only.
  const offline = useOffline();
  const displayName = mode === "org" ? company : [first, last].filter(Boolean).join(" ");
  const canSave = (mode === "org" ? company.trim().length > 0 : Boolean(first.trim() || last.trim())) && !offline;

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
    avatarUrl,
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
      {/* Prefill banner */}
      {prefill && !prefillDismissed && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-800">
          <span className="flex-1">
            Pre-filled from{" "}
            <a
              href={`/u/${prefill.sourceCardUsername}`}
              className="font-semibold underline"
            >
              {[prefill.firstName, prefill.lastName].filter(Boolean).join(" ")}
            </a>
            &apos;s Kontax card
          </span>
          <button
            type="button"
            onClick={() => setPrefillDismissed(true)}
            className="text-amber-600 hover:text-amber-900"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      <form action={createContact}>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
        <input name="target" type="hidden" value={target} />
        {prefill?.sourceCardUsername && (
          <>
            <input name="sourceType" type="hidden" value="CARD_IMPORT" />
            <input name="sourceCardUsername" type="hidden" value={prefill.sourceCardUsername} />
          </>
        )}

        {/* sticky action bar */}
        <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-[#d8ddd6] bg-white/95 px-4 backdrop-blur lg:px-6">
          <Link className="text-sm font-semibold text-[#5c655e] transition hover:text-[#1d2823]" href="/contacts">
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
          {offline ? (
            <OfflineWriteNote
              title="Can’t save while offline."
              body="Keep this open — your edits stay here, and you can save once you’re back online."
            />
          ) : null}
          {/* save-to target (Family / Team members) */}
          {(familyBookName || teamBooks.length > 0) && !familyCanEdit ? (
            // View-only members can't add to the family book
            <div className="flex items-center justify-center gap-2 rounded-[10px] bg-[#f6f7f4] px-3.5 py-2.5 text-[13px] text-[#5c655e]">
              <WorkspaceIcon name="people" size={15} strokeWidth={1.7} className="shrink-0 text-[#8b938c]" />
              Saving to your <strong className="mx-0.5 font-semibold text-[#1d2823]">private</strong> contacts.
              View-only members can&apos;t add to the family book.
            </div>
          ) : familyBookName || teamBooks.length > 0 ? (
            <div className="flex flex-wrap items-center justify-center gap-2 text-[13px]">
              <span className="font-medium text-[#8b938c]">Save to</span>
              <div className="inline-flex flex-wrap rounded-[0.9rem] bg-[#f2f4f0] p-1 gap-1">
                {[
                  { key: "private", label: "Private", sub: "Only you" },
                  ...(familyBookName
                    ? [{ key: "family", label: familyBookName, sub: "Shared with family" }]
                    : []),
                  ...teamBooks.map((b) => ({ key: `team:${b.id}`, label: b.name, sub: "Team book" })),
                ].map(({ key, label, sub }) => (
                  <button
                    className={`flex flex-col items-center rounded-[0.65rem] px-3.5 py-1.5 transition leading-tight ${
                      target === key
                        ? "bg-white text-[#1d2823] shadow-sm"
                        : "text-[#8b938c] hover:text-[#5c655e]"
                    }`}
                    key={key}
                    onClick={() => setTarget(key)}
                    type="button"
                  >
                    <span className="text-[13px] font-semibold">{label}</span>
                    <span className="text-[11px] font-normal opacity-80">{sub}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* avatar + person/org toggle */}
          <div className="flex flex-col items-center gap-3">
            {avatarUrl.trim() ? (
              // P48-12: next/image's Image Optimization API is intentionally
              // disabled repo-wide (images.unoptimized in next.config.js) —
              // plain <img> is the deliberate choice.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={displayName.trim() || "Contact photo"}
                className="h-20 w-20 rounded-full object-cover"
                src={resolveAvatarSrc(avatarUrl.trim()) ?? avatarUrl}
              />
            ) : (
              <div className="grid h-20 w-20 place-items-center rounded-full bg-[#e7efe9] text-2xl font-semibold text-[#17352e]">
                {displayName.trim() ? initials(displayName) : "+"}
              </div>
            )}
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
            <AvatarUploadButton
              currentUrl={avatarUrl.trim() || null}
              onUploaded={setAvatarUrl}
            />
            <Field className="w-full max-w-[320px]" htmlFor={fieldId("avatarUrl")} label="Photo URL">
              <input
                className={`${FIELD} text-center`}
                id={fieldId("avatarUrl")}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="…or paste a photo URL"
                type="url"
                value={avatarUrl}
              />
            </Field>
          </div>

          {/* identity */}
          <Group icon="people">
            {mode === "org" ? (
              <Field htmlFor={fieldId("companyName")} label="Company name">
                <input
                  className={FIELD}
                  id={fieldId("companyName")}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company name"
                  value={company}
                />
              </Field>
            ) : (
              <>
                <Field htmlFor={fieldId("first")} label="First name">
                  <input className={FIELD} id={fieldId("first")} onChange={(e) => setFirst(e.target.value)} placeholder="First name" value={first} />
                </Field>
                <Field htmlFor={fieldId("last")} label="Surname">
                  <input className={FIELD} id={fieldId("last")} onChange={(e) => setLast(e.target.value)} placeholder="Surname" value={last} />
                </Field>
              </>
            )}
          </Group>

          {/* work */}
          {mode === "org" ? null : (
            <Group icon="archive">
              <Field htmlFor={fieldId("company")} label="Company">
                <input className={FIELD} id={fieldId("company")} onChange={(e) => setCompany(e.target.value)} placeholder="Company" value={company} />
              </Field>
              <Field htmlFor={fieldId("jobTitle")} label="Job title">
                <input className={FIELD} id={fieldId("jobTitle")} onChange={(e) => setJobTitle(e.target.value)} placeholder="Job title" value={jobTitle} />
              </Field>
            </Group>
          )}

          {/* email */}
          <Group icon="bell">
            <MultiValue addText="Add email" fieldLabel="Email" labels={EMAIL_LABELS} placeholder="Email" rows={emails} setRows={setEmails} type="email" />
          </Group>

          {/* phone */}
          <Group icon="people">
            <MultiValue addText="Add phone" fieldLabel="Phone" labels={PHONE_LABELS} placeholder="Phone" rows={phones} setRows={setPhones} type="tel" />
          </Group>

          {/* address */}
          {showAddress ? (
            <Group icon="archive">
              <select aria-label="Address type" className={`${LABEL_SELECT} justify-self-start`} onChange={(e) => setAddrLabel(e.target.value)} value={addrLabel}>
                {ADDR_LABELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
              <Field htmlFor={fieldId("street")} label="Street address">
                <input className={FIELD} id={fieldId("street")} onChange={(e) => setStreet(e.target.value)} placeholder="Street address" value={street} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field htmlFor={fieldId("city")} label="City">
                  <input className={FIELD} id={fieldId("city")} onChange={(e) => setCity(e.target.value)} placeholder="City" value={city} />
                </Field>
                <Field htmlFor={fieldId("postcode")} label="Postcode">
                  <input className={FIELD} id={fieldId("postcode")} onChange={(e) => setPostcode(e.target.value)} placeholder="Postcode" value={postcode} />
                </Field>
              </div>
              <Field htmlFor={fieldId("country")} label="Country">
                <input className={FIELD} id={fieldId("country")} onChange={(e) => setCountry(e.target.value)} placeholder="Country" value={country} />
              </Field>
            </Group>
          ) : (
            <Group icon="archive">
              <button
                className="justify-self-start text-sm font-medium text-[#4158f4]"
                onClick={() => setShowAddress(true)}
                type="button"
              >
                + Add address
              </button>
            </Group>
          )}

          {/* birthday */}
          {showBirthday ? (
            <Group icon="star">
              <div className="grid grid-cols-3 gap-2">
                <Field htmlFor={fieldId("bMonth")} label="Month">
                  <select className={FIELD} id={fieldId("bMonth")} onChange={(e) => setBMonth(e.target.value)} value={bMonth}>
                    <option value="">Month</option>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1)}>{m}</option>
                    ))}
                  </select>
                </Field>
                <Field htmlFor={fieldId("bDay")} label="Day">
                  <input className={FIELD} id={fieldId("bDay")} inputMode="numeric" onChange={(e) => setBDay(e.target.value)} placeholder="Day" value={bDay} />
                </Field>
                <Field htmlFor={fieldId("bYear")} label="Year">
                  <input className={FIELD} id={fieldId("bYear")} inputMode="numeric" onChange={(e) => setBYear(e.target.value)} placeholder="Year (optional)" value={bYear} />
                </Field>
              </div>
            </Group>
          ) : (
            <Group icon="star">
              <button
                className="justify-self-start text-sm font-medium text-[#4158f4]"
                onClick={() => setShowBirthday(true)}
                type="button"
              >
                + Add birthday
              </button>
            </Group>
          )}

          {/* notes */}
          {showNotes ? (
            <Group icon="more">
              <Field htmlFor={fieldId("notes")} label="Notes">
                <textarea
                  autoFocus
                  className={`${FIELD} min-h-24 resize-y`}
                  id={fieldId("notes")}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this contact…"
                  value={notes}
                />
              </Field>
            </Group>
          ) : (
            <Group icon="more">
              <button
                className="justify-self-start text-sm font-medium text-[#4158f4]"
                onClick={() => setShowNotes(true)}
                type="button"
              >
                + Add notes
              </button>
            </Group>
          )}

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
                  <Field htmlFor={fieldId("prefix")} label="Prefix">
                    <input className={FIELD} id={fieldId("prefix")} onChange={(e) => setPrefix(e.target.value)} placeholder="Prefix" value={prefix} />
                  </Field>
                  <Field htmlFor={fieldId("middle")} label="Middle">
                    <input className={FIELD} id={fieldId("middle")} onChange={(e) => setMiddle(e.target.value)} placeholder="Middle" value={middle} />
                  </Field>
                  <Field htmlFor={fieldId("suffix")} label="Suffix">
                    <input className={FIELD} id={fieldId("suffix")} onChange={(e) => setSuffix(e.target.value)} placeholder="Suffix" value={suffix} />
                  </Field>
                </div>
                <Field htmlFor={fieldId("nickname")} label="Nickname">
                  <input className={FIELD} id={fieldId("nickname")} onChange={(e) => setNickname(e.target.value)} placeholder="Nickname" value={nickname} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field htmlFor={fieldId("phoneticFirst")} label="Phonetic first">
                    <input className={FIELD} id={fieldId("phoneticFirst")} onChange={(e) => setPhoneticFirst(e.target.value)} placeholder="Phonetic first" value={phoneticFirst} />
                  </Field>
                  <Field htmlFor={fieldId("phoneticLast")} label="Phonetic last">
                    <input className={FIELD} id={fieldId("phoneticLast")} onChange={(e) => setPhoneticLast(e.target.value)} placeholder="Phonetic last" value={phoneticLast} />
                  </Field>
                </div>
                <Field htmlFor={fieldId("phoneticCompany")} label="Phonetic company">
                  <input className={FIELD} id={fieldId("phoneticCompany")} onChange={(e) => setPhoneticCompany(e.target.value)} placeholder="Phonetic company" value={phoneticCompany} />
                </Field>
              </Group>

              {/* websites */}
              <Group icon="upload">
                <MultiValue addText="Add website" fieldLabel="Website" labels={WEB_LABELS} placeholder="Website" rows={websites} setRows={setWebsites} type="url" />
              </Group>

              {/* related people */}
              <Group icon="people">
                <p className={FIELD_LABEL}>Related people</p>
                {related.map((r, i) => (
                  <div className="flex items-center gap-2" key={i}>
                    <input
                      aria-label={i === 0 ? "Relationship" : `Relationship ${i + 1}`}
                      className={`${LABEL_SELECT} w-28`}
                      onChange={(e) => setRelated(related.map((x, idx) => (idx === i ? { ...x, relationship: e.target.value } : x)))}
                      placeholder="Relation"
                      value={r.relationship}
                    />
                    <input
                      aria-label={i === 0 ? "Related person name" : `Related person name ${i + 1}`}
                      className={FIELD}
                      onChange={(e) => setRelated(related.map((x, idx) => (idx === i ? { ...x, name: e.target.value } : x)))}
                      placeholder="Name"
                      value={r.name}
                    />
                  </div>
                ))}
                <button className="justify-self-start text-[13px] font-semibold text-[#4158f4]" onClick={() => setRelated([...related, { relationship: "Other", name: "" }])} type="button">
                  + Add related person
                </button>
              </Group>

              {/* significant dates */}
              <Group icon="star">
                <p className={FIELD_LABEL}>Significant dates</p>
                {dates.map((d, i) => (
                  <div className="flex items-center gap-2" key={i}>
                    <input
                      aria-label={i === 0 ? "Date label" : `Date label ${i + 1}`}
                      className={`${LABEL_SELECT} w-28`}
                      list="contact-date-labels"
                      onChange={(e) => setDates(dates.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                      placeholder="Label"
                      value={d.label}
                    />
                    <input
                      aria-label={i === 0 ? "Date" : `Date ${i + 1}`}
                      className={FIELD}
                      onChange={(e) => setDates(dates.map((x, idx) => (idx === i ? { ...x, date: e.target.value } : x)))}
                      placeholder="YYYY-MM-DD"
                      value={d.date}
                    />
                  </div>
                ))}
                <datalist id="contact-date-labels">
                  {DATE_LABELS.map((label) => (
                    <option key={label} value={label} />
                  ))}
                </datalist>
                <button className="justify-self-start text-[13px] font-semibold text-[#4158f4]" onClick={() => setDates([...dates, { label: "Other", date: "" }])} type="button">
                  + Add date
                </button>
              </Group>

              {/* custom fields */}
              <Group icon="more">
                <p className={FIELD_LABEL}>Custom fields</p>
                {customs.map((c, i) => (
                  <div className="flex items-center gap-2" key={i}>
                    <input
                      aria-label={i === 0 ? "Custom field label" : `Custom field label ${i + 1}`}
                      className={`${LABEL_SELECT} w-28`}
                      onChange={(e) => setCustoms(customs.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))}
                      placeholder="Label"
                      value={c.label}
                    />
                    <input
                      aria-label={i === 0 ? "Custom field value" : `Custom field value ${i + 1}`}
                      className={FIELD}
                      onChange={(e) => setCustoms(customs.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                      placeholder="Value"
                      value={c.value}
                    />
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

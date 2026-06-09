"use client";

import { useMemo, useState } from "react";

import { mergeContacts } from "~/app/actions/contacts";

export type MergeReviewContact = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  notes: string | null;
};

export type MergeReviewUnions = {
  emails: string[];
  phones: string[];
  addresses: string[];
  websites: string[];
  labels: string[];
  dates: string[];
  related: string[];
  custom: string[];
};

type Side = "A" | "B";

type NotesChoice = Side | "combine";

type ScalarKey = "fullName" | "email" | "phone" | "company";

const SCALAR_FIELDS: Array<{ key: ScalarKey; label: string }> = [
  { key: "fullName", label: "Full name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
];

const UNION_FIELDS: Array<{ key: keyof MergeReviewUnions; label: string }> = [
  { key: "emails", label: "Email addresses" },
  { key: "phones", label: "Phone numbers" },
  { key: "addresses", label: "Addresses" },
  { key: "websites", label: "Websites" },
  { key: "labels", label: "Labels" },
  { key: "dates", label: "Significant dates" },
  { key: "related", label: "Related people" },
  { key: "custom", label: "Custom fields" },
];

const trimmed = (value: string | null | undefined) => value?.trim() ?? "";

type FieldStatus = "conflict" | "auto" | "match" | "empty";

const classify = (a: string, b: string): FieldStatus => {
  if (!a && !b) return "empty";
  if (a && b && a !== b) return "conflict";
  if (a === b) return "match";
  return "auto"; // exactly one side has a value
};

function FieldCard({
  label,
  valueA,
  valueB,
  labelA,
  labelB,
  selected,
  allowCombine,
  onSelect,
}: {
  label: string;
  valueA: string;
  valueB: string;
  labelA: string;
  labelB: string;
  selected: NotesChoice | undefined;
  allowCombine?: boolean;
  onSelect: (choice: NotesChoice) => void;
}) {
  const option = (choice: NotesChoice, heading: string, body: string) => {
    const active = selected === choice;
    return (
      <button
        className={`flex-1 rounded-[0.9rem] border px-3.5 py-3 text-left transition ${
          active
            ? "border-[#17352e] bg-[#17352e]/[0.06] ring-1 ring-[#17352e]"
            : "border-[#d8ddd6] bg-white hover:border-[#8b938c]"
        }`}
        onClick={() => onSelect(choice)}
        type="button"
      >
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">
          {heading}
        </span>
        <span className="mt-1 block whitespace-pre-wrap break-words text-[13.5px] text-[#1d2823]">
          {body || "—"}
        </span>
      </button>
    );
  };

  return (
    <div className="rounded-[1.1rem] border border-[#e3a90f]/30 bg-[#f6edd9]/40 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#1d2823]">{label}</span>
        <span className="rounded-full bg-[#f3e1da] px-2.5 py-0.5 text-[11px] font-semibold text-[#7a2f1d]">
          {selected ? "Resolved" : "Choose one"}
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
        {option("A", labelA, valueA)}
        {option("B", labelB, valueB)}
      </div>
      {allowCombine ? (
        <button
          className={`mt-2.5 w-full rounded-[0.9rem] border px-3.5 py-2.5 text-left text-[13px] transition ${
            selected === "combine"
              ? "border-[#17352e] bg-[#17352e]/[0.06] ring-1 ring-[#17352e] text-[#1d2823]"
              : "border-[#d8ddd6] bg-white text-[#5c655e] hover:border-[#8b938c]"
          }`}
          onClick={() => onSelect("combine")}
          type="button"
        >
          <span className="font-semibold text-[#1d2823]">Keep both</span> — combine the notes from
          both contacts
        </button>
      ) : null}
    </div>
  );
}

export function MergeReview({
  contactA,
  contactB,
  unionsA,
  unionsB,
  suggestionId,
  mergeSource,
}: {
  contactA: MergeReviewContact;
  contactB: MergeReviewContact;
  unionsA: MergeReviewUnions;
  unionsB: MergeReviewUnions;
  suggestionId: string;
  mergeSource: string;
}) {
  const [survivor, setSurvivor] = useState<Side>("A");
  const [scalarChoices, setScalarChoices] = useState<Partial<Record<ScalarKey, Side>>>({});
  const [notesChoice, setNotesChoice] = useState<NotesChoice | undefined>(undefined);
  const [showMatching, setShowMatching] = useState(false);

  const labelA = `${contactA.fullName || "Contact A"}`;
  const labelB = `${contactB.fullName || "Contact B"}`;

  // Classify each governed field so identical fields collapse and only real
  // conflicts demand a decision.
  const scalarRows = useMemo(
    () =>
      SCALAR_FIELDS.map((field) => {
        const a = trimmed(contactA[field.key]);
        const b = trimmed(contactB[field.key]);
        return { ...field, a, b, status: classify(a, b) };
      }),
    [contactA, contactB],
  );

  const notesA = trimmed(contactA.notes);
  const notesB = trimmed(contactB.notes);
  const notesStatus = classify(notesA, notesB);

  const scalarConflicts = scalarRows.filter((row) => row.status === "conflict");
  const autoFilled = scalarRows.filter((row) => row.status === "auto");
  const matching = scalarRows.filter((row) => row.status === "match");
  if (notesStatus === "auto") {
    autoFilled.push({ key: "fullName", label: "Notes", a: notesA, b: notesB, status: "auto" });
  }
  if (notesStatus === "match" && notesA) {
    matching.push({ key: "fullName", label: "Notes", a: notesA, b: notesB, status: "match" });
  }

  const unresolved =
    scalarConflicts.filter((row) => !scalarChoices[row.key]).length +
    (notesStatus === "conflict" && !notesChoice ? 1 : 0);
  const ready = unresolved === 0;

  const survivorContact = survivor === "A" ? contactA : contactB;
  const otherContact = survivor === "A" ? contactB : contactA;
  const unions = survivor === "A" ? unionsA : unionsB;

  // Translate contact-relative (A/B) choices into primary/secondary for the
  // server action, where primary === the survivor.
  const toPrimarySecondary = (choice: Side) =>
    choice === survivor ? "primary" : "secondary";

  const activeUnions = UNION_FIELDS.map((field) => ({
    ...field,
    values: unions[field.key],
  })).filter((field) => field.values.length > 1);

  return (
    <form action={mergeContacts} className="grid gap-5">
      <input name="primaryContactId" type="hidden" value={survivorContact.id} />
      <input name="secondaryContactId" type="hidden" value={otherContact.id} />
      <input name="suggestionId" type="hidden" value={suggestionId} />
      <input name="mergeSource" type="hidden" value={mergeSource} />
      <input name="redirectTo" type="hidden" value={`/contacts/${survivorContact.id}?saved=1`} />
      {scalarConflicts.map((row) =>
        scalarChoices[row.key] ? (
          <input
            key={`${row.key}-choice`}
            name={`${row.key}Choice`}
            type="hidden"
            value={toPrimarySecondary(scalarChoices[row.key]!)}
          />
        ) : null,
      )}
      {notesStatus === "conflict" && notesChoice ? (
        <input
          name="notesChoice"
          type="hidden"
          value={notesChoice === "combine" ? "combine" : toPrimarySecondary(notesChoice)}
        />
      ) : null}

      {/* survivor selection */}
      <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5">
        <p className="text-[13px] font-semibold text-[#1d2823]">Which record should survive?</p>
        <p className="mt-1 text-[13px] text-[#5c655e]">
          The other contact is archived after the merge — you can undo it for 30 days.
        </p>
        <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
          {(["A", "B"] as const).map((side) => {
            const contact = side === "A" ? contactA : contactB;
            const active = survivor === side;
            return (
              <button
                className={`flex-1 rounded-[1rem] border px-4 py-3 text-left transition ${
                  active
                    ? "border-[#17352e] bg-[#17352e]/[0.06] ring-1 ring-[#17352e]"
                    : "border-[#d8ddd6] bg-white hover:border-[#8b938c]"
                }`}
                key={side}
                onClick={() => setSurvivor(side)}
                type="button"
              >
                <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">
                  Keep as primary
                </span>
                <span className="mt-1 block text-[14px] font-semibold text-[#1d2823]">
                  {contact.fullName || `Contact ${side}`}
                </span>
                <span className="mt-0.5 block text-[12.5px] text-[#5c655e]">
                  {trimmed(contact.email) || trimmed(contact.phone) || "No identifier"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* conflicting fields */}
      {scalarConflicts.length > 0 || notesStatus === "conflict" ? (
        <div className="grid gap-3">
          <p className="text-[13px] font-semibold text-[#1d2823]">
            Resolve {scalarConflicts.length + (notesStatus === "conflict" ? 1 : 0)} conflicting{" "}
            {scalarConflicts.length + (notesStatus === "conflict" ? 1 : 0) === 1
              ? "field"
              : "fields"}
          </p>
          {scalarConflicts.map((row) => (
            <FieldCard
              key={row.key}
              label={row.label}
              labelA={labelA}
              labelB={labelB}
              onSelect={(choice) =>
                setScalarChoices((prev) => ({ ...prev, [row.key]: choice as Side }))
              }
              selected={scalarChoices[row.key]}
              valueA={row.a}
              valueB={row.b}
            />
          ))}
          {notesStatus === "conflict" ? (
            <FieldCard
              allowCombine
              label="Notes"
              labelA={labelA}
              labelB={labelB}
              onSelect={(choice) => setNotesChoice(choice)}
              selected={notesChoice}
              valueA={notesA}
              valueB={notesB}
            />
          ) : null}
        </div>
      ) : (
        <div className="rounded-[1.1rem] border border-[#cfe0d2] bg-[#eef5ef] px-4 py-3 text-[13px] text-[#17352e]">
          No conflicting fields — everything either matches or only one contact has a value.
        </div>
      )}

      {/* multi-value union (keep both) */}
      {activeUnions.length > 0 ? (
        <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5">
          <p className="text-[13px] font-semibold text-[#1d2823]">Kept from both contacts</p>
          <p className="mt-1 text-[13px] text-[#5c655e]">
            Multi-value fields are combined automatically — nothing is lost. Duplicates are removed.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {activeUnions.map((field) => (
              <div className="rounded-[0.9rem] border border-[#e4e8e1] bg-[#f7f9f6] p-3" key={field.key}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8b938c]">
                  {field.label} · {field.values.length}
                </span>
                <ul className="mt-1.5 grid gap-1">
                  {field.values.map((value, index) => (
                    <li className="break-words text-[13px] text-[#1d2823]" key={`${field.key}-${index}`}>
                      {value}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* auto-filled + matching summary */}
      {autoFilled.length > 0 || matching.length > 0 ? (
        <div className="rounded-[1.4rem] border border-[#d8ddd6] bg-white p-5">
          {autoFilled.length > 0 ? (
            <p className="text-[13px] text-[#5c655e]">
              <span className="font-semibold text-[#1d2823]">{autoFilled.length}</span>{" "}
              {autoFilled.length === 1 ? "field" : "fields"} filled automatically from whichever
              contact had a value ({autoFilled.map((row) => row.label).join(", ")}).
            </p>
          ) : null}
          {matching.length > 0 ? (
            <>
              <button
                className="mt-1 text-[13px] font-semibold text-[#4158f4]"
                onClick={() => setShowMatching((value) => !value)}
                type="button"
              >
                {showMatching ? "Hide" : "Show"} {matching.length} matching{" "}
                {matching.length === 1 ? "field" : "fields"}
              </button>
              {showMatching ? (
                <ul className="mt-2 grid gap-1">
                  {matching.map((row) => (
                    <li className="text-[13px] text-[#5c655e]" key={`match-${row.label}`}>
                      <span className="font-medium text-[#1d2823]">{row.label}:</span> {row.a}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {/* submit */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-[0.9rem] bg-[#17352e] px-5 py-2.5 text-[13px] font-semibold text-white transition enabled:hover:bg-[#20443b] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!ready}
          type="submit"
        >
          Merge into {survivorContact.fullName || `Contact ${survivor}`}
        </button>
        {!ready ? (
          <span className="text-[13px] text-[#7a2f1d]">
            Resolve {unresolved} more {unresolved === 1 ? "field" : "fields"} to continue.
          </span>
        ) : null}
      </div>
    </form>
  );
}

"use client";

import { useMemo, useRef, useState } from "react";

import { mergeContacts } from "~/app/actions/contacts";

// ── Public types (consumed by page.tsx) ──────────────────────────────────────
export type MergeReviewContact = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  jobTitle: string | null;
  nickname: string | null;
  website: string | null;
  birthday: string | null;
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

export type MergeContribution = {
  label: string;
  score: number;
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  ink: "#1d2823",
  ink2: "#5c655e",
  mute: "#8b938c",
  line: "#d8ddd6",
  line2: "#e9ece7",
  wash: "#f2f4f0",
  green: "#17352e",
  greenT: "#e7efe9",
  greenSoft: "#eef5ef",
  blue: "#4158f4",
  amber: "#bf8526",
  amberT: "rgba(191,133,38,0.10)",
  faint: "#c8cfc6",
} as const;

// ── Tiny primitives ───────────────────────────────────────────────────────────
function CheckRing({ on, size = 22 }: { on: boolean; size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        border: `2px solid ${on ? C.green : C.faint}`,
        background: on ? C.green : "#fff",
        transition: "all .12s ease",
      }}
    >
      {on && (
        <svg
          fill="none"
          height="11"
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2.4"
          viewBox="0 0 12 12"
          width="11"
        >
          <path d="M2.5 6.3l2.4 2.4L9.5 3.4" />
        </svg>
      )}
    </span>
  );
}

function Avatar({ name, size = 42 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: C.greenT,
        color: C.green,
        display: "grid",
        placeItems: "center",
        fontSize: size * 0.36,
        fontWeight: 600,
        flexShrink: 0,
        letterSpacing: "-0.01em",
      }}
    >
      {initials || "?"}
    </span>
  );
}

// ── Field classification helpers ──────────────────────────────────────────────
type FieldStatus = "conflict" | "auto" | "match" | "empty";

const trim = (v: string | null | undefined) => v?.trim() ?? "";

const classify = (a: string, b: string): FieldStatus => {
  if (!a && !b) return "empty";
  if (a && b && a !== b) return "conflict";
  if (a === b && a) return "match";
  return "auto";
};

const SCALAR_FIELDS = [
  { key: "fullName" as const, label: "Full name" },
  { key: "email" as const, label: "Email" },
  { key: "phone" as const, label: "Phone" },
  { key: "company" as const, label: "Company" },
  { key: "jobTitle" as const, label: "Job title" },
  { key: "nickname" as const, label: "Nickname" },
  { key: "website" as const, label: "Website" },
  { key: "birthday" as const, label: "Birthday" },
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

// ── Confidence pills ──────────────────────────────────────────────────────────
const CONFIDENCE_PILL: Record<string, { text: string; bg: string; fg: string }> = {
  high: { text: "High confidence", bg: "#eef5ef", fg: C.green },
  medium: { text: "Medium confidence", bg: "#f6edd9", fg: "#7a5a1a" },
  low: { text: "Low confidence", bg: "#eef0f3", fg: C.ink2 },
};

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <section
      className={className}
      style={{
        borderRadius: "1.4rem",
        border: `1px solid ${C.line}`,
        background: "#fff",
        boxShadow: "0 1px 2px rgba(20,30,25,0.03)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

// ── 1. Page header ────────────────────────────────────────────────────────────
function PageHeader({
  confidence,
  score,
}: {
  confidence: string;
  score: number;
}) {
  const pill = CONFIDENCE_PILL[confidence] ?? CONFIDENCE_PILL.low!;
  return (
    <div style={{ marginBottom: 2 }}>
      <h1
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-0.02em",
          lineHeight: 1.15,
          color: C.ink,
        }}
      >
        Review duplicate
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 11, flexWrap: "wrap" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 26,
            padding: "0 11px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            background: pill.bg,
            color: pill.fg,
            whiteSpace: "nowrap",
          }}
        >
          {pill.text}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 26,
            padding: "0 11px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            background: "#fff",
            color: C.ink2,
            border: `1px solid ${C.line}`,
            whiteSpace: "nowrap",
          }}
        >
          Score {score}
        </span>
      </div>
    </div>
  );
}

// ── 2. Why panel ──────────────────────────────────────────────────────────────
function WhyPanel({
  contributions,
  warnings,
  score,
}: {
  contributions: MergeContribution[];
  warnings: string[];
  score: number;
}) {
  if (contributions.length === 0 && warnings.length === 0) return null;
  return (
    <Card style={{ padding: "20px 22px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.mute,
          }}
        >
          Why this was suggested
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.green,
            background: C.greenT,
            padding: "3px 10px",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          Match score {score}
        </span>
      </div>

      <div style={{ display: "grid", gap: 2 }}>
        {contributions.map((c, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "9px 0",
              borderTop: i > 0 ? `1px solid ${C.line2}` : "none",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: C.green,
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.ink }}>
              {c.label}
            </span>
            {c.score > 0 && (
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: C.green,
                  background: C.greenT,
                  padding: "3px 9px",
                  borderRadius: 7,
                  minWidth: 44,
                  textAlign: "center",
                }}
              >
                +{c.score}
              </span>
            )}
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <>
          <div
            style={{ height: 1, background: C.line2, margin: "16px 0" }}
          />
          <div style={{ display: "grid", gap: 8 }}>
            {warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 9,
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  color: "#7a5512",
                  background: C.amberT,
                  border: "1px solid #ecdcb6",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <svg
                  fill="none"
                  height="16"
                  stroke={C.amber}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.8"
                  style={{ flexShrink: 0, marginTop: 1 }}
                  viewBox="0 0 24 24"
                  width="16"
                >
                  <path d="M12 4l9 16H3z" />
                  <path d="M12 10v4" />
                  <path d="M12 17h.01" />
                </svg>
                <span>{w}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── 3. Survivor selector ──────────────────────────────────────────────────────
function SurvivorBtn({
  contact,
  selected,
  onClick,
}: {
  contact: MergeReviewContact;
  selected: boolean;
  onClick: () => void;
}) {
  const sub = trim(contact.email) || trim(contact.phone) || "No identifier";
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        textAlign: "left",
        padding: "13px 14px",
        borderRadius: 12,
        border: `1.5px solid ${selected ? C.green : C.line}`,
        background: selected ? "#eef5ef" : "#fff",
        cursor: "pointer",
        boxShadow: selected ? "0 0 0 3px rgba(23,53,46,.07)" : "none",
        transition: "border-color .12s, background .12s, box-shadow .12s",
        flex: 1,
        minWidth: 0,
      }}
      type="button"
    >
      <Avatar name={contact.fullName || "?"} size={42} />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: C.ink,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {contact.fullName || "Unnamed contact"}
          </span>
          {selected && (
            <span
              style={{
                flexShrink: 0,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: C.green,
                background: C.greenT,
                padding: "2px 6px",
                borderRadius: 5,
              }}
            >
              Primary
            </span>
          )}
        </span>
        <span
          style={{
            fontSize: 12.5,
            color: C.ink2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {sub}
        </span>
      </span>
      <CheckRing on={selected} size={22} />
    </button>
  );
}

function SurvivorSelector({
  contactA,
  contactB,
  survivor,
  onPick,
}: {
  contactA: MergeReviewContact;
  contactB: MergeReviewContact;
  survivor: "A" | "B";
  onPick: (s: "A" | "B") => void;
}) {
  return (
    <Card style={{ padding: "20px 22px" }}>
      <h2
        style={{
          margin: 0,
          fontSize: 15.5,
          fontWeight: 600,
          letterSpacing: "-0.01em",
          color: C.ink,
        }}
      >
        Which record should survive?
      </h2>
      <p
        style={{ margin: "7px 0 0", fontSize: 13, lineHeight: 1.55, color: C.ink2 }}
      >
        The other contact is archived after the merge — you can undo it for 30 days.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          marginTop: 16,
        }}
      >
        <SurvivorBtn contact={contactA} selected={survivor === "A"} onClick={() => onPick("A")} />
        <SurvivorBtn contact={contactB} selected={survivor === "B"} onClick={() => onPick("B")} />
      </div>
    </Card>
  );
}

// ── 4. Conflict field cards ───────────────────────────────────────────────────
type ChoiceValue = "A" | "B" | "combine";

function FieldOption({
  caption,
  value,
  selected,
  full,
  onClick,
}: {
  caption: string;
  value: string;
  selected: boolean;
  full?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 7,
        textAlign: "left",
        padding: "11px 13px",
        borderRadius: 11,
        border: `1.5px solid ${selected ? C.green : C.line}`,
        background: selected ? "#eef5ef" : "#fff",
        cursor: "pointer",
        boxShadow: selected ? "0 0 0 3px rgba(23,53,46,.07)" : "none",
        transition: "border-color .12s, background .12s, box-shadow .12s",
        gridColumn: full ? "1 / -1" : undefined,
        marginTop: full ? 10 : undefined,
      }}
      type="button"
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase",
            color: selected ? C.green : C.mute,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {caption}
        </span>
        <CheckRing on={selected} size={18} />
      </span>
      <span
        style={{ fontSize: 13.5, lineHeight: 1.5, color: C.ink }}
      >
        {value || "—"}
      </span>
    </button>
  );
}

function ConflictCard({
  label,
  valueA,
  valueB,
  labelA,
  labelB,
  choice,
  allowCombine,
  onChoose,
}: {
  label: string;
  valueA: string;
  valueB: string;
  labelA: string;
  labelB: string;
  choice: ChoiceValue | undefined;
  allowCombine?: boolean;
  onChoose: (v: ChoiceValue) => void;
}) {
  const resolved = !!choice;
  return (
    <section
      style={{
        borderRadius: "1.4rem",
        border: "1px solid #ecdcb6",
        background: "#fbf7ee",
        padding: "16px 18px",
        boxShadow: "0 1px 2px rgba(20,30,25,0.03)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{label}</span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 23,
            padding: "0 9px",
            borderRadius: 7,
            background: "#f3e1da",
            color: "#7a2f1d",
            fontSize: 11,
            fontWeight: 700,
            whiteSpace: "nowrap",
          }}
        >
          {resolved ? (
            <>
              <svg
                fill="none"
                height="12"
                stroke="#7a2f1d"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.2"
                viewBox="0 0 12 12"
                width="12"
              >
                <path d="M2.5 6.3l2.4 2.4L9.5 3.4" />
              </svg>
              Resolved
            </>
          ) : (
            "Choose one"
          )}
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <FieldOption
          caption={labelA}
          onClick={() => onChoose("A")}
          selected={choice === "A"}
          value={valueA}
        />
        <FieldOption
          caption={labelB}
          onClick={() => onChoose("B")}
          selected={choice === "B"}
          value={valueB}
        />
      </div>
      {allowCombine && (
        <FieldOption
          caption="Keep both"
          full
          onClick={() => onChoose("combine")}
          selected={choice === "combine"}
          value="Combine the notes from both contacts into one."
        />
      )}
    </section>
  );
}

// ── 5. Union panel ────────────────────────────────────────────────────────────
function UnionPanel({
  unions,
  contactA,
  contactB,
}: {
  unions: MergeReviewUnions;
  contactA: MergeReviewContact;
  contactB: MergeReviewContact;
}) {
  // Build the displayable union fields: only those with 2+ merged values
  const aEmails = (contactA.email ? [contactA.email] : []);
  const bEmails = (contactB.email ? [contactB.email] : []);
  const aPhones = (contactA.phone ? [contactA.phone] : []);
  const bPhones = (contactB.phone ? [contactB.phone] : []);

  const activeFields = UNION_FIELDS.map((f) => ({
    ...f,
    values: unions[f.key],
    shared: f.key === "phones"
      ? unions.phones.filter((v) => aPhones.includes(v) && bPhones.includes(v))
      : f.key === "emails"
        ? unions.emails.filter((v) => aEmails.includes(v) && bEmails.includes(v))
        : [],
  })).filter((f) => f.values.length > 1);

  if (activeFields.length === 0) return null;

  return (
    <Card style={{ padding: "20px 22px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 14,
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: C.mute,
          }}
        >
          Kept from both contacts
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            fontWeight: 600,
            color: C.green,
          }}
        >
          <svg
            fill="none"
            height="14"
            stroke={C.green}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
            viewBox="0 0 24 24"
            width="14"
          >
            <path d="M7 4v6a5 5 0 005 5h5" />
            <path d="M17 4v6" />
            <path d="M14 12l3 3-3 3" />
            <path d="M7 4l-2 2" />
            <path d="M7 4l2 2" />
          </svg>
          Combined automatically
        </span>
      </div>
      <p
        style={{ margin: "0 0 16px", fontSize: 13, lineHeight: 1.55, color: C.ink2 }}
      >
        Multi-value fields are combined from both records — nothing is lost. Exact duplicates are
        removed.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {activeFields.map((f) => (
          <div
            key={f.key}
            style={{
              border: `1px solid ${C.line2}`,
              borderRadius: 11,
              background: "#fbfcf9",
              padding: "13px 14px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                marginBottom: 9,
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>
                {f.label}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: C.green,
                  background: C.greenT,
                  minWidth: 20,
                  height: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 6px",
                  borderRadius: 999,
                }}
              >
                {f.values.length}
              </span>
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
              {f.values.map((v, j) => {
                const isShared = f.shared.includes(v);
                return (
                  <li
                    key={j}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: C.faint,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12.5,
                        color: C.ink2,
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      {v}
                    </span>
                    {isShared && (
                      <span
                        style={{
                          flexShrink: 0,
                          fontSize: 9.5,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                          color: C.amber,
                          background: C.amberT,
                          padding: "1px 6px",
                          borderRadius: 5,
                        }}
                      >
                        shared
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── 6. Auto-filled + matching summary ────────────────────────────────────────
function SummaryPanel({
  autoFilled,
  matching,
}: {
  autoFilled: Array<{ label: string; from: "A" | "B" }>;
  matching: Array<{ label: string; value: string }>;
}) {
  const [open, setOpen] = useState(false);
  if (autoFilled.length === 0 && matching.length === 0) return null;
  const names = autoFilled.map((f) => f.label).join(", ");
  return (
    <Card style={{ padding: "18px 22px" }}>
      {autoFilled.length > 0 && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
          <span
            style={{
              width: 30,
              height: 30,
              flexShrink: 0,
              borderRadius: 8,
              background: C.wash,
              display: "grid",
              placeItems: "center",
            }}
          >
            <svg
              fill="none"
              height="16"
              stroke={C.ink2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="16"
            >
              <path d="M5 12.5l4.5 4.5L19 7" />
            </svg>
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: C.ink }}
            >
              {autoFilled.length} {autoFilled.length === 1 ? "field" : "fields"} filled
              automatically
            </span>
            <span
              style={{ display: "block", fontSize: 12.5, lineHeight: 1.5, color: C.ink2 }}
            >
              Only one contact had a value — kept as-is: {names}.
            </span>
          </div>
        </div>
      )}
      {matching.length > 0 && (
        <>
          {autoFilled.length > 0 && (
            <div
              style={{ height: 1, background: C.line2, margin: "14px 0" }}
            />
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              border: "none",
              background: "transparent",
              padding: 0,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: C.ink,
            }}
            type="button"
          >
            <svg
              fill="none"
              height="15"
              stroke={C.ink2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              style={{
                transition: "transform .15s ease",
                transform: open ? "rotate(90deg)" : "none",
              }}
              viewBox="0 0 24 24"
              width="15"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
            <span>
              {open ? "Hide" : "Show"} {matching.length} matching{" "}
              {matching.length === 1 ? "field" : "fields"}
            </span>
            <span
              style={{ fontSize: 12, fontWeight: 400, color: C.mute, marginLeft: "auto" }}
            >
              identical on both contacts
            </span>
          </button>
          {open && (
            <ul
              style={{ listStyle: "none", margin: "13px 0 0", padding: 0, display: "grid", gap: 1 }}
            >
              {matching.map((m, i) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "8px 2px",
                    borderTop: i > 0 ? `1px solid ${C.line2}` : "none",
                  }}
                >
                  <span style={{ fontSize: 12.5, color: C.mute }}>{m.label}</span>
                  <span
                    style={{ fontSize: 13, fontWeight: 500, color: C.ink, textAlign: "right" }}
                  >
                    {m.value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

// ── 7. Merge button (gated) ───────────────────────────────────────────────────
function MergeBar({
  survivorName,
  remaining,
  isPending,
}: {
  survivorName: string;
  remaining: number;
  isPending: boolean;
}) {
  const disabled = remaining > 0 || isPending;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        marginTop: 4,
      }}
    >
      <button
        className="mg-merge-btn"
        disabled={disabled}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          width: "100%",
          height: 52,
          border: "none",
          borderRadius: 13,
          background: C.green,
          color: "#fff",
          fontSize: 15,
          fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.45 : 1,
          transition: "background .15s, opacity .15s",
        }}
        type="submit"
      >
        {isPending ? (
          <>
            <svg
              style={{
                animation: "mg-spin .7s linear infinite",
                width: 16,
                height: 16,
                borderRadius: "50%",
                border: "2.2px solid rgba(255,255,255,.4)",
                borderTopColor: "#fff",
              }}
              viewBox="0 0 16 16"
            />
            Merging…
          </>
        ) : (
          <>
            <svg
              fill="none"
              height="17"
              stroke="#fff"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="17"
            >
              <path d="M7 4v6a5 5 0 005 5h5" />
              <path d="M17 4v6" />
              <path d="M14 12l3 3-3 3" />
              <path d="M7 4l-2 2" />
              <path d="M7 4l2 2" />
            </svg>
            Merge into {survivorName}
          </>
        )}
      </button>
      {remaining > 0 && !isPending && (
        <span style={{ fontSize: 12.5, color: C.ink2 }}>
          Resolve {remaining} more {remaining === 1 ? "field" : "fields"} to continue.
        </span>
      )}
    </div>
  );
}

// ── 8. Dismiss card ───────────────────────────────────────────────────────────
function DismissCard({ suggestionId }: { suggestionId: string }) {
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState("");

  const handleDismiss = async () => {
    setIsDismissing(true);
    setError("");
    const res = await fetch("/api/merge-suggestions/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suggestionId }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      setError(data?.message ?? "Dismiss failed.");
      setIsDismissing(false);
      return;
    }
    window.location.href = "/contacts?tab=duplicates";
  };

  return (
    <Card>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "16px 20px",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>
            Not a duplicate?
          </span>
          <span style={{ fontSize: 12.5, color: C.ink2 }}>
            Removes the pair from your review queue. Nothing is merged.
          </span>
          {error && (
            <span style={{ fontSize: 12, color: "#b5472f", marginTop: 2 }}>{error}</span>
          )}
        </div>
        <button
          disabled={isDismissing}
          onClick={handleDismiss}
          style={{
            flexShrink: 0,
            height: 38,
            padding: "0 16px",
            borderRadius: 9,
            border: `1px solid ${C.line}`,
            background: "#fff",
            color: C.ink,
            fontSize: 13,
            fontWeight: 600,
            cursor: isDismissing ? "not-allowed" : "pointer",
            opacity: isDismissing ? 0.55 : 1,
            transition: "background .12s, border-color .12s",
          }}
          type="button"
        >
          {isDismissing ? "Dismissing…" : "Dismiss suggestion"}
        </button>
      </div>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export type MergeReviewProps = {
  suggestionId: string;
  mergeSource: string;
  confidence: string;
  score: number;
  contributions: MergeContribution[];
  warnings: string[];
  contactA: MergeReviewContact;
  contactB: MergeReviewContact;
  unionsA: MergeReviewUnions;
  unionsB: MergeReviewUnions;
};

export function MergeReview({
  suggestionId,
  mergeSource,
  confidence,
  score,
  contributions,
  warnings,
  contactA,
  contactB,
  unionsA,
  unionsB,
}: MergeReviewProps) {
  const [survivor, setSurvivor] = useState<"A" | "B">("A");
  const [choices, setChoices] = useState<Record<string, ChoiceValue>>({});
  const [isPending, setIsPending] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const labelA = contactA.fullName || "Contact A";
  const labelB = contactB.fullName || "Contact B";
  const survivorContact = survivor === "A" ? contactA : contactB;
  const otherContact = survivor === "A" ? contactB : contactA;
  const activeUnions = survivor === "A" ? unionsA : unionsB;

  // Classify all scalar fields
  const scalarRows = useMemo(
    () =>
      SCALAR_FIELDS.map((f) => {
        const a = trim(contactA[f.key as keyof MergeReviewContact]);
        const b = trim(contactB[f.key as keyof MergeReviewContact]);
        return { ...f, a, b, status: classify(a, b) };
      }),
    [contactA, contactB],
  );

  const notesA = trim(contactA.notes);
  const notesB = trim(contactB.notes);
  const notesStatus = classify(notesA, notesB);

  const scalarConflicts = scalarRows.filter((r) => r.status === "conflict");
  const autoFilledRows = scalarRows.filter((r) => r.status === "auto").map((r) => ({
    label: r.label,
    from: r.a ? ("A" as const) : ("B" as const),
  }));
  if (notesStatus === "auto") {
    autoFilledRows.push({ label: "Notes", from: notesA ? "A" : "B" });
  }
  const matchingRows = scalarRows
    .filter((r) => r.status === "match")
    .map((r) => ({ label: r.label, value: r.a }));
  if (notesStatus === "match" && notesA) {
    matchingRows.push({ label: "Notes", value: notesA });
  }

  const unresolvedCount =
    scalarConflicts.filter((r) => !choices[r.key]).length +
    (notesStatus === "conflict" && !choices.notes ? 1 : 0);

  // Translate A/B choice into primary/secondary for the server action
  const toPS = (v: ChoiceValue) => {
    if (v === "combine") return "combine";
    return v === survivor ? "primary" : "secondary";
  };

  const handleSubmit = async (formData: FormData) => {
    setIsPending(true);
    await mergeContacts(formData);
  };

  return (
    <>
      <style>{`
        @keyframes mg-spin { to { transform: rotate(360deg); } }
        .mg-merge-btn:hover:not(:disabled) { background: #0f2620 !important; }
        @media (max-width: 640px) {
          .mg-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <PageHeader confidence={confidence} score={score} />

      <WhyPanel contributions={contributions} warnings={warnings} score={score} />

      <SurvivorSelector
        contactA={contactA}
        contactB={contactB}
        onPick={setSurvivor}
        survivor={survivor}
      />

      {/* Conflict section */}
      {scalarConflicts.length > 0 || notesStatus === "conflict" ? (
        <div style={{ display: "grid", gap: 11 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 15.5,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: C.ink,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <span>
              Resolve{" "}
              {scalarConflicts.length + (notesStatus === "conflict" ? 1 : 0)}{" "}
              conflicting{" "}
              {scalarConflicts.length + (notesStatus === "conflict" ? 1 : 0) === 1
                ? "field"
                : "fields"}
            </span>
            <span
              style={{ fontSize: 12, fontWeight: 600, color: C.amber, whiteSpace: "nowrap" }}
            >
              {unresolvedCount === 0 ? "All resolved" : `${unresolvedCount} left`}
            </span>
          </h2>
          {scalarConflicts.map((row) => (
            <ConflictCard
              choice={choices[row.key]}
              key={row.key}
              label={row.label}
              labelA={labelA}
              labelB={labelB}
              onChoose={(v) => setChoices((prev) => ({ ...prev, [row.key]: v }))}
              valueA={row.a}
              valueB={row.b}
            />
          ))}
          {notesStatus === "conflict" && (
            <ConflictCard
              allowCombine
              choice={choices.notes}
              label="Notes"
              labelA={labelA}
              labelB={labelB}
              onChoose={(v) => setChoices((prev) => ({ ...prev, notes: v }))}
              valueA={notesA}
              valueB={notesB}
            />
          )}
        </div>
      ) : (
        <Card style={{ padding: "20px 22px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 11, fontSize: 13, lineHeight: 1.55, color: C.ink2 }}>
            <span
              style={{
                width: 30,
                height: 30,
                flexShrink: 0,
                borderRadius: 8,
                background: C.greenT,
                display: "grid",
                placeItems: "center",
              }}
            >
              <svg fill="none" height="18" stroke={C.green} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="18">
                <path d="M5 12.5l4.5 4.5L19 7" />
              </svg>
            </span>
            No conflicting fields — everything either matches or only one contact has a value.
            You&apos;re clear to merge.
          </div>
        </Card>
      )}

      <UnionPanel contactA={contactA} contactB={contactB} unions={activeUnions} />
      <SummaryPanel autoFilled={autoFilledRows} matching={matchingRows} />

      {/* Form wraps the merge button */}
      <form action={handleSubmit} ref={formRef}>
        <input name="primaryContactId" type="hidden" value={survivorContact.id} />
        <input name="secondaryContactId" type="hidden" value={otherContact.id} />
        <input name="suggestionId" type="hidden" value={suggestionId} />
        <input name="mergeSource" type="hidden" value={mergeSource} />
        <input
          name="redirectTo"
          type="hidden"
          value={`/contacts/${survivorContact.id}?saved=1`}
        />
        {scalarConflicts.map((row) =>
          choices[row.key] ? (
            <input
              key={`${row.key}-choice`}
              name={`${row.key}Choice`}
              type="hidden"
              value={toPS(choices[row.key]!)}
            />
          ) : null,
        )}
        {notesStatus === "conflict" && choices.notes ? (
          <input name="notesChoice" type="hidden" value={toPS(choices.notes)} />
        ) : null}
        <MergeBar
          isPending={isPending}
          remaining={unresolvedCount}
          survivorName={survivorContact.fullName || "selected contact"}
        />
      </form>

      <DismissCard suggestionId={suggestionId} />
    </>
  );
}

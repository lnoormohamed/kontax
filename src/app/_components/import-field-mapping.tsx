"use client";

import { useState } from "react";

export type ApiColumnMapping = {
  header: string;
  index: number;
  field: string;
  confidence: number;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  source: "profile" | "classifier";
  sampleValues: string[];
};

export type ResolvedMapping = {
  index: number;
  targetField: string;
};

type MappedCol = ApiColumnMapping & { userOverride: string | null };

// Fields that may legitimately appear on multiple columns.
const MULTI_VALUE = new Set(["email", "phone"]);

// At least one of these must be mapped to proceed.
const REQUIRED = new Set(["firstName", "lastName", "fullName", "email"]);

const FIELD_LABEL: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  fullName: "Full name",
  email: "Email address",
  phone: "Phone",
  company: "Company",
  jobTitle: "Job title",
  "address.street": "Street address",
  "address.city": "City",
  "address.state": "State / Province",
  "address.postalCode": "Postal code",
  "address.country": "Country",
  birthday: "Birthday",
  website: "Website",
  notes: "Notes",
};

function ConfidenceDots({ tier }: { tier: "HIGH" | "MEDIUM" | "LOW" }) {
  const cfg = {
    HIGH: { fill: 3, color: "#1f8a5b", emptyBg: "#e9ece7", emptyBorder: "#d8ddd6" },
    MEDIUM: { fill: 2, color: "#bf8526", emptyBg: "#e9ece7", emptyBorder: "#d8ddd6" },
    LOW: { fill: 0, color: "#b5472f", emptyBg: "#fdecea", emptyBorder: "#fca5a5" },
  }[tier];

  return (
    <span className="inline-flex items-center gap-1" title={`Detection confidence: ${tier}`}>
      {[0, 1, 2].map((i) => {
        const filled = i < cfg.fill;
        return (
          <span
            key={i}
            className="inline-block h-2 w-2 rounded-full"
            style={
              filled
                ? { background: cfg.color }
                : { background: cfg.emptyBg, border: `1px solid ${cfg.emptyBorder}` }
            }
          />
        );
      })}
    </span>
  );
}

function MappingRow({
  col,
  dupField,
  onChange,
}: {
  col: MappedCol;
  dupField: boolean;
  onChange: (index: number, value: string) => void;
}) {
  const eff = col.userOverride ?? col.field;
  const isSkip = eff === "skip";
  const isUnmapped = eff === "custom";
  const isLow = col.confidenceTier === "LOW" && !col.userOverride;

  return (
    <div
      className="border-b border-[#f2f4f0] last:border-0"
      style={
        isLow
          ? { background: "#fff5f5", borderLeft: "3px solid #fca5a5", marginLeft: -3, paddingLeft: 3 }
          : undefined
      }
    >
      {/* Desktop grid */}
      <div className="hidden min-h-[52px] items-center gap-x-3.5 py-2 sm:grid sm:grid-cols-[1.7fr_1.9fr_2.5fr_0.9fr]">
        <span className="min-w-0 truncate text-[14px] font-semibold text-[#1d2823]">
          {col.header}
        </span>
        <span
          className="min-w-0 truncate font-mono text-[13px]"
          style={{
            color: isSkip ? "#d8ddd6" : "#5c655e",
            textDecoration: isSkip ? "line-through" : "none",
          }}
        >
          {col.sampleValues[0] ?? "—"}
        </span>
        <div className="min-w-0">
          <select
            className="w-full cursor-pointer appearance-none rounded-lg border bg-white px-2.5 py-0 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#4158f4]/20"
            onChange={(e) => onChange(col.index, e.target.value)}
            style={{
              height: 36,
              borderColor: dupField ? "#b5472f" : isLow && isUnmapped ? "#fca5a5" : "#d8ddd6",
              color: isSkip ? "#b5472f" : isUnmapped ? "#8b938c" : "#1d2823",
            }}
            value={eff}
          >
            <option disabled value="custom">
              Select field…
            </option>
            <option value="firstName">First name</option>
            <option value="lastName">Last name</option>
            <option value="fullName">Full name</option>
            <option disabled>────────</option>
            <option value="email">Email address</option>
            <option value="phone">Phone</option>
            <option disabled>────────</option>
            <option value="company">Company</option>
            <option value="jobTitle">Job title</option>
            <option disabled>────────</option>
            <option value="address.street">Street address</option>
            <option value="address.city">City</option>
            <option value="address.state">State / Province</option>
            <option value="address.postalCode">Postal code</option>
            <option value="address.country">Country</option>
            <option disabled>────────</option>
            <option value="birthday">Birthday</option>
            <option value="website">Website</option>
            <option value="notes">Notes</option>
            <option disabled>────────</option>
            <option value="skip">⊘ Skip this column</option>
          </select>
          {dupField ? (
            <div className="mt-1 text-[12px] text-[#b5472f]">
              Two columns map to &ldquo;{FIELD_LABEL[eff] ?? eff}&rdquo;. Change one.
            </div>
          ) : null}
        </div>
        <div>
          <ConfidenceDots tier={col.confidenceTier} />
        </div>
      </div>

      {/* Mobile stacked layout */}
      <div className="grid gap-1.5 py-3.5 sm:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[14px] font-semibold text-[#1d2823]">
            {col.header}
          </span>
          <ConfidenceDots tier={col.confidenceTier} />
        </div>
        {col.sampleValues[0] ? (
          <span
            className="font-mono text-[12px]"
            style={{
              color: isSkip ? "#d8ddd6" : "#8b938c",
              textDecoration: isSkip ? "line-through" : "none",
            }}
          >
            {col.sampleValues[0]}
          </span>
        ) : null}
        <select
          className="w-full cursor-pointer appearance-none rounded-lg border bg-white px-2.5 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#4158f4]/20"
          onChange={(e) => onChange(col.index, e.target.value)}
          style={{
            borderColor: dupField ? "#b5472f" : isLow && isUnmapped ? "#fca5a5" : "#d8ddd6",
            color: isSkip ? "#b5472f" : isUnmapped ? "#8b938c" : "#1d2823",
          }}
          value={eff}
        >
          <option disabled value="custom">
            Select field…
          </option>
          <option value="firstName">First name</option>
          <option value="lastName">Last name</option>
          <option value="fullName">Full name</option>
          <option disabled>────────</option>
          <option value="email">Email address</option>
          <option value="phone">Phone</option>
          <option disabled>────────</option>
          <option value="company">Company</option>
          <option value="jobTitle">Job title</option>
          <option disabled>────────</option>
          <option value="address.street">Street address</option>
          <option value="address.city">City</option>
          <option value="address.state">State / Province</option>
          <option value="address.postalCode">Postal code</option>
          <option value="address.country">Country</option>
          <option disabled>────────</option>
          <option value="birthday">Birthday</option>
          <option value="website">Website</option>
          <option value="notes">Notes</option>
          <option disabled>────────</option>
          <option value="skip">⊘ Skip this column</option>
        </select>
        {dupField ? (
          <div className="text-[12px] text-[#b5472f]">
            Two columns map to &ldquo;{FIELD_LABEL[eff] ?? eff}&rdquo;. Change one.
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FieldMappingStep({
  initialMappings,
  onBack,
  onContinue,
}: {
  initialMappings: ApiColumnMapping[];
  onBack: () => void;
  onContinue: (mappings: ResolvedMapping[]) => void;
}) {
  const [cols, setCols] = useState<MappedCol[]>(() =>
    initialMappings.map((m) => ({ ...m, userOverride: null })),
  );
  const [showAll, setShowAll] = useState(false);

  const isLargeFile = cols.length > 20;
  const visibleCols =
    isLargeFile && !showAll ? cols.filter((c) => c.confidenceTier !== "HIGH") : cols;
  const hiddenCount = cols.length - visibleCols.length;

  // Validation
  const allEffective = cols.map((c) => c.userOverride ?? c.field);
  const mappedFields = allEffective.filter((f) => f !== "skip" && f !== "custom");
  const hasRequired = mappedFields.some((f) => REQUIRED.has(f));

  const fieldCounts = new Map<string, number>();
  for (const f of mappedFields) {
    if (!MULTI_VALUE.has(f)) fieldCounts.set(f, (fieldCounts.get(f) ?? 0) + 1);
  }
  const duplicateFields = new Set(
    [...fieldCounts.entries()].filter(([, n]) => n > 1).map(([f]) => f),
  );

  const unmappedCount = allEffective.filter((f) => f === "custom").length;
  const blocked = !hasRequired;
  const canContinue = hasRequired && duplicateFields.size === 0;

  const handleChange = (index: number, value: string) => {
    setCols((prev) =>
      prev.map((c) => {
        if (c.index !== index) return c;
        // Reverting to the detected field clears the override.
        return { ...c, userOverride: value === c.field ? null : value };
      }),
    );
  };

  const handleContinue = () => {
    if (!canContinue) return;
    onContinue(cols.map((c) => ({ index: c.index, targetField: c.userOverride ?? c.field })));
  };

  return (
    <div className="grid gap-4">
      {/* Section label + unmapped count */}
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8b938c]">
          Map your columns
        </div>
        {unmappedCount > 0 && !blocked ? (
          <div className="text-[12px] text-[#b5472f]">
            {unmappedCount} column{unmappedCount !== 1 ? "s" : ""}{" "}
            {unmappedCount !== 1 ? "need" : "needs"} attention
          </div>
        ) : null}
      </div>

      {/* Table header (desktop only) */}
      <div className="hidden grid-cols-[1.7fr_1.9fr_2.5fr_0.9fr] gap-x-3.5 border-b border-[#e9ece7] pb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#8b938c] sm:grid">
        <span>Column</span>
        <span>Sample value</span>
        <span>Maps to</span>
        <span>Confidence</span>
      </div>

      {/* Large file: hidden HIGH-confidence rows toggle */}
      {isLargeFile && !showAll && hiddenCount > 0 ? (
        <button
          className="flex w-full items-center justify-center gap-2 border-b border-[#e9ece7] bg-[#fbfcf9] py-2.5 text-[13px] font-semibold text-[#4158f4] transition hover:bg-[#f2f4f0]"
          onClick={() => setShowAll(true)}
          type="button"
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1f8a5b]" />
          Show {hiddenCount} confident column{hiddenCount !== 1 ? "s" : ""} hidden
        </button>
      ) : null}

      {/* Mapping rows */}
      {visibleCols.map((col) => (
        <MappingRow
          col={col}
          dupField={
            !MULTI_VALUE.has(col.userOverride ?? col.field) &&
            duplicateFields.has(col.userOverride ?? col.field)
          }
          key={col.index}
          onChange={handleChange}
        />
      ))}

      {/* Collapse back */}
      {isLargeFile && showAll && hiddenCount > 0 ? (
        <button
          className="text-left text-[12.5px] font-semibold text-[#5c655e] transition hover:text-[#1d2823]"
          onClick={() => setShowAll(false)}
          type="button"
        >
          Hide {hiddenCount} confident column{hiddenCount !== 1 ? "s" : ""}
        </button>
      ) : null}

      {/* Hard block: no required field */}
      {blocked ? (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-[#fca5a5] bg-[#fff5f5] px-3.5 py-2.5 text-[13px] text-[#8a2d1a]">
          <svg
            fill="none"
            height={16}
            stroke="#b5472f"
            strokeLinecap="round"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
            width={16}
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12h8" />
          </svg>
          <span>
            Map a column to <b className="font-semibold">Name</b> or{" "}
            <b className="font-semibold">Email</b> to continue — Kontax needs at least one to
            identify each contact.
          </span>
        </div>
      ) : null}

      {/* Navigation */}
      <div className="flex flex-col-reverse gap-2.5 pt-0.5 sm:flex-row">
        <button
          className="h-11 rounded-[10px] border border-[#d8ddd6] bg-white px-[18px] text-[14.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
          onClick={onBack}
          type="button"
        >
          ← Back
        </button>
        <button
          className="h-11 flex-1 rounded-[10px] bg-[#4158f4] px-[18px] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canContinue}
          onClick={handleContinue}
          type="button"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}

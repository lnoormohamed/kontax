"use client";

import { useEffect, useRef, useState } from "react";

export type ApiColumnMapping = {
  header: string;
  index: number;
  field: string;
  confidence: number;
  confidenceTier: "HIGH" | "MEDIUM" | "LOW";
  source: "profile" | "classifier";
  sampleValues: string[];
  suggestions: Array<{ field: string; confidence: number; label: string }>;
};

export type ResolvedMapping = {
  index: number;
  targetField: string;
  customFieldKey?: string;
};

type MappedCol = ApiColumnMapping & {
  userOverride: string | null;
  customFieldKey: string;
  flash: boolean;
};

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

function sendFeedback(
  columnHeader: string,
  suggestedField: string,
  chosenField: string,
  sampleValue?: string,
) {
  void fetch("/api/imports/mapping-feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columnHeader, suggestedField, chosenField, sampleValue }),
  });
}

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

function CustomKeyInput({
  value,
  duplicate,
  onChange,
}: {
  value: string;
  duplicate: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mt-1.5 grid gap-1">
      <input
        className="w-full rounded-lg border px-2.5 py-1.5 text-[13px] text-[#1d2823] focus:outline-none focus:ring-2 focus:ring-[#4158f4]/20"
        maxLength={50}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Custom field name…"
        style={{ borderColor: duplicate ? "#b5472f" : "#d8ddd6" }}
        type="text"
        value={value}
      />
      {duplicate ? (
        <div className="text-[12px] text-[#b5472f]">Custom field name must be unique.</div>
      ) : (
        <div className="text-[12px] text-[#8b938c]">
          Values stored as &ldquo;{value.trim() || "…"}&rdquo; on each contact.
        </div>
      )}
    </div>
  );
}

function SuggestionChips({
  suggestions,
  onAccept,
}: {
  suggestions: Array<{ field: string; label: string; confidence: number }>;
  onAccept: (field: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  if (suggestions.length === 0) return null;

  const visible = expanded ? suggestions : suggestions.slice(0, 3);

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-[11.5px] font-medium text-[#8b938c]">Did you mean:</span>
      {visible.map((s) => (
        <button
          key={s.field}
          className="rounded-full border border-[#d8ddd6] bg-[#f2f4f0] px-3 py-1 text-[12.5px] font-medium text-[#5c655e] transition hover:bg-[#e3efe7] hover:text-[#17352e]"
          onClick={() => onAccept(s.field)}
          type="button"
        >
          {s.label}
        </button>
      ))}
      {suggestions.length > 3 && !expanded ? (
        <button
          className="rounded-full border border-[#d8ddd6] bg-[#f2f4f0] px-2.5 py-1 text-[12px] font-medium text-[#8b938c] transition hover:bg-[#e9ece7]"
          onClick={() => setExpanded(true)}
          type="button"
        >
          ›
        </button>
      ) : null}
    </div>
  );
}

function FieldSelect({
  value,
  dupField,
  borderColor,
  onChange,
}: {
  value: string;
  dupField: boolean;
  borderColor: string;
  onChange: (v: string) => void;
}) {
  const isSkip = value === "skip";
  const isUnmapped = value === "custom";
  const isCustomField = value === "customField";
  return (
    <select
      className="w-full cursor-pointer appearance-none rounded-lg border bg-white px-2.5 py-0 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#4158f4]/20"
      onChange={(e) => onChange(e.target.value)}
      style={{
        height: 36,
        borderColor: dupField ? "#b5472f" : borderColor,
        color: isSkip ? "#b5472f" : isUnmapped || isCustomField ? "#8b938c" : "#1d2823",
      }}
      value={value}
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
      <option value="customField">＋ Create custom field</option>
      <option value="skip">⊘ Skip this column</option>
    </select>
  );
}

function MappingRow({
  col,
  dupField,
  dupCustomKey,
  onChange,
  onCustomKeyChange,
  onChipAccept,
}: {
  col: MappedCol;
  dupField: boolean;
  dupCustomKey: boolean;
  onChange: (index: number, value: string) => void;
  onCustomKeyChange: (index: number, key: string) => void;
  onChipAccept: (index: number, field: string) => void;
}) {
  const eff = col.userOverride ?? col.field;
  const isSkip = eff === "skip";
  const isCustomField = eff === "customField";
  const isUnmapped = eff === "custom";
  const isLow = col.confidenceTier === "LOW" && !col.userOverride;
  const showChips =
    !isSkip && !isCustomField && col.confidenceTier !== "HIGH" && col.suggestions.length > 0;

  const borderColor = isLow && isUnmapped ? "#fca5a5" : "#d8ddd6";

  return (
    <div
      className="border-b border-[#f2f4f0] last:border-0 transition-colors duration-700"
      style={
        col.flash
          ? { background: "#e3efe7", borderLeft: "3px solid #1f8a5b", marginLeft: -3, paddingLeft: 3 }
          : isLow
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
          <FieldSelect
            borderColor={borderColor}
            dupField={dupField}
            onChange={(v) => onChange(col.index, v)}
            value={eff}
          />
          {isCustomField ? (
            <CustomKeyInput
              duplicate={dupCustomKey}
              onChange={(k) => onCustomKeyChange(col.index, k)}
              value={col.customFieldKey}
            />
          ) : null}
          {showChips ? (
            <SuggestionChips
              suggestions={col.suggestions}
              onAccept={(field) => onChipAccept(col.index, field)}
            />
          ) : null}
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
        <FieldSelect
          borderColor={borderColor}
          dupField={dupField}
          onChange={(v) => onChange(col.index, v)}
          value={eff}
        />
        {isCustomField ? (
          <CustomKeyInput
            duplicate={dupCustomKey}
            onChange={(k) => onCustomKeyChange(col.index, k)}
            value={col.customFieldKey}
          />
        ) : null}
        {showChips ? (
          <SuggestionChips
            suggestions={col.suggestions}
            onAccept={(field) => onChipAccept(col.index, field)}
          />
        ) : null}
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
    initialMappings.map((m) => ({
      ...m,
      userOverride: null,
      customFieldKey: m.header.slice(0, 50),
      flash: false,
    })),
  );
  const [showAll, setShowAll] = useState(false);
  const flashTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      for (const t of flashTimers.current.values()) clearTimeout(t);
    };
  }, []);

  const isLargeFile = cols.length > 20;
  const visibleCols =
    isLargeFile && !showAll ? cols.filter((c) => c.confidenceTier !== "HIGH") : cols;
  const hiddenCount = cols.length - visibleCols.length;

  const allEffective = cols.map((c) => c.userOverride ?? c.field);
  const mappedFields = allEffective.filter(
    (f) => f !== "skip" && f !== "custom" && f !== "customField",
  );
  const hasRequired = mappedFields.some((f) => REQUIRED.has(f));

  const fieldCounts = new Map<string, number>();
  for (const f of mappedFields) {
    if (!MULTI_VALUE.has(f)) fieldCounts.set(f, (fieldCounts.get(f) ?? 0) + 1);
  }
  const duplicateFields = new Set(
    [...fieldCounts.entries()].filter(([, n]) => n > 1).map(([f]) => f),
  );

  const customCols = cols.filter((c) => (c.userOverride ?? c.field) === "customField");
  const customKeyCount = new Map<string, number>();
  for (const c of customCols) {
    const k = c.customFieldKey.trim().toLowerCase();
    if (k) customKeyCount.set(k, (customKeyCount.get(k) ?? 0) + 1);
  }
  const duplicateCustomKeys = new Set(
    [...customKeyCount.entries()].filter(([, n]) => n > 1).map(([k]) => k),
  );

  const unmappedCount = allEffective.filter((f) => f === "custom").length;
  const blocked = !hasRequired;
  const canContinue =
    hasRequired &&
    duplicateFields.size === 0 &&
    duplicateCustomKeys.size === 0 &&
    customCols.every((c) => c.customFieldKey.trim().length > 0);

  const triggerFlash = (index: number) => {
    const existing = flashTimers.current.get(index);
    if (existing) clearTimeout(existing);
    setCols((prev) => prev.map((c) => (c.index === index ? { ...c, flash: true } : c)));
    const t = setTimeout(() => {
      setCols((prev) => prev.map((c) => (c.index === index ? { ...c, flash: false } : c)));
      flashTimers.current.delete(index);
    }, 800);
    flashTimers.current.set(index, t);
  };

  const handleChange = (index: number, value: string) => {
    setCols((prev) =>
      prev.map((c) => {
        if (c.index !== index) return c;
        return { ...c, userOverride: value === c.field ? null : value };
      }),
    );
  };

  const handleCustomKeyChange = (index: number, key: string) => {
    setCols((prev) => prev.map((c) => (c.index === index ? { ...c, customFieldKey: key } : c)));
  };

  const handleChipAccept = (index: number, field: string) => {
    const col = cols.find((c) => c.index === index);
    if (!col) return;
    const topSuggestion = col.suggestions[0]?.field;
    if (topSuggestion && field !== topSuggestion) {
      sendFeedback(col.header, topSuggestion, field, col.sampleValues[0]);
    }
    setCols((prev) =>
      prev.map((c) => {
        if (c.index !== index) return c;
        return { ...c, userOverride: field === c.field ? null : field };
      }),
    );
    triggerFlash(index);
  };

  const handleContinue = () => {
    if (!canContinue) return;
    onContinue(
      cols.map((c) => {
        const targetField = c.userOverride ?? c.field;
        return {
          index: c.index,
          targetField,
          customFieldKey:
            targetField === "customField" ? c.customFieldKey.trim() : undefined,
        };
      }),
    );
  };

  return (
    <div className="grid gap-4">
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

      <div className="hidden grid-cols-[1.7fr_1.9fr_2.5fr_0.9fr] gap-x-3.5 border-b border-[#e9ece7] pb-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#8b938c] sm:grid">
        <span>Column</span>
        <span>Sample value</span>
        <span>Maps to</span>
        <span>Confidence</span>
      </div>

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

      {visibleCols.map((col) => {
        const eff = col.userOverride ?? col.field;
        return (
          <MappingRow
            col={col}
            dupCustomKey={duplicateCustomKeys.has(col.customFieldKey.trim().toLowerCase())}
            dupField={
              !MULTI_VALUE.has(eff) && eff !== "customField" && duplicateFields.has(eff)
            }
            key={col.index}
            onChange={handleChange}
            onChipAccept={handleChipAccept}
            onCustomKeyChange={handleCustomKeyChange}
          />
        );
      })}

      {isLargeFile && showAll && hiddenCount > 0 ? (
        <button
          className="text-left text-[12.5px] font-semibold text-[#5c655e] transition hover:text-[#1d2823]"
          onClick={() => setShowAll(false)}
          type="button"
        >
          Hide {hiddenCount} confident column{hiddenCount !== 1 ? "s" : ""}
        </button>
      ) : null}

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

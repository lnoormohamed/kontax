"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEventHandler } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import {
  PHONE_COUNTRY_RULES_LIST,
  findPhoneCountryRuleByCallingCode,
  getPhoneCountryRule,
} from "~/lib/phone-country-rules";
import { normalizePhoneCandidate } from "~/lib/phone-normalization";

type PhoneCountryInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  wrapperClassName?: string;
  selectorClassName?: string;
  codeInputClassName?: string;
  numberInputClassName?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
};

type ParsedPhoneState = {
  iso2: string | null;
  code: string;
  number: string;
};

const COUNTRY_OPTIONS = [...PHONE_COUNTRY_RULES_LIST].sort((left, right) =>
  left.displayName.localeCompare(right.displayName),
);

const flagEmojiForIso2 = (iso2: string | null) => {
  if (!iso2 || iso2.length !== 2) return "🌐";
  return iso2
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
};

const normalizeCodeDraft = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (!digits) {
    return value.trim().startsWith("+") ? "+" : "";
  }
  return `+${digits}`;
};

const composePhoneValue = (code: string, number: string) => {
  const digits = code.replace(/\D/g, "");
  const trimmedNumber = number.trim();

  if (digits) {
    return trimmedNumber ? `+${digits} ${trimmedNumber}` : `+${digits}`;
  }

  return trimmedNumber;
};

const parsePhoneValue = (value: string): ParsedPhoneState => {
  const raw = value.trim();
  if (!raw) {
    return { iso2: null, code: "", number: "" };
  }

  const candidate = normalizePhoneCandidate(raw);
  const matchedRule = candidate.countryCode ? getPhoneCountryRule(candidate.countryCode) : null;

  if (matchedRule) {
    return {
      iso2: matchedRule.iso2,
      code: `+${matchedRule.callingCode}`,
      number: candidate.displayNational ?? candidate.national ?? raw,
    };
  }

  if (raw.startsWith("+")) {
    const match = raw.match(/^\+(\d{0,4})(.*)$/);
    const codeDigits = match?.[1] ?? "";
    const number = match?.[2]?.trim() ?? "";
    const fallbackRule = codeDigits ? findPhoneCountryRuleByCallingCode(codeDigits)?.rule ?? null : null;

    return {
      iso2: fallbackRule?.iso2 ?? null,
      code: codeDigits ? `+${codeDigits}` : "+",
      number,
    };
  }

  return {
    iso2: candidate.countryCode,
    code: candidate.callingCode ? `+${candidate.callingCode}` : "",
    number: candidate.displayNational ?? raw,
  };
};

export function PhoneCountryInput({
  value,
  onChange,
  autoFocus = false,
  placeholder = "Phone number",
  wrapperClassName,
  selectorClassName,
  codeInputClassName,
  numberInputClassName,
  onKeyDown,
}: PhoneCountryInputProps) {
  const [{ iso2, code, number }, setState] = useState<ParsedPhoneState>(() => parsePhoneValue(value));
  const [open, setOpen] = useState(false);
  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedValueRef = useRef<string | null>(null);

  useEffect(() => {
    if (value === lastEmittedValueRef.current) {
      return;
    }
    setState(parsePhoneValue(value));
  }, [value]);

  const selectedRule = useMemo(() => (iso2 ? getPhoneCountryRule(iso2) : null), [iso2]);
  const numberPlaceholder = useMemo(() => {
    const example = selectedRule?.examples?.mobile ?? selectedRule?.examples?.landline;
    if (!example || !selectedRule) {
      return placeholder;
    }
    return example.replace(new RegExp(`^\\+${selectedRule.callingCode}\\s*`), "").trim();
  }, [placeholder, selectedRule]);

  const emit = (next: ParsedPhoneState, normalize = false) => {
    const raw = composePhoneValue(next.code, next.number);
    const normalized = normalize ? normalizePhoneCandidate(raw) : null;
    const finalValue = normalized?.displayInternational ?? normalized?.value ?? raw;

    if (normalize) {
      setState(parsePhoneValue(finalValue));
    } else {
      setState(next);
    }

    lastEmittedValueRef.current = finalValue;
    onChange(finalValue);
  };

  const updateCode = (nextCode: string) => {
    const normalizedCode = normalizeCodeDraft(nextCode);
    const codeDigits = normalizedCode.replace(/\D/g, "");
    const rule =
      codeDigits && selectedRule?.callingCode === codeDigits
        ? selectedRule
        : codeDigits
          ? findPhoneCountryRuleByCallingCode(codeDigits)?.rule ?? null
          : null;

    emit(
      {
        iso2: rule?.iso2 ?? null,
        code: normalizedCode,
        number,
      },
      false,
    );
  };

  const updateNumber = (nextNumber: string) => {
    emit({ iso2, code, number: nextNumber }, false);
  };

  const selectCountry = (nextIso2: string) => {
    const rule = getPhoneCountryRule(nextIso2);
    if (!rule) return;
    setOpen(false);
    emit({ iso2: rule.iso2, code: `+${rule.callingCode}`, number }, false);
    requestAnimationFrame(() => {
      numberInputRef.current?.focus();
    });
  };

  return (
    <div
      className={wrapperClassName ?? "flex min-w-0 flex-1 items-center gap-2"}
      onBlur={(event) => {
        const nextTarget = event.relatedTarget as Node | null;
        if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
          emit({ iso2, code, number }, true);
          setOpen(false);
        }
      }}
    >
      <div className="relative shrink-0">
        <button
          aria-expanded={open}
          aria-haspopup="listbox"
          className={
            selectorClassName ??
            "flex h-[42px] items-center gap-2 rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 text-sm text-[#1d2823] transition hover:bg-[#f6f7f4]"
          }
          onClick={(event) => {
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          type="button"
        >
          <span className="text-[18px] leading-none">{flagEmojiForIso2(iso2)}</span>
          <WorkspaceIcon
            name={open ? "chevron-up" : "chevron-down"}
            size={14}
            strokeWidth={2}
          />
        </button>
        {open ? (
          <>
            <span
              className="fixed inset-0 z-30"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            />
            <div className="absolute left-0 top-[calc(100%+8px)] z-40 max-h-72 w-[320px] overflow-y-auto rounded-[14px] border border-[#d8ddd6] bg-white p-1.5 shadow-[0_16px_36px_rgba(20,30,25,0.16)]">
              {COUNTRY_OPTIONS.map((rule) => (
                <button
                  className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-sm text-[#1d2823] ${
                    rule.iso2 === iso2 ? "bg-[#eef3ff]" : "hover:bg-[#f6f7f4]"
                  }`}
                  key={rule.iso2}
                  onClick={(event) => {
                    event.stopPropagation();
                    selectCountry(rule.iso2);
                  }}
                  type="button"
                >
                  <span className="text-[18px] leading-none">{flagEmojiForIso2(rule.iso2)}</span>
                  <span className="min-w-0 flex-1 truncate">{rule.displayName}</span>
                  <span className="text-[#5c655e]">+{rule.callingCode}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </div>
      <input
        className={
          codeInputClassName ??
          "h-[42px] w-[88px] shrink-0 rounded-[0.7rem] border border-[#d8ddd6] bg-[#f6f7f4] px-3 text-sm font-semibold text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:bg-white"
        }
        inputMode="tel"
        onChange={(event) => updateCode(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        placeholder="+1"
        type="text"
        value={code}
      />
      <input
        autoFocus={autoFocus}
        className={
          numberInputClassName ??
          "h-[42px] min-w-0 flex-1 rounded-[0.7rem] border border-[#d8ddd6] bg-white px-3 text-sm text-[#1d2823] outline-none transition placeholder:text-[#aeb4ac] focus:border-[#4158f4]"
        }
        inputMode="tel"
        onChange={(event) => updateNumber(event.target.value)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        placeholder={numberPlaceholder}
        ref={numberInputRef}
        type="text"
        value={number}
      />
    </div>
  );
}

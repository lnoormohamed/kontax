"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEventHandler,
} from "react";
import { createPortal } from "react-dom";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import {
  PHONE_COUNTRY_RULES_LIST,
  getPhoneCountryRule,
} from "~/lib/phone-country-rules";
import {
  parsePhoneCountryInputValue,
  replacePhoneCallingCode,
} from "~/lib/phone-country-input-utils";
import { normalizePhoneCandidate } from "~/lib/phone-normalization";

type PhoneCountryInputProps = {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  wrapperClassName?: string;
  selectorClassName?: string;
  numberInputClassName?: string;
  onKeyDown?: KeyboardEventHandler<HTMLInputElement>;
};

const COUNTRY_OPTIONS = [...PHONE_COUNTRY_RULES_LIST].sort((left, right) =>
  left.displayName.localeCompare(right.displayName),
);

const flagEmojiForIso2 = (iso2: string | null) => {
  if (iso2?.length !== 2) return "🌐";
  return iso2
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
};

export function PhoneCountryInput({
  value,
  onChange,
  autoFocus = false,
  placeholder = "Phone number",
  wrapperClassName,
  selectorClassName,
  numberInputClassName,
  onKeyDown,
}: PhoneCountryInputProps) {
  const [{ iso2, value: draftValue }, setState] = useState(() =>
    parsePhoneCountryInputValue(value),
  );
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | null>(null);
  const [mounted, setMounted] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastEmittedValueRef = useRef<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (value === lastEmittedValueRef.current) {
      return;
    }
    setState(parsePhoneCountryInputValue(value));
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left: rect.left,
        width: 320,
        maxWidth: Math.max(260, window.innerWidth - rect.left - 16),
        zIndex: 2000,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const selectedRule = useMemo(() => (iso2 ? getPhoneCountryRule(iso2) : null), [iso2]);
  const inputPlaceholder = useMemo(() => {
    const example = selectedRule?.examples?.mobile ?? selectedRule?.examples?.landline;
    return example ?? placeholder;
  }, [placeholder, selectedRule]);

  const emit = (nextRawValue: string, normalize = false) => {
    const normalized = normalize ? normalizePhoneCandidate(nextRawValue) : null;
    const finalValue = normalized?.displayInternational ?? normalized?.value ?? nextRawValue;
    const nextState = parsePhoneCountryInputValue(finalValue);
    setState(nextState);
    lastEmittedValueRef.current = finalValue;
    onChange(finalValue);
  };

  const selectCountry = (nextIso2: string) => {
    const rule = getPhoneCountryRule(nextIso2);
    if (!rule) return;
    setOpen(false);
    emit(replacePhoneCallingCode(draftValue, rule.callingCode), false);
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(inputRef.current.value.length, inputRef.current.value.length);
    });
  };

  const menu =
    open && mounted && menuStyle
      ? createPortal(
          <>
            <span
              className="fixed inset-0 z-[1999]"
              onClick={(event) => {
                event.stopPropagation();
                setOpen(false);
              }}
            />
            <div
              className="max-h-72 overflow-y-auto rounded-[14px] border border-[#d8ddd6] bg-white p-1.5 shadow-[0_16px_36px_rgba(20,30,25,0.16)]"
              style={menuStyle}
            >
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
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        className={wrapperClassName ?? "flex min-w-0 flex-1 items-center"}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          if (!nextTarget || !rootRef.current?.contains(nextTarget)) {
            emit(draftValue, true);
            setOpen(false);
          }
        }}
        ref={rootRef}
      >
        <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-[0.7rem] border border-[#d8ddd6] bg-white focus-within:border-[#4158f4]">
          <button
            aria-expanded={open}
            aria-haspopup="listbox"
            className={
              selectorClassName ??
              "flex h-[42px] shrink-0 items-center gap-2 border-r border-[#d8ddd6] bg-[#f6f7f4] px-3 text-sm text-[#1d2823] transition hover:bg-[#eef2ec]"
            }
            onClick={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
            ref={triggerRef}
            type="button"
          >
            <span className="text-[18px] leading-none">{flagEmojiForIso2(iso2)}</span>
            <WorkspaceIcon
              name={open ? "chevron-up" : "chevron-down"}
              size={14}
              strokeWidth={2}
            />
          </button>
          <input
            autoFocus={autoFocus}
            className={
              numberInputClassName ??
              "h-[42px] min-w-0 flex-1 border-none bg-white px-3 text-sm text-[#1d2823] outline-none placeholder:text-[#aeb4ac]"
            }
            inputMode="tel"
            onChange={(event) => emit(event.target.value, false)}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={onKeyDown}
            placeholder={inputPlaceholder}
            ref={inputRef}
            type="text"
            value={draftValue}
          />
        </div>
      </div>
      {menu}
    </>
  );
}

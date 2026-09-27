"use client";

import { useEffect, useRef } from "react";

import { applyOtpBackspace, applyOtpInput, applyOtpPaste, OTP_LENGTH } from "~/lib/otp-input-logic";

/**
 * P49A-17 — shared 6-digit OTP entry used by both 2FA screens
 * (`login/verify-2fa` and the settings `TwoFactorModal`). Replaces two
 * near-identical copies.
 *
 * Accessibility: each box has its own `aria-label` ("Digit n of 6"),
 * `inputMode="numeric"` and `autoComplete="one-time-code"` on the first box
 * only (the platform / password-manager one-time-code autofill fills the
 * whole group from a single field). Pasting a full code fills every box and
 * fires `onComplete`; Backspace on an empty box moves to and clears the
 * previous one, matching native OTP UIs.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  error,
  disabled,
  autoFocus,
  length = OTP_LENGTH,
  label = "Verification code",
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  length?: number;
  /** Accessible group label, e.g. "Verification code" or "Recovery code". */
  label?: string;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);


  return (
    <div
      className={`flex gap-[9px] ${error ? "st-shake" : ""}`}
      role="group"
      aria-label={label}
    >
      {digits.map((d, i) => (
        <input
          aria-label={`Digit ${i + 1} of ${length}`}
          autoComplete={i === 0 ? "one-time-code" : "off"}
          className="st-otp-box text-[16px]"
          disabled={disabled}
          inputMode="numeric"
          key={i}
          maxLength={1}
          onChange={(e) => {
            const result = applyOtpInput(value, i, e.target.value, length);
            if (result.value === value) return;
            onChange(result.value);
            if (result.complete && onComplete) onComplete(result.value);
            else refs.current[result.focusIndex]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              const result = applyOtpBackspace(value, i, length);
              onChange(result.value);
              refs.current[result.focusIndex]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowRight" && i < length - 1) {
              refs.current[i + 1]?.focus();
            }
          }}
          onPaste={(e) => {
            e.preventDefault();
            const result = applyOtpPaste(value, e.clipboardData.getData("text") || "", length);
            if (result.value === value) return;
            onChange(result.value);
            if (result.complete && onComplete) onComplete(result.value);
            else refs.current[result.focusIndex]?.focus();
          }}
          ref={(el) => {
            refs.current[i] = el;
          }}
          style={error ? { borderColor: "#c0492f", color: "#9a3a23" } : {}}
          type="text"
          value={d}
        />
      ))}
    </div>
  );
}

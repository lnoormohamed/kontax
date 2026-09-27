/**
 * P49A-17 — pure helpers behind the shared `OtpInput` (per-digit 2FA code
 * entry). Split out from the component so the paste / backspace / digit-entry
 * rules can be unit tested without a DOM.
 */

/** How many digits `setDigitAt` should focus-advance / complete-call for. */
export const OTP_LENGTH = 6;

/**
 * One character typed or auto-filled into slot `index`. Keeps the existing
 * value's other digits, replaces (or clears, for `ch === ""`) the target
 * slot, and never grows past `length`.
 */
export function setDigitAt(
  value: string,
  index: number,
  ch: string,
  length: number = OTP_LENGTH,
): string {
  return (value.slice(0, index) + ch + value.slice(index + 1)).slice(0, length);
}

/** Keep only digits, and only as many as fit. */
export function sanitizeDigits(raw: string, length: number = OTP_LENGTH): string {
  return raw.replace(/\D/g, "").slice(0, length);
}

/**
 * Result of pasting arbitrary clipboard text into slot `index`: the resulting
 * value, and which slot should end up focused.
 */
export function applyOtpPaste(
  current: string,
  pasted: string,
  length: number = OTP_LENGTH,
): { value: string; focusIndex: number; complete: boolean } {
  const digits = sanitizeDigits(pasted, length);
  if (!digits) {
    return { value: current, focusIndex: 0, complete: false };
  }
  const complete = digits.length === length;
  return {
    value: digits,
    focusIndex: complete ? length - 1 : Math.min(digits.length, length - 1),
    complete,
  };
}

/**
 * Backspace pressed in slot `index`. When that slot already has a digit, it
 * is cleared and focus stays put; when it's already empty, focus (and the
 * clear) moves to the previous slot — so repeated backspace walks left one
 * slot at a time, matching native OTP UIs.
 */
export function applyOtpBackspace(
  value: string,
  index: number,
  length: number = OTP_LENGTH,
): { value: string; focusIndex: number } {
  const hasDigitHere = Boolean(value[index]);
  if (!hasDigitHere && index > 0) {
    return { value: setDigitAt(value, index - 1, "", length), focusIndex: index - 1 };
  }
  return { value: setDigitAt(value, index, "", length), focusIndex: index };
}

/**
 * A change event on slot `index` whose raw value is `raw`. One new digit is
 * typed entry; several digits into an empty slot (or more than one extra into
 * a filled one) are an autofill — iOS "From Messages", WebOTP, a password
 * manager or dictation putting the whole code into the first box, often
 * ignoring `maxLength` — and are handled exactly like a paste.
 */
export function applyOtpInput(
  current: string,
  index: number,
  raw: string,
  length: number = OTP_LENGTH,
): { value: string; focusIndex: number; complete: boolean } {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return { value: current, focusIndex: index, complete: false };
  const existing = current[index] ?? "";
  if (digits.length > (existing ? 2 : 1)) return applyOtpPaste(current, digits, length);
  // One typed digit, possibly next to the digit already in the slot: keep
  // the one that is new.
  const ch = existing && digits.length === 2 ? (digits.startsWith(existing) ? digits[1]! : digits[0]!) : digits[digits.length - 1]!;
  const value = setDigitAt(current, index, ch, length);
  const complete = value.length === length;
  return { value, focusIndex: complete ? index : Math.min(index + 1, length - 1), complete };
}

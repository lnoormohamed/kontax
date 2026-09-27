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

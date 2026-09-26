import Link from "next/link";

/*
 * P50-06 — shared look for the pre-login screens (login, register, 2FA
 * challenge, forgot/reset password, verify email) so they match the
 * Direction A marketing site. Auth-only: nothing in the signed-in app
 * imports this file.
 *
 * Direction A tokens used here (source: marketing.css header):
 *   g900 #0f2620 · g800 #17352e · g600 #2f6b52 · g400 #6f9c86 · g200 #cfe1d6
 *   g100 #e8f0eb · stone #f4f1ea · card #fff · ink #1d2823 · head #14231d
 *   body #4e5851 · mute #646c65 · line #e5e8e1 · line-strong #d4d9d0
 *   focus #4158f4 (focus rings only, never a fill) · err #b3261e
 *   radii: button/input 10px, card 16px · inputs min-height 48px, 16px text.
 */

/** Visible keyboard focus in the Direction A focus colour. */
export const authFocus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4158f4]";

export const authCard =
  "w-full max-w-[440px] rounded-[16px] border border-[#e5e8e1] bg-white px-6 py-8 shadow-[0_1px_2px_rgba(20,35,29,0.04),0_12px_32px_rgba(20,35,29,0.07)] sm:px-10 sm:py-10";

export const authTitle =
  "text-center text-[24px] font-semibold leading-tight tracking-[-0.02em] text-[#14231d]";

export const authLede = "mt-2 text-center text-[15px] leading-[1.55] text-[#4e5851]";

export const authLabel = "mb-1.5 text-[14px] font-semibold text-[#1d2823]";

const authInputBase =
  "min-h-12 w-full rounded-[10px] border-[1.5px] bg-white px-[14px] py-3 text-[16px] leading-[1.4] text-[#1d2823] outline-none transition-[border-color,box-shadow] placeholder:text-[#8a918b] focus:border-[#4158f4] focus:shadow-[0_0_0_3px_rgba(65,88,244,0.2)] disabled:opacity-60";

/** Text input; `invalid` swaps the resting border to the error colour. */
export function authInput(invalid = false) {
  return `${authInputBase} ${invalid ? "border-[#b3261e]" : "border-[#d4d9d0]"}`;
}

export const authBtnPrimary = `flex min-h-12 w-full items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[#17352e] bg-[#17352e] px-[22px] text-[15.5px] font-semibold text-white transition-colors hover:border-[#0f2620] hover:bg-[#0f2620] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[#17352e] disabled:hover:bg-[#17352e] disabled:active:translate-y-0 ${authFocus}`;

export const authBtnSecondary = `inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border-[1.5px] border-[#d4d9d0] bg-transparent px-[22px] text-[15.5px] font-semibold text-[#1d2823] transition-colors hover:border-[#1d2823] ${authFocus}`;

/** Inline text link — green, always underlined so it doesn't rely on colour alone. */
export const authLink = `rounded-[4px] font-semibold text-[#17352e] underline decoration-[#6f9c86] decoration-1 underline-offset-[3px] transition-colors hover:decoration-[#17352e] ${authFocus}`;

/** Quiet secondary action (e.g. "Forgot password?", "Back to login"). */
export const authQuietLink = `rounded-[4px] font-medium text-[#4e5851] transition-colors hover:text-[#17352e] hover:underline hover:underline-offset-[3px] ${authFocus}`;

export const authNoteOk =
  "rounded-[10px] border border-[#cfe1d6] bg-[#e8f0eb] px-4 py-3 text-[14px] leading-[1.5] text-[#17352e]";
export const authNoteWarn =
  "rounded-[10px] border border-[#e6d3a3] bg-[#f6edd9] px-4 py-3 text-[14px] leading-[1.5] text-[#6b4a0f]";
export const authNoteErr =
  "rounded-[10px] border border-[#efc9c5] bg-[#fbeeec] px-4 py-3 text-[14px] leading-[1.45] text-[#b3261e]";

export const authFieldError = "mt-1.5 text-[13px] leading-[1.45] text-[#b3261e]";

/** Brand lockup at the top of every auth card; links back to the homepage. */
export function AuthBrand() {
  return (
    <>
      <Link
        aria-label="Kontax home"
        className={`mx-auto flex w-fit items-center justify-center gap-[10px] rounded-[10px] ${authFocus}`}
        href="/"
      >
        <span
          aria-hidden
          className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-[#17352e] text-[19px] font-bold leading-none text-[#dff0e7]"
        >
          K
        </span>
        <span className="text-[24px] font-semibold tracking-[-0.02em] text-[#17352e]">Kontax</span>
      </Link>
      <div aria-hidden className="mx-auto mt-5 mb-6 h-px w-14 bg-[#e5e8e1]" />
    </>
  );
}

/** Page frame: warm stone background, centred card, small footer line. */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="relative flex min-h-svh flex-col items-center justify-center gap-5 bg-[#f4f1ea] px-4 py-10 font-sans text-[#1d2823] antialiased sm:px-5"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 70% 55% at 50% 32%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0) 70%)",
      }}
    >
      {children}
      <p className="text-center text-[13px] text-[#646c65]">© Kontax · Your contacts, organised and yours.</p>
    </main>
  );
}

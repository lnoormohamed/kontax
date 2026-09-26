"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";

import { redeemTotpRecoveryCode, submitTotpChallenge } from "~/app/actions/totp";
import { signOutAction } from "~/app/actions/auth";
import {
  AuthBrand,
  authBtnPrimary,
  authCard,
  authFieldError,
  authInput,
  AuthShell,
  authLede,
  authNoteErr,
  authQuietLink,
  authTitle,
} from "~/app/_components/auth-ui";
import { safeInternalPath } from "~/lib/safe-internal-path";

export const dynamic = "force-dynamic";

// ── 6-digit OTP input ─────────────────────────────────────────────────────────
function OtpInput({ value, onChange, onComplete, error, disabled, autoFocus }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void;
  error?: boolean; disabled?: boolean; autoFocus?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);

  const setAt = (i: number, ch: string) => {
    const next = (value.slice(0, i) + ch + value.slice(i + 1)).slice(0, 6);
    onChange(next);
    if (ch && i < 5) refs.current[i + 1]?.focus();
    if (next.length === 6 && !next.includes("") && onComplete) onComplete(next);
  };

  return (
    <div className={`flex justify-center gap-[7px] sm:gap-[9px] ${error ? "st-shake" : ""}`}>
      {digits.map((d, i) => (
        <input
          // P50-06: auth-only Direction A styling (the shared `.st-otp-box`
          // is also used in settings, so it is not restyled globally).
          className={`h-[52px] w-[42px] rounded-[10px] border-[1.5px] bg-white text-center font-[family-name:var(--font-geist-mono)] text-[22px] font-medium text-[#1d2823] outline-none transition-[border-color,box-shadow] focus:border-[#4158f4] focus:shadow-[0_0_0_3px_rgba(65,88,244,0.2)] disabled:bg-[#f4f1ea] disabled:text-[#646c65] sm:h-[56px] sm:w-[48px] ${error ? "border-[#b3261e]" : "border-[#d4d9d0]"}`}
          disabled={disabled}
          inputMode="numeric"
          key={i}
          maxLength={1}
          onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); if (v) setAt(i, v[v.length - 1]!); }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") { if (!digits[i] && i > 0) { refs.current[i - 1]?.focus(); setAt(i - 1, ""); } else setAt(i, ""); }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => { e.preventDefault(); const p = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6); if (p) { onChange(p); if (p.length === 6 && onComplete) onComplete(p); else refs.current[Math.min(p.length, 5)]?.focus(); } }}
          ref={(el) => { refs.current[i] = el; }}
          value={d}
        />
      ))}
    </div>
  );
}

export default function VerifyTwoFaPage() {
  // useSearchParams needs a Suspense boundary for static prerender.
  return (
    <Suspense fallback={null}>
      <VerifyTwoFaInner />
    </Suspense>
  );
}

function VerifyTwoFaInner() {
  const searchParams = useSearchParams();
  // P48-01: carry the original destination through the challenge; only accept
  // an internal path (no protocol-relative `//host` or backslash tricks).
  // P48-03: the inline regex is now the shared `safeInternalPath` validator.
  const next = safeInternalPath(searchParams.get("next"), "/contacts");
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [err, setErr] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [isPending, startTransition] = useTransition();

  const ERROR_MESSAGES: Record<string, string> = {
    INVALID_TOTP_CODE: "Incorrect code. Please try again.",
    INVALID_RECOVERY_CODE: "Recovery code not found or already used.",
    RATE_LIMIT_EXCEEDED: "Too many attempts. Please try again in 15 minutes.",
    NOT_PENDING_TOTP: "Session error. Please sign in again.",
    // P48-03: replay guard — the same 30s code can't be used twice.
    TOTP_CODE_ALREADY_USED: "That code has already been used. Wait for the next one.",
  };

  // Refresh the JWT so pendingTotp is cleared before navigating. The JWT
  // callback clears the flag only when it sees totpChallengeVerified in the DB
  // (P48-01: the client can no longer clear it via the update trigger).
  // Fetching /api/auth/session forces a full JWT callback run and issues a new
  // cookie without pendingTotp, so the destination page's auth() then resolves.
  const completeLogin = async () => {
    await fetch("/api/auth/session", { credentials: "include" });
    window.location.assign(next);
  };

  const handleTotpSubmit = (val?: string) => {
    const v = val ?? code;
    if (v.length !== 6) return;
    setErr("");
    startTransition(async () => {
      const result = await submitTotpChallenge(v);
      if ("success" in result) {
        await completeLogin();
      } else {
        setErr(ERROR_MESSAGES[result.error] ?? "Something went wrong.");
        setCode("");
        if (result.error === "RATE_LIMIT_EXCEEDED") setRateLimited(true);
      }
    });
  };

  const handleRecoverySubmit = () => {
    const v = recoveryCode.toUpperCase().trim();
    if (!v) return;
    setErr("");
    startTransition(async () => {
      const result = await redeemTotpRecoveryCode(v);
      if ("success" in result) {
        await completeLogin();
      } else {
        setErr(ERROR_MESSAGES[result.error] ?? "Something went wrong.");
      }
    });
  };

  return (
    <AuthShell>
      <div className={authCard}>
        <AuthBrand />
        {!useRecovery ? (
          <>
            <h1 className={authTitle}>Two-factor authentication</h1>
            <p className={authLede}>
              Enter the 6-digit code from your authenticator app.
            </p>
            <div className="mt-7">
              {rateLimited ? (
                <div className={authNoteErr} role="alert">
                  Too many attempts. Please try again in 15 minutes.
                </div>
              ) : (
                <>
                  <OtpInput autoFocus disabled={isPending} error={!!err} onChange={setCode} onComplete={handleTotpSubmit} value={code} />
                  {err && <p className={`mt-3 text-center ${authFieldError}`} role="alert">{err}</p>}
                  <button
                    className={`mt-6 ${authBtnPrimary}`}
                    disabled={code.length !== 6 || isPending}
                    onClick={() => handleTotpSubmit()}
                    type="button"
                  >
                    {isPending ? "Verifying…" : "Verify"}
                  </button>
                </>
              )}
            </div>
            <div className="mt-6 border-t border-[#e5e8e1] pt-4 text-center">
              <button className={`text-[14px] ${authQuietLink}`} onClick={() => { setUseRecovery(true); setErr(""); setCode(""); }} type="button">
                Use a recovery code instead
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className={authTitle}>Recovery code</h1>
            <p className={authLede}>Enter one of your recovery codes.</p>
            <div className="mt-7">
              <input
                aria-label="Recovery code"
                autoFocus
                className={`${authInput(Boolean(err))} font-[family-name:var(--font-geist-mono)] font-medium uppercase tracking-[0.08em]`}
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="XXXXXXXXXX"
                type="text"
                value={recoveryCode}
              />
              {err && <p className={authFieldError} role="alert">{err}</p>}
              <button
                className={`mt-5 ${authBtnPrimary}`}
                disabled={!recoveryCode.trim() || isPending}
                onClick={handleRecoverySubmit}
                type="button"
              >
                {isPending ? "Verifying…" : "Verify recovery code"}
              </button>
            </div>
            <div className="mt-6 border-t border-[#e5e8e1] pt-4 text-center">
              <button className={`text-[14px] ${authQuietLink}`} onClick={() => { setUseRecovery(false); setErr(""); setRecoveryCode(""); }} type="button">
                ← Use authenticator app instead
              </button>
            </div>
          </>
        )}
        <div className="mt-4 text-center">
          <form action={signOutAction}>
            <button className={`text-[13px] ${authQuietLink}`} type="submit">← Back to login</button>
          </form>
        </div>
      </div>
    </AuthShell>
  );
}

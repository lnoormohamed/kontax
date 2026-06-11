"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { redeemTotpRecoveryCode, submitTotpChallenge } from "~/app/actions/totp";
import { signOutAction } from "~/app/actions/auth";

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
    <div className={`flex gap-[9px] ${error ? "st-shake" : ""}`}>
      {digits.map((d, i) => (
        <input
          className="st-otp-box"
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
          style={error ? { borderColor: "#c0492f", color: "#9a3a23" } : {}}
          value={d}
        />
      ))}
    </div>
  );
}

export default function VerifyTwoFaPage() {
  const router = useRouter();
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
  };

  // After TOTP verification, the JWT callback clears pendingTotp on the next
  // request. A hard navigation to /contacts triggers that next request.
  const completeLogin = () => router.push("/contacts");

  const handleTotpSubmit = (val?: string) => {
    const v = val ?? code;
    if (v.length !== 6) return;
    setErr("");
    startTransition(async () => {
      const result = await submitTotpChallenge(v);
      if ("success" in result) {
        completeLogin();
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
        completeLogin();
      } else {
        setErr(ERROR_MESSAGES[result.error] ?? "Something went wrong.");
      }
    });
  };

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10">
      <div aria-hidden className="fixed inset-0 -z-10" style={{ backgroundColor: "#eef1ec", backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 36%, rgba(23,53,46,0.10) 0%, rgba(23,53,46,0) 70%)" }} />

      <Link className="flex items-center gap-2.5" href="/">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">K</span>
        <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
      </Link>

      <div className="w-full max-w-[400px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
        {!useRecovery ? (
          <>
            <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">Two-factor authentication</h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#5c655e]">
              Enter the 6-digit code from your authenticator app.
            </p>
            <div className="mt-6">
              {rateLimited ? (
                <div className="rounded-[12px] border border-[#ecd0c7] bg-[#f7e9e4] px-[14px] py-[11px] text-[13.5px] text-[#8f3320]">
                  Too many attempts. Please try again in 15 minutes.
                </div>
              ) : (
                <>
                  <OtpInput autoFocus disabled={isPending} error={!!err} onChange={setCode} onComplete={handleTotpSubmit} value={code} />
                  {err && <p className="mt-[10px] text-[13px] text-[#9a3a23]">{err}</p>}
                  <button
                    className="mt-5 w-full rounded-[1.2rem] bg-[#17352e] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
                    disabled={code.length !== 6 || isPending}
                    onClick={() => handleTotpSubmit()}
                    type="button"
                  >
                    {isPending ? "Verifying…" : "Verify"}
                  </button>
                </>
              )}
            </div>
            <div className="mt-4 border-t border-[#e9ece7] pt-4">
              <button className="text-[13px] font-medium text-[#5c655e] hover:text-[#1d2823]" onClick={() => { setUseRecovery(true); setErr(""); setCode(""); }} type="button">
                Use a recovery code instead
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">Recovery code</h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#5c655e]">Enter one of your recovery codes.</p>
            <div className="mt-5">
              <input
                autoFocus
                className="w-full rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-3 font-mono text-[15px] uppercase tracking-[0.08em] text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe]"
                onChange={(e) => setRecoveryCode(e.target.value)}
                placeholder="XXXXXXXXXX"
                type="text"
                value={recoveryCode}
              />
              {err && <p className="mt-2 text-[13px] text-[#9a3a23]">{err}</p>}
              <button
                className="mt-4 w-full rounded-[1.2rem] bg-[#17352e] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
                disabled={!recoveryCode.trim() || isPending}
                onClick={handleRecoverySubmit}
                type="button"
              >
                {isPending ? "Verifying…" : "Verify recovery code"}
              </button>
            </div>
            <div className="mt-4 border-t border-[#e9ece7] pt-4">
              <button className="text-[13px] font-medium text-[#5c655e] hover:text-[#1d2823]" onClick={() => { setUseRecovery(false); setErr(""); setRecoveryCode(""); }} type="button">
                ← Use authenticator app instead
              </button>
            </div>
          </>
        )}
        <div className="mt-4 text-center">
          <form action={signOutAction}>
            <button className="text-[12px] text-[#8b938c] hover:text-[#5c655e]" type="submit">← Back to login</button>
          </form>
        </div>
      </div>

      <p className="text-[12px] text-[#8b938c]">© Kontax · Your contacts, organized and yours.</p>
    </main>
  );
}

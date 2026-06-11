"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { confirmTotpEnrolment, startTotpEnrolment } from "~/app/actions/totp";

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

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return <span className="st-spin inline-block rounded-full" style={{ width: size, height: size, border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`, borderTopColor: light ? "#fff" : "#17352e" }} />;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function TwoFactorModal({
  onCancel,
  onEnabled,
}: {
  onCancel: () => void;
  onEnabled: (codes: string[]) => void;
}) {
  type Step = "loading" | "qr" | "verify" | "codes" | "error";
  const [step, setStep] = useState<Step>("loading");
  const [qrDataUri, setQrDataUri] = useState("");
  const [secret, setSecret] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Start enrolment on mount
  useEffect(() => {
    startTotpEnrolment().then((result) => {
      if ("error" in result) { setErr(result.error); setStep("error"); return; }
      setQrDataUri(result.qrCodeDataUri);
      setSecret(result.plaintextSecret);
      setPendingToken(result.pendingToken);
      setStep("qr");
    }).catch(() => { setErr("Failed to start enrolment."); setStep("error"); });
  }, []);

  const verify = (val?: string) => {
    const v = val ?? code;
    if (v.length !== 6) return;
    setErr("");
    startTransition(async () => {
      const result = await confirmTotpEnrolment({ totpCode: v, pendingToken });
      if ("success" in result) {
        setRecoveryCodes(result.recoveryCodes);
        setStep("codes");
      } else {
        setErr(result.error === "INVALID_TOTP_CODE" ? "Incorrect code. Try again."
          : result.error === "PENDING_TOKEN_EXPIRED" ? "Enrolment timed out. Please start again."
          : "Something went wrong.");
        setCode("");
      }
    });
  };

  const copyAll = () => {
    try { void navigator.clipboard.writeText(recoveryCodes.join("\n")); } catch {}
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    try {
      const blob = new Blob([recoveryCodes.join("\n") + "\n"], { type: "text/plain" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "kontax-recovery-codes.txt"; a.click(); URL.revokeObjectURL(a.href);
    } catch {}
  };

  const secretSpaced = secret.replace(/(.{4})/g, "$1 ").trim();

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-[rgba(20,30,25,0.42)] p-4" onClick={step === "codes" ? undefined : onCancel}>
      <div className="st-modal-in w-full max-w-[460px] rounded-[1.6rem] bg-white p-6 shadow-[0_24px_60px_rgba(20,30,25,0.25)]" onClick={(e) => e.stopPropagation()} role="dialog">

        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner size={28} light={false} />
            <p className="text-[14px] text-[#5c655e]">Setting up…</p>
          </div>
        )}

        {step === "error" && (
          <>
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]">Couldn&apos;t start enrolment</h3>
            <p className="mt-3 text-[14px] text-[#5c655e]">
              {err === "EMAIL_NOT_VERIFIED" ? "Please verify your email address before enabling 2FA."
                : err === "TOTP_ALREADY_ENABLED" ? "Two-factor authentication is already enabled."
                : "Something went wrong. Please try again."}
            </p>
            <button className="mt-4 rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[11px] text-[14px] font-semibold text-[#1d2823] hover:bg-[#f2f4f0]" onClick={onCancel} type="button">Close</button>
          </>
        )}

        {step === "qr" && (
          <>
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]">Set up two-factor authentication</h3>
            <p className="mt-[6px] text-[13px] font-semibold tracking-[0.02em] text-[#17352e]">Step 1 of 2</p>
            <p className="mt-[6px] text-[14px] leading-[1.55] text-[#5c655e]">
              Scan this QR code with your authenticator app (1Password, Authy, Google Authenticator…).
            </p>
            <div className="my-4 grid place-items-center">
              <div className="rounded-[18px] border border-[#d8ddd6] bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="TOTP QR code" className="block" height={196} src={qrDataUri} width={196} />
              </div>
            </div>
            <button className="inline-flex items-center gap-[7px] border-none bg-transparent p-0 text-[13px] font-semibold text-[#5c655e] hover:text-[#1d2823]" onClick={() => setShowManual((s) => !s)} type="button">
              <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" style={{ transform: showManual ? "rotate(180deg)" : "none", transition: "transform .15s" }} viewBox="0 0 24 24" width="15"><polyline points="6 9 12 15 18 9" /></svg>
              Can&apos;t scan? Enter this code manually
            </button>
            {showManual && (
              <div className="mt-[10px] rounded-xl border border-[#e9ece7] bg-[#f2f4f0] px-[14px] py-3 text-center font-mono text-[14px] tracking-[0.1em] text-[#1d2823]">{secretSpaced}</div>
            )}
            <div className="mt-[22px] flex justify-end gap-2.5">
              <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[11px] text-[14px] font-semibold text-[#1d2823] hover:bg-[#f2f4f0]" onClick={onCancel} type="button">Cancel</button>
              <button className="rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white hover:bg-[#20443b]" onClick={() => setStep("verify")} type="button">Continue →</button>
            </div>
          </>
        )}

        {step === "verify" && (
          <>
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]">Set up two-factor authentication</h3>
            <p className="mt-[6px] text-[13px] font-semibold text-[#17352e]">Step 2 of 2</p>
            <p className="mt-[6px] mb-4 text-[14px] leading-[1.55] text-[#5c655e]">
              Enter the 6-digit code from your authenticator app to confirm.
            </p>
            <OtpInput autoFocus disabled={isPending} error={!!err} onChange={setCode} onComplete={verify} value={code} />
            {err && <p className="mt-[10px] text-[13px] text-[#9a3a23]">{err}</p>}
            <div className="mt-[22px] flex items-center justify-between gap-2.5">
              <button className="border-none bg-transparent p-[4px_2px] text-[13px] font-semibold text-[#5c655e] hover:text-[#1d2823]" onClick={() => { setStep("qr"); setCode(""); setErr(""); }} type="button">← Back</button>
              <button className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45" disabled={code.length !== 6 || isPending} onClick={() => verify()} type="button">
                {isPending ? <><Spinner size={15} /> Verifying…</> : "Verify and enable"}
              </button>
            </div>
          </>
        )}

        {step === "codes" && (
          <>
            <div className="flex items-center gap-[10px]">
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-[#e7efe9] text-[#17352e]">
                <svg fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="17"><polyline points="20 6 9 17 4 12" /></svg>
              </span>
              <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]">Two-factor is enabled</h3>
            </div>
            <div className="mt-4 flex items-start gap-2.5 rounded-[14px] border border-[#e6d3a3] bg-[#f6edd9] px-[15px] py-[13px]">
              <svg fill="none" height="17" stroke="#7c5511" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" style={{ flexShrink: 0, marginTop: 1 }} viewBox="0 0 24 24" width="17"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
              <span className="text-[13.5px] leading-[1.5] text-[#7c5511]">
                Save your recovery codes somewhere safe. If you lose your authenticator app, these are the <strong className="font-semibold">only</strong> way to recover your account.
              </span>
            </div>
            <div className="mt-[14px] grid grid-cols-2 gap-2 rounded-[14px] border border-[#e9ece7] bg-[#f8faf8] p-[14px]">
              {recoveryCodes.map((c) => (
                <span className="rounded-lg border border-[#e9ece7] bg-white py-[7px] text-center font-mono text-[15px] tracking-[0.06em] text-[#1d2823]" key={c}>{c}</span>
              ))}
            </div>
            <div className="mt-[14px] flex flex-wrap gap-2.5">
              <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-[9px] text-[13px] font-semibold text-[#1d2823] hover:bg-[#f2f4f0]" onClick={copyAll} type="button">{copied ? "Copied ✓" : "Copy all codes"}</button>
              <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-[9px] text-[13px] font-semibold text-[#1d2823] hover:bg-[#f2f4f0]" onClick={download} type="button">Download as .txt</button>
            </div>
            <button className="mt-[18px] w-full rounded-[1.2rem] bg-[#17352e] py-3 text-[14px] font-semibold text-white hover:bg-[#20443b]" onClick={() => onEnabled(recoveryCodes)} type="button">I&apos;ve saved my codes →</button>
          </>
        )}
      </div>
    </div>
  );
}

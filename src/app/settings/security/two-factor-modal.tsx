"use client";

import { useEffect, useState, useTransition } from "react";

import { confirmTotpEnrolment, startTotpEnrolment } from "~/app/actions/totp";
import { OtpInput } from "~/app/_components/otp-input";
import { useDialogFocus } from "~/app/_components/use-dialog-focus";

import { RecoveryCodesPanel } from "./recovery-codes";

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return <span className="st-spin inline-block rounded-full" style={{ width: size, height: size, border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`, borderTopColor: light ? "#fff" : "#17352e" }} />;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export function TwoFactorModal({
  hasPassword,
  onCancel,
  onEnabled,
}: {
  /** P49A-13: enrolment starts with a password step-up when the account has one. */
  hasPassword: boolean;
  onCancel: () => void;
  onEnabled: (codes: string[]) => void;
}) {
  type Step = "password" | "loading" | "qr" | "verify" | "codes" | "error";
  const [step, setStep] = useState<Step>(hasPassword ? "password" : "loading");
  const [password, setPassword] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [qrDataUri, setQrDataUri] = useState("");
  const [secret, setSecret] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // P49A-13: `startTotpEnrolment` verifies the password itself (step-up). A
  // wrong password keeps the user on the password step; anything else is final.
  const begin = (currentPassword?: string) => {
    setStep("loading");
    startTotpEnrolment({ currentPassword }).then((result) => {
      if ("error" in result) {
        if (currentPassword !== undefined && (result.error === "WRONG_PASSWORD" || result.error === "RATE_LIMIT_EXCEEDED")) {
          setPwErr(result.error === "WRONG_PASSWORD" ? "Incorrect password. Please try again." : "Too many attempts. Please wait a while and try again.");
          setPassword("");
          setStep("password");
          return;
        }
        setErr(result.error); setStep("error"); return;
      }
      setQrDataUri(result.qrCodeDataUri);
      setSecret(result.plaintextSecret);
      setPendingToken(result.pendingToken);
      setStep("qr");
    }).catch(() => { setErr("Failed to start enrolment."); setStep("error"); });
  };

  // Accounts without a password (OAuth-only) start straight away.
  useEffect(() => {
    if (!hasPassword) begin();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount only
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
          : result.error === "TOTP_ALREADY_ENABLED" ? "Two-factor authentication is already on. Close this and reload the page."
          : "Something went wrong.");
        setCode("");
      }
    });
  };

  const secretSpaced = secret.replace(/(.{4})/g, "$1 ").trim();

  // The modal mounts/unmounts with the parent's "show 2FA setup" state, so
  // `open` is constant for this component's whole lifetime — the hook's
  // mount effect does the initial focus + inert, and its cleanup (on
  // unmount, i.e. onCancel/onEnabled removing this component) restores
  // focus. Escape is disabled once the recovery codes are showing, matching
  // the backdrop-click guard below (codes must be confirmed, not dismissed).
  const dialogRef = useDialogFocus<HTMLDivElement>({
    open: true,
    onClose: onCancel,
    closeOnEscape: step !== "codes",
  });

  return (
    <div className="fixed inset-0 z-[90] grid items-end bg-[rgba(20,30,25,0.42)] p-0 md:place-items-center md:p-4" onClick={step === "codes" ? undefined : onCancel}>
      <div
        ref={dialogRef}
        aria-labelledby="totp-modal-title"
        aria-modal="true"
        className="st-modal-in max-h-[calc(100dvh-18px)] w-full overflow-y-auto rounded-t-[1.6rem] bg-white p-4 shadow-[0_24px_60px_rgba(20,30,25,0.25)] md:max-w-[460px] md:rounded-[1.6rem] md:p-6"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        tabIndex={-1}
      >

        {step === "password" && (
          <form onSubmit={(e) => { e.preventDefault(); if (password) begin(password); }}>
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]" id="totp-modal-title">Set up two-factor authentication</h3>
            <p className="mt-[6px] text-[14px] leading-[1.55] text-[#5c655e]">
              First, confirm it&apos;s you. Enter your Kontax password to continue.
            </p>
            <label className="mt-4 block">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#646c65]">Password</span>
              <input
                autoComplete="current-password"
                autoFocus
                className={`mt-[6px] w-full rounded-[1.2rem] border px-4 py-3 text-[16px] text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe] md:text-[14px] ${pwErr ? "border-[#c98a76]" : "border-[#d8ddd6]"}`}
                onChange={(e) => { setPassword(e.target.value); if (pwErr) setPwErr(""); }}
                placeholder="Your password"
                type="password"
                value={password}
              />
            </label>
            {pwErr && <p className="mt-[6px] text-[12.5px] text-[#9a3a23]" role="alert">{pwErr}</p>}
            <div className="mt-[22px] flex justify-end gap-2.5">
              <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[11px] text-[14px] font-semibold text-[#1d2823] hover:bg-[#f2f4f0]" onClick={onCancel} type="button">Cancel</button>
              <button className="rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45" disabled={!password} type="submit">Continue →</button>
            </div>
          </form>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Spinner size={28} light={false} />
            <p className="text-[14px] text-[#5c655e]" id="totp-modal-title">Setting up…</p>
          </div>
        )}

        {step === "error" && (
          <>
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]" id="totp-modal-title">Couldn&apos;t start enrolment</h3>
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
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]" id="totp-modal-title">Set up two-factor authentication</h3>
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
            <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]" id="totp-modal-title">Set up two-factor authentication</h3>
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
              <h3 className="m-0 text-[19px] font-semibold text-[#1d2823]" id="totp-modal-title">Two-factor is enabled</h3>
            </div>
            <RecoveryCodesPanel codes={recoveryCodes} onSaved={() => onEnabled(recoveryCodes)} />
          </>
        )}
      </div>
    </div>
  );
}

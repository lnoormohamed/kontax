"use client";

import { useEffect, useState, useTransition } from "react";

import { disableTotpAuth, getTotpStatus, regenerateRecoveryCodes } from "~/app/actions/totp";
import { TwoFactorModal } from "./two-factor-modal";

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return <span className="st-spin inline-block rounded-full" style={{ width: size, height: size, border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`, borderTopColor: light ? "#fff" : "#17352e" }} />;
}

export function TwoFactorSection({ flash }: { flash: (msg: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null);
  const [remainingCodes, setRemainingCodes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enrol, setEnrol] = useState(false);
  const [viewCodes, setViewCodes] = useState(false);
  const [disabling, setDisabling] = useState(false);
  const [pw, setPw] = useState("");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getTotpStatus().then((s) => {
      setEnabled(s.enabled); setVerifiedAt(s.verifiedAt); setRemainingCodes(s.remainingCodes);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const resetDisable = () => { setDisabling(false); setPw(""); setCode(""); setErr(""); };

  const doDisable = () => {
    if (!pw || code.length < 6) return;
    startTransition(async () => {
      const result = await disableTotpAuth({ password: pw, totpCode: code });
      if ("success" in result) {
        resetDisable(); setEnabled(false); flash("Two-factor authentication disabled");
      } else {
        setErr(result.error === "INCORRECT_PASSWORD" ? "Incorrect password."
          : result.error === "INVALID_TOTP_CODE" ? "Incorrect authenticator code."
          : "Something went wrong.");
      }
    });
  };

  const doRegenerate = () => {
    startTransition(async () => {
      const result = await regenerateRecoveryCodes();
      if ("success" in result) {
        setRemainingCodes(8);
        flash("A new set of recovery codes was generated");
        setViewCodes(false);
      }
    });
  };

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
        <div className="text-[16px] font-semibold text-[#1d2823]">Two-factor authentication</div>
        <p className="mt-3 text-[13.5px] text-[#8b938c]">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[16px] font-semibold text-[#1d2823]">Two-factor authentication</span>
        <span className={`rounded-full border px-[11px] py-1 text-[11px] font-bold uppercase tracking-[0.08em] ${enabled ? "border-[#bcdac9] bg-[#e7efe9] text-[#17352e]" : "border-[#e0e4dd] bg-[#f2f4f0] text-[#8b938c]"}`}>
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {!enabled ? (
        <>
          <p className="mt-[10px] max-w-[580px] text-[14.5px] leading-[1.55] text-[#5c655e]">
            Add an extra layer of security. When 2FA is on, you&apos;ll enter a code from your authenticator app each time you sign in.
          </p>
          <button
            className="mt-4 inline-flex items-center justify-center rounded-[1.1rem] bg-[#4158f4] px-4 py-[10px] text-[14px] font-semibold text-white transition hover:bg-[#3347d8]"
            onClick={() => setEnrol(true)}
            type="button"
          >
            Set up authenticator app
          </button>
        </>
      ) : (
        <>
          <p className="mt-[10px] max-w-[580px] text-[14.5px] leading-[1.55] text-[#5c655e]">
            Authenticator app connected. You&apos;ll be asked for a code on each sign-in.{" "}
            {verifiedAt && (
              <span className="text-[#8b938c]">
                Enabled on {new Date(verifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}.
              </span>
            )}
          </p>

          <div className="mt-4 rounded-[1.5rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
            <div className="flex flex-wrap items-center justify-between gap-[14px]">
              <div>
                <div className="text-[14px] font-semibold text-[#1d2823]">Recovery codes</div>
                <div className="mt-[2px] text-[13px] text-[#5c655e]">
                  <strong className="font-semibold text-[#17352e]">{remainingCodes} remaining</strong>
                  {" · "}use these if you lose your device
                </div>
              </div>
              <button
                className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                onClick={() => setViewCodes((v) => !v)}
                type="button"
              >
                {viewCodes ? "Hide" : "View or regenerate"}
              </button>
            </div>
            {viewCodes && (
              <div className="mt-[14px] border-t border-[#e9ece7] pt-[14px]">
                <p className="m-0 text-[13px] leading-[1.5] text-[#5c655e]">
                  For your security, existing codes are stored hashed and can&apos;t be shown again. Regenerating creates a fresh set and <strong className="font-semibold">invalidates the old ones</strong>.
                </p>
                <button
                  className="mt-3 inline-flex items-center gap-2 rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-50"
                  disabled={isPending}
                  onClick={doRegenerate}
                  type="button"
                >
                  {isPending ? <><Spinner size={12} light={false} /> Regenerating…</> : "Regenerate recovery codes"}
                </button>
              </div>
            )}
          </div>

          {!disabling ? (
            <button className="mt-4 border-none bg-transparent p-0 text-[13.5px] font-medium text-[#8b938c] transition hover:text-[#b5472f]" onClick={() => setDisabling(true)} type="button">
              Disable 2FA
            </button>
          ) : (
            <div className="mt-4 grid max-w-[460px] gap-[14px] rounded-[1.5rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
              <p className="m-0 text-[14px] leading-[1.55] text-[#3a4540]">
                To disable two-factor authentication, enter your password and a code from your authenticator app.
              </p>
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Password</span>
                <input
                  autoComplete="current-password"
                  className={`mt-[6px] w-full rounded-[1.2rem] border px-4 py-3 text-[14px] text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe] ${err === "Incorrect password." ? "border-[#c98a76]" : "border-[#d8ddd6]"}`}
                  onChange={(e) => { setPw(e.target.value); if (err) setErr(""); }}
                  placeholder="Your password"
                  type="password"
                  value={pw}
                />
                {err === "Incorrect password." && <p className="mt-[6px] text-[12.5px] text-[#9a3a23]">{err}</p>}
              </label>
              <div>
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Authenticator code</span>
                <input
                  className="mt-[6px] w-full rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-3 font-mono text-[15px] tracking-[0.1em] text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe]"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); if (err) setErr(""); }}
                  placeholder="000000"
                  value={code}
                />
                {err === "Incorrect authenticator code." && <p className="mt-2 text-[12.5px] text-[#9a3a23]">{err}</p>}
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button
                  className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#b5472f] px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-[#9a3a23] disabled:cursor-default disabled:opacity-45"
                  disabled={!pw || code.length < 6 || isPending}
                  onClick={doDisable}
                  type="button"
                >
                  {isPending ? <><Spinner size={15} /> Disabling…</> : "Disable 2FA"}
                </button>
                <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-3 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]" onClick={resetDisable} type="button">Cancel</button>
              </div>
            </div>
          )}
        </>
      )}

      {enrol && (
        <TwoFactorModal
          onCancel={() => setEnrol(false)}
          onEnabled={(codes) => {
            setEnrol(false); setEnabled(true); setRemainingCodes(codes.length);
            flash("Two-factor authentication enabled");
          }}
        />
      )}
    </section>
  );
}

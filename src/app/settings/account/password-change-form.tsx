"use client";

import { useState, useTransition } from "react";
import { useSession } from "next-auth/react";

import { changePassword } from "~/app/actions/account";

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return (
    <span className="st-spin inline-block rounded-full" style={{
      width: size, height: size,
      border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`,
      borderTopColor: light ? "#fff" : "#17352e",
    }} />
  );
}

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M9.9 4.24A9.1 9.1 0 0112 4c6.5 0 10 7 10 7a18.5 18.5 0 01-2.16 3.19" />
      <path d="M6.61 6.61A18.5 18.5 0 002 12s3.5 7 10 7a9.1 9.1 0 003.06-.53" />
      <path d="M9.88 9.88a3 3 0 004.24 4.24" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  ) : (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PwField({
  label, value, onChange, placeholder, error, autoComplete, onEnter,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; error?: string; autoComplete?: string; onEnter?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block">
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">{label}</span>
      <div className="relative mt-[6px]">
        <input
          autoComplete={autoComplete}
          className={`w-full rounded-[1.2rem] border px-4 py-3 pr-11 text-[14px] text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe] ${error ? "border-[#c98a76]" : "border-[#d8ddd6]"}`}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
          placeholder={placeholder}
          type={show ? "text" : "password"}
          value={value}
        />
        <button
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute right-[10px] top-1/2 grid h-[30px] w-[30px] -translate-y-1/2 place-items-center rounded-lg text-[#8b938c] transition hover:text-[#5c655e]"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          type="button"
        >
          <EyeIcon visible={show} />
        </button>
      </div>
      {error && <p className="mt-[6px] text-[12.5px] leading-[1.45] text-[#9a3a23]">{error}</p>}
    </label>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  CURRENT_PASSWORD_INCORRECT: "Incorrect password.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
  PASSWORD_SAME_AS_CURRENT: "Must be different from current password.",
  RATE_LIMIT_EXCEEDED: "Too many attempts. Please try again in 1 hour.",
  UNAUTHORIZED: "Session expired. Please sign in again.",
};

export function PasswordChangeForm({ oauthOnly = false }: { oauthOnly?: boolean }) {
  const { update } = useSession();
  const [open, setOpen] = useState(false);
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [conf, setConf] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = () => { setOpen(false); setCur(""); setNw(""); setConf(""); setErrs({}); };
  const filled = oauthOnly ? (nw && conf) : (cur && nw && conf);
  const match = nw === conf;
  const canSubmit = filled && match && !isPending;

  const submit = () => {
    const e: Record<string, string> = {};
    if (nw.length < 8) e.nw = "Password must be at least 8 characters";
    if (nw !== conf) e.conf = "Passwords don't match";
    setErrs(e);
    if (Object.keys(e).length) return;

    startTransition(async () => {
      const result = await changePassword({ currentPassword: cur, newPassword: nw });
      if ("success" in result) {
        reset();
        const msg = oauthOnly
          ? "Password set. You can now sign in with your email and password."
          : "Password updated. All other sessions have been signed out.";
        setNotice(msg);
        await update();
        setTimeout(() => setNotice(""), 6000);
      } else {
        setErrs({ cur: ERROR_MESSAGES[result.error] ?? "Something went wrong." });
      }
    });
  };

  return (
    <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Password</span>

      {!open ? (
        <div className="mt-2">
          {oauthOnly ? (
            <p className="m-0 max-w-[560px] text-[14.5px] leading-[1.5] text-[#5c655e]">
              You signed in with Google. You haven&apos;t set a password yet — add one to sign in with your email too.
            </p>
          ) : (
            <p className="m-0 text-[14.5px] text-[#5c655e]">
              Last changed <strong className="font-semibold text-[#1d2823]">3 months ago</strong>.
            </p>
          )}
          {notice && (
            <div className="mt-3 rounded-[12px] border border-[#bcdac9] bg-[#e7efe9] px-[14px] py-[11px] text-[13.5px] leading-[1.45] text-[#17352e]">
              {notice}
            </div>
          )}
          <button
            className="mt-[14px] rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[9px] text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
            onClick={() => setOpen(true)}
            type="button"
          >
            {oauthOnly ? "Set a password" : "Change password"}
          </button>
        </div>
      ) : (
        <div className="mt-3 grid max-w-[520px] gap-[14px] rounded-[1.5rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
          {!oauthOnly && (
            <PwField label="Current password" value={cur} onChange={(v) => { setCur(v); if (errs.cur) setErrs((x) => ({ ...x, cur: "" })); }} placeholder="Enter current password" autoComplete="current-password" error={errs.cur} />
          )}
          <PwField label="New password" value={nw} onChange={(v) => { setNw(v); if (errs.nw) setErrs((x) => ({ ...x, nw: "" })); }} placeholder="At least 8 characters" autoComplete="new-password" error={errs.nw} />
          <PwField label="Confirm new password" value={conf} onChange={(v) => { setConf(v); if (errs.conf) setErrs((x) => ({ ...x, conf: "" })); }} placeholder="Re-enter new password" autoComplete="new-password" error={(!match && conf) ? "Passwords don't match" : errs.conf} onEnter={submit} />
          <div className="flex flex-wrap gap-2.5">
            <button
              className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
              disabled={!canSubmit}
              onClick={submit}
              type="button"
            >
              {isPending
                ? <><Spinner size={15} /> {oauthOnly ? "Setting…" : "Updating…"}</>
                : oauthOnly ? "Set password" : "Update password"}
            </button>
            <button
              className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-3 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
              onClick={reset}
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";

import {
  cancelEmailChange,
  requestEmailChange,
  resendVerificationEmail,
} from "~/app/actions/account";

const EXPIRY_HOURS = 24;
const RESEND_COOLDOWN_SECONDS = 300; // 5 minutes

function validEmail(e: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
}

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return (
    <span className="st-spin inline-block rounded-full" style={{
      width: size, height: size,
      border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`,
      borderTopColor: light ? "#fff" : "#17352e",
    }} />
  );
}

function useCooldown(initial = 0) {
  const [cooldown, setCooldown] = useState(initial);
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooldown]);
  const mmss = `${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}`;
  return { cooldown, setCooldown, mmss };
}

const ERROR_MESSAGES: Record<string, string> = {
  EMAIL_SAME_AS_CURRENT: "That's already your current email address.",
  EMAIL_ALREADY_IN_USE: "That email address is already associated with another account.",
  RATE_LIMIT_EXCEEDED: "Too many requests. Please wait a few minutes.",
  INVALID_EMAIL: "Please enter a valid email address.",
};

export function EmailSection({
  email,
  emailVerified,
  pendingEmail,
  pendingRequestedAt,
}: {
  email: string;
  emailVerified: Date | null;
  pendingEmail: string | null;
  pendingRequestedAt: Date | null;
}) {
  // ── state ──────────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [sendErr, setSendErr] = useState("");
  const [isSending, startSend] = useTransition();
  const [isCancelling, startCancel] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [toast, setToast] = useState("");

  // Resend cooldown (unverified banner)
  const [resendSent, setResendSent] = useState(false);
  const [resendErr, setResendErr] = useState<string | null>(null);
  const [isResending, startResend] = useTransition();
  const { cooldown: resCooldown, setCooldown: setResCooldown, mmss: resMmss } = useCooldown(0);

  // Pending-change resend cooldown
  const { cooldown: pendCooldown, setCooldown: setPendCooldown, mmss: pendMmss } = useCooldown(0);

  const differs = val.trim().toLowerCase() !== email.toLowerCase();
  const canSend = validEmail(val) && differs && !isSending;

  // Is the pending token expired?
  const isExpired = pendingRequestedAt
    ? Date.now() > new Date(pendingRequestedAt).getTime() + EXPIRY_HOURS * 60 * 60 * 1000
    : false;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 4000); };

  // ── send change request ────────────────────────────────────────────────────
  const send = () => {
    setSendErr("");
    startSend(async () => {
      const result = await requestEmailChange(val);
      if ("success" in result) {
        setOpen(false); setVal("");
        showToast(`Verification email sent to ${val.trim().toLowerCase()}`);
      } else {
        setSendErr(ERROR_MESSAGES[result.error] ?? "Something went wrong.");
      }
    });
  };

  // ── resend for pending change ──────────────────────────────────────────────
  const resendPending = () => {
    if (!pendingEmail) return;
    startSend(async () => {
      const result = await requestEmailChange(pendingEmail);
      if ("success" in result) {
        setPendCooldown(RESEND_COOLDOWN_SECONDS);
        showToast(`Verification re-sent to ${pendingEmail}`);
      }
    });
  };

  // ── cancel pending change ──────────────────────────────────────────────────
  const doCancel = () => {
    startCancel(async () => {
      await cancelEmailChange();
      setConfirmCancel(false);
      showToast("Email change cancelled");
    });
  };

  // ── resend signup verification ─────────────────────────────────────────────
  const handleResend = () => {
    startResend(async () => {
      setResendErr(null);
      const result = await resendVerificationEmail();
      if ("success" in result) {
        setResendSent(true); setResCooldown(RESEND_COOLDOWN_SECONDS);
        setTimeout(() => setResendSent(false), 5000);
      } else {
        setResendErr(result.error === "RATE_LIMIT_EXCEEDED"
          ? "Please wait a few minutes." : "Something went wrong.");
      }
    });
  };

  // ── PENDING / EXPIRED state ────────────────────────────────────────────────
  if (pendingEmail) {
    return (
      <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] md:p-6">
        <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Email address</span>
        <div className="mt-2 break-all text-[18px] font-semibold text-[#8b938c]">{email}</div>

        <div className={`mt-4 rounded-[1.5rem] border p-4 ${isExpired ? "border-[#e6cabe] bg-[#f7ede9]" : "border-[#e6d3a3] bg-[#f6edd9]"}`}>
          <div className="flex items-center gap-[9px]">
            <span className="text-[15px]">{isExpired ? "⚠️" : "⏳"}</span>
            <span className={`text-[14px] font-semibold ${isExpired ? "text-[#9a3a23]" : "text-[#7c5511]"}`}>
              {isExpired ? "Verification link expired" : "Waiting for verification"}
            </span>
          </div>
          <p className={`mt-[10px] text-[13.5px] leading-[1.55] ${isExpired ? "text-[#9a3a23]" : "text-[#7c5511]"}`}>
            A verification link was sent to <strong className="font-semibold">{pendingEmail}</strong>.{" "}
            {isExpired
              ? "The link is no longer valid — request a new one to continue."
              : <span>Check your inbox to confirm the change.{pendingRequestedAt && <span className="text-[#8b7a4f]"> Sent {Math.floor((Date.now() - new Date(pendingRequestedAt).getTime()) / 3600000)}h ago.</span>}</span>}
          </p>

          {!confirmCancel ? (
            <div className="mt-[14px] flex flex-wrap items-center gap-2.5">
              <button
                className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-50"
                disabled={(!isExpired && pendCooldown > 0) || isSending}
                onClick={resendPending}
                type="button"
              >
                {isSending ? <Spinner size={13} light={false} /> : !isExpired && pendCooldown > 0 ? <span className="tabular-nums">Resend in {pendMmss}</span> : "Resend verification"}
              </button>
              <button
                className="border-none bg-transparent p-0 text-[13px] font-medium text-[#8b938c] transition hover:text-[#b5472f] disabled:opacity-50"
                disabled={isCancelling}
                onClick={() => setConfirmCancel(true)}
                type="button"
              >
                Cancel email change
              </button>
            </div>
          ) : (
            <div className={`mt-[14px] rounded-[1rem] border bg-white p-[14px] ${isExpired ? "border-[#e6cabe]" : "border-[#e6d3a3]"}`}>
              <p className="m-0 text-[13.5px] leading-[1.5] text-[#3a4540]">
                Cancel this email change? Your address will remain <strong className="font-semibold">{email}</strong>.
              </p>
              <div className="mt-3 flex flex-wrap gap-2.5">
                <button
                  className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#b5472f] px-[14px] py-2 text-[13px] font-semibold text-white transition hover:bg-[#9a3a23] disabled:opacity-50"
                  disabled={isCancelling}
                  onClick={doCancel}
                  type="button"
                >
                  {isCancelling ? <><Spinner size={13} /> Cancelling…</> : "Yes, cancel"}
                </button>
                <button className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]" onClick={() => setConfirmCancel(false)} type="button">Keep waiting</button>
              </div>
            </div>
          )}
        </div>

        {toast && <div className="mt-3 rounded-[1.2rem] border border-[#bcdac9] bg-[#e7efe9] px-[14px] py-[11px] text-[13.5px] text-[#17352e]">{toast}</div>}
      </section>
    );
  }

  // ── NO PENDING CHANGE state ────────────────────────────────────────────────
  return (
    <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-4 shadow-[0_1px_2px_rgba(20,30,25,0.04)] md:p-6">
      <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Email address</span>

      {!open ? (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <span className="break-all text-[18px] font-semibold text-[#1d2823]">{email}</span>
          <button
            className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-[9px] text-[13.5px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
            onClick={() => setOpen(true)}
            type="button"
          >
            Change email
          </button>
        </div>
      ) : (
        <>
          <div className="mt-2 break-all text-[18px] font-semibold text-[#1d2823]">{email}</div>
          <div className="mt-4 max-w-[520px] rounded-[1.5rem] border border-[#d8ddd6] bg-[#f8faf8] p-4">
            <label className="block">
              <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">New email address</span>
              <input
                autoComplete="email"
                className={`mt-[6px] w-full rounded-[1.2rem] border px-4 py-3 text-[16px] text-[#1d2823] outline-none transition focus:border-[#4158f4] md:text-[14px] focus:ring-[3px] focus:ring-[#edf0fe] ${sendErr ? "border-[#c98a76]" : "border-[#d8ddd6]"}`}
                onChange={(e) => { setVal(e.target.value); if (sendErr) setSendErr(""); }}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="you@newdomain.com"
                type="email"
                value={val}
              />
              {sendErr && <p className="mt-[6px] text-[12.5px] leading-[1.45] text-[#9a3a23]">{sendErr}</p>}
            </label>
            <div className="mt-[14px] flex flex-wrap gap-2.5">
              <button
                className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#17352e] px-[18px] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
                disabled={!canSend}
                onClick={send}
                type="button"
              >
                {isSending ? <><Spinner size={15} /> Sending…</> : "Send verification email"}
              </button>
              <button
                className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-3 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                onClick={() => { setOpen(false); setVal(""); setSendErr(""); }}
                type="button"
              >
                Cancel
              </button>
            </div>
            <p className="mt-3 text-[13px] leading-[1.45] text-[#8b938c]">
              We&apos;ll send a confirmation link to the new address. Your current email stays active until you confirm.
            </p>
          </div>
        </>
      )}

      {/* unverified nudge */}
      {!emailVerified && (
        <div className="mt-3 rounded-[1.2rem] border border-[#e6d3a3] bg-[#f6edd9] px-[14px] py-[11px] text-[13px] leading-[1.5] text-[#7c5511]">
          Check your inbox for a verification link.{" "}
          {resendSent
            ? <span className="font-semibold">New link sent ✓</span>
            : <button
                className="font-semibold underline-offset-2 hover:underline disabled:opacity-50"
                disabled={isResending || resCooldown > 0}
                onClick={handleResend}
                type="button"
              >
                {isResending ? "Sending…" : resCooldown > 0 ? `Resend in ${resMmss}` : "Resend link"}
              </button>}
          {resendErr && <span className="ml-2 text-[#9a3a23]">{resendErr}</span>}
        </div>
      )}

      {toast && (
        <div className="mt-3 rounded-[1.2rem] border border-[#bcdac9] bg-[#e7efe9] px-[14px] py-[11px] text-[13.5px] text-[#17352e]">
          {toast}
        </div>
      )}
    </section>
  );
}

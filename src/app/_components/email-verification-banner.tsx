"use client";

import { useState, useTransition } from "react";

import { resendVerificationEmail } from "~/app/actions/account";

export function EmailVerificationBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [isPending, startTransition] = useTransition();

  if (dismissed) return null;

  const handleResend = () => {
    startTransition(async () => {
      setError(null);
      const result = await resendVerificationEmail();
      if ("success" in result) {
        setSent(true);
        setCooldown(300);
        setTimeout(() => setSent(false), 5000);
      } else {
        setError(
          result.error === "RATE_LIMIT_EXCEEDED"
            ? "Please wait a few minutes."
            : "Something went wrong.",
        );
      }
    });
  };

  return (
    /* st-vbanner: amber-50 bg, amber-200 border-bottom, 4px amber-500 left accent */
    <div className="z-[19] flex shrink-0 items-center gap-3 border-b border-[#e6d3a3] bg-[#f6edd9] px-[18px] py-[11px]"
      style={{ borderLeft: "4px solid #bf8526" }}>
      <svg className="mt-px h-4 w-4 shrink-0 text-[#bf8526]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M3.5 6h17v12h-17z" />
        <path d="M4 6.5l8 6 8-6" />
      </svg>
      <p className="flex-1 text-[13px] text-[#1d2823]">
        Please verify your email address — we sent a link to{" "}
        <strong className="font-semibold">{email}</strong>.{" "}
        {sent ? (
          <span className="font-semibold text-[#17352e]">Link sent ✓</span>
        ) : cooldown > 0 ? (
          <span className="text-[#8b938c]">
            Resend in {Math.floor(cooldown / 60)}:{String(cooldown % 60).padStart(2, "0")}
          </span>
        ) : (
          <button
            className="font-semibold text-[#4158f4] underline-offset-2 hover:underline disabled:opacity-50"
            disabled={isPending}
            onClick={handleResend}
            type="button"
          >
            {isPending ? "Sending…" : "Resend verification"}
          </button>
        )}
        {error ? <span className="ml-2 text-[#9a3a23]">{error}</span> : null}
      </p>
      <button
        aria-label="Dismiss"
        className="ml-2 shrink-0 text-[#bf8526] transition hover:text-[#7c5511]"
        onClick={() => setDismissed(true)}
        type="button"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

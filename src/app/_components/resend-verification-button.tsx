"use client";

import { useState, useTransition } from "react";

import { resendVerificationEmail } from "~/app/actions/account";

// Resend the sign-up verification link from a page that needs a verified
// address before it can continue (e.g. accepting a family/team invite).
export function ResendVerificationButton() {
  const [state, setState] = useState<"idle" | "sent" | "wait" | "error">("idle");
  const [isPending, startTransition] = useTransition();

  const resend = () =>
    startTransition(async () => {
      const result = await resendVerificationEmail();
      if ("success" in result) setState("sent");
      else setState(result.error === "RATE_LIMIT_EXCEEDED" ? "wait" : "error");
    });

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <button
        className="w-full rounded-[10px] bg-[#4158f4] py-3 text-[14px] font-semibold text-white transition hover:bg-[#3248db] disabled:cursor-default disabled:opacity-60"
        disabled={isPending || state === "sent"}
        onClick={resend}
        type="button"
      >
        {state === "sent" ? "Link sent ✓" : isPending ? "Sending…" : "Resend verification link"}
      </button>
      <p aria-live="polite" className="min-h-[1.2em] text-[12.5px] text-[#646c65]">
        {state === "wait"
          ? "Please wait a few minutes before asking again."
          : state === "error"
            ? "Something went wrong. Try again from Settings → Account."
            : null}
      </p>
    </div>
  );
}

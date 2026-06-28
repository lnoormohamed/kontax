"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { requestPasswordReset } from "~/app/actions/auth";

function MailIcon() {
  return (
    <svg
      aria-hidden
      fill="none"
      height="22"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.9"
      viewBox="0 0 24 24"
      width="22"
    >
      <path d="M3.5 6h17v12h-17z" />
      <path d="M4 6.5l8 6 8-6" />
    </svg>
  );
}

export function ForgotPasswordCard() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canSubmit = Boolean(email.trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || isPending) return;

    startTransition(async () => {
      await requestPasswordReset(email);
      setSubmittedEmail(email.trim());
      setSubmitted(true);
    });
  };

  return (
    <div className="w-full max-w-[440px] rounded-[24px] border border-[#d8ddd6]/70 bg-white px-10 py-10 shadow-[0_18px_50px_rgba(29,40,35,0.12),0_2px_8px_rgba(29,40,35,0.06)]">
      <Link
        aria-label="Kontax home"
        className="flex items-center justify-center gap-[10px]"
        href="/"
      >
        <span
          aria-hidden
          className="grid h-[34px] w-[34px] place-items-center rounded-[10px] text-[19px] font-bold leading-none text-[#dff0e7]"
          style={{ background: "#17352e" }}
        >
          K
        </span>
        <span className="text-[25px] font-semibold tracking-[-0.018em] text-[#17352e]">
          Kontax
        </span>
      </Link>

      <div className="mx-auto mt-5 mb-[22px] h-px w-14 bg-[#d8ddd6]" />

      {!submitted ? (
        <>
          <h1 className="text-center text-[22px] font-semibold leading-tight tracking-[-0.015em] text-[#1d2823]">
            Reset your password
          </h1>
          <p className="mt-[7px] text-center text-[14px] leading-[1.55] text-[#5c655e]">
            Enter the email you use for Kontax and we&apos;ll send you a secure
            reset link.
          </p>

          <form
            aria-busy={isPending}
            className="mt-[26px]"
            noValidate
            onSubmit={(e) => void handleSubmit(e)}
          >
            <fieldset
              className="flex flex-col gap-4 border-0 p-0 disabled:opacity-60"
              disabled={isPending}
            >
              <label className="flex flex-col">
                <span className="mb-[7px] text-[13px] font-medium text-[#3f4842]">
                  Email address
                </span>
                <input
                  autoComplete="email"
                  autoFocus
                  className="h-11 w-full rounded-[12px] border border-[#d8ddd6] bg-white px-4 text-[16px] text-[#1d2823] outline-none transition-[border-color,box-shadow] placeholder:text-[#aab1a9] focus:border-[#4158f4] focus:shadow-[0_0_0_3px_rgba(65,88,244,0.28)]"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>

              <button
                aria-busy={isPending}
                className="mt-2 flex h-12 w-full items-center justify-center rounded-[12px] bg-[#4158f4] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8] active:translate-y-px active:bg-[#2a3abf] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSubmit || isPending}
                type="submit"
              >
                {isPending ? "Sending..." : "Send reset link"}
              </button>
            </fieldset>
          </form>

          <p className="mt-4 text-center text-[13px] leading-[1.5] text-[#8b938c]">
            We&apos;ll only send the link if the address matches an existing
            account.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e7efe9] text-[#17352e]">
            <MailIcon />
          </div>
          <h1 className="mt-4 text-center text-[22px] font-semibold leading-tight tracking-[-0.015em] text-[#1d2823]">
            Check your inbox
          </h1>
          <p className="mt-[7px] text-center text-[14px] leading-[1.6] text-[#5c655e]">
            If an account exists for{" "}
            <strong className="font-semibold text-[#1d2823]">
              {submittedEmail}
            </strong>
            , we&apos;ve sent a password reset link. It expires in 15 minutes.
          </p>
          <div className="mt-5 rounded-[1.2rem] border border-[#bcdac9] bg-[#e7efe9] px-4 py-3 text-[13.5px] leading-[1.5] text-[#17352e]">
            For security, this screen always looks the same whether or not the
            email address is registered.
          </div>
        </>
      )}

      <div className="mt-[22px] text-center text-[14px] text-[#5c655e]">
        {submitted ? (
          <>
            Didn&apos;t get it?{" "}
            <button
              className="font-medium text-[#4158f4] hover:underline"
              onClick={() => setSubmitted(false)}
              type="button"
            >
              Send another link
            </button>
          </>
        ) : (
          <>
            Remembered it?{" "}
            <Link className="font-medium text-[#4158f4] hover:underline" href="/login">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

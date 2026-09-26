"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { requestPasswordReset } from "~/app/actions/auth";
import {
  AuthBrand,
  authBtnPrimary,
  authCard,
  authInput,
  authLabel,
  authLede,
  authLink,
  authNoteOk,
  authTitle,
} from "~/app/_components/auth-ui";

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
    <div className={authCard}>
      <AuthBrand />

      {!submitted ? (
        <>
          <h1 className={authTitle}>
            Reset your password
          </h1>
          <p className={authLede}>
            Enter the email you use for Kontax and we&apos;ll send you a secure
            reset link.
          </p>

          <form
            aria-busy={isPending}
            className="mt-7"
            noValidate
            onSubmit={(e) => void handleSubmit(e)}
          >
            <fieldset
              className="flex flex-col gap-4 border-0 p-0 disabled:opacity-60"
              disabled={isPending}
            >
              <label className="flex flex-col">
                <span className={authLabel}>
                  Email address
                </span>
                <input
                  autoComplete="email"
                  autoFocus
                  className={authInput()}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>

              <button
                aria-busy={isPending}
                className={`mt-2 ${authBtnPrimary}`}
                disabled={!canSubmit || isPending}
                type="submit"
              >
                {isPending ? "Sending…" : "Send reset link"}
              </button>
            </fieldset>
          </form>

          <p className="mt-4 text-center text-[13px] leading-[1.5] text-[#646c65]">
            We&apos;ll only send the link if the address matches an existing
            account.
          </p>
        </>
      ) : (
        <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0eb] text-[#17352e]">
            <MailIcon />
          </div>
          <h1 className={`mt-4 ${authTitle}`}>
            Check your inbox
          </h1>
          <p className={authLede}>
            If an account exists for{" "}
            <strong className="break-words font-semibold text-[#1d2823]">
              {submittedEmail}
            </strong>
            , we&apos;ve sent a password reset link. It expires in 15 minutes.
          </p>
          <div className={`mt-5 ${authNoteOk}`}>
            For security, this screen always looks the same whether or not the
            email address is registered.
          </div>
        </>
      )}

      <div className="mt-6 text-center text-[14.5px] text-[#4e5851]">
        {submitted ? (
          <>
            Didn&apos;t get it?{" "}
            <button
              className={authLink}
              onClick={() => setSubmitted(false)}
              type="button"
            >
              Send another link
            </button>
          </>
        ) : (
          <>
            Remembered it?{" "}
            <Link className={authLink} href="/login">
              Back to login
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { requestPasswordReset } from "~/app/actions/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      await requestPasswordReset(email);
      setSubmitted(true);
    });
  };

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10">
      {/* Background */}
      <div aria-hidden className="fixed inset-0 -z-10" style={{ backgroundColor: "#eef1ec", backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 36%, rgba(23,53,46,0.10) 0%, rgba(23,53,46,0) 70%)" }} />

      <Link className="flex items-center gap-2.5" href="/">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">K</span>
        <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
      </Link>

      <div className="w-full max-w-[400px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
        {!submitted ? (
          <>
            <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">Forgot your password?</h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#5c655e]">
              Enter your email address and we&apos;ll send you a reset link.
            </p>
            <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
              <label className="block">
                <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Email address</span>
                <input
                  autoComplete="email"
                  autoFocus
                  className="mt-[6px] w-full rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-3 text-[14px] text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe]"
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  value={email}
                />
              </label>
              <button
                className="w-full rounded-[1.2rem] bg-[#17352e] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
                disabled={!email.trim() || isPending}
                type="submit"
              >
                {isPending ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <div className="mt-4 text-center">
              <Link className="text-[13px] font-medium text-[#5c655e] transition hover:text-[#4158f4]" href="/login">
                ← Back to login
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e7efe9]">
              <svg fill="none" height="22" stroke="#17352e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22"><path d="M3.5 6h17v12h-17z" /><path d="M4 6.5l8 6 8-6" /></svg>
            </div>
            <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">Check your inbox</h1>
            <p className="mt-2 text-[14px] leading-[1.55] text-[#5c655e]">
              If an account exists for <strong className="font-semibold">{email}</strong>, we&apos;ve sent a reset link. It expires in 15 minutes.
            </p>
            <p className="mt-3 text-[13px] text-[#8b938c]">
              Didn&apos;t receive it?{" "}
              <button
                className="font-semibold text-[#4158f4] underline-offset-2 hover:underline"
                onClick={() => setSubmitted(false)}
                type="button"
              >
                Try again
              </button>
            </p>
            <div className="mt-5 text-center">
              <Link className="text-[13px] font-medium text-[#5c655e] transition hover:text-[#4158f4]" href="/login">
                ← Back to login
              </Link>
            </div>
          </>
        )}
      </div>

      <p className="text-[12px] text-[#8b938c]">© Kontax · Your contacts, organized and yours.</p>
    </main>
  );
}

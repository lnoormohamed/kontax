"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { resetPassword } from "~/app/actions/auth";

function EyeIcon({ visible }: { visible: boolean }) {
  return visible ? (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M9.9 4.24A9.1 9.1 0 0112 4c6.5 0 10 7 10 7a18.5 18.5 0 01-2.16 3.19" />
      <path d="M6.61 6.61A18.5 18.5 0 002 12s3.5 7 10 7a9.1 9.1 0 003.06-.53" />
      <path d="M9.88 9.88a3 3 0 004.24 4.24" /><line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  ) : (
    <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_INVALID: "This link is invalid or has already been used.",
  TOKEN_EXPIRED: "This link has expired. Please request a new one.",
  PASSWORD_TOO_SHORT: "Password must be at least 8 characters.",
};

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const mismatch = confirm.length > 0 && confirm !== password;
  const canSubmit = password.length >= 8 && password === confirm && !isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await resetPassword({ plaintextToken: token, newPassword: password });
      if ("success" in result) {
        router.push("/login?message=password-reset");
      } else {
        setError(ERROR_MESSAGES[result.error] ?? "Something went wrong.");
      }
    });
  };

  return (
    <div className="w-full max-w-[400px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
      <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">Set a new password</h1>
      <p className="mt-2 text-[14px] leading-[1.55] text-[#5c655e]">Choose a strong password. You&apos;ll be signed in automatically.</p>

      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">New password</span>
          <div className="relative mt-[6px]">
            <input
              autoComplete="new-password"
              autoFocus
              className="w-full rounded-[1.2rem] border border-[#d8ddd6] bg-white px-4 py-3 pr-11 text-[16px] text-[#1d2823] outline-none transition focus:border-[#4158f4] focus:ring-[3px] focus:ring-[#edf0fe]"
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              type={showPw ? "text" : "password"}
              value={password}
            />
            <button aria-label="Toggle visibility" className="absolute right-[10px] top-1/2 grid h-[30px] w-[30px] -translate-y-1/2 place-items-center rounded-lg text-[#8b938c] hover:text-[#5c655e]" onClick={() => setShowPw((s) => !s)} tabIndex={-1} type="button">
              <EyeIcon visible={showPw} />
            </button>
          </div>
        </label>
        <label className="block">
          <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#8b938c]">Confirm new password</span>
          <input
            autoComplete="new-password"
            className={`mt-[6px] w-full rounded-[1.2rem] border px-4 py-3 text-[16px] text-[#1d2823] outline-none transition focus:ring-[3px] focus:ring-[#edf0fe] ${mismatch ? "border-[#c98a76] focus:border-[#c98a76]" : "border-[#d8ddd6] focus:border-[#4158f4]"}`}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter new password"
            required
            type="password"
            value={confirm}
          />
          {mismatch && <p className="mt-[6px] text-[12.5px] text-[#9a3a23]">Passwords don&apos;t match.</p>}
        </label>
        {error && (
          <p className="rounded-[12px] border border-[#ecd0c7] bg-[#f7e9e4] px-[14px] py-[11px] text-[13.5px] text-[#8f3320]">{error}</p>
        )}
        <button
          className="w-full rounded-[1.2rem] bg-[#17352e] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
          disabled={!canSubmit}
          type="submit"
        >
          {isPending ? "Resetting…" : "Reset password"}
        </button>
      </form>
      <div className="mt-4 text-center">
        <Link className="text-[13px] font-medium text-[#5c655e] transition hover:text-[#4158f4]" href="/login">← Back to login</Link>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { resetPassword } from "~/app/actions/auth";
import {
  AuthBrand,
  authBtnPrimary,
  authCard,
  authFieldError,
  authFocus,
  authInput,
  authLabel,
  authLede,
  authNoteErr,
  authQuietLink,
  authTitle,
} from "~/app/_components/auth-ui";

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
    <div className={authCard}>
      <AuthBrand />
      <h1 className={authTitle}>Set a new password</h1>
      <p className={authLede}>Choose a strong password. You&apos;ll be signed in automatically.</p>

      <form className="mt-7 grid gap-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className={`block ${authLabel}`}>New password</span>
          <div className="relative">
            <input
              autoComplete="new-password"
              autoFocus
              className={`${authInput()} pr-[50px]`}
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              type={showPw ? "text" : "password"}
              value={password}
            />
            <button aria-label="Toggle visibility" className={`absolute right-[5px] top-1/2 grid h-[38px] w-[38px] -translate-y-1/2 place-items-center rounded-[8px] text-[#646c65] transition hover:bg-[#f4f1ea] hover:text-[#1d2823] ${authFocus}`} onClick={() => setShowPw((s) => !s)} tabIndex={-1} type="button">
              <EyeIcon visible={showPw} />
            </button>
          </div>
        </label>
        <label className="block">
          <span className={`block ${authLabel}`}>Confirm new password</span>
          <input
            autoComplete="new-password"
            className={authInput(mismatch)}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Re-enter new password"
            required
            type="password"
            value={confirm}
          />
          {mismatch && <p className={authFieldError}>Passwords don&apos;t match.</p>}
        </label>
        {error && (
          <p className={authNoteErr}>{error}</p>
        )}
        <button
          className={`mt-2 ${authBtnPrimary}`}
          disabled={!canSubmit}
          type="submit"
        >
          {isPending ? "Resetting…" : "Reset password"}
        </button>
      </form>
      <div className="mt-6 text-center">
        <Link className={`text-[14px] ${authQuietLink}`} href="/login">← Back to login</Link>
      </div>
    </div>
  );
}

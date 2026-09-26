"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRef, useState } from "react";

import {
  AuthBrand,
  authBtnPrimary,
  authCard,
  authFieldError,
  authFocus,
  authInput,
  authLabel,
  authLede,
  authLink,
  authNoteErr,
  authNoteOk,
  authNoteWarn,
  authQuietLink,
  authTitle,
} from "~/app/_components/auth-ui";
import { safeInternalPath } from "~/lib/safe-internal-path";

// ── Password strength ──────────────────────────────────────────────────────
function scorePassword(pw: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!pw) return { level: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (pw.length < 8) return { level: 1, label: "Weak" };
  if (score <= 1) return { level: 1, label: "Weak" };
  if (score === 2) return { level: 2, label: "Fair" };
  return { level: 3, label: "Strong" };
}

const STRENGTH_COLORS: Record<number, string> = {
  0: "#d4d9d0",
  1: "#b3261e",
  2: "#9a6a12",
  3: "#2f6b52",
};

function StrengthMeter({ password }: { password: string }) {
  const { level, label } = scorePassword(password);
  if (!password) return null;
  return (
    <div aria-live="polite" className="mt-2 flex items-center gap-2.5">
      <div className="flex flex-1 gap-[5px]">
        {[1, 2, 3].map((seg) => (
          <span
            key={seg}
            className="h-1 flex-1 rounded-sm transition-colors duration-200"
            style={{
              background: seg <= level ? STRENGTH_COLORS[level] : "#e5e8e1",
            }}
          />
        ))}
      </div>
      <span
        className="min-w-[42px] text-right text-[12px] font-semibold"
        style={{ color: STRENGTH_COLORS[level] }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Eye toggle icon ────────────────────────────────────────────────────────
function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg
      aria-hidden
      fill="none"
      height={18}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={18}
    >
      <path d="M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M6.61 6.61A18.5 18.5 0 0 0 2 12s3.5 7 10 7a9.1 9.1 0 0 0 3.06-.53" />
      <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  ) : (
    <svg
      aria-hidden
      fill="none"
      height={18}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      viewBox="0 0 24 24"
      width={18}
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ── Warning icon ───────────────────────────────────────────────────────────
function WarnIcon() {
  return (
    <svg
      aria-hidden
      className="mt-px shrink-0 text-[#b3261e]"
      fill="none"
      height={16}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.9}
      viewBox="0 0 24 24"
      width={16}
    >
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" x2="12" y1="9" y2="13" />
      <line x1="12" x2="12.01" y1="17" y2="17" />
    </svg>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

// ── Field ──────────────────────────────────────────────────────────────────
function Field({
  id,
  label,
  hint,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  error,
  trailing,
  disabled,
}: {
  id: string;
  label: string;
  hint?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: React.ReactNode;
  trailing?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <label className={authLabel} htmlFor={id}>
        {label}
        {hint ? <span className="font-normal text-[#646c65]"> {hint}</span> : null}
      </label>
      <div className={`relative ${trailing ? "has-trailing" : ""}`}>
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? "true" : undefined}
          autoComplete={autoComplete}
          className={`${authInput(Boolean(error))} ${trailing ? "pr-[50px]" : ""}`}
          disabled={disabled}
          id={id}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
        {trailing}
      </div>
      {error ? (
        <p className={authFieldError} id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export function AuthCard({
  mode,
  next,
  message,
  plan,
  expired = false,
}: {
  mode: "login" | "register";
  next?: string;
  message?: string;
  /** Pre-selected plan from ?plan= — "pro" shows a 14-day trial callout. */
  plan?: string;
  /** True when redirected from an authenticated route with ?expired=1 — session ended. */
  expired?: boolean;
}) {
  const isLogin = mode === "login";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // errors
  const [formError, setFormError] = useState("");
  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState<"exists" | ""| (string & Record<never, never>)>("");
  const [pwError, setPwError] = useState("");

  const errorBoxRef = useRef<HTMLDivElement>(null);

  const canSubmit = isLogin
    ? Boolean(email.trim() && password)
    : Boolean(name.trim() && email.trim() && password);

  const switchHref = isLogin
    ? next ? `/register?next=${encodeURIComponent(next)}` : "/register"
    : next ? `/login?next=${encodeURIComponent(next)}` : "/login";

  const clearErrors = () => {
    setFormError("");
    setNameError("");
    setEmailError("");
    setPwError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !canSubmit) return;
    clearErrors();

    if (!isLogin) {
      if (!name.trim()) { setNameError("Please enter your name."); return; }
      if (password.length < 8) { setPwError("Password must be at least 8 characters."); return; }
    }

    setSubmitting(true);

    if (isLogin) {
      // The client signIn (next-auth/react) RETURNS { error } on bad credentials
      // with redirect:false — it does not throw. Check the result; keep the catch
      // as a fallback for unexpected failures.
      let signInError = "";
      let signInCode = "";
      try {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) {
          signInError = result.error;
          signInCode = result.code ?? "";
        }
      } catch {
        signInError = "CredentialsSignin";
      }
      if (signInError) {
        setFormError(
          signInCode === "account_locked"
            ? "Your account has been suspended. Contact support."
            : "Incorrect email or password. Please try again.",
        );
        setSubmitting(false);
        setTimeout(() => errorBoxRef.current?.focus(), 0);
        return;
      }
      // P48-01: a correct password on a 2FA-enabled account yields a session
      // that still owes the TOTP challenge. Ask the server which case we are in
      // and route to the challenge page; the server refuses the pending session
      // everywhere else, so this is UX, not the security boundary.
      const state = await fetch("/api/auth/session", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : null))
        .then((s: { pendingTotp?: boolean; pendingDeletion?: boolean } | null) => s)
        .catch(() => null);
      if (state?.pendingTotp === true) {
        window.location.assign(
          next ? `/login/verify-2fa?next=${encodeURIComponent(next)}` : "/login/verify-2fa",
        );
        return;
      }
      // P48-02: an account inside its deletion grace period lands on the cancel
      // screen instead of the app (the server enforces the same thing).
      if (state?.pendingDeletion === true) {
        window.location.assign("/account-pending-deletion");
        return;
      }
      // Hard navigation so the freshly-set session cookie is sent and the server
      // re-renders the destination. router.push can show a stale logged-out view.
      // P48-03: `next` reaches this component as a prop — re-validate it here so
      // an open redirect can never depend on a single upstream check.
      window.location.assign(safeInternalPath(next, "/contacts"));
    } else {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null) as { message?: string } | null;
        if (res.status === 409) {
          setEmailError("exists");
        } else {
          setFormError(data?.message ?? "Something went wrong. Please try again.");
          setTimeout(() => errorBoxRef.current?.focus(), 0);
        }
        setSubmitting(false);
        return;
      }

      let signInFailed = false;
      try {
        const result = await signIn("credentials", { email, password, redirect: false });
        if (result?.error) signInFailed = true;
      } catch {
        signInFailed = true;
      }
      if (signInFailed) {
        setFormError("Account created but login didn't complete. Please log in.");
        setSubmitting(false);
        return;
      }
      // Hard navigation so the freshly-set session cookie is sent and the server
      // re-renders the destination. router.push can show a stale logged-out view.
      window.location.assign(safeInternalPath(next, "/contacts"));
    }
  };

  const eyeBtn = (
    <button
      aria-label={showPw ? "Hide password" : "Show password"}
      className={`absolute right-[5px] top-1/2 flex h-[38px] w-[38px] -translate-y-1/2 items-center justify-center rounded-[8px] text-[#646c65] transition hover:bg-[#f4f1ea] hover:text-[#1d2823] ${authFocus}`}
      onClick={() => setShowPw((v) => !v)}
      tabIndex={submitting ? -1 : 0}
      type="button"
    >
      <EyeIcon off={showPw} />
    </button>
  );

  return (
    <div className={authCard}>
      {/* Brand mark — links back to the marketing homepage */}
      <AuthBrand />

      {/* Heading */}
      <h1 className={authTitle}>
        {isLogin ? "Log in to Kontax" : "Create your account"}
      </h1>
      <p className={authLede}>
        {isLogin ? "Pick up right where you left off." : "Your contacts, organised and yours."}
      </p>

      {/* Message banners (password-reset, email-changed) */}
      {message === "password-reset" && (
        <div className={`mt-5 text-center ${authNoteOk}`}>
          Your password has been reset. Please sign in with your new password.
        </div>
      )}
      {message === "email-changed" && (
        <div className={`mt-5 text-center ${authNoteOk}`}>
          Your email has been updated. Please sign in with your new address.
        </div>
      )}
      {/* Session-expired: had a valid session, token is now expired/invalidated */}
      {!message && expired && isLogin && (
        <div className={`mt-5 ${authNoteWarn}`}>
          <p className="font-semibold">Your session ended</p>
          <p className="mt-0.5 leading-[1.45]">Sign back in and you&rsquo;ll return right where you left off.</p>
        </div>
      )}
      {/* Auth-required: accessing a protected route without a session */}
      {!message && !expired && next && isLogin && (
        <div className={`mt-5 text-center ${authNoteWarn}`}>
          Sign in to access this page.
        </div>
      )}

      {/* Trial callout — register with ?plan=pro */}
      {!isLogin && plan === "pro" ? (
        <div className={`mt-5 flex items-start gap-2.5 ${authNoteOk}`}>
          <svg aria-hidden className="mt-[2px] h-[17px] w-[17px] shrink-0" fill="none" stroke="#2f6b52" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" viewBox="0 0 24 24">
            <path d="M12 3l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.8 6.1 20.8l1.3-6.5L2.5 9.8 9.1 9z" />
          </svg>
          <span>
            <strong className="font-semibold">14-day free Pro trial included</strong> — all Pro features, no card required to start.
          </span>
        </div>
      ) : null}

      {/* Form */}
      <form
        aria-busy={submitting}
        className="mt-7"
        noValidate
        onSubmit={(e) => void handleSubmit(e)}
      >
        <fieldset className="flex flex-col gap-4 border-0 p-0 disabled:opacity-60" disabled={submitting}>
          {/* Name — register only */}
          {!isLogin ? (
            <Field
              autoComplete="name"
              error={nameError || undefined}
              id="name"
              label="Your name"
              onChange={(v) => { setName(v); if (nameError) setNameError(""); }}
              placeholder="e.g. Alex Chen"
              value={name}
            />
          ) : null}

          {/* Email */}
          <Field
            autoComplete="email"
            error={
              emailError === "exists" ? (
                <span>
                  An account with this email already exists.{" "}
                  <Link
                    className={authLink}
                    href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                  >
                    Log in instead →
                  </Link>
                </span>
              ) : emailError || undefined
            }
            id="email"
            label="Email address"
            onChange={(v) => { setEmail(v); if (emailError) setEmailError(""); }}
            placeholder="you@example.com"
            type="email"
            value={email}
          />

          {/* Password */}
          <div>
            <Field
              autoComplete={isLogin ? "current-password" : "new-password"}
              error={pwError || undefined}
              id="password"
              label="Password"
              onChange={(v) => { setPassword(v); if (pwError) setPwError(""); }}
              placeholder={isLogin ? "Enter your password" : "At least 8 characters"}
              trailing={eyeBtn}
              type={showPw ? "text" : "password"}
              value={password}
            />
            {!isLogin ? <StrengthMeter password={password} /> : null}
          </div>

          {/* Forgot password — login only */}
          {isLogin ? (
            <div className="-mt-1 flex justify-end">
              <a
                className={`text-[14px] ${authQuietLink}`}
                href="/forgot-password"
              >
                Forgot password?
              </a>
            </div>
          ) : null}

          {/* CTA */}
          <button
            aria-busy={submitting}
            className={`mt-2 ${authBtnPrimary}`}
            disabled={!canSubmit || submitting}
            type="submit"
          >
            {submitting ? <Spinner /> : isLogin ? "Log in" : "Create account"}
          </button>

          {/* Terms — register only */}
          {!isLogin ? (
            <p className="-mt-1 text-center text-[13px] leading-[1.5] text-[#646c65]">
              By creating an account, you agree to our{" "}
              <a className={`font-medium text-[#4e5851] underline decoration-[#d4d9d0] underline-offset-[3px] hover:text-[#17352e] hover:decoration-[#17352e] rounded-[3px] ${authFocus}`} href="/terms">
                Terms
              </a>{" "}
              and{" "}
              <a className={`font-medium text-[#4e5851] underline decoration-[#d4d9d0] underline-offset-[3px] hover:text-[#17352e] hover:decoration-[#17352e] rounded-[3px] ${authFocus}`} href="/privacy">
                Privacy Policy
              </a>
              .
            </p>
          ) : null}
        </fieldset>

        {/* Form-level error */}
        {formError ? (
          <div
            ref={errorBoxRef}
            className={`mt-4 flex items-start gap-[9px] ${authNoteErr} ${authFocus}`}
            role="alert"
            tabIndex={-1}
          >
            <WarnIcon />
            <span>{formError}</span>
          </div>
        ) : null}
      </form>

      {/* Mode switch */}
      <p className="mt-6 text-center text-[14.5px] text-[#4e5851]">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <Link
          className={authLink}
          href={switchHref}
        >
          {isLogin ? "Create one →" : "Log in →"}
        </Link>
      </p>
    </div>
  );
}

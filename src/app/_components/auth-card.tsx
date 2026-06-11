"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

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
  0: "#d8ddd6",
  1: "#b5472f",
  2: "#bf8526",
  3: "#2f8f63",
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
              background: seg <= level ? STRENGTH_COLORS[level] : "#e7eae4",
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
      className="mt-px shrink-0 text-[#b5472f]"
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
      <label className="mb-[7px] text-[13px] font-medium text-[#3f4842]" htmlFor={id}>
        {label}
        {hint ? <span className="font-normal text-[#8b938c]"> {hint}</span> : null}
      </label>
      <div className={`relative ${trailing ? "has-trailing" : ""}`}>
        <input
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={error ? "true" : undefined}
          autoComplete={autoComplete}
          className={`h-11 w-full rounded-[12px] border bg-white px-4 text-[14px] text-[#1d2823] outline-none transition-[border-color,box-shadow] placeholder:text-[#aab1a9] ${
            error
              ? "border-[#b5472f] focus:border-[#b5472f] focus:shadow-[0_0_0_3px_rgba(181,71,47,0.22)]"
              : "border-[#d8ddd6] focus:border-[#4158f4] focus:shadow-[0_0_0_3px_rgba(65,88,244,0.28)]"
          } ${trailing ? "pr-[46px]" : ""} disabled:opacity-60`}
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
        <p className="mt-[7px] text-[12.5px] leading-[1.45] text-[#8f3320]" id={`${id}-error`} role="alert">
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
}: {
  mode: "login" | "register";
  next?: string;
  message?: string;
}) {
  const router = useRouter();
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
      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setFormError("Incorrect email or password. Please try again.");
        setSubmitting(false);
        setTimeout(() => errorBoxRef.current?.focus(), 0);
        return;
      }
      router.push(next ?? "/");
      router.refresh();
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

      const result = await signIn("credentials", { email, password, redirect: false });
      if (result?.error) {
        setFormError("Account created but login didn't complete. Please log in.");
        setSubmitting(false);
        return;
      }
      router.push(next ?? "/");
      router.refresh();
    }
  };

  const eyeBtn = (
    <button
      aria-label={showPw ? "Hide password" : "Show password"}
      className="absolute right-[4px] top-1/2 flex h-[38px] w-[38px] -translate-y-1/2 items-center justify-center rounded-[9px] text-[#8b938c] transition hover:bg-[#f2f4f0] hover:text-[#5c655e]"
      onClick={() => setShowPw((v) => !v)}
      tabIndex={submitting ? -1 : 0}
      type="button"
    >
      <EyeIcon off={showPw} />
    </button>
  );

  return (
    <div className="w-full max-w-[440px] rounded-[24px] border border-[#d8ddd6]/70 bg-white px-10 py-10 shadow-[0_18px_50px_rgba(29,40,35,0.12),0_2px_8px_rgba(29,40,35,0.06)]">
      {/* Brand mark */}
      <div className="flex items-center justify-center gap-[10px]">
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
      </div>

      {/* Rule */}
      <div className="mx-auto mt-5 mb-[22px] h-px w-14 bg-[#d8ddd6]" />

      {/* Heading */}
      <h1 className="text-center text-[22px] font-semibold leading-tight tracking-[-0.015em] text-[#1d2823]">
        {isLogin ? "Log in to Kontax" : "Create your account"}
      </h1>
      <p className="mt-[7px] text-center text-[14px] text-[#5c655e]">
        {isLogin ? "Pick up right where you left off." : "Your contacts, organized and yours."}
      </p>

      {/* Message banners (password-reset, email-changed) */}
      {message === "password-reset" && (
        <div className="mt-4 rounded-[1.2rem] border border-[#bcdac9] bg-[#e7efe9] px-4 py-3 text-center text-[13.5px] text-[#17352e]">
          Your password has been reset. Please sign in with your new password.
        </div>
      )}
      {message === "email-changed" && (
        <div className="mt-4 rounded-[1.2rem] border border-[#bcdac9] bg-[#e7efe9] px-4 py-3 text-center text-[13.5px] text-[#17352e]">
          Your email has been updated. Please sign in with your new address.
        </div>
      )}

      {/* Form */}
      <form
        aria-busy={submitting}
        className="mt-[26px]"
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
                    className="font-semibold text-[#4158f4] hover:underline"
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
                className="text-[13px] font-medium text-[#5c655e] transition hover:text-[#4158f4]"
                href="/forgot-password"
              >
                Forgot password?
              </a>
            </div>
          ) : null}

          {/* CTA */}
          <button
            aria-busy={submitting}
            className="mt-2 flex h-12 w-full items-center justify-center rounded-[12px] bg-[#4158f4] text-[14.5px] font-semibold text-white transition hover:bg-[#3347d8] active:translate-y-px active:bg-[#2a3abf] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSubmit || submitting}
            type="submit"
          >
            {submitting ? <Spinner /> : isLogin ? "Log in" : "Create account"}
          </button>

          {/* Terms — register only */}
          {!isLogin ? (
            <p className="-mt-1 text-center text-[12px] text-[#8b938c]">
              By creating an account, you agree to our{" "}
              <a className="text-[#5c655e] font-medium hover:text-[#4158f4] hover:underline" href="/terms">
                Terms
              </a>{" "}
              and{" "}
              <a className="text-[#5c655e] font-medium hover:text-[#4158f4] hover:underline" href="/privacy">
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
            className="mt-4 flex items-start gap-[9px] rounded-[11px] border border-[#ecd0c7] bg-[#f7e9e4] px-[14px] py-[11px] text-[13.5px] leading-[1.4] text-[#8f3320]"
            role="alert"
            tabIndex={-1}
          >
            <WarnIcon />
            <span>{formError}</span>
          </div>
        ) : null}
      </form>

      {/* Mode switch */}
      <p className="mt-[22px] text-center text-[14px] text-[#5c655e]">
        {isLogin ? "Don't have an account? " : "Already have an account? "}
        <Link
          className="font-medium text-[#4158f4] hover:underline disabled:opacity-50"
          href={switchHref}
        >
          {isLogin ? "Create one →" : "Log in →"}
        </Link>
      </p>
    </div>
  );
}

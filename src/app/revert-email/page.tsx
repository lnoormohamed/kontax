import { type Metadata } from "next";
import Link from "next/link";

import { revertEmailChange } from "~/server/email-change-revert";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Undo email change",
  robots: { index: false, follow: false },
};

/**
 * P48-03 — the "this wasn't me" landing page for the notice sent to the OLD
 * address.
 *
 * It lives at the top level, NOT under `/settings`, for two reasons: the
 * settings shell redirects anyone without a session to `/login`, and the person
 * clicking this link is by definition the one who may have just been locked out
 * of the account. The page must work signed-out.
 */
export default async function RevertEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = await revertEmailChange(token ?? "");

  const body = result.ok
    ? {
        tone: "ok" as const,
        title: result.wasActivated ? "Your email address is back" : "Email change cancelled",
        message: result.wasActivated
          ? `Your Kontax account has been restored to ${result.restoredEmail}, and every signed-in device has been signed out.`
          : `The pending change was cancelled — your account stays on ${result.restoredEmail} — and every signed-in device has been signed out.`,
        footer:
          "Because someone else may know your password, reset it now before signing back in.",
        cta: { href: "/forgot-password", label: "Reset my password →" },
      }
    : {
        tone: "error" as const,
        title:
          result.reason === "TOKEN_EXPIRED"
            ? "This link has expired"
            : result.reason === "EMAIL_TAKEN"
              ? "That address is no longer available"
              : "This link is no longer valid",
        message:
          result.reason === "TOKEN_EXPIRED"
            ? "Undo links are valid for 24 hours. If you still don't recognise the change, reset your password to secure the account."
            : result.reason === "EMAIL_TAKEN"
              ? "Your previous address has since been claimed by another account, so it can't be restored automatically. Please contact support."
              : "It may already have been used, or the change was cancelled another way. If you're unsure, reset your password to secure the account.",
        footer: null,
        cta: { href: "/forgot-password", label: "Reset my password →" },
      };

  return (
    <main
      className="flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10"
      style={{ backgroundColor: "#eef1ec" }}
    >
      <Link className="flex items-center gap-2.5" href="/">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">
          K
        </span>
        <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
      </Link>

      <div className="w-full max-w-[440px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 text-center shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: body.tone === "ok" ? "#e7efe9" : "#f7e9e4" }}
        >
          {body.tone === "ok" ? (
            <svg
              fill="none"
              height="22"
              stroke="#17352e"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="22"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg
              fill="none"
              height="22"
              stroke="#b5472f"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              width="22"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 8v5M12 16h.01" />
            </svg>
          )}
        </div>

        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">
          {body.title}
        </h1>
        <p className="mt-3 text-[14px] leading-[1.55] text-[#5c655e]">{body.message}</p>
        {body.footer && (
          <p className="mt-3 text-[13px] leading-[1.55] text-[#8b938c]">{body.footer}</p>
        )}

        <Link
          className="mt-5 inline-flex h-10 items-center rounded-full bg-[#17352e] px-5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
          href={body.cta.href}
        >
          {body.cta.label}
        </Link>
      </div>
    </main>
  );
}

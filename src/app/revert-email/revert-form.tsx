"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { RevertEmailChangeResult } from "~/server/email-change-revert";
import { confirmRevertEmailChange } from "./actions";

/**
 * P48 review (L3): the "this wasn't me" page. Renders a confirm button first;
 * the actual revert runs in a server action on submit, never on page load, so
 * mail-link scanners cannot trigger it.
 */
export function RevertEmailForm({ token }: { token: string }) {
  const [result, formAction, pending] = useActionState<RevertEmailChangeResult | null, FormData>(
    confirmRevertEmailChange,
    null,
  );

  if (!result) {
    return (
      <>
        <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">
          Undo this email change?
        </h1>
        <p className="mt-3 text-[14px] leading-[1.55] text-[#5c655e]">
          If you did not ask to change the email address on your Kontax account, confirm below.
          The change will be reversed and every signed-in device will be signed out.
        </p>
        <form action={formAction} className="mt-5">
          <input name="token" type="hidden" value={token} />
          <button
            className="inline-flex h-10 items-center rounded-full bg-[#17352e] px-5 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:opacity-60"
            disabled={pending || !token}
            type="submit"
          >
            {pending ? "Reverting…" : "Yes, undo the change"}
          </button>
        </form>
        {!token && (
          <p className="mt-3 text-[13px] leading-[1.55] text-[#8f3320]">
            This link is missing its token. Open it exactly as it appears in the email.
          </p>
        )}
      </>
    );
  }

  const body = result.ok
    ? {
        tone: "ok" as const,
        title: result.wasActivated ? "Your email address is back" : "Email change cancelled",
        message: result.wasActivated
          ? `Your Kontax account has been restored to ${result.restoredEmail}, and every signed-in device has been signed out.`
          : `The pending change was cancelled — your account stays on ${result.restoredEmail} — and every signed-in device has been signed out.`,
        footer: "Because someone else may know your password, reset it now before signing back in.",
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
      };

  return (
    <>
      <div
        className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
        style={{ backgroundColor: body.tone === "ok" ? "#e7efe9" : "#f7e9e4" }}
      >
        {body.tone === "ok" ? (
          <svg fill="none" height="22" stroke="#17352e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg fill="none" height="22" stroke="#b5472f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
        )}
      </div>
      <h1 className="m-0 text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">{body.title}</h1>
      <p className="mt-3 text-[14px] leading-[1.55] text-[#5c655e]">{body.message}</p>
      {body.footer && <p className="mt-3 text-[13px] leading-[1.55] text-[#8b938c]">{body.footer}</p>}
      <Link
        className="mt-5 inline-flex h-10 items-center rounded-full bg-[#17352e] px-5 text-[14px] font-semibold text-white transition hover:bg-[#20443b]"
        href="/forgot-password"
      >
        Reset my password →
      </Link>
    </>
  );
}

import { type Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AuthBrand,
  authBtnPrimary,
  authBtnSecondary,
  authCard,
  authLede,
  AuthShell,
  authTitle,
} from "~/app/_components/auth-ui";
import { verifyEmailToken } from "~/server/email-verification";

export const metadata: Metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) redirect("/login");

  const result = await verifyEmailToken(token);

  if ("success" in result) {
    // EMAIL_CHANGE: render a page instead of redirecting so the stale session
    // cookie (still present, edge JWT considers it valid) doesn't trigger a
    // /contacts → /login?next=/contacts → /contacts redirect loop.
    if (result.type === "EMAIL_CHANGE") {
      return (
        <AuthShell>
          <div className={`${authCard} text-center`}>
            <AuthBrand />
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0eb]">
              <svg className="h-6 w-6 text-[#17352e]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 className={authTitle}>Email address updated</h1>
            <p className={authLede}>
              Your new email address has been confirmed. Sign in with your new address to continue.
            </p>
            <Link
              className={`mt-6 ${authBtnPrimary}`}
              href="/login?message=email-changed"
            >
              Sign in →
            </Link>
          </div>
        </AuthShell>
      );
    }
    // Only SIGNUP reaches here
    return (
      <AuthShell>
        <div className={`${authCard} text-center`}>
        <AuthBrand />
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f0eb]">
            <svg className="h-6 w-6 text-[#17352e]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className={authTitle}>Email verified</h1>
          <p className={authLede}>
            Your email address has been confirmed. Your account is fully active.
          </p>
          <Link
            className={`mt-6 ${authBtnPrimary}`}
            href="/contacts"
          >
            Go to your contacts →
          </Link>
        </div>
      </AuthShell>
    );
  }

  const isExpired = result.error === "TOKEN_EXPIRED";
  return (
    <AuthShell>
      <div className={`${authCard} text-center`}>
        <AuthBrand />
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f6edd9]">
          <svg className="h-6 w-6 text-[#9a6a12]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className={authTitle}>
          {isExpired ? "Link expired" : "Invalid link"}
        </h1>
        <p className={authLede}>
          {isExpired
            ? "This verification link has expired. Request a new one from your account settings."
            : "This verification link is invalid or has already been used."}
        </p>
        <Link
          className={`mt-6 w-full ${authBtnSecondary}`}
          href="/settings/account"
        >
          Go to account settings
        </Link>
      </div>
    </AuthShell>
  );
}

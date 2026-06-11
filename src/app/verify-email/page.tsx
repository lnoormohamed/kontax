import Link from "next/link";
import { redirect } from "next/navigation";

import { verifyEmailToken } from "~/server/email-verification";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) redirect("/login");

  const result = await verifyEmailToken(token);

  if ("success" in result) {
    // EMAIL_CHANGE activates a new email + invalidates all sessions — send to login
    if (result.type === "EMAIL_CHANGE") {
      redirect("/login?message=email-changed");
    }
    // Only SIGNUP reaches here
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f4]">
        <div className="w-full max-w-[420px] rounded-2xl border border-[#d8ddd6] bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#e7efe9]">
            <svg className="h-6 w-6 text-[#17352e]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-[20px] font-semibold text-[#1d2823]">Email verified</h1>
          <p className="mt-2 text-[14px] text-[#5c655e]">
            Your email address has been confirmed. Your account is fully active.
          </p>
          <Link
            className="mt-6 inline-flex h-10 items-center rounded-full bg-[#4158f4] px-5 text-[14px] font-semibold text-white transition hover:bg-[#3248db]"
            href="/contacts"
          >
            Go to your contacts →
          </Link>
        </div>
      </div>
    );
  }

  const isExpired = result.error === "TOKEN_EXPIRED";
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f6f7f4]">
      <div className="w-full max-w-[420px] rounded-2xl border border-[#d8ddd6] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf3e7]">
          <svg className="h-6 w-6 text-[#bf8526]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-[20px] font-semibold text-[#1d2823]">
          {isExpired ? "Link expired" : "Invalid link"}
        </h1>
        <p className="mt-2 text-[14px] text-[#5c655e]">
          {isExpired
            ? "This verification link has expired. Request a new one from your account settings."
            : "This verification link is invalid or has already been used."}
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center rounded-full border border-[#d8ddd6] px-5 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
          href="/settings/account"
        >
          Go to account settings
        </Link>
      </div>
    </div>
  );
}

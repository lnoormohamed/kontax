import { type Metadata } from "next";
import crypto from "crypto";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Reset password" };

import { AuthBrand, authBtnSecondary, authCard, authLede, AuthShell, authTitle } from "~/app/_components/auth-ui";
import { db } from "~/server/db";
import { ResetPasswordForm } from "./reset-password-form";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) redirect("/forgot-password");

  // Server-side pre-validation before rendering the form
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hash },
    select: { usedAt: true, expiresAt: true },
  });

  const expired = row && !row.usedAt && row.expiresAt < new Date();
  const invalid = !row || row.usedAt;

  if (invalid || expired) {
    return (
      <AuthShell>
        <div className={`${authCard} text-center`}>
          <AuthBrand />
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#f6edd9]">
            <svg fill="none" height="22" stroke="#9a6a12" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
          </div>
          <h1 className={authTitle}>
            {expired ? "Link expired" : "Invalid link"}
          </h1>
          <p className={authLede}>
            {expired
              ? "Password reset links are only valid for 15 minutes."
              : "This link is invalid or has already been used."}
          </p>
          <Link className={`mt-6 w-full ${authBtnSecondary}`} href="/forgot-password">
            Request a new reset link →
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

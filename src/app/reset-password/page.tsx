import crypto from "crypto";
import Link from "next/link";
import { redirect } from "next/navigation";

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
      <main className="relative flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10">
        <div aria-hidden className="fixed inset-0 -z-10" style={{ backgroundColor: "#eef1ec", backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 36%, rgba(23,53,46,0.10) 0%, rgba(23,53,46,0) 70%)" }} />
        <Link className="flex items-center gap-2.5" href="/">
          <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">K</span>
          <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
        </Link>
        <div className="w-full max-w-[400px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 text-center shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf3e7]">
            <svg fill="none" height="22" stroke="#bf8526" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22"><path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" /><line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" /></svg>
          </div>
          <h1 className="m-0 text-[22px] font-semibold text-[#1d2823]">
            {expired ? "Link expired" : "Invalid link"}
          </h1>
          <p className="mt-2 text-[14px] leading-[1.55] text-[#5c655e]">
            {expired
              ? "Password reset links are only valid for 15 minutes."
              : "This link is invalid or has already been used."}
          </p>
          <Link
            className="mt-5 inline-flex h-10 items-center rounded-full border border-[#d8ddd6] px-5 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f6f7f4]"
            href="/forgot-password"
          >
            Request a new reset link →
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10">
      <div aria-hidden className="fixed inset-0 -z-10" style={{ backgroundColor: "#eef1ec", backgroundImage: "radial-gradient(ellipse 70% 55% at 50% 36%, rgba(23,53,46,0.10) 0%, rgba(23,53,46,0) 70%)" }} />
      <Link className="flex items-center gap-2.5" href="/">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">K</span>
        <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
      </Link>
      <ResetPasswordForm token={token} />
      <p className="text-[12px] text-[#8b938c]">© Kontax · Your contacts, organized and yours.</p>
    </main>
  );
}

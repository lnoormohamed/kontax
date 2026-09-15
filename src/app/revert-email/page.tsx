import { type Metadata } from "next";
import Link from "next/link";

import { RevertEmailForm } from "./revert-form";

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
 *
 * P48 review (L3): rendering this page does NOT revert anything. The token is
 * consumed only when the visitor submits the confirm form (a server action), so
 * link scanners and email prefetchers cannot cancel a legitimate change.
 */
export default async function RevertEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

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
        <RevertEmailForm token={typeof token === "string" ? token : ""} />
      </div>
      <p className="text-[12px] text-[#8b938c]">© Kontax · Your contacts, organized and yours.</p>
    </main>
  );
}

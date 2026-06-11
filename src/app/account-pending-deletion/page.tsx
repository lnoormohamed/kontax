"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { cancelAccountDeletion } from "~/app/actions/account";
import { signOutAction } from "~/app/actions/auth";

export const dynamic = "force-dynamic";

export default function AccountPendingDeletionPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    startTransition(async () => {
      await cancelAccountDeletion();
      router.push("/contacts");
    });
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-[18px] px-5 py-10" style={{ backgroundColor: "#eef1ec" }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-[#17352e] text-[19px] font-bold text-[#dff0e7]">K</span>
        <span className="text-[20px] font-semibold tracking-[-0.018em] text-[#17352e]">Kontax</span>
      </div>

      <div className="w-full max-w-[480px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf3e7]">
          <svg fill="none" height="22" stroke="#bf8526" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22">
            <path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
            <line x1="12" x2="12" y1="9" y2="13" /><line x1="12" x2="12.01" y1="17" y2="17" />
          </svg>
        </div>

        <h1 className="m-0 text-center text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">
          Your account is scheduled for deletion
        </h1>
        <p className="mt-3 text-center text-[14px] leading-[1.55] text-[#5c655e]">
          All your data will be permanently removed in 30 days. You can cancel at any time before then.
        </p>

        <div className="mt-6 grid gap-3">
          <button
            className="inline-flex w-full items-center justify-center gap-2 rounded-[1.2rem] bg-[#17352e] py-3 text-[14px] font-semibold text-white transition hover:bg-[#20443b] disabled:cursor-default disabled:opacity-45"
            disabled={isPending}
            onClick={handleCancel}
            type="button"
          >
            {isPending ? "Cancelling…" : "Cancel deletion — keep my account"}
          </button>
          <form action={signOutAction}>
            <button className="w-full rounded-[1.2rem] border border-[#d8ddd6] bg-white py-3 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]" type="submit">
              Sign out
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-[12px] leading-[1.55] text-[#8b938c]">
          Before your account is deleted, you can{" "}
          <a className="font-medium text-[#4158f4] hover:underline" href="/import-export">export your contacts</a>{" "}
          to keep a copy.
        </p>
      </div>
    </main>
  );
}

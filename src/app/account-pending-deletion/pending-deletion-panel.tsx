"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cancelAccountDeletion } from "~/app/actions/account";
import { signOutAction } from "~/app/actions/auth";

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "long",
  year: "numeric",
};

function daysRemaining(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
}

export function PendingDeletionPanel({ scheduledDeleteAt }: { scheduledDeleteAt: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const deleteDate = new Date(scheduledDeleteAt);
  const days = daysRemaining(scheduledDeleteAt);

  const handleCancel = () => {
    setError(false);
    startTransition(async () => {
      try {
        await cancelAccountDeletion();
      } catch {
        setError(true);
        return;
      }
      // The JWT callback rebuilds `pendingDeletion` from the database on the
      // next request, so a full navigation is enough to lift the read-only gate.
      router.push("/contacts");
      router.refresh();
    });
  };

  return (
    <div className="w-full max-w-[480px] rounded-[2rem] border border-[#d8ddd6] bg-white p-8 shadow-[0_2px_12px_rgba(20,30,25,0.08)]">
      <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-[#fdf3e7]">
        <svg
          fill="none"
          height="22"
          stroke="#bf8526"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="22"
        >
          <path d="M10.3 3.9 1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
          <line x1="12" x2="12" y1="9" y2="13" />
          <line x1="12" x2="12.01" y1="17" y2="17" />
        </svg>
      </div>

      <h1 className="m-0 text-center text-[22px] font-semibold tracking-[-0.01em] text-[#1d2823]">
        Your account is scheduled for deletion
      </h1>
      <p className="mt-3 text-center text-[14px] leading-[1.55] text-[#5c655e]">
        All your data will be permanently removed on{" "}
        <strong className="font-semibold text-[#1d2823]">
          {deleteDate.toLocaleDateString(undefined, DATE_FORMAT)}
        </strong>{" "}
        — {days === 1 ? "1 day" : `${days} days`} from now. Until then your account is
        read-only, and you can cancel at any time.
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
          <button
            className="w-full rounded-[1.2rem] border border-[#d8ddd6] bg-white py-3 text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
            type="submit"
          >
            Sign out
          </button>
        </form>
      </div>

      {error && (
        <p className="mt-3 text-center text-[13px] text-[#9a3a23]">
          Something went wrong. Please try again.
        </p>
      )}

      <p className="mt-5 text-center text-[12px] leading-[1.55] text-[#8b938c]">
        Before your account is deleted, you can{" "}
        <a className="font-medium text-[#4158f4] hover:underline" href="/import-export">
          export your contacts
        </a>{" "}
        to keep a copy.
      </p>
    </div>
  );
}

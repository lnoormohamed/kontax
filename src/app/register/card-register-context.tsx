"use client";

import Link from "next/link";
import { useMemo } from "react";

import { authLink } from "~/app/_components/auth-ui";
import type { CardPrefillData } from "~/app/u/[username]/add-to-kontax";

export function CardRegisterContext({ prefillParam }: { prefillParam: string }) {
  const prefill = useMemo<CardPrefillData | null>(() => {
    try {
      return JSON.parse(atob(prefillParam)) as CardPrefillData;
    } catch {
      return null;
    }
  }, [prefillParam]);

  if (!prefill) return null;

  const displayName = [prefill.firstName, prefill.lastName].filter(Boolean).join(" ");

  return (
    <div className="flex w-full max-w-[440px] flex-col gap-1.5 rounded-[16px] border border-[#cfe1d6] bg-[#e8f0eb] px-5 py-4">
      <p className="m-0 text-[14px] font-semibold text-[#14231d]">
        Adding {displayName} to Kontax
      </p>
      <p className="m-0 text-[13.5px] leading-[1.5] text-[#4e5851]">
        Create a free account to save this contact. Their details will be waiting for you.
      </p>
      <Link
        className={`mt-0.5 w-fit text-[13.5px] ${authLink}`}
        href={`/u/${prefill.sourceCardUsername}`}
      >
        ← Back to {displayName}&apos;s card
      </Link>
    </div>
  );
}

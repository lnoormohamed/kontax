"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function BillingSuccessBanner({ planLabel }: { planLabel: string }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    router.replace("/settings");
  };

  return (
    <div
      className="z-[19] flex shrink-0 items-center gap-3 border-b border-[#a3c4b5] bg-[#d9efe6] px-[18px] py-[11px]"
      style={{ borderLeft: "4px solid #17352e" }}
    >
      <svg className="mt-px h-4 w-4 shrink-0 text-[#17352e]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <p className="flex-1 text-[13px] text-[#1d2823]">
        You&rsquo;re now on the{" "}
        <strong className="font-semibold">{planLabel}</strong> plan. Welcome!
      </p>
      <button
        aria-label="Dismiss"
        className="ml-2 shrink-0 text-[#17352e] transition hover:text-[#0d1f1a]"
        onClick={handleDismiss}
        type="button"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

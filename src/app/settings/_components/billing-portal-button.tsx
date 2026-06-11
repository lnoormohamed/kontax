"use client";

import { useState, useTransition } from "react";

import { createBillingPortalSession } from "~/app/actions/billing";

type Variant = "blue" | "green" | "red" | "ghost";

const VARIANT_CLASS: Record<Variant, string> = {
  blue: "bg-[#4158f4] text-white hover:bg-[#3347d8]",
  green: "bg-[#17352e] text-white hover:bg-[#20443b]",
  red: "bg-[#b5472f] text-white hover:bg-[#9a3a23]",
  ghost: "border border-[#d8ddd6] bg-white text-[#1d2823] hover:bg-[#f2f4f0]",
};

const ArrowRight = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
    <path d="M4.5 12h15M13 5.5l6.5 6.5L13 18.5" />
  </svg>
);

const Card = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
    <rect height="13" rx="2" width="19.5" x="2.25" y="5.5" />
    <path d="M2.25 10h19.5M6 14.5h3" />
  </svg>
);

/**
 * Primary CTA that opens the Stripe customer portal. Owns the real loading state
 * (P19-DB02 §1 "Working…" spinner) and surfaces an inline error if the portal
 * session can't be created.
 */
export function BillingPortalButton({
  label,
  variant = "ghost",
  icon = "arrow",
  className,
}: {
  label: string;
  variant?: Variant;
  icon?: "arrow" | "card" | "none";
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  const handleClick = () => {
    setError(false);
    startTransition(async () => {
      const result = await createBillingPortalSession();
      if ("url" in result) {
        window.location.href = result.url;
      } else {
        setError(true);
      }
    });
  };

  return (
    <div className={className}>
      <button
        className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-[18px] text-sm font-semibold transition disabled:opacity-75 ${VARIANT_CLASS[variant]}`}
        disabled={isPending}
        onClick={handleClick}
        type="button"
      >
        {isPending ? (
          <>
            <span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/45 border-t-white" />
            Working…
          </>
        ) : (
          <>
            {label}
            {icon === "arrow" ? <ArrowRight /> : icon === "card" ? <Card /> : null}
          </>
        )}
      </button>
      {error ? (
        <div className="mt-3 flex items-center gap-2 text-[13px] text-[#9a3a23]">
          <svg className="h-[15px] w-[15px]" fill="none" stroke="#b5472f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v5M12 16h.01" />
          </svg>
          <span>Something went wrong. Please try again.</span>
        </div>
      ) : null}
    </div>
  );
}

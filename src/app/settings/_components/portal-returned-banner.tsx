"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PortalReturnedBanner() {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    router.replace("/settings");
  };

  return (
    <div
      className="z-[19] flex shrink-0 items-center gap-3 border-b border-[#c5cdf9] bg-[#edf0fe] px-[18px] py-[11px]"
      style={{ borderLeft: "4px solid #4158f4" }}
    >
      <svg className="mt-px h-4 w-4 shrink-0 text-[#4158f4]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v5M12 8h.01" />
      </svg>
      <p className="flex-1 text-[13px] text-[#1d2823]">
        Billing updated. Any plan changes will be reflected here shortly.
      </p>
      <button
        aria-label="Dismiss"
        className="ml-2 shrink-0 text-[#4158f4] transition hover:text-[#2d3fb5]"
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

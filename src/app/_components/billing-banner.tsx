"use client";

import { useTransition } from "react";

import { createBillingPortalSession } from "~/app/actions/billing";
import type { BillingBannerVariant } from "~/server/billing-surface";

/* §2 In-app grace / trial banner. Pinned below the top nav, not dismissable. */

const ArrowRight = ({ color }: { color: string }) => (
  <svg className="h-3.5 w-3.5" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
    <path d="M4.5 12h15M13 5.5l6.5 6.5L13 18.5" />
  </svg>
);

function PortalLink({ label, solid }: { label: string; solid?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const handleClick = () => {
    startTransition(async () => {
      const result = await createBillingPortalSession();
      if ("url" in result) window.location.href = result.url;
    });
  };
  if (solid) {
    return (
      <button
        className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[9px] border-none bg-[#b5472f] px-3.5 text-[13px] font-semibold text-white transition hover:bg-[#9a3a23] disabled:opacity-70"
        disabled={isPending}
        onClick={handleClick}
        type="button"
      >
        {isPending ? "Opening…" : label}
        {!isPending ? <ArrowRight color="#fff" /> : null}
      </button>
    );
  }
  return (
    <button
      className="inline-flex shrink-0 items-center gap-1.5 border-none bg-transparent p-0 text-[13.5px] font-semibold text-[#4158f4] transition hover:underline disabled:opacity-70"
      disabled={isPending}
      onClick={handleClick}
      type="button"
    >
      {isPending ? "Opening…" : label}
      {!isPending ? <ArrowRight color="#4158f4" /> : null}
    </button>
  );
}

const WarnGlyph = () => (
  <svg className="h-[17px] w-[17px] shrink-0" fill="none" stroke="#bf8526" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" viewBox="0 0 24 24">
    <path d="M10.3 3.3L2 19h20L13.7 3.3a2 2 0 00-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </svg>
);

const AlertGlyph = () => (
  <svg className="h-[17px] w-[17px] shrink-0" fill="none" stroke="#b5472f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);

const InfoGlyph = () => (
  <svg className="h-[17px] w-[17px] shrink-0" fill="none" stroke="#4158f4" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.85" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);

export function BillingBanner({
  variant,
  daysRemaining,
}: {
  variant: BillingBannerVariant;
  daysRemaining: number | null;
}) {
  if (variant === "ownerCritical") {
    return (
      <div className="z-[18] flex shrink-0 items-center gap-[11px] border-b border-[#dcae9f] bg-[#f3e1da] py-[13px] pl-4 pr-[18px]" style={{ borderLeft: "4px solid #b5472f" }}>
        <AlertGlyph />
        <span className="flex-1 text-[14px] leading-[1.4] text-[#1d2823]">
          Your plan expires soon. Update now to avoid losing sync and activity log access.
        </span>
        <PortalLink label="Update payment method" solid />
      </div>
    );
  }
  if (variant === "familyMember") {
    return (
      <div className="z-[18] flex shrink-0 items-center gap-[11px] border-b border-[#e6d3a3] bg-[#f6edd9] py-[13px] pl-4 pr-[18px]" style={{ borderLeft: "4px solid #bf8526" }}>
        <WarnGlyph />
        <span className="flex-1 text-[14px] leading-[1.4] text-[#1d2823]">
          Your family plan has a billing issue. The plan owner needs to update their payment method.
        </span>
      </div>
    );
  }
  if (variant === "trialEnding") {
    return (
      <div className="z-[18] flex shrink-0 items-center gap-[11px] border-b border-[#c5cdf9] bg-[#edf0fe] py-[13px] pl-4 pr-[18px]" style={{ borderLeft: "4px solid #4158f4" }}>
        <InfoGlyph />
        <span className="flex-1 text-[14px] leading-[1.4] text-[#1d2823]">
          Your Pro trial ends in {daysRemaining ?? "a few"} {daysRemaining === 1 ? "day" : "days"}. Add
          a payment method to continue.
        </span>
        <PortalLink label="Add payment method" />
      </div>
    );
  }
  // ownerGrace (default)
  return (
    <div className="z-[18] flex shrink-0 items-center gap-[11px] border-b border-[#e6d3a3] bg-[#f6edd9] py-[13px] pl-4 pr-[18px]" style={{ borderLeft: "4px solid #bf8526" }}>
      <WarnGlyph />
      <span className="flex-1 text-[14px] leading-[1.4] text-[#1d2823]">
        Payment failed. Update your payment method to keep your plan.
      </span>
      <PortalLink label="Update payment method" />
    </div>
  );
}

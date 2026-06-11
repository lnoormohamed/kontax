import Link from "next/link";

import { BillingPortalButton } from "~/app/settings/_components/billing-portal-button";
import { CancelPlanModal, type CancelPlanDetails } from "~/app/settings/_components/cancel-plan-modal";
import type { BillingSurface, BillingUsageRow } from "~/server/billing-surface";

/* §1 Settings billing section. One card, lifecycle-driven, per P19-DB02. */

type Tone = "active" | "trial" | "grace" | "danger";

const BADGE: Record<Tone, { bg: string; line: string; fg: string; dot: string }> = {
  active: { bg: "#e7efe9", line: "#bcdac9", fg: "#17352e", dot: "#17352e" },
  trial: { bg: "#edf0fe", line: "#c5cdf9", fg: "#3142c4", dot: "#4158f4" },
  grace: { bg: "#f6edd9", line: "#e6d3a3", fg: "#7c5511", dot: "#bf8526" },
  danger: { bg: "#f3e1da", line: "#dcae9f", fg: "#9a3a23", dot: "#b5472f" },
};

const TILE_BG: Record<Tone, string> = {
  active: "#e7efe9",
  trial: "#edf0fe",
  grace: "#f6edd9",
  danger: "#f3e1da",
};

function Glyph({ name, color }: { name: string; color: string }) {
  const common = {
    width: 21,
    height: 21,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "star")
    return <svg {...common}><path d="M12 3l2.9 6 6.6.8-4.9 4.5 1.3 6.5L12 17.8 6.1 20.8l1.3-6.5L2.5 9.8 9.1 9z" /></svg>;
  if (name === "gift")
    return <svg {...common}><path d="M4 12.5h16V20a1 1 0 01-1 1H5a1 1 0 01-1-1z" /><path d="M2.8 8.5h18.4v4H2.8zM12 8.5V21M12 8.5S10.6 4 8.2 4a2.15 2.15 0 000 4.5zM12 8.5S13.4 4 15.8 4a2.15 2.15 0 010 4.5z" /></svg>;
  if (name === "home")
    return <svg {...common}><path d="M4 11.4L12 5l8 6.4M5.8 10.1V19h12.4v-8.9M9.8 19v-4.4h4.4V19" /></svg>;
  if (name === "card")
    return <svg {...common}><rect height="13" rx="2" width="19.5" x="2.25" y="5.5" /><path d="M2.25 10h19.5M6 14.5h3" /></svg>;
  // people (free)
  return <svg {...common}><circle cx="9" cy="8" r="3.2" /><path d="M3.5 19a5.5 5.5 0 0111 0M16 5.2a3.2 3.2 0 010 6M17.5 19a5.5 5.5 0 00-2.5-4.6" /></svg>;
}

function UsageBar({ used, limit }: { used: number; limit: number | null }) {
  const unlimited = limit === null;
  const pct = unlimited ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const over = !unlimited && used >= limit;
  const near = !unlimited && used >= limit * 0.8;
  const fill = unlimited ? "#d8ddd6" : over ? "#b5472f" : near ? "#bf8526" : "#17352e";
  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#e9ece7]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
    </div>
  );
}

function UsageDots({ used, total }: { used: number; total: number }) {
  return (
    <div className="flex items-center gap-[5px]">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className="h-[9px] w-[9px] shrink-0 rounded-full"
          style={i < used ? { background: "#17352e" } : { border: "1.5px solid #cfd6cd" }}
        />
      ))}
    </div>
  );
}

function UsageCard({ row }: { row: BillingUsageRow }) {
  const unlimited = row.limit === null;
  const over = !unlimited && row.limit !== null && row.used >= row.limit;
  const right =
    row.valueLabel ??
    (unlimited
      ? `${row.used} / unlimited`
      : `${row.used} / ${row.limit}${row.suffix ? ` ${row.suffix}` : ""}`);
  return (
    <div className="rounded-[14px] border border-[#d8ddd6] bg-[#f6f7f4] px-[15px] py-[13px]">
      <div className="flex items-baseline justify-between gap-2.5">
        <span className="whitespace-nowrap text-[13px] font-semibold text-[#3a4540]">{row.label}</span>
        <span
          className="whitespace-nowrap tabular-nums text-[12.5px]"
          style={{ color: over ? "#b5472f" : "#5c655e", fontWeight: over ? 700 : 500 }}
        >
          {right}
        </span>
      </div>
      <div className="mt-[11px]">
        {row.dots && row.limit !== null ? (
          <UsageDots used={row.used} total={row.limit} />
        ) : (
          <UsageBar limit={row.limit} used={row.used} />
        )}
      </div>
    </div>
  );
}

export function BillingSection({
  surface,
  cancelDetails,
}: {
  surface: BillingSurface;
  cancelDetails: CancelPlanDetails;
}) {
  const { state } = surface;

  // tone + badge + glyph per state
  const tone: Tone =
    state === "trial" ? "trial" : state === "cancel" ? "grace" : state === "grace" ? "danger" : "active";
  const badgeLabel =
    state === "trial"
      ? "Trial"
      : state === "cancel"
        ? "Cancelling"
        : state === "grace"
          ? "Payment failed"
          : "Current plan";
  const glyph =
    state === "free"
      ? "people"
      : state === "trial"
        ? "gift"
        : state === "familyOwner"
          ? "home"
          : state === "grace"
            ? "card"
            : "star";
  const badge = BADGE[tone];

  const isFamily = state === "familyOwner";

  return (
    <section className="rounded-[1.4rem] border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
      {/* header */}
      <div className="flex items-start gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-[12px]"
          style={{ background: TILE_BG[tone] }}
        >
          <Glyph color={badge.fg} name={glyph} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[22px] font-semibold leading-[1.1] tracking-[-0.01em] text-[#1d2823]">
            {surface.planLabel}
            {surface.intervalLabel ? (
              <span className="ml-1.5 text-[18px] font-medium text-[#5c655e]">· {surface.intervalLabel}</span>
            ) : null}
          </div>
          <span
            className="mt-[9px] inline-flex h-6 items-center gap-1.5 rounded-full border px-[11px] text-[11.5px] font-bold tracking-[0.02em]"
            style={{ background: badge.bg, borderColor: badge.line, color: badge.fg }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: badge.dot }} />
            {badgeLabel}
          </span>
        </div>
        {surface.price ? (
          <div className="ml-auto whitespace-nowrap text-right">
            <span className="text-[22px] font-semibold tabular-nums tracking-[-0.01em] text-[#1d2823]">
              {surface.price}
            </span>
            <i className="ml-[3px] text-[13.5px] not-italic text-[#8b938c]">{surface.per}</i>
          </div>
        ) : null}
      </div>

      <div className="my-5 h-px bg-[#e9ece7]" />

      {/* grace callout */}
      {state === "grace" ? (
        <div className="flex items-start gap-[11px] rounded-[14px] border border-[#e7c9bd] bg-[#f9ece7] px-4 py-3.5">
          <svg className="mt-px h-[18px] w-[18px] shrink-0" fill="none" stroke="#b5472f" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M10.3 3.3L2 19h20L13.7 3.3a2 2 0 00-3.4 0z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <p className="m-0 text-[14px] leading-[1.5] text-[#7a2f1d]">
            Your last payment failed. Update your payment method
            {surface.graceDeadline ? ` by ${surface.graceDeadline}` : ""} to keep your{" "}
            {surface.planLabel} features.
          </p>
        </div>
      ) : null}

      {/* cancel callout */}
      {state === "cancel" ? (
        <div className="flex items-start gap-[11px] rounded-[14px] border border-[#e6d3a3] bg-[#f6edd9] px-4 py-3.5">
          <svg className="mt-px h-[18px] w-[18px] shrink-0" fill="none" stroke="#bf8526" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7.4v5l3.2 1.9" />
          </svg>
          <p className="m-0 text-[14px] leading-[1.5] text-[#7a5a1a]">
            Your plan ends on {surface.renewalDate}. After that, you&rsquo;ll move to the Free plan.
          </p>
        </div>
      ) : null}

      {/* lead line for free / active / family / trial */}
      {state === "free" ? (
        <p className="m-0 text-[14.5px] leading-[1.55] text-[#5c655e]">You&rsquo;re on the free plan.</p>
      ) : null}
      {(state === "active" || state === "familyOwner") && surface.renewalDate ? (
        <p className="m-0 text-[14.5px] leading-[1.55] text-[#5c655e]">
          Next billing date: {surface.renewalDate}.
        </p>
      ) : null}
      {state === "trial" ? (
        <p className="m-0 text-[14.5px] leading-[1.55] text-[#5c655e]">
          You&rsquo;re enjoying all {surface.planLabel} features free during your trial. Add a payment
          method before your trial ends to continue.
        </p>
      ) : null}

      {/* trial countdown row */}
      {state === "trial" && surface.trial ? (
        <div className="mt-[18px] flex flex-wrap items-center gap-3 rounded-[14px] border border-[#e9ece7] bg-[#f6f7f4] px-4 py-3.5">
          <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-[#8b938c]">Trial ends</span>
          <span className="text-[15px] font-semibold text-[#1d2823]">{surface.trial.endsOn}</span>
          <TrialPill days={surface.trial.daysRemaining} />
        </div>
      ) : null}

      {/* usage grid */}
      {surface.usage ? (
        <div className="mt-1 grid gap-3 sm:grid-cols-2">
          {surface.usage.map((row) => (
            <UsageCard key={row.label} row={row} />
          ))}
        </div>
      ) : null}

      {/* family member slots */}
      {isFamily && surface.members ? (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4 rounded-[14px] border border-[#e9ece7] bg-[#f6f7f4] px-4 py-[15px]">
          <div className="flex items-center gap-3">
            <UsageDots total={surface.members.total} used={surface.members.used} />
            <span className="tabular-nums text-[13.5px] font-semibold text-[#3a4540]">
              {surface.members.used} / {surface.members.total} slots used
            </span>
          </div>
          <Link className="text-[13px] font-semibold text-[#4452c9] hover:underline" href="/settings/family">
            Invite a member
          </Link>
        </div>
      ) : null}

      {/* CTA row */}
      <div className="mt-[22px] flex flex-wrap items-center gap-4">
        {state === "free" ? (
          <Link
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#4158f4] px-[18px] text-sm font-semibold text-white transition hover:bg-[#3347d8]"
            href="/pricing"
          >
            Upgrade to Pro
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24">
              <path d="M4.5 12h15M13 5.5l6.5 6.5L13 18.5" />
            </svg>
          </Link>
        ) : state === "trial" ? (
          <BillingPortalButton icon="card" label="Add payment method" variant="blue" />
        ) : state === "grace" ? (
          <BillingPortalButton icon="card" label="Update payment method" variant="red" />
        ) : state === "cancel" ? (
          <BillingPortalButton icon="none" label="Keep my plan" variant="green" />
        ) : (
          <>
            <BillingPortalButton label="Manage billing" variant="ghost" />
            <CancelPlanModal details={cancelDetails} family={isFamily} />
          </>
        )}
      </div>

      {/* portal note (active / family) */}
      {state === "active" || state === "familyOwner" ? (
        <p className="mt-4 flex items-center gap-[7px] text-[12.5px] leading-[1.4] text-[#8b938c]">
          <svg className="h-[13px] w-[13px] shrink-0" fill="none" stroke="#8b938c" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24">
            <rect height="13" rx="2" width="19.5" x="2.25" y="5.5" />
            <path d="M2.25 10h19.5M6 14.5h3" />
          </svg>
          Invoices, payment method and receipts are managed in the secure billing portal.
        </p>
      ) : null}
    </section>
  );
}

function TrialPill({ days }: { days: number }) {
  // <5 amber, <2 red, else trial-blue (matches §1c threshold copy).
  const tone = days < 2 ? BADGE.danger : days < 5 ? BADGE.grace : BADGE.trial;
  return (
    <span
      className="ml-auto inline-flex h-[26px] items-center whitespace-nowrap rounded-full border px-3 text-[12.5px] font-bold tabular-nums"
      style={{ background: tone.bg, borderColor: tone.line, color: tone.fg }}
    >
      {days} {days === 1 ? "day" : "days"} remaining
    </span>
  );
}

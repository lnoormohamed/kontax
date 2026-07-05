"use client";

// P42-DB01: the single app-shell banner slot. One component, one slot at the
// top of the shell (below the top nav, above page content). Only the
// highest-priority active banner renders:
//
//   1. account state (read-only / billing)  — red, outranks connectivity
//   2. connectivity (offline / degraded)    — amber, informational, never red
//   3. reconnected flash                    — green, auto-dismisses ~2.5s
//      after the refresh lands (not a blind timer)
//   4. update available (SW_UPDATED)        — neutral, deferred while offline
//
// Lower-priority conditions surface through their own affordances (disabled
// writes, the header OfflineChip) — never a second stacked banner.

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ReadOnlyBanner } from "~/app/_components/mobile-variance";
import { dismissSwUpdate, retryNow, useConnectivity } from "~/app/_components/connectivity";

const AMBER = { bg: "#f6edd9", border: "#e8d8b0", ink: "#7a5a1a", icon: "#8a6a1e" };
const GREEN = { bg: "#e3efe7", border: "#cfe4d7", ink: "#1c6b48", icon: "#1f8a5b" };

/** How often the degraded state re-probes in the background. */
const DEGRADED_RETRY_MS = 10_000;
/** How long the reconnected flash lingers after the refresh lands. */
const FLASH_LINGER_MS = 2_500;

export function WifiOffIcon({ size = 18, color = AMBER.icon }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M2 8.5C5 6 8.5 4.6 12 4.6" />
      <path d="M5.5 12c1.3-1 2.9-1.6 4.5-1.8" />
      <path d="M9 15.5c.9-.5 2-.8 3-.8" />
      <path d="M12 19h.01" />
      <path d="M2 2l20 20" />
    </svg>
  );
}

function CloudOffIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={AMBER.icon}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M17.5 19a4.5 4.5 0 00.6-9 6 6 0 00-11.3-1.4" />
      <path d="M2 2l20 20" />
      <path d="M5 9a6 6 0 00-1.5 9.9" />
    </svg>
  );
}

function CheckIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={GREEN.icon}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M5 12.5l4 4 10-10" />
    </svg>
  );
}

function RefreshIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#5c655e"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M21 12a9 9 0 11-3-6.7" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

export function ConnectionBanner({
  readOnly = false,
  readOnlyVariant = "locked",
  readOnlyReason,
  canManageBilling = true,
}: {
  /** Account lifecycle is read-only (CANCELED / LOCKED) — rank 1, wins the slot. */
  readOnly?: boolean;
  readOnlyVariant?: "grace" | "locked";
  readOnlyReason?: string;
  /** Non-owners can't manage billing — hides "Manage plan" on the red banner. */
  canManageBilling?: boolean;
}) {
  const { online, degraded, swUpdate } = useConnectivity();
  const router = useRouter();
  const [isRefreshing, startTransition] = useTransition();
  const [flash, setFlash] = useState(false);
  const connectivityBad = !online || degraded;
  const prevBad = useRef(connectivityBad);

  // Reconnected flash: fires on the bad→good transition and re-fetches the
  // page's server data. The page never reloads — content stays put.
  useEffect(() => {
    if (prevBad.current && !connectivityBad) {
      setFlash(true);
      startTransition(() => router.refresh());
    }
    if (connectivityBad) setFlash(false);
    prevBad.current = connectivityBad;
  }, [connectivityBad, router]);

  // Dismiss ~2.5s after the refresh lands (not a blind timer) so the flash
  // confirms recovery actually completed.
  useEffect(() => {
    if (!flash || isRefreshing) return;
    const t = setTimeout(() => setFlash(false), FLASH_LINGER_MS);
    return () => clearTimeout(t);
  }, [flash, isRefreshing]);

  // Degraded: background auto-retry continues regardless of [Try again].
  useEffect(() => {
    if (!degraded || !online) return;
    const t = setInterval(() => void retryNow(), DEGRADED_RETRY_MS);
    return () => clearInterval(t);
  }, [degraded, online]);

  // ── rank 1 · account state (red) — outranks connectivity; the offline
  //    reality moves to the header OfflineChip so both truths stay visible.
  if (readOnly) {
    return (
      <ReadOnlyBanner
        variant={readOnlyVariant}
        reason={readOnlyReason}
        canManage={canManageBilling}
      />
    );
  }

  // ── rank 2 · connectivity (amber — informational, read-only; never red)
  if (!online) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="cx-banner flex shrink-0 items-center gap-[11px] px-4 py-2.5 text-[12.5px] leading-[1.4] md:px-[18px] md:py-[11px] md:text-[13px]"
        style={{ background: AMBER.bg, borderBottom: `1px solid ${AMBER.border}`, color: AMBER.ink }}
      >
        <WifiOffIcon />
        <span className="min-w-0 flex-1">
          <b className="font-bold">You&rsquo;re offline.</b> Showing your last synced contacts
          <span className="hidden md:inline">
            {" "}
            &mdash; changes can&rsquo;t be saved until you&rsquo;re back online
          </span>
          .
        </span>
      </div>
    );
  }

  if (degraded) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="cx-banner flex shrink-0 items-center gap-[11px] px-4 py-2.5 text-[12.5px] leading-[1.4] md:px-[18px] md:py-[11px] md:text-[13px]"
        style={{ background: AMBER.bg, borderBottom: `1px solid ${AMBER.border}`, color: AMBER.ink }}
      >
        <CloudOffIcon />
        <span className="min-w-0 flex-1">
          <b className="font-bold">Having trouble reaching Kontax.</b>{" "}
          <span className="hidden md:inline">
            Your recent changes may not have been saved &mdash; we&rsquo;re retrying automatically.
          </span>
          <span className="md:hidden">We&rsquo;re retrying automatically.</span>
        </span>
        <button
          className="shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[13px] font-bold text-[#4158f4]"
          onClick={() => void retryNow()}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  // ── rank 3 · reconnected flash (green, transient)
  if (flash) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="cx-banner flex shrink-0 items-center gap-[11px] px-4 py-2.5 text-[12.5px] leading-[1.4] md:px-[18px] md:py-[11px] md:text-[13px]"
        style={{ background: GREEN.bg, borderBottom: `1px solid ${GREEN.border}`, color: GREEN.ink }}
      >
        <CheckIcon />
        <span className="min-w-0 flex-1">
          <b className="font-bold">Back online</b> &mdash; refreshing your contacts&hellip;
        </span>
      </div>
    );
  }

  // ── rank 4 · update available (neutral; suppressed while offline — a reload
  //    can't fetch a new build without a connection)
  if (swUpdate) {
    return (
      <div
        role="status"
        className="cx-banner flex shrink-0 items-center gap-[11px] px-4 py-2.5 text-[12.5px] leading-[1.4] md:px-[18px] md:py-[11px] md:text-[13px]"
        style={{ background: "#f8faf8", borderBottom: "1px solid #e9ece7", color: "#1d2823" }}
      >
        <RefreshIcon />
        <span className="min-w-0 flex-1">New version available &mdash; reload to update.</span>
        <button
          className="shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[13px] font-bold text-[#4158f4]"
          onClick={() => window.location.reload()}
          type="button"
        >
          Reload
        </button>
        <button
          aria-label="Dismiss"
          className="grid h-[22px] w-[22px] shrink-0 cursor-pointer place-items-center rounded-full border-none bg-[#f2f4f0] text-[11px] text-[#5c655e]"
          onClick={dismissSwUpdate}
          type="button"
        >
          ✕
        </button>
      </div>
    );
  }

  return null;
}

/**
 * P42-DB01 Surface 2: inline amber note next to a blocked write. Honest about
 * the no-queue reality — reads keep working, writes are disabled with a short
 * reason. No per-note retry: the top banner owns reconnection.
 */
export function OfflineWriteNote({
  title,
  body,
  style,
}: {
  title: string;
  body: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        background: AMBER.bg,
        border: `1px solid ${AMBER.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        fontSize: 12.5,
        lineHeight: 1.45,
        color: "#8a6a2a",
        ...style,
      }}
    >
      <span style={{ marginTop: 1 }}>
        <WifiOffIcon size={16} />
      </span>
      <div>
        <b style={{ color: AMBER.ink, fontWeight: 700 }}>{title}</b> {body}
      </div>
    </div>
  );
}

/**
 * Compact "Offline" pill for the top bar — shown only while a higher-priority
 * banner (account state) owns the slot, so both truths stay visible without a
 * second stacked banner.
 */
export function OfflineChip({ readOnly = false }: { readOnly?: boolean }) {
  const { online } = useConnectivity();
  if (online || !readOnly) return null;
  return (
    <span
      className="inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[12px] font-semibold"
      style={{ background: AMBER.bg, border: `1px solid ${AMBER.border}`, color: AMBER.ink }}
    >
      <WifiOffIcon size={13} />
      Offline
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";

import { resolveSecurityAlertAction } from "~/app/actions/notifications";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

export type SecurityAlertView = {
  id: string;
  kind: "device" | "bulk";
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string | Date;
};

// Brief format: "June 11, 2026 at 14:32 UTC". Built deterministically so the
// " at " separator doesn't depend on the runtime's Intl date/time joiner.
const formatWhen = (value: string | Date) => {
  const d = new Date(value);
  const date = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(d);
  return `${date} at ${time} UTC`;
};

type BulkEvent = { name: string; at: string };

/**
 * P22-DB05 surface 5: activity-anomaly detail drawer. Slide-over from the right.
 * `bulk` → affected-contacts event list; `device` → IP/device block. The
 * destructive "secure my account" action only fires here (Resolution 2).
 */
export function SecurityAlertDrawer({
  alert,
  onClose,
  onResolved,
}: {
  alert: SecurityAlertView;
  onClose: () => void;
  onResolved?: (secured: boolean) => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setLeaving(true);
    setTimeout(onClose, 200);
  };

  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolve = async (resolution: "DISMISSED" | "SECURED") => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await resolveSecurityAlertAction(alert.id, resolution);
      onResolved?.(res.secured);
      setLeaving(true);
      setTimeout(onClose, 200);
    } catch {
      setBusy(false);
    }
  };

  const events = (alert.payload.events as BulkEvent[] | undefined) ?? [];
  const more = Number(alert.payload.more ?? 0);
  const deviceRows =
    alert.kind === "device"
      ? (["Device", "IP address", "Time"] as const).map((k) => {
          const v = alert.payload[k];
          return [k, typeof v === "string" || typeof v === "number" ? String(v) : "—"] as const;
        })
      : [];

  return (
    <div
      aria-hidden={false}
      className="fixed inset-0 z-[95] flex justify-end transition-colors duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      style={{ background: leaving ? "rgba(29,40,35,0)" : "rgba(29,40,35,0.4)" }}
    >
      <aside
        aria-label={alert.title}
        className="flex h-full w-[480px] max-w-full flex-col border-l border-[#d8ddd6] bg-white shadow-[-12px_0_40px_rgba(29,40,35,0.16)] transition-transform duration-200 ease-out max-md:w-screen max-md:border-l-0"
        role="dialog"
        style={{ transform: leaving ? "translateX(100%)" : "translateX(0)" }}
      >
        <div className="flex-1 overflow-y-auto px-7 pb-7 pt-6">
          <button
            aria-label="Close"
            className="mb-4 grid h-8 w-8 place-items-center rounded-[9px] border border-[#e9ece7] bg-white text-[#3a4540] transition hover:bg-[#f2f4f0]"
            onClick={close}
            type="button"
          >
            <WorkspaceIcon name="x" size={18} strokeWidth={2} />
          </button>

          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#fef2f2] text-[#dc2626]">
            <WorkspaceIcon name="shieldAlert" size={24} strokeWidth={1.9} />
          </span>
          <h2 className="mt-3.5 text-[20px] font-bold leading-tight tracking-[-0.01em] text-[#1d2823]">
            Security Alert — {alert.title}
          </h2>
          <div className="mt-1.5 text-[13px] text-[#8b938c]">{formatWhen(alert.createdAt)}</div>

          <hr className="my-[22px] border-t border-[#f2f4f0]" />

          <div className="text-[11px] font-bold uppercase tracking-[0.06em] text-[#8b938c]">
            What happened
          </div>
          <p className="mt-2 text-[14px] leading-[1.55] text-[#38423c]">{alert.summary}</p>

          {alert.kind === "bulk" ? (
            <>
              <div className="mt-[22px] text-[11px] font-bold uppercase tracking-[0.06em] text-[#8b938c]">
                Affected contacts
              </div>
              <div className="mt-3 flex flex-col gap-0.5">
                {events.map((ev, i) => (
                  <div className="flex items-center gap-2 py-[7px] text-[13px] text-[#5c655e]" key={i}>
                    <span className="text-[#8b938c]">
                      <WorkspaceIcon name="trash" size={14} strokeWidth={1.8} />
                    </span>
                    <span className="font-semibold text-[#1d2823]">&ldquo;{ev.name}&rdquo;</span>
                    <span className="text-[#8b938c]">deleted</span>
                    <span className="text-[#cfd5cd]">·</span>
                    <span className="text-[#8b938c] tabular-nums">{ev.at}</span>
                  </div>
                ))}
                {more > 0 && (
                  <div className="pt-2 text-[13px] italic text-[#8b938c]">… and {more} more</div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mt-[22px] text-[11px] font-bold uppercase tracking-[0.06em] text-[#8b938c]">
                Device info
              </div>
              <div className="mt-3 flex flex-col gap-[9px] rounded-lg bg-[#f4f6f2] px-4 py-3">
                {deviceRows.map(([k, v]) => (
                  <div className="flex gap-3.5 text-[13px]" key={k}>
                    <span className="w-[92px] flex-none text-[#8b938c]">{k}</span>
                    <span className="font-medium text-[#1d2823]">{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-none flex-col gap-2 border-t border-[#f2f4f0] px-7 pb-[22px] pt-4">
          <button
            className="h-11 rounded-[10px] border border-[#d8ddd6] bg-white text-[14px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0] disabled:opacity-60"
            disabled={busy}
            onClick={() => resolve("DISMISSED")}
            type="button"
          >
            That was me — dismiss
          </button>
          <button
            className="inline-flex h-11 items-center justify-center gap-[9px] rounded-[10px] bg-[#dc2626] text-[14px] font-semibold text-white transition hover:bg-[#c11f1f] disabled:opacity-60"
            disabled={busy}
            onClick={() => resolve("SECURED")}
            type="button"
          >
            {busy && (
              <span className="h-[15px] w-[15px] animate-spin rounded-full border-2 border-white/45 border-t-white" />
            )}
            {busy ? "Securing…" : "Wasn't me — secure my account"}
          </button>
        </div>
      </aside>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { resolveSecurityAlertAction } from "~/app/actions/notifications";
import {
  SecurityAlertDrawer,
  type SecurityAlertView,
} from "~/app/_components/security-alert-drawer";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

/**
 * P22-DB05 surface 4: persistent security alert banner atop the contacts
 * workspace. Single + multi (N of M, ◀ ▶) variants. "View details" / "Wasn't me"
 * open the anomaly drawer; "That was me" resolves the alert (Resolution 2 — the
 * banner never secures directly).
 */
export function SecurityAlertBanner({ alerts: initial }: { alerts: SecurityAlertView[] }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initial);
  const [index, setIndex] = useState(0);
  const [hidden, setHidden] = useState(false);
  const [drawer, setDrawer] = useState<SecurityAlertView | null>(null);

  if (hidden || alerts.length === 0) return null;
  const total = alerts.length;
  const idx = Math.min(index, total - 1);
  const alert = alerts[idx]!;
  const multi = total > 1;

  const thatWasMe = async (a: SecurityAlertView) => {
    setAlerts((xs) => xs.filter((x) => x.id !== a.id));
    setIndex((i) => Math.max(0, Math.min(i, total - 2)));
    await resolveSecurityAlertAction(a.id, "DISMISSED");
    router.refresh();
  };

  return (
    <>
      <div
        className="relative flex flex-none items-start gap-3 overflow-hidden border-b border-[#fecaca] bg-[#fef2f2] py-3 pl-[18px] pr-4 max-md:flex-wrap"
        role="alert"
      >
        <span className="absolute bottom-0 left-0 top-0 w-1 bg-[#dc2626]" />
        <span className="mt-px flex-none text-[#dc2626]">
          <WorkspaceIcon name="shieldAlert" size={17} strokeWidth={1.9} />
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-x-[18px] gap-y-2">
          <div className="text-[14px] leading-[1.4] text-[#991b1b]">
            <strong className="font-bold">
              Security alert{multi ? ` (${idx + 1} of ${total})` : ""}:
            </strong>{" "}
            {alert.summary}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="text-[13px] font-medium text-[#4158f4] hover:underline"
              onClick={() => setDrawer(alert)}
              type="button"
            >
              View details
            </button>
            <span className="text-[13px] text-[#f1a8a8]">·</span>
            <button
              className="text-[13px] font-medium text-[#5c655e] hover:underline"
              onClick={() => thatWasMe(alert)}
              type="button"
            >
              That was me
            </button>
            <span className="text-[13px] text-[#f1a8a8]">·</span>
            <button
              className="text-[13px] font-medium text-[#dc2626] hover:underline"
              onClick={() => setDrawer(alert)}
              type="button"
            >
              {multi ? "Wasn't me" : "Wasn't me — secure my account"}
            </button>
            {multi && (
              <span className="ml-1 inline-flex items-center gap-0.5">
                <button
                  aria-label="Previous alert"
                  className="grid h-[22px] w-[22px] place-items-center rounded-md text-[#dc2626] hover:bg-[#fde0e0]"
                  onClick={() => setIndex((i) => (i - 1 + total) % total)}
                  type="button"
                >
                  <WorkspaceIcon name="back" size={15} strokeWidth={2.1} />
                </button>
                <button
                  aria-label="Next alert"
                  className="grid h-[22px] w-[22px] place-items-center rounded-md text-[#dc2626] hover:bg-[#fde0e0]"
                  onClick={() => setIndex((i) => (i + 1) % total)}
                  type="button"
                >
                  <span className="rotate-180">
                    <WorkspaceIcon name="back" size={15} strokeWidth={2.1} />
                  </span>
                </button>
              </span>
            )}
          </div>
        </div>
        <button
          aria-label="Dismiss"
          className="grid h-[26px] w-[26px] flex-none place-items-center self-start rounded-md text-[#b9776b] hover:bg-[#fde0e0]"
          onClick={() => setHidden(true)}
          type="button"
        >
          <WorkspaceIcon name="x" size={15} strokeWidth={2} />
        </button>
      </div>

      {drawer && (
        <SecurityAlertDrawer
          alert={drawer}
          onClose={() => setDrawer(null)}
          onResolved={() => {
            setAlerts((xs) => xs.filter((x) => x.id !== drawer.id));
            setDrawer(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

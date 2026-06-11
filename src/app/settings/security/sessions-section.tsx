"use client";

import { useEffect, useState, useTransition } from "react";

import type { SessionSummary } from "~/app/actions/sessions";
import { listActiveSessions, revokeAllOtherSessions, revokeSession } from "~/app/actions/sessions";

function DeviceIcon({ hint, size = 18 }: { hint: string | null; size?: number }) {
  const isPhone = /iPhone|Android.*Mobile|iPad/.test(hint ?? "");
  const paths = isPhone
    ? ["M8 3.5h8a1.4 1.4 0 011.4 1.4v14.2A1.4 1.4 0 0116 20.5H8a1.4 1.4 0 01-1.4-1.4V4.9A1.4 1.4 0 018 3.5z", "M10.5 17.4h3"]
    : ["M4 5.5h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9a1 1 0 011-1z", "M9 20.5h6", "M12 16.5v4"];
  return (
    <svg fill="none" height={size} stroke="#5c655e" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" viewBox="0 0 24 24" width={size}>
      {paths.map((p, i) => <path d={p} key={i} />)}
    </svg>
  );
}

function Spinner({ size = 15, light = true }: { size?: number; light?: boolean }) {
  return <span className="st-spin inline-block rounded-full" style={{ width: size, height: size, border: `2px solid ${light ? "rgba(255,255,255,.35)" : "rgba(23,53,46,.2)"}`, borderTopColor: light ? "#fff" : "#17352e" }} />;
}

function relativeTime(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Active just now";
  if (minutes < 60) return `Active ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Active ${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Active ${days} day${days === 1 ? "" : "s"} ago`;
  return `Active ${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? "" : "s"} ago`;
}

function SessionRow({ s, onSignOut, flash }: { s: SessionSummary; onSignOut: (id: string) => void; flash: (msg: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [out, setOut] = useState(false);

  const go = async () => {
    setBusy(true);
    const result = await revokeSession(s.id);
    if ("success" in result) {
      setOut(true);
      setTimeout(() => onSignOut(s.id), 160);
    } else {
      setBusy(false);
      flash("Failed to sign out. Please try again.");
    }
  };

  return (
    <div
      className="flex items-center gap-[13px] border-t border-[#e9ece7] py-3 first:border-t-0 transition-all"
      style={{ opacity: out ? 0 : busy ? 0.6 : 1, maxHeight: out ? 0 : 56, paddingTop: out ? 0 : 12, paddingBottom: out ? 0 : 12, overflow: "hidden" }}
    >
      <span className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[9px] bg-[#f2f4f0]">
        <DeviceIcon hint={s.deviceHint} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-semibold text-[#1d2823]">
          {s.deviceHint ?? "Unknown device"}
        </span>
        <span className="block overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12.5px] text-[#8b938c]">
          {s.ipAddress ?? "Unknown IP"} · {relativeTime(s.lastActiveAt)}
        </span>
      </span>
      {s.isCurrent
        ? <span className="shrink-0 text-[12px] font-semibold text-[#17352e]">Current session</span>
        : busy
          ? <Spinner size={16} light={false} />
          : <button
              className="shrink-0 rounded-[1.1rem] border border-[#dcae9f] bg-white px-[13px] py-[7px] text-[13px] font-semibold text-[#b5472f] transition hover:bg-[#f3e1da]"
              onClick={() => void go()}
              type="button"
            >
              Sign out
            </button>}
    </div>
  );
}

export function SessionsSection({ flash }: { flash: (msg: string) => void }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [isRevoking, startRevoke] = useTransition();

  useEffect(() => {
    listActiveSessions().then((s) => { setSessions(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const others = sessions.filter((s) => !s.isCurrent).length;

  const revokeAll = () => {
    startRevoke(async () => {
      const result = await revokeAllOtherSessions();
      setSessions((prev) => prev.filter((s) => s.isCurrent));
      setConfirm(false);
      if (result.revokedCount > 0) {
        flash(`Signed out of ${result.revokedCount} device${result.revokedCount === 1 ? "" : "s"}`);
      }
    });
  };

  if (loading) {
    return (
      <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
        <div className="text-[16px] font-semibold text-[#1d2823]">Active sessions</div>
        <p className="mt-4 text-[13.5px] text-[#8b938c]">Loading…</p>
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-[#d8ddd6] bg-white p-6 shadow-[0_1px_2px_rgba(20,30,25,0.04)]">
      <div className="text-[16px] font-semibold text-[#1d2823]">Active sessions</div>

      {sessions.length === 0 || others === 0 ? (
        <p className="mt-[14px] mb-[2px] py-2 text-center text-[13.5px] text-[#8b938c]">
          {sessions.length === 0 ? "No active sessions found." : "You’re only signed in on this device."}
        </p>
      ) : (
        <>
          <p className="mt-1 text-[14px] leading-[1.5] text-[#5c655e]">Devices currently signed in to your account.</p>
          <div className="mt-[10px]">
            {sessions.map((s) => (
              <SessionRow
                flash={flash}
                key={s.id}
                onSignOut={(id) => setSessions((prev) => prev.filter((x) => x.id !== id))}
                s={s}
              />
            ))}
          </div>
          <div className="mt-[6px] border-t border-[#e9ece7] pt-[14px]">
            {!confirm ? (
              <button
                className="border-none bg-transparent p-0 text-[13.5px] font-medium text-[#8b938c] transition hover:text-[#b5472f]"
                onClick={() => setConfirm(true)}
                type="button"
              >
                Sign out of all other devices
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-[13.5px] text-[#3a4540]">
                  Sign out of {others} other session{others === 1 ? "" : "s"}?
                </span>
                <button
                  className="inline-flex items-center gap-2 rounded-[1.2rem] bg-[#b5472f] px-[14px] py-2 text-[13px] font-semibold text-white transition hover:bg-[#9a3a23] disabled:opacity-50"
                  disabled={isRevoking}
                  onClick={revokeAll}
                  type="button"
                >
                  {isRevoking ? <><Spinner size={12} /> Signing out…</> : "Confirm"}
                </button>
                <button
                  className="rounded-[1.2rem] border border-[#d8ddd6] bg-white px-[14px] py-2 text-[13px] font-semibold text-[#1d2823] transition hover:bg-[#f2f4f0]"
                  onClick={() => setConfirm(false)}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}

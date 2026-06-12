import Link from "next/link";

import { ReadOnlyBanner, UpsellCard } from "~/app/_components/mobile-variance";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import type { SyncAccountData } from "./sync-page-client";

// ── Mobile sync summary (md:hidden) ──────────────────────────────────────────
// Mirrors the Mobile-PWA design's SyncScreen: clean connection cards with an
// icon tile, name, status line, and a status dot — plus a dashed "Add
// connection" button. Tapping a card or the add button hands off to the full
// SyncPageClient via URL params (?account / ?add), which renders full-screen on
// mobile. Shown only when no connection is selected and we're not adding.

type StatusVisual = { sub: string; dot: string; tone: string };

function statusVisual(a: SyncAccountData): StatusVisual {
  switch (a.status) {
    case "ACTIVE":
      return {
        sub: a.lastSyncedAtRelative ? `Synced ${a.lastSyncedAtRelative.toLowerCase()}` : "Connected",
        dot: "#2f9e5e",
        tone: "#8b938c",
      };
    case "PAUSED":
      return { sub: "Paused", dot: "#bf8526", tone: "#bf8526" };
    case "NEEDS_REAUTH":
      return { sub: "Reconnect needed", dot: "#b5472f", tone: "#b5472f" };
    case "ERROR":
    default:
      return { sub: a.lastErrorMessage ?? "Sync error", dot: "#b5472f", tone: "#b5472f" };
  }
}

export function MobileSyncScreen({
  accounts,
  hidden,
  cardDavEnabled,
  syncAccountsLimit,
  canWrite,
  upgradePlan = "Pro",
}: {
  accounts: SyncAccountData[];
  /** True when a connection is selected or the add form is open — the full
   *  SyncPageClient takes over the screen, so the summary is suppressed. */
  hidden: boolean;
  /** Free plan can't use CardDAV sync at all → upsell (mirrors the server gate). */
  cardDavEnabled: boolean;
  /** Account ceiling for the plan (Pro = 5); Add disables at the cap. */
  syncAccountsLimit: number;
  /** Read-only lifecycle (GRACE/LOCKED) disables Add. */
  canWrite: boolean;
  upgradePlan?: string;
}) {
  if (hidden) return null;

  // Free: CardDAV sync is a paid feature — the whole screen is an upsell.
  if (!cardDavEnabled) {
    return (
      <div className="flex w-full flex-col md:hidden" style={{ background: "#f6f7f4" }}>
        <div style={{ padding: "28px 16px" }}>
          <UpsellCard
            feature="Sync"
            plan={upgradePlan}
            icon="sync"
            body="Connect iCloud, Google, or any CardDAV account and keep your contacts in sync automatically."
          />
        </div>
      </div>
    );
  }

  const atCap = accounts.length >= syncAccountsLimit;
  const addDisabled = !canWrite || atCap;
  const addReason = !canWrite
    ? "Your account is read-only."
    : atCap
      ? `You're using all ${syncAccountsLimit} sync ${syncAccountsLimit === 1 ? "account" : "accounts"}.`
      : null;

  return (
    <div className="flex w-full flex-col md:hidden" style={{ background: "#f6f7f4" }}>
      {!canWrite ? <ReadOnlyBanner variant="grace" /> : null}
      <div className="mob-scroll" style={{ flex: 1, padding: "16px 0 28px" }}>
        {accounts.length === 0 ? (
          <div style={{ margin: "0 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "40px 24px", textAlign: "center" }}>
            <span style={{ width: 56, height: 56, borderRadius: 16, background: "#e7efe9", display: "grid", placeItems: "center" }}>
              <WorkspaceIcon name="sync" size={26} className="text-[#17352e]" strokeWidth={1.7} />
            </span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1d2823" }}>No sync connections yet</div>
              <div style={{ fontSize: 13.5, color: "#8b938c", marginTop: 5, lineHeight: 1.5 }}>
                Connect iCloud, Google, or any CardDAV account to keep your contacts in sync.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ margin: "0 16px 16px", border: "1px solid #d8ddd6", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
            {accounts.map((a, i) => {
              const v = statusVisual(a);
              return (
                <Link
                  key={a.id}
                  href={`/sync?account=${a.id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 13,
                    padding: "14px 16px",
                    borderBottom: i < accounts.length - 1 ? "1px solid #e9ece7" : "none",
                    textDecoration: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <span style={{ width: 38, height: 38, borderRadius: 10, background: "#e7efe9", display: "grid", placeItems: "center", flex: "0 0 auto" }}>
                    <WorkspaceIcon name="sync" size={19} className="text-[#17352e]" strokeWidth={1.8} />
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 15, fontWeight: 600, color: "#1d2823", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {a.label}
                    </span>
                    <span style={{ display: "block", fontSize: 12.5, color: v.tone, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {v.sub}
                    </span>
                  </span>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", background: v.dot, flex: "0 0 auto" }} />
                </Link>
              );
            })}
          </div>
        )}

        <div style={{ padding: "0 16px" }}>
          {addDisabled ? (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  height: 48,
                  borderRadius: 12,
                  border: "1.5px dashed #e9ece7",
                  background: "#fff",
                  color: "#aeb4ac",
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: "not-allowed",
                }}
              >
                <WorkspaceIcon name="plus" size={18} className="text-[#aeb4ac]" strokeWidth={2} />
                Add connection
              </div>
              {addReason ? (
                <p style={{ margin: "8px 2px 0", fontSize: 12, color: "#8b938c", textAlign: "center" }}>{addReason}</p>
              ) : null}
            </>
          ) : (
            <Link
              href="/sync?add=1"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 48,
                borderRadius: 12,
                border: "1.5px dashed #d8ddd6",
                background: "#fff",
                color: "#4158f4",
                fontSize: 15,
                fontWeight: 600,
                textDecoration: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <WorkspaceIcon name="plus" size={18} className="text-[#4158f4]" strokeWidth={2} />
              Add connection
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

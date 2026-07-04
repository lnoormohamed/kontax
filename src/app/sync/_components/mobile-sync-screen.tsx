"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useOffline } from "~/app/_components/connectivity";
import { UpsellCard } from "~/app/_components/mobile-variance";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";
import type { BookOption, SyncAccountData } from "./sync-page-client";

// ── Mobile sync summary (md:hidden) ──────────────────────────────────────────
// Mirrors the Mobile-PWA design's SyncScreen: clean connection cards with an
// icon tile, name, status line, and a status dot — plus a dashed "Add
// connection" button. Tapping a card or the add button hands off to the full
// SyncPageClient via URL params (?account / ?add), which renders full-screen on
// mobile. Shown only when no connection is selected and we're not adding.

type StatusVisual = { sub: string; dot: string; tone: string };

function statusVisual(a: SyncAccountData): StatusVisual {
  const cardDavPrefix =
    a.provider === "CARDDAV"
      ? `${a.providerSecondaryText ?? a.providerHost ?? a.baseUrl} · `
      : "";

  switch (a.status) {
    case "ACTIVE":
      return {
        sub:
          cardDavPrefix +
          (a.lastSyncedAtRelative
            ? `Synced ${a.lastSyncedAtRelative.toLowerCase()}`
            : "Connected"),
        dot: "#2f9e5e",
        tone: "#8b938c",
      };
    case "PAUSED":
      return { sub: `${cardDavPrefix}Paused`, dot: "#bf8526", tone: "#bf8526" };
    case "NEEDS_REAUTH":
      return { sub: `${cardDavPrefix}Reconnect needed`, dot: "#b5472f", tone: "#b5472f" };
    case "ERROR":
    default:
      return {
        sub: cardDavPrefix + (a.lastErrorMessage ?? "Sync error"),
        dot: "#b5472f",
        tone: "#b5472f",
      };
  }
}

export function MobileSyncScreen({
  accounts,
  books,
  hasBookModel,
  hidden,
  cardDavEnabled,
  syncAccountsLimit,
  canWrite,
  planLabel = "Free",
  upgradeableAtCap = false,
  upgradePlan = "Pro",
}: {
  accounts: SyncAccountData[];
  /** P41-DB01: the user's books, for the stacked book-first grouping. */
  books: BookOption[];
  /** §7B: false when the account predates the P40 book model. */
  hasBookModel: boolean;
  /** True when a connection is selected or the add form is open — the full
   *  SyncPageClient takes over the screen, so the summary is suppressed. */
  hidden: boolean;
  /** Whether CardDAV sync is available at all. Data-driven gate: every current
   *  plan enables it (Free includes 1 account), so this is a defensive upsell
   *  fallback for a hypothetical fully-gated plan. */
  cardDavEnabled: boolean;
  /** Account ceiling for the plan (Free = 1, Pro = 5); Add disables at the cap. */
  syncAccountsLimit: number;
  /** Read-only lifecycle (GRACE/LOCKED) disables Add. */
  canWrite: boolean;
  /** Plan name shown in the at-cap copy (e.g. "Free"). */
  planLabel?: string;
  /** True when a higher tier raises the cap (Free) → show an upgrade nudge at the cap. */
  upgradeableAtCap?: boolean;
  upgradePlan?: string;
}) {
  // P42-DB01: connectivity comes from the shared store; the banner itself now
  // lives in the page-level ConnectionBanner slot (account-state ▸ connectivity
  // ▸ update), so this screen only gates its own write affordance (Add).
  const offline = useOffline();

  // P41-DB01 Surface 6A: the stacked rail groups by destination book by default;
  // a persisted toggle restores the provider grouping. Shares the desktop key so
  // the choice follows the device across layouts.
  const [groupMode, setGroupMode] = useState<"book" | "provider">("book");
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("kontax:sync:groupMode");
      if (saved === "book" || saved === "provider") setGroupMode(saved);
    } catch {
      /* ignore */
    }
  }, []);
  const changeGroupMode = (mode: "book" | "provider") => {
    setGroupMode(mode);
    try {
      window.localStorage.setItem("kontax:sync:groupMode", mode);
    } catch {
      /* ignore */
    }
  };

  if (hidden) return null;

  // Defensive: a fully-gated plan (none today) shows the upsell instead of the list.
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
  const addDisabled = !canWrite || offline || atCap;
  const acctWord = syncAccountsLimit === 1 ? "account" : "accounts";
  // At cap on an upgradeable plan (Free), frame it as an inclusion + upgrade nudge
  // rather than a hard wall.
  const capUpgrade = atCap && canWrite && !offline && upgradeableAtCap;
  // Reason priority mirrors the design: read-only → offline → at-cap.
  const addReason = !canWrite
    ? "Your account is read-only."
    : offline
      ? "Connect to add a new account."
      : atCap
        ? capUpgrade
          ? `${planLabel} includes ${syncAccountsLimit} sync ${acctWord}.`
          : `You're using all ${syncAccountsLimit} sync ${acctWord}.`
        : null;

  // P41-DB01 Surface 6A: one connection card. In book view its status line
  // restates the projection ("Pushes: Work · never private").
  const renderCard = (a: SyncAccountData, isLast: boolean) => {
    const v = statusVisual(a);
    const bookSub =
      groupMode === "book" && hasBookModel
        ? a.projectionRowState === "misconfigured"
          ? "Projection paused — book removed"
          : a.projectionRowState === "v1-only"
            ? "No destination book"
            : a.projectionSummary
        : v.sub;
    const subTone =
      groupMode === "book" && hasBookModel && a.projectionRowState === "misconfigured"
        ? "#b5472f"
        : v.tone;
    return (
      <Link
        key={a.id}
        href={`/sync?account=${a.id}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 13,
          padding: "14px 16px",
          borderBottom: isLast ? "none" : "1px solid #e9ece7",
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
          <span style={{ display: "block", fontSize: 12.5, color: subTone, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {bookSub}
          </span>
        </span>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: v.dot, flex: "0 0 auto" }} />
      </Link>
    );
  };

  // Book-first stacked groups (Surface 6A). Provider view keeps the single flat
  // card list.
  const useBook = groupMode === "book" && hasBookModel && accounts.length > 0;
  const bookOrder = new Map(books.map((b, i) => [b.id, i]));
  type MobileGroup = { key: string; label: string; items: SyncAccountData[]; sort: number };
  const mobileGroups: MobileGroup[] = [];
  if (useBook) {
    for (const a of accounts) {
      let key: string, label: string, sort: number;
      if (a.projectionRowState === "v1-only" || a.projectionRowState === "misconfigured") {
        key = "__all__";
        label = "All contacts";
        sort = 9000;
      } else {
        key = [...a.projectionBookIds].sort().join("+") || "__all__";
        label = a.projectionBookNames.join(" + ") || "All contacts";
        sort =
          a.projectionRowState === "multi-book"
            ? 1000 + Math.min(...a.projectionBookIds.map((id) => bookOrder.get(id) ?? 500))
            : bookOrder.get(a.projectionBookIds[0] ?? "") ?? 500;
      }
      let g = mobileGroups.find((x) => x.key === key);
      if (!g) {
        g = { key, label, items: [], sort };
        mobileGroups.push(g);
      }
      g.items.push(a);
    }
    mobileGroups.sort((x, y) => x.sort - y.sort);
  }

  return (
    <div className="flex w-full flex-col md:hidden" style={{ background: "#f6f7f4" }}>
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
            {/* P26-13: link to the CardDAV explainer on /help */}
            <Link href="/help#carddav" style={{ fontSize: 13, fontWeight: 500, color: "#4158f4", textDecoration: "none" }}>
              Learn about CardDAV →
            </Link>
          </div>
        ) : (
          <>
            {/* Surface 6A: Book / Provider toggle in the summary header. */}
            {hasBookModel ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 16px 12px" }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b938c" }}>
                  Group by
                </span>
                <div style={{ display: "inline-flex", background: "#f2f4f0", borderRadius: 8, padding: 2, gap: 2 }}>
                  {(["book", "provider"] as const).map((m) => {
                    const on = groupMode === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => changeGroupMode(m)}
                        style={{
                          padding: "5px 11px",
                          borderRadius: 6,
                          border: "none",
                          cursor: "pointer",
                          fontSize: 12,
                          fontWeight: 600,
                          background: on ? "#fff" : "transparent",
                          color: on ? "#1d2823" : "#8b938c",
                          boxShadow: on ? "0 1px 2px rgba(20,30,25,0.08)" : "none",
                        }}
                      >
                        {m === "book" ? "Book" : "Provider"}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {useBook ? (
              mobileGroups.map((g) => (
                <div key={g.key} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b938c", margin: "0 18px 6px" }}>
                    {g.label}
                  </div>
                  <div style={{ margin: "0 16px", border: "1px solid #d8ddd6", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
                    {g.items.map((a, i) => renderCard(a, i === g.items.length - 1))}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ margin: "0 16px 16px", border: "1px solid #d8ddd6", borderRadius: 14, background: "#fff", overflow: "hidden" }}>
                {accounts.map((a, i) => renderCard(a, i === accounts.length - 1))}
              </div>
            )}
          </>
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
                <p style={{ margin: "8px 2px 0", fontSize: 12, color: "#8b938c", textAlign: "center", lineHeight: 1.45 }}>
                  {addReason}
                  {capUpgrade ? (
                    <>
                      {" "}
                      <Link href="/pricing" style={{ color: "#4158f4", fontWeight: 700, textDecoration: "none", WebkitTapHighlightColor: "transparent" }}>
                        Upgrade to {upgradePlan} for up to 5.
                      </Link>
                    </>
                  ) : null}
                </p>
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

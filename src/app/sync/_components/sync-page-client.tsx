"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";

import {
  activateSyncAccount,
  attachSyncCredentials,
  confirmSyncSettingsPassword,
  createSyncAccount,
  disconnectSyncAccount,
  pauseSyncAccount,
  queueSyncJob,
  resolveSyncConflict,
} from "~/app/actions/sync";
import { HelpTooltip } from "~/app/_components/help-tooltip";
import { SyncTimestamp } from "./sync-timestamp";

import { ConnectionSettings } from "./connection-settings";
import { Spinner, T } from "./sync-shared";

// ── Data types ───────────────────────────────────────────────────────────────
export type SyncJobRow = {
  id: string;
  when: string;
  direction: "TWO_WAY" | "IMPORT_ONLY" | "EXPORT_ONLY";
  added: number;
  modified: number;
  deleted: number;
  // Outbound (Kontax -> remote) tallies for the second "Changes" line.
  pushedAdded: number;
  pushedModified: number;
  pushedDeleted: number;
  status: "ok" | "fail" | "pending";
  error: string | null;
};

export type ConflictComparisonRow = {
  label: string;
  local: string;
  remote: string;
};

export type SyncConflictData = {
  id: string;
  contactName: string;
  field: string;
  date: string;
  comparisonRows: ConflictComparisonRow[];
};

export type SyncFieldSupportRow = {
  key:
    | "names"
    | "phones"
    | "emails"
    | "addresses"
    | "websites"
    | "notes"
    | "birthday"
    | "significantDates";
  label: string;
  support: "two_way" | "local_only";
  detail: string;
};

export type SyncAccountData = {
  id: string;
  label: string;
  baseUrl: string;
  connectionId: string | null;
  // P27-07: provider + OAuth metadata (Google/Microsoft show email, not a URL).
  provider: "CARDDAV" | "GOOGLE" | "MICROSOFT";
  providerDisplayName: string | null;
  providerHost: string | null;
  providerVerificationState: "VERIFIED" | "DETECTED_UNVERIFIED" | "GENERIC";
  providerBrandKey: string | null;
  providerDetectionSource: string | null;
  providerSecondaryText: string | null;
  diagnosticsHelpHref: string;
  connectedEmail: string | null;
  scope: string | null;
  tokenStatus: "valid" | "expired" | null;
  lastRefreshedRelative: string | null;
  lastErrorCode: string | null;
  direction: "TWO_WAY" | "IMPORT_ONLY" | "EXPORT_ONLY";
  conflictPolicy: "SERVER_WINS" | "DEVICE_WINS" | "MANUAL";
  capabilityProfileOverride:
    | "carddav-generic-safe"
    | "carddav-icloud"
    | "carddav-fastmail"
    | null;
  capabilityProfileLabel: string;
  // P23-01 convention: null = platform default (60 min), 0 = manual only.
  syncFrequencyMinutes: number | null;
  bookAllowlist: string[];
  // P36 advanced settings.
  importLabelId: string | null;
  maxDeletionsThreshold: number | null;
  notifyOnFailure: boolean;
  syncWindowStart: number | null;
  syncWindowEnd: number | null;
  excludedFields: string[];
  exportLabelFilter: string[];
  // null = platform default (5); 0 = never auto-pause.
  maxAttemptsBeforePause: number | null;
  // P36-DB02: true when the connection was just created and the user hasn't
  // confirmed sync settings yet — the first sync is held and setup is shown.
  needsSetup: boolean;
  createdAt: string;
  disconnectedAt: string | null;
  retiredAt: string | null;
  replacesSyncAccountId: string | null;
  replacesSyncAccountLabel: string | null;
  replacedBySyncAccountId: string | null;
  replacedBySyncAccountLabel: string | null;
  status: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR" | "DISCONNECTED" | "RETIRED";
  health:
    | "healthy"
    | "watch"
    | "needs_attention"
    | "paused_for_safety"
    | "needs_reauth"
    | "retired";
  lastSyncedAtRelative: string | null;
  lastErrorMessage: string | null;
  capabilityNoteTitle: string | null;
  capabilityNoteBody: string | null;
  capabilityUnsupportedFieldFamilies: string[];
  diagnosticsFieldSupport: SyncFieldSupportRow[];
  diagnosticsWarnings: string[];
  lastSuccessfulJobRelative: string | null;
  lastInboundActivityRelative: string | null;
  lastOutboundActivityRelative: string | null;
  consecutiveFailures: number;
  // P23-05: account auto-paused because the manual conflict queue is full.
  conflictQueueFull: boolean;
  // P27-08: potential duplicates found by the most recent completed import.
  duplicatesDetected: number;
  jobs: SyncJobRow[];
  conflicts: SyncConflictData[];
};

// P36: a user's label, for the auto-label-on-import and export-filter pickers.
export type LabelOption = {
  id: string;
  name: string;
  color: string;
};

// ── Health model (maps DB health → design visual state) ──────────────────────
type VisualHealth =
  | "healthy"
  | "warning"
  | "error"
  | "auth"
  | "retired"
  | "paused"
  | "safety"
  | "never"
  | "syncing";

const getVisualHealth = (a: SyncAccountData, syncingId: string | null): VisualHealth => {
  if (a.id === syncingId) return "syncing";
  if (a.status === "NEEDS_REAUTH") return "auth";
  if (a.health === "retired") return "retired";
  if (a.health === "paused_for_safety") return "safety";
  if (a.status === "PAUSED") return "paused";
  if (a.health === "needs_attention") return "error";
  if (a.health === "watch") return "warning";
  if (!a.lastSyncedAtRelative) return "never";
  return "healthy";
};

const HEALTH_DOT: Record<VisualHealth, string> = {
  healthy: T.sgreen,
  warning: T.amber,
  error: T.red,
  auth: T.amber,
  retired: T.mute,
  paused: T.mute,
  safety: T.amber,
  never: T.mute,
  syncing: T.sgreen,
};

const HEALTH_LIST_COLOR: Record<VisualHealth, string> = {
  healthy: T.mute,
  warning: T.mute,
  error: T.red,
  auth: T.red,
  retired: T.mute,
  paused: T.mute,
  safety: T.mute,
  never: T.mute,
  syncing: T.sgreen,
};

const HEALTH_LIST_TEXT: Record<VisualHealth, (a: SyncAccountData) => string> = {
  healthy: (a) => a.lastSyncedAtRelative ?? "Synced",
  warning: () => "Needs attention",
  error: () => "Sync error",
  auth: () => "Auth error",
  retired: () => "Retired",
  paused: () => "Paused",
  safety: () => "Paused",
  never: () => "Never synced",
  syncing: () => "Syncing…",
};

const HEALTH_SUMMARY_COLOR: Record<VisualHealth, string> = {
  healthy: T.sgreen,
  warning: T.amber,
  error: T.red,
  auth: T.red,
  retired: T.mute,
  paused: T.mute,
  safety: T.amber,
  never: T.mute,
  syncing: T.sgreen,
};

const HEALTH_LABEL: Record<VisualHealth, string> = {
  healthy: "Connected",
  warning: `Consecutive failures`,
  error: "Last sync failed",
  auth: "Authentication failed",
  retired: "Retired",
  paused: "Paused",
  safety: "Paused for safety",
  never: "Never synced",
  syncing: "Syncing…",
};

const HEALTH_DETAIL: Record<VisualHealth, (a: SyncAccountData) => string> = {
  healthy: () => "Connected — syncing normally.",
  warning: (a) =>
    `${a.consecutiveFailures} consecutive sync failures. Kontax will keep retrying.`,
  error: (a) => `Last sync failed${a.lastErrorMessage ? ": " + a.lastErrorMessage : "."}`,
  auth: (a) =>
    a.provider === "CARDDAV"
      ? "Re-authentication required — your app password was rejected."
      : `Re-authentication required — your ${a.provider === "GOOGLE" ? "Google" : "Microsoft"} authorisation has expired or been revoked.`,
  retired: () => "This connection is no longer active.",
  paused: () => "Sync is paused. Click Resume to continue syncing.",
  safety: (a) =>
    a.conflictQueueFull
      ? "Auto-paused because the manual conflict queue is full. Resolve the open conflicts, then Resume."
      : "Auto-paused after repeated failures. Fix the issue, then Resume.",
  never: () => "This account has not synced yet. Click Sync now to start.",
  syncing: () => "Sync in progress…",
};

const getAccountRailSubtitle = (
  account: SyncAccountData,
  health: VisualHealth,
) => {
  if (account.provider !== "CARDDAV") {
    return account.connectedEmail ?? HEALTH_LIST_TEXT[health](account);
  }

  const identityText =
    account.providerSecondaryText ?? account.providerHost ?? account.baseUrl;
  const healthText = HEALTH_LIST_TEXT[health](account);

  return identityText === healthText ? identityText : `${identityText} · ${healthText}`;
};

const getBookScopeSummary = (account: SyncAccountData) =>
  account.bookAllowlist.length === 0
    ? "All discovered remote address books"
    : `${account.bookAllowlist.length} selected remote address book${account.bookAllowlist.length === 1 ? "" : "s"}`;

// ── Platform icon (SVG only) ─────────────────────────────────────────────────
type PlatKind = "icloud" | "nextcloud" | "fastmail" | "generic" | "gcontacts" | "outlook";

// P27-07: provider-aware icon — OAuth providers get their brand mark.
const getAccountIconKind = (account: {
  provider: SyncAccountData["provider"];
  providerBrandKey: SyncAccountData["providerBrandKey"];
}): PlatKind => {
  if (account.provider === "GOOGLE") return "gcontacts";
  if (account.provider === "MICROSOFT") return "outlook";
  if (account.providerBrandKey === "icloud") return "icloud";
  if (account.providerBrandKey === "nextcloud") return "nextcloud";
  if (account.providerBrandKey === "fastmail") return "fastmail";
  return "generic";
};

function PlatIcon({ kind, size = 24 }: { kind: PlatKind; size?: number }) {
  const s = size;
  if (kind === "gcontacts")
    // Official multi-colour Google "G".
    return (
      <svg width={s} height={s} viewBox="0 0 48 48" aria-hidden>
        <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
        <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
        <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
        <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
      </svg>
    );
  if (kind === "outlook")
    // Official Microsoft four-square mark.
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
        <rect x="2.4" y="2.4" width="8.7" height="8.7" fill="#F25022" />
        <rect x="12.9" y="2.4" width="8.7" height="8.7" fill="#7FBA00" />
        <rect x="2.4" y="12.9" width="8.7" height="8.7" fill="#00A4EF" />
        <rect x="12.9" y="12.9" width="8.7" height="8.7" fill="#FFB900" />
      </svg>
    );
  if (kind === "icloud")
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M7 18.5a3.7 3.7 0 01-.5-7.36A4.6 4.6 0 0115.6 9.7a3.4 3.4 0 01.9 8.8H7z"
          fill="#e8f1fc"
          stroke="#3b8ff0"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (kind === "nextcloud")
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="10" fill="#e7efe9" />
        <path
          d="M8 15V9.4l4 4 4-4V15"
          stroke={T.green}
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  if (kind === "fastmail")
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <rect x="3" y="5.5" width="18" height="13" rx="2.4" fill="#f2efe7" stroke="#9a8f6f" strokeWidth="1.4" />
        <path d="M4.5 7.5l7.5 5.2 7.5-5.2" stroke="#9a8f6f" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 18.5a3.7 3.7 0 01-.5-7.36A4.6 4.6 0 0115.6 9.7a3.4 3.4 0 01.9 8.8H7z"
        fill={T.wash}
        stroke={T.mute}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────
function Dot({ color, pulse = false }: { color: string; pulse?: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        animation: pulse ? "sy-pulse 2s ease-in-out infinite" : "none",
      }}
    />
  );
}


function ActionBtn({
  children,
  variant = "ghost",
  danger = false,
  disabled = false,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "ghost";
  danger?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  const base: React.CSSProperties = {
    height: 34,
    padding: "0 14px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    whiteSpace: "nowrap",
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
    transition: "background .15s ease",
    border: variant === "primary" ? "none" : `1px solid ${T.line}`,
    background: variant === "primary" ? T.blue : "#fff",
    color: variant === "primary" ? "#fff" : danger ? T.red : T.ink,
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={base}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background =
          variant === "primary" ? "#3347d8" : danger ? T.redWash : T.wash;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = variant === "primary" ? T.blue : "#fff";
      }}
    >
      {children}
    </button>
  );
}

// ── Direction badge ───────────────────────────────────────────────────────────
const DIR_BADGE = {
  TWO_WAY: { label: "Two-way", bg: T.sgreenWash, fg: T.sgreenText, glyph: "↕" },
  IMPORT_ONLY: { label: "Import only", bg: T.wash, fg: T.ink2, glyph: "↓" },
  EXPORT_ONLY: { label: "Export only", bg: T.wash, fg: T.ink2, glyph: "↑" },
};

// ── Conflict row (collapsible inline resolver) ───────────────────────────────
function ConflictRow({
  cf,
  redirectTo,
}: {
  cf: SyncConflictData;
  redirectTo: string;
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const [picks, setPicks] = useState<Array<"local" | "remote">>(cf.comparisonRows.map(() => "local"));

  const Outcome = ({
    children,
    strategy,
    variant = "ghost",
  }: {
    children: ReactNode;
    strategy: string;
    variant?: "primary" | "ghost";
  }) => (
    <form action={resolveSyncConflict}>
      <input type="hidden" name="syncConflictId" value={cf.id} />
      <input type="hidden" name="resolutionStrategy" value={strategy} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <ActionBtn variant={variant} type="submit">
        {children}
      </ActionBtn>
    </form>
  );

  return (
    <div style={{ borderTop: `1px solid ${T.line2}` }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          textAlign: "left",
          padding: "14px 4px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
        }}
      >
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>{cf.contactName}</span>
          <span style={{ fontSize: 13, color: T.ink2, marginLeft: 8 }}>
            · {cf.field} · <SyncTimestamp iso={cf.date} />
          </span>
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            color: T.blue,
            fontSize: 13,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          Review
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.blue}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transform: open ? "rotate(180deg)" : "none",
              transition: "transform .18s ease",
            }}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 4px 18px", animation: "sy-fade .15s ease" }}>
          {!manual ? (
            <>
              {/* comparison grid */}
              <div
                style={{
                  border: `1px solid ${T.line2}`,
                  borderRadius: 12,
                  overflow: "hidden",
                  marginBottom: 14,
                }}
              >
                <div
                  className="sy-cmp-grid sy-cmp-head"
                  style={{
                    background: T.wash,
                    borderBottom: `1px solid ${T.line2}`,
                  }}
                >
                  {["Field", "Kontax (local)", "Remote"].map((h) => (
                    <span
                      key={h}
                      style={{
                        padding: "9px 14px",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: T.mute,
                      }}
                    >
                      {h}
                    </span>
                  ))}
                </div>
                {cf.comparisonRows.map((r, i) => (
                  <div
                    key={i}
                    className="sy-cmp-grid"
                    style={{ borderTop: i ? `1px solid ${T.line2}` : "none" }}
                  >
                    <span style={{ padding: "11px 14px", fontSize: 13, color: T.ink2, fontWeight: 500 }}>
                      {r.label}
                    </span>
                    <span
                      style={{
                        padding: "11px 14px",
                        fontSize: 13,
                        color: T.ink,
                        background: "rgba(65,88,244,0.05)",
                      }}
                    >
                      {r.local}
                    </span>
                    <span
                      className="sy-cmp-remote"
                      style={{
                        padding: "11px 14px",
                        fontSize: 13,
                        color: T.ink,
                        background: "rgba(191,133,38,0.07)",
                        borderLeft: `1px solid ${T.line2}`,
                      }}
                    >
                      {r.remote}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Outcome strategy="KEEP_LOCAL">Keep local</Outcome>
                <Outcome strategy="KEEP_REMOTE">Keep remote</Outcome>
                <ActionBtn variant="primary" onClick={() => setManual(true)}>
                  Manual merge →
                </ActionBtn>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 12.5, color: T.ink2, marginBottom: 12, marginTop: 0 }}>
                Choose the value to keep for each field.
              </p>
              <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                {cf.comparisonRows.map((r, i) => (
                  <div key={i} style={{ border: `1px solid ${T.line2}`, borderRadius: 12, padding: 14 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: T.mute,
                        marginBottom: 10,
                      }}
                    >
                      {r.label}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {(
                        [
                          ["local", "Kontax (local)", r.local],
                          ["remote", "Remote", r.remote],
                        ] as const
                      ).map(([k, lbl, val]) => {
                        const on = picks[i] === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() =>
                              setPicks((p) => p.map((x, j) => (j === i ? k : x)))
                            }
                            style={{
                              textAlign: "left",
                              padding: "10px 12px",
                              borderRadius: 10,
                              cursor: "pointer",
                              border: on ? `2px solid ${T.blue}` : `1px solid ${T.line}`,
                              background: on ? T.blueT : "#fff",
                            }}
                          >
                            <span
                              style={{
                                display: "block",
                                fontSize: 11,
                                fontWeight: 600,
                                color: on ? T.blue : T.mute,
                                marginBottom: 4,
                              }}
                            >
                              {lbl}
                            </span>
                            <span style={{ display: "block", fontSize: 13, color: T.ink }}>
                              {val}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Outcome strategy="MANUAL_MERGE" variant="primary">
                  Save merged contact
                </Outcome>
                <button
                  type="button"
                  onClick={() => setManual(false)}
                  style={{
                    border: "none",
                    background: "transparent",
                    color: T.ink2,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: "0 8px",
                  }}
                >
                  ← Back
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sync history table ────────────────────────────────────────────────────────
function HistoryTable({
  jobs,
  isSyncing,
  remoteLabel,
}: {
  jobs: SyncJobRow[];
  isSyncing: boolean;
  remoteLabel: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [errId, setErrId] = useState<string | null>(null);
  const dirGlyph = { TWO_WAY: "↕", IMPORT_ONLY: "↓", EXPORT_ONLY: "↑" };
  const dirLabel = { TWO_WAY: "Two-way", IMPORT_ONLY: "Import", EXPORT_ONLY: "Export" };
  // Order by the time actually shown (`when` is the completed/started/created
  // ISO timestamp). The server orders by createdAt, which can differ from
  // completion order, so re-sort here so the rows read newest-first by date.
  const ordered = [...jobs].sort((a, b) => b.when.localeCompare(a.when));
  const visible = showAll ? ordered : ordered.slice(0, 5);

  return (
    <section style={{ marginTop: 30 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: T.mute,
          marginBottom: 6,
        }}
      >
        Sync history
      </div>
      {jobs.length === 0 && !isSyncing ? (
        <div style={{ padding: "26px 0", textAlign: "center", color: T.mute, fontSize: 13 }}>
          No sync jobs yet. Click &quot;Sync now&quot; to start.
        </div>
      ) : (
        <div>
          {/* table head */}
          <div className="sy-trow sy-thead" style={{ color: T.mute }}>
            {["Date", "Direction", "Changes", "Status"].map((h, i) => (
              <span
                key={h}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  textAlign: i === 3 ? "right" : "left",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* legend for the Changes column notation */}
          {(() => {
            const SYMBOLS: { sym: string; label: string; fg: string; bg: string }[] = [
              { sym: "+", label: "added", fg: T.sgreenText, bg: T.sgreenWash },
              { sym: "~", label: "updated", fg: T.amber, bg: T.amberT },
              { sym: "−", label: "removed", fg: T.red, bg: T.redWash },
            ];
            const Chip = ({ sym, label, fg, bg }: { sym: string; label: string; fg: string; bg: string }) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span
                  style={{
                    fontFamily: '"Geist Mono", ui-monospace, monospace',
                    fontSize: 11,
                    fontWeight: 700,
                    color: fg,
                    background: bg,
                    borderRadius: 5,
                    padding: "0 5px",
                    lineHeight: "16px",
                    minWidth: 18,
                    textAlign: "center",
                  }}
                >
                  {sym}
                </span>
                <span>{label}</span>
              </span>
            );
            const Dir = ({ arrow, party, verb }: { arrow: string; party: string; verb: string }) => (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <span style={{ color: T.ink2, fontWeight: 600 }}>{arrow}</span>
                <span>
                  <span style={{ color: T.ink2, fontWeight: 600 }}>{party}</span> {verb}
                </span>
              </span>
            );
            return (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                  gap: "8px 16px",
                  fontSize: 11.5,
                  color: T.mute,
                  padding: "8px 0 4px",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
                  {SYMBOLS.map((s) => (
                    <Chip key={s.sym} {...s} />
                  ))}
                </span>
                <span style={{ width: 1, height: 13, background: T.line, flexShrink: 0 }} />
                <span style={{ display: "inline-flex", alignItems: "center", gap: 14 }}>
                  <Dir arrow="↓" party="Kontax" verb="pulled in" />
                  <Dir arrow="↑" party={remoteLabel} verb="pushed out" />
                </span>
              </div>
            );
          })()}

          {/* in-progress row */}
          {isSyncing && (
            <div
              className="sy-trow"
              style={{ borderTop: `1px solid ${T.line2}`, animation: "sy-fade .15s ease" }}
            >
              <span data-th="Date" style={{ color: T.ink2 }}>In progress</span>
              <span data-th="Direction" style={{ color: T.mute }}>↕ Two-way</span>
              <span data-th="Changes" style={{ color: T.mute }}>—</span>
              <span
                data-th="Status"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 6,
                  color: T.sgreen,
                  fontWeight: 600,
                }}
              >
                <Spinner size={13} color={T.sgreen} />
              </span>
            </div>
          )}

          {visible.map((j) => (
            <div
              key={j.id}
              className="sy-trow"
              style={{ borderTop: `1px solid ${T.line2}`, position: "relative" }}
            >
              <span data-th="Date" style={{ color: T.ink2 }}><SyncTimestamp iso={j.when} /></span>
              <span data-th="Direction" style={{ color: T.mute }}>
                {dirGlyph[j.direction]} {dirLabel[j.direction]}
              </span>
              <span
                data-th="Changes"
                style={{
                  fontFamily: '"Geist Mono", ui-monospace, monospace',
                  color: T.ink2,
                  fontSize: 12.5,
                }}
              >
                {j.status === "ok" ? (
                  <span style={{ display: "grid", gap: 2 }}>
                    <span
                      title={`Kontax: ${j.added} added · ${j.modified} updated · ${j.deleted} removed`}
                    >
                      <span style={{ color: T.mute }}>Kontax</span> +{j.added} ~{j.modified} −
                      {j.deleted}
                    </span>
                    <span
                      title={`${remoteLabel}: ${j.pushedAdded} added · ${j.pushedModified} updated · ${j.pushedDeleted} removed`}
                    >
                      <span style={{ color: T.mute }}>{remoteLabel}</span> +{j.pushedAdded} ~
                      {j.pushedModified} −{j.pushedDeleted}
                    </span>
                  </span>
                ) : (
                  "—"
                )}
              </span>
              <span data-th="Status" style={{ display: "flex", justifyContent: "flex-end" }}>
                {j.status === "ok" ? (
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={T.sgreen}
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5l4 4 10-10" />
                  </svg>
                ) : j.status === "pending" ? (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={T.mute}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-label="Queued — waiting to run"
                  >
                    <title>Queued — waiting to run</title>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 7v5l3 2" />
                  </svg>
                ) : (
                  <button
                    type="button"
                    onClick={() => setErrId(errId === j.id ? null : j.id)}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      color: T.red,
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: 0,
                    }}
                  >
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={T.red}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                )}
                {errId === j.id && j.error && (
                  <span
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% - 4px)",
                      zIndex: 30,
                      width: 250,
                      background: "#23302a",
                      color: "#fff",
                      fontSize: 12,
                      lineHeight: 1.4,
                      padding: "9px 11px",
                      borderRadius: 9,
                      boxShadow: "0 10px 30px rgba(0,0,0,.28)",
                    }}
                  >
                    {j.error}
                  </span>
                )}
              </span>
            </div>
          ))}

          {jobs.length > 5 && (
            <button
              type="button"
              onClick={() => setShowAll((s) => !s)}
              style={{
                marginTop: 12,
                border: "none",
                background: "transparent",
                color: T.blue,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                padding: 0,
              }}
            >
              {showAll ? "Show fewer" : "Show older →"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

// ── P23-05: conflict-queue-full auto-pause banner ─────────────────────────────
function AutoPauseBanner() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: "#f6edd9",
        border: "1px solid #fcd34d",
        borderRadius: 10,
        padding: "14px 16px",
        marginBottom: 22,
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#9a6a12"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: "#7a5a1a" }}>
          Sync paused — conflict queue is full
        </div>
        <div style={{ fontSize: 13, color: "#8a6a2a", marginTop: 3 }}>
          Review and resolve the open conflicts below to resume automatic sync.
        </div>
      </div>
    </div>
  );
}

// ── P27-08: post-import duplicates banner ─────────────────────────────────────
function DuplicatesBanner({ count }: { count: number }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        background: "#f6edd9",
        border: "1px solid #e9c87b",
        borderRadius: 10,
        padding: "12px 16px",
        marginBottom: 22,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#bf8526"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
      <div style={{ fontSize: 13, color: "#7a5a1a" }}>
        <strong>
          {count} potential duplicate{count === 1 ? "" : "s"}
        </strong>{" "}
        found from this import.
      </div>
      <Link
        href="/contacts?tab=duplicates"
        style={{ fontSize: 13, fontWeight: 600, color: "#4158f4", marginLeft: "auto", whiteSpace: "nowrap" }}
      >
        Review suggestions →
      </Link>
    </div>
  );
}

function CapabilityNote({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: "#f2f4f0",
        border: "1px solid #d8ddd6",
        borderRadius: 10,
        padding: "12px 14px",
        marginBottom: 22,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={T.ink2}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10v5" />
        <path d="M12 7h.01" />
      </svg>
      <div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 3, lineHeight: 1.5 }}>
          {body}
        </div>
      </div>
    </div>
  );
}

function DiagnosticsStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${T.line2}`,
        background: "#fff",
        padding: "12px 13px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: T.mute,
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 7, fontSize: 14, fontWeight: 600, color: T.ink }}>
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12.5, lineHeight: 1.45, color: T.ink2 }}>
        {detail}
      </div>
    </div>
  );
}

function SyncDiagnosticsPanel({
  account,
}: {
  account: SyncAccountData;
}) {
  const syncedBothWays = account.diagnosticsFieldSupport.filter(
    (field) => field.support === "two_way",
  );
  const localOnly = account.diagnosticsFieldSupport.filter(
    (field) => field.support === "local_only",
  );

  return (
    <section
      style={{
        marginBottom: 24,
        border: `1px solid ${T.line}`,
        borderRadius: 14,
        background: "#f8faf8",
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.mute,
            }}
          >
            Sync diagnostics
          </div>
          <div style={{ marginTop: 6, fontSize: 14, lineHeight: 1.55, color: T.ink2, maxWidth: 620 }}>
            See what this provider stores, what stays local to Kontax, and whether recent changes
            were flowing in both directions.
          </div>
        </div>
        <Link
          href={account.diagnosticsHelpHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            borderRadius: 9,
            border: `1px solid ${T.line}`,
            background: "#fff",
            padding: "9px 12px",
            fontSize: 13,
            fontWeight: 600,
            color: T.ink,
            textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >
          Provider guide
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 10,
          marginTop: 14,
        }}
      >
        <DiagnosticsStat
          label="Last healthy sync"
          value={account.lastSuccessfulJobRelative ?? "No completed sync yet"}
          detail="Most recent successful or partially successful sync run."
        />
        <DiagnosticsStat
          label="Remote updates pulled"
          value={
            account.direction === "EXPORT_ONLY"
              ? "Not enabled"
              : account.lastInboundActivityRelative ?? "No recent remote changes"
          }
          detail="When Kontax last imported a real change from this provider."
        />
        <DiagnosticsStat
          label="Kontax updates pushed"
          value={
            account.direction === "IMPORT_ONLY"
              ? "Not enabled"
              : account.lastOutboundActivityRelative ?? "No recent outbound changes"
          }
          detail="When Kontax last pushed a real change out to this provider."
        />
      </div>

      {account.diagnosticsWarnings.length > 0 ? (
        <div style={{ marginTop: 14, display: "grid", gap: 8 }}>
          {account.diagnosticsWarnings.map((warning) => (
            <div
              key={warning}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-start",
                borderRadius: 10,
                background: "#fff",
                border: `1px solid ${T.line2}`,
                padding: "11px 12px",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.ink2}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ flexShrink: 0, marginTop: 1 }}
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 10v5" />
                <path d="M12 7h.01" />
              </svg>
              <span style={{ fontSize: 12.5, lineHeight: 1.5, color: T.ink2 }}>{warning}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 14,
          marginTop: 16,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.mute,
              marginBottom: 8,
            }}
          >
            Syncs both ways
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {syncedBothWays.map((field) => (
              <div
                key={field.key}
                style={{
                  borderRadius: 10,
                  background: "#fff",
                  border: `1px solid ${T.line2}`,
                  padding: "10px 12px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{field.label}</span>
                  <span
                    style={{
                      borderRadius: 999,
                      background: "#e7efe9",
                      color: T.sgreen,
                      padding: "3px 8px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    Two-way
                  </span>
                </div>
                <div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.45, color: T.ink2 }}>
                  {field.detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: T.mute,
              marginBottom: 8,
            }}
          >
            Stays in Kontax
          </div>
          {localOnly.length === 0 ? (
            <div
              style={{
                borderRadius: 10,
                border: `1px solid ${T.line2}`,
                background: "#fff",
                padding: "12px 13px",
                fontSize: 12.5,
                lineHeight: 1.5,
                color: T.ink2,
              }}
            >
              This provider stores every field family Kontax is currently sending here.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {localOnly.map((field) => (
                <div
                  key={field.key}
                  style={{
                    borderRadius: 10,
                    background: "#fff",
                    border: `1px solid ${T.line2}`,
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{field.label}</span>
                    <span
                      style={{
                        borderRadius: 999,
                        background: "#f2f4f0",
                        color: T.ink2,
                        padding: "3px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Local only
                    </span>
                  </div>
                  <div style={{ marginTop: 5, fontSize: 12.5, lineHeight: 1.45, color: T.ink2 }}>
                    {field.detail}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Re-auth banner ────────────────────────────────────────────────────────────
function ReauthBanner({ onFix }: { onFix: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderRadius: 12,
        background: T.amberT,
        border: "1px solid #ecdcb6",
        marginBottom: 22,
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#7a5a1a"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
      <span style={{ flex: 1, fontSize: 13, color: "#7a5a1a", fontWeight: 500 }}>
        Re-authentication required.
      </span>
      <button
        type="button"
        onClick={onFix}
        style={{
          border: "none",
          background: "transparent",
          color: "#7a5a1a",
          fontSize: 13,
          fontWeight: 700,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Update credentials →
      </button>
    </div>
  );
}

// ── P27-07: OAuth detail-panel metadata row ──────────────────────────────────
function OAuthMetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "168px 1fr",
        alignItems: "baseline",
        gap: 12,
        padding: "9px 0",
        borderTop: `1px solid ${T.line2}`,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: T.mute,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: T.ink2, minWidth: 0 }}>{children}</span>
    </div>
  );
}

// ── P27-07: OAuth-specific error banners (re-auth / quota / scope-reduced) ─────
// reauthEmail: pass the account's connectedEmail when 2+ accounts of the same
// provider exist so the button label disambiguates which account needs fixing.
function OAuthErrorBanner({
  account,
  reauthEmail,
}: {
  account: SyncAccountData;
  reauthEmail?: string | null;
}) {
  const providerName = account.provider === "GOOGLE" ? "Google" : "Outlook";
  const authParty = account.provider === "GOOGLE" ? "Google" : "Microsoft";
  const connectPath =
    account.provider === "GOOGLE" ? "/api/sync/google/connect" : "/api/sync/microsoft/connect";
  const code = account.lastErrorCode ?? "";
  const isQuota = code === "GOOGLE_QUOTA_EXCEEDED" || code === "MICROSOFT_QUOTA_EXCEEDED";
  const isPermissionReduced = code === "GOOGLE_PERMISSION_REDUCED" || code === "MICROSOFT_PERMISSION_REDUCED";
  const isReauth = account.status === "NEEDS_REAUTH";

  // Nothing actionable to surface.
  if (!isReauth && !isQuota && !isPermissionReduced) return null;

  const amber = { bg: "#f6edd9", border: "#e9c87b", title: "#7a5a1a", body: "#8a6a2a" };

  if (isQuota) {
    return (
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          background: amber.bg,
          border: `1px solid ${amber.border}`,
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 22,
        }}
      >
        <WarnTri />
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: amber.title }}>
            {providerName} API quota exceeded
          </div>
          <div style={{ fontSize: 13, color: amber.body, marginTop: 3, lineHeight: 1.5 }}>
            Sync is paused. Kontax will automatically retry later. "Sync now" is disabled during the
            pause.
          </div>
        </div>
      </div>
    );
  }

  if (isPermissionReduced) {
    return (
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "flex-start",
          background: "#f7e9e4",
          border: "1px solid #e8c6ba",
          borderRadius: 10,
          padding: "14px 16px",
          marginBottom: 22,
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
          <path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" />
        </svg>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#7a2e1a" }}>Permission reduced</div>
          <div style={{ fontSize: 13, color: "#8f4733", marginTop: 3, lineHeight: 1.5, maxWidth: 480 }}>
            You removed Contacts access from the Kontax app in your {authParty} account. Re-authorise to restore sync.
          </div>
          <a href={connectPath} style={{ textDecoration: "none" }}>
            <span style={{ display: "inline-block", marginTop: 12, height: 36, padding: "0 15px", lineHeight: "36px", borderRadius: 9, background: T.red, color: "#fff", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
              Re-authorise →
            </span>
          </a>
        </div>
      </div>
    );
  }

  // Re-authorisation required (AUTH_FAILED / NEEDS_REAUTH).
  // P35: show email in button when reauthEmail is provided (2+ accounts of same provider).
  const reauthTarget = reauthEmail ?? providerName;
  return (
    <div
      style={{
        background: amber.bg,
        border: `1px solid ${amber.border}`,
        borderRadius: 12,
        padding: "16px 18px",
        marginBottom: 22,
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <WarnTri />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: amber.title }}>
            Re-authorisation required
          </div>
          <div style={{ fontSize: 13, color: amber.body, marginTop: 3, lineHeight: 1.5, maxWidth: 480 }}>
            Your {authParty} authorisation{reauthEmail ? ` for ${reauthEmail}` : ""} has expired or
            been revoked. Re-authorise to restore the connection.
          </div>
          <a href={connectPath} style={{ textDecoration: "none" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                marginTop: 13,
                height: 38,
                padding: "0 16px",
                borderRadius: 9,
                background: T.green,
                color: "#dff0e7",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <PlatIcon kind={account.provider === "GOOGLE" ? "gcontacts" : "outlook"} size={16} />
              Re-authorise {reauthTarget} →
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

function WarnTri() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#9a6a12"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, marginTop: 1 }}
    >
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

// ── Account header ─────────────────────────────────────────────────────────
function AccountHeader({
  account,
  vHealth,
  isSyncing,
  redirectTo,
  onEdit,
  onSettings,
  onRequestDisconnect,
  reauthEmail,
}: {
  account: SyncAccountData;
  vHealth: VisualHealth;
  isSyncing: boolean;
  redirectTo: string;
  onEdit: () => void;
  onSettings: () => void;
  onRequestDisconnect: () => void;
  // P35: disambiguate re-auth button when 2+ accounts of same provider
  reauthEmail?: string | null;
}) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const isPaused = account.status === "PAUSED";
  const isRetired = account.status === "RETIRED";
  const dir = DIR_BADGE[account.direction];
  const isOAuth = account.provider !== "CARDDAV";
  const providerName = account.provider === "GOOGLE" ? "Google" : "Outlook";
  const connectPath =
    account.provider === "GOOGLE" ? "/api/sync/google/connect" : "/api/sync/microsoft/connect";
  const needsReauth = isOAuth && account.status === "NEEDS_REAUTH";

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(account.baseUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1600);
    } catch {
      /* ignore */
    }
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <span style={{ marginTop: 2 }}>
          <PlatIcon kind={getAccountIconKind(account)} size={30} />
        </span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: T.ink,
            }}
          >
            {account.label}
          </h1>
          {isOAuth ? (
            <div
              style={{
                fontSize: 13,
                color: T.mute,
                marginTop: 3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 360,
              }}
            >
              {account.connectedEmail ?? providerName}
            </div>
          ) : (
            <div style={{ marginTop: 3, display: "grid", gap: 4 }}>
              <div
                style={{
                  fontSize: 13,
                  color: T.mute,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  maxWidth: 520,
                }}
              >
                {account.providerSecondaryText ?? account.providerHost ?? account.baseUrl}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span
                  style={{
                    fontSize: 12,
                    color: T.mute,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 420,
                    fontFamily: '"Geist Mono", ui-monospace, monospace',
                  }}
                >
                  {account.baseUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  title="Copy URL"
                  style={{
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    padding: 2,
                    color: copiedUrl ? T.sgreen : T.mute,
                    display: "inline-flex",
                    flexShrink: 0,
                  }}
                >
                  {copiedUrl ? (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={T.sgreen}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12.5l4 4 10-10" />
                    </svg>
                  ) : (
                    <svg
                      width="15"
                      height="15"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 012-2h10" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* direction + health */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          flexWrap: "wrap",
          marginTop: 14,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: dir.bg,
            color: dir.fg,
            whiteSpace: "nowrap",
          }}
        >
          {dir.glyph} {dir.label}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 13,
            fontWeight: 500,
            color: HEALTH_SUMMARY_COLOR[vHealth],
            whiteSpace: "nowrap",
          }}
        >
          <Dot color={HEALTH_DOT[vHealth]} pulse={vHealth === "syncing"} />
          {HEALTH_LABEL[vHealth]}
        </span>
      </div>
      <div style={{ fontSize: 13, color: T.ink2, marginTop: 8, maxWidth: 520 }}>
        {HEALTH_DETAIL[vHealth](account)}
      </div>
      {isRetired && (
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 6, maxWidth: 520, lineHeight: 1.5 }}>
          {account.replacedBySyncAccountLabel
            ? `Replaced by ${account.replacedBySyncAccountLabel}${formatAccountEventTime(account.retiredAt) ? ` on ${formatAccountEventTime(account.retiredAt)}` : ""}.`
            : "This connection was intentionally replaced and kept for history."}
        </div>
      )}
      {!isRetired && account.replacesSyncAccountLabel && (
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 6, maxWidth: 520, lineHeight: 1.5 }}>
          Replaced previous connection: {account.replacesSyncAccountLabel}.
        </div>
      )}
      {vHealth !== "never" && vHealth !== "syncing" && account.lastSyncedAtRelative && (
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 2 }}>
          Last synced:{" "}
          <span style={{ color: T.ink, fontWeight: 500 }}>{account.lastSyncedAtRelative}</span>
        </div>
      )}
      <div
        style={{
          marginTop: 16,
          maxWidth: 560,
          border: `1px solid ${T.line2}`,
          borderRadius: 12,
          background: "#f8faf8",
          padding: "12px 14px",
        }}
      >
        {account.provider === "CARDDAV" ? (
          <div style={{ fontSize: 13, lineHeight: 1.55, color: T.ink2 }}>
            <span style={{ fontWeight: 600, color: T.ink }}>Remote book scope:</span>{" "}
            {getBookScopeSummary(account)}. Change this from <span style={{ fontWeight: 600, color: T.ink }}>Settings → Address books</span> on this connection.
          </div>
        ) : null}
        <div style={{ fontSize: 13, lineHeight: 1.55, color: T.ink2, marginTop: account.provider === "CARDDAV" ? 6 : 0 }}>
          <span style={{ fontWeight: 600, color: T.ink }}>Kontax books:</span>{" "}
          Organise your private and shared books separately in{" "}
          <Link href="/settings/books" style={{ color: T.blue, fontWeight: 600, textDecoration: "none" }}>
            Settings → Books
          </Link>
          .
        </div>
      </div>

      {/* P27-07: OAuth metadata */}
      {isOAuth && (
        <div style={{ marginTop: 18, maxWidth: 520 }}>
          <OAuthMetaRow label="Connected account">
            <span style={{ color: T.ink, fontWeight: 500 }}>
              {account.connectedEmail ?? "—"}
            </span>
          </OAuthMetaRow>
          <OAuthMetaRow label="Authorised scope">{account.scope ?? "Contacts"}</OAuthMetaRow>
          <OAuthMetaRow label="Token status">
            {account.tokenStatus === "valid" ? (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.sgreen, fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.sgreen} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4 4 10-10" />
                </svg>
                Valid
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.red, fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.red} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" />
                </svg>
                Expired
              </span>
            )}
          </OAuthMetaRow>
          <OAuthMetaRow label="Last refreshed">{account.lastRefreshedRelative ?? "—"}</OAuthMetaRow>
        </div>
      )}

      {/* action buttons */}
      {!isRetired ? (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 18 }}>
        {/* sync now */}
        <form action={queueSyncJob}>
          <input type="hidden" name="syncAccountId" value={account.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <ActionBtn variant="primary" type="submit" disabled={isSyncing || isPaused}>
            {isSyncing ? (
              <>
                <Spinner size={13} color="#fff" /> Syncing…
              </>
            ) : (
              "Sync now"
            )}
          </ActionBtn>
        </form>

        {/* pause / resume */}
        <form action={isPaused ? activateSyncAccount : pauseSyncAccount}>
          <input type="hidden" name="syncAccountId" value={account.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <ActionBtn type="submit">{isPaused ? "Resume" : "Pause"}</ActionBtn>
        </form>

        {/* settings — opens the sync settings panel in the detail zone */}
        <ActionBtn onClick={onSettings}>Settings</ActionBtn>

        {/* edit credentials (CardDAV) / re-authorise (OAuth, only when needed) */}
        {isOAuth ? (
          needsReauth && (
            <a href={connectPath} style={{ textDecoration: "none" }}>
              <ActionBtn>
                Re-authorise{reauthEmail ? ` ${reauthEmail}` : ""}
              </ActionBtn>
            </a>
          )
        ) : (
          <ActionBtn onClick={onEdit}>Edit credentials</ActionBtn>
        )}

        {/* disconnect */}
        <ActionBtn danger onClick={onRequestDisconnect}>
          Disconnect
        </ActionBtn>
      </div>
      ) : null}
    </div>
  );
}

// ── Edit credentials form ─────────────────────────────────────────────────────
function EditCredentialsForm({
  account,
  onCancel,
}: {
  account: SyncAccountData;
  onCancel: () => void;
}) {
  const [reveal, setReveal] = useState(false);
  const router = useRouter();
  const [state, formAction] = useActionState(attachSyncCredentials, {
    ok: false,
    error: null,
  });

  // On success, close the form and refresh in place (a client navigation that
  // carries cookies — no server redirect, so no reverse-proxy logout).
  useEffect(() => {
    if (state.ok) {
      onCancel();
      router.refresh();
    }
  }, [state.ok, onCancel, router]);

  return (
    <div style={{ animation: "sy-fade .15s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: T.ink }}>
          Edit credentials
        </h2>
        <button
          type="button"
          onClick={onCancel}
          style={{
            width: 30,
            height: 30,
            border: `1px solid ${T.line}`,
            borderRadius: 8,
            background: "#fff",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            color: T.ink2,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <form action={formAction}>
        <input type="hidden" name="syncAccountId" value={account.id} />
        {state.error && (
          <div
            style={{
              marginBottom: 14,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e7b4a6",
              background: "rgba(181,71,47,0.08)",
              fontSize: 13,
              color: "#8a3520",
            }}
          >
            {state.error}
          </div>
        )}
        <div style={{ display: "grid", gap: 14, maxWidth: 460 }}>
          <FormField label="Username" name="username" placeholder="you@example.com" />
          <div>
            <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={reveal ? "text" : "password"}
                name="password"
                placeholder="App-specific password"
                required
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 12,
                  border: `1px solid ${T.line}`,
                  background: "#fff",
                  padding: "0 58px 0 14px",
                  fontSize: 14,
                  color: T.ink,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  color: T.ink2,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {reveal ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
          <ActionBtn variant="primary" type="submit">
            Save changes
          </ActionBtn>
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: "none",
              background: "transparent",
              color: T.ink2,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function FormField({
  label,
  name,
  placeholder,
  defaultValue,
  required,
  mono,
  hint,
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  mono?: boolean;
  hint?: ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>
        {label}
        {hint}
      </span>
      <input
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 12,
          border: `1px solid ${T.line}`,
          background: "#fff",
          padding: "0 14px",
          fontSize: 14,
          color: T.ink,
          outline: "none",
          fontFamily: mono ? '"Geist Mono", ui-monospace, monospace' : "inherit",
          boxSizing: "border-box",
        }}
      />
    </label>
  );
}

// ── Add account form ──────────────────────────────────────────────────────────
type QuickPreset = {
  kind: PlatKind;
  label: string;
  url: string;
};

const QUICK_PRESETS: QuickPreset[] = [
  { kind: "icloud", label: "iCloud", url: "https://contacts.icloud.com" },
  { kind: "nextcloud", label: "Nextcloud", url: "https://" },
  { kind: "fastmail", label: "Fastmail", url: "https://carddav.fastmail.com/dav/addressbooks" },
  { kind: "generic", label: "Manual", url: "" },
];

// P27-07: OAuth quick-connect tiles — navigate to the connector's redirect route.
const OAUTH_TILES: Array<{ provider: string; kind: PlatKind; label: string; sub: string; href: string }> = [
  {
    provider: "GOOGLE",
    kind: "gcontacts",
    label: "Google Contacts",
    sub: "via Google People API",
    href: "/api/sync/google/connect",
  },
  {
    provider: "MICROSOFT",
    kind: "outlook",
    label: "Outlook / Exchange",
    sub: "via Microsoft Graph",
    href: "/api/sync/microsoft/connect",
  },
];

type MatchResolution = "reconnect" | "replace";

const formatReconnectMatchTime = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const reconnectMatchIconKind = (
  provider: SyncAccountData["provider"],
  providerBrandKey: SyncAccountData["providerBrandKey"],
): PlatKind => {
  if (provider === "GOOGLE") return "gcontacts";
  if (provider === "MICROSOFT") return "outlook";
  if (providerBrandKey === "icloud") return "icloud";
  if (providerBrandKey === "nextcloud") return "nextcloud";
  if (providerBrandKey === "fastmail") return "fastmail";
  return "generic";
};

const formatAccountEventTime = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
};

function AddAccountForm({
  onCancel,
  accounts,
  syncAccountsLimit,
  upgradeableAtCap,
}: {
  onCancel: () => void;
  accounts: SyncAccountData[];
  syncAccountsLimit: number;
  upgradeableAtCap: boolean;
}) {
  const [sel, setSel] = useState<QuickPreset>(QUICK_PRESETS[0]!);
  const [baseUrl, setBaseUrl] = useState(QUICK_PRESETS[0]!.url);
  const [labelValue, setLabelValue] = useState(QUICK_PRESETS[0]!.label);
  const [reveal, setReveal] = useState(false);
  const [matchResolution, setMatchResolution] = useState<MatchResolution>("reconnect");
  const router = useRouter();
  const [state, formAction] = useActionState(createSyncAccount, {
    ok: false,
    error: null,
    requiresChoice: false,
    match: null,
  });
  const choiceMatch = state.requiresChoice ? state.match ?? null : null;

  // On success, navigate to the new connection (a client navigation that carries
  // cookies — no server redirect, so no reverse-proxy logout).
  useEffect(() => {
    if (state.ok && state.accountId) {
      router.push(`/sync?account=${state.accountId}`);
    }
  }, [state.ok, state.accountId, router]);

  useEffect(() => {
    if (choiceMatch) {
      setMatchResolution("reconnect");
    }
  }, [choiceMatch?.syncAccountId]);

  const pickPreset = (q: QuickPreset) => {
    setSel(q);
    setBaseUrl(q.url);
    setLabelValue(q.label);
  };

  const capReached = accounts.length >= syncAccountsLimit;

  // P35: entitlement cap — show the gate instead of the form
  if (capReached) {
    return (
      <div style={{ animation: "sy-fade .15s ease" }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: T.ink }}>
          Add sync account
        </h2>
        <p style={{ margin: "0 0 22px", fontSize: 13.5, color: T.ink2, maxWidth: 480 }}>
          You've reached the sync-account limit for your plan.
        </p>
        <div style={{ maxWidth: 520 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#f6edd9", border: "1px solid #e9c87b", borderRadius: 10, padding: "14px 16px" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9a6a12" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" />
            </svg>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#7a5a1a", lineHeight: 1.5 }}>
                You're using all {accounts.length} of your {syncAccountsLimit} sync accounts.
              </div>
              <div style={{ fontSize: 13, color: "#8a6a2a", marginTop: 2, lineHeight: 1.5 }}>
                {upgradeableAtCap ? (
                  <>Upgrade to Pro to connect more.{" "}
                    <Link href="/settings/billing" style={{ color: T.blue, fontWeight: 600, textDecoration: "none" }}>Upgrade →</Link>
                  </>
                ) : (
                  "Contact support to increase your limit."
                )}
              </div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 22 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ border: "none", background: "transparent", color: T.ink2, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0, display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
            Back to accounts
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ animation: "sy-fade .15s ease" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: T.ink }}>
        Add sync account
      </h2>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, color: T.ink2, maxWidth: 480 }}>
        Connect a Google or Microsoft account in one tap, or link any CardDAV service manually.
      </p>
      <div
        style={{
          maxWidth: 520,
          marginBottom: 18,
          border: `1px solid ${T.line2}`,
          borderRadius: 12,
          background: "#f8faf8",
          padding: "12px 14px",
          fontSize: 13,
          lineHeight: 1.55,
          color: T.ink2,
        }}
      >
        After a CardDAV connection is saved, you can choose which remote address books it pulls from.
        Your Kontax-side private and shared books stay managed separately in{" "}
        <Link href="/settings/books" style={{ color: T.blue, fontWeight: 600, textDecoration: "none" }}>
          Settings → Books
        </Link>
        .
      </div>

      {/* P27-07 / P35: OAuth quick-connect — "Connect another…" when ≥1 of same provider */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink2 }}>Connect with OAuth</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
          marginBottom: 24,
          maxWidth: 460,
        }}
      >
        {OAUTH_TILES.map((p) => {
          const existingEmails = accounts
            .filter((a) => a.provider === p.provider && a.connectedEmail)
            .map((a) => a.connectedEmail as string);
          const hasExisting = existingEmails.length > 0;
          const label = hasExisting
            ? `Connect another ${p.provider === "GOOGLE" ? "Google" : "Outlook"} account`
            : p.label;
          const sub = hasExisting
            ? existingEmails.length <= 2
              ? `${existingEmails.join(", ")} already connected`
              : `${existingEmails.length} accounts connected`
            : p.sub;
          return (
            <a
              key={p.provider}
              href={p.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "13px 15px",
                minHeight: 64,
                borderRadius: 12,
                border: `1px solid ${T.line}`,
                background: "#fff",
                textDecoration: "none",
                boxSizing: "border-box",
              }}
            >
              <span style={{ flexShrink: 0, width: 26, display: "grid", placeItems: "center" }}>
                <PlatIcon kind={p.kind} size={26} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 600, color: T.ink, lineHeight: 1.2 }}>
                  {label}
                </span>
                <span style={{ display: "block", fontSize: hasExisting ? 11 : 11.5, color: T.mute, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
              </span>
            </a>
          );
        })}
      </div>

      {/* quick-connect tiles (CardDAV) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink2 }}>CardDAV</span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {QUICK_PRESETS.map((q) => {
          const on = sel.kind === q.kind;
          return (
            <button
              key={q.kind}
              type="button"
              onClick={() => pickPreset(q)}
              style={{
                width: 80,
                height: 64,
                borderRadius: 10,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                border: on ? `2px solid ${T.blue}` : `1px solid ${T.line}`,
                background: on ? "#edf0fe" : "#fff",
                transition: "background .15s ease",
              }}
            >
              <PlatIcon kind={q.kind} size={28} />
              <span style={{ fontSize: 11, fontWeight: 600, color: T.ink2 }}>{q.label}</span>
            </button>
          );
        })}
      </div>

      <form action={formAction}>
        {state.error && (
          <div
            style={{
              marginBottom: 14,
              maxWidth: 460,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #e7b4a6",
              background: "rgba(181,71,47,0.08)",
              fontSize: 13,
              color: "#8a3520",
            }}
          >
            {state.error}
          </div>
        )}
        {choiceMatch && (
          <div
            style={{
              marginBottom: 16,
              maxWidth: 460,
              padding: "14px 16px",
              borderRadius: 12,
              border: "1px solid #d7ddf8",
              background: "#f5f7ff",
            }}
          >
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "#fff",
                  border: "1px solid #e3e7fb",
                  display: "grid",
                  placeItems: "center",
                  flexShrink: 0,
                }}
              >
                <PlatIcon
                  kind={reconnectMatchIconKind(
                    choiceMatch.provider,
                    choiceMatch.providerBrandKey,
                  )}
                  size={22}
                />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.ink }}>
                  Kontax found a previous connection
                </div>
                <div style={{ fontSize: 12.5, color: T.ink2, marginTop: 3, lineHeight: 1.5 }}>
                  This label and server URL match a disconnected connection. Choose whether to continue that connection or start fresh.
                </div>
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "#fff",
                    border: "1px solid #e3e7fb",
                  }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                    {choiceMatch.label}
                  </div>
                  <div style={{ fontSize: 12, color: T.mute, marginTop: 2 }}>
                    {choiceMatch.lastSucceededAt
                      ? `Last synced ${formatReconnectMatchTime(choiceMatch.lastSucceededAt)}`
                      : choiceMatch.disconnectedAt
                        ? `Disconnected ${formatReconnectMatchTime(choiceMatch.disconnectedAt)}`
                        : "Previously connected"}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "11px 12px",
                  borderRadius: 10,
                  border:
                    matchResolution === "reconnect"
                      ? `1.5px solid ${T.blue}`
                      : "1px solid #d7ddf8",
                  background:
                    matchResolution === "reconnect" ? "#edf0fe" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="chooserResolution"
                  checked={matchResolution === "reconnect"}
                  onChange={() => setMatchResolution("reconnect")}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                    Reconnect existing connection
                  </span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: T.ink2, lineHeight: 1.45 }}>
                    Restore this connection with its previous settings and history.
                  </span>
                </span>
              </label>

              <label
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "flex-start",
                  padding: "11px 12px",
                  borderRadius: 10,
                  border:
                    matchResolution === "replace"
                      ? `1.5px solid ${T.blue}`
                      : "1px solid #d7ddf8",
                  background:
                    matchResolution === "replace" ? "#edf0fe" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="chooserResolution"
                  checked={matchResolution === "replace"}
                  onChange={() => setMatchResolution("replace")}
                  style={{ marginTop: 2 }}
                />
                <span>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: T.ink }}>
                    Create new connection and retire old one
                  </span>
                  <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: T.ink2, lineHeight: 1.45 }}>
                    Start fresh and keep the old connection as retired history.
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}
        <div style={{ display: "grid", gap: 14, maxWidth: 460 }}>
          <label style={{ display: "block" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>Label</span>
            <input
              name="label"
              required
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              placeholder={sel.label}
              style={{ width: "100%", height: 44, borderRadius: 12, border: `1px solid ${T.line}`, background: "#fff", padding: "0 14px", fontSize: 14, color: T.ink, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
            />
          </label>
          <label style={{ display: "block" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>
              Server URL
              <HelpTooltip learnHref="/help#carddav" place="bottom">
                Your CardDAV server URL looks like <b className="text-white">https://contacts.icloud.com/</b>. Find it in your contacts app's account settings.
              </HelpTooltip>
            </span>
            <input
              name="baseUrl"
              required
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://…"
              style={{
                width: "100%",
                height: 44,
                borderRadius: 12,
                border: `1px solid ${T.line}`,
                background: "#fff",
                padding: "0 14px",
                fontSize: 14,
                color: T.ink,
                outline: "none",
                fontFamily: "monospace",
                boxSizing: "border-box",
              }}
            />
            {sel.kind === "generic" ? (
              <div style={{ marginTop: 8, fontSize: 12.5, lineHeight: 1.5, color: T.ink2 }}>
                Unknown CardDAV providers start in safe compatibility mode. Kontax will sync core fields first and keep unsupported fields in Kontax until the connection is verified.
              </div>
            ) : null}
          </label>
          <FormField
            label="Username"
            name="username"
            placeholder="you@example.com"
            required
            hint={
              <HelpTooltip place="bottom">
                Usually the email address you sign in to the service with.
              </HelpTooltip>
            }
          />
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>
              Password
              <HelpTooltip learnHref="/help#carddav" place="bottom">
                Generate an app-specific password in your account's security settings — your normal password won't work for CardDAV.
              </HelpTooltip>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={reveal ? "text" : "password"}
                name="password"
                placeholder="App-specific password"
                required
                style={{
                  width: "100%",
                  height: 44,
                  borderRadius: 12,
                  border: `1px solid ${T.line}`,
                  background: "#fff",
                  padding: "0 58px 0 14px",
                  fontSize: 14,
                  color: T.ink,
                  outline: "none",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setReveal((r) => !r)}
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "transparent",
                  color: T.ink2,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {reveal ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <input type="hidden" name="syncDirection" value="TWO_WAY" />
          {choiceMatch && (
            <>
              <input type="hidden" name="matchedSyncAccountId" value={choiceMatch.syncAccountId} />
              <input type="hidden" name="matchResolution" value={matchResolution} />
            </>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
          <ActionBtn variant="primary" type="submit">
            {choiceMatch
              ? matchResolution === "reconnect"
                ? "Reconnect existing connection"
                : "Create new connection"
              : "Connect"}
          </ActionBtn>
          <button
            type="button"
            onClick={onCancel}
            style={{
              border: "none",
              background: "transparent",
              color: T.ink2,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "60px 24px",
      }}
    >
      <svg
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke={T.line}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M7 18.5a3.7 3.7 0 01-.5-7.36A4.6 4.6 0 0115.6 9.7a3.4 3.4 0 01.9 8.8H7z" />
        <path d="M9 14l3-3 3 3" stroke="#d8ddd6" />
        <path d="M12 11v6" stroke="#d8ddd6" />
      </svg>
      <h2 style={{ margin: "20px 0 0", fontSize: 20, fontWeight: 600, color: T.ink }}>
        Connect your first sync account
      </h2>
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.55, color: T.ink2, maxWidth: 380 }}>
        Kontax connects to your existing contacts services via CardDAV, keeping everything in sync
        automatically.
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", margin: "24px 0 4px" }}>
        {QUICK_PRESETS.filter((q) => q.kind !== "generic").map((q) => (
          <button
            key={q.kind}
            type="button"
            onClick={onAdd}
            style={{
              width: 80,
              height: 64,
              borderRadius: 10,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              border: `1px solid ${T.line}`,
              background: "#fff",
            }}
          >
            <PlatIcon kind={q.kind} size={28} />
            <span style={{ fontSize: 11, fontWeight: 600, color: T.ink2 }}>{q.label}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onAdd}
        style={{
          marginTop: 18,
          height: 44,
          padding: "0 22px",
          borderRadius: 10,
          border: "none",
          background: T.blue,
          color: "#fff",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Connect an account →
      </button>
      {/* P26-13: link to the CardDAV explainer on /help */}
      <div style={{ marginTop: 14 }}>
        <a
          href="/help#carddav"
          style={{ fontSize: 13, fontWeight: 500, color: T.blue, textDecoration: "none" }}
        >
          Learn about CardDAV →
        </a>
      </div>
    </div>
  );
}

// ── P23-06: re-authentication ("sudo") modal ──────────────────────────────────
function ReauthModal({ onConfirmed, onCancel }: { onConfirmed: () => void; onCancel: () => void }) {
  const [pw, setPw] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(id);
  }, []);

  const submit = async () => {
    if (!pw || verifying) return;
    setVerifying(true);
    setError(null);
    const result = await confirmSyncSettingsPassword(pw);
    setVerifying(false);
    if (result.elevated) {
      onConfirmed();
    } else {
      setError(result.error ?? "Incorrect password");
    }
  };

  return (
    <div className="sy-overlay" onClick={onCancel}>
      <div className="sy-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.ink }}>Confirm your password</h3>
        <p style={{ margin: "10px 0 20px", fontSize: 14, lineHeight: 1.55, color: T.ink2 }}>
          Sync connection settings are sensitive. Enter your Kontax password to continue.
        </p>
        <label style={{ display: "block" }}>
          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>Password</span>
          <input
            ref={inputRef}
            type="password"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="Enter your password"
            style={{
              width: "100%",
              height: 44,
              borderRadius: 12,
              border: `1px solid ${error ? T.red : T.line}`,
              background: "#fff",
              padding: "0 14px",
              fontSize: 14,
              color: T.ink,
              outline: "none",
            }}
          />
        </label>
        {error ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#8f3320" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8f3320" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 4l9 16H3z" />
              <path d="M12 10v4" />
              <path d="M12 17h.01" />
            </svg>
            {error}
          </div>
        ) : null}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12, marginTop: 24 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{ border: "none", background: "transparent", color: T.ink2, fontSize: 14, fontWeight: 600, cursor: "pointer", padding: "10px 6px" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!pw || verifying}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 10,
              border: "none",
              background: T.blue,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: !pw || verifying ? "default" : "pointer",
              opacity: !pw || verifying ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {verifying ? <Spinner size={14} color="#fff" /> : null}
            {verifying ? "Verifying…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Disconnect confirmation modal ─────────────────────────────────────────────
function DisconnectModal({
  label,
  isOAuth,
  authParty,
  syncAccountId,
  onCancel,
  onDone,
}: {
  label: string;
  isOAuth: boolean;
  authParty: string;
  syncAccountId: string;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDisconnect = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("syncAccountId", syncAccountId);
      fd.append("redirectTo", "/sync");
      await disconnectSyncAccount(fd);
      onDone();
    });
  };

  const msg = isOAuth
    ? `Contacts synced from ${authParty} will remain in Kontax but will no longer sync automatically. Your ${authParty} authorisation will be revoked.`
    : "Contacts will remain in Kontax but will no longer sync automatically.";

  return (
    <div className="sy-overlay" onClick={isPending ? undefined : onCancel}>
      <div className="sy-modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.ink }}>
          Disconnect {label}?
        </h3>
        <p style={{ margin: "10px 0 24px", fontSize: 14, lineHeight: 1.55, color: T.ink2 }}>
          {msg}
        </p>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            style={{
              border: "none",
              background: "transparent",
              color: T.ink2,
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? "default" : "pointer",
              padding: "10px 6px",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isPending}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 10,
              border: "none",
              background: T.red,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: isPending ? "default" : "pointer",
              opacity: isPending ? 0.6 : 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            {isPending ? <Spinner size={14} color="#fff" /> : null}
            {isPending ? "Disconnecting…" : "Disconnect"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export type SyncPageClientProps = {
  accounts: SyncAccountData[];
  pastAccounts: SyncAccountData[];
  // P36: the user's labels, for the auto-label and export-filter pickers.
  labels: LabelOption[];
  initialAccountId: string | null;
  // open the add-account form on mount (mobile deep-link from MobileSyncScreen)
  initialAdd?: boolean;
  // flash message from URL params
  flash: string | null;
  // P35: entitlement cap for the add-account form
  syncAccountsLimit: number;
  upgradeableAtCap: boolean;
};

export function SyncPageClient({ accounts, pastAccounts, labels, initialAccountId, initialAdd = false, flash: initialFlash, syncAccountsLimit, upgradeableAtCap }: SyncPageClientProps) {
  const allAccounts = [...accounts, ...pastAccounts];
  // P36-DB02: a freshly-connected account awaiting setup wins the initial selection
  // so its first-run setup panel opens immediately.
  const pendingSetup = accounts.find((a) => a.needsSetup) ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAccountId ?? (initialAdd ? null : pendingSetup?.id) ?? accounts[0]?.id ?? pastAccounts[0]?.id ?? null,
  );
  const [view, setView] = useState<"detail" | "add">(initialAdd ? "add" : "detail");
  const [editing, setEditing] = useState(false);
  // On mobile we deep-link straight into a connection or the add form, so the
  // detail pane should be active from the start in those cases.
  // syncingId reserved for future optimistic in-progress indicator
  const syncingId: string | null = null;
  const [toast, setToast] = useState<string | null>(initialFlash);
  // P36: the sync settings panel takes over the detail zone (mutually exclusive
  // with the edit-credentials form). Opened from the [Settings] action button or
  // the gear icon on a list row.
  // Open the panel straight into first-run setup mode when the selected account is
  // a brand-new connection awaiting setup.
  const [settingsOpen, setSettingsOpen] = useState(!initialAdd && !!pendingSetup);
  const [firstRun, setFirstRun] = useState(!initialAdd && !!pendingSetup);
  // P23-06: a pending save that needs re-auth; holds the retry to run once elevated.
  const [reauthRetry, setReauthRetry] = useState<(() => void) | null>(null);
  // Disconnect confirmation modal target.
  const [disconnectTarget, setDisconnectTarget] = useState<{
    label: string;
    isOAuth: boolean;
    authParty: string;
    syncAccountId: string;
  } | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const router = useRouter();

  // NB: this component is remounted whenever the deep-link target changes (the
  // parent keys it on ?account / ?add) — Next's client Router Cache doesn't key
  // by searchParams, so without that key the same /sync tree (and this client's
  // view state) is reused across navigations and goes stale (e.g. tapping Add
  // after viewing a connection re-shows that connection until a hard refresh).
  // The remount lets the useState initializers above resolve the view from the
  // fresh props, so no prop-sync effect is needed here.

  // Auto-dismiss flash toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedAccount = allAccounts.find((a) => a.id === selectedId) ?? accounts[0] ?? pastAccounts[0] ?? null;

  const selectAccount = (id: string) => {
    const target = allAccounts.find((a) => a.id === id);
    setSelectedId(id);
    setView("detail");
    setEditing(false);
    // Selecting a still-pending connection re-opens its first-run setup.
    setFirstRun(!!target?.needsSetup);
    setSettingsOpen(!!target?.needsSetup);
    if (detailRef.current) detailRef.current.scrollTop = 0;
  };

  // Gear icon / [Settings] button — select the account and open the settings panel
  // (normal edit mode, not first-run).
  const openSettings = (id: string) => {
    setSelectedId(id);
    setView("detail");
    setEditing(false);
    setFirstRun(false);
    setSettingsOpen(true);
    if (detailRef.current) detailRef.current.scrollTop = 0;
  };

  const openAdd = () => {
    setView("add");
    setEditing(false);
    setSettingsOpen(false);
    setFirstRun(false);
    if (detailRef.current) detailRef.current.scrollTop = 0;
  };

  // Build the redirect URL that preserves selected account
  const redirectTo = selectedAccount
    ? `/sync?account=${selectedAccount.id}`
    : "/sync";

  const vHealth = selectedAccount
    ? getVisualHealth(selectedAccount, syncingId)
    : "healthy";

  const renderDetail = () => {
    // The add form must win over the empty state — otherwise a user with zero
    // connections (the most common case for adding!) can never reach it.
    if (view === "add")
      return (
        <AddAccountForm
          onCancel={() => setView("detail")}
          accounts={accounts}
          syncAccountsLimit={syncAccountsLimit}
          upgradeableAtCap={upgradeableAtCap}
        />
      );
    if (accounts.length === 0 && pastAccounts.length === 0) return <EmptyState onAdd={openAdd} />;
    if (!selectedAccount) return <EmptyState onAdd={openAdd} />;
    if (editing)
      return (
        <EditCredentialsForm
          account={selectedAccount}
          onCancel={() => setEditing(false)}
        />
      );
    // P36: the settings panel takes over the detail zone, mirroring the
    // edit-credentials pattern and keeping the two mutually exclusive.
    if (settingsOpen)
      return (
        <ConnectionSettings
          key={selectedAccount.id}
          account={selectedAccount}
          labels={labels}
          freqProGated={upgradeableAtCap}
          firstRun={firstRun}
          onClose={() => {
            setSettingsOpen(false);
            setFirstRun(false);
          }}
          onSaved={() => router.refresh()}
          setToast={setToast}
          onNeedElevation={(retry) => setReauthRetry(() => retry)}
        />
      );

    // P35: show connected email in re-auth button/banner only when 2+ accounts
    // of the same provider exist (so the user knows which one needs fixing).
    const sameProviderCount = accounts.filter(
      (a) => a.provider === selectedAccount.provider,
    ).length;
    const reauthEmail = sameProviderCount >= 2 ? selectedAccount.connectedEmail : null;

    return (
      <div>
        {selectedAccount.provider === "CARDDAV"
          ? vHealth === "auth" && <ReauthBanner onFix={() => setEditing(true)} />
          : <OAuthErrorBanner account={selectedAccount} reauthEmail={reauthEmail} />}
        {selectedAccount.conflictQueueFull && <AutoPauseBanner />}
        {selectedAccount.duplicatesDetected > 0 && (
          <DuplicatesBanner count={selectedAccount.duplicatesDetected} />
        )}
        {selectedAccount.capabilityNoteTitle && selectedAccount.capabilityNoteBody && (
          <CapabilityNote
            title={selectedAccount.capabilityNoteTitle}
            body={selectedAccount.capabilityNoteBody}
          />
        )}
        <AccountHeader
          account={selectedAccount}
          vHealth={vHealth}
          isSyncing={syncingId === selectedAccount.id}
          redirectTo={redirectTo}
          onEdit={() => {
            setSettingsOpen(false);
            setEditing(true);
          }}
          onSettings={() => openSettings(selectedAccount.id)}
          reauthEmail={reauthEmail}
          onRequestDisconnect={() => {
            const isOAuth = selectedAccount.provider !== "CARDDAV";
            setDisconnectTarget({
              label: selectedAccount.label,
              isOAuth,
              authParty: selectedAccount.provider === "GOOGLE" ? "Google" : "Microsoft",
              syncAccountId: selectedAccount.id,
            });
          }}
        />
        <SyncDiagnosticsPanel account={selectedAccount} />
        <HistoryTable
          jobs={selectedAccount.jobs}
          isSyncing={syncingId === selectedAccount.id}
          remoteLabel={
            selectedAccount.provider === "GOOGLE"
              ? "Google"
              : selectedAccount.provider === "MICROSOFT"
                ? "Outlook"
                : "CardDAV"
          }
        />
        {/* conflicts */}
        {selectedAccount.conflicts.length > 0 && (
          <section style={{ marginTop: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: T.mute,
                  whiteSpace: "nowrap",
                }}
              >
                Open conflicts
              </span>
              <span
                style={{
                  minWidth: 18,
                  height: 18,
                  padding: "0 5px",
                  borderRadius: 999,
                  background: T.red,
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {selectedAccount.conflicts.length}
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: T.ink2, marginBottom: 6, maxWidth: 560, marginTop: 0 }}>
              Both Kontax and the remote changed these contacts after the last healthy sync. Resolve
              each below.
            </p>
            {selectedAccount.capabilityUnsupportedFieldFamilies.length > 0 ? (
              <p
                style={{
                  fontSize: 12.5,
                  color: T.ink2,
                  marginBottom: 12,
                  maxWidth: 560,
                  marginTop: 0,
                }}
              >
                Provider-limited fields that the remote cannot store stay in Kontax and do not
                open conflicts on their own.
              </p>
            ) : null}
            <div style={{ borderBottom: `1px solid ${T.line2}` }}>
              {selectedAccount.conflicts.map((cf) => (
                <ConflictRow key={cf.id} cf={cf} redirectTo={redirectTo} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  // Mobile owns its list via MobileSyncScreen (the summary), so this full-screen
  // client is only ever shown for a detail/add: the account rail is desktop-only
  // (always hidden on mobile) and the detail pane always shows. On desktop both
  // rails render side by side (the sy-hidden-mobile rule is mobile-only).
  return (
    <>
      {/* keyframe styles */}
      <style>{`
        @keyframes sy-pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        @keyframes sy-spin { to { transform:rotate(360deg) } }
        @keyframes sy-shimmer { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
        @keyframes sy-fade { from { opacity:0 } to { opacity:1 } }
        @keyframes sy-up { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .sy-row-wrap .sy-gear-btn { opacity: 0; }
        .sy-row-wrap:hover .sy-gear-btn,
        .sy-row-wrap[data-sel="1"] .sy-gear-btn { opacity: 1; }
        /* history table — desktop grid (restyled to stacked cards under 768) */
        .sy-trow { display: grid; grid-template-columns: minmax(120px, 1.1fr) 130px 1fr 72px; align-items: center; gap: 12px; padding: 12px 4px; font-size: 13px; }
        .sy-thead { padding: 8px 4px 10px; }
        /* conflict comparison grid — 3 cols on desktop, stacked on mobile */
        .sy-cmp-grid { display: grid; grid-template-columns: 130px 1fr 1fr; }
        /* modal — centered card on desktop, bottom sheet on mobile */
        .sy-overlay { position: fixed; inset: 0; z-index: 90; background: rgba(20,30,25,0.42); display: grid; place-items: center; padding: 16px; }
        .sy-modal { background: #fff; border-radius: 16px; padding: 28px 32px; width: 100%; max-width: 400px; box-shadow: 0 24px 60px rgba(20,30,25,0.25); }
        @media (max-width: 767px) {
          .sy-row-wrap .sy-gear-btn { opacity: 1; }
          .sy-trow { grid-template-columns: 1fr auto; row-gap: 4px; column-gap: 10px; }
          .sy-thead { display: none; }
          .sy-trow > span[data-th]::before { content: attr(data-th) ": "; color: ${T.mute}; font-size: 11px; font-weight: 600; margin-right: 4px; }
          .sy-trow > span[data-th="Date"] { font-weight: 600; }
          .sy-cmp-grid { grid-template-columns: 1fr; }
          .sy-cmp-head { display: none; }
          .sy-cmp-remote { border-left: none !important; border-top: 1px solid ${T.line2}; }
          .sy-overlay { place-items: end stretch; padding: 0; }
          .sy-modal { max-width: none; border-radius: 20px 20px 0 0; animation: sy-up .22s ease-out; }
        }
      `}</style>

      {/* ── Rail 2: account list ── */}
      <aside
        className="sy-account-rail sy-hidden-mobile"
        style={{
          width: 240,
          flexShrink: 0,
          background: "#fff",
          borderRight: `1.5px solid ${T.line}`,
          overflowY: "auto",
          paddingTop: 16,
          paddingBottom: 16,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* section label */}
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: T.mute,
            padding: "0 16px 12px",
          }}
        >
          Sync accounts
        </div>

        {/* P35: group accounts by provider; show group labels when multiple providers */}
        {(() => {
          type Group = { key: string; label: string; items: SyncAccountData[] };
          const GROUP_ORDER: Record<string, number> = { GOOGLE: 0, MICROSOFT: 1, CARDDAV: 2 };
          const GROUP_LABEL: Record<string, string> = { GOOGLE: "Google", MICROSOFT: "Microsoft", CARDDAV: "CardDAV" };
          const grouped: Group[] = [];
          accounts.forEach((a) => {
            let g = grouped.find((x) => x.key === a.provider);
            if (!g) {
              g = { key: a.provider, label: GROUP_LABEL[a.provider] ?? a.provider, items: [] };
              grouped.push(g);
            }
            g.items.push(a);
          });
          grouped.sort((a, b) => (GROUP_ORDER[a.key] ?? 9) - (GROUP_ORDER[b.key] ?? 9));
          const showGroupLabels = grouped.length > 1;
          return (
        <div style={{ display: "grid", gap: 2 }}>
          {grouped.map((g) => (
            <div key={g.key}>
              {showGroupLabels && (
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.mute, padding: "10px 16px 4px" }}>
                  {g.label}
                </div>
              )}
              {g.items.map((a) => {
            const vH = getVisualHealth(a, syncingId);
            const sel = view === "detail" && selectedId === a.id;
            // OAuth accounts always show the connected email so the user can
            // identify which account is which regardless of health state.
            return (
              <div key={a.id} className="sy-row-wrap" data-sel={sel ? "1" : "0"} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => selectAccount(a.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    width: "100%",
                    height: 56,
                    padding: "0 48px 0 12px",
                    border: "none",
                    borderLeft: `3px solid ${sel ? T.green : "transparent"}`,
                    borderRadius: sel ? "0 10px 10px 0" : 10,
                    background: sel ? T.sgreenWash : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "background .13s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!sel) e.currentTarget.style.background = T.wash;
                  }}
                  onMouseLeave={(e) => {
                    if (!sel) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ flexShrink: 0 }}>
                    <PlatIcon kind={getAccountIconKind(a)} size={24} />
                  </span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 600,
                        color: T.ink,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.provider !== "CARDDAV" && a.connectedEmail ? a.connectedEmail : a.label}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontSize: 12,
                        color: HEALTH_LIST_COLOR[vH],
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {getAccountRailSubtitle(a, vH)}
                    </span>
                  </span>
                  <Dot color={HEALTH_DOT[vH]} pulse={vH === "syncing"} />
                </button>
                {/* P23-02: gear — opens this account's settings drawer */}
                <button
                  type="button"
                  aria-label={`${a.label} settings`}
                  title="Connection settings"
                  className="sy-gear-btn"
                  onClick={() => openSettings(a.id)}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    display: "grid",
                    placeItems: "center",
                    width: 36,
                    height: 36,
                    borderRadius: 6,
                    border: "none",
                    background: "transparent",
                    color: T.mute,
                    cursor: "pointer",
                    transition: "opacity .13s ease, background .13s ease, color .13s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = T.wash;
                    e.currentTarget.style.color = T.ink;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = T.mute;
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
                  </svg>
                </button>
              </div>
            );
          })}
            </div>
          ))}
        </div>
          );
        })()}

        {pastAccounts.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: T.mute,
                padding: "0 16px 6px",
              }}
            >
              Past connections
            </div>
            <div style={{ display: "grid", gap: 2 }}>
              {pastAccounts.map((a) => {
                const vH = getVisualHealth(a, syncingId);
                const sel = view === "detail" && selectedId === a.id;
                const retiredDate = formatAccountEventTime(a.retiredAt);
                return (
                  <div key={a.id} className="sy-row-wrap" data-sel={sel ? "1" : "0"} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => selectAccount(a.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        width: "100%",
                        minHeight: 56,
                        padding: "10px 12px",
                        border: "none",
                        borderLeft: `3px solid ${sel ? T.green : "transparent"}`,
                        borderRadius: sel ? "0 10px 10px 0" : 10,
                        background: sel ? T.sgreenWash : "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background .13s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!sel) e.currentTarget.style.background = T.wash;
                      }}
                      onMouseLeave={(e) => {
                        if (!sel) e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <span style={{ flexShrink: 0, opacity: 0.7 }}>
                        <PlatIcon kind={getAccountIconKind(a)} size={24} />
                      </span>
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.ink,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.label}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: HEALTH_LIST_COLOR[vH],
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.replacedBySyncAccountLabel
                            ? `Replaced by ${a.replacedBySyncAccountLabel}${retiredDate ? ` · ${retiredDate}` : ""}`
                            : HEALTH_LIST_TEXT[vH](a)}
                        </span>
                      </span>
                      <Dot color={HEALTH_DOT[vH]} pulse={false} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* add account */}
        <button
          type="button"
          onClick={openAdd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            marginTop: 8,
            padding: "8px 12px",
            border: "none",
            background: view === "add" ? "#edf0fe" : "transparent",
            cursor: "pointer",
            color: T.blue,
            fontSize: 14,
            fontWeight: 500,
            borderRadius: 8,
            whiteSpace: "nowrap",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={T.blue}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add account
        </button>
      </aside>

      {/* ── Rail 3: detail panel (always visible; the only pane on mobile) ── */}
      <main
        ref={detailRef}
        style={{
          flex: 1,
          minWidth: 0,
          overflowY: "auto",
          background: "linear-gradient(180deg, #f0f3ec 0%, #f6f7f4 220px)",
        }}
      >
        {/* mobile back button */}
        <div
          style={{
            display: "none",
            alignItems: "center",
            gap: 10,
            padding: "14px 18px 0",
          }}
          className="sy-mobile-top"
        >
          <button
            type="button"
            onClick={() => {
              // This bar only shows on mobile (sy-mobile-top is mobile-only), so
              // back always returns to the summary (MobileSyncScreen) at /sync.
              router.push("/sync");
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: T.ink2,
              fontSize: 13,
              fontWeight: 500,
              padding: 0,
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
            Sync accounts
          </button>
        </div>

        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "30px 38px 90px",
          }}
          className="sy-detail-inner"
        >
          {renderDetail()}
        </div>
      </main>

      {/* toast */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            background: "#23302a",
            color: "#fff",
            padding: "11px 18px",
            borderRadius: 10,
            boxShadow: "0 10px 34px rgba(0,0,0,.28)",
            fontSize: 13.5,
            maxWidth: "90vw",
            animation: "sy-fade .15s ease",
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}

      {/* P23-06: re-auth modal — confirm, then run the pending save */}
      {reauthRetry && (
        <ReauthModal
          onConfirmed={() => {
            const retry = reauthRetry;
            setReauthRetry(null);
            retry();
          }}
          onCancel={() => setReauthRetry(null)}
        />
      )}

      {/* Disconnect confirmation modal */}
      {disconnectTarget && (
        <DisconnectModal
          label={disconnectTarget.label}
          isOAuth={disconnectTarget.isOAuth}
          authParty={disconnectTarget.authParty}
          syncAccountId={disconnectTarget.syncAccountId}
          onCancel={() => setDisconnectTarget(null)}
          onDone={() => setDisconnectTarget(null)}
        />
      )}

      {/* responsive styles */}
      <style>{`
        @media (max-width: 1120px) and (min-width: 1024px) {
          .sy-account-rail { width: 220px !important; }
          .sy-detail-inner { padding: 28px 28px 90px !important; }
        }
        @media (max-width: 1023px) {
          .sy-account-rail {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1.5px solid #d8ddd6 !important;
            flex-direction: column !important;
            max-height: 260px !important;
            overflow-y: auto !important;
          }
          .sy-detail-inner { padding: 22px 20px 90px !important; }
        }
        @media (max-width: 767px) {
          .sy-hidden-mobile { display: none !important; }
          .sy-mobile-top { display: flex !important; }
          /* Clear the fixed bottom nav (56px + home-indicator safe area) plus a
             comfortable gap so Connect/Cancel etc. don't crowd it. */
          .sy-detail-inner { padding: 18px 18px calc(56px + env(safe-area-inset-bottom) + 32px) !important; }
        }
      `}</style>
    </>
  );
}

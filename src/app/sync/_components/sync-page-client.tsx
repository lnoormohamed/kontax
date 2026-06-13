"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  activateSyncAccount,
  attachSyncCredentials,
  confirmSyncSettingsPassword,
  createSyncAccount,
  disconnectSyncAccount,
  pauseSyncAccount,
  queueSyncJob,
  resolveSyncConflict,
  updateBookAllowlist,
  updateSyncAccountSettings,
} from "~/app/actions/sync";

// P23-06: server sentinel returned by settings actions when a re-auth elevation
// is required. Mirrored here so the client can detect it and open the modal.
const ELEVATION_REQUIRED = "SYNC_SETTINGS_ELEVATION_REQUIRED";

// ── Design tokens ────────────────────────────────────────────────────────────
const T = {
  ink: "#1d2823",
  ink2: "#5c655e",
  mute: "#8b938c",
  line: "#d8ddd6",
  line2: "#e9ece7",
  wash: "#f2f4f0",
  green: "#17352e",
  greenSoft: "#e7efe9",
  blue: "#4158f4",
  blueT: "rgba(65,88,244,0.07)",
  amberT: "rgba(191,133,38,0.12)",
  sgreen: "#1f8a5b",
  sgreenWash: "#e3efe7",
  sgreenText: "#1c6b48",
  amber: "#bf8526",
  red: "#b5472f",
  redWash: "#f3e1da",
} as const;

// ── Data types ───────────────────────────────────────────────────────────────
export type SyncJobRow = {
  id: string;
  when: string;
  direction: "TWO_WAY" | "IMPORT_ONLY" | "EXPORT_ONLY";
  added: number;
  modified: number;
  deleted: number;
  status: "ok" | "fail";
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

export type SyncAccountData = {
  id: string;
  label: string;
  baseUrl: string;
  direction: "TWO_WAY" | "IMPORT_ONLY" | "EXPORT_ONLY";
  conflictPolicy: "SERVER_WINS" | "DEVICE_WINS" | "MANUAL";
  // P23-01 convention: null = platform default (60 min), 0 = manual only.
  syncFrequencyMinutes: number | null;
  bookAllowlist: string[];
  status: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR";
  health: "healthy" | "watch" | "needs_attention" | "paused_for_safety" | "needs_reauth";
  lastSyncedAtRelative: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
  // P23-05: account auto-paused because the manual conflict queue is full.
  conflictQueueFull: boolean;
  jobs: SyncJobRow[];
  conflicts: SyncConflictData[];
};

// ── Health model (maps DB health → design visual state) ──────────────────────
type VisualHealth =
  | "healthy"
  | "warning"
  | "error"
  | "auth"
  | "paused"
  | "safety"
  | "never"
  | "syncing";

const getVisualHealth = (a: SyncAccountData, syncingId: string | null): VisualHealth => {
  if (a.id === syncingId) return "syncing";
  if (a.status === "NEEDS_REAUTH") return "auth";
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
  auth: () => "Re-authentication required — your app password was rejected.",
  paused: () => "Sync is paused. Click Resume to continue syncing.",
  safety: (a) =>
    a.conflictQueueFull
      ? "Auto-paused because the manual conflict queue is full. Resolve the open conflicts, then Resume."
      : "Auto-paused after repeated failures. Fix the issue, then Resume.",
  never: () => "This account has not synced yet. Click Sync now to start.",
  syncing: () => "Sync in progress…",
};

// ── Platform icon (SVG only) ─────────────────────────────────────────────────
const getPlatformKind = (label: string, url: string) => {
  const s = `${label} ${url}`.toLowerCase();
  if (s.includes("icloud")) return "icloud" as const;
  if (s.includes("nextcloud")) return "nextcloud" as const;
  if (s.includes("fastmail")) return "fastmail" as const;
  return "generic" as const;
};

function PlatIcon({ kind, size = 24 }: { kind: ReturnType<typeof getPlatformKind>; size?: number }) {
  const s = size;
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

function Spinner({ size = 14, color = "#fff" }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "sy-spin 0.8s linear infinite", flexShrink: 0 }}
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeOpacity="0.3" strokeWidth="3" />
      <path d="M21 12a9 9 0 00-9-9" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
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
  children: React.ReactNode;
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
    children: React.ReactNode;
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
            · {cf.field} · {cf.date}
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
function HistoryTable({ jobs, isSyncing }: { jobs: SyncJobRow[]; isSyncing: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const [errId, setErrId] = useState<string | null>(null);
  const dirGlyph = { TWO_WAY: "↕", IMPORT_ONLY: "↓", EXPORT_ONLY: "↑" };
  const dirLabel = { TWO_WAY: "Two-way", IMPORT_ONLY: "Import", EXPORT_ONLY: "Export" };
  const visible = showAll ? jobs : jobs.slice(0, 5);

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
              <span data-th="Date" style={{ color: T.ink2 }}>{j.when}</span>
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
                {j.status === "ok"
                  ? `+${j.added} ~${j.modified} −${j.deleted}`
                  : "—"}
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

// ── Account header ─────────────────────────────────────────────────────────
function AccountHeader({
  account,
  vHealth,
  isSyncing,
  redirectTo,
  onEdit,
}: {
  account: SyncAccountData;
  vHealth: VisualHealth;
  isSyncing: boolean;
  redirectTo: string;
  onEdit: () => void;
}) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const isPaused = account.status === "PAUSED";
  const dir = DIR_BADGE[account.direction];

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
          <PlatIcon kind={getPlatformKind(account.label, account.baseUrl)} size={30} />
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
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 3 }}>
            <span
              style={{
                fontSize: 13,
                color: T.mute,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 360,
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
      {vHealth !== "never" && vHealth !== "syncing" && account.lastSyncedAtRelative && (
        <div style={{ fontSize: 13, color: T.ink2, marginTop: 2 }}>
          Last synced:{" "}
          <span style={{ color: T.ink, fontWeight: 500 }}>{account.lastSyncedAtRelative}</span>
        </div>
      )}

      {/* action buttons */}
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

        {/* edit credentials */}
        <ActionBtn onClick={onEdit}>Edit credentials</ActionBtn>

        {/* disconnect */}
        <form
          action={disconnectSyncAccount}
          onSubmit={(e) => {
            if (!window.confirm(`Disconnect ${account.label}? Contacts will remain in Kontax but will no longer sync.`)) {
              e.preventDefault();
            }
          }}
        >
          <input type="hidden" name="syncAccountId" value={account.id} />
          <input type="hidden" name="redirectTo" value="/sync" />
          <ActionBtn danger type="submit">
            Disconnect
          </ActionBtn>
        </form>
      </div>
    </div>
  );
}

// ── Edit credentials form ─────────────────────────────────────────────────────
function EditCredentialsForm({
  account,
  redirectTo,
  onCancel,
}: {
  account: SyncAccountData;
  redirectTo: string;
  onCancel: () => void;
}) {
  const [reveal, setReveal] = useState(false);

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

      <form action={attachSyncCredentials}>
        <input type="hidden" name="syncAccountId" value={account.id} />
        <input type="hidden" name="redirectTo" value={redirectTo} />
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
  required,
  mono,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  mono?: boolean;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: T.ink2, marginBottom: 6 }}>
        {label}
      </span>
      <input
        name={name}
        placeholder={placeholder}
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
  kind: ReturnType<typeof getPlatformKind>;
  label: string;
  url: string;
};

const QUICK_PRESETS: QuickPreset[] = [
  { kind: "icloud", label: "iCloud", url: "https://contacts.icloud.com" },
  { kind: "nextcloud", label: "Nextcloud", url: "https://" },
  { kind: "fastmail", label: "Fastmail", url: "https://carddav.fastmail.com/dav/addressbooks" },
  { kind: "generic", label: "Manual", url: "" },
];

function AddAccountForm({ onCancel }: { onCancel: () => void }) {
  const [sel, setSel] = useState<QuickPreset>(QUICK_PRESETS[0]!);
  const [reveal, setReveal] = useState(false);

  return (
    <div style={{ animation: "sy-fade .15s ease" }}>
      <h2 style={{ margin: "0 0 4px", fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em", color: T.ink }}>
        Add sync account
      </h2>
      <p style={{ margin: "0 0 22px", fontSize: 13.5, color: T.ink2, maxWidth: 480 }}>
        Connect Kontax to a CardDAV service to pull and push contacts.
      </p>

      {/* quick-connect tiles */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink2 }}>Quick-connect</span>
        <span
          style={{
            padding: "2px 7px",
            borderRadius: 6,
            background: "#edf0fe",
            color: T.blue,
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Proposed
        </span>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {QUICK_PRESETS.map((q) => {
          const on = sel.kind === q.kind;
          return (
            <button
              key={q.kind}
              type="button"
              onClick={() => setSel(q)}
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

      <form action={createSyncAccount}>
        <div style={{ display: "grid", gap: 14, maxWidth: 460 }}>
          <FormField label="Label" name="label" placeholder={sel.label} required />
          <FormField label="Server URL" name="baseUrl" placeholder={sel.url || "https://…"} required mono />
          <FormField label="Username" name="username" placeholder="you@example.com" required />
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
          <input type="hidden" name="syncDirection" value="TWO_WAY" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 22 }}>
          <ActionBtn variant="primary" type="submit">
            Connect
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
    </div>
  );
}

// ── P23-02: connection settings vocabulary ───────────────────────────────────
type SyncDirection = SyncAccountData["direction"];
type ConflictPolicy = SyncAccountData["conflictPolicy"];

const DIRECTION_OPTIONS: { value: SyncDirection; name: string; desc: string }[] = [
  { value: "TWO_WAY", name: "Two-way", desc: "Contacts sync in both directions" },
  { value: "IMPORT_ONLY", name: "Import only", desc: "Kontax pulls from remote, never pushes" },
  { value: "EXPORT_ONLY", name: "Export only", desc: "Kontax pushes to remote, ignores changes" },
];
const POLICY_OPTIONS: { value: ConflictPolicy; name: string; desc: string }[] = [
  { value: "SERVER_WINS", name: "Server wins", desc: "Remote changes take precedence (recommended)" },
  { value: "DEVICE_WINS", name: "Kontax wins", desc: "Local changes take precedence" },
  { value: "MANUAL", name: "Review manually", desc: "Create a review queue for each conflict" },
];
// Frequency dropdown values are strings; "manual" maps to syncFrequencyMinutes 0
// (P23-01 sentinel), the rest to their minute count. null seeds as "60" since the
// platform default is 60 min and the dropdown has no separate "default" entry.
const FREQ_OPTIONS: { value: string; label: string; short: string }[] = [
  { value: "15", label: "Every 15 minutes", short: "15 min" },
  { value: "30", label: "Every 30 minutes", short: "30 min" },
  { value: "60", label: "Every 60 minutes", short: "60 min" },
  { value: "360", label: "Every 6 hours", short: "6 hr" },
  { value: "manual", label: "Manual only", short: "Manual" },
];
const DIRECTION_SHORT: Record<SyncDirection, string> = {
  TWO_WAY: "Two-way",
  IMPORT_ONLY: "Import only",
  EXPORT_ONLY: "Export only",
};
const POLICY_SHORT: Record<ConflictPolicy, string> = {
  SERVER_WINS: "Server wins",
  DEVICE_WINS: "Kontax wins",
  MANUAL: "Review manually",
};
const freqToSelect = (minutes: number | null): string =>
  minutes === 0 ? "manual" : minutes == null ? "60" : String(minutes);
const selectToFreq = (value: string): number | null => (value === "manual" ? 0 : Number(value));
const freqShort = (value: string): string =>
  FREQ_OPTIONS.find((o) => o.value === value)?.short ?? "60 min";

function Radio({ on }: { on: boolean }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        flexShrink: 0,
        border: `1.6px solid ${on ? T.blue : T.mute}`,
        background: "#fff",
        display: "grid",
        placeItems: "center",
        transition: "border-color .12s ease",
      }}
    >
      {on ? <span style={{ width: 9, height: 9, borderRadius: "50%", background: T.blue }} /> : null}
    </span>
  );
}

function RadioGroup<V extends string>({
  label,
  value,
  options,
  onChange,
  children,
}: {
  label: string;
  value: V;
  options: { value: V; name: string; desc: string }[];
  onChange: (v: V) => void;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 8 }}>{label}</div>
      <div role="radiogroup" aria-label={label}>
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                width: "100%",
                minHeight: 44,
                padding: "4px 6px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textAlign: "left",
                borderRadius: 8,
                transition: "background .12s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f7f8f5")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Radio on={on} />
              <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: on ? 600 : 500, color: T.ink }}>{o.name}</span>
                <span style={{ fontSize: 12, color: T.mute }}>· {o.desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      {children}
    </div>
  );
}

function SettingsDivider() {
  return <div style={{ height: 1, background: T.line2, margin: "18px 0" }} />;
}

function DirectionNote({ text }: { text: string }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        marginTop: 4,
        marginLeft: 29,
        background: "#fffbeb",
        borderLeft: "3px solid #d97706",
        borderRadius: "0 8px 8px 0",
        padding: "8px 12px",
        animation: "sy-fade .18s ease",
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#d97706"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0, marginTop: 1 }}
      >
        <path d="M12 4l9 16H3z" />
        <path d="M12 10v4" />
        <path d="M12 17h.01" />
      </svg>
      <span style={{ fontSize: 12, lineHeight: 1.45, color: "#92400e" }}>{text}</span>
    </div>
  );
}

function ExportWarning() {
  return (
    <DirectionNote text="Changes from the remote will be ignored. Make sure Kontax is your authoritative source." />
  );
}

// ── P23-03: book allowlist sub-section ────────────────────────────────────────
type DiscoveredBook = {
  url: string;
  displayName: string | null;
  ctag: string | null;
  readOnly: boolean;
};
type BookRow = DiscoveredBook & { missing?: boolean };

function BookCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 5,
        flexShrink: 0,
        display: "grid",
        placeItems: "center",
        border: `1.6px solid ${checked ? T.blue : T.mute}`,
        background: checked ? T.blue : "#fff",
      }}
    >
      {checked ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.2l2.3 2.3L9.5 3.5" />
        </svg>
      ) : null}
    </span>
  );
}

function BookAllowlist({
  account,
  onSaved,
  setToast,
  onNeedElevation,
}: {
  account: SyncAccountData;
  onSaved: () => void;
  setToast: (msg: string) => void;
  onNeedElevation: (retry: () => void) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<BookRow[]>([]);
  const [syncAll, setSyncAll] = useState(account.bookAllowlist.length === 0);
  const [selected, setSelected] = useState<Set<string>>(new Set(account.bookAllowlist));
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const applyBooks = (discovered: DiscoveredBook[]) => {
    // Include any allowlisted URL the remote no longer reports as a "missing" row.
    const discoveredUrls = new Set(discovered.map((b) => b.url));
    const missing: BookRow[] = account.bookAllowlist
      .filter((u) => !discoveredUrls.has(u))
      .map((u) => ({ url: u, displayName: u, ctag: null, readOnly: false, missing: true }));
    const rows: BookRow[] = [...discovered, ...missing];
    setBooks(rows);
    // When the allowlist is empty (sync all), pre-check every discovered book.
    if (account.bookAllowlist.length === 0) {
      setSelected(new Set(discovered.map((b) => b.url)));
    }
  };

  const load = async (refresh: boolean) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sync/${account.id}/books${refresh ? "?refresh=1" : ""}`);
      const data = (await res.json()) as { books?: DiscoveredBook[]; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not load address books.");
      } else {
        applyBooks(data.books ?? []);
        if (refresh) setToast("Address book list refreshed");
      }
    } catch {
      setError("Could not load address books.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.id]);

  const toggleBook = (url: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  // Archive note: a book that is currently synced (in the saved allowlist, or all
  // when the allowlist is empty) is about to be excluded by the pending selection.
  const willExclude =
    !syncAll &&
    books.some((b) => {
      const currentlySynced = account.bookAllowlist.length === 0 || account.bookAllowlist.includes(b.url);
      return currentlySynced && !selected.has(b.url) && !b.missing;
    });

  const onSave = async () => {
    setSaving(true);
    const allowlist = syncAll ? [] : books.filter((b) => selected.has(b.url) && !b.missing).map((b) => b.url);
    const result = await updateBookAllowlist({ syncAccountId: account.id, allowlist });
    setSaving(false);
    if (result.ok) {
      setToast("Address books updated");
      onSaved();
    } else if (result.error === ELEVATION_REQUIRED) {
      onNeedElevation(() => void onSave());
    } else {
      setToast(result.error ?? "Could not update address books.");
    }
  };

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${T.line2}`, paddingTop: 16, animation: "sy-fade .18s ease" }}>
      {/* sync-all toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
        <button
          type="button"
          role="switch"
          aria-checked={syncAll}
          onClick={() => setSyncAll((v) => !v)}
          style={{
            width: 38,
            height: 22,
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            flexShrink: 0,
            padding: 0,
            background: syncAll ? T.sgreen : T.line,
            transition: "background .16s ease",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: syncAll ? 18 : 2,
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 1px 3px rgba(0,0,0,.2)",
              transition: "left .16s ease",
            }}
          />
        </button>
        <span style={{ fontSize: 14, fontWeight: 500, color: T.ink }}>Sync all address books</span>
      </div>

      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: T.mute,
          marginBottom: 4,
          opacity: syncAll ? 0.45 : 1,
        }}
      >
        Custom selection
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 6px", color: T.mute, fontSize: 13 }}>
          <Spinner size={13} color={T.mute} /> Discovering address books…
        </div>
      ) : error ? (
        <div style={{ padding: "10px 6px", color: T.red, fontSize: 13 }}>{error}</div>
      ) : books.length === 0 ? (
        <div style={{ padding: "10px 6px", color: T.mute, fontSize: 13 }}>No address books discovered on the remote.</div>
      ) : (
        <div style={{ opacity: syncAll ? 0.45 : 1, pointerEvents: syncAll ? "none" : "auto" }}>
          {books.map((b) => {
            const checked = syncAll || selected.has(b.url);
            return (
              <button
                key={b.url}
                type="button"
                onClick={() => toggleBook(b.url)}
                disabled={syncAll || b.readOnly}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  width: "100%",
                  minHeight: 40,
                  padding: "0 6px",
                  border: "none",
                  background: "transparent",
                  cursor: syncAll || b.readOnly ? "default" : "pointer",
                  textAlign: "left",
                  borderRadius: 8,
                }}
              >
                <BookCheckbox checked={checked} />
                <span style={{ fontSize: 14, color: T.ink, fontWeight: 500 }}>{b.displayName ?? b.url}</span>
                {b.missing ? (
                  <span style={{ fontSize: 12, color: T.amber }}>(not found on remote)</span>
                ) : b.readOnly ? (
                  <span style={{ fontSize: 12, color: T.mute }}>(read-only on remote)</span>
                ) : null}
                <span style={{ flex: 1 }} />
                {b.readOnly ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.mute} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="5" y="11" width="14" height="9" rx="2" />
                    <path d="M8 11V8a4 4 0 018 0v3" />
                  </svg>
                ) : null}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12 }}>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={refreshing}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            border: "none",
            background: "transparent",
            color: T.blue,
            fontSize: 13,
            fontWeight: 600,
            cursor: refreshing ? "default" : "pointer",
            padding: 0,
          }}
        >
          {refreshing ? (
            <>
              <Spinner size={13} color={T.blue} /> Refreshing…
            </>
          ) : (
            "Refresh list"
          )}
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={saving || loading}
          style={{
            height: 32,
            padding: "0 14px",
            borderRadius: 8,
            border: "none",
            background: T.blue,
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            cursor: saving || loading ? "default" : "pointer",
            opacity: saving || loading ? 0.7 : 1,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {saving ? <Spinner size={13} color="#fff" /> : null}
          {saving ? "Saving…" : "Save books"}
        </button>
      </div>

      {willExclude ? (
        <div style={{ fontSize: 12, color: T.mute, fontStyle: "italic", marginTop: 12, maxWidth: 460 }}>
          Note: unchecked books will no longer sync into Kontax.
        </div>
      ) : null}
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

// ── P23-02: connection settings drawer (within the detail panel) ──────────────
function ConnectionSettings({
  account,
  open,
  onToggle,
  onSaved,
  setToast,
  onNeedElevation,
}: {
  account: SyncAccountData;
  open: boolean;
  onToggle: () => void;
  onSaved: () => void;
  setToast: (msg: string) => void;
  onNeedElevation: (retry: () => void) => void;
}) {
  type Draft = { direction: SyncDirection; policy: ConflictPolicy; freq: string };
  const baseline: Draft = {
    direction: account.direction,
    policy: account.conflictPolicy,
    freq: freqToSelect(account.syncFrequencyMinutes),
  };
  const [draft, setDraft] = useState<Draft>(baseline);
  const [booksOpen, setBooksOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Re-seed when the selected account changes (or after a refresh re-supplies props).
  useEffect(() => {
    setDraft({
      direction: account.direction,
      policy: account.conflictPolicy,
      freq: freqToSelect(account.syncFrequencyMinutes),
    });
    setBooksOpen(false);
    setSaved(false);
  }, [account.id, account.direction, account.conflictPolicy, account.syncFrequencyMinutes]);

  const dirty =
    draft.direction !== baseline.direction ||
    draft.policy !== baseline.policy ||
    draft.freq !== baseline.freq;

  const patch = (next: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setSaved(false);
  };

  const onSave = async () => {
    setSaving(true);
    // Optimistic: keep the dirty draft on screen; revert on failure.
    const result = await updateSyncAccountSettings({
      syncAccountId: account.id,
      ...(draft.direction !== baseline.direction ? { syncDirection: draft.direction } : {}),
      ...(draft.policy !== baseline.policy ? { conflictPolicy: draft.policy } : {}),
      ...(draft.freq !== baseline.freq ? { syncFrequencyMinutes: selectToFreq(draft.freq) } : {}),
    });
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      setToast("Settings saved");
      onSaved();
    } else if (result.error === ELEVATION_REQUIRED) {
      // Keep the pending edits and re-run this save once the user re-authenticates.
      onNeedElevation(() => void onSave());
    } else {
      setDraft(baseline);
      setToast(result.error ?? "Could not save settings.");
    }
  };

  const onCancel = () => {
    setDraft(baseline);
    setBooksOpen(false);
  };

  const summary = `${DIRECTION_SHORT[draft.direction]} · ${POLICY_SHORT[draft.policy]} · ${freqShort(draft.freq)}`;
  const booksSummary =
    account.bookAllowlist.length === 0
      ? "All books synced"
      : `${account.bookAllowlist.length} book${account.bookAllowlist.length === 1 ? "" : "s"} · custom`;

  return (
    <section id="sy-settings-zone" style={{ marginTop: 30, scrollMarginTop: 16 }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        style={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          padding: "6px 2px",
          border: "none",
          background: "transparent",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: T.mute,
          }}
        >
          Connection settings
        </span>
        {!open ? (
          <span
            style={{
              fontSize: 12.5,
              color: T.ink2,
              marginLeft: 12,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {summary}
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={T.ink2}
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div
          style={{
            border: `1px solid ${T.line2}`,
            borderRadius: 14,
            padding: "22px 22px 20px",
            marginTop: 10,
            background: "#fff",
            animation: "sy-fade .18s ease",
          }}
        >
          <RadioGroup
            label="Sync direction"
            value={draft.direction}
            options={DIRECTION_OPTIONS}
            onChange={(v) => patch({ direction: v })}
          >
            {draft.direction === "EXPORT_ONLY" ? <ExportWarning /> : null}
            {/* P23-04: switching away from export-only resumes pulling; remote
                deletes made while export-only may replay and remove contacts. */}
            {account.direction === "EXPORT_ONLY" && draft.direction !== "EXPORT_ONLY" ? (
              <DirectionNote text="Resuming pull sync. Contacts deleted on the remote while export-only was active may be removed from Kontax on the next sync." />
            ) : null}
          </RadioGroup>

          <SettingsDivider />

          <RadioGroup
            label="Conflict resolution"
            value={draft.policy}
            options={POLICY_OPTIONS}
            onChange={(v) => patch({ policy: v })}
          />

          <SettingsDivider />

          <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 10 }}>Sync frequency</div>
          <div style={{ position: "relative", maxWidth: 280 }}>
            <select
              value={draft.freq}
              onChange={(e) => patch({ freq: e.target.value })}
              style={{
                width: "100%",
                height: 36,
                borderRadius: 8,
                border: `1px solid ${T.line}`,
                background: "#fff",
                padding: "0 38px 0 12px",
                fontSize: 14,
                color: T.ink,
                cursor: "pointer",
                appearance: "none",
                WebkitAppearance: "none",
                outline: "none",
              }}
            >
              {FREQ_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke={T.ink2}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>

          <SettingsDivider />

          {/* Address books — summary + disclosure into the P23-03 allowlist UI. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.ink }}>Address books</div>
              <div style={{ fontSize: 13, color: T.ink2, marginTop: 2 }}>{booksSummary}</div>
            </div>
            <button
              type="button"
              onClick={() => setBooksOpen((o) => !o)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                height: 32,
                padding: "0 12px",
                borderRadius: 8,
                border: `1px solid ${T.line}`,
                background: booksOpen ? T.wash : "#fff",
                color: T.ink,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={T.ink2}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: booksOpen ? "rotate(180deg)" : "none", transition: "transform .18s ease" }}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
              {booksOpen ? "Done" : "Change"}
            </button>
          </div>
          {booksOpen ? (
            <BookAllowlist account={account} onSaved={onSaved} setToast={setToast} onNeedElevation={onNeedElevation} />
          ) : null}

          {dirty || saved ? <SettingsDivider /> : null}
          {dirty ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                style={{
                  height: 36,
                  padding: "0 16px",
                  borderRadius: 8,
                  border: "none",
                  background: T.blue,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {saving ? <Spinner size={14} color="#fff" /> : null}
                {saving ? "Saving…" : "Save settings"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={saving}
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
          ) : saved ? (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                color: T.sgreen,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.sgreen} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4 4 10-10" />
              </svg>
              Settings saved
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export type SyncPageClientProps = {
  accounts: SyncAccountData[];
  initialAccountId: string | null;
  // open the add-account form on mount (mobile deep-link from MobileSyncScreen)
  initialAdd?: boolean;
  // flash message from URL params
  flash: string | null;
};

export function SyncPageClient({ accounts, initialAccountId, initialAdd = false, flash: initialFlash }: SyncPageClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(
    initialAccountId ?? accounts[0]?.id ?? null,
  );
  const [view, setView] = useState<"detail" | "add">(initialAdd ? "add" : "detail");
  const [editing, setEditing] = useState(false);
  // On mobile we deep-link straight into a connection or the add form, so the
  // detail pane should be active from the start in those cases.
  // syncingId reserved for future optimistic in-progress indicator
  const syncingId: string | null = null;
  const [toast, setToast] = useState<string | null>(initialFlash);
  // P23-02: connection settings drawer open/closed + a pending "scroll to it" flag
  // set when the user opens it via the gear icon on a list row.
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrollToSettings, setScrollToSettings] = useState(false);
  // P23-06: a pending save that needs re-auth; holds the retry to run once elevated.
  const [reauthRetry, setReauthRetry] = useState<(() => void) | null>(null);
  const detailRef = useRef<HTMLElement>(null);
  const router = useRouter();

  // Keep selection in sync with the deep-link param. On mobile the summary
  // (MobileSyncScreen) navigates here by changing ?account; this component
  // persists in the tree, so without this its selectedId could stay stale.
  useEffect(() => {
    if (initialAccountId) setSelectedId(initialAccountId);
  }, [initialAccountId]);

  // After a gear click selects + expands settings, scroll the zone into view.
  useEffect(() => {
    if (!scrollToSettings) return;
    const id = requestAnimationFrame(() => {
      document.getElementById("sy-settings-zone")?.scrollIntoView({ behavior: "smooth", block: "start" });
      setScrollToSettings(false);
    });
    return () => cancelAnimationFrame(id);
  }, [scrollToSettings]);

  // Auto-dismiss flash toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null;

  const selectAccount = (id: string) => {
    setSelectedId(id);
    setView("detail");
    setEditing(false);
    setSettingsOpen(false);
    if (detailRef.current) detailRef.current.scrollTop = 0;
  };

  // P23-02: gear icon — select the account, open its settings drawer, scroll to it.
  const openSettings = (id: string) => {
    setSelectedId(id);
    setView("detail");
    setEditing(false);
    setSettingsOpen(true);
    setScrollToSettings(true);
  };

  const openAdd = () => {
    setView("add");
    setEditing(false);
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
    if (view === "add") return <AddAccountForm onCancel={() => setView("detail")} />;
    if (accounts.length === 0) return <EmptyState onAdd={openAdd} />;
    if (!selectedAccount) return <EmptyState onAdd={openAdd} />;
    if (editing)
      return (
        <EditCredentialsForm
          account={selectedAccount}
          redirectTo={redirectTo}
          onCancel={() => setEditing(false)}
        />
      );
    return (
      <div>
        {vHealth === "auth" && <ReauthBanner onFix={() => setEditing(true)} />}
        {selectedAccount.conflictQueueFull && <AutoPauseBanner />}
        <AccountHeader
          account={selectedAccount}
          vHealth={vHealth}
          isSyncing={syncingId === selectedAccount.id}
          redirectTo={redirectTo}
          onEdit={() => setEditing(true)}
        />
        <ConnectionSettings
          key={selectedAccount.id}
          account={selectedAccount}
          open={settingsOpen}
          onToggle={() => setSettingsOpen((o) => !o)}
          onSaved={() => router.refresh()}
          setToast={setToast}
          onNeedElevation={(retry) => setReauthRetry(() => retry)}
        />
        <HistoryTable
          jobs={selectedAccount.jobs}
          isSyncing={syncingId === selectedAccount.id}
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

        {/* account items */}
        <div style={{ display: "grid", gap: 2 }}>
          {accounts.map((a) => {
            const vH = getVisualHealth(a, syncingId);
            const sel = view === "detail" && selectedId === a.id;
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
                    <PlatIcon kind={getPlatformKind(a.label, a.baseUrl)} size={24} />
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
                      {HEALTH_LIST_TEXT[vH](a)}
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

      {/* responsive styles */}
      <style>{`
        @media (max-width: 1120px) {
          .sy-account-rail { width: 220px !important; }
          .sy-detail-inner { padding: 28px 28px 90px !important; }
        }
        @media (max-width: 959px) {
          .sy-account-rail {
            width: 100% !important;
            border-right: none !important;
            border-bottom: 1.5px solid #d8ddd6 !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
            align-items: center !important;
          }
        }
        @media (max-width: 767px) {
          .sy-hidden-mobile { display: none !important; }
          .sy-mobile-top { display: flex !important; }
          .sy-detail-inner { padding: 18px 18px 70px !important; }
        }
      `}</style>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  activateSyncAccount,
  attachSyncCredentials,
  createSyncAccount,
  disconnectSyncAccount,
  pauseSyncAccount,
  queueSyncJob,
  resolveSyncConflict,
} from "~/app/actions/sync";

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
  status: "ACTIVE" | "PAUSED" | "NEEDS_REAUTH" | "ERROR";
  health: "healthy" | "watch" | "needs_attention" | "paused_for_safety" | "needs_reauth";
  lastSyncedAtRelative: string | null;
  lastErrorMessage: string | null;
  consecutiveFailures: number;
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
  safety: () => "Auto-paused after repeated failures. Fix the issue, then Resume.",
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
        (e.currentTarget as HTMLButtonElement).style.background =
          variant === "primary" ? "#3347d8" : danger ? T.redWash : T.wash;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background =
          variant === "primary" ? T.blue : "#fff";
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
  accountId,
  redirectTo,
}: {
  cf: SyncConflictData;
  accountId: string;
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
                  style={{
                    display: "grid",
                    gridTemplateColumns: "130px 1fr 1fr",
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
                    style={{
                      display: "grid",
                      gridTemplateColumns: "130px 1fr 1fr",
                      borderTop: i ? `1px solid ${T.line2}` : "none",
                    }}
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(120px, 1.1fr) 120px 1fr 60px",
              gap: 12,
              padding: "8px 4px 10px",
              color: T.mute,
            }}
          >
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
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 1.1fr) 120px 1fr 60px",
                gap: 12,
                padding: "12px 4px",
                fontSize: 13,
                borderTop: `1px solid ${T.line2}`,
                animation: "sy-fade .15s ease",
              }}
            >
              <span style={{ color: T.ink2 }}>In progress</span>
              <span style={{ color: T.mute }}>↕ Two-way</span>
              <span style={{ color: T.mute }}>—</span>
              <span
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
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 1.1fr) 120px 1fr 60px",
                gap: 12,
                padding: "12px 4px",
                fontSize: 13,
                borderTop: `1px solid ${T.line2}`,
                position: "relative",
              }}
            >
              <span style={{ color: T.ink2 }}>{j.when}</span>
              <span style={{ color: T.mute }}>
                {dirGlyph[j.direction]} {dirLabel[j.direction]}
              </span>
              <span
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
              <span style={{ display: "flex", justifyContent: "flex-end" }}>
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
  const router = useRouter();
  const [, startTransition] = useTransition();
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

// ── Detail skeleton ───────────────────────────────────────────────────────────
function DetailSkeleton() {
  const bar = (w: string | number, h: number, mt = 0, r = 4) => (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: r,
        marginTop: mt,
        background: "linear-gradient(90deg,#eceee9 0%,#f5f6f3 50%,#eceee9 100%)",
        backgroundSize: "200% 100%",
        animation: "sy-shimmer 1.3s ease-in-out infinite",
      }}
    />
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        {bar(30, 30, 0, 999)}
        {bar(160, 20, 0, 6)}
      </div>
      {bar(220, 13, 16)}
      <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
        {[88, 70, 130, 100].map((w, i) => (
          <div
            key={i}
            style={{
              width: w,
              height: 34,
              borderRadius: 8,
              background: "linear-gradient(90deg,#eceee9 0%,#f5f6f3 50%,#eceee9 100%)",
              backgroundSize: "200% 100%",
              animation: "sy-shimmer 1.3s ease-in-out infinite",
            }}
          />
        ))}
      </div>
      {bar(120, 11, 34)}
      {[0, 1, 2, 3].map((i) => bar("100%", 18, 16))}
    </div>
  );
}

// ── Main client component ─────────────────────────────────────────────────────
export type SyncPageClientProps = {
  accounts: SyncAccountData[];
  initialAccountId: string | null;
  // flash message from URL params
  flash: string | null;
};

export function SyncPageClient({ accounts, initialAccountId, flash: initialFlash }: SyncPageClientProps) {
  const router = useRouter();

  const [selectedId, setSelectedId] = useState<string | null>(
    initialAccountId ?? accounts[0]?.id ?? null,
  );
  const [view, setView] = useState<"detail" | "add">("detail");
  const [editing, setEditing] = useState(false);
  const [mobilePane, setMobilePane] = useState<"list" | "detail">("list");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(initialFlash);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  const showToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  };

  const selectedAccount = accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null;

  const selectAccount = (id: string) => {
    setSelectedId(id);
    setView("detail");
    setEditing(false);
    setMobilePane("detail");
    if (detailRef.current) detailRef.current.scrollTop = 0;
  };

  const openAdd = () => {
    setView("add");
    setEditing(false);
    setMobilePane("detail");
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
    if (accounts.length === 0) return <EmptyState onAdd={openAdd} />;
    if (view === "add") return <AddAccountForm onCancel={() => setView("detail")} />;
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
        <AccountHeader
          account={selectedAccount}
          vHealth={vHealth}
          isSyncing={syncingId === selectedAccount.id}
          redirectTo={redirectTo}
          onEdit={() => setEditing(true)}
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
                <ConflictRow key={cf.id} cf={cf} accountId={selectedAccount.id} redirectTo={redirectTo} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  const showLeft = mobilePane === "list";
  const showRight = mobilePane === "detail";

  return (
    <>
      {/* keyframe styles */}
      <style>{`
        @keyframes sy-pulse { 0%,100% { opacity:1 } 50% { opacity:.4 } }
        @keyframes sy-spin { to { transform:rotate(360deg) } }
        @keyframes sy-shimmer { 0% { background-position:200% 0 } 100% { background-position:-200% 0 } }
        @keyframes sy-fade { from { opacity:0 } to { opacity:1 } }
      `}</style>

      {/* ── Rail 2: account list ── */}
      <aside
        className={`sy-account-rail ${showLeft ? "" : "sy-hidden-mobile"}`}
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
              <button
                key={a.id}
                type="button"
                onClick={() => selectAccount(a.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  width: "100%",
                  height: 56,
                  padding: "0 12px",
                  border: "none",
                  borderLeft: `3px solid ${sel ? T.green : "transparent"}`,
                  borderRadius: sel ? "0 10px 10px 0" : 10,
                  background: sel ? T.sgreenWash : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background .13s ease",
                }}
                onMouseEnter={(e) => {
                  if (!sel) (e.currentTarget as HTMLButtonElement).style.background = T.wash;
                }}
                onMouseLeave={(e) => {
                  if (!sel) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
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

      {/* ── Rail 3: detail panel ── */}
      <main
        ref={detailRef}
        className={`${showRight ? "" : "sy-hidden-mobile"}`}
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
            onClick={() => setMobilePane("list")}
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

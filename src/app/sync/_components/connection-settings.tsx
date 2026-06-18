"use client";

import { type ReactNode, useEffect, useState } from "react";

import { completeSyncSetup, updateBookAllowlist, updateSyncAccountSettings } from "~/app/actions/sync";

import { ELEVATION_REQUIRED, Spinner, T } from "./sync-shared";
import type { LabelOption, SyncAccountData } from "./sync-page-client";

// ── design palette extras (not in the shared token set) ──────────────────────
const FAINT = "#aeb4ac";
const CARD_SEL_BG = "#edf0fe";
const WARN_BG = "#f6edd9";
const WARN_FG = "#7a5a1a";

// ── settings vocabulary (P36-DB01 design copy) ───────────────────────────────
type SyncDirection = SyncAccountData["direction"];
type ConflictPolicy = SyncAccountData["conflictPolicy"];

const DIR_OPTS: { v: SyncDirection; name: string; desc: string }[] = [
  { v: "TWO_WAY", name: "Two-way", desc: "Push and pull changes" },
  { v: "IMPORT_ONLY", name: "Import only", desc: "Pull from remote into Kontax — remote is read-only" },
  { v: "EXPORT_ONLY", name: "Export only", desc: "Push Kontax contacts to remote — Kontax is the source" },
];
const POLICY_OPTS: { v: ConflictPolicy; name: string; desc: string }[] = [
  { v: "SERVER_WINS", name: "Remote wins", desc: "Remote change always applies" },
  { v: "DEVICE_WINS", name: "Kontax wins", desc: "Local change always applies" },
  { v: "MANUAL", name: "Ask me", desc: "Queue conflicts for manual review — nothing overwritten" },
];
// freq value "plan" = plan default · "manual" = manual only · others = minutes.
// pro: gated above the plan limit (plan default = every 60 min on the free tier).
const FREQ_OPTS: { v: string; label: string; pro?: boolean }[] = [
  { v: "plan", label: "Plan default" },
  { v: "15", label: "Every 15 minutes", pro: true },
  { v: "30", label: "Every 30 minutes" },
  { v: "60", label: "Every hour" },
  { v: "360", label: "Every 6 hours" },
  { v: "1440", label: "Every 24 hours" },
  { v: "manual", label: "Manual only" },
];
const PLAN_FREQ_LABEL = "every 60 minutes"; // platform default (DEFAULT_SYNC_FREQUENCY_MINUTES)
const RETRY_OPTS: { value: string; label: string }[] = [
  { value: "default", label: "Platform default (5 failures)" },
  { value: "1", label: "1 failure" },
  { value: "3", label: "3 failures" },
  { value: "5", label: "5 failures" },
  { value: "10", label: "10 failures" },
  { value: "0", label: "Never auto-pause" },
];
const FIELD_OPTS: { token: string; label: string }[] = [
  { token: "NOTE", label: "Notes" },
  { token: "BDAY", label: "Birthdays" },
  { token: "ADR", label: "Addresses" },
  { token: "X-CUSTOM", label: "Custom fields" },
];

// freq <-> syncFrequencyMinutes (null = plan default, 0 = manual, else minutes)
const freqToSelect = (minutes: number | null): string =>
  minutes == null ? "plan" : minutes === 0 ? "manual" : String(minutes);
const selectToFreq = (value: string): number | null =>
  value === "plan" ? null : value === "manual" ? 0 : Number(value);

const retryToSelect = (n: number | null): string => (n == null ? "default" : String(n));
const selectToRetry = (s: string): number | null => (s === "default" ? null : Number(s));

// ── shared form primitives (match sync-options.jsx) ──────────────────────────
function OptLabel({ children, gated }: { children: ReactNode; gated?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.mute }}>
        {children}
      </span>
      {gated ? <span style={{ fontSize: 10.5, fontWeight: 600, color: T.mute }}>{gated}</span> : null}
    </div>
  );
}

function OptSection({ label, gated, children, style }: { label: string; gated?: string; children: ReactNode; style?: React.CSSProperties }) {
  return (
    <section style={{ marginBottom: 24, ...style }}>
      <OptLabel gated={gated}>{label}</OptLabel>
      {children}
    </section>
  );
}

function ORadio({ on, dim }: { on: boolean; dim?: boolean }) {
  return (
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        flex: "0 0 auto",
        marginTop: 1,
        border: `1.7px solid ${dim ? FAINT : on ? T.blue : "#c2c8c0"}`,
        background: "#fff",
        display: "grid",
        placeItems: "center",
        transition: "border-color .12s ease",
      }}
    >
      {on ? <span style={{ width: 8.5, height: 8.5, borderRadius: "50%", background: T.blue }} /> : null}
    </span>
  );
}

// segmented radio group — bordered card rows
function OptCards<V extends string>({
  value,
  options,
  onChange,
  disabledMap,
}: {
  value: V;
  options: { v: V; name: string; desc: string }[];
  onChange: (v: V) => void;
  disabledMap?: Partial<Record<V, string>>;
}) {
  return (
    <div role="radiogroup" style={{ display: "grid", gap: 8 }}>
      {options.map((o) => {
        const on = value === o.v;
        const disabledReason = disabledMap?.[o.v];
        const disabled = !!disabledReason;
        return (
          <button
            key={o.v}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            title={disabledReason ?? undefined}
            onClick={() => !disabled && onChange(o.v)}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              width: "100%",
              minHeight: 52,
              padding: "11px 14px",
              textAlign: "left",
              borderRadius: 10,
              cursor: disabled ? "not-allowed" : "pointer",
              border: `1px solid ${on ? T.blue : T.line}`,
              background: on ? CARD_SEL_BG : "#fff",
              opacity: disabled ? 0.5 : 1,
              transition: "border-color .14s ease, background .14s ease",
            }}
          >
            <ORadio on={on} dim={disabled} />
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 600, color: T.ink }}>
                {o.name}
                {disabled ? <span style={{ fontSize: 11, fontWeight: 600, color: T.mute }}>· {disabledReason}</span> : null}
              </span>
              <span style={{ display: "block", fontSize: 12, color: T.mute, marginTop: 2, lineHeight: 1.4 }}>{o.desc}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function OptSelect({
  value,
  onChange,
  options,
  width = 320,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; disabled?: boolean }[];
  width?: number;
  disabled?: boolean;
}) {
  return (
    <div style={{ position: "relative", maxWidth: "100%", width }}>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          height: 44,
          borderRadius: 10,
          border: `1px solid ${T.line}`,
          background: "#fff",
          padding: "0 38px 0 12px",
          fontSize: 14,
          color: T.ink,
          cursor: disabled ? "default" : "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          outline: "none",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
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
  );
}

function OptCheck({ on, onClick, disabled, locked }: { on: boolean; onClick?: () => void; disabled?: boolean; locked?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!!disabled || !!locked}
      aria-checked={on}
      role="checkbox"
      style={{
        width: 19,
        height: 19,
        borderRadius: 5,
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        padding: 0,
        border: `1.7px solid ${on ? T.blue : FAINT}`,
        background: on ? T.blue : "#fff",
        cursor: disabled || locked ? "default" : "pointer",
        opacity: disabled || locked ? 0.55 : 1,
      }}
    >
      {on ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2.5 6.2l2.3 2.3L9.5 3.5" />
        </svg>
      ) : null}
    </button>
  );
}

function OptHint({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: T.mute, lineHeight: 1.5, marginTop: 8, maxWidth: 480 }}>{children}</div>;
}

function AdvancedDivider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "6px 0 22px" }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: T.mute, whiteSpace: "nowrap" }}>
        Advanced
      </span>
      <span style={{ flex: 1, height: 1, background: T.line2 }} />
    </div>
  );
}

function LabelSwatch({ color }: { color?: string }) {
  return <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: color ?? T.mute, marginRight: 7, flex: "0 0 auto" }} />;
}

// ── P23-03: book allowlist sub-section (real remote discovery + own save) ─────
type DiscoveredBook = {
  url: string;
  displayName: string | null;
  ctag: string | null;
  readOnly: boolean;
};
type BookRow = DiscoveredBook & { missing?: boolean };

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

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", color: T.mute, fontSize: 13 }}>
        <Spinner size={13} color={T.mute} /> Discovering address books…
      </div>
    );
  }
  if (error) {
    return <OptHint>{error}</OptHint>;
  }
  if (books.length === 0) {
    return <OptHint>Address books will appear here after the first successful sync.</OptHint>;
  }

  return (
    <div>
      {/* sync-all toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
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
            flex: "0 0 auto",
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

      <div style={{ opacity: syncAll ? 0.45 : 1, pointerEvents: syncAll ? "none" : "auto", display: "grid", gap: 2 }}>
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
                height: 40,
                padding: "0 6px",
                borderRadius: 8,
                border: "none",
                background: "transparent",
                cursor: syncAll || b.readOnly ? "default" : "pointer",
                textAlign: "left",
              }}
            >
              <OptCheck on={checked} locked={b.readOnly} />
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
          disabled={saving}
          style={{
            height: 32,
            padding: "0 14px",
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
          {saving ? <Spinner size={13} color="#fff" /> : null}
          {saving ? "Saving…" : "Save books"}
        </button>
      </div>

      {willExclude ? (
        <OptHint>Note: unchecked books will no longer sync into Kontax.</OptHint>
      ) : null}
    </div>
  );
}

// ── P36-DB01: sync settings panel (full-takeover, as-built) ──────────────────
type SettingsDraft = {
  direction: SyncDirection;
  policy: ConflictPolicy;
  freq: string;
  importLabelId: string; // "" = no label
  deletionGuard: boolean; // whether the deletion threshold is enabled
  maxDeletions: string; // number as string, only meaningful when deletionGuard
  notifyOnFailure: boolean;
  windowEnabled: boolean;
  windowStart: string; // "0".."23"
  windowEnd: string;
  excludedFields: string[]; // vCard field tokens, e.g. "NOTE"
  exportLabelFilter: string[]; // label ids; [] = push all
  retry: string; // "default" | "0" | "1" | "3" | "5" | "10"
};

const seedDraft = (account: SyncAccountData): SettingsDraft => ({
  direction: account.direction,
  policy: account.conflictPolicy,
  freq: freqToSelect(account.syncFrequencyMinutes),
  importLabelId: account.importLabelId ?? "",
  deletionGuard: account.maxDeletionsThreshold != null,
  maxDeletions: account.maxDeletionsThreshold != null ? String(account.maxDeletionsThreshold) : "10",
  notifyOnFailure: account.notifyOnFailure,
  windowEnabled: account.syncWindowStart != null && account.syncWindowEnd != null,
  windowStart: account.syncWindowStart != null ? String(account.syncWindowStart) : "8",
  windowEnd: account.syncWindowEnd != null ? String(account.syncWindowEnd) : "22",
  excludedFields: [...account.excludedFields],
  exportLabelFilter: [...account.exportLabelFilter],
  retry: retryToSelect(account.maxAttemptsBeforePause),
});

export function ConnectionSettings({
  account,
  labels,
  freqProGated = false,
  firstRun = false,
  onClose,
  onSaved,
  setToast,
  onNeedElevation,
}: {
  account: SyncAccountData;
  labels: LabelOption[];
  // FREE plan → sub-30-minute frequencies are gated behind Pro.
  freqProGated?: boolean;
  // P36-DB02: initial-setup mode for a freshly-connected account — confirms setup
  // and starts the held first sync instead of a plain settings save.
  firstRun?: boolean;
  onClose: () => void;
  onSaved: () => void;
  setToast: (msg: string) => void;
  onNeedElevation: (retry: () => void) => void;
}) {
  const baseline = seedDraft(account);
  const [draft, setDraft] = useState<SettingsDraft>(baseline);
  const [saving, setSaving] = useState(false);
  const [windowErrShown, setWindowErrShown] = useState(false);

  // Re-seed when the selected account changes (or after a refresh re-supplies props).
  useEffect(() => {
    setDraft(seedDraft(account));
    setWindowErrShown(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    account.id,
    account.direction,
    account.conflictPolicy,
    account.syncFrequencyMinutes,
    account.importLabelId,
    account.maxDeletionsThreshold,
    account.notifyOnFailure,
    account.syncWindowStart,
    account.syncWindowEnd,
    account.excludedFields,
    account.exportLabelFilter,
    account.maxAttemptsBeforePause,
  ]);

  const isCardDAV = account.provider === "CARDDAV";
  const showConflict = draft.direction === "TWO_WAY";
  const showBooks = isCardDAV && draft.direction !== "EXPORT_ONLY";
  const showImportLabel = draft.direction !== "EXPORT_ONLY";
  const showExportFilter = draft.direction === "TWO_WAY" || draft.direction === "EXPORT_ONLY";
  const showWindow = draft.freq !== "manual";
  const windowOn = draft.windowEnabled;
  const windowErr = windowOn && draft.windowStart === draft.windowEnd;

  const dirty =
    draft.direction !== baseline.direction ||
    draft.policy !== baseline.policy ||
    draft.freq !== baseline.freq ||
    draft.importLabelId !== baseline.importLabelId ||
    draft.deletionGuard !== baseline.deletionGuard ||
    (draft.deletionGuard && draft.maxDeletions !== baseline.maxDeletions) ||
    draft.notifyOnFailure !== baseline.notifyOnFailure ||
    draft.windowEnabled !== baseline.windowEnabled ||
    (draft.windowEnabled &&
      (draft.windowStart !== baseline.windowStart || draft.windowEnd !== baseline.windowEnd)) ||
    JSON.stringify(draft.excludedFields) !== JSON.stringify(baseline.excludedFields) ||
    JSON.stringify(draft.exportLabelFilter) !== JSON.stringify(baseline.exportLabelFilter) ||
    draft.retry !== baseline.retry;

  const patch = (next: Partial<SettingsDraft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setWindowErrShown(false);
  };

  const toggleExcluded = (token: string) =>
    patch({
      excludedFields: draft.excludedFields.includes(token)
        ? draft.excludedFields.filter((f) => f !== token)
        : [...draft.excludedFields, token],
    });

  const toggleExportLabel = (id: string) =>
    patch({
      exportLabelFilter: draft.exportLabelFilter.includes(id)
        ? draft.exportLabelFilter.filter((l) => l !== id)
        : [...draft.exportLabelFilter, id],
    });

  const maxDeletionsValue = () => (draft.deletionGuard ? Math.max(1, Math.min(9999, Number(draft.maxDeletions) || 10)) : null);

  // Full settings payload from the current draft — used by first-run setup, which
  // applies everything the user chose rather than a diff against a baseline.
  const fullPayload = () => ({
    syncAccountId: account.id,
    syncDirection: draft.direction,
    conflictPolicy: draft.policy,
    syncFrequencyMinutes: selectToFreq(draft.freq),
    importLabelId: draft.importLabelId === "" ? null : draft.importLabelId,
    maxDeletionsThreshold: maxDeletionsValue(),
    notifyOnFailure: draft.notifyOnFailure,
    ...(draft.windowEnabled
      ? { syncWindowStart: Number(draft.windowStart), syncWindowEnd: Number(draft.windowEnd) }
      : { syncWindowStart: null, syncWindowEnd: null }),
    excludedFields: draft.excludedFields,
    exportLabelFilter: draft.exportLabelFilter,
    maxAttemptsBeforePause: selectToRetry(draft.retry),
  });

  // First-run: confirm setup with the chosen settings and start the held sync.
  const finishSetup = async (useDefaults: boolean) => {
    if (!useDefaults && windowErr) {
      setWindowErrShown(true);
      return;
    }
    setSaving(true);
    const result = await completeSyncSetup(useDefaults ? { syncAccountId: account.id } : fullPayload());
    setSaving(false);
    if (result.ok) {
      setToast("Sync started");
      onSaved();
      onClose();
    } else {
      setToast(result.error ?? "Could not start syncing.");
    }
  };

  const onSave = async () => {
    if (firstRun) {
      void finishSetup(false);
      return;
    }
    if (windowErr) {
      setWindowErrShown(true);
      return;
    }
    setSaving(true);
    // Optimistic: keep the dirty draft on screen; revert on failure. Only send
    // the fields that actually changed so the audit diff stays meaningful.
    const result = await updateSyncAccountSettings({
      syncAccountId: account.id,
      ...(draft.direction !== baseline.direction ? { syncDirection: draft.direction } : {}),
      ...(draft.policy !== baseline.policy ? { conflictPolicy: draft.policy } : {}),
      ...(draft.freq !== baseline.freq ? { syncFrequencyMinutes: selectToFreq(draft.freq) } : {}),
      ...(draft.importLabelId !== baseline.importLabelId
        ? { importLabelId: draft.importLabelId === "" ? null : draft.importLabelId }
        : {}),
      ...(maxDeletionsValue() !== account.maxDeletionsThreshold ? { maxDeletionsThreshold: maxDeletionsValue() } : {}),
      ...(draft.notifyOnFailure !== baseline.notifyOnFailure
        ? { notifyOnFailure: draft.notifyOnFailure }
        : {}),
      ...(draft.windowEnabled !== baseline.windowEnabled ||
      (draft.windowEnabled &&
        (draft.windowStart !== baseline.windowStart || draft.windowEnd !== baseline.windowEnd))
        ? draft.windowEnabled
          ? { syncWindowStart: Number(draft.windowStart), syncWindowEnd: Number(draft.windowEnd) }
          : { syncWindowStart: null, syncWindowEnd: null }
        : {}),
      ...(JSON.stringify(draft.excludedFields) !== JSON.stringify(baseline.excludedFields)
        ? { excludedFields: draft.excludedFields }
        : {}),
      ...(JSON.stringify(draft.exportLabelFilter) !== JSON.stringify(baseline.exportLabelFilter)
        ? { exportLabelFilter: draft.exportLabelFilter }
        : {}),
      ...(draft.retry !== baseline.retry ? { maxAttemptsBeforePause: selectToRetry(draft.retry) } : {}),
    });
    setSaving(false);
    if (result.ok) {
      setToast("Settings saved");
      onSaved();
      // A successful save collapses the panel back to the detail view.
      onClose();
    } else if (result.error === ELEVATION_REQUIRED) {
      // Keep the pending edits and re-run this save once the user re-authenticates.
      onNeedElevation(() => void onSave());
    } else {
      setDraft(baseline);
      setToast(result.error ?? "Could not save settings.");
    }
  };

  // Closing first-run still starts the sync with defaults; otherwise just revert.
  const onCancel = () => {
    if (firstRun) {
      void finishSetup(true);
      return;
    }
    setDraft(baseline);
    onClose();
  };

  // panel subtitle — account email (OAuth) or label (CardDAV)
  const subtitle = !isCardDAV && account.connectedEmail ? account.connectedEmail : account.label;
  const dirDisabled: Partial<Record<SyncDirection, string>> | undefined = isCardDAV
    ? undefined
    : { EXPORT_ONLY: "Not supported for this provider" };
  const importLabel = labels.find((l) => l.id === draft.importLabelId);

  return (
    <div id="sy-settings-zone">
      {/* panel header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: T.ink }}>
            {firstRun ? "Set up sync" : "Sync settings"}
          </h2>
          <div style={{ fontSize: 13, color: T.mute, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {subtitle}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close settings"
          style={{
            display: "grid",
            placeItems: "center",
            width: 32,
            height: 32,
            flex: "0 0 auto",
            borderRadius: 7,
            border: "none",
            background: "transparent",
            color: T.ink2,
            cursor: "pointer",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div style={{ maxWidth: 520 }}>
        {/* §1 Direction */}
        <OptSection label="Direction">
          <OptCards value={draft.direction} options={DIR_OPTS} onChange={(v) => patch({ direction: v })} disabledMap={dirDisabled} />
          {account.direction === "EXPORT_ONLY" && draft.direction !== "EXPORT_ONLY" ? (
            <div
              className="cx-fade-in"
              style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 10, background: WARN_BG, borderRadius: 8, padding: "10px 12px" }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={WARN_FG} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: 1 }}>
                <path d="M12 4l9 16H3z" />
                <path d="M12 10v4" />
                <path d="M12 17h.01" />
              </svg>
              <span style={{ fontSize: 12, lineHeight: 1.45, color: WARN_FG }}>
                Resuming pull sync. Contacts deleted on the remote while export-only was active may be removed from Kontax on the next sync.
              </span>
            </div>
          ) : null}
        </OptSection>

        {/* §2 Sync frequency */}
        <OptSection label="Sync frequency">
          <OptSelect
            value={draft.freq}
            onChange={(v) => {
              const opt = FREQ_OPTS.find((o) => o.v === v);
              if (opt?.pro && freqProGated) {
                setToast("Faster syncs are available on Pro");
                return;
              }
              patch({ freq: v });
            }}
            options={FREQ_OPTS.map((o) => ({
              value: o.v,
              label: o.pro && freqProGated ? `${o.label}  — Pro` : o.label,
              disabled: o.pro && freqProGated,
            }))}
          />
          {draft.freq === "plan" ? (
            <OptHint>Your plan syncs {PLAN_FREQ_LABEL}.</OptHint>
          ) : freqProGated ? (
            <OptHint>
              Faster than 30 minutes requires Pro.{" "}
              <a href="/pricing" style={{ color: T.blue, fontWeight: 600 }}>
                Upgrade →
              </a>
            </OptHint>
          ) : null}
        </OptSection>

        {/* §3 Conflict policy (two-way only) */}
        {showConflict ? (
          <OptSection label="Conflict policy">
            <OptCards value={draft.policy} options={POLICY_OPTS} onChange={(v) => patch({ policy: v })} />
            {draft.policy === "DEVICE_WINS" ? (
              <div
                className="cx-fade-in"
                style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 10, background: WARN_BG, borderRadius: 8, padding: "10px 12px" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={WARN_FG} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "0 0 auto", marginTop: 1 }}>
                  <path d="M12 4l9 16H3z" />
                  <path d="M12 10v4" />
                  <path d="M12 17h.01" />
                </svg>
                <span style={{ fontSize: 12, lineHeight: 1.45, color: WARN_FG }}>
                  Remote edits made since the last sync will be overwritten by your local version.
                </span>
              </div>
            ) : null}
          </OptSection>
        ) : null}

        {/* §4 Address books (CardDAV only) */}
        {showBooks ? (
          <OptSection label="Address books" gated="CardDAV only">
            <BookAllowlist account={account} onSaved={onSaved} setToast={setToast} onNeedElevation={onNeedElevation} />
          </OptSection>
        ) : null}

        <AdvancedDivider />

        {/* §5 Auto-label on import */}
        {showImportLabel ? (
          <OptSection label="Auto-label on import">
            <OptSelect
              value={draft.importLabelId}
              onChange={(v) => patch({ importLabelId: v })}
              options={[{ value: "", label: "No label" }, ...labels.map((l) => ({ value: l.id, label: l.name }))]}
            />
            {importLabel ? (
              <OptHint>
                <span style={{ display: "inline-flex", alignItems: "center" }}>
                  <LabelSwatch color={importLabel.color} />
                  Contacts imported from this account are tagged “{importLabel.name}”.
                </span>
              </OptHint>
            ) : (
              <OptHint>Apply a label to every contact created or updated by an inbound sync.</OptHint>
            )}
          </OptSection>
        ) : null}

        {/* §6 Deletion safety */}
        <OptSection label="Deletion safety">
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: draft.deletionGuard ? T.ink : FAINT }}>
              Pause if a sync would delete more than
              <input
                type="number"
                min={1}
                max={9999}
                value={draft.deletionGuard ? draft.maxDeletions : ""}
                disabled={!draft.deletionGuard}
                onChange={(e) => patch({ maxDeletions: e.target.value })}
                style={{
                  width: 72,
                  height: 36,
                  borderRadius: 8,
                  border: `1px solid ${T.line}`,
                  padding: "0 10px",
                  fontSize: 14,
                  color: T.ink,
                  textAlign: "center",
                  outline: "none",
                  background: draft.deletionGuard ? "#fff" : T.wash,
                  fontFamily: "inherit",
                }}
              />
              contacts at once
            </span>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13.5, color: T.ink2 }}>
              <OptCheck on={!draft.deletionGuard} onClick={() => patch({ deletionGuard: !draft.deletionGuard })} />
              Disabled
            </label>
          </div>
        </OptSection>

        {/* §7 Sync window */}
        {showWindow ? (
          <OptSection label="Sync window">
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 14, color: windowOn ? T.ink : FAINT }}>
                Only sync between
                <OptSelect
                  width={92}
                  disabled={!windowOn}
                  value={windowOn ? draft.windowStart : "8"}
                  onChange={(v) => patch({ windowStart: v, windowEnabled: true })}
                  options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))}
                />
                and
                <OptSelect
                  width={92}
                  disabled={!windowOn}
                  value={windowOn ? draft.windowEnd : "22"}
                  onChange={(v) => patch({ windowEnd: v, windowEnabled: true })}
                  options={Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: `${String(h).padStart(2, "0")}:00` }))}
                />
              </span>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13.5, color: T.ink2 }}>
                <OptCheck
                  on={!windowOn}
                  onClick={() => patch(windowOn ? { windowEnabled: false } : { windowEnabled: true, windowStart: "8", windowEnd: "22" })}
                />
                No restriction
              </label>
            </div>
            {windowErr && windowErrShown ? <div style={{ fontSize: 12, color: T.red, marginTop: 8 }}>Start and end must be different.</div> : null}
            {windowOn && !windowErr ? <OptHint>Hours use your local timezone.</OptHint> : null}
          </OptSection>
        ) : null}

        {/* §8 Field exclusions */}
        <OptSection label="Field exclusions">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px 18px" }}>
            {FIELD_OPTS.map((f) => (
              <label key={f.token} style={{ display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 14, color: T.ink }}>
                <OptCheck on={draft.excludedFields.includes(f.token)} onClick={() => toggleExcluded(f.token)} />
                {f.label}
              </label>
            ))}
          </div>
          <OptHint>Excluded fields are not read from or written to the remote. Existing remote data is left unchanged.</OptHint>
        </OptSection>

        {/* §9 Export filter (two-way or export-only) — multi-select */}
        {showExportFilter ? (
          <OptSection label="Export filter">
            <div style={{ fontSize: 13.5, color: T.ink2, marginBottom: 8 }}>Only push contacts with these labels:</div>
            {labels.length === 0 ? (
              <OptHint>Create a label in Contacts to filter outbound pushes.</OptHint>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px 18px" }}>
                {labels.map((l) => (
                  <label key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 14, color: T.ink }}>
                    <OptCheck on={draft.exportLabelFilter.includes(l.id)} onClick={() => toggleExportLabel(l.id)} />
                    <LabelSwatch color={l.color} />
                    {l.name}
                  </label>
                ))}
              </div>
            )}
            <OptHint>
              {draft.exportLabelFilter.length === 0
                ? "No labels selected — all contacts are pushed."
                : "Contacts already on the remote won’t be deleted if they don’t match — only new outbound changes are affected."}
            </OptHint>
          </OptSection>
        ) : null}

        {/* §10 Notifications */}
        <OptSection label="Notifications">
          <label style={{ display: "inline-flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 14, color: T.ink }}>
            <OptCheck on={draft.notifyOnFailure} onClick={() => patch({ notifyOnFailure: !draft.notifyOnFailure })} />
            Alert me when this account fails or needs re-authentication
          </label>
        </OptSection>

        {/* §11 Retry sensitivity */}
        <OptSection label="Retry sensitivity" style={{ marginBottom: 0 }}>
          <OptSelect value={draft.retry} onChange={(v) => patch({ retry: v })} options={RETRY_OPTS} />
          <OptHint>After this many consecutive failures, the account is auto-paused. You’ll need to resume it manually.</OptHint>
        </OptSection>

        {/* pinned actions — first-run starts the held sync; edit mode saves a diff */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, borderTop: `1px solid ${T.line2}`, marginTop: 26, paddingTop: 20, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || (!firstRun && !dirty)}
            style={{
              height: 36,
              padding: "0 16px",
              borderRadius: 8,
              border: "none",
              background: T.blue,
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: saving || (!firstRun && !dirty) ? "default" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              opacity: saving || (!firstRun && !dirty) ? 0.55 : 1,
            }}
          >
            {saving ? <Spinner size={14} color="#fff" /> : null}
            {saving ? (firstRun ? "Starting…" : "Saving…") : firstRun ? "Start syncing" : "Save settings"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{ border: "none", background: "transparent", color: T.ink2, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
          >
            {firstRun ? "Use defaults" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

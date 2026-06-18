"use client";

import { type ReactNode, useEffect, useState } from "react";

import { updateBookAllowlist, updateSyncAccountSettings } from "~/app/actions/sync";

import { ELEVATION_REQUIRED, Spinner, T } from "./sync-shared";
import type { LabelOption, SyncAccountData } from "./sync-page-client";

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
const freqToSelect = (minutes: number | null): string =>
  minutes === 0 ? "manual" : minutes == null ? "60" : String(minutes);
const selectToFreq = (value: string): number | null => (value === "manual" ? 0 : Number(value));

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
  children?: ReactNode;
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


// ── P36: advanced settings vocabulary + small controls ───────────────────────
const FIELD_EXCLUSIONS: { token: string; label: string }[] = [
  { token: "NOTE", label: "Notes" },
  { token: "BDAY", label: "Birthdays" },
  { token: "ADR", label: "Addresses" },
  { token: "X-CUSTOM", label: "Custom fields" },
];
const RETRY_OPTIONS: { value: string; label: string }[] = [
  { value: "default", label: "Platform default (5 failures)" },
  { value: "1", label: "1 failure" },
  { value: "3", label: "3 failures" },
  { value: "5", label: "5 failures" },
  { value: "10", label: "10 failures" },
  { value: "0", label: "Never auto-pause" },
];
const HOUR_OPTIONS: { value: string; label: string }[] = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: `${String(h).padStart(2, "0")}:00`,
}));

function SettingLabel({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 600, color: T.ink, marginBottom: 8 }}>{children}</div>;
}

function SettingHint({ children }: { children: ReactNode }) {
  return <div style={{ fontSize: 12, color: T.mute, marginTop: 6, maxWidth: 460 }}>{children}</div>;
}

function StyledSelect({
  value,
  onChange,
  options,
  maxWidth = 280,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  maxWidth?: number;
}) {
  return (
    <div style={{ position: "relative", maxWidth }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
        {options.map((o) => (
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
  );
}

function CheckboxRow({
  checked,
  onToggle,
  children,
  swatch,
}: {
  checked: boolean;
  onToggle: () => void;
  children: ReactNode;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        minHeight: 36,
        padding: "4px 6px",
        border: "none",
        background: "transparent",
        cursor: "pointer",
        textAlign: "left",
        borderRadius: 8,
      }}
    >
      <BookCheckbox checked={checked} />
      {swatch ? (
        <span style={{ width: 10, height: 10, borderRadius: 3, background: swatch, flexShrink: 0 }} />
      ) : null}
      <span style={{ fontSize: 14, color: T.ink }}>{children}</span>
    </button>
  );
}

function PlainToggle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        padding: "2px 0",
        border: "none",
        background: "transparent",
        cursor: "pointer",
      }}
    >
      <BookCheckbox checked={checked} />
      <span style={{ fontSize: 13.5, color: T.ink2 }}>{label}</span>
    </button>
  );
}

// ── P23-02 / P36: connection settings drawer (within the detail panel) ────────
type SettingsDraft = {
  direction: SyncDirection;
  policy: ConflictPolicy;
  freq: string;
  // P36 advanced
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

const retryToSelect = (n: number | null): string => (n == null ? "default" : String(n));
const selectToRetry = (s: string): number | null => (s === "default" ? null : Number(s));

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
  onClose,
  onSaved,
  setToast,
  onNeedElevation,
}: {
  account: SyncAccountData;
  labels: LabelOption[];
  onClose: () => void;
  onSaved: () => void;
  setToast: (msg: string) => void;
  onNeedElevation: (retry: () => void) => void;
}) {
  const baseline = seedDraft(account);
  const [draft, setDraft] = useState<SettingsDraft>(baseline);
  const [booksOpen, setBooksOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-seed when the selected account changes (or after a refresh re-supplies props).
  useEffect(() => {
    setDraft(seedDraft(account));
    setBooksOpen(false);
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

  // The export filter only applies when Kontax pushes (two-way / export-only).
  const exportFilterApplies = draft.direction !== "IMPORT_ONLY";

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

  const onSave = async () => {
    setSaving(true);
    // Optimistic: keep the dirty draft on screen; revert on failure. Only send
    // the fields that actually changed so the audit diff stays meaningful.
    const maxDeletionsThreshold = draft.deletionGuard
      ? Math.max(1, Math.min(9999, Number(draft.maxDeletions) || 10))
      : null;
    const result = await updateSyncAccountSettings({
      syncAccountId: account.id,
      ...(draft.direction !== baseline.direction ? { syncDirection: draft.direction } : {}),
      ...(draft.policy !== baseline.policy ? { conflictPolicy: draft.policy } : {}),
      ...(draft.freq !== baseline.freq ? { syncFrequencyMinutes: selectToFreq(draft.freq) } : {}),
      ...(draft.importLabelId !== baseline.importLabelId
        ? { importLabelId: draft.importLabelId === "" ? null : draft.importLabelId }
        : {}),
      ...(maxDeletionsThreshold !== account.maxDeletionsThreshold ? { maxDeletionsThreshold } : {}),
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
      // Per the brief, a successful save collapses the panel back to the detail.
      onClose();
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
    onClose();
  };

  const booksSummary =
    account.bookAllowlist.length === 0
      ? "All books synced"
      : `${account.bookAllowlist.length} book${account.bookAllowlist.length === 1 ? "" : "s"} · custom`;

  const accountTitle =
    account.provider !== "CARDDAV" && account.connectedEmail ? account.connectedEmail : account.label;

  return (
    <div
      id="sy-settings-zone"
      style={{
        border: `1px solid ${T.line2}`,
        borderRadius: 14,
        padding: "22px 22px 20px",
        background: "#fff",
        animation: "sy-fade .18s ease",
      }}
    >
      {/* panel header — title + which account + close */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: T.ink }}>Sync settings</div>
          <div
            style={{
              fontSize: 13,
              color: T.mute,
              marginTop: 2,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {accountTitle}
          </div>
        </div>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close settings"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 30,
            height: 30,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: T.ink2,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

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

          {/* ── Advanced ───────────────────────────────────────────────── */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "22px 0 16px",
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
              Advanced
            </span>
            <span style={{ height: 1, flex: 1, background: T.line2 }} />
          </div>

          {/* Auto-label on import — hidden for export-only (no inbound contacts). */}
          {draft.direction !== "EXPORT_ONLY" ? (
            <>
              <SettingLabel>Auto-label on import</SettingLabel>
              {labels.length > 0 ? (
                <StyledSelect
                  value={draft.importLabelId}
                  onChange={(v) => patch({ importLabelId: v })}
                  options={[{ value: "", label: "No label" }, ...labels.map((l) => ({ value: l.id, label: l.name }))]}
                />
              ) : (
                <SettingHint>Create a label in Contacts first to tag imported contacts.</SettingHint>
              )}
              {draft.importLabelId ? (
                <SettingHint>Every contact imported from this account is tagged with this label.</SettingHint>
              ) : null}
              <SettingsDivider />
            </>
          ) : null}

          {/* Deletion safety */}
          <SettingLabel>Deletion safety</SettingLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13.5, color: T.ink2 }}>Pause if a sync would delete more than</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={draft.maxDeletions}
              disabled={!draft.deletionGuard}
              onChange={(e) => patch({ maxDeletions: e.target.value })}
              style={{
                width: 72,
                height: 34,
                borderRadius: 8,
                border: `1px solid ${T.line}`,
                background: draft.deletionGuard ? "#fff" : T.wash,
                padding: "0 8px",
                fontSize: 14,
                color: draft.deletionGuard ? T.ink : T.mute,
                outline: "none",
              }}
            />
            <span style={{ fontSize: 13.5, color: T.ink2 }}>contacts at once</span>
          </div>
          <div style={{ marginTop: 8 }}>
            <PlainToggle
              checked={!draft.deletionGuard}
              onToggle={() => patch({ deletionGuard: !draft.deletionGuard })}
              label="Disabled — never pause for deletions"
            />
          </div>
          <SettingsDivider />

          {/* Sync window — not meaningful for manual-only frequency. */}
          {draft.freq !== "manual" ? (
            <>
              <SettingLabel>Sync window</SettingLabel>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, color: T.ink2 }}>Only sync between</span>
                <StyledSelect
                  value={draft.windowStart}
                  onChange={(v) => patch({ windowStart: v, windowEnabled: true })}
                  options={HOUR_OPTIONS}
                  maxWidth={110}
                />
                <span style={{ fontSize: 13.5, color: T.ink2 }}>and</span>
                <StyledSelect
                  value={draft.windowEnd}
                  onChange={(v) => patch({ windowEnd: v, windowEnabled: true })}
                  options={HOUR_OPTIONS}
                  maxWidth={110}
                />
              </div>
              <div style={{ marginTop: 8 }}>
                <PlainToggle
                  checked={!draft.windowEnabled}
                  onToggle={() => patch({ windowEnabled: !draft.windowEnabled })}
                  label="No restriction — sync at any time"
                />
              </div>
              <SettingHint>Hours are in your local time. Scheduled syncs outside the window are skipped.</SettingHint>
              <SettingsDivider />
            </>
          ) : null}

          {/* Field exclusions */}
          <SettingLabel>Field exclusions</SettingLabel>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 16px", maxWidth: 460 }}>
            {FIELD_EXCLUSIONS.map((f) => (
              <CheckboxRow
                key={f.token}
                checked={draft.excludedFields.includes(f.token)}
                onToggle={() => toggleExcluded(f.token)}
              >
                {f.label}
              </CheckboxRow>
            ))}
          </div>
          <SettingHint>
            Excluded fields are not read from or written to the remote. Existing remote data is left unchanged.
          </SettingHint>
          <SettingsDivider />

          {/* Export filter — only when Kontax pushes (two-way / export-only). */}
          {exportFilterApplies ? (
            <>
              <SettingLabel>Export filter</SettingLabel>
              {labels.length > 0 ? (
                <>
                  <div style={{ fontSize: 13.5, color: T.ink2, marginBottom: 6 }}>
                    {draft.exportLabelFilter.length === 0
                      ? "Pushing all contacts."
                      : "Only push contacts with one of these labels:"}
                  </div>
                  <div style={{ maxWidth: 460 }}>
                    {labels.map((l) => (
                      <CheckboxRow
                        key={l.id}
                        checked={draft.exportLabelFilter.includes(l.id)}
                        onToggle={() => toggleExportLabel(l.id)}
                        swatch={l.color}
                      >
                        {l.name}
                      </CheckboxRow>
                    ))}
                  </div>
                  <SettingHint>
                    Contacts already on the remote won&rsquo;t be deleted if they don&rsquo;t match — only new outbound
                    changes are filtered.
                  </SettingHint>
                </>
              ) : (
                <SettingHint>Create a label in Contacts first to filter what gets pushed.</SettingHint>
              )}
              <SettingsDivider />
            </>
          ) : null}

          {/* Notifications */}
          <SettingLabel>Notifications</SettingLabel>
          <PlainToggle
            checked={draft.notifyOnFailure}
            onToggle={() => patch({ notifyOnFailure: !draft.notifyOnFailure })}
            label="Alert me when this account fails or needs re-authentication"
          />
          <SettingsDivider />

          {/* Retry sensitivity */}
          <SettingLabel>Retry sensitivity</SettingLabel>
          <StyledSelect
            value={draft.retry}
            onChange={(v) => patch({ retry: v })}
            options={RETRY_OPTIONS}
          />
          <SettingHint>
            After this many consecutive failures the account is auto-paused. You&rsquo;ll need to resume it manually.
          </SettingHint>

          <SettingsDivider />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !dirty}
              style={{
                height: 36,
                padding: "0 16px",
                borderRadius: 8,
                border: "none",
                background: T.blue,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: saving || !dirty ? "default" : "pointer",
                opacity: saving || !dirty ? 0.55 : 1,
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
    </div>
  );
}

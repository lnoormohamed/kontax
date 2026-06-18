"use client";

import { type ReactNode, useEffect, useState } from "react";

import { updateBookAllowlist, updateSyncAccountSettings } from "~/app/actions/sync";

import { ELEVATION_REQUIRED, Spinner, T } from "./sync-shared";
import type { SyncAccountData } from "./sync-page-client";

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


// ── P23-02: connection settings drawer (within the detail panel) ──────────────
export function ConnectionSettings({
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

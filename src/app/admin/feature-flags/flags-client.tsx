"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { AD, AdIcon } from "../_components/admin-icons";
import { useFocusTrap } from "../_components/use-focus-trap";
import { useToast } from "../_components/toast";
import { saveFeatureFlag, toggleFeatureFlag } from "~/app/actions/feature-flags";

type Mode = "OFF" | "SPECIFIC_USERS" | "ALL" | "ROLLOUT";

type Flag = {
  id: string;
  key: string;
  name: string;
  description: string;
  mode: Mode;
  rolloutPct: number;
  userCount: number;
  updatedLabel: string;
};

const MODE_META: Record<Mode, { color: string; label: (f: Flag) => string }> = {
  OFF: { color: "#a1a1aa", label: () => "Disabled" },
  SPECIFIC_USERS: { color: "#4158f4", label: (f) => `${f.userCount} users` },
  ALL: { color: "#16a34a", label: () => "All users" },
  ROLLOUT: { color: "#d97706", label: (f) => `${f.rolloutPct}%` },
};

const MODE_OPTS: { id: Mode; label: string; desc: string }[] = [
  { id: "OFF", label: "Disabled", desc: "Off for everyone" },
  { id: "SPECIFIC_USERS", label: "Specific users", desc: "Enabled for an allow-list" },
  { id: "ROLLOUT", label: "Percentage rollout", desc: "Gradual % of all users" },
  { id: "ALL", label: "All users", desc: "Fully enabled" },
];

export function FlagsTable({ flags }: { flags: Flag[] }) {
  const [editing, setEditing] = useState<Flag | null>(null);
  // Remember the last enabled mode per flag so the binary toggle can restore it.
  const [prevMode, setPrevMode] = useState<Record<string, Mode>>(() =>
    Object.fromEntries(flags.map((f) => [f.key, f.mode === "OFF" ? "ALL" : f.mode])),
  );
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const flash = useToast();

  const toggle = (f: Flag) => {
    const enable = f.mode === "OFF";
    if (!enable) setPrevMode((p) => ({ ...p, [f.key]: f.mode }));
    startTransition(async () => {
      const res = await toggleFeatureFlag({ key: f.key, enable, restoreMode: prevMode[f.key] ?? "ALL" });
      if ("error" in res) flash("Couldn’t update flag");
      else router.refresh();
    });
  };

  return (
    <>
      <div className="ad-result-meta">{flags.length} feature flags</div>
      <div className="ad-table-wrap">
        <div className="ad-tr ad-thead ad-tr--flags">
          <span>Flag</span>
          <span>Rollout</span>
          <span>Status</span>
          <span>Last updated</span>
          <span />
        </div>

        {flags.length === 0 ? (
          <div className="ad-table-state">
            <span className="ad-state-icon">
              <AdIcon name="flag" size={22} c="#8b938c" />
            </span>
            <div className="ad-state-title">No feature flags yet</div>
            <div className="ad-state-sub">Create a flag to start gating features behind a rollout.</div>
          </div>
        ) : (
          flags.map((f) => {
            const meta = MODE_META[f.mode];
            const on = f.mode !== "OFF";
            return (
              <div key={f.key} className="ad-tr ad-tr--flags">
                <span className="ad-flag-name" data-th="Flag">
                  <span className="ad-flag-title">{f.name}</span>
                  <span className="ad-flag-key tnum">{f.key}</span>
                </span>
                <span data-th="Rollout">
                  <span className="ad-flag-mode" style={{ color: meta.color }}>
                    <span className="ad-mode-dot" style={{ background: meta.color }} />
                    {meta.label(f)}
                  </span>
                </span>
                <span data-th="Status">
                  <button
                    className="ad-toggle"
                    data-on={on ? "1" : "0"}
                    onClick={() => toggle(f)}
                    disabled={pending}
                    role="switch"
                    aria-checked={on}
                    aria-label="Enable or disable flag"
                    style={{ background: on ? AD.blue : "#d4d4d8" }}
                  >
                    <i />
                  </button>
                </span>
                <span className="ad-cell-muted" data-th="Updated">
                  {f.updatedLabel}
                </span>
                <span style={{ textAlign: "right" }}>
                  <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => setEditing(f)}>
                    <AdIcon name="edit" size={14} c="currentColor" />
                    Edit
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <FlagSlideOver
          flag={editing}
          onClose={() => setEditing(null)}
          onSaved={(name) => {
            setEditing(null);
            flash(`Saved “${name}”`);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function FlagSlideOver({
  flag,
  onClose,
  onSaved,
}: {
  flag: Flag;
  onClose: () => void;
  onSaved: (name: string) => void;
}) {
  const [draft, setDraft] = useState({ description: flag.description, mode: flag.mode, rolloutPct: flag.rolloutPct });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const trap = useFocusTrap<HTMLElement>(true);

  const save = async () => {
    setSaving(true);
    setErr(null);
    const res = await saveFeatureFlag({
      key: flag.key,
      description: draft.description,
      mode: draft.mode,
      rolloutPct: draft.rolloutPct,
    });
    if ("error" in res) {
      setSaving(false);
      setErr("Couldn’t save changes. Please try again.");
      return;
    }
    onSaved(flag.name);
  };

  return (
    <>
      <div className="ad-scrim" onClick={onClose} />
      <aside className="ad-slideover" ref={trap} role="dialog" aria-modal="true" aria-label={`Edit ${flag.name}`}>
        <div className="ad-slide-head">
          <div style={{ minWidth: 0 }}>
            <div className="ad-slide-eyebrow">Feature flag</div>
            <h2 className="ad-slide-title">{flag.name}</h2>
            <div className="ad-flag-key tnum">{flag.key}</div>
          </div>
          <button className="ad-icon-btn" onClick={onClose} aria-label="Close">
            <AdIcon name="close" size={18} c={AD.ink2} />
          </button>
        </div>

        <div className="ad-slide-body">
          <label className="ad-field-label">Description</label>
          <textarea
            className="ad-textarea"
            rows={2}
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />

          <label className="ad-field-label" style={{ marginTop: 18 }}>
            Rollout mode
          </label>
          <div className="ad-mode-list">
            {MODE_OPTS.map((md) => (
              <button
                key={md.id}
                className="ad-mode-opt"
                data-on={draft.mode === md.id ? "1" : "0"}
                onClick={() => setDraft({ ...draft, mode: md.id })}
              >
                <span className="ad-radio" data-on={draft.mode === md.id ? "1" : "0"} />
                <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
                  <span className="ad-mode-opt-label">{md.label}</span>
                  <span className="ad-mode-opt-desc">{md.desc}</span>
                </span>
                <span className="ad-mode-dot" style={{ background: MODE_META[md.id].color, marginLeft: "auto" }} />
              </button>
            ))}
          </div>

          {draft.mode === "ROLLOUT" && (
            <div className="ad-rollout-field">
              <div className="ad-field-row">
                <label className="ad-field-label" style={{ margin: 0 }}>
                  Rollout percentage
                </label>
                <span className="ad-rollout-val tnum">{draft.rolloutPct}%</span>
              </div>
              <input
                type="range"
                className="ad-range"
                min={0}
                max={100}
                step={5}
                value={draft.rolloutPct}
                onChange={(e) => setDraft({ ...draft, rolloutPct: Number(e.target.value) })}
              />
            </div>
          )}

          {draft.mode === "SPECIFIC_USERS" && (
            <div className="ad-rollout-field">
              <div className="ad-field-row">
                <label className="ad-field-label" style={{ margin: 0 }}>
                  Allow-list size
                </label>
                <span className="ad-rollout-val tnum">{flag.userCount} users</span>
              </div>
              <div className="ad-field-hint">Manage the explicit allow-list in the rollout console.</div>
            </div>
          )}

          {err && (
            <div className="ad-modal-error" style={{ marginTop: 16 }}>
              <AdIcon name="warn" size={15} c={AD.red} />
              <span>{err}</span>
            </div>
          )}
        </div>

        <div className="ad-slide-foot">
          <button className="ad-btn ad-btn--secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button className="ad-btn ad-btn--primary" onClick={save} disabled={saving}>
            {saving && <AdIcon name="spinner" size={15} c="#fff" w={2} spin />}
            <span>{saving ? "Saving…" : "Save changes"}</span>
          </button>
        </div>
      </aside>
    </>
  );
}

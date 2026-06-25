"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { updateSyncCapabilityOverride } from "~/app/actions/admin";
import { AD, AdIcon } from "../../_components/admin-icons";
import { useFocusTrap } from "../../_components/use-focus-trap";
import { useToast } from "../../_components/toast";

const ERROR_LABELS: Record<string, string> = {
  REASON_REQUIRED: "A reason is required.",
  FORBIDDEN: "You don’t have permission to do that.",
  INVALID_PROFILE: "Pick a valid capability profile.",
  UNSUPPORTED_PROVIDER: "Only CardDAV connections can be overridden.",
  SYNC_ACCOUNT_NOT_FOUND: "This sync account no longer exists.",
};

type OverrideValue = "" | "carddav-generic-safe" | "carddav-icloud" | "carddav-fastmail";

export function SyncConnectionActions({
  syncAccountId,
  userId,
  userEmail,
  label,
  providerLabel,
  currentOverride,
  canOverride,
}: {
  syncAccountId: string;
  userId: string;
  userEmail: string;
  label: string;
  providerLabel: string;
  currentOverride: string | null;
  canOverride: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <aside className="ad-detail-actions">
      <div className="ad-actions-card">
        <div className="ad-actions-title">Support tools</div>
        <div className="ad-actions-rule" />

        <div className="ad-action-block">
          <Link className="ad-btn ad-btn--secondary ad-btn--full" href={`/admin/users/${userId}`}>
            <AdIcon name="users" size={15} c="currentColor" />
            Open user support view
          </Link>
          <div className="ad-action-note">{userEmail}</div>
        </div>

        <div className="ad-action-block" style={{ marginBottom: 0 }}>
          <button
            className="ad-btn ad-btn--secondary ad-btn--full"
            onClick={() => setOpen(true)}
            disabled={!canOverride}
          >
            <AdIcon name="flag" size={15} c="currentColor" />
            Override capability profile
          </button>
          <div className="ad-action-note">
            {canOverride
              ? `Current override: ${currentOverride ?? "Auto-detect"}`
              : `${providerLabel} connections use their built-in profile and can’t be overridden here.`}
          </div>
        </div>
      </div>

      {open ? (
        <CapabilityOverrideDialog
          syncAccountId={syncAccountId}
          label={label}
          providerLabel={providerLabel}
          currentOverride={currentOverride}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </aside>
  );
}

function CapabilityOverrideDialog({
  syncAccountId,
  label,
  providerLabel,
  currentOverride,
  onClose,
}: {
  syncAccountId: string;
  label: string;
  providerLabel: string;
  currentOverride: string | null;
  onClose: () => void;
}) {
  const trap = useFocusTrap<HTMLDivElement>(true);
  const router = useRouter();
  const flash = useToast();
  const [reason, setReason] = useState("");
  const [phase, setPhase] = useState<"idle" | "loading" | "success">("idle");
  const [err, setErr] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState<OverrideValue>(
    (currentOverride as OverrideValue | null) ?? "",
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && phase !== "loading") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  const submit = async () => {
    if (!reason.trim() || phase === "loading") return;
    setErr(null);
    setPhase("loading");

    const result = await updateSyncCapabilityOverride({
      syncAccountId,
      capabilityProfileOverride: overrideValue || null,
      reason,
    });

    if ("error" in result) {
      setPhase("idle");
      setErr(ERROR_LABELS[result.error] ?? "Couldn’t save the override right now.");
      return;
    }

    setPhase("success");
    setTimeout(() => {
      onClose();
      router.refresh();
      flash("Capability override updated");
    }, 650);
  };

  return (
    <div className="ad-overlay" onClick={() => phase !== "loading" && onClose()}>
      <div
        className="ad-modal"
        ref={trap}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="ad-modal-head">
          <span className="ad-modal-glyph ad-modal-glyph--blue">
            <AdIcon name="flagchip" size={18} c="#fff" />
          </span>
          <div>
            <h3 className="ad-modal-title">Override capability profile</h3>
          </div>
        </div>
        <p className="ad-modal-body">
          Pin how Kontax treats this {providerLabel} connection when it decides which fields are safe to sync.
        </p>

        <div className="ad-modal-user">
          <div style={{ minWidth: 0 }}>
            <div className="ad-modal-user-email">{label}</div>
            <div className="ad-modal-user-name">{providerLabel} support workflow</div>
          </div>
        </div>

        <div className="ad-modal-field">
          <label className="ad-field-label" htmlFor="admin-sync-capability-profile">
            Capability profile
          </label>
          <div className="ad-select-wrap ad-select-wrap--block">
            <select
              id="admin-sync-capability-profile"
              className="ad-select"
              value={overrideValue}
              onChange={(event) => setOverrideValue(event.target.value as OverrideValue)}
              disabled={phase !== "idle"}
            >
              <option value="">Auto-detect</option>
              <option value="carddav-generic-safe">Generic safe</option>
              <option value="carddav-icloud">Verified iCloud</option>
              <option value="carddav-fastmail">Verified Fastmail</option>
            </select>
            <AdIcon name="chevd" size={14} c={AD.mute} />
          </div>
          <div className="ad-field-hint">
            Use Generic safe when we haven’t verified every field. Use a verified profile when support has confirmed the provider behavior.
          </div>
        </div>

        <div className="ad-modal-field" style={{ marginBottom: err ? 12 : 18 }}>
          <label className="ad-field-label" htmlFor="admin-sync-capability-reason">
            Reason <span className="ad-req">*</span>
          </label>
          <textarea
            id="admin-sync-capability-reason"
            className="ad-textarea"
            rows={4}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Capture why support is changing the provider profile."
            disabled={phase !== "idle"}
          />
        </div>

        {err ? (
          <div className="ad-modal-error">
            <AdIcon name="warn" size={14} c={AD.red} />
            {err}
          </div>
        ) : null}

        <div className="ad-modal-foot">
          <button className="ad-btn ad-btn--ghost" onClick={onClose} disabled={phase === "loading"}>
            Cancel
          </button>
          <button
            className="ad-btn ad-btn--primary"
            data-phase={phase === "success" ? "success" : undefined}
            onClick={submit}
            disabled={phase === "loading" || !reason.trim()}
          >
            {phase === "loading"
              ? "Saving…"
              : phase === "success"
                ? "Saved"
                : "Save override"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AD, AdIcon } from "../../_components/admin-icons";
import { Avatar } from "../../_components/avatar";
import { useFocusTrap } from "../../_components/use-focus-trap";
import { useToast } from "../../_components/toast";
import {
  adminDeleteAccount,
  overridePlan,
  startImpersonation,
  suspendAccount,
} from "~/app/actions/admin";

// ─── Collapsible (Recent activity / Active sessions) ──────────────────────────

export function Collapsible({
  title,
  count,
  defaultOpen,
  children,
}: {
  title: string;
  count: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <section className="ad-card">
      <button className="ad-collapse-head" onClick={() => setOpen((o) => !o)}>
        <h3 className="ad-card-title">{title}</h3>
        <span className="ad-collapse-meta">
          <span className="ad-count-chip">{count}</span>
          <AdIcon name={open ? "chevu" : "chevd"} size={16} c={AD.mute} />
        </span>
      </button>
      {open && <div className="ad-collapse-body">{children}</div>}
    </section>
  );
}

// ─── Action panel + confirmation dialogs ──────────────────────────────────────

type DialogKind = "override" | "suspend" | "delete" | "impersonate";

const DIALOGS: Record<
  DialogKind,
  { title: string; body: string; confirm: string; busy: string; ok: string; tone: string; plan?: boolean }
> = {
  override: {
    title: "Override plan",
    body: "Manually set this account’s plan. The override supersedes billing until removed.",
    confirm: "Apply override",
    busy: "Applying…",
    ok: "Applied",
    tone: "primary",
    plan: true,
  },
  suspend: {
    title: "Suspend account?",
    body: "This will immediately sign out the user and block all login until the account is unlocked.",
    confirm: "Suspend account",
    busy: "Suspending…",
    ok: "Suspended",
    tone: "danger",
  },
  delete: {
    title: "Schedule account deletion?",
    body: "The user will be permanently deleted in 30 days. They can be restored any time before then.",
    confirm: "Schedule deletion",
    busy: "Scheduling…",
    ok: "Scheduled",
    tone: "danger",
  },
  impersonate: {
    title: "View as this user?",
    body: "Start a read-only impersonation session. You’ll see exactly what the user sees; no changes can be made. The session is logged. In production the banner pins above the user’s own app.",
    confirm: "Start session",
    busy: "Starting…",
    ok: "Started",
    tone: "imp",
  },
};

const ERROR_LABELS: Record<string, string> = {
  REASON_REQUIRED: "A reason is required.",
  CANNOT_SUSPEND_ADMIN: "You can’t suspend another admin.",
  CANNOT_DELETE_ADMIN: "You can’t delete another admin.",
  CANNOT_IMPERSONATE_ADMIN: "You can’t impersonate another admin.",
  FORBIDDEN: "You don’t have permission to do that.",
  USER_NOT_FOUND: "This user no longer exists.",
  INVALID_PLAN: "Pick a valid plan.",
};

export function UserActions({
  userId,
  user,
  planLabel,
  overridden,
  overriddenLabel,
  suspended,
  deletionScheduled,
}: {
  userId: string;
  user: { name: string; email: string; plan: string };
  planLabel: string;
  overridden: boolean;
  overriddenLabel: string | null;
  suspended: boolean;
  deletionScheduled: boolean;
}) {
  const [dialog, setDialog] = useState<DialogKind | null>(null);
  const router = useRouter();
  const flash = useToast();

  const onDone = (kind: DialogKind, message: string) => {
    setDialog(null);
    flash(message);
    if (kind === "impersonate") {
      router.push("/contacts");
    } else {
      router.refresh();
    }
  };

  return (
    <aside className="ad-detail-actions">
      <div className="ad-actions-card">
        <div className="ad-actions-title">Actions</div>
        <div className="ad-actions-rule" />

        <div className="ad-action-block">
          <button
            className="ad-btn ad-btn--secondary ad-btn--full"
            onClick={() => setDialog("override")}
            disabled={suspended}
          >
            <AdIcon name="card" size={15} c="currentColor" />
            Override plan
          </button>
          <div className="ad-action-note">
            Current: <strong>{planLabel}</strong>
            {overridden && overriddenLabel && (
              <span className="ad-action-flag">
                <AdIcon name="flag" size={11} c={AD.blue} /> {overriddenLabel}
              </span>
            )}
          </div>
        </div>

        <div className="ad-action-block">
          <button
            className="ad-btn ad-btn--danger-outline ad-btn--full"
            onClick={() => setDialog("suspend")}
            disabled={suspended}
          >
            {suspended ? "Account suspended" : "Suspend account"}
          </button>
        </div>

        <div className="ad-action-block">
          <button
            className="ad-btn ad-btn--danger-outline ad-btn--full"
            onClick={() => setDialog("delete")}
            disabled={deletionScheduled}
          >
            {deletionScheduled ? "Deletion scheduled" : "Schedule deletion"}
          </button>
        </div>

        <div className="ad-actions-rule" />

        <div className="ad-action-block" style={{ marginBottom: 0 }}>
          <button
            className="ad-btn ad-btn--secondary ad-btn--full"
            onClick={() => setDialog("impersonate")}
            disabled={suspended}
          >
            <AdIcon name="eye" size={15} c="currentColor" />
            View as user
          </button>
          <div className="ad-action-note">
            Starts a read-only impersonation session. A banner pins above the user’s app while active.
          </div>
        </div>
      </div>

      {dialog && (
        <ConfirmDialog
          kind={dialog}
          userId={userId}
          user={user}
          onClose={() => setDialog(null)}
          onDone={onDone}
        />
      )}
    </aside>
  );
}

function ConfirmDialog({
  kind,
  userId,
  user,
  onClose,
  onDone,
}: {
  kind: DialogKind;
  userId: string;
  user: { name: string; email: string; plan: string };
  onClose: () => void;
  onDone: (kind: DialogKind, message: string) => void;
}) {
  const cfg = DIALOGS[kind];
  const [phase, setPhase] = useState<"idle" | "loading" | "success">("idle");
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState(user.plan);
  const [err, setErr] = useState<string | null>(null);
  const trap = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "loading") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  const needsReason = !reason.trim();

  const submit = async () => {
    if (needsReason || phase === "loading") return;
    setErr(null);
    setPhase("loading");

    let res: { success: true } | { error: string };
    if (kind === "override") res = await overridePlan({ userId, plan, reason });
    else if (kind === "suspend") res = await suspendAccount({ userId, reason });
    else if (kind === "delete") res = await adminDeleteAccount({ userId, reason });
    else res = await startImpersonation({ userId, reason });

    if ("error" in res) {
      setPhase("idle");
      setErr(ERROR_LABELS[res.error] ?? "Action failed — please try again.");
      return;
    }

    setPhase("success");
    const messages: Record<DialogKind, string> = {
      override: `Plan overridden to ${plan}`,
      suspend: `Suspended ${user.email}`,
      delete: `Deletion scheduled for ${user.email}`,
      impersonate: `Impersonating ${user.email}`,
    };
    setTimeout(() => onDone(kind, messages[kind]), 650);
  };

  const toneClass =
    cfg.tone === "danger" ? "ad-btn--danger" : cfg.tone === "imp" ? "ad-btn--imp" : "ad-btn--primary";

  return (
    <div className="ad-overlay" onClick={() => phase !== "loading" && onClose()}>
      <div
        className="ad-modal"
        ref={trap}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={cfg.title}
      >
        <div className="ad-modal-head">
          {kind === "impersonate" ? (
            <span className="ad-modal-glyph ad-modal-glyph--imp">
              <AdIcon name="eye" size={18} c="#fff" />
            </span>
          ) : cfg.tone === "danger" ? (
            <span className="ad-modal-glyph ad-modal-glyph--red">
              <AdIcon name="warn" size={18} c="#fff" />
            </span>
          ) : (
            <span className="ad-modal-glyph ad-modal-glyph--blue">
              <AdIcon name="card" size={18} c="#fff" />
            </span>
          )}
          <h2 className="ad-modal-title">{cfg.title}</h2>
        </div>

        <p className="ad-modal-body">{cfg.body}</p>

        <div className="ad-modal-user">
          <Avatar name={user.name} size={30} />
          <div style={{ minWidth: 0 }}>
            <div className="ad-modal-user-email">{user.email}</div>
            <div className="ad-modal-user-name">
              {user.name} · {user.plan}
            </div>
          </div>
        </div>

        {cfg.plan && (
          <div className="ad-modal-field">
            <label className="ad-field-label">Select plan</label>
            <div className="ad-select-wrap ad-select-wrap--block">
              <select className="ad-select" value={plan} onChange={(e) => setPlan(e.target.value)}>
                {["Free", "Pro", "Family", "Teams"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <AdIcon name="chevd" size={14} c={AD.mute} />
            </div>
          </div>
        )}

        <div className="ad-modal-field">
          <label className="ad-field-label">
            Reason <span className="ad-req">*</span>
          </label>
          <input
            className="ad-text-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              kind === "impersonate"
                ? "e.g. Investigating billing complaint #4821"
                : "Logged with this action"
            }
            autoFocus
          />
        </div>

        {err && (
          <div className="ad-modal-error">
            <AdIcon name="warn" size={15} c={AD.red} />
            <span>{err}</span>
          </div>
        )}

        <div className="ad-modal-foot">
          <button className="ad-btn ad-btn--secondary" onClick={onClose} disabled={phase === "loading"}>
            Cancel
          </button>
          <button
            className={`ad-btn ${toneClass}`}
            onClick={submit}
            data-phase={phase}
            disabled={phase === "loading" || needsReason}
          >
            {phase === "loading" && <AdIcon name="spinner" size={15} c="#fff" w={2} spin />}
            {phase === "success" && <AdIcon name="check" size={15} c="#fff" w={2.6} />}
            <span>{phase === "loading" ? cfg.busy : phase === "success" ? cfg.ok : cfg.confirm}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

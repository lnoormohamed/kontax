"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  previewProductBroadcastAudience,
  retractProductBroadcast,
  saveProductBroadcast,
  sendSavedProductBroadcast,
} from "~/app/actions/admin";
import { useToast } from "../_components/toast";

type BroadcastRow = {
  id: string;
  title: string;
  body: string;
  actionUrl: string | null;
  status: "DRAFT" | "SCHEDULED" | "SENT" | "RETRACTED";
  scheduledFor: Date | null;
  scheduledForLabel: string;
  sentAtLabel: string;
  retractedAtLabel: string;
  previewRecipientCount: number;
  deliveredRecipientCount: number | null;
  filters: {
    plans: string[];
    lifecycleStates: string[];
    providers: string[];
    featureFlagKeys: string[];
  };
  createdBy: string;
};

type FlagOption = {
  key: string;
  label: string;
};

const PLAN_OPTIONS = [
  { value: "FREE", label: "Free" },
  { value: "PRO", label: "Pro" },
  { value: "FAMILY", label: "Family" },
  { value: "TEAMS", label: "Teams" },
] as const;

const LIFECYCLE_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "TRIALING", label: "Trialing" },
  { value: "GRACE", label: "Grace" },
  { value: "LOCKED", label: "Locked" },
  { value: "CANCELED", label: "Canceled" },
] as const;

const PROVIDER_OPTIONS = [
  { value: "CARDDAV", label: "CardDAV" },
  { value: "GOOGLE", label: "Google" },
  { value: "MICROSOFT", label: "Outlook" },
] as const;

const STATUS_LABELS: Record<BroadcastRow["status"], string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  RETRACTED: "Retracted",
};

const ERRORS: Record<string, string> = {
  FORBIDDEN: "You don't have permission to manage broadcasts.",
  TITLE_REQUIRED: "Enter a title.",
  BODY_REQUIRED: "Enter a message body.",
  USER_NOT_FOUND: "That broadcast could not be found anymore.",
};

function toDatetimeLocalValue(date: Date | null) {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function FilterGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div className="ad-kv-k">{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {options.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              className="ad-btn ad-btn--sm"
              onClick={() => onToggle(option.value)}
              style={{
                border: `1px solid ${active ? "#4158f4" : "#d8ddd6"}`,
                background: active ? "#eef1fe" : "#fff",
                color: active ? "#3248db" : "#5c655e",
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BroadcastForm({
  broadcasts,
  flags,
}: {
  broadcasts: BroadcastRow[];
  flags: FlagOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [plans, setPlans] = useState<string[]>([]);
  const [lifecycleStates, setLifecycleStates] = useState<string[]>(["ACTIVE", "TRIALING", "GRACE"]);
  const [providers, setProviders] = useState<string[]>([]);
  const [featureFlagKeys, setFeatureFlagKeys] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [preview, setPreview] = useState<{ recipients: number; sample: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<"idle" | "preview" | "draft" | "schedule" | "send" | "retract">("idle");

  const activeBroadcast = useMemo(
    () => broadcasts.find((broadcast) => broadcast.id === activeId) ?? null,
    [broadcasts, activeId],
  );

  const toggle = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPreview(null);
  };

  const loadBroadcast = (broadcast: BroadcastRow) => {
    setActiveId(broadcast.id);
    setTitle(broadcast.title);
    setBody(broadcast.body);
    setActionUrl(broadcast.actionUrl ?? "");
    setPlans(broadcast.filters.plans ?? []);
    setLifecycleStates(
      broadcast.filters.lifecycleStates?.length
        ? broadcast.filters.lifecycleStates
        : ["ACTIVE", "TRIALING", "GRACE"],
    );
    setProviders(broadcast.filters.providers ?? []);
    setFeatureFlagKeys(broadcast.filters.featureFlagKeys ?? []);
    setScheduledFor(toDatetimeLocalValue(broadcast.scheduledFor));
    setPreview({
      recipients: broadcast.previewRecipientCount,
      sample: [],
    });
  };

  const resetForm = () => {
    setActiveId(null);
    setTitle("");
    setBody("");
    setActionUrl("");
    setPlans([]);
    setLifecycleStates(["ACTIVE", "TRIALING", "GRACE"]);
    setProviders([]);
    setFeatureFlagKeys([]);
    setScheduledFor("");
    setPreview(null);
  };

  const withResultToast = (error?: string) => {
    if (!error) return;
    toast(ERRORS[error] ?? "Something went wrong.");
  };

  const requestPreview = () => {
    setActionState("preview");
    startTransition(async () => {
      const result = await previewProductBroadcastAudience({
        plans,
        lifecycleStates,
        providers,
        featureFlagKeys,
      });
      if ("error" in result) {
        withResultToast(result.error);
        return;
      }
      setPreview({
        recipients: result.recipients ?? 0,
        sample: result.sample ?? [],
      });
      toast(`Preview loaded for ${result.recipients ?? 0} recipients.`);
    });
  };

  const save = (status: "DRAFT" | "SCHEDULED" | "SEND_NOW") => {
    setActionState(status === "DRAFT" ? "draft" : status === "SCHEDULED" ? "schedule" : "send");
    startTransition(async () => {
      const result = await saveProductBroadcast({
        broadcastId: activeId,
        title,
        body,
        actionUrl,
        plans,
        lifecycleStates,
        providers,
        featureFlagKeys,
        status,
        scheduledFor: status === "SCHEDULED" ? scheduledFor : null,
      });
      if ("error" in result) {
        withResultToast(result.error);
        return;
      }
      if (status === "SEND_NOW") {
        toast(`Broadcast sent to ${result.recipients ?? 0} recipients.`);
        resetForm();
      } else if (status === "SCHEDULED") {
        toast("Broadcast scheduled.");
        setActiveId(result.broadcastId ?? activeId);
      } else {
        toast("Broadcast draft saved.");
        setActiveId(result.broadcastId ?? activeId);
      }
      router.refresh();
    });
  };

  const sendExisting = (broadcastId: string) => {
    setActionState("send");
    startTransition(async () => {
      const result = await sendSavedProductBroadcast({ broadcastId });
      if ("error" in result) {
        withResultToast(result.error);
        return;
      }
      toast(`Broadcast sent to ${result.recipients ?? 0} recipients.`);
      router.refresh();
    });
  };

  const retractExisting = (broadcastId: string) => {
    setActionState("retract");
    startTransition(async () => {
      const result = await retractProductBroadcast({ broadcastId });
      if ("error" in result) {
        withResultToast(result.error);
        return;
      }
      toast("Broadcast retracted.");
      if (activeId === broadcastId) {
        resetForm();
      }
      router.refresh();
    });
  };

  const pendingLabel =
    actionState === "preview"
      ? "Previewing…"
      : actionState === "draft"
        ? "Saving draft…"
        : actionState === "schedule"
          ? "Scheduling…"
          : actionState === "send"
            ? "Sending…"
            : actionState === "retract"
              ? "Retracting…"
              : "Working…";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="ad-card" style={{ display: "grid", gap: 16 }}>
        <div className="ad-card-head" style={{ alignItems: "flex-start" }}>
          <div>
            <h2 className="ad-card-title">Targeted product broadcasts</h2>
            <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "#5c655e" }}>
              Build a draft, preview the audience, schedule it, or send it now. Sent and scheduled
              broadcasts can be retracted, which dismisses any still-visible in-app notices.
            </p>
          </div>
          {activeBroadcast ? (
            <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" onClick={resetForm}>
              New broadcast
            </button>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Title</span>
            <input
              className="ad-text-input"
              maxLength={120}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setPreview(null);
              }}
              placeholder="New: one-pass duplicate merge"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Message</span>
            <textarea
              className="ad-textarea"
              rows={4}
              maxLength={280}
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                setPreview(null);
              }}
              placeholder="Clean up duplicate contacts in a single review."
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Link</span>
            <input
              className="ad-text-input"
              value={actionUrl}
              onChange={(event) => {
                setActionUrl(event.target.value);
                setPreview(null);
              }}
              placeholder="/merge/manual"
            />
          </label>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <FilterGroup
            label="Plans"
            options={PLAN_OPTIONS.map((option) => ({ ...option }))}
            selected={plans}
            onToggle={(value) => toggle(value, plans, setPlans)}
          />
          <FilterGroup
            label="Lifecycle states"
            options={LIFECYCLE_OPTIONS.map((option) => ({ ...option }))}
            selected={lifecycleStates}
            onToggle={(value) => toggle(value, lifecycleStates, setLifecycleStates)}
          />
          <FilterGroup
            label="Connected providers"
            options={PROVIDER_OPTIONS.map((option) => ({ ...option }))}
            selected={providers}
            onToggle={(value) => toggle(value, providers, setProviders)}
          />
          {flags.length > 0 ? (
            <FilterGroup
              label="Feature-flag cohorts"
              options={flags.map((flag) => ({ value: flag.key, label: flag.label }))}
              selected={featureFlagKeys}
              onToggle={(value) => toggle(value, featureFlagKeys, setFeatureFlagKeys)}
            />
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Schedule for (UTC)</span>
            <input
              className="ad-text-input"
              type="datetime-local"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
            />
          </label>
          <div
            style={{
              border: "1px solid #eef1ee",
              borderRadius: 14,
              padding: "12px 14px",
              background: "#f8faf8",
              display: "grid",
              gap: 4,
            }}
          >
            <div className="ad-kv-k">Audience preview</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2823" }}>
              {preview?.recipients ?? activeBroadcast?.previewRecipientCount ?? 0}
            </div>
            <div style={{ fontSize: 13, color: "#5c655e" }}>
              {preview?.sample?.length
                ? `Examples: ${preview.sample.join(", ")}`
                : "Preview to see who would receive this broadcast."}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" disabled={isPending} onClick={requestPreview}>
            {isPending && actionState === "preview" ? pendingLabel : "Preview audience"}
          </button>
          <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" disabled={isPending} onClick={() => save("DRAFT")}>
            {isPending && actionState === "draft" ? pendingLabel : "Save draft"}
          </button>
          <button
            className="ad-btn ad-btn--ghost ad-btn--sm"
            type="button"
            disabled={isPending || scheduledFor.trim().length === 0}
            onClick={() => save("SCHEDULED")}
          >
            {isPending && actionState === "schedule" ? pendingLabel : "Schedule"}
          </button>
          <button className="ad-btn ad-btn--primary ad-btn--sm" type="button" disabled={isPending} onClick={() => save("SEND_NOW")}>
            {isPending && actionState === "send" ? pendingLabel : "Send now"}
          </button>
        </div>
      </section>

      <section className="ad-card">
        <div className="ad-card-head">
          <h3 className="ad-card-title">Broadcast history</h3>
        </div>
        <div className="ad-support-list">
          {broadcasts.length === 0 ? (
            <div className="ad-support-note">No broadcasts yet.</div>
          ) : (
            broadcasts.map((broadcast) => (
              <div key={broadcast.id} className="ad-support-list__row" style={{ display: "grid", gap: 10 }}>
                <div className="ad-support-list__main">
                  <div className="ad-support-list__title">{broadcast.title}</div>
                  <div className="ad-support-list__sub">
                    {STATUS_LABELS[broadcast.status]} · Preview {broadcast.previewRecipientCount}
                    {broadcast.deliveredRecipientCount != null ? ` · Delivered ${broadcast.deliveredRecipientCount}` : ""}
                  </div>
                  <div className="ad-support-list__body">
                    Created by {broadcast.createdBy}
                    {broadcast.scheduledFor ? ` · Scheduled ${broadcast.scheduledForLabel}` : ""}
                    {broadcast.status === "SENT" ? ` · Sent ${broadcast.sentAtLabel}` : ""}
                    {broadcast.status === "RETRACTED" ? ` · Retracted ${broadcast.retractedAtLabel}` : ""}
                  </div>
                  <div className="ad-support-list__body">{broadcast.body}</div>
                  <div className="ad-support-list__body">
                    Filters:
                    {" "}
                    {[
                      broadcast.filters.plans.length ? `plans ${broadcast.filters.plans.join(", ")}` : null,
                      broadcast.filters.lifecycleStates.length
                        ? `lifecycle ${broadcast.filters.lifecycleStates.join(", ")}`
                        : null,
                      broadcast.filters.providers.length
                        ? `providers ${broadcast.filters.providers.join(", ")}`
                        : null,
                      broadcast.filters.featureFlagKeys.length
                        ? `flags ${broadcast.filters.featureFlagKeys.join(", ")}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "All active/trialing/grace users"}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" onClick={() => loadBroadcast(broadcast)}>
                    Load into editor
                  </button>
                  {(broadcast.status === "DRAFT" || broadcast.status === "SCHEDULED") ? (
                    <button
                      className="ad-btn ad-btn--ghost ad-btn--sm"
                      type="button"
                      disabled={isPending}
                      onClick={() => sendExisting(broadcast.id)}
                    >
                      {isPending && actionState === "send" && activeId === broadcast.id ? pendingLabel : "Send now"}
                    </button>
                  ) : null}
                  {broadcast.status !== "RETRACTED" ? (
                    <button
                      className="ad-btn ad-btn--ghost ad-btn--sm"
                      type="button"
                      disabled={isPending}
                      onClick={() => retractExisting(broadcast.id)}
                    >
                      {isPending && actionState === "retract" && activeId === broadcast.id ? pendingLabel : "Retract"}
                    </button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

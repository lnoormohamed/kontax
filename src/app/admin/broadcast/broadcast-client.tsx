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
  createdAtLabel: string;
  scheduledFor: Date | null;
  scheduledForLabel: string;
  sentAtLabel: string;
  retractedAtLabel: string;
  previewRecipientCount: number;
  deliveredRecipientCount: number | null;
  audienceSample: string[];
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

type BroadcastTemplate = {
  id: string;
  label: string;
  summary: string;
  title: string;
  body: string;
  actionUrl: string;
};

const DEFAULT_LIFECYCLE_STATES = ["ACTIVE", "TRIALING", "GRACE"] as const;
const BROAD_AUDIENCE_THRESHOLD = 250;
const MIN_SCHEDULE_LEAD_MS = 5 * 60 * 1000;

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

const TEMPLATES: BroadcastTemplate[] = [
  {
    id: "release-note",
    label: "Release note",
    summary: "Announce a shipped feature or workflow improvement.",
    title: "New: [feature name]",
    body: "[One sentence on what changed and why it helps.]",
    actionUrl: "/changelog",
  },
  {
    id: "incident",
    label: "Incident",
    summary: "Explain degraded provider behavior and what users should expect.",
    title: "Provider incident: [provider] delays",
    body: "We're investigating degraded sync behavior for [provider]. Your data is safe and we'll update you here when service is stable again.",
    actionUrl: "/status",
  },
  {
    id: "billing",
    label: "Billing notice",
    summary: "Guide users through payment, renewal, or lifecycle action.",
    title: "Billing action needed: [summary]",
    body: "We need your attention on a billing-related issue. Review the details below to avoid interruption.",
    actionUrl: "/settings",
  },
  {
    id: "maintenance",
    label: "Maintenance",
    summary: "Set expectations for scheduled downtime or short-lived impact.",
    title: "Scheduled maintenance: [window]",
    body: "Kontax will undergo scheduled maintenance during [window]. Some sync actions may be delayed until the window closes.",
    actionUrl: "/status",
  },
];

const STATUS_LABELS: Record<BroadcastRow["status"], string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  SENT: "Sent",
  RETRACTED: "Retracted",
};

const STATUS_STYLES: Record<BroadcastRow["status"], { bg: string; fg: string; dot: string }> = {
  DRAFT: { bg: "#f4f6f2", fg: "#405046", dot: "#8b938c" },
  SCHEDULED: { bg: "#fff7e8", fg: "#a16207", dot: "#f59e0b" },
  SENT: { bg: "#eef8f1", fg: "#18794e", dot: "#22c55e" },
  RETRACTED: { bg: "#fff0f0", fg: "#b42318", dot: "#ef4444" },
};

const ERRORS: Record<string, string> = {
  FORBIDDEN: "You don't have permission to manage broadcasts.",
  TITLE_REQUIRED: "Enter a title.",
  BODY_REQUIRED: "Enter a message body.",
  USER_NOT_FOUND: "That broadcast could not be found anymore.",
  SCHEDULE_REQUIRED: "Choose a schedule time before saving a scheduled broadcast.",
  SCHEDULE_INVALID: "That schedule time could not be understood.",
  SCHEDULE_IN_PAST: "Scheduled broadcasts must be set in the future.",
  SCHEDULE_TOO_SOON: "Scheduled broadcasts need at least 5 minutes of lead time.",
};

function toDatetimeLocalValue(date: Date | null) {
  if (!date) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

function parseUtcDatetimeLocalValue(value: string) {
  const trimmed = value.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatUtcDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function isDefaultLifecycleSelection(values: string[]) {
  return (
    values.length === DEFAULT_LIFECYCLE_STATES.length &&
    DEFAULT_LIFECYCLE_STATES.every((value) => values.includes(value))
  );
}

function formatLifecycleState(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(" ");
}

function formatProvider(value: string) {
  if (value === "CARDDAV") return "CardDAV";
  if (value === "GOOGLE") return "Google";
  if (value === "MICROSOFT") return "Outlook";
  return value;
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

function BroadcastStatusPill({ status }: { status: BroadcastRow["status"] }) {
  const c = STATUS_STYLES[status];
  return (
    <span className="ad-pill" style={{ background: c.bg, color: c.fg }}>
      <span className="ad-dot" style={{ background: c.dot }} />
      {STATUS_LABELS[status]}
    </span>
  );
}

function SummaryChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "warning" | "success";
}) {
  const colors =
    tone === "warning"
      ? { bg: "#fff7e8", fg: "#a16207" }
      : tone === "success"
        ? { bg: "#eef8f1", fg: "#18794e" }
        : { bg: "#f4f6f2", fg: "#405046" };

  return (
    <span className="ad-pill" style={{ background: colors.bg, color: colors.fg }}>
      {label}
    </span>
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
  const [lifecycleStates, setLifecycleStates] = useState<string[]>([...DEFAULT_LIFECYCLE_STATES]);
  const [providers, setProviders] = useState<string[]>([]);
  const [featureFlagKeys, setFeatureFlagKeys] = useState<string[]>([]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [preview, setPreview] = useState<{ recipients: number; sample: string[] } | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [editorLabel, setEditorLabel] = useState("New draft");
  const [busyBroadcastId, setBusyBroadcastId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionState, setActionState] = useState<"idle" | "preview" | "draft" | "schedule" | "send" | "retract">("idle");

  const flagsByKey = useMemo(
    () =>
      Object.fromEntries(flags.map((flag) => [flag.key, flag.label] as const)) as Record<string, string>,
    [flags],
  );

  const activeBroadcast = useMemo(
    () => broadcasts.find((broadcast) => broadcast.id === activeId) ?? null,
    [broadcasts, activeId],
  );

  const selectedTemplate = useMemo(
    () => TEMPLATES.find((template) => template.id === templateId) ?? null,
    [templateId],
  );

  const audienceDescription = useMemo(() => {
    const segments: string[] = [];
    if (plans.length > 0) segments.push(`${plans.map((plan) => PLAN_OPTIONS.find((option) => option.value === plan)?.label ?? plan).join(", ")} plans`);
    if (!isDefaultLifecycleSelection(lifecycleStates)) {
      segments.push(`${lifecycleStates.map(formatLifecycleState).join(", ")} lifecycle states`);
    }
    if (providers.length > 0) segments.push(`${providers.map(formatProvider).join(", ")} providers`);
    if (featureFlagKeys.length > 0) {
      segments.push(
        `${featureFlagKeys.map((key) => flagsByKey[key] ?? key).join(", ")} flag cohorts`,
      );
    }
    return segments.join(" · ") || "All active, trialing, and grace users";
  }, [featureFlagKeys, flagsByKey, lifecycleStates, plans, providers]);

  const audienceChips = useMemo(() => {
    const chips: Array<{ label: string; tone?: "neutral" | "warning" | "success" }> = [];
    if (plans.length > 0) chips.push({ label: `${plans.length} plan ${plans.length === 1 ? "filter" : "filters"}`, tone: "success" });
    if (!isDefaultLifecycleSelection(lifecycleStates)) {
      chips.push({ label: `${lifecycleStates.length} lifecycle state${lifecycleStates.length === 1 ? "" : "s"}` });
    }
    if (providers.length > 0) chips.push({ label: `${providers.length} provider ${providers.length === 1 ? "filter" : "filters"}`, tone: "success" });
    if (featureFlagKeys.length > 0) chips.push({ label: `${featureFlagKeys.length} flag cohort${featureFlagKeys.length === 1 ? "" : "s"}`, tone: "success" });
    if (chips.length === 0) {
      chips.push({ label: "Broad default audience", tone: "warning" });
    }
    return chips;
  }, [featureFlagKeys.length, lifecycleStates, plans.length, providers.length]);

  const previewRecipients = preview?.recipients ?? activeBroadcast?.previewRecipientCount ?? 0;
  const previewSample = preview?.sample?.length ? preview.sample : activeBroadcast?.audienceSample ?? [];

  const scheduledDate = useMemo(() => parseUtcDatetimeLocalValue(scheduledFor), [scheduledFor]);
  const scheduleIssue = useMemo(() => {
    if (!scheduledFor.trim()) return null;
    if (!scheduledDate) return "That schedule time could not be understood.";

    const delta = scheduledDate.getTime() - Date.now();
    if (delta <= 0) return "This schedule is in the past.";
    if (delta < MIN_SCHEDULE_LEAD_MS) return "Schedules need at least 5 minutes of lead time.";
    return null;
  }, [scheduledDate, scheduledFor]);

  const isBroadAudience =
    previewRecipients >= BROAD_AUDIENCE_THRESHOLD ||
    (plans.length === 0 && providers.length === 0 && featureFlagKeys.length === 0 && isDefaultLifecycleSelection(lifecycleStates));

  const safetyWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (isBroadAudience) {
      warnings.push(
        previewRecipients >= BROAD_AUDIENCE_THRESHOLD
          ? `This send currently reaches about ${previewRecipients.toLocaleString()} recipients.`
          : "This send currently targets the broad default audience with no narrowing filters.",
      );
    }
    if (scheduleIssue) warnings.push(scheduleIssue);
    return warnings;
  }, [isBroadAudience, previewRecipients, scheduleIssue]);

  const toggle = (value: string, current: string[], setter: (next: string[]) => void) => {
    setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPreview(null);
  };

  const populateComposer = (
    broadcast: Pick<
      BroadcastRow,
      "id" | "title" | "body" | "actionUrl" | "filters" | "scheduledFor" | "previewRecipientCount" | "audienceSample"
    >,
    mode: "edit" | "duplicate",
  ) => {
    setActiveId(mode === "edit" ? broadcast.id : null);
    setEditorLabel(mode === "edit" ? `Editing ${broadcast.title}` : `New draft from ${broadcast.title}`);
    setTemplateId(null);
    setTitle(broadcast.title);
    setBody(broadcast.body);
    setActionUrl(broadcast.actionUrl ?? "");
    setPlans(broadcast.filters.plans ?? []);
    setLifecycleStates(
      broadcast.filters.lifecycleStates?.length
        ? broadcast.filters.lifecycleStates
        : [...DEFAULT_LIFECYCLE_STATES],
    );
    setProviders(broadcast.filters.providers ?? []);
    setFeatureFlagKeys(broadcast.filters.featureFlagKeys ?? []);
    setScheduledFor(mode === "edit" ? toDatetimeLocalValue(broadcast.scheduledFor) : "");
    setPreview({
      recipients: broadcast.previewRecipientCount,
      sample: broadcast.audienceSample ?? [],
    });
  };

  const resetForm = () => {
    setActiveId(null);
    setEditorLabel("New draft");
    setTemplateId(null);
    setTitle("");
    setBody("");
    setActionUrl("");
    setPlans([]);
    setLifecycleStates([...DEFAULT_LIFECYCLE_STATES]);
    setProviders([]);
    setFeatureFlagKeys([]);
    setScheduledFor("");
    setPreview(null);
  };

  const applyTemplate = (template: BroadcastTemplate) => {
    setActiveId(null);
    setEditorLabel(`New ${template.label.toLowerCase()} draft`);
    setTemplateId(template.id);
    setTitle(template.title);
    setBody(template.body);
    setActionUrl(template.actionUrl);
    setPlans([]);
    setLifecycleStates([...DEFAULT_LIFECYCLE_STATES]);
    setProviders([]);
    setFeatureFlagKeys([]);
    setScheduledFor("");
    setPreview(null);
    toast(`${template.label} template loaded.`);
  };

  const duplicateBroadcast = (broadcast: BroadcastRow) => {
    populateComposer(broadcast, "duplicate");
    toast("Loaded as a new draft. Schedule cleared so you can confirm timing.");
  };

  const withResultToast = (error?: string) => {
    if (!error) return;
    toast(ERRORS[error] ?? "Something went wrong.");
  };

  const confirmSendNow = () => {
    return window.confirm(
      [
        "Send this broadcast now?",
        `${previewRecipients.toLocaleString()} recipients will receive an in-app notice immediately.`,
        `Audience: ${audienceDescription}.`,
        previewSample.length > 0 ? `Examples: ${previewSample.join(", ")}` : null,
        isBroadAudience ? "Warning: this is a broad audience send." : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
  };

  const confirmSchedule = () => {
    if (!scheduledDate) return false;
    return window.confirm(
      [
        "Schedule this broadcast?",
        `It will be queued for ${formatUtcDate(scheduledDate)} UTC.`,
        `Audience: ${audienceDescription}.`,
        isBroadAudience ? "Warning: this is a broad audience send." : null,
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
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
    if ((status === "SCHEDULED" || status === "SEND_NOW") && preview === null && activeBroadcast === null) {
      toast("Preview the audience before scheduling or sending.");
      return;
    }
    if (status === "SCHEDULED" && scheduleIssue) {
      toast(scheduleIssue);
      return;
    }
    if (status === "SEND_NOW" && !confirmSendNow()) {
      return;
    }
    if (status === "SCHEDULED" && !confirmSchedule()) {
      return;
    }

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
        scheduledFor: status === "SCHEDULED" ? scheduledDate?.toISOString() ?? null : null,
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

  const sendExisting = (broadcast: BroadcastRow) => {
    if (
      !window.confirm(
        [
          `Send "${broadcast.title}" now?`,
          `${broadcast.previewRecipientCount.toLocaleString()} recipients are currently in scope.`,
          broadcast.audienceSample.length > 0 ? `Examples: ${broadcast.audienceSample.join(", ")}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      )
    ) {
      return;
    }

    setBusyBroadcastId(broadcast.id);
    setActionState("send");
    startTransition(async () => {
      const result = await sendSavedProductBroadcast({ broadcastId: broadcast.id });
      setBusyBroadcastId(null);
      if ("error" in result) {
        withResultToast(result.error);
        return;
      }
      toast(`Broadcast sent to ${result.recipients ?? 0} recipients.`);
      router.refresh();
    });
  };

  const retractExisting = (broadcast: BroadcastRow) => {
    const impactCount = broadcast.deliveredRecipientCount ?? broadcast.previewRecipientCount;
    if (
      !window.confirm(
        [
          `Retract "${broadcast.title}"?`,
          `Any still-visible in-app notices from this broadcast will be dismissed for up to ${impactCount.toLocaleString()} recipients.`,
          broadcast.status === "SCHEDULED"
            ? "This also prevents the scheduled send from going out."
            : "Use this when the message should no longer remain visible to users.",
        ].join("\n\n"),
      )
    ) {
      return;
    }

    setBusyBroadcastId(broadcast.id);
    setActionState("retract");
    startTransition(async () => {
      const result = await retractProductBroadcast({ broadcastId: broadcast.id });
      setBusyBroadcastId(null);
      if ("error" in result) {
        withResultToast(result.error);
        return;
      }
      toast("Broadcast retracted.");
      if (activeId === broadcast.id) {
        resetForm();
      }
      router.refresh();
    });
  };

  const pendingLabel =
    actionState === "preview"
      ? "Previewing..."
      : actionState === "draft"
        ? "Saving draft..."
        : actionState === "schedule"
          ? "Scheduling..."
          : actionState === "send"
            ? "Sending..."
            : actionState === "retract"
              ? "Retracting..."
              : "Working...";

  const composerDisabled = isPending || title.trim().length === 0 || body.trim().length === 0;

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <section className="ad-card" style={{ display: "grid", gap: 16 }}>
        <div className="ad-card-head" style={{ alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              <SummaryChip label={editorLabel} tone={activeBroadcast ? "warning" : "neutral"} />
              {selectedTemplate ? <SummaryChip label={`${selectedTemplate.label} template`} tone="success" /> : null}
            </div>
            <h2 className="ad-card-title">Targeted product broadcasts</h2>
            <p style={{ marginTop: 6, fontSize: 13, lineHeight: 1.5, color: "#5c655e" }}>
              Build a draft, preview the audience, schedule it, or send it now. Sent and scheduled
              broadcasts can be retracted, which dismisses any still-visible in-app notices.
            </p>
          </div>
          {(activeBroadcast || title || body || actionUrl || templateId) ? (
            <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" onClick={resetForm}>
              New broadcast
            </button>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <div className="ad-kv-k">Templates</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                className="ad-btn"
                onClick={() => applyTemplate(template)}
                style={{
                  height: "auto",
                  justifyContent: "flex-start",
                  alignItems: "flex-start",
                  padding: "14px 16px",
                  borderColor: templateId === template.id ? "#4158f4" : "#e1e6df",
                  background: templateId === template.id ? "#eef1fe" : "#fff",
                  textAlign: "left",
                  whiteSpace: "normal",
                }}
              >
                <div style={{ display: "grid", gap: 4, minWidth: 0, width: "100%" }}>
                  <strong style={{ color: "#1d2823" }}>{template.label}</strong>
                  <span style={{ fontSize: 13, color: "#5c655e", lineHeight: 1.45, whiteSpace: "normal" }}>
                    {template.summary}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Title</span>
            <input
              className="ad-text-input"
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
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
              onChange={(event) => setBody(event.target.value)}
              placeholder="Clean up duplicate contacts in a single review."
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Link</span>
            <input
              className="ad-text-input"
              value={actionUrl}
              onChange={(event) => setActionUrl(event.target.value)}
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
            <span style={{ fontSize: 12, color: scheduleIssue ? "#b42318" : "#5c655e" }}>
              {scheduleIssue ?? "Scheduled sends need at least 5 minutes of lead time."}
            </span>
          </label>
          <div
            style={{
              border: "1px solid #eef1ee",
              borderRadius: 14,
              padding: "12px 14px",
              background: "#f8faf8",
              display: "grid",
              gap: 6,
            }}
          >
            <div className="ad-kv-k">Audience summary</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#1d2823" }}>
              {previewRecipients.toLocaleString()}
            </div>
            <div style={{ fontSize: 13, color: "#5c655e", lineHeight: 1.5 }}>{audienceDescription}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {audienceChips.map((chip) => (
                <SummaryChip key={chip.label} label={chip.label} tone={chip.tone} />
              ))}
            </div>
            <div style={{ fontSize: 13, color: "#5c655e" }}>
              {previewSample.length > 0
                ? `Examples: ${previewSample.join(", ")}`
                : "Preview to see who would receive this broadcast."}
            </div>
          </div>
        </div>

        {safetyWarnings.length > 0 ? (
          <div
            style={{
              display: "grid",
              gap: 8,
              border: "1px solid #fde2b8",
              background: "#fff9ef",
              borderRadius: 14,
              padding: "12px 14px",
            }}
          >
            <div className="ad-kv-k" style={{ color: "#9a6700" }}>
              Safety checks
            </div>
            {safetyWarnings.map((warning) => (
              <div key={warning} style={{ fontSize: 13, lineHeight: 1.5, color: "#7a5500" }}>
                {warning}
              </div>
            ))}
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" disabled={isPending} onClick={requestPreview}>
            {isPending && actionState === "preview" ? pendingLabel : "Preview audience"}
          </button>
          <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" disabled={composerDisabled} onClick={() => save("DRAFT")}>
            {isPending && actionState === "draft" ? pendingLabel : "Save draft"}
          </button>
          <button
            className="ad-btn ad-btn--ghost ad-btn--sm"
            type="button"
            disabled={composerDisabled || scheduledFor.trim().length === 0 || Boolean(scheduleIssue)}
            onClick={() => save("SCHEDULED")}
          >
            {isPending && actionState === "schedule" ? pendingLabel : "Schedule"}
          </button>
          <button className="ad-btn ad-btn--primary ad-btn--sm" type="button" disabled={composerDisabled} onClick={() => save("SEND_NOW")}>
            {isPending && actionState === "send" ? pendingLabel : "Send now"}
          </button>
        </div>
      </section>

      <section className="ad-card">
        <div className="ad-card-head" style={{ alignItems: "flex-start" }}>
          <div>
            <h3 className="ad-card-title">Broadcast history</h3>
            <p style={{ marginTop: 6, fontSize: 13, color: "#5c655e", lineHeight: 1.5 }}>
              Drafts and scheduled sends stay editable. Sent or retracted broadcasts can be duplicated
              into a new draft without mutating the original audit trail.
            </p>
          </div>
        </div>
        <div className="ad-support-list">
          {broadcasts.length === 0 ? (
            <div className="ad-support-note">No broadcasts yet.</div>
          ) : (
            broadcasts.map((broadcast) => {
              const rowBusy = busyBroadcastId === broadcast.id;
              return (
                <div key={broadcast.id} className="ad-support-list__row" style={{ display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div className="ad-support-list__main">
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div className="ad-support-list__title">{broadcast.title}</div>
                        <BroadcastStatusPill status={broadcast.status} />
                      </div>
                      <div className="ad-support-list__sub">
                        Preview {broadcast.previewRecipientCount.toLocaleString()}
                        {broadcast.deliveredRecipientCount != null ? ` · Delivered ${broadcast.deliveredRecipientCount.toLocaleString()}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {(broadcast.status === "DRAFT" || broadcast.status === "SCHEDULED") ? (
                        <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" onClick={() => populateComposer(broadcast, "edit")}>
                          Edit
                        </button>
                      ) : null}
                      <button className="ad-btn ad-btn--ghost ad-btn--sm" type="button" onClick={() => duplicateBroadcast(broadcast)}>
                        Duplicate as new
                      </button>
                      {(broadcast.status === "DRAFT" || broadcast.status === "SCHEDULED") ? (
                        <button
                          className="ad-btn ad-btn--ghost ad-btn--sm"
                          type="button"
                          disabled={isPending}
                          onClick={() => sendExisting(broadcast)}
                        >
                          {rowBusy && actionState === "send" ? pendingLabel : "Send now"}
                        </button>
                      ) : null}
                      {broadcast.status !== "RETRACTED" ? (
                        <button
                          className="ad-btn ad-btn--ghost ad-btn--sm"
                          type="button"
                          disabled={isPending}
                          onClick={() => retractExisting(broadcast)}
                        >
                          {rowBusy && actionState === "retract" ? pendingLabel : "Retract"}
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="ad-support-list__body">
                    Created {broadcast.createdAtLabel} by {broadcast.createdBy}
                    {broadcast.scheduledFor ? ` · Scheduled ${broadcast.scheduledForLabel}` : ""}
                    {broadcast.status === "SENT" ? ` · Sent ${broadcast.sentAtLabel}` : ""}
                    {broadcast.status === "RETRACTED" ? ` · Retracted ${broadcast.retractedAtLabel}` : ""}
                  </div>

                  <div className="ad-support-list__body" style={{ color: "#1d2823" }}>
                    {broadcast.body}
                  </div>

                  {broadcast.actionUrl ? (
                    <div className="ad-support-list__body">Link: {broadcast.actionUrl}</div>
                  ) : null}

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {broadcast.filters.plans.length > 0 ? (
                      <SummaryChip
                        label={`Plans: ${broadcast.filters.plans.map((plan) => PLAN_OPTIONS.find((option) => option.value === plan)?.label ?? plan).join(", ")}`}
                        tone="success"
                      />
                    ) : null}
                    {broadcast.filters.lifecycleStates.length > 0 ? (
                      <SummaryChip
                        label={`Lifecycle: ${broadcast.filters.lifecycleStates.map(formatLifecycleState).join(", ")}`}
                      />
                    ) : null}
                    {broadcast.filters.providers.length > 0 ? (
                      <SummaryChip
                        label={`Providers: ${broadcast.filters.providers.map(formatProvider).join(", ")}`}
                        tone="success"
                      />
                    ) : null}
                    {broadcast.filters.featureFlagKeys.length > 0 ? (
                      <SummaryChip
                        label={`Flags: ${broadcast.filters.featureFlagKeys.map((key) => flagsByKey[key] ?? key).join(", ")}`}
                        tone="success"
                      />
                    ) : null}
                    {broadcast.filters.plans.length === 0 &&
                    broadcast.filters.providers.length === 0 &&
                    broadcast.filters.featureFlagKeys.length === 0 &&
                    isDefaultLifecycleSelection(broadcast.filters.lifecycleStates) ? (
                      <SummaryChip label="Broad default audience" tone="warning" />
                    ) : null}
                  </div>

                  {broadcast.audienceSample.length > 0 ? (
                    <div className="ad-support-list__body">
                      Audience examples: {broadcast.audienceSample.join(", ")}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

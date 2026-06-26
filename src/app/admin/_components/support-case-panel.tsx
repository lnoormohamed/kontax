"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  createAdminSupportCase,
  updateAdminSupportCase,
} from "~/app/actions/admin";
import { useToast } from "./toast";

type SupportCaseRow = {
  id: string;
  title: string;
  summary: string | null;
  status: string;
  statusLabel: string;
  severity: string;
  severityLabel: string;
  owner: string;
  createdBy: string;
  updatedWhen: string;
  nextFollowUpIso: string;
  nextFollowUpLabel: string;
  resolvedAtLabel: string;
};

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "WAITING_ON_CUSTOMER", label: "Waiting on customer" },
  { value: "WAITING_ON_PROVIDER", label: "Waiting on provider" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

function toDatetimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

export function SupportCasePanel({
  subjectType,
  subjectId,
  targetUserId,
  cases,
}: {
  subjectType: string;
  subjectId: string;
  targetUserId?: string | null;
  cases: SupportCaseRow[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [createPending, startCreate] = useTransition();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [severity, setSeverity] = useState("NORMAL");
  const [status, setStatus] = useState("OPEN");
  const [nextFollowUpAt, setNextFollowUpAt] = useState("");
  const [assignToSelf, setAssignToSelf] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, { summary: string; severity: string; status: string; nextFollowUpAt: string }>>(
    () =>
      Object.fromEntries(
        cases.map((supportCase) => [
          supportCase.id,
          {
            summary: supportCase.summary ?? "",
            severity: supportCase.severity,
            status: supportCase.status,
            nextFollowUpAt: toDatetimeLocalValue(supportCase.nextFollowUpIso),
          },
        ]),
      ),
  );
  const [, startSave] = useTransition();

  const canCreate = useMemo(() => title.trim().length > 0, [title]);

  const createCase = () => {
    if (!canCreate) return;
    startCreate(async () => {
      const result = await createAdminSupportCase({
        subjectType,
        subjectId,
        targetUserId: targetUserId ?? null,
        title,
        summary,
        severity,
        status,
        nextFollowUpAt: nextFollowUpAt || null,
        assignToSelf,
      });
      if ("error" in result) {
        toast("Couldn’t create the support case.");
        return;
      }
      setTitle("");
      setSummary("");
      setSeverity("NORMAL");
      setStatus("OPEN");
      setNextFollowUpAt("");
      setAssignToSelf(true);
      toast("Support case created");
      router.refresh();
    });
  };

  const saveCase = (
    supportCaseId: string,
    assignmentMode: "keep" | "assign" | "clear" = "keep",
  ) => {
    const draft = drafts[supportCaseId];
    if (!draft) return;
    startSave(async () => {
      const result = await updateAdminSupportCase({
        supportCaseId,
        summary: draft.summary,
        severity: draft.severity,
        status: draft.status,
        nextFollowUpAt: draft.nextFollowUpAt || null,
        assignToSelf: assignmentMode === "assign",
        clearAssignment: assignmentMode === "clear",
      });
      if ("error" in result) {
        toast("Couldn’t update the support case.");
        return;
      }
      toast(
        assignmentMode === "clear"
          ? "Support case unassigned"
          : assignmentMode === "assign"
            ? "Support case assigned to you"
            : "Support case updated",
      );
      router.refresh();
    });
  };

  return (
    <section className="ad-card">
      <div className="ad-card-head">
        <h3 className="ad-card-title">Support cases</h3>
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "0 0 14px",
          borderBottom: "1px solid #eef1ee",
          marginBottom: 14,
        }}
      >
        <input
          className="ad-text-input"
          placeholder="Case title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <textarea
          className="ad-textarea"
          rows={3}
          placeholder="What’s the issue, what’s blocked, and what should the next admin know?"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
        />
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Status</span>
            <select className="ad-text-input" value={status} onChange={(event) => setStatus(event.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Severity</span>
            <select className="ad-text-input" value={severity} onChange={(event) => setSeverity(event.target.value)}>
              {SEVERITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="ad-kv-k">Next follow-up (UTC)</span>
            <input
              className="ad-text-input"
              type="datetime-local"
              value={nextFollowUpAt}
              onChange={(event) => setNextFollowUpAt(event.target.value)}
            />
          </label>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#5c655e" }}>
          <input
            type="checkbox"
            checked={assignToSelf}
            onChange={(event) => setAssignToSelf(event.target.checked)}
          />
          Assign this case to me
        </label>
        <div>
          <button className="ad-btn ad-btn--primary ad-btn--sm" disabled={createPending || !canCreate} onClick={createCase} type="button">
            {createPending ? "Creating…" : "Create support case"}
          </button>
        </div>
      </div>

      <div className="ad-support-list">
        {cases.length === 0 ? (
          <div className="ad-support-note">No support cases yet for this record.</div>
        ) : (
          cases.map((supportCase) => {
            const draft = drafts[supportCase.id] ?? {
              summary: supportCase.summary ?? "",
              severity: supportCase.severity,
              status: supportCase.status,
              nextFollowUpAt: toDatetimeLocalValue(supportCase.nextFollowUpIso),
            };
            return (
              <div key={supportCase.id} className="ad-support-list__row" style={{ display: "grid", gap: 12 }}>
                <div className="ad-support-list__main">
                  <div className="ad-support-list__title">{supportCase.title}</div>
                  <div className="ad-support-list__sub">
                    {supportCase.statusLabel} · {supportCase.severityLabel} · Owner {supportCase.owner}
                  </div>
                  <div className="ad-support-list__body">
                    Created by {supportCase.createdBy} · Updated {supportCase.updatedWhen}
                  </div>
                  <div className="ad-support-list__body">
                    Next follow-up {supportCase.nextFollowUpLabel}
                    {supportCase.resolvedAtLabel !== "—" ? ` · Resolved ${supportCase.resolvedAtLabel}` : ""}
                  </div>
                </div>

                <textarea
                  className="ad-textarea"
                  rows={3}
                  value={draft.summary}
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [supportCase.id]: { ...draft, summary: event.target.value },
                    }))
                  }
                />
                <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                  <select
                    className="ad-text-input"
                    value={draft.status}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [supportCase.id]: { ...draft, status: event.target.value },
                      }))
                    }
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="ad-text-input"
                    value={draft.severity}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [supportCase.id]: { ...draft, severity: event.target.value },
                      }))
                    }
                  >
                    {SEVERITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className="ad-text-input"
                    type="datetime-local"
                    value={draft.nextFollowUpAt}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [supportCase.id]: { ...draft, nextFollowUpAt: event.target.value },
                      }))
                    }
                  />
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="ad-btn ad-btn--primary ad-btn--sm" onClick={() => saveCase(supportCase.id, "keep")} type="button">
                    Save case
                  </button>
                  <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => saveCase(supportCase.id, "assign")} type="button">
                    Assign to me
                  </button>
                  <button className="ad-btn ad-btn--ghost ad-btn--sm" onClick={() => saveCase(supportCase.id, "clear")} type="button">
                    Unassign
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

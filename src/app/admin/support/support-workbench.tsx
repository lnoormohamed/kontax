"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { updateAdminSupportCase } from "~/app/actions/admin";
import {
  SUPPORT_CASE_SEVERITY_OPTIONS,
  SUPPORT_CASE_STATUS_OPTIONS,
  toSupportCaseDatetimeLocalValue,
} from "../_components/support-case-shared";
import { useToast } from "../_components/toast";

type SupportWorkbenchRow = {
  id: string;
  subjectType: string;
  subjectId: string;
  subjectLabel: string;
  target: string;
  targetDetail: string;
  targetHref: string | null;
  title: string;
  summary: string | null;
  status: string;
  statusLabel: string;
  severity: string;
  severityLabel: string;
  owner: string;
  ownerState: "me" | "assigned" | "unassigned";
  createdBy: string;
  updatedWhen: string;
  nextFollowUpIso: string;
  nextFollowUpLabel: string;
  followUpState: "none" | "scheduled" | "due_today" | "overdue";
  resolvedAtLabel: string;
};

type DraftState = {
  summary: string;
  severity: string;
  status: string;
  nextFollowUpAt: string;
};

function buildDrafts(rows: SupportWorkbenchRow[]) {
  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        summary: row.summary ?? "",
        severity: row.severity,
        status: row.status,
        nextFollowUpAt: toSupportCaseDatetimeLocalValue(row.nextFollowUpIso),
      },
    ]),
  ) as Record<string, DraftState>;
}

export function SupportWorkbench({ rows }: { rows: SupportWorkbenchRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, DraftState>>(() => buildDrafts(rows));
  const [pendingCaseId, setPendingCaseId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDrafts(buildDrafts(rows));
  }, [rows]);

  const saveCase = (supportCaseId: string, assignmentMode: "keep" | "assign" | "clear" = "keep") => {
    const draft = drafts[supportCaseId];
    if (!draft) return;
    setPendingCaseId(supportCaseId);
    startTransition(async () => {
      const result = await updateAdminSupportCase({
        supportCaseId,
        summary: draft.summary,
        severity: draft.severity,
        status: draft.status,
        nextFollowUpAt: draft.nextFollowUpAt || null,
        assignToSelf: assignmentMode === "assign",
        clearAssignment: assignmentMode === "clear",
      });
      setPendingCaseId(null);
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
    <section className="ad-card ad-support-workbench">
      <div className="ad-card-head">
        <h3 className="ad-card-title">Queue workbench</h3>
      </div>

      {rows.length === 0 ? (
        <div className="ad-table-state ad-table-state--compact">
          <div className="ad-state-title">No support cases match the current queue.</div>
          <div className="ad-state-sub">
            Try a different saved queue or loosen one of the active filters.
          </div>
        </div>
      ) : (
        <div className="ad-support-workbench__list">
          {rows.map((row) => {
            const draft = drafts[row.id];
            const rowPending = isPending && pendingCaseId === row.id;

            return (
              <article key={row.id} className="ad-support-workbench__row">
                <div className="ad-support-workbench__head">
                  <div className="ad-support-workbench__title-block">
                    <div className="ad-support-workbench__eyebrow">
                      <span>{row.subjectLabel}</span>
                      <span>Created by {row.createdBy}</span>
                      <span>Updated {row.updatedWhen}</span>
                    </div>
                    <h4 className="ad-support-workbench__title">{row.title}</h4>
                    <div className="ad-support-workbench__target">
                      {row.targetHref ? (
                        <Link href={row.targetHref} className="ad-link">
                          {row.target}
                        </Link>
                      ) : (
                        <span className="ad-support-workbench__target-name">{row.target}</span>
                      )}
                      <span className="ad-support-workbench__target-meta">{row.targetDetail}</span>
                    </div>
                  </div>

                  <div className="ad-support-workbench__meta">
                    <span className={`ad-support-badge ad-support-badge--severity-${row.severity.toLowerCase()}`}>
                      {row.severityLabel}
                    </span>
                    <span className="ad-pill" style={{ background: "#f4f6f2", color: "#1d2823" }}>
                      {row.statusLabel}
                    </span>
                    <span
                      className="ad-support-followup"
                      data-tone={row.followUpState}
                    >
                      {row.followUpState === "overdue"
                        ? `Overdue · ${row.nextFollowUpLabel}`
                        : row.followUpState === "due_today"
                          ? `Due today · ${row.nextFollowUpLabel}`
                          : row.nextFollowUpLabel === "—"
                            ? "No follow-up set"
                            : `Follow-up · ${row.nextFollowUpLabel}`}
                    </span>
                    <span className="ad-support-workbench__owner">Owner {row.owner}</span>
                  </div>
                </div>

                <textarea
                  className="ad-textarea"
                  rows={3}
                  value={draft?.summary ?? ""}
                  placeholder="Add the current blocker, context, or next-step summary."
                  onChange={(event) =>
                    setDrafts((current) => ({
                      ...current,
                      [row.id]: {
                        ...(current[row.id] ?? {
                          summary: "",
                          severity: row.severity,
                          status: row.status,
                          nextFollowUpAt: toSupportCaseDatetimeLocalValue(row.nextFollowUpIso),
                        }),
                        summary: event.target.value,
                      },
                    }))
                  }
                />

                <div className="ad-support-workbench__controls">
                  <label className="ad-support-workbench__field">
                    <span className="ad-kv-k">Status</span>
                    <select
                      className="ad-text-input"
                      value={draft?.status ?? row.status}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.id]: {
                            ...(current[row.id] ?? {
                              summary: row.summary ?? "",
                              severity: row.severity,
                              status: row.status,
                              nextFollowUpAt: toSupportCaseDatetimeLocalValue(row.nextFollowUpIso),
                            }),
                            status: event.target.value,
                          },
                        }))
                      }
                    >
                      {SUPPORT_CASE_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="ad-support-workbench__field">
                    <span className="ad-kv-k">Severity</span>
                    <select
                      className="ad-text-input"
                      value={draft?.severity ?? row.severity}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.id]: {
                            ...(current[row.id] ?? {
                              summary: row.summary ?? "",
                              severity: row.severity,
                              status: row.status,
                              nextFollowUpAt: toSupportCaseDatetimeLocalValue(row.nextFollowUpIso),
                            }),
                            severity: event.target.value,
                          },
                        }))
                      }
                    >
                      {SUPPORT_CASE_SEVERITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="ad-support-workbench__field">
                    <span className="ad-kv-k">Next follow-up (UTC)</span>
                    <input
                      className="ad-text-input"
                      type="datetime-local"
                      value={draft?.nextFollowUpAt ?? ""}
                      onChange={(event) =>
                        setDrafts((current) => ({
                          ...current,
                          [row.id]: {
                            ...(current[row.id] ?? {
                              summary: row.summary ?? "",
                              severity: row.severity,
                              status: row.status,
                              nextFollowUpAt: toSupportCaseDatetimeLocalValue(row.nextFollowUpIso),
                            }),
                            nextFollowUpAt: event.target.value,
                          },
                        }))
                      }
                    />
                  </label>
                </div>

                <div className="ad-support-workbench__actions">
                  <button
                    className="ad-btn ad-btn--primary ad-btn--sm"
                    type="button"
                    disabled={rowPending}
                    onClick={() => saveCase(row.id, "keep")}
                  >
                    {rowPending ? "Saving…" : "Save case"}
                  </button>
                  <button
                    className="ad-btn ad-btn--ghost ad-btn--sm"
                    type="button"
                    disabled={rowPending || row.ownerState === "me"}
                    onClick={() => saveCase(row.id, "assign")}
                  >
                    Assign to me
                  </button>
                  <button
                    className="ad-btn ad-btn--ghost ad-btn--sm"
                    type="button"
                    disabled={rowPending || row.ownerState === "unassigned"}
                    onClick={() => saveCase(row.id, "clear")}
                  >
                    Unassign
                  </button>
                  {row.targetHref ? (
                    <Link href={row.targetHref} className="ad-btn ad-btn--secondary ad-btn--sm">
                      Open record
                    </Link>
                  ) : null}
                  {row.resolvedAtLabel !== "—" ? (
                    <span className="ad-support-workbench__resolved">Resolved {row.resolvedAtLabel}</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

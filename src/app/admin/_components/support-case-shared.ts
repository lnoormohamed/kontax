export const SUPPORT_CASE_STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "WAITING_ON_CUSTOMER", label: "Waiting on customer" },
  { value: "WAITING_ON_PROVIDER", label: "Waiting on provider" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

export const SUPPORT_CASE_SEVERITY_OPTIONS = [
  { value: "NORMAL", label: "Normal" },
  { value: "HIGH", label: "High" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export function toSupportCaseDatetimeLocalValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}

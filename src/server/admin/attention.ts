export const ADMIN_ATTENTION_META = {
  healthy: {
    label: "Healthy",
    pill: "#f0fdf4",
    fg: "#15803d",
    dot: "#22c55e",
    rank: 0,
  },
  watch: {
    label: "Watch",
    pill: "#fffbeb",
    fg: "#b45309",
    dot: "#f59e0b",
    rank: 1,
  },
  warning: {
    label: "Needs attention",
    pill: "#fff7ed",
    fg: "#c2410c",
    dot: "#f97316",
    rank: 2,
  },
  critical: {
    label: "Critical",
    pill: "#fef2f2",
    fg: "#b91c1c",
    dot: "#ef4444",
    rank: 3,
  },
  action: {
    label: "Action required",
    pill: "#fef2f2",
    fg: "#991b1b",
    dot: "#dc2626",
    rank: 4,
  },
} as const;

export type AdminAttentionState = keyof typeof ADMIN_ATTENTION_META;

export function adminAttentionMeta(state: AdminAttentionState) {
  return ADMIN_ATTENTION_META[state];
}

export function adminAttentionRank(state: AdminAttentionState) {
  return ADMIN_ATTENTION_META[state].rank;
}

export function adminWorstAttention(
  ...states: AdminAttentionState[]
): AdminAttentionState {
  return states.reduce<AdminAttentionState>(
    (worst, state) =>
      adminAttentionRank(state) > adminAttentionRank(worst) ? state : worst,
    "healthy",
  );
}

export function adminAttentionForErrorRate(rate: number): AdminAttentionState {
  if (rate > 15) return "critical";
  if (rate >= 5) return "warning";
  return "healthy";
}

export function adminAttentionForSyncStatus(status: string): AdminAttentionState {
  switch (status) {
    case "NEEDS_REAUTH":
      return "action";
    case "ERROR":
      return "warning";
    case "PAUSED":
    case "DISCONNECTED":
      return "watch";
    case "RETIRED":
    case "ACTIVE":
    default:
      return "healthy";
  }
}

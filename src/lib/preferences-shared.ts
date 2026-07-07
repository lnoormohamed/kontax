export type UserPreferences = {
  defaultSort?: "name" | "updated";
  defaultViewMode?: "compact" | "cozy";
  // Independent list density for touch/mobile (< 1024px), where "compact" is the
  // 48px single-line row (name + company, email/phone inline) and "cozy" is the
  // 60px two-line row. Defaults to cozy — the user-confirmed mobile default
  // (P46-DB04) — with compact as an opt-in. Desktop density is defaultViewMode
  // (where "compact" is the multi-column grid). Resolved via useResolvedViewMode
  // (src/lib/interface-preferences.ts).
  mobileViewMode?: "compact" | "cozy";
  dateFormat?: "DD MMM YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  nameDisplayOrder?: "first-last" | "last-first";
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
  // P43-01 — Interface group. Flat keys with a device-class applicability map
  // resolved at read time (see src/lib/interface-preferences.ts); one saved
  // value per key, applied only where it makes sense — not per-device buckets.
  rowLabels?: "hover" | "always" | "off"; // applies on desktop (hover: hover)
  motion?: "system" | "on" | "off"; // applies on both device classes
  // P40-08 — one-time state flags for the multi-book rollout (not user-facing
  // settings). booksNative=true marks accounts born into the books model (seeded
  // Personal+Work at signup) so the migration explainer never shows them;
  // booksExplainerDismissedAt records when an existing user dismissed it.
  booksNative?: boolean;
  booksExplainerDismissedAt?: string | null;
  // P46-10 — mobile "needs attention" health prompt dismissal. Stores the
  // distinct-contact attention count at dismissal time; the prompt re-appears
  // when the live count differs (changed either direction), never at zero.
  healthPromptDismissedCount?: number | null;
};

export const DEFAULT_PREFERENCES: Required<UserPreferences> = {
  defaultSort: "name",
  defaultViewMode: "compact",
  mobileViewMode: "cozy",
  dateFormat: "DD MMM YYYY",
  nameDisplayOrder: "first-last",
  weekStartsOn: 1,
  rowLabels: "hover",
  motion: "system",
  booksNative: false,
  booksExplainerDismissedAt: null,
  healthPromptDismissedCount: null,
};

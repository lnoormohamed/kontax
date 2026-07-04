export type UserPreferences = {
  defaultSort?: "name" | "updated";
  defaultViewMode?: "compact" | "cozy";
  dateFormat?: "DD MMM YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  nameDisplayOrder?: "first-last" | "last-first";
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
  // P43-01 — Interface group. Flat keys with a device-class applicability map
  // resolved at read time (see src/lib/interface-preferences.ts); one saved
  // value per key, applied only where it makes sense — not per-device buckets.
  rowLabels?: "hover" | "always" | "off"; // applies on desktop (hover: hover)
  motion?: "system" | "on" | "off"; // applies on both device classes
};

export const DEFAULT_PREFERENCES: Required<UserPreferences> = {
  defaultSort: "name",
  defaultViewMode: "compact",
  dateFormat: "DD MMM YYYY",
  nameDisplayOrder: "first-last",
  weekStartsOn: 1,
  rowLabels: "hover",
  motion: "system",
};

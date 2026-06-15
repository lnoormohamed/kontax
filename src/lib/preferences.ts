// Pure re-export — no server-side dependencies.
// db-dependent functions (getPreferences, updatePreferences) live in ~/server/preferences.ts.
export type { UserPreferences } from "~/lib/preferences-shared";
export { DEFAULT_PREFERENCES } from "~/lib/preferences-shared";

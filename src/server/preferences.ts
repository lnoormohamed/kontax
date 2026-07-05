import { db } from "~/server/db";
import { DEFAULT_PREFERENCES, type UserPreferences } from "~/lib/preferences-shared";

const VALID_KEYS = new Set<keyof UserPreferences>([
  "defaultSort",
  "defaultViewMode",
  "dateFormat",
  "nameDisplayOrder",
  "weekStartsOn",
  "rowLabels",
  "motion",
  "booksNative",
  "booksExplainerDismissedAt",
  "healthPromptDismissedCount",
]);

export async function getPreferences(userId: string): Promise<Required<UserPreferences>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  // Cast is safe: updatePreferences strips unknown keys on every write.
  const stored = (user?.preferences ?? {}) as UserPreferences;
  return { ...DEFAULT_PREFERENCES, ...stored };
}

export async function updatePreferences(
  userId: string,
  patch: Partial<UserPreferences>,
): Promise<void> {
  const current = await getPreferences(userId);

  // Strip keys not in UserPreferences to keep stored JSON well-typed.
  const sanitized = Object.fromEntries(
    Object.entries(patch).filter(([key]) => VALID_KEYS.has(key as keyof UserPreferences)),
  ) as Partial<UserPreferences>;

  await db.user.update({
    where: { id: userId },
    data: { preferences: { ...current, ...sanitized } },
  });
}

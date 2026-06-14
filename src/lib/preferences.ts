import { db } from "~/server/db";

export type UserPreferences = {
  defaultSort?: "name" | "updated";
  defaultViewMode?: "compact" | "cozy";
  dateFormat?: "DD MMM YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
  nameDisplayOrder?: "first-last" | "last-first";
  weekStartsOn?: 0 | 1; // 0 = Sunday, 1 = Monday
};

export const DEFAULT_PREFERENCES: Required<UserPreferences> = {
  defaultSort: "name",
  defaultViewMode: "compact",
  dateFormat: "DD MMM YYYY",
  nameDisplayOrder: "first-last",
  weekStartsOn: 1,
};

const VALID_KEYS = new Set<keyof UserPreferences>([
  "defaultSort",
  "defaultViewMode",
  "dateFormat",
  "nameDisplayOrder",
  "weekStartsOn",
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

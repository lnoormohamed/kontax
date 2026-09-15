import { z } from "zod";

import { db } from "~/server/db";
import { DEFAULT_PREFERENCES, type UserPreferences } from "~/lib/preferences-shared";

const VALID_KEYS = new Set<keyof UserPreferences>([
  "defaultSort",
  "defaultViewMode",
  "mobileViewMode",
  "dateFormat",
  "nameDisplayOrder",
  "weekStartsOn",
  "rowLabels",
  "motion",
  "booksNative",
  "booksExplainerDismissedAt",
  "healthPromptDismissedCount",
]);

// P48-17: preferences ride in the session JWT, so an unbounded write here is a
// self-lockout risk (a >4 KB cookie breaks the session), not just a data-shape
// problem. VALID_KEYS filtered by KEY alone — this validates each key's VALUE
// too (enum members / booleans / bounded strings / bounded numbers) so a
// caller can't stuff arbitrary JSON into a key that only ever held a
// 6-character enum string. Each key is validated independently (not as one
// object schema) so one bad value doesn't discard the rest of a valid patch —
// matching the previous "strip unknown keys and proceed" behaviour.
const FIELD_SCHEMAS: Record<keyof UserPreferences, z.ZodTypeAny> = {
  defaultSort: z.enum(["name", "updated"]),
  defaultViewMode: z.enum(["compact", "cozy"]),
  mobileViewMode: z.enum(["compact", "cozy"]),
  dateFormat: z.enum(["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]),
  nameDisplayOrder: z.enum(["first-last", "last-first"]),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]),
  rowLabels: z.enum(["hover", "always", "off"]),
  motion: z.enum(["system", "on", "off"]),
  booksNative: z.boolean(),
  booksExplainerDismissedAt: z.string().max(40).nullable(),
  healthPromptDismissedCount: z.number().int().min(0).max(1_000_000).nullable(),
};

/** Total serialized preferences JSON must stay well under the 4 KB JWT cookie budget. */
const MAX_PREFERENCES_JSON_BYTES = 2_048;

export async function getPreferences(userId: string): Promise<Required<UserPreferences>> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });
  // Cast is safe: updatePreferences validates shape and values on every write.
  const stored = (user?.preferences ?? {}) as UserPreferences;
  return { ...DEFAULT_PREFERENCES, ...stored };
}

export async function updatePreferences(
  userId: string,
  patch: Partial<UserPreferences>,
): Promise<void> {
  const current = await getPreferences(userId);

  // Strip keys not in UserPreferences, then validate each surviving value
  // against its own schema — an unknown key, or a wrongly-typed/shaped value
  // for a known key, is simply dropped rather than failing the whole patch.
  const sanitized: Partial<UserPreferences> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!VALID_KEYS.has(key as keyof UserPreferences)) continue;
    const result = FIELD_SCHEMAS[key as keyof UserPreferences].safeParse(value);
    if (result.success) {
      (sanitized as Record<string, unknown>)[key] = result.data;
    }
  }

  const next = { ...current, ...sanitized };
  if (Buffer.byteLength(JSON.stringify(next), "utf8") > MAX_PREFERENCES_JSON_BYTES) {
    throw new Error("Preferences payload is too large.");
  }

  await db.user.update({
    where: { id: userId },
    data: { preferences: next },
  });
}

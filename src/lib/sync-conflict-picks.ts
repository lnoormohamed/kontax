// P49A-19 item 2: the per-field choices of a sync conflict "Manual merge".
//
// The review UI shows one comparison row per field that either side has a
// value for (src/server/sync-conflict-merge.ts builds them) and the user picks
// "Kontax (local)" or "Remote" for each. The picks travel with the
// MANUAL_MERGE resolution keyed by the stable field key below — never by row
// position, which shifts with the fields a contact happens to have — and the
// server builds the merged contact from exactly the chosen side per field
// (src/server/sync-conflict-merge.ts).
//
// Shared by the client (sync-page-client.tsx) and the server action, so it
// must stay free of server-only imports.
import { z } from "zod";

/** Every field a manual merge can pick, in display order. */
export const CONFLICT_FIELDS = [
  // The name row carries the structured name parts with it.
  { key: "fullName", label: "Full name" },
  { key: "nickname", label: "Nickname" },
  { key: "emails", label: "Emails" },
  { key: "phones", label: "Phones" },
  { key: "addresses", label: "Addresses" },
  { key: "company", label: "Company" },
  { key: "department", label: "Department" },
  { key: "jobTitle", label: "Job title" },
  { key: "websites", label: "Websites" },
  { key: "birthday", label: "Birthday" },
  { key: "dates", label: "Dates" },
  { key: "notes", label: "Notes" },
  { key: "photo", label: "Photo" },
] as const;

export type ConflictFieldKey = (typeof CONFLICT_FIELDS)[number]["key"];

export type ConflictSide = "local" | "remote";

export type ConflictPicks = Partial<Record<ConflictFieldKey, ConflictSide>>;

/**
 * What an unpicked row resolves to — the side the review UI preselects. A
 * resolution that carries no picks at all (a page loaded before this shipped)
 * therefore saves exactly what the user was shown: every row on "Kontax".
 */
export const DEFAULT_CONFLICT_SIDE: ConflictSide = "local";

const sideSchema = z.enum(["local", "remote"]);

const pickShape = Object.fromEntries(
  CONFLICT_FIELDS.map((field) => [field.key, sideSchema.optional()]),
) as Record<ConflictFieldKey, z.ZodOptional<typeof sideSchema>>;

/** Known field keys only (unknown keys are rejected), each "local" | "remote". */
export const conflictPicksSchema = z.object(pickShape).strict();

/** Form field the MANUAL_MERGE resolution carries the picks in (JSON). */
export const CONFLICT_PICKS_FIELD = "fieldPicks";

export class ConflictPicksError extends Error {}

/**
 * Parse the picks a MANUAL_MERGE resolution sent. `null` = none sent (every
 * row takes DEFAULT_CONFLICT_SIDE). Throws ConflictPicksError for anything
 * else that is not a valid picks object.
 */
export const parseConflictPicks = (raw: unknown): ConflictPicks | null => {
  if (raw == null || raw === "") return null;
  if (typeof raw !== "string" || raw.length > 4_000) {
    throw new ConflictPicksError("Invalid field choices for the merged contact.");
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new ConflictPicksError("Invalid field choices for the merged contact.");
  }
  const parsed = conflictPicksSchema.safeParse(json);
  if (!parsed.success) {
    throw new ConflictPicksError("Invalid field choices for the merged contact.");
  }
  return parsed.data;
};

/** The side a field resolves to under `picks`. */
export const conflictSideFor = (picks: ConflictPicks | null, key: ConflictFieldKey): ConflictSide =>
  picks?.[key] ?? DEFAULT_CONFLICT_SIDE;

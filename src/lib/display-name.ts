import type { UserPreferences } from "~/lib/preferences";

type NameFields = {
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  company?: string | null;
};

/**
 * Derive a display name from contact name fields, respecting the user's
 * nameDisplayOrder preference. Only applies when both firstName and lastName
 * are present; single-part names and fullName-only contacts are unaffected.
 *
 * DISPLAY ONLY — sort order always uses the stored fullName field.
 */
export function getDisplayName(
  contact: NameFields,
  prefs?: Pick<UserPreferences, "nameDisplayOrder">,
): string {
  const first = contact.firstName?.trim();
  const last = contact.lastName?.trim();
  if (first && last) {
    return prefs?.nameDisplayOrder === "last-first"
      ? `${last}, ${first}`
      : `${first} ${last}`;
  }
  return contact.fullName?.trim() ?? contact.company?.trim() ?? "";
}

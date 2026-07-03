// Shared contract between the contacts list (which saves its scroll state
// when a row is opened) and the contact detail page (which decides whether
// "back" can safely be a history.back() that lands on that saved state).

export const CONTACT_LIST_SCROLL_KEY = "kontax:contacts:list-scroll";
export const CONTACT_LIST_SCROLL_MAX_AGE = 10 * 60 * 1000;
export const CONTACT_LIST_RESTORE_PARAM = "restoreContact";

/**
 * True when the previous history entry is the contacts list that opened
 * `contactId`: the list writes this marker in the same tick it navigates to
 * the detail page. Navigating detail→detail (e.g. via a family member link)
 * leaves a marker for a different contact, so those pages fall back to a
 * plain push of /contacts.
 */
export function cameFromContactList(contactId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = sessionStorage.getItem(CONTACT_LIST_SCROLL_KEY);
    if (!raw) return false;
    const saved = JSON.parse(raw) as { createdAt?: number; contactId?: string };
    return (
      saved.contactId === contactId &&
      typeof saved.createdAt === "number" &&
      Date.now() - saved.createdAt <= CONTACT_LIST_SCROLL_MAX_AGE
    );
  } catch {
    return false;
  }
}

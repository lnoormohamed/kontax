/**
 * P38-01 — server-side note match excerpt.
 *
 * When a search query matches a contact's notes, the workspace row shows a
 * short excerpt around the first match instead of shipping the full note text
 * to the client. Computed on the server (contacts/page.tsx) so `notes` stays
 * out of the RSC payload; rendered by ContactsWorkspaceTable.
 */
export function buildNoteMatchExcerpt(notes: string | null | undefined, query: string): string | null {
  if (!notes || !query) return null;
  const ql = query.toLowerCase();
  const i = notes.toLowerCase().indexOf(ql);
  if (i < 0) return null;
  let start = Math.max(0, i - 28);
  if (start > 0) { const sp = notes.indexOf(" ", start); if (sp > -1 && sp < i) start = sp + 1; }
  let end = Math.min(notes.length, start + 90);
  if (end < notes.length) { const sp = notes.lastIndexOf(" ", end); if (sp > start + 20) end = sp; }
  return (start > 0 ? "…" : "") + notes.slice(start, end).trim() + (end < notes.length ? "…" : "");
}

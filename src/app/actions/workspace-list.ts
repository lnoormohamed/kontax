"use server";

import { z } from "zod";

import { auth } from "~/server/auth";
import {
  buildWorkspaceScope,
  listWorkspaceContacts,
  resolveWorkspaceBooks,
  resolveWorkspaceFts,
  WORKSPACE_PAGE_SIZE,
  type WorkspaceRow,
} from "~/server/contacts-workspace";

/**
 * P38-02 — scroll-loading for the workspace contact list.
 *
 * The client streams further windows of the one continuous list as the user
 * scrolls. Everything security-relevant (which books are visible, whose
 * contacts) is re-derived from the session here; the client only supplies
 * view parameters, which are validated and re-checked against the user's own
 * books in buildWorkspaceScope.
 */

const paramsSchema = z.object({
  tab: z.enum(["people", "archived"]),
  query: z.string().max(200),
  filter: z.enum(["all", "recent", "incomplete", "favorites", "emergency"]),
  sort: z.enum(["name", "updated"]),
  label: z.string().max(120).nullable(),
  health: z
    .enum(["missing-methods", "missing-context", "unlabeled", "missing-dates", "sync-attention"])
    .nullable(),
  book: z.string().max(64).nullable(),
  scope: z.enum(["all", "private", "shared"]),
  offset: z.number().int().min(0).max(1_000_000),
});

export type WorkspaceListRequest = z.infer<typeof paramsSchema>;

export async function loadWorkspaceContactsPage(
  rawParams: WorkspaceListRequest,
): Promise<{ rows: WorkspaceRow[]; totalCount: number }> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not authenticated.");
  const params = paramsSchema.parse(rawParams);

  const books = await resolveWorkspaceBooks(session.user.id);
  const scope = buildWorkspaceScope(session.user.id, books, params.book, params.scope);
  const query = params.query.trim();
  const fts = await resolveWorkspaceFts(scope, params.tab, query);

  return listWorkspaceContacts({
    scope,
    archived: params.tab === "archived",
    query,
    ...fts,
    filter: params.filter,
    // archived view never had label/health filters — keep parity with the page.
    label: params.tab === "people" ? params.label : null,
    health: params.tab === "people" ? params.health : null,
    sort: params.sort,
    includeNotes: query.length > 0,
    limit: WORKSPACE_PAGE_SIZE,
    offset: params.offset,
  });
}

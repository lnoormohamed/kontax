// P39-02 / P39-DB01 §1d: export the full pending-deletion list as CSV when the
// review card's per-contact preview is truncated (>50 items). Resolves every
// held link back to its contact — the hold payload itself only stores the
// first 50 names.
import { NextResponse } from "next/server";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import type { DeletionHoldPayload } from "~/server/sync-deletion-guard";

const csvEscape = (value: string) =>
  /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const syncAccountId = new URL(request.url).searchParams.get("syncAccountId");
  if (!syncAccountId) {
    return NextResponse.json({ error: "syncAccountId is required" }, { status: 400 });
  }

  const account = await db.syncAccount.findFirst({
    where: { id: syncAccountId, userId },
    select: { label: true, status: true, lastErrorCode: true, deletionHold: true },
  });
  if (
    account?.status !== "PAUSED" ||
    account.lastErrorCode !== "DELETION_THRESHOLD_EXCEEDED" ||
    !account.deletionHold
  ) {
    return NextResponse.json(
      { error: "This connection has no pending deletion review." },
      { status: 404 },
    );
  }

  const hold = account.deletionHold as unknown as DeletionHoldPayload;
  const outbound = new Set(hold.outboundLinkIds);
  const links = await db.syncContactLink.findMany({
    where: { id: { in: [...hold.inboundLinkIds, ...hold.outboundLinkIds] }, syncAccountId },
    select: {
      id: true,
      tombstonedAt: true,
      contact: {
        select: { fullName: true, email: true, book: { select: { name: true } } },
      },
    },
  });

  const rows = links.map((link) =>
    [
      csvEscape(link.contact?.fullName ?? "Unknown contact"),
      csvEscape(link.contact?.email ?? ""),
      csvEscape(link.contact?.book?.name ?? "Personal"),
      outbound.has(link.id) ? "outbound (remote copy removed)" : "inbound (Kontax copy removed)",
      link.tombstonedAt ? "reconciled" : "pending",
    ].join(","),
  );

  const csv = ["Name,Email,Book,Direction,Status", ...rows].join("\n");
  const filename = `kontax-pending-deletions-${account.label.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

import { auth } from "~/server/auth";
import { loadTeamAudit } from "~/server/team-audit";

// CSV export of the (filtered) team audit log (P14-05). Admin-only.
const csvCell = (value: string) => {
  const v = value ?? "";
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
};

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(request.url);
  const data = await loadTeamAudit(session.user.id, {
    memberId: url.searchParams.get("member") ?? undefined,
    bookId: url.searchParams.get("book") ?? undefined,
    eventType: url.searchParams.get("type") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!data) {
    return new Response("Forbidden", { status: 403 });
  }

  const header = ["Timestamp", "Member", "Event", "Contact", "Book", "Fields changed"];
  const lines = [header.join(",")];
  for (const r of data.rows) {
    lines.push(
      [
        r.createdAt.toISOString(),
        csvCell(r.memberName),
        r.eventType,
        csvCell(r.contactName),
        csvCell(r.bookName),
        String(r.diffCount),
      ].join(","),
    );
  }
  const body = lines.join("\n");
  const filename = `kontax-team-audit-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

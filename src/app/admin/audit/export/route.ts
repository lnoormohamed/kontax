import { NextResponse } from "next/server";

import { assertAdmin, requireAdminCapability } from "~/server/admin/guard";
import { exportAdminAudit } from "~/server/admin/audit";

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: Request) {
  let admin;
  try {
    admin = await assertAdmin();
    requireAdminCapability(admin, "audit.view");
  } catch {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const url = new URL(request.url);
  const rows = await exportAdminAudit({
    action: url.searchParams.get("action") ?? undefined,
    actor: url.searchParams.get("actor") ?? undefined,
    target: url.searchParams.get("target") ?? undefined,
    entity: url.searchParams.get("entity") ?? undefined,
    severity: (url.searchParams.get("severity") as "all" | "high" | "standard" | null) ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    range: url.searchParams.get("range") ?? undefined,
  });

  const header = [
    "id",
    "createdAt",
    "adminName",
    "action",
    "severity",
    "targetEmail",
    "targetUserId",
    "ipAddress",
    "details",
  ];

  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.id,
        row.createdAt,
        row.adminName,
        row.action,
        row.severity,
        row.targetEmail,
        row.targetUserId,
        row.ipAddress,
        row.details,
      ]
        .map((value) => csvEscape(value))
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="admin-audit-export.csv"`,
    },
  });
}

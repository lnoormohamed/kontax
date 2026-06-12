import { MobileTable } from "~/app/_components/mobile-table";

// P24B-04 demo — both modes of the table helper.

const PREVIEW_COLS = [
  { key: "name", label: "Name", width: 116, sticky: true },
  { key: "email", label: "Email", width: 150, sticky: true },
  { key: "phone", label: "Phone" },
  { key: "company", label: "Company" },
  { key: "city", label: "City" },
];

const PREVIEW_ROWS = [
  { name: "Alice Baker", email: "alice.baker@northwind.co", phone: "+44 7700 900112", company: "Northwind", city: "London" },
  { name: "Andrew Chen", email: "andrew@acmestudio.com", phone: "+1 415 555 0142", company: "Acme Studio", city: "San Francisco" },
  { name: "Amara Okafor", email: "amara.o@lumenhealth.org", phone: "+1 312 555 0190", company: "Lumen Health", city: "Chicago" },
];

const MEMBER_COLS = [
  { key: "name", label: "Member" },
  { key: "email", label: "Email" },
  { key: "role", label: "Role", align: "right" as const },
];

const MEMBERS = [
  { name: "Jordan Reeve", email: "jordan@kontax.app", role: "Owner" },
  { name: "Grace Liu", email: "grace@kontax.app", role: "Admin" },
  { name: "Sam Okafor", email: "sam@kontax.app", role: "Member" },
];

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b938c", margin: "26px 16px 10px" }}>
      {children}
    </p>
  );
}

export default function MobileTableWireframe() {
  return (
    <div style={{ background: "#f6f7f4", minHeight: "100dvh", paddingBottom: 60, fontFamily: "Geist, system-ui, sans-serif" }}>
      <Label>Sticky-column scroll (import preview — Name/Email pinned)</Label>
      <div style={{ padding: "0 16px" }}>
        <MobileTable columns={PREVIEW_COLS} rows={PREVIEW_ROWS} minWidth={620} />
      </div>

      <Label>Stacked cards on mobile / table on desktop (roster)</Label>
      <div style={{ padding: "0 16px" }}>
        <MobileTable
          columns={MEMBER_COLS}
          rows={MEMBERS}
          renderCard={(row) => (
            <div style={{ border: "1px solid #d8ddd6", borderRadius: 14, background: "#fff", padding: "13px 16px", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#1d2823" }}>{row.name}</div>
                <div style={{ fontSize: 12.5, color: "#8b938c" }}>{row.email}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#17352e", background: "#e7efe9", borderRadius: 6, padding: "3px 9px" }}>{row.role}</span>
            </div>
          )}
        />
      </div>
    </div>
  );
}

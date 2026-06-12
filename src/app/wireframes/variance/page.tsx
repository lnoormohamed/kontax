import {
  GenuineEmpty,
  NearLimitBanner,
  PendingChip,
  PermissionGate,
  ReadOnlyBanner,
  UpsellCard,
} from "~/app/_components/mobile-variance";

// P24B-03 demo — visual reference for the variance primitives (DB14).
// Internal scaffolding under /wireframes (excluded from production).

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8b938c", margin: "26px 16px 8px" }}>
      {children}
    </p>
  );
}

export default function VarianceWireframe() {
  return (
    <div style={{ background: "#f6f7f4", minHeight: "100dvh", paddingBottom: 60, fontFamily: "Geist, system-ui, sans-serif" }}>
      <Label>UpsellCard · default (Pro gate)</Label>
      <div style={{ padding: "0 16px" }}>
        <UpsellCard
          feature="Activity log"
          plan="Pro"
          icon="activity"
          body="See every edit, sync, import, merge and share across your contacts in one timeline."
        />
      </div>

      <Label>UpsellCard · offline (disabled)</Label>
      <div style={{ padding: "0 16px" }}>
        <UpsellCard feature="Team books" plan="Teams" icon="team" body="Invite up to 25 teammates and share multiple address books." disabled />
      </div>

      <Label>GenuineEmpty (Rule 2 contrast — not an upsell)</Label>
      <GenuineEmpty title="No activity yet" body="Edits, syncs and merges will show up here as you use Kontax." icon="activity" />

      <Label>NearLimitBanner · near</Label>
      <NearLimitBanner used={480} limit={500} unit="contacts" target="Pro" />

      <Label>NearLimitBanner · at-limit</Label>
      <NearLimitBanner used={500} limit={500} unit="contacts" target="Pro" atLimit />

      <Label>ReadOnlyBanner · grace</Label>
      <ReadOnlyBanner variant="grace" />

      <Label>ReadOnlyBanner · locked</Label>
      <ReadOnlyBanner variant="locked" />

      <Label>ReadOnlyBanner · non-owner (no manage link)</Label>
      <ReadOnlyBanner variant="grace" canManage={false} />

      <Label>PendingChip</Label>
      <div style={{ padding: "0 16px", display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#1d2823" }}>Grace Liu</span>
        <PendingChip />
      </div>

      <Label>PermissionGate · allow=true (control shown) / allow=false → fallback</Label>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <PermissionGate allow={true}>
          <button type="button" style={{ height: 32, padding: "0 12px", borderRadius: 8, border: "1px solid #d8ddd6", background: "#fff", fontSize: 13, fontWeight: 600, color: "#1d2823", alignSelf: "flex-start" }}>
            Invite member
          </button>
        </PermissionGate>
        <PermissionGate allow={false} fallback={<span style={{ fontSize: 12.5, fontWeight: 600, color: "#8b938c" }}>Member (no controls)</span>}>
          <button type="button">Invite member</button>
        </PermissionGate>
      </div>
    </div>
  );
}

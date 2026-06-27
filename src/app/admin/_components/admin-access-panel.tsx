type AdminAccessPanelProps = {
  title: string;
  body: string;
  requiredTierLabel: string;
  currentTierLabel: string;
  policySource: string;
};

export function AdminAccessPanel({
  title,
  body,
  requiredTierLabel,
  currentTierLabel,
  policySource,
}: AdminAccessPanelProps) {
  return (
    <section className="ad-card" style={{ display: "grid", gap: 14 }}>
      <div className="ad-card-head">
        <h2 className="ad-card-title">{title}</h2>
      </div>
      <div className="ad-support-note" style={{ margin: 0 }}>
        {body}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span className="ad-pill" style={{ background: "#f4f6f2", color: "#1d2823" }}>
          Current tier: {currentTierLabel}
        </span>
        <span className="ad-pill" style={{ background: "#fff7e8", color: "#9a6700" }}>
          Required: {requiredTierLabel}
        </span>
        <span className="ad-pill" style={{ background: "#eef1fe", color: "#3248db" }}>
          Policy source: {policySource}
        </span>
      </div>
    </section>
  );
}

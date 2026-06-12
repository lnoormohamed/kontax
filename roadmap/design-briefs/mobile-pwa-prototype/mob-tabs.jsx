/* mob-tabs.jsx — Kontax mobile Activity / Sync / Settings tab screens.
   Lean, real screens so the bottom nav has live destinations (active states + badges).
   Settings → Import & Export opens the import screen. */

function PlainHeader({ title }) {
  return (
    <header style={{ height: MOB.headerH, flex: '0 0 auto', display: 'flex', alignItems: 'center', padding: '0 16px',
      background: '#fff', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)' }}>{title}</span>
    </header>
  );
}

function GroupCard({ children }) {
  return <div style={{ margin: '0 16px 16px', border: '1px solid var(--line)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>{children}</div>;
}

function NavRow({ icon, label, detail, danger, last, onClick }) {
  return (
    <button className="mob-tap" onClick={onClick} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 13,
      padding: '13px 16px', border: 'none', background: 'transparent', borderBottom: last ? 'none' : '1px solid var(--line2)' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: danger ? 'var(--red-t)' : 'var(--wash)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
        <MI name={icon} size={18} c={danger ? 'var(--red)' : 'var(--ink2)'} />
      </div>
      <span style={{ flex: 1, textAlign: 'left', fontSize: 15, fontWeight: 500, color: danger ? 'var(--red)' : 'var(--ink)' }}>{label}</span>
      {detail && <span style={{ fontSize: 13, color: 'var(--mute)' }}>{detail}</span>}
      <MI name="chev" size={17} c="var(--faint)" />
    </button>
  );
}

function SettingsScreen({ tab, onTab, onImport, offline }) {
  return (
    <div className="mob" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <StatusSpacer />
      <PlainHeader title="Settings" />
      {offline && <OfflineBanner />}
      <div className="mob-scroll" style={{ flex: 1, padding: '16px 0 28px' }}>
        {/* account */}
        <GroupCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px' }}>
            <Avatar name="Jordan Reeve" size={48} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>Jordan Reeve</div>
              <div style={{ fontSize: 13, color: 'var(--mute)' }}>jordan@kontax.app · Pro</div>
            </div>
          </div>
        </GroupCard>
        <GroupCard>
          <NavRow icon="refresh" label="Sync & devices" detail={offline ? 'Offline' : '2 active'} />
          <NavRow icon="building" label="Family & teams" detail="3 members" />
          <NavRow icon="download" label="Import & export" onClick={onImport} last />
        </GroupCard>
        <GroupCard>
          <NavRow icon="bell" label="Notifications" detail="On" />
          <NavRow icon="star" label="Subscription" detail="Pro" last />
        </GroupCard>
        <GroupCard>
          <NavRow icon="tag" label="Privacy" />
          <NavRow icon="warn" label="Sign out" danger last />
        </GroupCard>
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--faint)', marginTop: 4 }}>Kontax 2.0 · kontax.app</div>
      </div>
      <BottomNav active={tab} onTab={onTab} activityBadge={3} syncBadge={offline ? 1 : 0} />
    </div>
  );
}
window.SettingsScreen = SettingsScreen;

function SyncScreen({ tab, onTab, offline }) {
  const conns = [
    { name: 'iCloud', sub: offline ? 'Waiting for connection' : 'Synced 2m ago · 248 contacts', icon: 'refresh', ok: !offline },
    { name: 'Google Contacts', sub: offline ? 'Waiting for connection' : 'Synced 5m ago · 240 contacts', icon: 'refresh', ok: !offline },
  ];
  return (
    <div className="mob" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <StatusSpacer />
      <PlainHeader title="Sync" />
      {offline && <OfflineBanner />}
      <div className="mob-scroll" style={{ flex: 1, padding: '16px 0 28px' }}>
        <GroupCard>
          {conns.map((c, i) => (
            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '14px 16px',
              borderBottom: i < conns.length - 1 ? '1px solid var(--line2)' : 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--green-t)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                <MI name="refresh" size={19} c="var(--green)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: c.ok ? 'var(--mute)' : 'var(--amber)', marginTop: 1 }}>{c.sub}</div>
              </div>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: c.ok ? '#2f9e5e' : 'var(--amber)', flex: '0 0 auto' }} />
            </div>
          ))}
        </GroupCard>
        <div style={{ padding: '0 16px' }}>
          <button className="mob-tap" disabled={offline} style={{ width: '100%', height: 48, borderRadius: 12, border: '1.5px dashed var(--line)',
            background: '#fff', color: offline ? 'var(--faint)' : 'var(--blue)', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <MI name="plus" size={18} c={offline ? 'var(--faint)' : 'var(--blue)'} w={2} /> Add connection
          </button>
        </div>
      </div>
      <BottomNav active={tab} onTab={onTab} activityBadge={3} syncBadge={offline ? 1 : 0} />
    </div>
  );
}
window.SyncScreen = SyncScreen;

function ActivityScreen({ tab, onTab }) {
  const events = [
    ['Alice Baker', 'Phone number updated', '2h ago', 'pencil'],
    ['iCloud', 'Synced 248 contacts', '2h ago', 'refresh'],
    ['Grace Liu', 'Added to Family', '5h ago', 'building'],
    ['Import', '248 contacts imported from CSV', 'Yesterday', 'download'],
    ['James Liu', 'Marked as favourite', 'Yesterday', 'star'],
  ];
  return (
    <div className="mob" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <StatusSpacer />
      <PlainHeader title="Activity" />
      <div className="mob-scroll" style={{ flex: 1, padding: '8px 0 28px' }}>
        <GroupCard>
          {events.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px',
              borderBottom: i < events.length - 1 ? '1px solid var(--line2)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--wash)', display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                <MI name={e[3]} size={17} c="var(--ink2)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, color: 'var(--ink)' }}><strong style={{ fontWeight: 600 }}>{e[0]}</strong> · {e[1]}</div>
                <div style={{ fontSize: 12, color: 'var(--mute)', marginTop: 1 }}>{e[2]}</div>
              </div>
            </div>
          ))}
        </GroupCard>
      </div>
      <BottomNav active={tab} onTab={onTab} activityBadge={3} />
    </div>
  );
}
window.ActivityScreen = ActivityScreen;

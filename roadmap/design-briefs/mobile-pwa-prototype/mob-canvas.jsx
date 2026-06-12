/* mob-canvas.jsx — static overview of every Kontax mobile frame on a design canvas.
   Each frame is the real screen component inside an iOS bezel, forced to a fixed state.
   Overlays use noAnim so they paint in their settled position. */

const noop = () => {};

function Frame({ children }) {
  return (
    <IOSDevice>
      <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
    </IOSDevice>
  );
}

// mini list for the swipe-reveal demo (2nd row opened)
function SwipeDemoFrame() {
  const rows = CONTACTS.slice(3, 9);
  return (
    <Frame>
      <div className="mob" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <StatusSpacer />
        <MobHeader unread={3} onBell={noop} onSearch={noop} />
        <div className="mob-scroll" style={{ flex: 1 }}>
          <GroupHeader label="B" />
          {rows.map((c, i) => <SwipeRow key={c.id} c={c} fav={c.fav} onOpen={noop} onArchive={noop} onToggleFav={noop} initialOpen={i === 1} />)}
        </div>
        <BottomNav active="contacts" onTab={noop} activityBadge={3} />
      </div>
    </Frame>
  );
}

function CanvasApp() {
  const list = (extra) => <Frame><ListScreen tab="contacts" onTab={noop} onOpen={noop} onAdd={noop} onToast={noop} onBell={noop} onSearch={noop} {...extra} /></Frame>;
  return (
    <DesignCanvas>
      <DCSection id="nav" title="Navigation & contact list" subtitle="Bottom nav · 60px rows · swipe actions · group headers">
        <DCArtboard id="list" label="Contact list" width={402} height={874}>{list()}</DCArtboard>
        <DCArtboard id="swipe" label="Swipe actions — revealed" width={402} height={874}><SwipeDemoFrame /></DCArtboard>
        <DCArtboard id="offline" label="Offline state" width={402} height={874}>{list({ offline: true })}</DCArtboard>
        <DCArtboard id="empty" label="Empty state" width={402} height={874}>{list({ listEmpty: true })}</DCArtboard>
      </DCSection>

      <DCSection id="detail" title="Contact detail" subtitle="Centred header · action row · field cards · edit FAB">
        <DCArtboard id="detail-full" label="Detail — full" width={402} height={874}>
          <Frame><DetailScreen c={CONTACTS[0]} tab="contacts" onTab={noop} onBack={noop} onEdit={noop} /></Frame>
        </DCArtboard>
      </DCSection>

      <DCSection id="form" title="Create / edit" subtitle="Bottom sheet · collapsible sections · keyboard-aware">
        <DCArtboard id="new" label="New contact sheet" width={402} height={874}>
          <Frame>
            <ListScreen tab="contacts" onTab={noop} onOpen={noop} onAdd={noop} onToast={noop} onBell={noop} onSearch={noop} />
            <EditSheet editing={false} contact={null} onClose={noop} onSave={noop} noAnim />
          </Frame>
        </DCArtboard>
        <DCArtboard id="kb" label="Keyboard-aware edit" width={402} height={874}>
          <Frame>
            <ListScreen tab="contacts" onTab={noop} onOpen={noop} onAdd={noop} onToast={noop} onBell={noop} onSearch={noop} />
            <EditSheet editing contact={CONTACTS[1]} onClose={noop} onSave={noop} noAnim initialFocus="company" />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection id="io" title="Import & export" subtitle="File picker · sticky-column preview · format select">
        <DCArtboard id="import" label="Import — preview" width={402} height={874}>
          <Frame><ImportExportScreen tab="settings" onTab={noop} onBack={noop} onToast={noop} initialMode="import" initialPicked /></Frame>
        </DCArtboard>
        <DCArtboard id="export" label="Export" width={402} height={874}>
          <Frame><ImportExportScreen tab="settings" onTab={noop} onBack={noop} onToast={noop} initialMode="export" /></Frame>
        </DCArtboard>
      </DCSection>

      <DCSection id="pwa" title="PWA install prompt" subtitle="Bottom sheet · Android programmatic · iOS guidance">
        <DCArtboard id="android" label="Install — Android" width={402} height={874}>
          <Frame>
            <ListScreen tab="contacts" onTab={noop} onOpen={noop} onAdd={noop} onToast={noop} onBell={noop} onSearch={noop} />
            <InstallPrompt platform="android" onClose={noop} noAnim />
          </Frame>
        </DCArtboard>
        <DCArtboard id="ios" label="Install — iOS" width={402} height={874}>
          <Frame>
            <ListScreen tab="contacts" onTab={noop} onOpen={noop} onAdd={noop} onToast={noop} onBell={noop} onSearch={noop} />
            <InstallPrompt platform="ios" onClose={noop} noAnim />
          </Frame>
        </DCArtboard>
      </DCSection>

      <DCSection id="tabs" title="Other tabs" subtitle="Live destinations for the bottom nav">
        <DCArtboard id="activity" label="Activity" width={402} height={874}><Frame><ActivityScreen tab="activity" onTab={noop} /></Frame></DCArtboard>
        <DCArtboard id="sync" label="Sync" width={402} height={874}><Frame><SyncScreen tab="sync" onTab={noop} /></Frame></DCArtboard>
        <DCArtboard id="settings" label="Settings" width={402} height={874}><Frame><SettingsScreen tab="settings" onTab={noop} onImport={noop} /></Frame></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CanvasApp />);

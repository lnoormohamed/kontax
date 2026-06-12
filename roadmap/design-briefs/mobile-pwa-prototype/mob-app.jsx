/* mob-app.jsx — Kontax mobile PWA interactive prototype.
   Wires the screens into the iOS bezel, routes the bottom nav, owns toast + sheet,
   and exposes a Tweaks panel (online/offline, full/empty list, install prompt). */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "connection": "online",
  "listState": "full",
  "install": "off"
}/*EDITMODE-END*/;

function Stage({ children }) {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const pad = 48;
      const s = Math.min(1, (window.innerWidth - pad) / 402, (window.innerHeight - pad) / 874);
      setScale(s);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#e7e9e4', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center' }}>{children}</div>
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const offline = t.connection === 'offline';
  const listEmpty = t.listState === 'empty';

  const [tab, setTab] = useState('contacts');
  const [detail, setDetail] = useState(null);     // selected contact or null
  const [settingsView, setSettingsView] = useState('root'); // root | import
  const [sheet, setSheet] = useState(null);       // null | { editing, contact }
  const [toast, setToast] = useState(null);
  const [dismissedInstall, setDismissedInstall] = useState(false);

  useEffect(() => { setDismissedInstall(false); }, [t.install]);

  const toastTimer = useRef(null);
  function showToast(cfg) {
    setToast(cfg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  function goTab(next) {
    setTab(next);
    setDetail(null);
    setSettingsView('root');
  }
  function openAdd() {
    if (offline) { showToast({ text: 'Changes require a connection.' }); return; }
    setSheet({ editing: false, contact: null });
  }

  // ── active screen ──
  let screen;
  if (tab === 'contacts') {
    screen = detail
      ? <DetailScreen c={detail} tab={tab} onTab={goTab} onBack={() => setDetail(null)}
          onEdit={() => setSheet({ editing: true, contact: detail })} />
      : <ListScreen tab={tab} offline={offline} listEmpty={listEmpty} onTab={goTab}
          onOpen={(c) => setDetail(c)} onAdd={openAdd} onToast={showToast}
          onBell={() => showToast({ text: 'Notifications open as a full-screen overlay.' })}
          onSearch={() => showToast({ text: 'Search runs against your cached list.' })} />;
  } else if (tab === 'activity') {
    screen = <ActivityScreen tab={tab} onTab={goTab} />;
  } else if (tab === 'sync') {
    screen = <SyncScreen tab={tab} onTab={goTab} offline={offline} />;
  } else {
    screen = settingsView === 'import'
      ? <ImportExportScreen tab={tab} onTab={goTab} onBack={() => setSettingsView('root')} onToast={showToast} />
      : <SettingsScreen tab={tab} onTab={goTab} offline={offline} onImport={() => setSettingsView('import')} />;
  }

  const showInstall = t.install !== 'off' && !dismissedInstall;

  return (
    <>
      <Stage>
        <IOSDevice>
          <div style={{ position: 'absolute', inset: 0 }}>
            {screen}
            {sheet && <EditSheet editing={sheet.editing} contact={sheet.contact}
              onClose={() => setSheet(null)}
              onSave={() => { setSheet(null); showToast({ text: sheet.editing ? 'Contact saved.' : 'Contact added.' }); }} />}
            {showInstall && <InstallPrompt platform={t.install} onClose={() => setDismissedInstall(true)} />}
            {toast && <Toast {...toast} onClose={() => setToast(null)} />}
          </div>
        </IOSDevice>
      </Stage>

      <TweaksPanel>
        <TweakSection label="App state" />
        <TweakRadio label="Connection" value={t.connection} options={['online', 'offline']}
          onChange={(v) => setTweak('connection', v)} />
        <TweakRadio label="Contact list" value={t.listState} options={['full', 'empty']}
          onChange={(v) => setTweak('listState', v)} />
        <TweakSection label="PWA install prompt" />
        <TweakRadio label="Show prompt" value={t.install} options={['off', 'android', 'ios']}
          onChange={(v) => setTweak('install', v)} />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

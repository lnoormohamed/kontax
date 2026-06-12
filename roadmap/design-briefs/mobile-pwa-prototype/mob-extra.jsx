/* mob-extra.jsx — Kontax mobile import/export + PWA install prompt.
   Import: big Choose-file button, 2×2 source chips, horizontally-scrollable preview
   with sticky Name/Email columns, compact result. Export: format radios + toast.
   Install: bottom sheet with iOS (Share→Add to Home Screen) and Android (programmatic) variants. */

function SourceChip({ label, active, onClick }) {
  return (
    <button className="mob-tap" onClick={onClick} style={{ height: 52, borderRadius: 12, border: `1.5px solid ${active ? 'var(--blue)' : 'var(--line)'}`,
      background: active ? 'var(--blue-t)' : '#fff', color: active ? 'var(--blue)' : 'var(--ink2)', fontSize: 14, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      {active && <MI name="check" size={17} c="var(--blue)" w={2.4} />}{label}
    </button>
  );
}

const PREVIEW_ROWS = [
  ['Alice Baker', 'alice.baker@northwind.co', '+44 7700 900112', 'Northwind', 'London'],
  ['Andrew Chen', 'andrew@acmestudio.com', '+1 415 555 0142', 'Acme Studio', 'San Francisco'],
  ['Amara Okafor', 'amara.o@lumenhealth.org', '+1 312 555 0190', 'Lumen Health', 'Chicago'],
  ['Barbara Nguyen', 'barbara.nguyen@harbor.io', '+1 206 555 0177', 'Harbor Labs', 'Seattle'],
];
const PREVIEW_COLS = ['Name', 'Email', 'Phone', 'Company', 'City'];

function ImportExportScreen({ tab, onBack, onTab, onToast, initialMode = 'import', initialPicked = false }) {
  const [mode, setMode] = useState(initialMode);
  const [src, setSrc] = useState('google');
  const [picked, setPicked] = useState(initialPicked);
  const [fmt, setFmt] = useState('csv');

  return (
    <div className="mob" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <StatusSpacer />
      <SubHeader title="Import & Export" compact onBack={onBack} />
      {/* segmented */}
      <div style={{ flex: '0 0 auto', padding: '12px 16px', background: '#fff', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', background: 'var(--wash)', borderRadius: 10, padding: 3 }}>
          {[['import', 'Import'], ['export', 'Export']].map(([k, lbl]) => (
            <button key={k} className="mob-tap" onClick={() => setMode(k)} style={{ flex: 1, height: 36, borderRadius: 8, border: 'none',
              background: mode === k ? '#fff' : 'transparent', color: mode === k ? 'var(--ink)' : 'var(--mute)', fontSize: 14,
              fontWeight: 600, boxShadow: mode === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none' }}>{lbl}</button>
          ))}
        </div>
      </div>

      <div className="mob-scroll" style={{ flex: 1, padding: '16px 16px 40px' }}>
        {mode === 'import' ? (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 9 }}>Source profile</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 22 }}>
              {[['google', 'Google'], ['icloud', 'iCloud'], ['outlook', 'Outlook'], ['other', 'Other CSV']].map(([k, lbl]) => (
                <SourceChip key={k} label={lbl} active={src === k} onClick={() => setSrc(k)} />
              ))}
            </div>

            <button className="mob-tap" onClick={() => setPicked(true)} style={{ width: '100%', height: 56, borderRadius: 14, border: 'none',
              background: 'var(--blue)', color: '#fff', fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <MI name="folder" size={22} c="#fff" /> Choose CSV file
            </button>
            <div style={{ fontSize: 12.5, color: 'var(--mute)', textAlign: 'center', marginTop: 10 }}>
              {picked ? 'contacts-export.csv · 248 rows' : 'CSV or vCard, up to 10,000 contacts'}
            </div>

            {picked && (
              <div style={{ marginTop: 22, animation: 'mobFade .25s' }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 9 }}>Preview · first 4 of 248</div>
                {/* horizontally scrollable, first 2 cols sticky */}
                <div style={{ border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: '#fff' }}>
                  <div className="mob-scroll" style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: 12.5, whiteSpace: 'nowrap' }}>
                      <thead>
                        <tr>
                          {PREVIEW_COLS.map((col, i) => (
                            <th key={col} style={{ textAlign: 'left', padding: '9px 12px', fontWeight: 700, color: 'var(--ink2)',
                              background: 'var(--wash)', borderBottom: '1px solid var(--line)', position: i < 2 ? 'sticky' : 'static',
                              left: i === 0 ? 0 : (i === 1 ? 116 : undefined), zIndex: i < 2 ? 2 : 1, minWidth: i === 0 ? 116 : 110,
                              boxShadow: i === 1 ? '2px 0 0 var(--line)' : 'none' }}>{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {PREVIEW_ROWS.map((row, r) => (
                          <tr key={r}>
                            {row.map((cell, i) => (
                              <td key={i} style={{ padding: '9px 12px', color: i === 0 ? 'var(--ink)' : 'var(--ink2)', fontWeight: i === 0 ? 600 : 400,
                                borderBottom: r < PREVIEW_ROWS.length - 1 ? '1px solid var(--line2)' : 'none', background: '#fff',
                                position: i < 2 ? 'sticky' : 'static', left: i === 0 ? 0 : (i === 1 ? 116 : undefined), zIndex: i < 2 ? 1 : 0,
                                boxShadow: i === 1 ? '2px 0 0 var(--line2)' : 'none' }}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <button onClick={() => { setPicked(false); onToast({ text: '248 contacts imported.', actionLabel: 'View' }); }}
                  style={{ width: '100%', height: 48, borderRadius: 12, border: 'none', background: 'var(--green)', color: '#fff',
                    fontSize: 15.5, fontWeight: 600, marginTop: 16 }}>Import 248 contacts</button>
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--mute)', marginBottom: 9 }}>Format</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
              {[['csv', 'CSV', 'Comma-separated, opens in Sheets or Excel'], ['vcard', 'vCard (.vcf)', 'Standard contact cards for Apple & Google']].map(([k, lbl, desc]) => (
                <button key={k} className="mob-tap" onClick={() => setFmt(k)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                  borderRadius: 12, border: `1.5px solid ${fmt === k ? 'var(--blue)' : 'var(--line)'}`, background: fmt === k ? 'var(--blue-t)' : '#fff', textAlign: 'left' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${fmt === k ? 'var(--blue)' : 'var(--faint)'}`,
                    display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>
                    {fmt === k && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--blue)' }} />}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{lbl}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--mute)', marginTop: 2 }}>{desc}</span>
                  </span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink2)', lineHeight: 1.5, marginBottom: 18 }}>
              Exporting all <strong style={{ color: 'var(--ink)' }}>248 contacts</strong>. The file downloads to your device.
            </div>
            <button onClick={() => onToast({ text: 'Your file has been saved to Downloads.' })}
              style={{ width: '100%', height: 52, borderRadius: 12, border: 'none', background: 'var(--blue)', color: '#fff', fontSize: 16, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
              <MI name="download" size={20} c="#fff" /> Export {fmt === 'csv' ? 'CSV' : 'vCard'}
            </button>
          </>
        )}
      </div>
      <BottomNav active={tab} onTab={onTab} activityBadge={3} />
    </div>
  );
}
window.ImportExportScreen = ImportExportScreen;

// ── PWA install prompt (bottom sheet) ───────────────────────────────────────
function InstallPrompt({ platform = 'android', onClose, noAnim }) {
  const ios = platform === 'ios';
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 95, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,28,24,0.42)', animation: noAnim ? 'none' : 'mobFade .2s' }} />
      <div className="mob" style={{ position: 'relative', background: '#fff', borderRadius: '20px 20px 0 0', padding: '0 20px',
        paddingBottom: MOB.homeH + 16, animation: noAnim ? 'none' : 'mobSheetUp .3s cubic-bezier(.2,.8,.2,1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line)', margin: '8px auto 16px' }} />
        <div style={{ fontSize: 19, fontWeight: 700, color: 'var(--ink)', textAlign: 'center', marginBottom: 18 }}>
          Add Kontax to your Home Screen
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 18 }}>
          <div style={{ width: 64, height: 64, borderRadius: 16, background: 'var(--green)', color: 'var(--green-t)', display: 'grid',
            placeItems: 'center', fontSize: 34, fontWeight: 700, boxShadow: '0 4px 12px rgba(23,53,46,0.25)' }}>K</div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginTop: 12 }}>Kontax</div>
          <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>kontax.app</div>
        </div>
        <div style={{ fontSize: 14.5, color: 'var(--ink2)', lineHeight: 1.5, marginBottom: 20, textAlign: 'center' }}>
          Access your contacts instantly, even without an internet connection.
        </div>

        {ios ? (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue-t)', color: 'var(--blue)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flex: '0 0 auto' }}>1</span>
                <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>Tap the Share icon</span>
                <span style={{ marginLeft: 'auto' }}><MI name="share" size={22} c="var(--blue)" /></span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--blue-t)', color: 'var(--blue)', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700, flex: '0 0 auto' }}>2</span>
                <span style={{ fontSize: 14.5, color: 'var(--ink)' }}>Choose “Add to Home Screen”</span>
                <span style={{ marginLeft: 'auto' }}><MI name="plus" size={20} c="var(--blue)" w={2} /></span>
              </div>
            </div>
            <button onClick={onClose} style={{ width: '100%', height: 48, borderRadius: 12, border: '1px solid var(--line)', background: '#fff',
              color: 'var(--ink)', fontSize: 15.5, fontWeight: 600 }}>Got it</button>
          </>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1.4, height: 48, borderRadius: 12, border: 'none', background: 'var(--blue)',
              color: '#fff', fontSize: 15.5, fontWeight: 600 }}>Install</button>
            <button onClick={onClose} style={{ flex: 1, height: 48, borderRadius: 12, border: '1px solid var(--line)', background: '#fff',
              color: 'var(--ink2)', fontSize: 15.5, fontWeight: 600 }}>Not now</button>
          </div>
        )}
      </div>
    </div>
  );
}
window.InstallPrompt = InstallPrompt;

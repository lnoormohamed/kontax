/* mob-sheet.jsx — Kontax mobile create/edit bottom sheet.
   Slides up over the current screen. Collapsible sections (Basic Info always open).
   Keyboard-aware: focusing a field raises a simulated keyboard, pins the Save button
   above it, and scrolls the focused field 24px clear of the keyboard edge. */

const SHEET_SECTIONS = [
  { id: 'basic', title: 'Basic Info', locked: true, fields: [
    { id: 'first', label: 'First name', k: 'first' },
    { id: 'last', label: 'Last name', k: 'last' },
    { id: 'company', label: 'Company', k: 'company' },
  ] },
  { id: 'phones', title: 'Phone numbers', fields: [
    { id: 'phone1', label: 'Mobile', k: 'phone', kind: 'tel' },
  ], add: 'Add phone number' },
  { id: 'emails', title: 'Email addresses', fields: [
    { id: 'email1', label: 'Work email', k: 'email', kind: 'email' },
  ], add: 'Add email address' },
  { id: 'addresses', title: 'Addresses', fields: [
    { id: 'street', label: 'Street' },
    { id: 'city', label: 'City' },
  ], add: 'Add address' },
  { id: 'more', title: 'More — dates, notes, custom fields', fields: [
    { id: 'bday', label: 'Birthday' },
    { id: 'note', label: 'Notes', multi: true },
  ] },
];

function caretStyle() {
  return { display: 'inline-block', width: 2, height: 18, background: 'var(--blue)', marginLeft: 1, borderRadius: 1,
    verticalAlign: 'text-bottom', animation: 'mobCaret 1s steps(1) infinite' };
}

function EditSheet({ editing, contact, onClose, onSave, noAnim, initialFocus }) {
  const [open, setOpen] = useState({ basic: true });
  const [vals, setVals] = useState(() => {
    if (editing && contact) {
      const [first, ...rest] = contact.name.split(' ');
      return { first, last: rest.join(' '), company: contact.co, phone: contact.phone, email: contact.email };
    }
    return {};
  });
  const [focus, setFocus] = useState(initialFocus || null);  // field id
  const bodyRef = useRef(null);
  const fieldRefs = useRef({});

  // ordered list of currently-visible (expanded) field ids
  const order = [];
  SHEET_SECTIONS.forEach((s) => { if (open[s.id] || s.locked) s.fields.forEach((f) => order.push(f)); });

  const kb = focus != null;

  function focusField(id) {
    setFocus(id);
    // after layout settles (keyboard mounted), scroll the field clear of the keyboard
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = fieldRefs.current[id]; const body = bodyRef.current;
      if (!el || !body) return;
      const er = el.getBoundingClientRect(), br = body.getBoundingClientRect();
      const delta = er.bottom - (br.bottom - 24);
      if (delta > 0 || er.top < br.top + 8) body.scrollTop += delta;
    }));
  }
  function advance(dir) {
    const i = order.findIndex((f) => f.id === focus);
    const ni = i + dir;
    if (ni < 0 || ni >= order.length) { setFocus(null); return; }
    focusField(order[ni].id);
  }

  function Field({ f }) {
    const v = vals[f.k || f.id] || '';
    const active = focus === f.id;
    return (
      <button ref={(n) => { fieldRefs.current[f.id] = n; }} className="mob-tap" onClick={() => focusField(f.id)}
        style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', background: 'transparent', padding: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--mute)', margin: '0 0 5px' }}>{f.label}</div>
        <div style={{ minHeight: f.multi ? 76 : 46, border: `1.5px solid ${active ? 'var(--blue)' : 'var(--line)'}`,
          borderRadius: 11, background: active ? 'var(--blue-t)' : '#fff', padding: f.multi ? '12px 14px' : '0 14px',
          display: 'flex', alignItems: f.multi ? 'flex-start' : 'center', boxShadow: active ? '0 0 0 3px rgba(65,88,244,0.12)' : 'none',
          transition: 'border-color .12s, box-shadow .12s' }}>
          <span style={{ fontSize: 15.5, color: v ? 'var(--ink)' : 'var(--faint)' }}>{v || (active ? '' : 'Add ' + f.label.toLowerCase())}</span>
          {active && <span style={caretStyle()} />}
        </div>
      </button>
    );
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
      {/* scrim */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,28,24,0.42)', animation: noAnim ? 'none' : 'mobFade .2s' }} />
      {/* sheet */}
      <div className="mob" style={{ position: 'relative', background: 'var(--bg)', borderRadius: '20px 20px 0 0',
        height: 'calc(100% - 28px)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        animation: noAnim ? 'none' : 'mobSheetUp .3s cubic-bezier(.2,.8,.2,1)', boxShadow: '0 -10px 40px rgba(0,0,0,0.25)' }}>
        {/* handle + header */}
        <div style={{ flex: '0 0 auto', background: '#fff', borderBottom: '1px solid var(--line)' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--line)', margin: '8px auto 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', height: 48, padding: '0 6px' }}>
            <div style={{ width: 44 }} />
            <div style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>
              {editing ? 'Edit contact' : 'New contact'}
            </div>
            <button className="mob-tap" onClick={onClose} aria-label="Close"
              style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent' }}>
              <MI name="close" size={22} c="var(--ink2)" />
            </button>
          </div>
        </div>

        {/* scrollable body */}
        <div ref={bodyRef} className="mob-scroll" style={{ flex: 1, minHeight: 0, padding: '12px 16px 24px' }}>
          {SHEET_SECTIONS.map((s) => {
            const isOpen = s.locked || open[s.id];
            return (
              <div key={s.id} style={{ marginBottom: 10, border: '1px solid var(--line)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
                <button className="mob-tap" disabled={s.locked} onClick={() => setOpen((o) => ({ ...o, [s.id]: !o[s.id] }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, height: 48, padding: '0 14px',
                    border: 'none', background: 'transparent' }}>
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 14.5, fontWeight: 700, color: 'var(--ink)' }}>{s.title}</span>
                  {s.locked
                    ? <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--mute)' }}>Always on</span>
                    : <span style={{ transition: 'transform .18s', transform: isOpen ? 'rotate(180deg)' : 'none' }}><MI name="chevd" size={18} c="var(--mute)" /></span>}
                </button>
                {isOpen && (
                  <div style={{ padding: '4px 14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {s.fields.map((f) => <Field key={f.id} f={f} />)}
                    {s.add && (
                      <button className="mob-tap" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 36, border: 'none',
                        background: 'transparent', color: 'var(--blue)', fontSize: 14, fontWeight: 600, padding: 0 }}>
                        <MI name="plus" size={17} c="var(--blue)" w={2} /> {s.add}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* save button — pinned above keyboard */}
        <div style={{ flex: '0 0 auto', padding: '10px 16px', background: '#fff', borderTop: '1px solid var(--line)',
          paddingBottom: kb ? 10 : MOB.homeH + 10 }}>
          <button onClick={() => onSave(vals)} style={{ width: '100%', height: 48, borderRadius: 12, border: 'none',
            background: 'var(--blue)', color: '#fff', fontSize: 16, fontWeight: 600 }}>
            {editing ? 'Save changes' : 'Save contact'}
          </button>
        </div>

        {/* simulated keyboard + input accessory bar */}
        {kb && (
          <div style={{ flex: '0 0 auto', animation: noAnim ? 'none' : 'mobSheetUp .22s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 44, padding: '0 6px 0 12px',
              background: 'rgba(245,246,242,0.92)', borderTop: '1px solid var(--line)', backdropFilter: 'blur(6px)' }}>
              <button className="mob-tap" onClick={() => advance(-1)} style={{ width: 40, height: 36, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center' }}>
                <MI name="chevu" size={20} c="var(--ink2)" />
              </button>
              <button className="mob-tap" onClick={() => advance(1)} style={{ width: 40, height: 36, border: 'none', background: 'transparent', display: 'grid', placeItems: 'center' }}>
                <MI name="chevd" size={20} c="var(--ink2)" />
              </button>
              <div style={{ flex: 1 }} />
              <button className="mob-tap" onClick={() => setFocus(null)} style={{ height: 34, padding: '0 14px', border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 15, fontWeight: 700 }}>Done</button>
            </div>
            <div style={{ background: '#cfd3cc' }}>
              {window.IOSKeyboard ? <IOSKeyboard /> : <div style={{ height: 280 }} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
window.EditSheet = EditSheet;

if (typeof document !== 'undefined' && !document.getElementById('mob-sheet-styles')) {
  const s = document.createElement('style');
  s.id = 'mob-sheet-styles';
  s.textContent = `@keyframes mobCaret{ 0%,50%{opacity:1;} 51%,100%{opacity:0;} }`;
  document.head.appendChild(s);
}

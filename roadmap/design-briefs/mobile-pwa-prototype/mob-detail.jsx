/* mob-detail.jsx — Kontax mobile contact detail.
   Full centred header that scrolls away; compact fixed header (back · name · Edit)
   fades in past 60px. Action row, Details/Sharing/History tabs, field cards, edit FAB. */

function buildFields(c) {
  const first = c.name.split(' ')[0];
  const dom = (c.email.split('@')[1] || 'example.com');
  return {
    phones: [
      { label: 'Mobile', value: c.phone, primary: true },
      ...(c.co ? [{ label: 'Work', value: c.phone.slice(0, -2) + '04' }] : []),
    ],
    emails: [
      { label: 'Work', value: c.email, primary: true },
      ...(c.co ? [{ label: 'Personal', value: first.toLowerCase() + '@' + (c.co ? 'gmail.com' : dom) }] : []),
    ],
    address: c.co ? '24 Harbour Street, London EC2A 4NE' : null,
    company: c.co,
    birthday: c.fav ? 'March 14' : null,
    note: c.team ? 'Met at the Q1 partner summit. Owns the Northwind integration.' : null,
  };
}

function FieldCard({ children, title }) {
  return (
    <div style={{ margin: '0 16px 12px', border: '1px solid var(--line)', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
      {title && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
        color: 'var(--mute)', padding: '12px 16px 4px' }}>{title}</div>}
      {children}
    </div>
  );
}

function FieldRow({ icon, label, value, action, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '11px 16px',
      borderBottom: last ? 'none' : '1px solid var(--line2)' }}>
      <div style={{ width: 22, display: 'grid', placeItems: 'center', flex: '0 0 auto' }}>{icon}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 11, color: 'var(--mute)', fontWeight: 600 }}>{label}</div>
        <div style={{ fontSize: 15, color: 'var(--ink)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      </div>
      {action}
    </div>
  );
}

function ActionPill({ icon, label }) {
  return (
    <button className="mob-tap" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      border: 'none', background: 'transparent', padding: '4px 0' }}>
      <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--green-t)', display: 'grid', placeItems: 'center' }}>
        <MI name={icon} size={21} c="var(--green)" />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ink2)' }}>{label}</span>
    </button>
  );
}

function DetailScreen({ c, tab, onBack, onEdit, onTab }) {
  const [scrolled, setScrolled] = useState(false);
  const [seg, setSeg] = useState('details');
  const f = buildFields(c);
  const sub = [c.co, f.address ? 'London' : null].filter(Boolean).join(' · ');

  return (
    <div className="mob" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <StatusSpacer />
      <SubHeader title={c.name} compact={scrolled} onBack={onBack}
        action={<button className="mob-tap" onClick={onEdit} style={{ height: 36, padding: '0 14px', marginRight: 8, borderRadius: 9,
          border: 'none', background: 'transparent', color: 'var(--blue)', fontSize: 15, fontWeight: 600 }}>Edit</button>} />

      <div className="mob-scroll" style={{ flex: 1, position: 'relative' }}
        onScroll={(e) => setScrolled(e.currentTarget.scrollTop > 60)}>
        {/* full header */}
        <div style={{ background: '#fff', borderBottom: '1px solid var(--line)', padding: '8px 16px 16px', textAlign: 'center' }}>
          <Avatar name={c.name} size={64} cls="mob-detail-av" />
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginTop: 12, letterSpacing: '-0.01em' }}>{c.name}</div>
          {sub && <div style={{ fontSize: 14, color: 'var(--ink2)', marginTop: 3 }}>{sub}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
            <ActionPill icon="phone" label="Call" />
            <ActionPill icon="message" label="Message" />
            <ActionPill icon="mail" label="Email" />
            <ActionPill icon="more" label="More" />
          </div>
        </div>

        {/* tabs */}
        <div style={{ display: 'flex', background: '#fff', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, zIndex: 3 }}>
          {[['details', 'Details'], ['sharing', 'Sharing'], ['history', 'History']].map(([k, lbl]) => (
            <button key={k} className="mob-tap" onClick={() => setSeg(k)}
              style={{ flex: 1, height: 44, border: 'none', background: 'transparent', position: 'relative',
                fontSize: 14, fontWeight: seg === k ? 700 : 500, color: seg === k ? 'var(--ink)' : 'var(--mute)' }}>
              {lbl}
              {seg === k && <span style={{ position: 'absolute', left: '22%', right: '22%', bottom: 0, height: 2.5, borderRadius: 2, background: 'var(--green)' }} />}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px 0 120px' }}>
          {seg === 'details' && (
            <>
              <FieldCard>
                {f.phones.map((p, i) => <FieldRow key={i} icon={<MI name="phone" size={18} c="var(--green)" />} label={p.label} value={p.value}
                  last={i === f.phones.length - 1}
                  action={<button className="mob-tap" style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'var(--green-t)', display: 'grid', placeItems: 'center' }}><MI name="phone" size={16} c="var(--green)" /></button>} />)}
              </FieldCard>
              <FieldCard>
                {f.emails.map((e, i) => <FieldRow key={i} icon={<MI name="mail" size={18} c="var(--blue)" />} label={e.label} value={e.value} last={i === f.emails.length - 1} />)}
              </FieldCard>
              {(f.address || f.company || f.birthday) && (
                <FieldCard>
                  {f.company && <FieldRow icon={<MI name="building" size={18} c="var(--ink2)" />} label="Company" value={f.company} />}
                  {f.address && <FieldRow icon={<MI name="tag" size={18} c="var(--ink2)" />} label="Address" value={f.address} last={!f.birthday} />}
                  {f.birthday && <FieldRow icon={<MI name="cake" size={18} c="var(--ink2)" />} label="Birthday" value={f.birthday} last />}
                </FieldCard>
              )}
              {f.note && (
                <FieldCard title="Note">
                  <div style={{ padding: '4px 16px 14px', fontSize: 14, lineHeight: 1.5, color: 'var(--ink)' }}>{f.note}</div>
                </FieldCard>
              )}
            </>
          )}
          {seg === 'sharing' && (
            <FieldCard title="Shared with">
              <FieldRow icon={<MI name="link" size={18} c="var(--green)" />} label="Family · Everyone" value="Read & write" />
              <FieldRow icon={<MI name="link" size={18} c="var(--ink2)" />} label="Public link" value="Off" last />
            </FieldCard>
          )}
          {seg === 'history' && (
            <FieldCard title="Recent activity">
              <FieldRow icon={<MI name="pencil" size={17} c="var(--ink2)" />} label={c.when || '2h ago'} value="Phone number updated" />
              <FieldRow icon={<MI name="refresh" size={17} c="var(--ink2)" />} label="Yesterday" value="Synced from iCloud" last />
            </FieldCard>
          )}
        </div>
      </div>

      {/* edit FAB — only on Details tab */}
      {seg === 'details' && (
        <button className="mob-fab mob-tap" onClick={onEdit} aria-label="Edit contact"
          style={{ position: 'absolute', right: 16, bottom: MOB.navH + MOB.homeH + 16, width: 52, height: 52, borderRadius: '50%',
            border: 'none', background: 'var(--green)', color: '#fff', display: 'grid', placeItems: 'center', zIndex: 40 }}>
          <MI name="pencil" size={22} c="#fff" />
        </button>
      )}
      <BottomNav active={tab} onTab={onTab} activityBadge={3} />
    </div>
  );
}
window.DetailScreen = DetailScreen;

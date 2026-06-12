/* cx-kit.jsx — Kontax production design kit.
   Clean app sans (Geist), straight consistent corners, the real palette.
   Exports tokens, icons, primitives and seed data to window. */

const CX = {
  green: '#17352e', greenT: '#e7efe9',
  blue: '#4158f4', blueT: '#edf0fe',
  ink: '#1d2823', ink2: '#5c655e', mute: '#8b938c', faint: '#aeb4ac',
  line: '#d8ddd6', line2: '#e9ece7',
  bg: '#f6f7f4', paper: '#ffffff', wash: '#f2f4f0',
  amber: '#bf8526', amberT: '#f6edd9',
  red: '#b5472f', redT: '#f3e1da',
  sel: '#edf0fe',
  sans: '"Geist", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};
window.CX = CX;

if (typeof document !== 'undefined' && !document.getElementById('cx-styles')) {
  const s = document.createElement('style');
  s.id = 'cx-styles';
  s.textContent = `
  :root{
    --green:${CX.green}; --green-t:${CX.greenT}; --blue:${CX.blue}; --blue-t:${CX.blueT};
    --ink:${CX.ink}; --ink2:${CX.ink2}; --mute:${CX.mute}; --faint:${CX.faint};
    --line:${CX.line}; --line2:${CX.line2}; --bg:${CX.bg}; --paper:${CX.paper}; --wash:${CX.wash};
    --amber:${CX.amber}; --amber-t:${CX.amberT}; --red:${CX.red}; --red-t:${CX.redT}; --sel:${CX.sel};
  }
  .cx, .cx *{ box-sizing:border-box; }
  .cx{ font-family:${CX.sans}; color:var(--ink); -webkit-font-smoothing:antialiased; }
  .cx button{ font-family:inherit; cursor:pointer; }
  .tnum{ font-variant-numeric:tabular-nums; }
  /* nav + interactive */
  .cx-nav{ display:flex; align-items:center; gap:11px; height:36px; padding:0 10px; border-radius:8px;
    color:var(--ink2); font-size:13.5px; font-weight:500; border:none; background:transparent; width:100%; text-align:left; }
  .cx-nav:hover{ background:var(--wash); }
  .cx-nav[data-active="1"]{ background:var(--green-t); color:var(--green); font-weight:600; }
  .cx-sub{ display:flex; align-items:center; height:30px; padding:0 10px 0 12px; margin-left:17px; border-radius:7px;
    border:none; background:transparent; border-left:2px solid var(--line2); color:var(--ink2); font-size:12.5px; font-weight:500; width:calc(100% - 17px); text-align:left; }
  .cx-sub:hover{ background:var(--wash); }
  .cx-sub[data-active="1"]{ color:var(--ink); font-weight:600; border-left-color:var(--green); background:var(--wash); }
  .cx-side-link{ display:flex; align-items:center; gap:10px; height:32px; padding:0 10px; border-radius:7px; border:none;
    background:transparent; color:var(--mute); font-size:12.5px; font-weight:500; width:100%; text-align:left; }
  .cx-side-link:hover{ background:var(--wash); color:var(--ink2); }
  /* rows */
  .cx-row{ position:relative; cursor:pointer; }
  .cx-row:hover{ background:var(--wash); }
  .cx-row[data-sel="1"]{ background:var(--sel); }
  .cx-row[data-sel="1"]:hover{ background:#e4e9fe; }
  .cx-row .reveal{ opacity:0; transition:opacity .1s; }
  .cx-row:hover .reveal, .cx-row[data-sel="1"] .reveal{ opacity:1; }
  /* avatar/checkbox swap */
  .cx-avbox{ position:relative; width:40px; height:40px; flex:0 0 auto; }
  .cx-avbox .cx-check{ position:absolute; inset:0; opacity:0; }
  .cx-row:hover .cx-avbox .cx-av, .cx-row[data-sel="1"] .cx-avbox .cx-av{ opacity:0; }
  .cx-row:hover .cx-avbox .cx-check, .cx-row[data-sel="1"] .cx-avbox .cx-check{ opacity:1; }
  .cx-thead .cx-check{ opacity:0; transition:opacity .12s; }
  .cx-thead:hover .cx-check, .cx-thead[data-anysel="1"] .cx-check{ opacity:1; }
  .cx-iconbtn{ display:grid; place-items:center; width:30px; height:30px; border-radius:7px; border:none; background:transparent; color:var(--ink2); }
  .cx-iconbtn:hover{ background:rgba(0,0,0,.06); color:var(--ink); }
  .cx-cell{ min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cx-scroll{ overflow-y:auto; scrollbar-width:thin; scrollbar-color:var(--line) transparent; }
  .cx-scroll::-webkit-scrollbar{ width:10px; }
  .cx-scroll::-webkit-scrollbar-thumb{ background:var(--line); border-radius:6px; border:3px solid var(--paper); }
  mark.cx-hl{ background:#fff0bf; color:inherit; border-radius:2px; padding:0 1px; }
  .cx-chip{ display:inline-flex; align-items:center; gap:6px; height:30px; padding:0 11px; border-radius:8px;
    border:1px solid var(--line); background:var(--paper); color:var(--ink2); font-size:12.5px; font-weight:600; }
  .cx-fade-in{ animation:cxIn .14s ease-out; }
  @keyframes cxIn{ from{ opacity:0; transform:translateY(3px);} to{ opacity:1; transform:none;} }
  `;
  document.head.appendChild(s);
}

// ── checkbox component ───────────────────────────────────────────────────────
function Check({ on, indet, onClick, sz = 18 }) {
  return (
    <button className="cx-check" onClick={(e) => { e.stopPropagation(); onClick && onClick(e); }}
      style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', border: 'none', background: 'transparent' }}>
      <span style={{ width: sz, height: sz, borderRadius: 5, display: 'grid', placeItems: 'center',
        border: `1.6px solid ${on || indet ? CX.blue : CX.faint}`, background: on || indet ? CX.blue : CX.paper }}>
        {on && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3L9.5 3.5" /></svg>}
        {indet && !on && <span style={{ width: 8, height: 2, background: '#fff', borderRadius: 1 }} />}
      </span>
    </button>
  );
}
window.Check = Check;

// ── icons ────────────────────────────────────────────────────────────────────
const I = {
  search: ['M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3'],
  people: ['M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5', 'M16 5.2a3 3 0 010 5.6', 'M17.5 14.4c2 .8 3.5 2.3 3.5 4.6'],
  star: ['M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17.8 6.1 20.5l1.3-6.3L2.7 9.6l6.3-.7z'],
  archive: ['M3 7h18v3H3z', 'M5 10v9h14v-9', 'M9.5 13.5h5'],
  merge: ['M7 4v6a5 5 0 005 5h5', 'M14 4v6', 'M14 12l3 3-3 3', 'M7 4v0'],
  edit: ['M4 20h4L19 9l-4-4L4 16z', 'M14 6l4 4'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  plus: ['M12 5v14', 'M5 12h14'],
  bell: ['M18 8a6 6 0 10-12 0c0 7-2 8-2 8h16s-2-1-2-8', 'M10.5 21a1.8 1.8 0 003 0'],
  upload: ['M12 16V4', 'M7 9l5-5 5 5', 'M5 20h14'],
  download: ['M12 4v12', 'M7 11l5 5 5-5', 'M5 20h14'],
  sync: ['M4 9a8 8 0 0114-3l2 2', 'M20 15a8 8 0 01-14 3l-2-2', 'M20 4v4h-4', 'M4 20v-4h4'],
  chevd: ['M6 9l6 6 6-6'], chev: ['M9 6l6 6-6 6'], chevu: ['M6 15l6-6 6 6'],
  gear: ['M12 9a3 3 0 100 6 3 3 0 000-6z', 'M19 12a7 7 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14 2h-4l-.3 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3L10 22h4l.3-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z'],
  back: ['M15 6l-6 6 6 6'], close: ['M6 6l12 12', 'M18 6L6 18'],
  trash: ['M4 7h16', 'M9 7V5h6v2', 'M6 7l1 13h10l1-13'],
  restore: ['M4 9a8 8 0 0114-3l2 2', 'M20 4v4h-4', 'M12 8v5l3 2'],
  warn: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17h.01'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  swap: ['M7 8h11l-3-3', 'M17 16H6l3 3'],
  // status-cluster glyphs (membership / status — shared with sidebar + detail)
  fam: ['M4 11.5L12 5l8 6.5', 'M6 10.3V19h12v-8.7', 'M10 19v-4.6h4V19'],
  team: ['M9 11a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2z', 'M3.5 19c0-2.9 2.4-4.6 5.5-4.6s5.5 1.7 5.5 4.6', 'M16 6.2a2.4 2.4 0 010 4.6', 'M17 14.3c2 .6 3.5 1.9 3.5 4.1'],
  live: ['M12 13a1 1 0 100-2 1 1 0 000 2z', 'M8.7 8.7a4.6 4.6 0 000 6.6', 'M15.3 8.7a4.6 4.6 0 010 6.6', 'M6.2 6.2a8.2 8.2 0 000 11.6', 'M17.8 6.2a8.2 8.2 0 010 11.6'],
  sos: ['M12 20s-6.6-4.2-6.6-9A3.8 3.8 0 0112 7.2 3.8 3.8 0 0118.6 11c0 4.8-6.6 9-6.6 9z', 'M7.6 12.4h2.1l1-1.9 1.7 3.4 1-1.5h2.3'],
};
window.I = I;
function Icon({ name, size = 18, c = CX.ink2, w = 1.7, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
      {(I[name] || []).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
window.Icon = Icon;

// ── avatar ───────────────────────────────────────────────────────────────────
const TINTS = [
  ['#e0ebe2', '#356048'], ['#e6e6f2', '#4f4a9c'], ['#f1e7dd', '#8c5a36'],
  ['#dfeaf0', '#356682'], ['#f0e3e8', '#8e4259'], ['#e6eedd', '#587336'],
  ['#efe8db', '#7a6538'], ['#deedee', '#377572'],
];
function cxInitials(n) { const p = n.trim().split(/\s+/); return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
function cxTint(n) { let h = 0; for (let i = 0; i < n.length; i++) h = (h * 31 + n.charCodeAt(i)) >>> 0; return TINTS[h % TINTS.length]; }
window.cxInitials = cxInitials; window.cxTint = cxTint;
function Avatar({ name, size = 40, cls }) {
  const [bg, fg] = cxTint(name);
  return (
    <div className={cls} style={{ width: size, height: size, borderRadius: '50%', background: bg, color: fg, flex: '0 0 auto',
      display: 'grid', placeItems: 'center', fontWeight: 600, fontSize: size * 0.36 }}>{cxInitials(name)}</div>
  );
}
window.Avatar = Avatar;

function Badge({ children, bg = CX.wash, fg = CX.ink2 }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 18, height: 18, padding: '0 6px',
    borderRadius: 999, background: bg, color: fg, fontSize: 11, fontWeight: 700, lineHeight: 1 }}>{children}</span>;
}
window.Badge = Badge;

function Star({ on, size = 16 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={on ? CX.amber : 'none'} stroke={on ? CX.amber : CX.faint} strokeWidth="1.7" strokeLinejoin="round">
    <path d="M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17.8 6.1 20.5l1.3-6.3L2.7 9.6l6.3-.7z" /></svg>;
}
window.Star = Star;

function Hi({ text, q }) {
  if (!q || !text) return <>{text}</>;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark className="cx-hl">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}
window.Hi = Hi;

// ── seed data ────────────────────────────────────────────────────────────────
let _id = 0;
const C = (name, co, email, phone, x = {}) => ({ id: ++_id, name, co, email, phone, fav: !!x.fav, archived: !!x.archived, upd: x.upd || 0, when: x.when || '', archivedOn: x.archivedOn || '', fam: !!x.fam, team: !!x.team, live: !!x.live, emergency: !!x.emergency });
const CONTACTS = [
  C('Alice Baker', 'Northwind', 'alice.baker@northwind.co', '+44 7700 900112', { fav: true, team: true, upd: 98, when: '2h ago' }),
  C('Andrew Chen', 'Acme Studio', 'andrew@acmestudio.com', '+1 415 555 0142', { upd: 70, when: 'Yesterday' }),
  C('Amara Okafor', 'Lumen Health', 'amara.o@lumenhealth.org', '+1 312 555 0190', { upd: 33, when: '6d ago' }),
  C('Barbara Nguyen', 'Harbor Labs', 'barbara.nguyen@harbor.io', '+1 206 555 0177', { team: true, live: true, upd: 90, when: '5h ago' }),
  C('Ben Sorensen', '', 'ben.sorensen@gmail.com', '+47 922 33 118', { upd: 12, when: '3w ago' }),
  C('Carla Ortiz', 'Blueframe', 'carla@blueframe.io', '+34 612 22 9981', { upd: 81, when: 'Yesterday' }),
  C('Caleb Wright', 'Acme Studio', 'caleb.wright@acmestudio.com', '+1 415 555 0166', { upd: 44, when: '4d ago' }),
  C('Diego Marotta', 'Studio Verde', 'diego@studioverde.it', '+39 333 998 2210', { live: true, upd: 60, when: '2d ago' }),
  C('Elena Petrova', 'Northline Co', 'elena.petrova@northline.co', '+44 7700 900318', { fav: true, fam: true, emergency: true, upd: 95, when: '3h ago' }),
  C('Emeka Obi', '', 'emeka.obi@proton.me', '+234 801 234 5567', { upd: 20, when: '2w ago' }),
  C('Farah Haddad', 'Cedar & Co', 'farah@cedarand.co', '+961 3 884 220', { upd: 55, when: '3d ago' }),
  C('Grace Liu', 'Harbor Labs', 'grace.liu@harbor.io', '+1 206 555 0233', { fam: true, team: true, live: true, emergency: true, upd: 88, when: '6h ago' }),
  C('Hassan Ali', 'Meridian', 'hassan.ali@meridian.com', '+971 50 778 1120', { upd: 40, when: '5d ago' }),
  C('Ines Costa', 'Atlas Bank', 'ines.costa@atlasbank.pt', '+351 912 558 003', { upd: 28, when: '9d ago' }),
  C('James Liu', 'Blueframe', 'james.liu@blueframe.io', '+1 628 555 0101', { fav: true, team: true, upd: 99, when: '1h ago' }),
  C('Jordan Lee', 'Acme Studio', 'jordan.lee@acmestudio.com', '+1 415 555 0102', { upd: 66, when: '2d ago' }),
  C('Kofi Mensah', '', 'kofi.mensah@gmail.com', '+233 24 661 0098', { upd: 18, when: '2w ago' }),
  C('Lucia Romano', 'Studio Verde', 'lucia.romano@studioverde.it', '+39 348 220 7741', { upd: 50, when: '4d ago' }),
  C('Maya Chen', 'Harbor Labs', 'maya.chen@harbor.io', '+49 170 222 8841', { emergency: true, upd: 75, when: 'Yesterday' }),
  C('Nina Patel', 'Northline Co', 'nina.patel@northline.co', '+44 7700 900245', { upd: 62, when: '2d ago' }),
  C('Omar Said', 'Meridian', 'omar.said@meridian.com', '+20 100 552 8841', { upd: 35, when: '6d ago' }),
  C('Priya Raman', 'Lumen Health', 'priya.raman@lumenhealth.org', '+91 98200 11882', { upd: 48, when: '4d ago' }),
  C('Sofia Marino', 'Cedar & Co', 'sofia.marino@cedarand.co', '+39 320 114 8890', { upd: 30, when: '8d ago' }),
  C('Tomas Vega', 'Atlas Bank', 'tomas.vega@atlasbank.pt', '+351 913 220 778', { upd: 25, when: '11d ago' }),
];
const ARCHIVED = [
  C('Victor Hale', 'Old Mill Co', 'victor.hale@oldmill.com', '+1 503 555 0144', { archived: true, archivedOn: 'Archived Apr 2' }),
  C('Wendy Brooks', '', 'wendy.brooks@gmail.com', '+1 503 555 0188', { archived: true, archivedOn: 'Archived Mar 19' }),
  C('Xavier Pons', 'Verde Ltd', 'xavier@verde.es', '+34 645 220 119', { archived: true, archivedOn: 'Archived Feb 27' }),
];
const DUPES = [
  { id: 'd1', a: 'Alice Baker', b: 'Alice C. Baker', conf: 'HIGH', reason: 'Same email · alice.baker@northwind.co' },
  { id: 'd2', a: 'James Liu', b: 'J. Liu', conf: 'HIGH', reason: 'Same phone · +1 628 555 0101' },
  { id: 'd3', a: 'Maya Chen', b: 'Maya Chen', conf: 'MEDIUM', reason: 'Same name · 1 shared phone, different email' },
  { id: 'd4', a: 'Omar Said', b: 'Omar S.', conf: 'LOW', reason: 'Similar name · same company (Meridian)' },
];
window.CONTACTS = CONTACTS; window.ARCHIVED = ARCHIVED; window.DUPES = DUPES;
function lastKey(c) { const p = c.name.trim().split(/\s+/); return (p.length > 1 ? p[p.length - 1] : p[0]).toUpperCase(); }
window.lastKey = lastKey;

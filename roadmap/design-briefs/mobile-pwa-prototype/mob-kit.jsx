/* mob-kit.jsx — Kontax mobile (v2) shared primitives.
   Custom app chrome rendered INSIDE the iOS bezel: mobile header, bottom nav,
   group headers, toast, offline banner. Reuses cx-kit tokens/Avatar/Star/data.
   Exports to window. */

// React hooks — declared ONCE here (babel scripts share global lexical scope),
// referenced by all later mobile files. Do not redeclare elsewhere.
const { useState, useRef, useEffect, useCallback } = React;

const MOB = {
  statusH: 56,   // status-bar safe area at top of the iOS bezel
  homeH: 22,     // home-indicator safe area at the bottom
  headerH: 52,
  navH: 56,
  rowH: 60,
};
window.MOB = MOB;

// ── Lucide-style icon set (24 viewBox, 1.9 stroke) ──────────────────────────
const MIP = {
  layoutList: ['M3 4.5h7v7H3z', 'M14 6h7', 'M14 11h7', 'M3 15.5h7v4H3z', 'M14 16h7', 'M14 19.5h7'],
  activity: ['M22 12h-3.5l-2.5 7-4-15-2.5 8H2'],
  refresh: ['M3 9a8 8 0 0113-3l3 2.5', 'M21 15a8 8 0 01-13 3l-3-2.5', 'M19 3.5V8.5h-5', 'M5 20.5V15.5h5'],
  gear: ['M12 9a3 3 0 100 6 3 3 0 000-6z', 'M19 12a7 7 0 00-.1-1.3l2-1.6-2-3.4-2.4 1a7 7 0 00-2.2-1.3L14 2h-4l-.3 2.4a7 7 0 00-2.2 1.3l-2.4-1-2 3.4 2 1.6A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.6 2 3.4 2.4-1a7 7 0 002.2 1.3L10 22h4l.3-2.4a7 7 0 002.2-1.3l2.4 1 2-3.4-2-1.6c.1-.4.1-.9.1-1.3z'],
  bell: ['M18 8a6 6 0 10-12 0c0 7-2 8-2 8h16s-2-1-2-8', 'M10.5 21a1.8 1.8 0 003 0'],
  search: ['M11 4a7 7 0 105.3 11.7M20 20l-3.7-3.3'],
  star: ['M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.3L12 17.8 6.1 20.5l1.3-6.3L2.7 9.6l6.3-.7z'],
  archive: ['M3 6.5h18v3.5H3z', 'M5 10v9h14v-9', 'M9.5 13.5h5'],
  phone: ['M5 4h3.5l1.8 4.5-2.3 1.4a11 11 0 005.1 5.1l1.4-2.3L19 16v3.5a1.8 1.8 0 01-2 1.8A16 16 0 013.2 7a1.8 1.8 0 011.8-2z'],
  message: ['M21 11.5a8.4 8.4 0 01-9 8 9.9 9.9 0 01-4-.9L3 20l1.9-3.8A8.5 8.5 0 1121 11.5z'],
  mail: ['M4 5h16v14H4z', 'M4 7l8 5.5L20 7'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  pencil: ['M4 20h4L19 9l-4-4L4 16z', 'M14 6l4 4'],
  plus: ['M12 5v14', 'M5 12h14'],
  chevd: ['M6 9l6 6 6-6'], chev: ['M9 6l6 6-6 6'], chevu: ['M6 15l6-6 6 6'],
  back: ['M15 5l-7 7 7 7'], close: ['M6 6l12 12', 'M18 6L6 18'],
  warn: ['M12 4l9 16H3z', 'M12 10v4', 'M12 17h.01'],
  folder: ['M3 7.5A1.5 1.5 0 014.5 6H9l2 2.2h8.5A1.5 1.5 0 0121 9.7V18a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18z'],
  download: ['M12 4v11', 'M7.5 10.5L12 15l4.5-4.5', 'M5 20h14'],
  share: ['M12 3v12', 'M8 7l4-4 4 4', 'M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7'],
  check: ['M5 12.5l4 4 10-10'],
  wifi: ['M2 8.5a15 15 0 0120 0', 'M5 12a11 11 0 0114 0', 'M8.5 15.5a6 6 0 017 0', 'M12 19h.01'],
  wifioff: ['M2 8.5a15 15 0 015-3.4', 'M19 8a15 15 0 012.9 0.5', 'M8.5 15.5a6 6 0 017 0', 'M12 19h.01', 'M3 3l18 18'],
  link: ['M9.5 14.5l5-5', 'M8 12l-2 2a3.5 3.5 0 005 5l2-2', 'M16 12l2-2a3.5 3.5 0 00-5-5l-2 2'],
  cake: ['M4 20h16v-7H4z', 'M4 13c1.5 0 1.5 1.5 3 1.5S8.5 13 10 13s1.5 1.5 3 1.5S15.5 13 17 13s1.5 1.5 3 1.5', 'M8 9.5V6.5', 'M12 9.5V6.5', 'M16 9.5V6.5', 'M8 4.5h.01', 'M12 4.5h.01', 'M16 4.5h.01'],
  note: ['M5 4h14v11l-5 5H5z', 'M14 20v-5h5'],
  building: ['M4 21V5l8-2v18', 'M12 21V9l6 2v10', 'M7 8h.01', 'M7 12h.01', 'M7 16h.01', 'M15 13h.01', 'M15 17h.01'],
  tag: ['M3 11l8-8 9 .5.5 9-8 8z', 'M7.5 7.5h.01'],
};
window.MIP = MIP;
function MI({ name, size = 22, c = 'var(--ink2)', w = 1.9, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={c} strokeWidth={w}
      strokeLinecap="round" strokeLinejoin="round">
      {(MIP[name] || []).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
window.MI = MI;

// ── status-bar spacer (sits under the bezel's absolute status bar) ──────────
function StatusSpacer({ bg = '#fff' }) {
  return <div style={{ height: MOB.statusH, flex: '0 0 auto', background: bg }} />;
}
window.StatusSpacer = StatusSpacer;

// ── primary mobile header (home / contact-list screen) ──────────────────────
function MobHeader({ unread = 3, onSearch, onBell }) {
  return (
    <header style={{ height: MOB.headerH, flex: '0 0 auto', display: 'flex', alignItems: 'center',
      gap: 12, padding: '0 16px', background: '#fff', borderBottom: '1px solid var(--line)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--green)', color: 'var(--green-t)',
          display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700 }}>K</div>
        <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.018em', color: 'var(--green)' }}>Kontax</span>
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
        <button className="mob-tap" onClick={onBell} aria-label="Notifications"
          style={{ position: 'relative', width: 44, height: 44, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent' }}>
          <MI name="bell" size={22} c="var(--ink2)" />
          {unread > 0 && <span style={{ position: 'absolute', top: 7, right: 8, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center', border: '1.5px solid #fff' }}>{unread}</span>}
        </button>
        <button className="mob-tap" onClick={onSearch} aria-label="Search"
          style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent' }}>
          <MI name="search" size={22} c="var(--ink2)" />
        </button>
      </div>
    </header>
  );
}
window.MobHeader = MobHeader;

// ── secondary-screen header (back + title + optional action) ────────────────
function SubHeader({ title, onBack, action, compact }) {
  return (
    <header style={{ height: MOB.headerH, flex: '0 0 auto', display: 'flex', alignItems: 'center',
      gap: 4, padding: '0 6px 0 4px', background: '#fff', borderBottom: '1px solid var(--line)' }}>
      <button className="mob-tap" onClick={onBack} aria-label="Back"
        style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent' }}>
        <MI name="back" size={24} c="var(--ink)" />
      </button>
      <span style={{ flex: 1, fontSize: 16, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap', opacity: compact ? 1 : 0.0, transition: 'opacity .18s' }}>{title}</span>
      <div style={{ flex: '0 0 auto' }}>{action}</div>
    </header>
  );
}
window.SubHeader = SubHeader;

// ── bottom navigation bar (4 tabs, active dot, badges) ──────────────────────
function BottomNav({ active = 'contacts', onTab, activityBadge = 3, syncBadge = 0 }) {
  const tabs = [
    ['contacts', 'Contacts', 'layoutList', 0],
    ['activity', 'Activity', 'activity', activityBadge],
    ['sync', 'Sync', 'refresh', syncBadge],
    ['settings', 'Settings', 'gear', 0],
  ];
  return (
    <nav style={{ flex: '0 0 auto', background: '#fff', borderTop: '1px solid var(--line)',
      paddingBottom: MOB.homeH, display: 'flex' }}>
      {tabs.map(([key, label, icon, badge]) => {
        const on = active === key;
        const c = on ? 'var(--green)' : 'var(--mute)';
        return (
          <button key={key} className="mob-tap" onClick={() => onTab && onTab(key)}
            style={{ flex: 1, height: MOB.navH, border: 'none', background: 'transparent', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative' }}>
            <span style={{ height: 4, display: 'flex', alignItems: 'center' }}>
              {on && <span style={{ width: 4, height: 4, borderRadius: 4, background: 'var(--green)' }} />}
            </span>
            <span style={{ position: 'relative' }}>
              <MI name={icon} size={24} c={c} w={on ? 2 : 1.8} fill={icon === 'star' && on ? 'var(--green)' : 'none'} />
              {badge > 0 && <span style={{ position: 'absolute', top: -5, right: -8, minWidth: 16, height: 16, padding: '0 4px',
                borderRadius: 8, background: key === 'sync' ? 'var(--red)' : 'var(--red)', color: '#fff', fontSize: 10,
                fontWeight: 700, display: 'grid', placeItems: 'center', border: '1.5px solid #fff' }}>{badge}</span>}
            </span>
            <span style={{ fontSize: 10, fontWeight: 600, color: c, letterSpacing: '0.01em' }}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
window.BottomNav = BottomNav;

// ── group header (alphabetical / favourites) ────────────────────────────────
function GroupHeader({ label, icon }) {
  return (
    <div style={{ height: 28, display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px',
      background: 'var(--wash)', position: 'sticky', top: 0, zIndex: 2 }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.04em' }}>{label}</span>
    </div>
  );
}
window.GroupHeader = GroupHeader;

// ── toast (confirmation, with optional undo) ────────────────────────────────
function Toast({ text, actionLabel, onAction, onClose }) {
  return (
    <div className="mob-toast" style={{ position: 'absolute', left: 16, right: 16, bottom: MOB.navH + MOB.homeH + 12,
      zIndex: 80, background: 'var(--ink)', color: '#fff', borderRadius: 12, height: 48, display: 'flex',
      alignItems: 'center', gap: 12, padding: '0 8px 0 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.22)' }}>
      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{text}</span>
      {actionLabel && (
        <button onClick={onAction} style={{ height: 34, padding: '0 12px', borderRadius: 8, border: 'none',
          background: 'rgba(255,255,255,0.16)', color: '#fff', fontSize: 13, fontWeight: 700 }}>{actionLabel}</button>
      )}
    </div>
  );
}
window.Toast = Toast;

// ── offline banner ──────────────────────────────────────────────────────────
function OfflineBanner() {
  return (
    <div style={{ flex: '0 0 auto', background: 'var(--amber-t)', borderBottom: '1px solid #ecdcb6',
      display: 'flex', alignItems: 'center', gap: 9, padding: '9px 16px' }}>
      <MI name="wifioff" size={17} c="#8a6a1e" />
      <span style={{ fontSize: 12.5, fontWeight: 500, color: '#6f5417', lineHeight: 1.3 }}>
        You're offline. Showing your last synced contacts.
      </span>
    </div>
  );
}
window.OfflineBanner = OfflineBanner;

// shared interactive styles
if (typeof document !== 'undefined' && !document.getElementById('mob-styles')) {
  const s = document.createElement('style');
  s.id = 'mob-styles';
  s.textContent = `
  .mob, .mob *{ box-sizing:border-box; }
  .mob{ font-family:${window.CX ? CX.sans : 'system-ui'}; -webkit-font-smoothing:antialiased; }
  .mob button{ font-family:inherit; cursor:pointer; }
  .mob-tap{ -webkit-tap-highlight-color:transparent; }
  .mob-tap:active{ opacity:.55; }
  .mob-scroll{ overflow-y:auto; -webkit-overflow-scrolling:touch; scrollbar-width:none; }
  .mob-scroll::-webkit-scrollbar{ width:0; height:0; }
  .mob-toast{ animation:mobToast .26s cubic-bezier(.2,.7,.2,1); }
  @keyframes mobToast{ from{ opacity:0; transform:translateY(10px);} to{ opacity:1; transform:none;} }
  @keyframes mobSheetUp{ from{ transform:translateY(100%);} to{ transform:translateY(0);} }
  @keyframes mobFade{ from{ opacity:0;} to{ opacity:1;} }
  .mob-fab{ box-shadow:0 6px 18px rgba(23,53,46,0.3), 0 2px 5px rgba(0,0,0,0.12); transition:transform .14s; }
  .mob-fab:active{ transform:scale(.92); }
  `;
  document.head.appendChild(s);
}

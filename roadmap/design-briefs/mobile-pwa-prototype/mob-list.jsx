/* mob-list.jsx — Kontax mobile contact list.
   60px rows, live swipe-to-reveal actions (Favourite / Archive) with a 40%-of-width
   snap threshold, alphabetical group headers, pinned favourites, empty state. */

function SwipeRow({ c, q = '', fav, onOpen, onArchive, onToggleFav, locked, initialOpen }) {
  const ACTIONS_W = 168; // two 84px actions
  const [dx, setDx] = useState(initialOpen ? -168 : 0);
  const [anim, setAnim] = useState(false);
  const start = useRef(null);
  const moved = useRef(false);
  const rowRef = useRef(null);

  const snap = useCallback((to) => { setAnim(true); setDx(to); }, []);

  function onDown(e) {
    if (locked) return;
    start.current = { x: e.clientX, base: dx };
    moved.current = false;
    setAnim(false);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  }
  function onMove(e) {
    if (!start.current) return;
    const delta = e.clientX - start.current.x;
    if (Math.abs(delta) > 4) moved.current = true;
    let nx = start.current.base + delta;
    nx = Math.min(0, nx);
    if (nx < -ACTIONS_W) nx = -ACTIONS_W + (nx + ACTIONS_W) * 0.32; // rubber-band
    setDx(nx);
  }
  function onUp() {
    if (!start.current) return;
    start.current = null;
    const rowW = rowRef.current ? rowRef.current.offsetWidth : 370;
    // 40% of row width exposed → snap open, else snap closed
    snap(-dx >= rowW * 0.4 ? -ACTIONS_W : 0);
  }
  function fg() { return rowRef.current ? rowRef.current.offsetWidth : 370; }

  function vibrate() { try { navigator.vibrate && navigator.vibrate(10); } catch (_) {} }
  function doArchive() { vibrate(); snap(-fg()); setTimeout(() => onArchive(c), 180); }
  function doFav() { vibrate(); onToggleFav(c); snap(0); }

  const second = c.co || c.email;
  const open = dx < -4;

  return (
    <div ref={rowRef} style={{ position: 'relative', height: MOB.rowH, overflow: 'hidden', background: '#fff' }}>
      {/* revealed actions */}
      <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: ACTIONS_W, display: 'flex' }}>
        <button onClick={doFav} style={{ width: ACTIONS_W / 2, border: 'none', background: 'var(--green)', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <MI name="star" size={21} c="#fff" fill={fav ? '#fff' : 'none'} />
          <span style={{ fontSize: 11, fontWeight: 600 }}>{fav ? 'Unstar' : 'Favourite'}</span>
        </button>
        <button onClick={doArchive} style={{ width: ACTIONS_W / 2, border: 'none', background: 'var(--red)', color: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <MI name="archive" size={21} c="#fff" />
          <span style={{ fontSize: 11, fontWeight: 600 }}>Archive</span>
        </button>
      </div>
      {/* foreground */}
      <div
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onClick={() => { if (moved.current) return; if (open) { snap(0); return; } onOpen(c); }}
        style={{ position: 'absolute', inset: 0, background: '#fff', display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 8px 0 16px', transform: `translateX(${dx}px)`, transition: anim ? 'transform .26s cubic-bezier(.2,.8,.2,1)' : 'none',
          touchAction: 'pan-y' }}>
        <Avatar name={c.name} size={42} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <Hi text={c.name} q={q} />
            </span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--mute)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            {second}
          </div>
        </div>
        {/* star tap area — rightmost 44px */}
        <button className="mob-tap" onClick={(e) => { e.stopPropagation(); doFav(); }} aria-label="Favourite"
          style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', border: 'none', background: 'transparent', flex: '0 0 auto' }}>
          <Star on={fav} size={19} />
        </button>
      </div>
    </div>
  );
}
window.SwipeRow = SwipeRow;

function ListEmpty() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 14, padding: '0 40px', textAlign: 'center' }}>
      <div style={{ width: 64, height: 64, borderRadius: 18, background: 'var(--wash)', display: 'grid', placeItems: 'center' }}>
        <MI name="layoutList" size={28} c="var(--faint)" />
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)' }}>No contacts yet</div>
        <div style={{ fontSize: 13.5, color: 'var(--mute)', marginTop: 5, lineHeight: 1.5 }}>
          Add your first contact, or import from a CSV or vCard file to get started.
        </div>
      </div>
    </div>
  );
}

function ListScreen({ tab, offline, listEmpty, onOpen, onBell, onSearch, onTab, onAdd, onToast }) {
  const [favs, setFavs] = useState(() => new Set(CONTACTS.filter((c) => c.fav).map((c) => c.id)));
  const [archived, setArchived] = useState(() => new Set());

  const toggleFav = (c) => setFavs((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; });
  const archive = (c) => { setArchived((s) => new Set(s).add(c.id)); onToast({ text: 'Contact archived.', actionLabel: 'Undo',
    onAction: () => setArchived((s) => { const n = new Set(s); n.delete(c.id); return n; }) }); };

  const live = CONTACTS.filter((c) => !archived.has(c.id));
  const favList = live.filter((c) => favs.has(c.id)).sort((a, b) => lastKey(a).localeCompare(lastKey(b)));
  const groups = {};
  [...live].sort((a, b) => lastKey(a).localeCompare(lastKey(b)) || a.name.localeCompare(b.name))
    .forEach((c) => { const k = lastKey(c)[0]; (groups[k] ||= []).push(c); });
  const letters = Object.keys(groups).sort();

  return (
    <div className="mob" style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <StatusSpacer />
      <MobHeader unread={3} onBell={onBell} onSearch={onSearch} />
      {offline && <OfflineBanner />}
      {listEmpty ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}><ListEmpty /></div>
      ) : (
        <div className="mob-scroll" style={{ flex: 1, position: 'relative' }}>
          {favList.length > 0 && (
            <>
              <GroupHeader label="Favourites" icon={<Star on size={12} />} />
              {favList.map((c) => <SwipeRow key={'f' + c.id} c={c} fav={favs.has(c.id)} onOpen={onOpen}
                onArchive={archive} onToggleFav={toggleFav} locked={offline} />)}
            </>
          )}
          {letters.map((L) => (
            <div key={L}>
              <GroupHeader label={L} />
              {groups[L].map((c) => <SwipeRow key={c.id} c={c} fav={favs.has(c.id)} onOpen={onOpen}
                onArchive={archive} onToggleFav={toggleFav} locked={offline} />)}
            </div>
          ))}
          <div style={{ height: 12 }} />
        </div>
      )}
      {/* FAB — add contact (hidden when offline editing disabled) */}
      <button className="mob-fab mob-tap" onClick={onAdd} aria-label="New contact"
        style={{ position: 'absolute', right: 16, bottom: MOB.navH + MOB.homeH + 16, width: 56, height: 56, borderRadius: '50%',
          border: 'none', background: offline ? 'var(--faint)' : 'var(--green)', color: '#fff', display: 'grid', placeItems: 'center', zIndex: 40 }}>
        <MI name="plus" size={26} c="#fff" w={2.2} />
      </button>
      <BottomNav active={tab} onTab={onTab} activityBadge={3} syncBadge={offline ? 1 : 0} />
    </div>
  );
}
window.ListScreen = ListScreen;

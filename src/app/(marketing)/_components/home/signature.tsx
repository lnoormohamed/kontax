// P50-03 · Direction A signature: "three into one". The same person saved
// in Google, iCloud and Fastmail, wired into one Kontax contact (each field
// tagged with where it came from) that syncs back to iPhone, Mac and Google.
//
// The markup IS the final frame and is server-rendered, so no-JS and
// reduced-motion visitors see the complete picture. The inline script below
// runs during HTML parse (before hydration, so no flash): it adds `.pre` (the
// start state) and removes it two frames after the panel scrolls into view;
// CSS transitions on transform/opacity do the rest (~1.8 s, once). It never
// runs when the OS asks for reduced motion (unless the user opted back in,
// data-motion="on") or when the Kontax motion preference is "off".
//
// Accessibility: one role="img" with a text alternative; the drawing inside
// is aria-hidden. Mobile shows one source card plus a caption (CSS only).

const PLAY = `(function(){var s=document.getElementById("hp-sig");if(!s||s.dataset.played)return;s.dataset.played="1";var r=document.documentElement,m=r.getAttribute("data-motion");if(m==="off"||(m!=="on"&&window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))return;function go(){s.getBoundingClientRect();requestAnimationFrame(function(){requestAnimationFrame(function(){s.classList.remove("pre")})})}s.classList.add("pre");if(!("IntersectionObserver" in window)){go();return}var o=new IntersectionObserver(function(e){if(e[0].isIntersecting){o.disconnect();go()}},{threshold:0.2});o.observe(s);setTimeout(function(){o.disconnect();s.classList.remove("pre")},8000)})();`;

const SOURCES = [
  { glyph: "G", name: "Ben Nakamura", tag: "Google", field: "ben.nakamura@acme.co" },
  { glyph: "iC", name: "Ben N.", tag: "iCloud", field: "+44 7700 900123" },
  { glyph: "F", name: "B. Nakamura", tag: "Fastmail", field: "Acme Ltd" },
];

const FIELDS = [
  { k: "Mobile", v: "+44 7700 900123", src: "iCloud" },
  { k: "Email", v: "ben.nakamura@acme.co", src: "Google" },
  { k: "Company", v: "Acme Ltd", src: "Fastmail" },
  { k: "Labels", v: "Work · Suppliers", src: "Google" },
];

const DEVICES = [
  { glyph: "K", name: "iPhone Contacts" },
  { glyph: "K", name: "Mac Contacts" },
  { glyph: "G", name: "Google Contacts" },
];

export function Signature() {
  return (
    <div className="mkt-container">
      <div
        className="hp-sig"
        id="hp-sig"
        // The inline script toggles `pre`/`data-played` before hydration.
        suppressHydrationWarning
        role="img"
        aria-label="Three copies of the same contact, from Google, iCloud and Fastmail, merged into one Kontax contact that syncs to iPhone, Mac and Google."
      >
        <div className="hp-sig__g" aria-hidden="true">
          <div className="hp-sig__src">
            {SOURCES.map((s) => (
              <div className="hp-sc" key={s.tag}>
                <span className="hp-glyph">{s.glyph}</span>
                <span className="hp-vname">{s.name}</span>
                <span className="hp-sc__t">{s.tag}</span>
                <span className="hp-sc__f">{s.field}</span>
              </div>
            ))}
            <p className="hp-sig__more">+ the same person in iCloud and Fastmail</p>
          </div>

          <div className="hp-sig__wire">
            <svg className="mkt-wire" viewBox="0 0 96 300" preserveAspectRatio="none" focusable="false">
              <path vectorEffect="non-scaling-stroke" d="M0,52 C54,52 42,150 96,150" />
              <path vectorEffect="non-scaling-stroke" d="M0,150 L96,150" />
              <path vectorEffect="non-scaling-stroke" d="M0,248 C54,248 42,150 96,150" />
            </svg>
          </div>

          <div className="hp-mc">
            <div className="hp-mc__h">
              <span className="hp-av hp-av-e hp-av--lg">BN</span>
              <div>
                <div className="hp-mc__n">Ben Nakamura</div>
                <div className="hp-mc__s">One contact, from three records</div>
              </div>
            </div>
            <dl className="hp-mc__fields">
              {FIELDS.map((f) => (
                <div className="hp-mc__f" key={f.k}>
                  <dt>{f.k}</dt>
                  <dd>{f.v}</dd>
                  <em className="mkt-srctag">{f.src}</em>
                </div>
              ))}
            </dl>
            <div className="hp-mc__foot">
              <span>Merged just now · undo for 30 days</span>
              <span className="hp-vbtn hp-vbtn--line">Undo</span>
            </div>
          </div>

          <div className="hp-sig__out">
            <p>Syncs back to</p>
            {DEVICES.map((d) => (
              <div className="hp-dev" key={d.name}>
                <span className={`hp-glyph${d.glyph === "K" ? " hp-glyph--k" : ""}`}>{d.glyph}</span>
                {d.name}
                <span className="hp-ok">✓ now</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: PLAY }} />
    </div>
  );
}

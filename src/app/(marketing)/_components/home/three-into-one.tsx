import { CheckIcon, SourceTag, Wire } from "../mkt-ui";

// P50-03 · The Direction A signature, "three into one": the same person saved
// in Google, iCloud and Fastmail, wired into one Kontax contact (each field
// tagged with its source) that syncs back to iPhone, Mac and Google.
//
// The server-rendered markup IS the final frame. The inline script below adds
// `.is-pre` (the start state) during parsing and removes it two frames later,
// so the CSS transitions in homepage.css play once (~1.8 s, transform and
// opacity only). With reduced motion, the "Animations: off" preference, no JS,
// or a client-side navigation (React never runs inserted scripts) nothing is
// hidden and nothing moves. One text alternative on the panel; everything
// inside is aria-hidden.

const SIG_ID = "hp-sig";

// Paths meet the three source cards' centres (card ≈ 66px tall, 12px gap →
// 15% / 50% / 85% of the column) and converge on the merged card.
const WIRE_PATHS = [
  "M0,45 C54,45 42,150 96,150",
  "M0,150 L96,150",
  "M0,255 C54,255 42,150 96,150",
] as const;

const PLAY_ONCE = `(function(){var s=document.getElementById("${SIG_ID}");if(!s)return;var m=document.documentElement.dataset.motion;if(m==="off"||(m!=="on"&&window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches))return;s.classList.add("is-pre");s.getBoundingClientRect();requestAnimationFrame(function(){requestAnimationFrame(function(){s.classList.remove("is-pre")})})})();`;

const SOURCES = [
  { glyph: "G", name: "Ben Nakamura", source: "Google", field: "ben.nakamura@acme.co" },
  { glyph: "iC", name: "Ben N.", source: "iCloud", field: "+44 7700 900123" },
  { glyph: "F", name: "B. Nakamura", source: "Fastmail", field: "Acme Ltd" },
] as const;

const FIELDS = [
  { label: "Mobile", value: "+44 7700 900123", source: "iCloud" },
  { label: "Email", value: "ben.nakamura@acme.co", source: "Google" },
  { label: "Company", value: "Acme Ltd", source: "Fastmail" },
  { label: "Labels", value: "Work · Suppliers", source: "Google" },
] as const;

const DEVICES = [
  { glyph: "K", name: "iPhone Contacts" },
  { glyph: "K", name: "Mac Contacts" },
  { glyph: "G", name: "Google Contacts" },
] as const;

export function ThreeIntoOne() {
  return (
    <>
      <div
        className="hp-sig"
        id={SIG_ID}
        role="img"
        aria-label="Three copies of the same contact, from Google, iCloud and Fastmail, merged into one Kontax contact that syncs to iPhone, Mac and Google."
        // The inline script toggles a class before hydration.
        suppressHydrationWarning
      >
        <div className="hp-sig__g" aria-hidden="true">
          <div className="hp-sig__in">
            <div className="hp-sig__src">
              {SOURCES.map((s) => (
                <div className="hp-sc" key={s.source}>
                  <span className="hp-glyph">{s.glyph}</span>
                  <span className="hp-nm">{s.name}</span>
                  <span className="hp-sc__t">{s.source}</span>
                  <span className="hp-sc__f">{s.field}</span>
                </div>
              ))}
              <p className="hp-sig__more">+ the same person in iCloud and Fastmail</p>
            </div>
            <Wire className="hp-sig__wire" paths={WIRE_PATHS} />
          </div>

          <div className="hp-mc">
            <div className="hp-mc__h">
              <span className="hp-av hp-av5">BN</span>
              <div>
                <div className="hp-mc__n">Ben Nakamura</div>
                <div className="hp-mc__s">One contact, from three records</div>
              </div>
            </div>
            <dl className="hp-mc__dl">
              {FIELDS.map((f) => (
                <div className="hp-mc__f" key={f.label}>
                  <dt>{f.label}</dt>
                  <dd>{f.value}</dd>
                  <SourceTag>{f.source}</SourceTag>
                </div>
              ))}
            </dl>
            <div className="hp-mc__foot">
              <span>Merged just now · undo for 30 days</span>
              <span className="hp-vbtn">Undo</span>
            </div>
          </div>

          <div className="hp-sig__out">
            <p>Syncs back to</p>
            {DEVICES.map((d) => (
              <div className="hp-dev" key={d.name}>
                <span className="hp-glyph">{d.glyph}</span>
                <span className="hp-dev__n">{d.name}</span>
                <span className="hp-ok">
                  <CheckIcon size={12} />
                  now
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: PLAY_ONCE }} />
    </>
  );
}

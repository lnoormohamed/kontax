import { Icon } from "./icons";
import { MktWindow } from "./window";

// P49-02 · §3 How it works — the target of the hero's "See how it works".
// Numbered because it is a real sequence. Stacks vertically below 980px.

export function HowItWorks() {
  return (
    <section className="hp-band hp-band--surface" id="how">
      <div className="hp-container">
        <div className="hp-section-head hp-section-head--center">
          <p className="hp-section-kicker">How it works</p>
          <h2 className="hp-section-title">From three address books to one, in an afternoon</h2>
        </div>
        <ol className="hp-steps">
          <li className="hp-step hp-rise">
            <div className="hp-step__head">
              <span className="hp-step__num" aria-hidden="true">1</span>
              <h3 className="hp-step__title">Bring your contacts in</h3>
              <p className="hp-step__body">
                Connect Google, iCloud or Fastmail, or import a CSV or vCard file.
              </p>
            </div>
            <MktWindow>
              <p className="hp-v-label">Add a source</p>
              <div className="hp-src-grid">
                <div className="hp-src hp-src--sel">
                  <span className="hp-glyph">G</span>Google
                </div>
                <div className="hp-src">
                  <span className="hp-glyph">iC</span>iCloud
                </div>
                <div className="hp-src">
                  <span className="hp-glyph">F</span>Fastmail
                </div>
                <div className="hp-src">
                  <span className="hp-glyph">
                    <Icon name="file" size={14} />
                  </span>
                  CSV / vCard
                </div>
              </div>
            </MktWindow>
          </li>
          <li className="hp-step hp-rise">
            <div className="hp-step__head">
              <span className="hp-step__num" aria-hidden="true">2</span>
              <h3 className="hp-step__title">Kontax tidies them up</h3>
              <p className="hp-step__body">
                Duplicates found and merged, phone numbers formatted for their country, names
                sorted properly in any script.
              </p>
            </div>
            <MktWindow>
              <div className="hp-merge-card">
                <div className="hp-merge-card__t">
                  <Icon name="sync" size={15} style={{ color: "var(--hp-amber)" }} />2 contacts
                  look like the same person
                </div>
                <div className="hp-merge-card__pair">
                  <span className="hp-av hp-av-e">BN</span>
                  <span className="hp-av hp-av-e">BN</span>
                  <div>
                    <div className="hp-vname">Ben Nakamura</div>
                    <div className="hp-vsub">Same phone · similar email</div>
                  </div>
                </div>
                <div className="hp-merge-card__acts">
                  <span className="hp-vbtn hp-vbtn--solid">Review merge</span>
                  <span className="hp-vbtn hp-vbtn--line">Not the same</span>
                </div>
              </div>
            </MktWindow>
          </li>
          <li className="hp-step hp-rise">
            <div className="hp-step__head">
              <span className="hp-step__num" aria-hidden="true">3</span>
              <h3 className="hp-step__title">They stay in sync everywhere</h3>
              <p className="hp-step__body">
                Add Kontax to the Contacts app on your iPhone or Mac with an app password.
                Changes flow both ways.
              </p>
            </div>
            <MktWindow>
              <div className="hp-ios">
                <div className="hp-ios__h">Accounts</div>
                <div className="hp-ios__list">
                  <div className="hp-ios__row">
                    <span className="hp-ios__k">K</span>Kontax<em>Contacts</em>
                  </div>
                  <div className="hp-ios__row">
                    <span className="hp-glyph hp-glyph--ios">iC</span>iCloud<em>Off</em>
                  </div>
                </div>
              </div>
              <span className="hp-sync-chip">
                <i />
                iPhone synced · 2 min ago
              </span>
            </MktWindow>
          </li>
        </ol>
      </div>
    </section>
  );
}

import { SectionHead, WindowFrame } from "../mkt-ui";
import { Icon } from "./icons";

// P49-02 / P50-03 · §01 How it works — the target of the hero's "See how it
// works". Numbered because it is a real sequence. Stacks below 980px.

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="hp-step">
      <div>
        <p className="hp-step__n" aria-hidden="true">
          {n}
        </p>
        <h3 className="hp-step__t">{title}</h3>
        <p className="hp-step__b">{body}</p>
      </div>
      {children}
    </li>
  );
}

export function HowItWorks() {
  return (
    <section className="mkt-band mkt-band--stone" id="how">
      <div className="mkt-container">
        <SectionHead
          index="01"
          label="How it works"
          title="From three address books to one, in an afternoon"
        />
        <ol className="hp-steps">
          <Step n={1} title="Bring your contacts in" body="Connect Google, iCloud or Fastmail, or import a CSV file or a Kontax archive.">
            <WindowFrame>
              <p className="hp-vl">Add a source</p>
              <div className="hp-srcg">
                <div className="hp-src hp-src--on">
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
            </WindowFrame>
          </Step>
          <Step
            n={2}
            title="Kontax tidies them up"
            body="Duplicates found and merged, phone numbers formatted for their country, names sorted properly in any script."
          >
            <WindowFrame>
              <p className="hp-nm hp-merge__t">
                <Icon name="sync" size={15} />2 contacts look like the same person
              </p>
              <div className="hp-row hp-merge__pair">
                <span className="hp-stack">
                  <span className="hp-av hp-av5">BN</span>
                  <span className="hp-av hp-av5">BN</span>
                </span>
                <div className="hp-row__m">
                  <div className="hp-nm">Ben Nakamura</div>
                  <div className="hp-sb">Same phone · similar email</div>
                </div>
              </div>
              <div className="hp-merge__acts">
                <span className="hp-vbtn hp-vbtn--s">Review merge</span>
                <span className="hp-vbtn">Not the same</span>
              </div>
            </WindowFrame>
          </Step>
          <Step
            n={3}
            title="They stay in sync everywhere"
            body="Add Kontax to the Contacts app on your iPhone or Mac with an app password. Changes flow both ways."
          >
            <WindowFrame>
              <div className="hp-ios">
                <div className="hp-ios__h">Accounts</div>
                <div className="hp-ios__l">
                  <div className="hp-ios__r">
                    <span className="hp-ios__k">K</span>Kontax<em>Contacts</em>
                  </div>
                  <div className="hp-ios__r">
                    <span className="hp-ios__k hp-ios__k--off">iC</span>iCloud<em>Off</em>
                  </div>
                </div>
              </div>
              <span className="mkt-chip hp-ios__chip">iPhone synced · 2 min ago</span>
            </WindowFrame>
          </Step>
        </ol>
      </div>
    </section>
  );
}

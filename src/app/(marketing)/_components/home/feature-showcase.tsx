import Link from "next/link";

import { MktWindow, SectionHead } from "../mkt-ui";
import { Icon, type HomeIconName } from "./icons";

// P49-03 · §4 Feature showcase — replaces the six equal tiles. Three
// alternating rows for the reasons people switch, then a chrome-less 3×2
// grid (2 columns below 980px). P50-03: Direction A 5/7 rows, h3 scale.

function FeatureRow({
  kicker,
  title,
  body,
  points,
  flip = false,
  children,
}: {
  kicker: string;
  title: string;
  body: string;
  points: [string, string];
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`hp-frow${flip ? " hp-frow--flip" : ""}`}>
      <div className="hp-frow__text">
        <p className="hp-frow__kicker">{kicker}</p>
        <h3 className="hp-frow__title">{title}</h3>
        <p className="hp-frow__body">{body}</p>
        <ul className="hp-frow__list">
          {points.map((point) => (
            <li key={point}>
              <Icon name="check" size={16} />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className="hp-frow__media">{children}</div>
    </div>
  );
}

function SyncedAt({ when }: { when: string }) {
  return (
    <span className="hp-ok">
      <Icon name="check" size={13} />
      <span className="hp-vmono">{when}</span>
    </span>
  );
}

const GRID: { icon: HomeIconName; title: string; body: string }[] = [
  { icon: "search", title: "Search", body: "Find anyone by name, email, phone or company as you type." },
  { icon: "tag", title: "Labels", body: "Group contacts your way and filter in one tap." },
  { icon: "card", title: "Public card", body: "A shareable page with the details you choose to publish." },
  { icon: "clock", title: "Change history", body: "See what changed on each contact, when, and from where." },
  { icon: "file", title: "Open export format", body: "A documented format that keeps labels, notes and history." },
  { icon: "code", title: "Developer API", body: "Read and write your contacts from your own tools." },
];

export function FeatureShowcase() {
  return (
    <section className="mkt-band" id="features">
      <div className="mkt-container">
        <SectionHead
          n="02"
          label="Why people switch"
          title="The things your built-in address book never quite did"
        />

        <FeatureRow
          kicker="Sync"
          title="One address book, on every device"
          body="Connect Google, iCloud and Fastmail and Kontax brings them into one address book, syncing both ways. On iPhone and Mac it appears in the Contacts app you already use."
          points={["Two-way sync, not a one-off import", "No app to install on iPhone or Mac"]}
        >
          <MktWindow bar="Settings · Sync">
            <p className="hp-v-label">Connections</p>
            <div className="hp-vrow">
              <span className="hp-glyph">G</span>
              <div className="hp-vrow__main">
                <div className="hp-vname">Google Contacts</div>
                <div className="hp-vsub">lina@gmail.com</div>
              </div>
              <SyncedAt when="4 min ago" />
            </div>
            <div className="hp-vrow">
              <span className="hp-glyph">iC</span>
              <div className="hp-vrow__main">
                <div className="hp-vname">iCloud</div>
                <div className="hp-vsub">lina@icloud.com</div>
              </div>
              <SyncedAt when="4 min ago" />
            </div>
            <div className="hp-vrow">
              <span className="hp-glyph">
                <Icon name="card" size={15} />
              </span>
              <div className="hp-vrow__main">
                <div className="hp-vname">Lina&apos;s iPhone</div>
                <div className="hp-vsub">CardDAV · app password</div>
              </div>
              <SyncedAt when="just now" />
            </div>
          </MktWindow>
        </FeatureRow>

        <FeatureRow
          flip
          kicker="Clean-up"
          title="Duplicates, found and fixed"
          body="Kontax spots the same person saved twice across your accounts, shows you both records side by side, and lets you pick what to keep. Every merge can be undone."
          points={["Phone numbers formatted for their country", "Names in any script sorted correctly"]}
        >
          <MktWindow bar="Review merge">
            <div className="hp-mg">
              <div className="hp-mg__col">
                <div className="hp-mg__head">
                  <span className="hp-av hp-av--sm hp-av-e">BN</span>
                  <span className="hp-vname">Ben Nakamura</span>
                </div>
                <MergeField on label="Phone" value="+44 7700 900 123" />
                <MergeField label="Email" value="ben@acme.co" />
                <MergeField on label="Company" value="Acme Corp" />
              </div>
              <div className="hp-mg__col">
                <div className="hp-mg__head">
                  <span className="hp-av hp-av--sm hp-av-e">BN</span>
                  <span className="hp-vname">Ben N.</span>
                </div>
                <MergeField label="Phone" value="07700900123" />
                <MergeField on label="Email" value="ben.nakamura@acme.co" />
                <MergeField label="Company" value="—" />
              </div>
            </div>
            <div className="hp-mg__foot">
              <span className="hp-vsub">From Google and iCloud</span>
              <span className="hp-vbtn hp-vbtn--solid">Merge</span>
            </div>
          </MktWindow>
        </FeatureRow>

        <FeatureRow
          kicker="Sharing"
          title="Share a book with family or your team"
          body="Keep the plumber, the school and the grandparents in one shared book. Everyone sees the same numbers, and you decide who can edit."
          points={["Edit or view-only roles for each member", "Shared books sync to everyone's phones"]}
        >
          <MktWindow bar="Books · Family">
            <div className="hp-book-h">
              <span className="hp-glyph">F</span>
              <div>
                <div className="hp-vname">Family</div>
                <div className="hp-vsub">86 contacts · shared with 4</div>
              </div>
              <span className="hp-stack">
                <span className="hp-av hp-av--sm hp-av-d">LM</span>
                <span className="hp-av hp-av--sm hp-av-a">JM</span>
                <span className="hp-av hp-av--sm hp-av-b">SM</span>
                <span className="hp-av hp-av--sm hp-av-c">RM</span>
              </span>
            </div>
            <div className="hp-vrow">
              <span className="hp-av hp-av-d">LM</span>
              <div className="hp-vrow__main">
                <div className="hp-vname">Lina M. (you)</div>
                <div className="hp-vsub">Owner</div>
              </div>
              <span className="hp-role hp-role--edit">Can edit</span>
            </div>
            <div className="hp-vrow">
              <span className="hp-av hp-av-a">JM</span>
              <div className="hp-vrow__main">
                <div className="hp-vname">James M.</div>
                <div className="hp-vsub">Joined 12 Aug</div>
              </div>
              <span className="hp-role hp-role--edit">Can edit</span>
            </div>
            <div className="hp-vrow">
              <span className="hp-av hp-av-c">RM</span>
              <div className="hp-vrow__main">
                <div className="hp-vname">Rosa M.</div>
                <div className="hp-vsub">Joined 3 Sep</div>
              </div>
              <span className="hp-role">Can view</span>
            </div>
          </MktWindow>
        </FeatureRow>

        <div className="hp-sgrid">
          {GRID.map((item) => (
            <div className="hp-sitem" key={item.title}>
              <Icon name={item.icon} size={20} />
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </div>
          ))}
        </div>
        <div className="hp-sgrid-foot">
          <Link className="mkt-more" href="/features">
            See all features
            <Icon name="arrow" size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

function MergeField({ on = false, label, value }: { on?: boolean; label: string; value: string }) {
  return (
    <div className="hp-mg__field">
      <span className={`hp-radio${on ? " hp-radio--on" : ""}`} />
      <div className="hp-tx">
        <div className="hp-k">{label}</div>
        <div className="hp-v">{value}</div>
      </div>
    </div>
  );
}

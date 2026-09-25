import Link from "next/link";

import { ArrowIcon, CheckIcon, SectionHead, Ticks, WindowFrame } from "../mkt-ui";
import { Icon, type HomeIconName } from "./icons";

// P49-03 / P50-03 · §02 Feature showcase — three alternating rows for the
// reasons people switch (copy 5 / picture 7, flipped on the middle row), then
// a chrome-less 3×2 grid (2 columns below 980px).

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
    <div className={`hp-frow${flip ? " hp-frow--f" : ""}`}>
      <div>
        <p className="hp-frow__k">{kicker}</p>
        <h3 className="hp-frow__t">{title}</h3>
        <p className="hp-frow__b">{body}</p>
        <Ticks items={points} />
      </div>
      <div className="hp-frow__m">{children}</div>
    </div>
  );
}

function Connection({ glyph, name, sub, when }: { glyph: React.ReactNode; name: string; sub: string; when: string }) {
  return (
    <div className="hp-row">
      <span className="hp-glyph">{glyph}</span>
      <div className="hp-row__m">
        <div className="hp-nm">{name}</div>
        <div className="hp-sb">{sub}</div>
      </div>
      <span className="hp-ok">
        <CheckIcon size={13} />
        {when}
      </span>
    </div>
  );
}

function MergeField({ on = false, label, value }: { on?: boolean; label: string; value: string }) {
  return (
    <div className="hp-mg__f">
      <span className={`hp-radio${on ? " hp-radio--on" : ""}`} />
      <div>
        <div className="hp-mg__k">{label}</div>
        <div className="hp-mg__v">{value}</div>
      </div>
    </div>
  );
}

function Member({
  initials,
  tone,
  name,
  sub,
  canEdit,
}: {
  initials: string;
  tone: string;
  name: string;
  sub: string;
  canEdit: boolean;
}) {
  return (
    <div className="hp-row">
      <span className={`hp-av ${tone}`}>{initials}</span>
      <div className="hp-row__m">
        <div className="hp-nm">{name}</div>
        <div className="hp-sb">{sub}</div>
      </div>
      <span className={`hp-role${canEdit ? " hp-role--e" : ""}`}>{canEdit ? "Can edit" : "Can view"}</span>
    </div>
  );
}

const GRID: { icon: HomeIconName; title: string; body: string }[] = [
  { icon: "search", title: "Search", body: "Find anyone by name, email, phone or company as you type." },
  { icon: "tag", title: "Labels", body: "Group contacts your way and filter in one tap." },
  { icon: "card", title: "Public card", body: "A shareable page with the details you choose to publish." },
  { icon: "clock", title: "Change history", body: "See what changed on each contact, when, and from where." },
  { icon: "file", title: "Open export format", body: "A documented format that keeps labels, notes, custom fields and photos." },
  { icon: "code", title: "Developer API", body: "Read and write your contacts from your own tools. Pro and Teams." },
];

export function FeatureShowcase() {
  return (
    <section className="mkt-band" id="features">
      <div className="mkt-container">
        <SectionHead
          index="02"
          label="Why people switch"
          title="The things your built-in address book never quite did"
        />

        <div className="hp-frows">
          <FeatureRow
            kicker="Sync"
            title="One address book, on every device"
            body="Connect Google, iCloud and Fastmail and Kontax brings them into one address book, syncing both ways. On iPhone and Mac it appears in the Contacts app you already use."
            points={["Two-way sync, not a one-off import", "No app to install on iPhone or Mac"]}
          >
            <WindowFrame title="Settings · Sync">
              <p className="hp-vl">Connections</p>
              <Connection glyph="G" name="Google Contacts" sub="lina@gmail.com" when="4 min ago" />
              <Connection glyph="iC" name="iCloud" sub="lina@icloud.com" when="4 min ago" />
              <Connection glyph="F" name="Fastmail" sub="lina@fastmail.com" when="4 min ago" />
              <Connection glyph={<Icon name="card" size={15} />} name="Lina’s iPhone" sub="CardDAV · app password" when="just now" />
            </WindowFrame>
          </FeatureRow>

          <FeatureRow
            flip
            kicker="Clean-up"
            title="Duplicates, found and fixed"
            body="Kontax spots the same person saved twice across your accounts, shows you both records side by side, and lets you pick what to keep. Every merge can be undone for 30 days."
            points={["Phone numbers formatted for their country", "Names in many scripts sorted sensibly"]}
          >
            <WindowFrame title="Review merge">
              <div className="hp-mg">
                <div className="hp-mg__c">
                  <div className="hp-mg__h">
                    <span className="hp-av hp-av--s hp-av5">BN</span>
                    <span className="hp-nm">Ben Nakamura</span>
                  </div>
                  <MergeField on label="Phone" value="+44 7700 900123" />
                  <MergeField label="Email" value="ben@acme.co" />
                  <MergeField on label="Company" value="Acme Ltd" />
                </div>
                <div className="hp-mg__c">
                  <div className="hp-mg__h">
                    <span className="hp-av hp-av--s hp-av5">BN</span>
                    <span className="hp-nm">Ben N.</span>
                  </div>
                  <MergeField label="Phone" value="07700900123" />
                  <MergeField on label="Email" value="ben.nakamura@acme.co" />
                  <MergeField label="Company" value="—" />
                </div>
              </div>
              <div className="hp-mg__foot">
                <span className="hp-sb">From Google and iCloud · undo for 30 days</span>
                <span className="hp-vbtn hp-vbtn--s">Merge</span>
              </div>
            </WindowFrame>
          </FeatureRow>

          <FeatureRow
            kicker="Sharing"
            title="Share a book with family or your team"
            body="Keep the plumber, the school and the grandparents in one shared book. Everyone sees the same numbers, and you decide who can edit."
            points={["Edit or view-only roles for each member", "Shared books sync to everyone’s phones"]}
          >
            <WindowFrame title="Books · Family">
              <div className="hp-row hp-book__h">
                <span className="hp-glyph hp-glyph--tint">F</span>
                <div className="hp-row__m">
                  <div className="hp-nm">Family</div>
                  <div className="hp-sb">86 contacts · 4 members</div>
                </div>
                <span className="hp-stack">
                  <span className="hp-av hp-av--s hp-av4">LM</span>
                  <span className="hp-av hp-av--s hp-av1">JM</span>
                  <span className="hp-av hp-av--s hp-av2">SM</span>
                  <span className="hp-av hp-av--s hp-av3">RM</span>
                </span>
              </div>
              <Member initials="LM" tone="hp-av4" name="Lina M. (you)" sub="Owner" canEdit />
              <Member initials="JM" tone="hp-av1" name="James M." sub="Joined 12 Aug" canEdit />
              <Member initials="RM" tone="hp-av3" name="Rosa M." sub="Joined 3 Sep" canEdit={false} />
            </WindowFrame>
          </FeatureRow>
        </div>

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
            <ArrowIcon />
          </Link>
        </div>
      </div>
    </section>
  );
}

import { HELP_PROVIDER_GUIDES } from "~/app/_components/help-provider-guides-data";

function GuideList({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <div className="help-guide-list">
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export function HelpProviderGuides() {
  return (
    <section className="help-guides" aria-labelledby="provider-guides">
      <div className="help-guides__head">
        <p className="eyebrow">Provider guides</p>
        <h2 id="provider-guides" className="help-guides__title">
          Sync help that matches the provider you connected
        </h2>
        <p className="help-guides__lede">
          Each guide explains how to connect, what fields should sync, what stays local to
          Kontax, and when to re-authorise or contact support.
        </p>
      </div>

      <div className="help-guides__rail">
        {HELP_PROVIDER_GUIDES.map((guide) => (
          <a key={guide.id} className="help-guide-pill" href={`#${guide.id}`}>
            {guide.name}
          </a>
        ))}
      </div>

      <div className="help-guides__grid">
        {HELP_PROVIDER_GUIDES.map((guide) => (
          <article key={guide.id} id={guide.id} className="help-guide-card">
            <div className="help-guide-card__head">
              <div>
                <h3 className="help-guide-card__title">{guide.name}</h3>
                <p className="help-guide-card__summary">{guide.summary}</p>
              </div>
            </div>

            <div className="help-guide-card__body">
              <GuideList items={guide.connect} title="How to connect" />
              <GuideList items={guide.syncs} title="What syncs" />
              <GuideList items={guide.limitations} title="What to expect" />
              <GuideList items={guide.recoveries} title="Common recoveries" />
              <GuideList items={guide.contactSupport} title="When to contact support" />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

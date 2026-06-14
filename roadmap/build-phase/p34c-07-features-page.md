# P34C-07 — /features Page

## Purpose

Create `src/app/(marketing)/features/page.tsx` — a dedicated feature breakdown
page that gives visitors who want more detail after the homepage a thorough look
at what Kontax can do, with screenshots from the real product.

## Background

The homepage feature tiles (P34C-04) are deliberately brief. A visitor who is
evaluating Kontax against alternatives, or who wants to understand a specific
capability before registering, needs more. The `/features` page provides that
depth without bloating the homepage.

P34C-DB03 specifies the visual design. This ticket implements against that brief.

## Scope

**In scope**
- `src/app/(marketing)/features/page.tsx`.
- `<MarketingNav>` and `<MarketingFooter>` via the shared layout.
- Page hero (title + sub-copy, no product screenshot — the screenshots are
  in the individual sections).
- Six feature sections in alternating left/right layout.
- Bottom CTA band ("Ready to get started?" → `/register`).

**Out of scope**
- The homepage feature tiles (P34C-04).
- Any server-side data fetching — this page is fully static.
- Feature request or comparison table (that lives on `/pricing`).

## Design / Implementation Spec

### Page layout

```
[MarketingNav]
─────────────────────────────────────────────────
  Page hero: "Everything your contacts need"
  Sub-copy (centred, max-w-xl)
─────────────────────────────────────────────────
  [Feature section 1 — Search — screenshot left]
  [Feature section 2 — Labels — screenshot right]
  [Feature section 3 — Sync — screenshot left]
  [Feature section 4 — Sharing — screenshot right]
  [Feature section 5 — Public card — screenshot left]
  [Feature section 6 — API — screenshot right (code snippet)]
─────────────────────────────────────────────────
  Bottom CTA band
[MarketingFooter]
```

### Alternating feature section component

```tsx
function FeatureSection({
  headline,
  body,
  screenshot,
  alt,
  cta,
  flip,
}: FeatureSectionProps) {
  return (
    <section className={`py-20 ${flip ? "bg-[#f4f6f2]" : "bg-white"}`}>
      <div className={`max-w-6xl mx-auto px-6 flex items-center gap-16
                       ${flip ? "flex-row-reverse" : "flex-row"}
                       flex-col lg:flex-row`}>
        <div className="flex-1 max-w-[500px]">
          <h2 className="text-[32px] font-bold text-[#17352e] leading-tight">
            {headline}
          </h2>
          <p className="text-[17px] text-[#5c655e] mt-5 leading-[1.7]">
            {body}
          </p>
          {cta && (
            <Link href={cta.href} className="mt-8 inline-flex items-center
              text-[#4158f4] font-semibold text-[15px] hover:underline">
              {cta.label} →
            </Link>
          )}
        </div>
        <div className="flex-1">
          <Image
            src={screenshot}
            alt={alt}
            width={640}
            height={420}
            className="rounded-2xl shadow-lg border border-[#edf0ea] w-full h-auto"
          />
        </div>
      </div>
    </section>
  );
}
```

`flip` alternates the image side: `false` = image right, `true` = image left.
On mobile (`< lg`), the layout always stacks vertically (image below text,
using `flex-col`).

### Feature sections data

```ts
const FEATURE_SECTIONS = [
  {
    headline: "Search that actually works",
    body: "Type a name, phone number, email, company, label, or note — Kontax " +
          "finds it instantly. Results are grouped by match type so you see exactly " +
          "why a contact appeared. No more scrolling past irrelevant results.",
    screenshot: "/images/marketing/feature-search.webp",
    alt: "Kontax search dropdown showing grouped results with highlighted match fields",
    cta: null,
    flip: false,
  },
  {
    headline: "Labels that organise, not just tag",
    body: "Create a label once and apply it to any contact. Filter your list " +
          "to exactly the people you need — clients, family, colleagues — in one " +
          "click. Labels sync alongside contacts so they appear on every device.",
    screenshot: "/images/marketing/feature-labels.webp",
    alt: "Kontax contacts list showing label filter chips and label badges on contact rows",
    cta: null,
    flip: true,
  },
  {
    headline: "One address book, every device",
    body: "Connect CardDAV, Google Contacts, Outlook, or iCloud. Kontax syncs " +
          "in both directions — changes you make here appear in your phone's contacts " +
          "app, and vice versa. Add as many sync accounts as you need.",
    screenshot: "/images/marketing/feature-sync.webp",
    alt: "Kontax sync connections page showing Google, iCloud, and CardDAV accounts",
    cta: null,
    flip: false,
  },
  {
    headline: "Shared address books for family and teams",
    body: "Create a shared book that every member of your family or team can see " +
          "and edit in real time. One person updates a phone number — everyone sees " +
          "it immediately. No more texting around asking for the latest details.",
    screenshot: "/images/marketing/feature-sharing.webp",
    alt: "Kontax contact detail showing shared book members with role badges",
    cta: null,
    flip: true,
  },
  {
    headline: "Your public contact card",
    body: "Get a personal URL at /u/yourname. Share it anywhere — people can add " +
          "your contact details to their phone in one tap with no account required. " +
          "Update it once and the link always shows your latest info.",
    screenshot: "/images/marketing/feature-public-card.webp",
    alt: "Kontax public contact card page showing name, photo, and contact details",
    cta: { label: "See an example", href: "/u/demo" },
    flip: false,
  },
  {
    headline: "A developer API built for automation",
    body: "The Kontax REST API at api.getkontax.com lets you create, search, and " +
          "update contacts from scripts, webhooks, or your own apps. Full CRUD, " +
          "per-token rate limiting, and standard HTTP auth.",
    screenshot: "/images/marketing/feature-api.webp",  // code snippet image
    alt: "Code snippet showing a cURL request to the Kontax API",
    cta: { label: "Read the API docs", href: "/developers" },
    flip: true,
  },
];
```

All screenshots stored in `public/images/marketing/` as WebP, < 200 KB each.
The API section uses a code-snippet image rather than a UI screenshot — generate
this as a syntax-highlighted code block rendered to an image, or use a real
screenshot of the `/developers` page.

### Bottom CTA band

```
┌──────────────────────────────────────────────────────┐
│  bg-[#17352e]  py-24  text-center                    │
│                                                      │
│  "Ready to get started?"  (36px white bold)          │
│  "Free plan, no credit card required."  (17px white/70)│
│  [Get started free →]  (white outlined button)       │
└──────────────────────────────────────────────────────┘
```

### SEO

```tsx
export const metadata: Metadata = {
  title: "Features | Kontax",
  description:
    "Discover everything Kontax can do — grouped search, labels, multi-provider " +
    "sync, shared address books, public contact cards, and a developer REST API.",
};
```

## Acceptance Criteria

- [ ] Page exists at `/features` and renders via the `(marketing)` layout.
- [ ] All six feature sections render with headline, body, screenshot, and
      optional CTA link.
- [ ] Desktop: sections alternate image left / image right.
- [ ] Mobile: all sections stack vertically (text above image).
- [ ] All six screenshot images exist in `public/images/marketing/` as WebP.
- [ ] Bottom CTA band links to `/register`.
- [ ] `metadata` title and description are set.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Screenshot production**: six new product screenshots must be taken. This is
  a content task that may delay the engineering ticket. Create the page with
  placeholder image paths and merge; add screenshots in a follow-up PR.
- **API section image**: the code snippet image is unusual. Alternative: render
  a syntax-highlighted `<pre>` block directly in the section instead of an image.
  This is more accessible and avoids a screenshot dependency.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: document the screenshot update process
      for `public/images/marketing/`

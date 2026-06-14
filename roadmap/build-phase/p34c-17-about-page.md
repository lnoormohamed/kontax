# P34C-17 — /about Page (Minimal for Launch)

## Purpose

Create `src/app/(marketing)/about/page.tsx` — a minimal "about" page that
gives the company a face and communicates the mission behind Kontax. This page
is P2 (nice to have for launch but not blocking) and should be kept minimal for
Phase 34C — expand post-launch.

## Background

An about page builds trust with users who want to know who is behind a product
before sharing their address book with it. For Kontax, the story is honest and
simple: a small tool built because existing address books are either data-hungry
platforms or stuck in the early 2000s. That honesty is itself a differentiator.

## Scope

**In scope**
- `src/app/(marketing)/about/page.tsx` — minimal single-section page.
- Mission statement paragraph.
- "Made by Vexon" attribution with link.
- CTA to `/pricing`.
- `<MarketingNav>` and `<MarketingFooter>` via shared layout.

**Out of scope**
- Team bios or photos (post-launch expansion).
- Company history timeline (post-launch).
- Press / media kit section (post-launch).
- Investor information.

## Design / Implementation Spec

### Layout

```
[MarketingNav]
────────────────────────────────────────
max-w-3xl mx-auto px-6 py-24 text-center

  "About Kontax"             (36px bold #17352e)

  [Mission paragraph]

  [Made by section]

  [CTA button → /pricing]
────────────────────────────────────────
[MarketingFooter]
```

Centre-aligned text for this page is appropriate given its brevity.
On desktop, constrain to `max-w-2xl` for comfortable reading width.

### Copy (draft — replace with approved copy before go-live)

**Mission statement:**
```
Kontax was built because address books haven't kept up with how we live.

Our phones hold hundreds of contacts, but the tools to manage them are either
locked inside a platform's ecosystem or frozen in 2005. You can't easily
search across sources, organise with labels, share a family address book, or
let someone add you with a single tap.

Kontax fixes that. It's a contacts manager that puts you in control — your
data syncs to your devices, stays private, and is always yours to export.
```

**Made by:**
```
Kontax is made by Vexon — a small team building tools that respect your data
and your time.
```

Include a link: `<a href="https://vexon.co">vexon.co</a>` (external, `target="_blank"`).

### Component structure

```tsx
export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <h1 className="text-[36px] font-bold text-[#17352e] tracking-[-0.02em]">
        About Kontax
      </h1>

      <div className="mt-8 space-y-5 text-[17px] text-[#5c655e] leading-[1.8]
                      text-left">
        {/* Mission paragraphs */}
      </div>

      <div className="mt-10 pt-10 border-t border-[#edf0ea]
                      text-[15px] text-[#8b938c]">
        Kontax is made by{" "}
        <a
          href="https://vexon.co"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1d2823] font-semibold hover:text-[#17352e]"
        >
          Vexon
        </a>
        {" "}— a small team building tools that respect your data and your time.
      </div>

      <div className="mt-12">
        <Link
          href="/pricing"
          className="inline-flex items-center justify-center h-12 px-8
                     bg-[#17352e] text-white rounded-[12px] text-[16px]
                     font-semibold hover:bg-[#0f2419] transition-colors"
        >
          See plans and pricing →
        </Link>
      </div>
    </div>
  );
}
```

### Post-launch expansion notes

When the team is ready to expand this page (not in scope for P34C):
- Add team section with name, role, and optional photo per person.
- Add a brief product history ("Started in 2025, shipped public card in early
  2026 …").
- Add a press / media kit section with logo downloads and key facts.
- Add a "We're hiring" note if relevant.

Document these as a follow-up ticket rather than leaving TODO comments in code.

### SEO

```tsx
export const metadata: Metadata = {
  title: "About | Kontax",
  description:
    "Kontax was built because address books haven't kept up with how we live. " +
    "Made by Vexon.",
};
```

## Acceptance Criteria

- [ ] Page exists at `/about` and renders via the `(marketing)` layout.
- [ ] Mission statement, "Made by Vexon" attribution, and CTA to `/pricing`
      are all present.
- [ ] Vexon link opens in a new tab with `rel="noopener noreferrer"`.
- [ ] Page is fully static (no server data).
- [ ] `metadata` is set.
- [ ] `tsc --noEmit` passes.
- [ ] Copy is reviewed and approved before merging to `main`.

## Risks / Open Questions

- **Copy**: the draft above uses "built because address books haven't kept up
  with how we live" — this is the direction specified in the ticket brief but
  must be signed off as the brand voice before going live.
- **Vexon URL**: `https://vexon.co` — confirm this is the correct URL and that
  it is live before linking.
- **Priority**: this is P2. If go-live is time-pressured, this page can be
  omitted at launch and the footer "About" link can point to `/` or be removed
  temporarily.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/
- [x] Internal · engineering — docs/: note the minimal-for-launch approach and
      the post-launch expansion plan for the about page

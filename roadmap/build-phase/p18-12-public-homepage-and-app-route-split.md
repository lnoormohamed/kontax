# P18-12 — Public Homepage & Authenticated App Route Split

## Purpose

Today `/` does double duty: it renders the public marketing landing
(`<PublicLanding />`) when logged out, and the full contacts workspace when
logged in. That conflation has a concrete cost — **a logged-in user can never
view the public homepage** (marketing copy, pricing teaser, FAQ), because the
moment they have a session, `/` becomes the app. It also makes `/` mean two
completely different things depending on hidden state, which is awkward for
deep links, analytics, SEO, and "open the marketing site" links from inside the
product.

This ticket separates the two concerns:

- **`/`** becomes the **always-public marketing homepage** — same content for
  everyone, with an auth-aware call to action ("Get started free" / "Log in"
  when logged out; "Open Kontax →" when logged in).
- The **authenticated contacts workspace moves to `/contacts`**.

## Background

The contacts routes are already half-migrated to `/contacts`:

- `src/app/contacts/new/page.tsx` — create contact
- `src/app/contacts/[id]/page.tsx` — contact detail/edit

…but there is **no `/contacts` index** — the workspace list lives at
`src/app/page.tsx`. So the child routes sit under `/contacts/*` while their
parent list is at `/`. Moving the workspace to `/contacts` completes that tree
rather than introducing a new top-level concept.

Roughly **29 references** treat `/` as the application home: the app-shell logo
link, post-login/post-register redirects (`next ?? "/"`), "back to list" links
in create/import/merge flows, etc. These must be retargeted to `/contacts`,
while genuinely-public "back to homepage" links (e.g. the account-deleted page)
must stay pointing at `/`.

The middleware was recently restructured (commit `d029b9a`) so that `/` and the
marketing/legal pages are public and the page component self-selects content.
That fix is the foundation for this ticket; with the workspace moved off `/`,
the `pathname === "/"` special-case in the middleware can be simplified (see
Scope).

## Scope

**In scope:**

- Create `src/app/contacts/page.tsx` — move the entire authenticated workspace
  (the current body of `src/app/page.tsx`: search/filter/sort/scope params,
  shared-book queries, dashboard render) to this route.
- Rewrite `src/app/page.tsx` to **always** render the public marketing homepage,
  regardless of session, with an auth-aware primary CTA.
- Retarget app-home links and redirects from `/` to `/contacts` (app-shell
  links, post-login, post-register, "back to list" links).
- Update the middleware so `/contacts` is a protected route and `/` is purely
  public (drop the `pathname === "/"` special case once the app no longer lives
  there — `/` falls through to public content).
- Update `<PublicLanding />` to accept the viewer's auth state and swap its CTAs
  accordingly.
- Preserve all existing workspace query params (`q`, `tab`, `filter`, `sort`,
  `view`, `scope`, `book`, `mergeSuggestionsRefreshed`) on `/contacts`.

**Out of scope:**

- Any change to the CardDAV routes (`/dav/*`) — unaffected; they key off
  `userId`/`bookSlug`, not the web app home.
- Redesigning the marketing homepage content (this is a route split, not a
  redesign).
- A separate authenticated "overview/dashboard" distinct from the contacts list
  (the workspace *is* the contacts list; `/contacts` is its home).
- Renaming `/settings`, `/family`, `/sync`, `/import-export`, `/shares`, etc. —
  those already live under their own slugs and stay put.

---

## Design / Implementation Spec

### 1. Move the workspace to `/contacts`

Move the full contents of `src/app/page.tsx` (the `Home` server component and
its helpers: `getQueryValue`, `getSelectedTab`, `getSelectedFilter`,
`getSelectedSort`, `getSelectedView`, `getSearchConditions`, the sort
comparators, and the dashboard render) into a new
`src/app/contacts/page.tsx` exporting `default async function ContactsPage`.

The logged-out short-circuit changes meaning: `/contacts` is protected by
middleware, so the page can assume a session. Replace

```ts
const session = await auth();
if (!session?.user?.id) {
  return <PublicLanding />;
}
```

with a defensive redirect (middleware already guarantees auth, but keep it
correct if reached directly):

```ts
const session = await auth();
if (!session?.user?.id) redirect("/login?next=/contacts");
```

### 2. `/` becomes the always-public homepage

Rewrite `src/app/page.tsx` to a thin server component:

```tsx
import { PublicLanding } from "~/app/_components/public-landing";
import { auth } from "~/server/auth";

export default async function HomePage() {
  const session = await auth();
  return <PublicLanding isAuthenticated={!!session?.user?.id} />;
}
```

`/` no longer redirects logged-in users away and no longer renders the
dashboard. Logged-in users see the marketing page with an "Open Kontax →" CTA.

### 3. `<PublicLanding />` auth-aware CTAs

> **Note for P26-01:** the `/` page here is *interim* — P26-01 replaces this
> `<PublicLanding />` with the locked `05-public-landing.md` design. Keep this
> implementation functional, not pixel-perfect; don't over-invest in visuals
> that P26-01 will redo. The auth-aware CTA behaviour (logged-in users see the
> page with an "Open Kontax →" CTA, never redirected) is the contract P26-01
> inherits — it has been updated to honour it.

Add an `isAuthenticated?: boolean` prop. When `true`, the primary/secondary
hero and footer CTAs change from:

- Logged out: `Get started free` → `/register`, `Log in` → `/login`

to:

- Logged in: `Open Kontax →` → `/contacts` (single primary CTA; drop the
  register/login pair)

### 4. Redirect & link retargeting

App-home → `/contacts`:

- `src/app/_components/auth-card.tsx` — both `window.location.assign(next ?? "/")`
  → `next ?? "/contacts"` (login + post-register auto-login).
- `src/app/_components/register-form.tsx` — `router.push(next ?? "/")` →
  `next ?? "/contacts"`.
- `src/app/register/page.tsx` — already-registered `redirect(next ?? "/")` →
  `next ?? "/contacts"`.
- `src/app/login/page.tsx` — already-logged-in `redirect(next ?? "/")` →
  `next ?? "/contacts"`.
- App-shell logo links: `src/app/contacts/page.tsx` header (moved) and
  `src/app/settings/layout.tsx` `href="/"` → `href="/contacts"`.
- "Back to list" / "contacts list" links in flows:
  `create-contact-form.tsx`, `import-preview-form.tsx`, `export-card.tsx`,
  `merge/manual/page.tsx`, `family/join/[token]/page.tsx` — point to
  `/contacts`.

Stay pointing at `/` (genuinely public "homepage"):

- `src/app/account-deleted/page.tsx` "Return to homepage".
- Marketing/legal page links (`public-landing.tsx`, footer links to
  `/pricing`, `/privacy`, `/terms`).

Note: `wireframes/*` are design scratch pages — leave them.

### 5. Middleware simplification

With the app off `/`, drop the `pathname === "/"` special case added in
`d029b9a`; `/` now falls through the public-content check like any other public
page. `/contacts` is not in `PUBLIC_PREFIXES`, so it is protected automatically.
Confirm `next=/contacts` round-trips: an unauthenticated hit on `/contacts`
redirects to `/login?next=%2Fcontacts`, and login returns the user to
`/contacts`.

### 6. Default `next` fallbacks

Every place that currently defaults to `"/"` after auth should default to
`"/contacts"`. The `next` query param (when present and app-internal) still
wins, so deep links like `/login?next=/settings/security` are unaffected.

---

## Acceptance Criteria

- Visiting `/` while **logged out** shows the marketing homepage (200, not a
  redirect to `/login`).
- Visiting `/` while **logged in** shows the *same* marketing homepage with an
  "Open Kontax →" CTA — **not** the contacts workspace, and **not** a redirect.
- The contacts workspace renders at `/contacts` for logged-in users, with all
  query params (`q`, `tab`, `filter`, `sort`, `view`, `scope`, `book`) working
  exactly as they did at `/`.
- Visiting `/contacts` while logged out redirects to `/login?next=%2Fcontacts`,
  and a successful login lands the user on `/contacts`.
- Post-login and post-registration both land on `/contacts` (when no `next` is
  supplied); an app-internal `next` param still takes precedence.
- The app-shell logo and in-app "back to list" links navigate to `/contacts`;
  the account-deleted "Return to homepage" link and marketing footer links still
  go to `/` / `/pricing` / `/privacy` / `/terms`.
- No regression to CardDAV (`/dav/*`), settings, family, sync, import/export, or
  shares routes.

---

## Risks and Open Questions

- **Existing bookmarks / muscle memory:** users (and synced devices' web links)
  may have `/` bookmarked as "the app". Optional nicety: when a logged-in user
  lands on `/`, the "Open Kontax →" CTA makes the workspace one click away. A
  hard redirect from `/` → `/contacts` for logged-in users is explicitly **not**
  wanted here — the whole point is that the logged-in user can view the homepage.
- **SEO / crawlers:** `/` is now stably public and indexable, which is an
  improvement. Confirm no `noindex` is inherited and that the marketing page
  renders without a session.
- **`PublicLanding` CTA breadth:** audit every CTA/link inside `PublicLanding`
  (hero, mid-page teaser, FAQ, footer) for the logged-in variant, not just the
  hero — there are several "Get started free" buttons.
- **Link audit completeness:** the ~29 `/` references should be triaged
  individually (app-home vs marketing-home); a blanket find-replace would break
  the genuinely-public "homepage" links. The list in §4 is the starting point,
  not necessarily exhaustive — grep again at implementation time.
- **Analytics:** any dashboards keyed on `/` as the app landing should be
  repointed to `/contacts`.

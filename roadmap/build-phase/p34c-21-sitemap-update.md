# P34C-21 — Sitemap Update

## Purpose

Update the sitemap generator to include all new marketing routes added in
Phase 34C. A complete, accurate sitemap helps search engines discover and
index new pages quickly. Exclusion of authenticated routes prevents private
pages from being indexed.

## Background

The existing sitemap at `src/app/sitemap.ts` (or `src/app/sitemap.xml/route.ts`
— check which exists) was created before the new marketing pages existed. It
must be updated with all new routes from Phase 34C and all previously existing
public pages. Public contact card pages (`/u/[username]`) should be included
dynamically.

## Scope

**In scope**
- Update `src/app/sitemap.ts` (or equivalent) to include all marketing pages.
- Dynamic inclusion of `/u/[username]` pages for all users with a public card.
- Correct `priority` and `changefreq` per page type.
- Exclusion of all authenticated routes.

**Out of scope**
- Image sitemaps (post-launch).
- Video sitemaps.
- Per-language sitemaps (single language for launch).

## Design / Implementation Spec

### File location check

First, verify where the current sitemap lives:
```bash
find src -name "sitemap*" -o -name "sitemap.xml*"
```

Next.js App Router supports `src/app/sitemap.ts` as a built-in sitemap
generator (returns a `MetadataRoute.Sitemap` array). Use this approach.

### Static marketing URLs

```ts
import type { MetadataRoute } from "next";

const BASE_URL = "https://getkontax.com";

const STATIC_PAGES: MetadataRoute.Sitemap = [
  // Marketing pages
  { url: `${BASE_URL}/`,          lastModified: new Date(), priority: 1.0, changeFrequency: "weekly"  },
  { url: `${BASE_URL}/features`,  lastModified: new Date(), priority: 0.8, changeFrequency: "monthly" },
  { url: `${BASE_URL}/pricing`,   lastModified: new Date(), priority: 0.9, changeFrequency: "monthly" },
  { url: `${BASE_URL}/security`,  lastModified: new Date(), priority: 0.7, changeFrequency: "monthly" },
  { url: `${BASE_URL}/changelog`, lastModified: new Date(), priority: 0.7, changeFrequency: "weekly"  },
  { url: `${BASE_URL}/about`,     lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
  { url: `${BASE_URL}/contact`,   lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
  { url: `${BASE_URL}/privacy`,   lastModified: new Date(), priority: 0.5, changeFrequency: "yearly"  },
  { url: `${BASE_URL}/terms`,     lastModified: new Date(), priority: 0.5, changeFrequency: "yearly"  },

  // Auth pages (indexable — these are the conversion funnel entry points)
  { url: `${BASE_URL}/login`,     lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
  { url: `${BASE_URL}/register`,  lastModified: new Date(), priority: 0.8, changeFrequency: "monthly" },

  // Developer and help pages
  { url: `${BASE_URL}/developers`, lastModified: new Date(), priority: 0.7, changeFrequency: "monthly" },
  { url: `${BASE_URL}/help`,       lastModified: new Date(), priority: 0.6, changeFrequency: "monthly" },
];
```

### Dynamic public card pages

```ts
async function getPublicCardUrls(): Promise<MetadataRoute.Sitemap> {
  // Query all users who have a publicUsername set
  const users = await prisma.user.findMany({
    where: { publicUsername: { not: null } },
    select: { publicUsername: true, updatedAt: true },
  });

  return users.map(user => ({
    url: `${BASE_URL}/u/${user.publicUsername}`,
    lastModified: user.updatedAt,
    priority: 0.6,
    changeFrequency: "weekly" as const,
  }));
}
```

### Sitemap function

```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const publicCardUrls = await getPublicCardUrls();
  return [...STATIC_PAGES, ...publicCardUrls];
}
```

### Excluded routes

The following must NOT appear in the sitemap (they either require auth or are
internal/API routes):
- `/contacts`, `/contacts/[id]`, `/contacts/new`
- `/settings`, `/settings/*`
- `/sync`, `/sync/*`
- `/admin`, `/admin/*`
- `/api/*`
- `/merge-suggestions/*`
- `/merge/manual`
- `/books/*`

The static `STATIC_PAGES` array ensures these are never added. The dynamic
query only fetches public-username rows.

### Robots.txt

Verify `src/app/robots.ts` (or `public/robots.txt`) disallows authenticated
routes:

```ts
// src/app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/contacts",
          "/settings",
          "/sync",
          "/admin",
          "/api/",
          "/merge",
          "/books",
        ],
      },
    ],
    sitemap: "https://getkontax.com/sitemap.xml",
  };
}
```

If `robots.ts` already exists, update its `disallow` list rather than replacing
the file.

### Google Search Console

After deploying:
1. Open Google Search Console → Sitemaps.
2. Submit `https://getkontax.com/sitemap.xml`.
3. Confirm it reports the correct number of URLs discovered.
4. Check for any "Couldn't fetch" or "Has errors" status.

## Acceptance Criteria

- [ ] `GET /sitemap.xml` returns a valid XML sitemap.
- [ ] All 9 marketing pages listed in STATIC_PAGES are present.
- [ ] `/login` and `/register` are present (indexable).
- [ ] `/developers` and `/help` are present.
- [ ] Public card pages (`/u/*`) are dynamically included for all users with a
      public username.
- [ ] No authenticated routes appear in the sitemap.
- [ ] `priority` and `changeFrequency` match the table above.
- [ ] `robots.txt` disallows `/contacts`, `/settings`, `/sync`, `/admin`,
      `/api/`, `/merge`, `/books`.
- [ ] Sitemap submitted to Google Search Console and reports no errors.
- [ ] `tsc --noEmit` passes.

## Risks / Open Questions

- **Prisma in the sitemap function**: `sitemap.ts` runs at build time for
  static generation or at request time for dynamic routes. In Next.js App
  Router, `src/app/sitemap.ts` runs at request time by default. The Prisma
  call is fine here but confirm the DB connection is available in the sitemap
  route (it will need the same env vars as the rest of the app).
- **User count**: if there are thousands of public card users, the sitemap
  could be large. For Phase 34C launch volumes, this is not an issue. If the
  sitemap exceeds 50,000 URLs, split into a sitemap index.
- **`lastModified` for static pages**: using `new Date()` means the date
  changes on every build. For stable pages like `/privacy`, a hardcoded date
  (the last time the copy changed) is more accurate. For launch, `new Date()`
  is acceptable.

## Documentation (per roadmap/documentation-policy.md)

On completion, update the relevant surface(s):
- [ ] External · users — in-app Help (P26-12)
- [ ] External · developers — /developers (P29-07)
- [ ] Internal · admins/ops — roadmap/runbooks/: document the sitemap update
      process (add new public pages to STATIC_PAGES; they are auto-included at
      next build)
- [x] Internal · engineering — docs/: document the sitemap architecture
      (static array + dynamic public cards) and the excluded-routes list

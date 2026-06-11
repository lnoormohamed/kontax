# P26-08 — Sitemap and robots.txt

## Purpose

Generate a `sitemap.xml` listing all public, indexable routes and a `robots.txt` that explicitly allows public routes and disallows private app routes, API endpoints, and the admin section. Without these, search engines may crawl authenticated pages, index unintended URLs, or fail to discover the public landing page and pricing page.

## Background

Next.js App Router provides built-in support for both `sitemap.xml` (via `src/app/sitemap.ts`) and `robots.txt` (via `src/app/robots.ts`). These are server-generated on each request (or statically at build time with `revalidate`) and served at the well-known paths `/sitemap.xml` and `/robots.txt`. This is a low-effort, high-signal SEO improvement that should ship with the landing page (P26-01).

## Scope

**In scope:**
- `/sitemap.xml` — lists: `/`, `/pricing`, `/help`, `/login`, `/register`
- `/robots.txt` — allows `/`, `/pricing`, `/help`, `/login`, `/register`; disallows `/contacts`, `/settings`, `/admin`, `/api`, `/sync`, `/import-export`, `/activity`, `/merge-suggestions`
- `lastModified` dates set to `new Date()` for dynamic pages, static for fixed-content pages

**Out of scope:**
- Per-contact or per-share sitemaps (contacts are private; share pages use noindex)
- Sitemap submission to Google Search Console (a manual step in the launch runbook)

---

## Design / Implementation Spec

### `src/app/sitemap.ts`

```typescript
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://kontax.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/help`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/register`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
```

### `src/app/robots.ts`

```typescript
import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://kontax.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/help", "/login", "/register"],
        disallow: [
          "/contacts",
          "/settings",
          "/admin",
          "/api",
          "/sync",
          "/import-export",
          "/activity",
          "/merge-suggestions",
          "/share", // share pages use their own noindex meta tag (P26-10)
          "/u",    // public contact card pages handled separately (P30)
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
```

### `/share/[token]` pages

Even though `/share/**` is disallowed in `robots.txt`, share pages should additionally include `<meta name="robots" content="noindex, nofollow">` in their page metadata to prevent accidental indexing if a crawler circumvents `robots.txt`. This is already in scope for P12-02 but verify it is implemented.

### Search Console registration

After P26-08 ships, add to the launch runbook:
1. Submit `https://kontax.app/sitemap.xml` to Google Search Console.
2. Verify ownership via the DNS TXT record method.
3. Confirm robots.txt is parsed correctly via the "robots.txt tester" in Search Console.

---

## Acceptance Criteria

- `GET /sitemap.xml` returns valid XML listing the 5 specified URLs with correct `lastmod` and `priority` values.
- `GET /robots.txt` returns the correct allow/disallow rules for `*` user agent.
- `robots.txt` includes the `Sitemap:` directive pointing to `/sitemap.xml`.
- Verified in browser: navigating to `/sitemap.xml` and `/robots.txt` returns the expected content.
- The disallow list covers all authenticated app routes — test that a fresh Google crawl simulation (via Search Console URL inspection) for `/contacts` returns "blocked by robots.txt".

---

## Risks and Open Questions

- **`/u/` (public contact card, Phase 30):** when P30 ships, `/u/{username}` should be added to the sitemap — public contact cards are intended to be indexable. Keep the `robots.ts` disallow for `/u` for now; remove it in Phase 30.
- **Dynamic sitemap vs static:** the sitemap above is static (no DB queries). When the help page grows to have individual FAQ article URLs, the sitemap generator can be updated to query the FAQ article slugs. This is a non-breaking change.

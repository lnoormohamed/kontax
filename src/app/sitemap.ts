import { type MetadataRoute } from "next";

import { db } from "~/server/db";
import { SITE_URL } from "~/lib/site-url";

// P34C-21 — sitemap listing all public, indexable routes.
// Authenticated app surfaces (/contacts, /settings, /admin, /api, …) are
// excluded here and disallowed in robots.ts.
// To add a new public route: append to STATIC_ROUTES below.
const STATIC_ROUTES: {
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}[] = [
  // Marketing pages
  { path: "/",          priority: 1.0, changeFrequency: "weekly"  },
  { path: "/features",  priority: 0.8, changeFrequency: "monthly" },
  { path: "/pricing",   priority: 0.9, changeFrequency: "monthly" },
  { path: "/security",  priority: 0.7, changeFrequency: "monthly" },
  { path: "/changelog", priority: 0.7, changeFrequency: "weekly"  },
  { path: "/about",     priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact",   priority: 0.6, changeFrequency: "monthly" },
  { path: "/privacy",   priority: 0.5, changeFrequency: "yearly"  },
  { path: "/terms",     priority: 0.5, changeFrequency: "yearly"  },
  // Auth pages — indexable as conversion-funnel entry points
  { path: "/login",     priority: 0.6, changeFrequency: "monthly" },
  { path: "/register",  priority: 0.8, changeFrequency: "monthly" },
  // Developer and help pages
  { path: "/developers", priority: 0.7, changeFrequency: "monthly" },
  { path: "/help",       priority: 0.6, changeFrequency: "monthly" },
];

async function getPublicCardUrls(): Promise<MetadataRoute.Sitemap> {
  try {
    const users = await db.user.findMany({
      where: { username: { not: null } },
      select: { username: true, updatedAt: true },
    });

    return users
      .filter((u): u is typeof u & { username: string } => u.username !== null)
      .map((u) => ({
        url: `${SITE_URL}/u/${u.username}`,
        lastModified: u.updatedAt,
        priority: 0.6 as const,
        changeFrequency: "weekly" as const,
      }));
  } catch (error) {
    // Keep sitemap generation resilient during builds and transient database
    // outages; the static public routes remain safe to publish on their own.
    console.warn("[sitemap] Skipping public card URLs because the database is unavailable.", error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const staticUrls: MetadataRoute.Sitemap = STATIC_ROUTES.map((r) => ({
    url: `${SITE_URL}${r.path}`,
    lastModified,
    changeFrequency: r.changeFrequency,
    priority: r.priority,
  }));

  const publicCardUrls = await getPublicCardUrls();

  return [...staticUrls, ...publicCardUrls];
}

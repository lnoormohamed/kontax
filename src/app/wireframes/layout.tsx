import { notFound } from "next/navigation";

/**
 * P48-17 — /wireframes/** (10 design-review pages) has no auth gate of its own
 * and was reachable by any signed-in user (and, depending on middleware
 * PUBLIC_PATHS, potentially unauthenticated visitors too) in every
 * environment, including production. These pages are internal design
 * artifacts, not product surface — 404 them outside development so they can
 * only ever be reached by someone running the app locally.
 */
export default function WireframesLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return children;
}

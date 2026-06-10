"use client";

import { useEffect } from "react";

/**
 * Scroll-reveal initializer for the public landing page. Adds `is-in` to every
 * `.reveal` element as it enters the viewport (staggered fade-in). Respects
 * `prefers-reduced-motion` and degrades gracefully without IntersectionObserver.
 * Renders nothing — it only runs the effect once on mount.
 */
export function LandingReveal() {
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const els = document.querySelectorAll<HTMLElement>(".kx .reveal");

    if (reduce || !("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -50px 0px" },
    );

    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}

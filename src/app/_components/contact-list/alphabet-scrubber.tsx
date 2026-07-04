"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// P46-01 — Alphabet scrubber (the phone-book fast-scroll index rail).
//
// A secondary affordance that duplicates scrolling: tap a letter to jump, drag
// along the rail to scrub with a floating bubble, and the current section stays
// highlighted while you scroll normally. The rail renders ONLY the letters
// present in the current list (a map of the data, not a static A–Z), spread
// edge-to-edge so rail position == scroll position. See
// roadmap/design-briefs/p46-db01 for the full spec.
//
// The parent owns the show/hide decision and the actual scroll (it holds the
// virtualizer); this component owns geometry, the gesture, and the visuals.

export type ScrubberSection = { letter: string; count: number };

interface AlphabetScrubberProps {
  /** Present letters in collation order (letter headers only — no Favourites). */
  sections: ScrubberSection[];
  /** Letter of the section currently at the top of the viewport, for the passive "where am I". */
  activeLetter: string | null;
  /** The scroll viewport the rail overlays — used to anchor and size the track. */
  viewportEl: HTMLElement | null;
  /** Jump the list to a letter's section (instant, like a native phone-book index). */
  onJump: (letter: string) => void;
}

const HIT_WIDTH = 28; // touch strip — wider than the 22px visual for a comfortable target
const INSET = 6; // track inset from the top/bottom of the scroll area
const PAD = 8; // rail's own vertical padding (matches .kx-scrub padding)
const MIN_CELL = 15; // each rendered letter reserves ≥15px of track before decimation
const EDGE_GAP = 2; // rail sits 2px from the viewport's right edge

export function AlphabetScrubber({ sections, activeLetter, viewportEl, onJump }: AlphabetScrubberProps) {
  const railRef = useRef<HTMLDivElement>(null);
  // Fixed-position box matching the viewport's right edge. Re-measured on resize
  // / orientation / header-collapse — NOT on every scroll frame (the letters
  // must not jitter as content scrolls under them).
  const [box, setBox] = useState<{ top: number; height: number; right: number } | null>(null);
  // Live scrub state: the letter under the thumb and the thumb's Y within the box.
  const [scrub, setScrub] = useState<{ letter: string; y: number } | null>(null);
  const movedRef = useRef(false);

  const measure = useCallback(() => {
    if (!viewportEl) return;
    const rect = viewportEl.getBoundingClientRect();
    setBox({
      top: rect.top + INSET,
      height: Math.max(0, rect.height - INSET * 2),
      right: Math.max(EDGE_GAP, window.innerWidth - rect.right + EDGE_GAP),
    });
  }, [viewportEl]);

  useLayoutEffect(() => {
    if (!viewportEl) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(viewportEl);
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [viewportEl, measure]);

  // Decimation: the whole present-letter set must fit the track. Each rendered
  // cell needs ≥ MIN_CELL of height, so at most floor(track / MIN_CELL) letters
  // can show. When there are more, sample that many evenly (first & last always
  // kept) — the dropped letters stay reachable because the drag maps
  // proportionally across ALL sections, and the bubble snaps to the real letter.
  const trackH = box ? Math.max(0, box.height - PAD * 2) : 0;
  const maxCells = trackH > 0 ? Math.max(4, Math.floor(trackH / MIN_CELL)) : sections.length;
  const display =
    sections.length <= maxCells
      ? sections
      : (() => {
          const picked: typeof sections = [];
          const seen = new Set<number>();
          for (let k = 0; k < maxCells; k++) {
            const idx = Math.round((k * (sections.length - 1)) / (maxCells - 1));
            if (!seen.has(idx)) {
              seen.add(idx);
              picked.push(sections[idx]!);
            }
          }
          return picked;
        })();

  // Map a pointer Y to the nearest present section — proportional across the
  // whole track, so a touch 60% down maps to ~60% into the list (3·B).
  const sectionAtY = useCallback(
    (clientY: number): { letter: string; y: number } | null => {
      const el = railRef.current;
      if (!el || sections.length === 0) return null;
      const rect = el.getBoundingClientRect();
      const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
      const fraction = rect.height > 0 ? y / rect.height : 0;
      const index = Math.min(sections.length - 1, Math.max(0, Math.round(fraction * (sections.length - 1))));
      return { letter: sections[index]!.letter, y };
    },
    [sections],
  );

  const beginScrub = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const hit = sectionAtY(e.clientY);
      if (!hit) return;
      movedRef.current = false;
      try {
        railRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* setPointerCapture can throw for a stale/synthetic pointer id — ignore */
      }
      // Show the bubble immediately; the jump waits for a move (drag) or the
      // release (tap) so a plain tap jumps once, on release.
      setScrub(hit);
    },
    [sectionAtY],
  );

  const moveScrub = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!railRef.current?.hasPointerCapture(e.pointerId)) return;
      const hit = sectionAtY(e.clientY);
      if (!hit) return;
      setScrub((prev) => {
        if (prev?.letter !== hit.letter) {
          movedRef.current = true;
          // Drag-scrub sets the scroll directly (no smooth) so it tracks the finger.
          onJump(hit.letter);
        }
        return hit;
      });
    },
    [onJump, sectionAtY],
  );

  const endScrub = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (railRef.current?.hasPointerCapture(e.pointerId)) {
        railRef.current.releasePointerCapture(e.pointerId);
      }
      // A press with no cross-letter movement is a tap → jump to that letter.
      if (!movedRef.current && scrub) onJump(scrub.letter);
      setScrub(null);
    },
    [onJump, scrub],
  );

  // Keyboard / assistive-tech activation of a specific letter. A pointer drag
  // also emits a synthetic click on the button under the finger — suppress that
  // so the drag's own jumps stand.
  const handleLetterClick = useCallback(
    (letter: string) => {
      if (movedRef.current) {
        movedRef.current = false;
        return;
      }
      onJump(letter);
    },
    [onJump],
  );

  useEffect(() => {
    // Safety: if the rail unmounts mid-drag, drop any lingering scrub visuals.
    return () => setScrub(null);
  }, []);

  if (!box || sections.length === 0) return null;

  const active = scrub?.letter ?? null;

  return (
    <>
      {scrub ? (
        <div
          aria-hidden="true"
          className="kx-scrub-bubble"
          style={{ top: box.top + scrub.y - 30, right: box.right + HIT_WIDTH + 4 }}
        >
          {scrub.letter}
        </div>
      ) : null}
      <nav
        ref={railRef}
        aria-label="Jump to section"
        className={`kx-scrub${scrub ? " is-active" : ""}`}
        onPointerDown={beginScrub}
        onPointerMove={moveScrub}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        style={{ top: box.top, height: box.height, right: box.right, width: HIT_WIDTH }}
      >
        {display.map((s) => {
          const isActive = active ? s.letter === active : activeLetter === s.letter;
          const noun = s.count === 1 ? "contact" : "contacts";
          const label =
            s.letter === "#"
              ? `Jump to number and symbol names, ${s.count} ${noun}`
              : `Jump to ${s.letter}, ${s.count} ${noun}`;
          return (
            <button
              key={s.letter}
              aria-label={label}
              className={`kx-scrub-letter${isActive ? " is-current" : ""}`}
              onClick={() => handleLetterClick(s.letter)}
              tabIndex={-1}
              type="button"
            >
              {s.letter}
            </button>
          );
        })}
      </nav>
    </>
  );
}

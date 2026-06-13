"use client";

import { useRef, useState } from "react";
import { useDrag } from "@use-gesture/react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

interface SwipeableRowProps {
  onArchive: () => void;
  onToggleFavourite: () => void;
  isFavourite: boolean;
  children: React.ReactNode;
}

const REVEAL_WIDTH = 168; // two 84px action buttons
const SNAP_THRESHOLD = 0.4; // 40% of row width → snap open
const OFFSET_EPSILON = 0.5;

/**
 * Swipe-to-reveal row (Favourite / Archive). Uses @use-gesture/react's useDrag
 * with axis lock so the gesture is reliable inside the virtualized vertical
 * scroll container — hand-rolled pointer/touch handling kept getting stolen by
 * the scroll. `axis: "x"` + `touch-action: pan-y` lets vertical scrolling pass
 * through while horizontal drags reveal the actions. `filterTaps` keeps taps
 * navigating to the contact.
 */
export function SwipeableRow({ onArchive, onToggleFavourite, isFavourite, children }: SwipeableRowProps) {
  const [offset, setOffset] = useState(0); // px revealed (0…REVEAL_WIDTH)
  const [animate, setAnimate] = useState(false);
  const offsetRef = useRef(0);
  const baseRef = useRef(0);
  const rowWidthRef = useRef(375);
  const rowRef = useRef<HTMLDivElement>(null);

  const apply = (value: number, withAnim: boolean) => {
    if (Math.abs(offsetRef.current - value) < OFFSET_EPSILON && animate === withAnim) return;
    offsetRef.current = value;
    setAnimate(withAnim);
    setOffset(value);
  };

  const bind = useDrag(
    ({ first, last, movement: [mx], tap }) => {
      if (tap) return;
      if (first) {
        baseRef.current = offsetRef.current;
        rowWidthRef.current = rowRef.current?.offsetWidth ?? 375;
      }

      // mx is negative when dragging left; revealing increases the offset.
      let next = baseRef.current - mx;
      next = Math.max(0, next);
      if (next > REVEAL_WIDTH) next = REVEAL_WIDTH + (next - REVEAL_WIDTH) * 0.28; // rubber-band

      if (last) {
        apply(next >= rowWidthRef.current * SNAP_THRESHOLD ? REVEAL_WIDTH : 0, true);
      } else {
        apply(next, false);
      }
    },
    { axis: "x", filterTaps: true, pointer: { touch: true }, eventOptions: { passive: false } },
  );

  const vibrate = () => { try { navigator.vibrate?.(10); } catch { /* ignore */ } };

  const handleFav = () => {
    vibrate();
    onToggleFavourite();
    apply(0, true);
  };

  const handleArchive = () => {
    vibrate();
    apply(rowWidthRef.current, true);
    setTimeout(() => onArchive(), 200);
  };

  // When the row is open, a tap on the foreground closes it instead of opening
  // the contact. Capture phase so it runs before the inner Link.
  const onForegroundClickCapture = (e: React.MouseEvent) => {
    if (offsetRef.current > 4) {
      e.preventDefault();
      e.stopPropagation();
      apply(0, true);
    }
  };

  return (
    <div ref={rowRef} style={{ position: "relative", overflow: "hidden" }}>
      {/* Revealed actions */}
      <div
        aria-hidden={offset <= 4}
        style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: REVEAL_WIDTH, display: "flex" }}
      >
        <button
          aria-label={isFavourite ? "Unstar" : "Favourite"}
          onClick={handleFav}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          style={{
            flex: 1, background: "#17352e", color: "#fff", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
          }}
          type="button"
        >
          <WorkspaceIcon fill={isFavourite ? "#fff" : "none"} name="star" size={21} strokeWidth={2} />
          {isFavourite ? "Unstar" : "Favourite"}
        </button>
        <button
          aria-label="Archive"
          onClick={handleArchive}
          onPointerDown={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          style={{
            flex: 1, background: "#b5472f", color: "#fff", border: "none", cursor: "pointer",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
            fontSize: 11, fontWeight: 600,
          }}
          type="button"
        >
          <WorkspaceIcon name="archive" size={21} strokeWidth={1.8} />
          Archive
        </button>
      </div>

      {/* Sliding foreground — drag-bound, transform driven by React state */}
      <div
        {...bind()}
        onClickCapture={onForegroundClickCapture}
        style={{
          position: "relative",
          zIndex: 1,
          transform: `translate3d(${-offset}px,0,0)`,
          transition: animate ? "transform 0.24s cubic-bezier(0.2,0.8,0.2,1)" : "none",
          touchAction: "pan-y",
          willChange: offset > 0 ? "transform" : "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

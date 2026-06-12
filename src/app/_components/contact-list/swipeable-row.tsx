"use client";

import { useRef, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

interface SwipeableRowProps {
  onArchive: () => void;
  onToggleFavourite: () => void;
  isFavourite: boolean;
  children: React.ReactNode;
}

const REVEAL_WIDTH = 168; // two 84px action buttons
const SNAP_THRESHOLD = 0.4; // 40% of row width → snap open

export function SwipeableRow({ onArchive, onToggleFavourite, isFavourite, children }: SwipeableRowProps) {
  // State-driven transform: React owns the offset so a re-render (e.g. the
  // virtualizer's measureElement ResizeObserver) can't wipe an imperatively-set
  // style mid-gesture. `offsetRef` mirrors it for the synchronous snap decision.
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(false);
  const offsetRef = useRef(0);

  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const baseX = useRef(0);
  const intent = useRef<"none" | "swipe" | "scroll">("none");
  const pointerId = useRef<number | null>(null);

  const move = (value: number, withAnim: boolean) => {
    offsetRef.current = value;
    setAnimate(withAnim);
    setOffset(value);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return; // desktop uses hover actions, not swipe
    startX.current = e.clientX;
    startY.current = e.clientY;
    baseX.current = offsetRef.current;
    intent.current = "none";
    pointerId.current = e.pointerId;
    setAnimate(false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerId.current) return;
    const dx = startX.current - e.clientX;
    const dy = Math.abs(e.clientY - startY.current);

    // Commit to swipe vs scroll on the first significant movement.
    if (intent.current === "none") {
      if (Math.abs(dx) > 4 || dy > 4) {
        intent.current = dy > Math.abs(dx) ? "scroll" : "swipe";
        if (intent.current === "swipe") {
          try { rowRef.current?.setPointerCapture(e.pointerId); } catch (_) {}
        }
      }
      return;
    }
    if (intent.current !== "swipe") return;

    let next = baseX.current + dx;
    next = Math.max(0, next);
    if (next > REVEAL_WIDTH) next = REVEAL_WIDTH + (next - REVEAL_WIDTH) * 0.28; // rubber-band
    move(next, false);
  };

  const handlePointerUp = () => {
    if (intent.current !== "swipe") {
      intent.current = "none";
      pointerId.current = null;
      return;
    }
    intent.current = "none";
    pointerId.current = null;
    const rowW = rowRef.current?.offsetWidth ?? 375;
    move(offsetRef.current >= rowW * SNAP_THRESHOLD ? REVEAL_WIDTH : 0, true);
  };

  const vibrate = () => { try { navigator.vibrate?.(10); } catch (_) {} };

  const handleFav = () => {
    vibrate();
    onToggleFavourite();
    move(0, true);
  };

  const handleArchive = () => {
    vibrate();
    move(rowRef.current?.offsetWidth ?? 375, true);
    setTimeout(() => onArchive(), 200);
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

      {/* Sliding foreground — transform driven by React state */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
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

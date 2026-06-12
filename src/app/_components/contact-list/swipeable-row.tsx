"use client";

import { useRef } from "react";

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
  const rowRef = useRef<HTMLDivElement>(null);
  const foregroundRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const baseX = useRef(0);
  const currentX = useRef(0);
  const pendingX = useRef(0);
  const frame = useRef<number | null>(null);
  const intent = useRef<"none" | "swipe" | "scroll">("none");
  const pointerId = useRef<number | null>(null);

  const applyTransform = (value: number, animate: boolean) => {
    const foreground = foregroundRef.current;
    if (!foreground) return;
    foreground.style.transition = animate ? "transform 0.24s cubic-bezier(0.2,0.8,0.2,1)" : "none";
    foreground.style.transform = value > 0 ? `translate3d(-${value}px,0,0)` : "translate3d(0,0,0)";
    foreground.style.willChange = value > 0 || !animate ? "transform" : "auto";
    currentX.current = value;
  };

  const scheduleTransform = (value: number) => {
    pendingX.current = value;
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      applyTransform(pendingX.current, false);
    });
  };

  const snapTo = (target: number) => {
    if (frame.current !== null) {
      cancelAnimationFrame(frame.current);
      frame.current = null;
    }
    applyTransform(target, true);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return; // desktop only uses hover actions
    startX.current = e.clientX;
    startY.current = e.clientY;
    baseX.current = currentX.current;
    intent.current = "none";
    pointerId.current = e.pointerId;
    applyTransform(currentX.current, false);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerId.current) return;
    const dx = startX.current - e.clientX;
    const dy = Math.abs(e.clientY - startY.current);

    // Determine intent on first significant movement
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
    // Rubber-band past full reveal
    if (next > REVEAL_WIDTH) next = REVEAL_WIDTH + (next - REVEAL_WIDTH) * 0.28;
    scheduleTransform(next);
  };

  const handlePointerUp = () => {
    if (intent.current !== "swipe") { intent.current = "none"; pointerId.current = null; return; }
    intent.current = "none";
    pointerId.current = null;
    const rowW = rowRef.current?.offsetWidth ?? 375;
    snapTo(currentX.current >= rowW * SNAP_THRESHOLD ? REVEAL_WIDTH : 0);
  };

  const vibrate = () => { try { navigator.vibrate?.(10); } catch (_) {} };

  const handleFav = () => {
    vibrate();
    onToggleFavourite();
    snapTo(0);
  };

  const handleArchive = () => {
    vibrate();
    snapTo(rowRef.current?.offsetWidth ?? 375);
    setTimeout(() => onArchive(), 200);
  };

  return (
    <div ref={rowRef} style={{ position: "relative", overflow: "hidden" }}>
      {/* Revealed actions */}
      <div
        aria-hidden
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

      {/* Sliding foreground */}
      <div
        ref={foregroundRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          position: "relative",
          zIndex: 1,
          transform: "translate3d(0,0,0)",
          transition: "none",
          touchAction: "pan-y",
          willChange: "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

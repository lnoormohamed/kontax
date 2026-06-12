"use client";

import { useRef, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

interface SwipeableRowProps {
  onArchive: () => void;
  onToggleFavourite: () => void;
  isFavourite: boolean;
  children: React.ReactNode;
}

const REVEAL_WIDTH = 160;
const SNAP_THRESHOLD = 0.4;
const ACTIVATION_DELAY_MS = 150;

export function SwipeableRow({ onArchive, onToggleFavourite, isFavourite, children }: SwipeableRowProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startX = useRef(0);
  const startY = useRef(0);
  const capturedPointerId = useRef<number | null>(null);
  const isActivated = useRef(false);
  const activationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const rowRef = useRef<HTMLDivElement>(null);

  const close = () => setTranslateX(0);

  const cancel = () => {
    clearTimeout(activationTimer.current);
    isActivated.current = false;
    setIsDragging(false);
    setTranslateX(0);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;

    startX.current = e.clientX;
    startY.current = e.clientY;
    capturedPointerId.current = e.pointerId;
    isActivated.current = false;

    activationTimer.current = setTimeout(() => {
      isActivated.current = true;
      setIsDragging(true);
      rowRef.current?.setPointerCapture(e.pointerId);
    }, ACTIVATION_DELAY_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.pointerId !== capturedPointerId.current) return;

    const deltaX = startX.current - e.clientX;
    const deltaY = Math.abs(e.clientY - startY.current);

    if (!isActivated.current) {
      // Vertical movement dominates → user is scrolling, cancel the swipe
      if (deltaY > Math.abs(deltaX) + 5) {
        clearTimeout(activationTimer.current);
      }
      return;
    }

    if (!isDragging) return;
    setTranslateX(Math.max(0, Math.min(deltaX, REVEAL_WIDTH)));
  };

  const handlePointerUp = () => {
    clearTimeout(activationTimer.current);
    capturedPointerId.current = null;
    isActivated.current = false;

    if (!isDragging) return;
    setIsDragging(false);

    if (translateX > REVEAL_WIDTH * SNAP_THRESHOLD) {
      setTranslateX(REVEAL_WIDTH);
    } else {
      setTranslateX(0);
    }
  };

  const handleAction = (fn: () => void) => {
    fn();
    close();
    navigator.vibrate?.(10);
  };

  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      {/* Action buttons revealed behind the row on left swipe */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: REVEAL_WIDTH,
          display: "flex",
        }}
      >
        <button
          aria-label={isFavourite ? "Unfavourite" : "Favourite"}
          onClick={() => handleAction(onToggleFavourite)}
          style={{
            flex: 1,
            background: "#17352e",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
          }}
          type="button"
        >
          <WorkspaceIcon
            fill={isFavourite ? "#e0a31c" : "none"}
            name="star"
            size={20}
            strokeWidth={isFavourite ? 2 : 1.8}
          />
          {isFavourite ? "Unfav" : "Fav"}
        </button>
        <button
          aria-label="Archive contact"
          onClick={() => handleAction(onArchive)}
          style={{
            flex: 1,
            background: "#b5472f",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 600,
          }}
          type="button"
        >
          <WorkspaceIcon name="archive" size={20} strokeWidth={1.8} />
          Archive
        </button>
      </div>

      {/* Sliding row content — sits above the action buttons via z-index */}
      <div
        ref={rowRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={cancel}
        style={{
          position: "relative",
          zIndex: 1,
          transform: translateX > 0 ? `translateX(-${translateX}px)` : undefined,
          transition: isDragging ? "none" : "transform 200ms ease",
          touchAction: "pan-y",
          willChange: translateX > 0 || isDragging ? "transform" : "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

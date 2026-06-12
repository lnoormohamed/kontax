"use client";

import { useEffect, useRef, useState } from "react";

import { WorkspaceIcon } from "~/app/_components/workspace-icons";

interface MobileBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export function MobileBottomSheet({ isOpen, onClose, title, children }: MobileBottomSheetProps) {
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [mounted, setMounted] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Two-frame mount so the slide-in CSS transition fires
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => requestAnimationFrame(() => setMounted(true)));
    } else {
      setMounted(false);
    }
  }, [isOpen]);

  // Keyboard-awareness via visualViewport API
  useEffect(() => {
    if (!isOpen || typeof window === "undefined" || !window.visualViewport) return;

    const update = () => {
      const vv = window.visualViewport!;
      // Keyboard height = distance the visual viewport has shifted upward
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardOffset(offset);

      // Scroll focused element into view within the sheet content
      const focused = document.activeElement as HTMLElement | null;
      if (focused && contentRef.current?.contains(focused)) {
        setTimeout(() => focused.scrollIntoView({ block: "nearest", behavior: "smooth" }), 50);
      }
    };

    window.visualViewport.addEventListener("resize", update, { passive: true });
    window.visualViewport.addEventListener("scroll", update, { passive: true });
    update();
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      setKeyboardOffset(0);
    };
  }, [isOpen]);

  // Trap focus inside sheet and close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 60,
          opacity: mounted ? 1 : 0,
          transition: "opacity 200ms ease",
        }}
      />

      {/* Sheet panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: keyboardOffset,
          zIndex: 61,
          background: "#fff",
          borderRadius: "20px 20px 0 0",
          boxShadow: "0 -4px 32px rgba(0,0,0,0.16)",
          display: "flex",
          flexDirection: "column",
          maxHeight: "90svh",
          transform: mounted ? "translateY(0)" : "translateY(100%)",
          transition: "transform 280ms cubic-bezier(0.34,1.02,0.64,1), bottom 150ms ease",
        }}
      >
        {/* Drag handle (visual affordance only) */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: 12,
            paddingBottom: 4,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#d8ddd6",
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 12px",
            flexShrink: 0,
            borderBottom: "1px solid #e9ece7",
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#1d2823",
              margin: 0,
            }}
          >
            {title}
          </h2>
          <button
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#f2f4f0",
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
              color: "#5c655e",
              flexShrink: 0,
            }}
            type="button"
          >
            <WorkspaceIcon name="close" size={16} />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          ref={contentRef}
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "16px 16px 32px",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

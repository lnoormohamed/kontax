"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { useContactEdit } from "~/app/_components/contact-inline-editor";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

interface MobileContactDetailProps {
  contactId: string;
  contactName: string;
  backHref: string;
  avatarBg: string;
  avatarFg: string;
  initials: string;
  subtitle: string | null;
  phone: string | null;
  email: string | null;
  isFavorite: boolean;
  isArchived: boolean;
  isEditable: boolean;
  detailTab: "details" | "sharing" | "history";
  toggleFavoriteAction: (formData: FormData) => Promise<void>;
  archiveOrRestoreAction: (formData: FormData) => Promise<void>;
  children: React.ReactNode;
}

const TABS = [
  { key: "details", label: "Details", icon: "briefcase" },
  { key: "sharing", label: "Sharing", icon: "share" },
  { key: "history", label: "History", icon: "clock" },
] as const;

export function MobileContactDetail({
  contactId,
  contactName,
  backHref,
  avatarBg,
  avatarFg,
  initials,
  subtitle,
  phone,
  email,
  isFavorite,
  isArchived,
  isEditable,
  detailTab,
  toggleFavoriteAction,
  archiveOrRestoreAction,
  children,
}: MobileContactDetailProps) {
  const { mode, saving, enterEdit, cancel, save } = useContactEdit();
  const editing = mode === "edit";

  const containerRef = useRef<HTMLDivElement>(null);
  const [heroVisible, setHeroVisible] = useState(true);

  // Walk up the DOM once to find the nearest scroll container
  const findScrollContainer = () => {
    let el: Element | null = containerRef.current?.parentElement ?? null;
    while (el && el !== document.documentElement) {
      const oy = getComputedStyle(el).overflowY;
      if (oy === "auto" || oy === "scroll") return el as HTMLElement;
      el = el.parentElement;
    }
    return null;
  };

  // Show/hide compact header based on scroll position (scrollTop > 80px threshold)
  useEffect(() => {
    const container = findScrollContainer();
    const scrollTarget = container ?? window;
    const handleScroll = () => {
      const top = container ? container.scrollTop : window.scrollY;
      setHeroVisible(top < 80);
    };
    scrollTarget.addEventListener("scroll", handleScroll, { passive: true });
    return () => scrollTarget.removeEventListener("scroll", handleScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keyboard-awareness: when editing, use visualViewport to pad the scroll
  // container so focused fields remain visible above the software keyboard.
  useEffect(() => {
    if (!editing || typeof window === "undefined" || !window.visualViewport) return;
    const container = findScrollContainer();
    if (!container) return;

    const BASE_PB = `calc(56px + env(safe-area-inset-bottom))`;

    const handleVV = () => {
      const vv = window.visualViewport!;
      const kh = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      container.style.paddingBottom = kh > 0 ? `${kh + 16}px` : BASE_PB;
      // Scroll focused input into view
      const focused = document.activeElement as HTMLElement | null;
      if (focused && focused.tagName !== "BODY" && container.contains(focused)) {
        setTimeout(() => focused.scrollIntoView({ block: "nearest", behavior: "smooth" }), 80);
      }
    };

    window.visualViewport.addEventListener("resize", handleVV, { passive: true });
    window.visualViewport.addEventListener("scroll", handleVV, { passive: true });
    handleVV();

    return () => {
      window.visualViewport?.removeEventListener("resize", handleVV);
      window.visualViewport?.removeEventListener("scroll", handleVV);
      if (container) container.style.paddingBottom = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const showCompactHeader = !heroVisible || editing;
  const tabBarTop = showCompactHeader ? 52 : 0;

  return (
    <div ref={containerRef}>
      {/* Fixed compact header — appears when hero scrolls off screen or when editing */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          height: 52,
          zIndex: 40,
          backgroundColor: editing ? "#f3f5ff" : "#ffffff",
          borderBottom: `1px solid ${editing ? "rgba(65,88,244,0.28)" : "#d8ddd6"}`,
          display: showCompactHeader ? "flex" : "none",
          alignItems: "center",
          padding: "0 4px",
          gap: 4,
          transition: "background-color 200ms ease",
        }}
      >
        {editing ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8 }}>
            <button
              disabled={saving}
              onClick={cancel}
              style={{
                height: 44,
                padding: "0 12px",
                fontSize: 14,
                fontWeight: 600,
                color: "#5c655e",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
              type="button"
            >
              Cancel
            </button>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: 9999,
                border: "1px solid #c7d0f5",
                background: "#fff",
                padding: "4px 12px",
                fontSize: 13,
                fontWeight: 700,
                color: "#4158f4",
              }}
            >
              Editing
            </span>
          </div>
        ) : (
          <Link
            aria-label={`Back to ${backHref === "/contacts" ? "Contacts" : "back"}`}
            href={backHref}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              height: 44,
              padding: "0 8px",
              textDecoration: "none",
              color: "#5c655e",
              fontSize: 14,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            <WorkspaceIcon name="back" size={20} />
            Contacts
          </Link>
        )}

        <span
          style={{
            flex: 1,
            fontSize: 17,
            fontWeight: 700,
            color: "#1d2823",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            textAlign: "center",
          }}
        >
          {contactName}
        </span>

        {editing ? (
          <button
            disabled={saving}
            onClick={save}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 14px",
              marginRight: 8,
              borderRadius: 8,
              background: "#17352e",
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              opacity: saving ? 0.6 : 1,
            }}
            type="button"
          >
            {saving ? (
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.4)",
                  borderTopColor: "#fff",
                  animation: "spin 0.6s linear infinite",
                }}
              />
            ) : (
              <WorkspaceIcon name="check" size={16} strokeWidth={2.2} />
            )}
            {saving ? "Saving…" : "Save"}
          </button>
        ) : isEditable ? (
          <button
            onClick={enterEdit}
            style={{
              height: 44,
              padding: "0 12px",
              fontSize: 14,
              fontWeight: 600,
              color: "#17352e",
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
            type="button"
          >
            Edit
          </button>
        ) : (
          <div style={{ width: 44 }} />
        )}
      </div>

      {/* Hero section */}
      <div
        style={{
          backgroundColor: editing ? "#f3f5ff" : "#fff",
          padding: "16px 16px 20px",
          transition: "background-color 200ms ease",
        }}
      >
        {/* In-hero nav row — only visible when compact header is hidden */}
        {!showCompactHeader && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 20,
            }}
          >
            <Link
              href={backHref}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                height: 44,
                padding: "0 8px",
                marginLeft: -8,
                textDecoration: "none",
                color: "#5c655e",
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              <WorkspaceIcon name="back" size={20} />
              Contacts
            </Link>
            {isEditable && !editing && (
              <button
                onClick={enterEdit}
                style={{
                  height: 44,
                  padding: "0 8px",
                  marginRight: -8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#17352e",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
                type="button"
              >
                Edit
              </button>
            )}
          </div>
        )}

        {/* Avatar + name */}
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: avatarBg,
              color: avatarFg,
              display: "inline-grid",
              placeItems: "center",
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            {initials}
          </div>
          <h1
            style={{
              marginTop: 12,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: "#1d2823",
              lineHeight: 1.15,
            }}
          >
            {contactName}
          </h1>
          {subtitle && (
            <p style={{ marginTop: 4, fontSize: 14, color: "#5c655e" }}>{subtitle}</p>
          )}
        </div>

        {/* Quick action buttons */}
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            marginTop: 20,
          }}
        >
          {phone && (
            <a
              aria-label="Call"
              href={`tel:${phone}`}
              style={quickActionStyle}
            >
              <WorkspaceIcon name="phone" size={22} />
              <span style={quickActionLabelStyle}>Call</span>
            </a>
          )}
          {email && (
            <a
              aria-label="Email"
              href={`mailto:${email}`}
              style={quickActionStyle}
            >
              <WorkspaceIcon name="mail" size={22} />
              <span style={quickActionLabelStyle}>Email</span>
            </a>
          )}
          <form action={toggleFavoriteAction} style={{ display: "contents" }}>
            <input name="contactId" type="hidden" value={contactId} />
            <input name="redirectTo" type="hidden" value={`/contacts/${contactId}`} />
            <button
              aria-label={isFavorite ? "Unfavorite" : "Favorite"}
              style={{
                ...quickActionStyle,
                color: isFavorite ? "#e0a31c" : "#5c655e",
              }}
              type="submit"
            >
              <WorkspaceIcon
                fill={isFavorite ? "#e0a31c" : "none"}
                name="star"
                size={22}
              />
              <span style={quickActionLabelStyle}>{isFavorite ? "Unfav" : "Fav"}</span>
            </button>
          </form>
          <form action={archiveOrRestoreAction} style={{ display: "contents" }}>
            <input name="contactId" type="hidden" value={contactId} />
            <input name="redirectTo" type="hidden" value={`/contacts/${contactId}`} />
            <button
              aria-label={isArchived ? "Restore" : "Archive"}
              style={quickActionStyle}
              type="submit"
            >
              <WorkspaceIcon name={isArchived ? "restore" : "archive"} size={22} />
              <span style={quickActionLabelStyle}>{isArchived ? "Restore" : "Archive"}</span>
            </button>
          </form>
          <Link
            aria-label="Share"
            href={`/contacts/${contactId}?tab=sharing`}
            style={quickActionStyle}
          >
            <WorkspaceIcon name="share" size={22} />
            <span style={quickActionLabelStyle}>Share</span>
          </Link>
        </div>
      </div>

      {/* Sticky tab bar */}
      <div
        style={{
          position: "sticky",
          top: tabBarTop,
          zIndex: 30,
          backgroundColor: "#fff",
          borderBottom: "1px solid #e9ece7",
          display: "flex",
          overflowX: "auto",
          scrollbarWidth: "none",
          transition: "top 150ms ease",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {TABS.map(({ key, label, icon }) => (
          <Link
            key={key}
            href={`/contacts/${contactId}?tab=${key}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 88,
              height: 44,
              padding: "0 16px",
              flexShrink: 0,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: detailTab === key ? 700 : 500,
              color: detailTab === key ? "#17352e" : "#8b938c",
              borderBottom: detailTab === key ? "2px solid #17352e" : "2px solid transparent",
              whiteSpace: "nowrap",
            }}
          >
            <WorkspaceIcon name={icon} size={16} />
            {label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div>{children}</div>

      {/* FAB — pencil/save, hidden when editing (compact header handles save) */}
      {isEditable && !editing && (
        <button
          aria-label="Edit contact"
          onClick={enterEdit}
          style={{
            position: "fixed",
            bottom: `calc(72px + env(safe-area-inset-bottom))`,
            right: 20,
            width: 52,
            height: 52,
            borderRadius: "50%",
            backgroundColor: "#17352e",
            color: "#fff",
            border: "none",
            cursor: "pointer",
            display: "grid",
            placeItems: "center",
            zIndex: 35,
            boxShadow: "0 4px 16px rgba(23,53,46,0.32)",
            WebkitTapHighlightColor: "transparent",
          }}
          type="button"
        >
          <WorkspaceIcon name="pencil" size={22} />
        </button>
      )}
    </div>
  );
}

const quickActionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
  width: 60,
  height: 60,
  borderRadius: 14,
  border: "1px solid #d8ddd6",
  backgroundColor: "#fff",
  color: "#17352e",
  textDecoration: "none",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  WebkitTapHighlightColor: "transparent",
};

const quickActionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#5c655e",
};

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { createContact } from "~/app/actions/contacts";
import { MobileBottomSheet } from "~/app/_components/mobile-bottom-sheet";
import { WorkspaceIcon } from "~/app/_components/workspace-icons";

interface MobileCreateFabProps {
  canWrite: boolean;
}

const FIELD_STYLE: React.CSSProperties = {
  width: "100%",
  borderRadius: 10,
  border: "1px solid #d8ddd6",
  backgroundColor: "#fff",
  padding: "12px 14px",
  fontSize: 16,
  color: "#1d2823",
  outline: "none",
  boxSizing: "border-box",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#8b938c",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  marginBottom: 6,
  display: "block",
};

export function MobileCreateFab({ canWrite }: MobileCreateFabProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRef.current) return;
    setError(null);
    const fd = new FormData(formRef.current);

    // Require at least a name
    const first = (fd.get("firstName") as string)?.trim();
    const last = (fd.get("lastName") as string)?.trim();
    if (!first && !last) {
      setError("Please enter at least a first or last name.");
      return;
    }

    startTransition(async () => {
      try {
        // createContact redirects on success; catch the redirect nav
        await createContact(fd);
      } catch (err) {
        // Next.js server actions throw on redirect — let the router handle it
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("NEXT_REDIRECT")) {
          setOpen(false);
          router.refresh();
        } else {
          setError("Something went wrong. Please try again.");
        }
      }
    });
  };

  if (!canWrite) return null;

  return (
    <>
      {/* Floating "+" button — mobile only */}
      <button
        aria-label="Create new contact"
        className="grid md:hidden"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: `calc(72px + env(safe-area-inset-bottom))`,
          right: 20,
          width: 52,
          height: 52,
          borderRadius: "50%",
          backgroundColor: "#1d2823",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          placeItems: "center",
          zIndex: 35,
          boxShadow: "0 4px 16px rgba(0,0,0,0.22)",
          WebkitTapHighlightColor: "transparent",
        }}
        type="button"
      >
        <WorkspaceIcon name="plus" size={24} strokeWidth={2.2} />
      </button>

      <MobileBottomSheet isOpen={open} onClose={() => setOpen(false)} title="New contact">
        <form ref={formRef} onSubmit={handleSubmit} noValidate>
          {/* Name row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label htmlFor="qc-first" style={LABEL_STYLE}>First name</label>
              <input
                autoComplete="given-name"
                autoFocus
                id="qc-first"
                name="firstName"
                placeholder="Jane"
                style={FIELD_STYLE}
                type="text"
              />
            </div>
            <div>
              <label htmlFor="qc-last" style={LABEL_STYLE}>Last name</label>
              <input
                autoComplete="family-name"
                id="qc-last"
                name="lastName"
                placeholder="Smith"
                style={FIELD_STYLE}
                type="text"
              />
            </div>
          </div>

          {/* Phone */}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="qc-phone" style={LABEL_STYLE}>Phone</label>
            <input
              autoComplete="tel"
              id="qc-phone"
              inputMode="tel"
              name="phone"
              placeholder="+1 555 000 0000"
              style={FIELD_STYLE}
              type="tel"
            />
          </div>

          {/* Email */}
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="qc-email" style={LABEL_STYLE}>Email</label>
            <input
              autoComplete="email"
              id="qc-email"
              inputMode="email"
              name="email"
              placeholder="jane@example.com"
              style={FIELD_STYLE}
              type="email"
            />
          </div>

          {/* Company */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="qc-company" style={LABEL_STYLE}>Company</label>
            <input
              autoComplete="organization"
              id="qc-company"
              name="company"
              placeholder="Acme Corp"
              style={FIELD_STYLE}
              type="text"
            />
          </div>

          {error && (
            <p style={{ fontSize: 13, color: "#b5472f", marginBottom: 12, marginTop: -8 }}>
              {error}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              disabled={isPending}
              onClick={() => setOpen(false)}
              style={{
                flex: 1,
                height: 48,
                borderRadius: 12,
                border: "1px solid #d8ddd6",
                background: "#f6f7f4",
                fontSize: 15,
                fontWeight: 600,
                color: "#5c655e",
                cursor: "pointer",
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              disabled={isPending}
              style={{
                flex: 2,
                height: 48,
                borderRadius: 12,
                border: "none",
                background: isPending ? "#8b938c" : "#17352e",
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                cursor: isPending ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
              type="submit"
            >
              {isPending ? (
                <>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      animation: "spin 0.6s linear infinite",
                      display: "inline-block",
                    }}
                  />
                  Saving…
                </>
              ) : (
                "Create contact"
              )}
            </button>
          </div>

          {/* Link to full form */}
          <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#8b938c" }}>
            Need more fields?{" "}
            <Link
              href="/contacts/new"
              style={{ color: "#4158f4", fontWeight: 600, textDecoration: "none" }}
            >
              Open full form
            </Link>
          </p>
        </form>
      </MobileBottomSheet>
    </>
  );
}

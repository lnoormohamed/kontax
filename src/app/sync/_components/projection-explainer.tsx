"use client";

// P41-DB01 Surface 3 — the "what will this device see?" explainer.
//
// The load-bearing projection surface. Given a connection's projection config,
// it renders the sample contact exactly as it lands on that device: included
// fields solid, omitted fields struck through with the reason (private / not in
// book). One shared component, used in the settings panel AND first-connection
// onboarding. Re-derives instantly from the live draft via deriveSlice — no
// round-trip — so flipping scope/precedence updates the slice on the spot.

import { type ReactNode } from "react";

import {
  deriveSlice,
  describeSliceTally,
  type Precedence,
  type SampleContact,
} from "~/lib/projection-preview";
import { PROJECTION_COPY } from "~/lib/projection-copy";
import { T } from "./sync-shared";

const GREEN = "#17352e";
const SGREEN = "#1f8a5b";
const AMBER = { bg: "#f6edd9", border: "#e8d8b0", ink: "#7a5a1a", ink2: "#8a6a2a" } as const;

function CheckMark({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
function MinusMark({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
      <path d="M5 12h14" />
    </svg>
  );
}

function SeeField({
  label,
  value,
  included,
  reason,
  isPrivate,
  compact,
}: {
  label: string;
  value: string;
  included: boolean;
  reason: string | null;
  isPrivate: boolean;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: compact ? "7px 0" : "8px 0",
        borderTop: `1px solid ${T.line2}`,
      }}
    >
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          flex: "0 0 auto",
          display: "grid",
          placeItems: "center",
          background: included ? "rgba(31,138,91,0.12)" : T.wash,
          color: included ? SGREEN : T.mute,
        }}
      >
        {included ? <CheckMark /> : <MinusMark />}
      </span>
      <span
        style={{
          width: compact ? 80 : 96,
          flex: "0 0 auto",
          fontSize: compact ? 12 : 12.5,
          color: T.mute,
          fontWeight: 500,
        }}
      >
        {label}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: compact ? 12 : 13,
          color: included ? T.ink : T.mute,
          textDecoration: included ? "none" : "line-through",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
      {reason ? (
        <span
          style={{
            flex: "0 0 auto",
            fontSize: 10.5,
            fontWeight: 600,
            color: isPrivate ? T.mute : included ? SGREEN : T.mute,
            background: isPrivate ? T.wash : included ? "rgba(31,138,91,0.12)" : "transparent",
            borderRadius: 5,
            padding: reason ? "1px 6px" : 0,
          }}
        >
          {reason}
        </span>
      ) : null}
    </div>
  );
}

export type ProjectionExplainerProps = {
  contact: SampleContact;
  projectionBookSlugs: string[];
  precedence: Precedence;
  // slug → display name (for the "not in {Book}" reason + subtitle).
  bookNames?: Record<string, string>;
  deviceTitle: string;
  deviceSubtitle: string;
  platformIcon?: ReactNode;
  // Renders the "Nothing to project yet" state instead of the card.
  emptyBook?: { bookName: string };
  compact?: boolean;
};

export function ProjectionExplainer({
  contact,
  projectionBookSlugs,
  precedence,
  bookNames,
  deviceTitle,
  deviceSubtitle,
  platformIcon,
  emptyBook,
  compact,
}: ProjectionExplainerProps) {
  const slice = deriveSlice(contact, { projectionBookSlugs, precedence }, bookNames);
  const firstBookName = bookNames?.[projectionBookSlugs[0] ?? ""] ?? undefined;
  // "Only the name lands" when every field but the name is held back and all held
  // fields are private (the fully-private-contact state).
  const fullyPrivate =
    slice.pushedCount <= 1 && slice.outsideBookHeldCount === 0 && slice.privateHeldCount > 0;

  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: compact ? 12 : 14, overflow: "hidden", background: "#fff" }}>
      {/* device header — green chrome */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: compact ? "10px 13px" : "12px 15px",
          background: GREEN,
          color: "#fff",
        }}
      >
        {platformIcon ? (
          <span
            style={{
              width: compact ? 22 : 26,
              height: compact ? 22 : 26,
              borderRadius: 7,
              background: "rgba(255,255,255,0.14)",
              display: "grid",
              placeItems: "center",
              flex: "0 0 auto",
            }}
          >
            {platformIcon}
          </span>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {deviceTitle}
          </div>
          <div style={{ fontSize: compact ? 10.5 : 11.5, color: "rgba(255,255,255,0.72)", marginTop: 1 }}>{deviceSubtitle}</div>
        </div>
      </div>

      {emptyBook ? (
        <div style={{ padding: "26px 18px", textAlign: "center" }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: T.ink }}>{PROJECTION_COPY.emptyBookTitle}</div>
          <div style={{ fontSize: 12.5, color: T.ink2, marginTop: 4, lineHeight: 1.5, maxWidth: 280, margin: "4px auto 0" }}>
            {PROJECTION_COPY.emptyBookBody(emptyBook.bookName)}
          </div>
        </div>
      ) : (
        <>
          <div style={{ padding: compact ? "12px 14px 4px" : "14px 16px 6px" }}>
            <div style={{ fontSize: compact ? 14 : 15, fontWeight: 600, color: T.ink }}>{contact.name}</div>
            {contact.role ? <div style={{ fontSize: 12, color: T.mute, marginTop: 1 }}>{contact.role}</div> : null}
            <div style={{ marginTop: 8 }}>
              {slice.fields.map((f) => (
                <SeeField
                  key={f.key}
                  label={f.key}
                  value={f.value}
                  included={f.included}
                  reason={typeof f.reason === "string" ? f.reason : null}
                  isPrivate={f.kind === "private"}
                  compact={compact}
                />
              ))}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: compact ? "9px 14px" : "10px 16px",
              background: "#f4faf6",
              borderTop: `1px solid ${T.line2}`,
              fontSize: compact ? 11 : 12,
              color: T.ink2,
              lineHeight: 1.45,
            }}
          >
            <span style={{ color: SGREEN, flex: "0 0 auto", display: "grid", placeItems: "center" }}>
              <CheckMark size={13} />
            </span>
            <span>{fullyPrivate ? PROJECTION_COPY.fullyPrivateFoot : describeSliceTally(slice, firstBookName)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// P41-DB01 3C: the collision-preview chip — names the winner and why so the
// resolved value is never a surprise. Amber, informational (not an error).
export function CollisionChip({ winnerBook }: { winnerBook: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 600,
        color: AMBER.ink,
        background: AMBER.bg,
        border: `1px solid ${AMBER.border}`,
        borderRadius: 6,
        padding: "3px 8px",
      }}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 3l9 16H3z" />
      </svg>
      {PROJECTION_COPY.collisionChip(winnerBook)}
    </span>
  );
}

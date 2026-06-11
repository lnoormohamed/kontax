import {
  Column,
  Heading as REHeading,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

import { tokens } from "../_tokens";

// Shared content primitives (P20-03). Templates compose these inside an
// EmailLayout; spacing between siblings is owned by the layout's content
// section, so each primitive carries no outer margin of its own.

export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <REHeading
      as="h1"
      style={{
        margin: "0 0 12px",
        fontSize: "20px",
        fontWeight: 600,
        lineHeight: "26px",
        letterSpacing: "-0.01em",
        color: tokens.ink,
      }}
    >
      {children}
    </REHeading>
  );
}

export function EmailText({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Text
      style={{
        margin: "0 0 16px",
        fontSize: "14px",
        lineHeight: "22px",
        color: color ?? tokens.secondary,
      }}
    >
      {children}
    </Text>
  );
}

export function EmailFootnote({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={{
        margin: "16px 0 0",
        fontSize: "12px",
        lineHeight: "20px",
        color: tokens.muted,
      }}
    >
      {children}
    </Text>
  );
}

export function EmailSectionLabel({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <Text
      style={{
        margin: "0 0 12px",
        fontSize: "13px",
        fontWeight: 600,
        lineHeight: "16px",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        color: color ?? tokens.ink,
      }}
    >
      {children}
    </Text>
  );
}

export function EmailTextLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        color: tokens.blue,
        fontSize: "14px",
        fontWeight: 600,
        lineHeight: "22px",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}

/**
 * Key/value detail block (device info, contact info, billing facts). Uses a
 * table row per pair so values wrap rather than clip on narrow clients.
 */
export function EmailDetailBlock({ rows }: { rows: [string, string][] }) {
  return (
    <Section
      style={{
        backgroundColor: tokens.bgDetail,
        borderRadius: "6px",
        padding: "12px 16px",
        margin: "0 0 16px",
      }}
    >
      {rows.map(([key, value], i) => (
        <Row key={key} style={{ marginTop: i === 0 ? 0 : "9px" }}>
          <Column
            style={{
              fontSize: "13px",
              lineHeight: "18px",
              color: tokens.muted,
              whiteSpace: "nowrap",
              verticalAlign: "top",
              paddingRight: "16px",
            }}
          >
            {key}
          </Column>
          <Column
            style={{
              fontSize: "13px",
              lineHeight: "18px",
              color: tokens.ink,
              fontWeight: 500,
              textAlign: "right",
              verticalAlign: "top",
            }}
          >
            {value}
          </Column>
        </Row>
      ))}
    </Section>
  );
}

/** Amber left-bordered warning callout (payment failure, account deletion). */
export function EmailWarningBlock({ children }: { children: React.ReactNode }) {
  return (
    <Section
      style={{
        backgroundColor: tokens.warnBg,
        borderLeft: `4px solid ${tokens.amber}`,
        borderRadius: "6px",
        padding: "12px 16px",
        margin: "0 0 16px",
      }}
    >
      <Row>
        <Column
          style={{
            width: "24px",
            verticalAlign: "top",
            color: tokens.amber,
            fontSize: "15px",
            lineHeight: "22px",
          }}
        >
          ⚠
        </Column>
        <Column
          style={{
            fontSize: "14px",
            lineHeight: "22px",
            color: tokens.warnInk,
          }}
        >
          {children}
        </Column>
      </Row>
    </Section>
  );
}

/** Simple muted-bullet list used by the digest and downgrade summaries. */
export function EmailBulletList({ items }: { items: React.ReactNode[] }) {
  return (
    <Section style={{ margin: "0 0 16px" }}>
      {items.map((item, i) => (
        <Row key={i} style={{ marginTop: i === 0 ? 0 : "8px" }}>
          <Column
            style={{
              width: "16px",
              verticalAlign: "top",
              fontSize: "14px",
              lineHeight: "22px",
              color: tokens.muted,
            }}
          >
            •
          </Column>
          <Column
            style={{
              fontSize: "14px",
              lineHeight: "22px",
              color: tokens.secondary,
            }}
          >
            {item}
          </Column>
        </Row>
      ))}
    </Section>
  );
}

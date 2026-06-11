import { Section, Text } from "@react-email/components";
import * as React from "react";

import { EmailButton } from "./_components/email-button";
import {
  EmailBulletList,
  EmailHeading,
  EmailSectionLabel,
  EmailText,
} from "./_components/email-content";
import { EmailLayout } from "./_components/email-layout";
import { tokens } from "./_tokens";

type DigestCategory =
  | "SHARE"
  | "CONTACT_UPDATE"
  | "SYNC"
  | "REMINDER"
  | "SECURITY";

interface DigestItem {
  category: DigestCategory;
  summary: string;
}

interface DigestProps {
  cadence: "daily" | "weekly";
  /** Human-readable period, e.g. "Jun 4 – Jun 11, 2026". */
  periodLabel: string;
  items: DigestItem[];
  viewUrl: string;
}

// Section order + labels. Security is always shown last when present, and is
// never filtered out by notification preferences (P20-09 acceptance).
const CATEGORY_ORDER: DigestCategory[] = [
  "SHARE",
  "CONTACT_UPDATE",
  "SYNC",
  "REMINDER",
  "SECURITY",
];
const CATEGORY_LABELS: Record<DigestCategory, string> = {
  SHARE: "Contact shares",
  CONTACT_UPDATE: "Contact updates",
  SYNC: "Sync activity",
  REMINDER: "Upcoming dates",
  SECURITY: "Security",
};

/** Notification digest (P20-09). Groups a flat item list into labelled sections. */
export default function Digest({
  cadence,
  periodLabel,
  items,
  viewUrl,
}: DigestProps) {
  const groups = CATEGORY_ORDER.map((category) => ({
    label: CATEGORY_LABELS[category],
    items: items.filter((i) => i.category === category).map((i) => i.summary),
  })).filter((g) => g.items.length > 0);

  return (
    <EmailLayout preview={`Your Kontax ${cadence} summary — ${periodLabel}`}>
      <EmailHeading>Your {cadence} summary</EmailHeading>
      <Text
        style={{
          margin: "-8px 0 16px",
          fontSize: "13px",
          lineHeight: "18px",
          color: tokens.muted,
        }}
      >
        {periodLabel}
      </Text>

      {groups.length === 0 ? (
        <EmailText>
          Nothing to report this {cadence}. Keep up the good work!
        </EmailText>
      ) : (
        groups.map((group) => (
          <Section key={group.label} style={{ marginBottom: "8px" }}>
            <EmailSectionLabel>{group.label}</EmailSectionLabel>
            <EmailBulletList items={group.items} />
          </Section>
        ))
      )}

      <EmailButton href={viewUrl}>View in Kontax →</EmailButton>
    </EmailLayout>
  );
}

Digest.PreviewProps = {
  cadence: "weekly",
  periodLabel: "Jun 4 – Jun 11, 2026",
  items: [
    {
      category: "SHARE",
      summary: "Dana Whitfield shared Marcus Reyes with you",
    },
    { category: "SHARE", summary: "You accepted 2 shared contacts" },
    { category: "SYNC", summary: "412 contacts synced across 3 devices" },
    { category: "SYNC", summary: "1 sync conflict resolved automatically" },
    { category: "REMINDER", summary: "Priya Nair's birthday — Jun 13" },
    { category: "REMINDER", summary: "Work anniversary: Tom Healy — Jun 15" },
    {
      category: "SECURITY",
      summary: "New sign-in from Chrome on macOS — recognised device",
    },
  ],
  viewUrl: "https://kontax.app",
} satisfies DigestProps;

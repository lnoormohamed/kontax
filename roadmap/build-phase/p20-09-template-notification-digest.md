# P20-09 — Template: Notification Digest

## Purpose

Users who prefer low-frequency updates can opt into a daily or weekly digest email summarising their Kontax activity rather than receiving individual notification emails. This is a P2 ticket — it depends on Phase 22's notification infrastructure being in place.

## Background

Phase 22 (P22-08) implements the digest scheduling and content assembly. This ticket provides only the React Email template. The digest content (list of `UserNotification` rows from a time window) is assembled by P22-08 and passed as props to this template.

## Scope

**In scope:**
- `NotificationDigestTemplate` React Email component
- Sections for: new contacts shared, contact updates, sync status, birthday reminders upcoming, suspicious activity (always included regardless of preferences)

---

## Design / Implementation Spec

### Template

```tsx
// src/emails/digest.tsx
import { Text, Section, Hr } from "@react-email/components";
import { EmailLayout } from "./_components/email-layout";
import { EmailButton } from "./_components/email-button";
import { tokens } from "./_tokens";

interface DigestItem {
  category: "SHARE" | "CONTACT_UPDATE" | "SYNC" | "REMINDER" | "SECURITY";
  summary: string;
  actionUrl?: string;
}

interface NotificationDigestTemplateProps {
  period: "daily" | "weekly";
  periodLabel: string; // e.g. "Today" or "This week (June 5–11)"
  items: DigestItem[];
  viewAllUrl: string;
}

const CATEGORY_LABELS: Record<DigestItem["category"], string> = {
  SHARE: "Contact shares",
  CONTACT_UPDATE: "Contact updates",
  SYNC: "Sync activity",
  REMINDER: "Upcoming dates",
  SECURITY: "Security",
};

export function NotificationDigestTemplate({
  period, periodLabel, items, viewAllUrl,
}: NotificationDigestTemplateProps) {
  const grouped = items.reduce<Record<string, DigestItem[]>>((acc, item) => {
    const key = CATEGORY_LABELS[item.category];
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <EmailLayout preview={`Your Kontax ${period} summary — ${periodLabel}`}>
      <Text style={{ color: tokens.ink, fontSize: "20px", fontWeight: "600", margin: "0 0 4px" }}>
        Your {period} summary
      </Text>
      <Text style={{ color: tokens.muted, fontSize: "13px", margin: "0 0 24px" }}>
        {periodLabel}
      </Text>

      {items.length === 0 ? (
        <Text style={{ color: tokens.secondary, fontSize: "14px" }}>
          Nothing to report this {period}. Keep up the good work!
        </Text>
      ) : (
        Object.entries(grouped).map(([category, categoryItems]) => (
          <Section key={category} style={{ marginBottom: "20px" }}>
            <Text style={{ color: tokens.ink, fontSize: "13px", fontWeight: "600",
              textTransform: "uppercase", letterSpacing: "0.06em", margin: "0 0 8px" }}>
              {category}
            </Text>
            {categoryItems.map((item, i) => (
              <Text key={i} style={{ color: tokens.secondary, fontSize: "14px",
                lineHeight: "20px", margin: "0 0 4px" }}>
                • {item.summary}
              </Text>
            ))}
          </Section>
        ))
      )}

      <Hr style={{ borderColor: tokens.hairline, margin: "24px 0" }} />
      <Section>
        <EmailButton href={viewAllUrl}>View in Kontax →</EmailButton>
      </Section>
    </EmailLayout>
  );
}

export default NotificationDigestTemplate;
```

---

## Acceptance Criteria

- `NotificationDigestTemplate` renders a grouped summary of notification items by category.
- An empty digest renders a "nothing to report" message.
- Security items are always included regardless of user notification preferences.
- The template is previewed correctly in the React Email dev server.

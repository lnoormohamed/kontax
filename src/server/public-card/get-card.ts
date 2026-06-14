import { db } from "~/server/db";
import { SITE_URL } from "~/lib/site-url";
import {
  type PublicCardData,
  type PublicCardFieldConfig,
  resolveCardFields,
} from "./types";

export async function getPublicCard(username: string): Promise<PublicCardData | null> {
  const user = await db.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      name: true,
      email: true,
      avatarUrl: true,
      publicCardFields: true,
    },
  });

  if (!user?.username) return null;

  const fields = resolveCardFields(user.publicCardFields as PublicCardFieldConfig | null);
  if (fields.hidden) return null;

  // Look up a self-contact heuristic: contact in the user's books matching their own email.
  // This gets job title, company, and structured phone/website data for free.
  const ownContact = await db.contact.findFirst({
    where: { userId: user.id, email: user.email, archivedAt: null },
    select: {
      fullName: true,
      jobTitle: true,
      company: true,
      phoneNumbers: true,
      websiteEntries: true,
      phoneEntries: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const displayName = user.name ?? username;

  // Extract structured phone numbers (stored as Json)
  const phones: string[] = [];
  if (fields.showPhone && ownContact) {
    const raw = (ownContact.phoneEntries ?? ownContact.phoneNumbers) as Array<{
      value?: string;
      number?: string;
    }> | null;
    if (Array.isArray(raw)) {
      for (const p of raw) {
        const v = p.value ?? p.number;
        if (v) phones.push(v);
      }
    }
  }

  // Extract websites
  const websites: string[] = [];
  if (fields.showWebsite && ownContact) {
    const raw = ownContact.websiteEntries as Array<{ value?: string; url?: string }> | null;
    if (Array.isArray(raw)) {
      for (const w of raw) {
        const v = w.value ?? w.url;
        if (v) websites.push(v);
      }
    }
  }

  return {
    userId: user.id,
    username: user.username,
    displayName,
    avatarUrl: user.avatarUrl ?? null,
    jobTitle: fields.showJobTitle ? (ownContact?.jobTitle ?? null) : null,
    company: fields.showCompany ? (ownContact?.company ?? null) : null,
    visibleFields: fields,
    emails: fields.showEmail ? [user.email] : [],
    phones,
    websites,
  };
}

export function buildPersonSchema(card: PublicCardData): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: card.displayName,
    ...(card.jobTitle ? { jobTitle: card.jobTitle } : {}),
    ...(card.company ? { worksFor: { "@type": "Organization", name: card.company } } : {}),
    ...(card.emails[0] ? { email: card.emails[0] } : {}),
    ...(card.phones[0] ? { telephone: card.phones[0] } : {}),
    ...(card.websites[0] ? { url: card.websites[0], sameAs: card.websites } : {}),
    url: `${SITE_URL}/u/${card.username}`,
  };
}

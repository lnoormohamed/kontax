import { ZipArchive } from "archiver";
import { PassThrough } from "stream";

import type { Contact, Subscription, User } from "../../../generated/prisma";
import { db } from "~/server/db";
import {
  contactsToCsv,
  contactsToVCard,
  parseContactPostalAddresses,
  parseContactStringArray,
} from "~/server/contact-portability";

const CONTACT_SELECT = {
  fullName: true,
  firstName: true,
  lastName: true,
  phoneticFirstName: true,
  phoneticLastName: true,
  nickname: true,
  email: true,
  emailAddresses: true,
  phone: true,
  phoneNumbers: true,
  company: true,
  phoneticCompany: true,
  jobTitle: true,
  website: true,
  birthday: true,
  address: true,
  postalAddresses: true,
  notes: true,
} as const;

type ContactRow = Pick<Contact, keyof typeof CONTACT_SELECT>;

function mapContact(c: ContactRow) {
  return {
    ...c,
    emailAddresses: parseContactStringArray(c.emailAddresses),
    phoneNumbers: parseContactStringArray(c.phoneNumbers),
    postalAddresses: parseContactPostalAddresses(c.postalAddresses),
  };
}

function billingSummary(
  sub: Pick<Subscription, "plan" | "status" | "currentPeriodEnd" | "cancelAtPeriodEnd"> | null,
  user: Pick<User, "email" | "name" | "createdAt">,
): string {
  const lines = [
    "Kontax Data Export — Billing Summary",
    "=====================================",
    `Account: ${user.email}`,
    `Name:    ${user.name ?? "(not set)"}`,
    `Member since: ${user.createdAt.toLocaleDateString("en-GB", { dateStyle: "long" })}`,
    "",
    sub
      ? [
          `Current plan: ${sub.plan}`,
          `Status: ${sub.status}`,
          sub.currentPeriodEnd
            ? `Current period ends: ${sub.currentPeriodEnd.toLocaleDateString("en-GB", { dateStyle: "long" })}`
            : null,
          sub.cancelAtPeriodEnd ? "Scheduled to cancel at period end: Yes" : null,
        ]
          .filter(Boolean)
          .join("\n")
      : "Plan: Free (no active subscription)",
    "",
    "For full invoice history, visit your billing portal in Settings → Plan & billing.",
    `Export generated: ${new Date().toISOString()}`,
  ];
  return lines.join("\n");
}

export async function generateDataExport(userId: string, includeArchived = false): Promise<Buffer> {
  const [contacts, activityEvents, subscription, user] = await Promise.all([
    db.contact.findMany({
      where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
      select: CONTACT_SELECT,
      orderBy: { fullName: "asc" },
    }),
    db.activityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    }),
    db.subscription.findFirst({
      where: { userId, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] } },
      orderBy: { createdAt: "desc" },
      select: { plan: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
    }),
    db.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true, name: true, createdAt: true, emailVerified: true, lifecycleState: true },
    }),
  ]);

  const mapped = contacts.map(mapContact);
  const vcfContent = contactsToVCard(mapped);
  const csvContent = contactsToCsv(mapped);

  const activityJson = JSON.stringify(
    activityEvents.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      actor: e.actor,
      createdAt: e.createdAt.toISOString(),
      payload: e.payload,
    })),
    null,
    2,
  );

  const accountJson = JSON.stringify(
    {
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      emailVerified: user.emailVerified?.toISOString() ?? null,
      plan: subscription?.plan ?? "FREE",
      lifecycleState: user.lifecycleState,
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );

  return new Promise((resolve, reject) => {
    const pass = new PassThrough();
    const chunks: Buffer[] = [];
    pass.on("data", (chunk: Buffer) => chunks.push(chunk));
    pass.on("end", () => resolve(Buffer.concat(chunks)));
    pass.on("error", reject);

    const archive = new ZipArchive({ zlib: { level: 6 } });
    archive.on("error", reject);
    archive.pipe(pass);

    archive.append(vcfContent, { name: "contacts.vcf" });
    archive.append(csvContent, { name: "contacts.csv" });
    archive.append(activityJson, { name: "activity.json" });
    archive.append(billingSummary(subscription, user), { name: "billing-summary.txt" });
    archive.append(accountJson, { name: "account.json" });

    void archive.finalize();
  });
}

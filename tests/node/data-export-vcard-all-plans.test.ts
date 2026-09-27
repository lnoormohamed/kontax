import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mock, test } from "node:test";

import AdmZip from "adm-zip";

/**
 * P49A-19 item 5 (owner decision 2026-09-27): data portability — the full
 * data export (Settings → Data & sync → Download your data) contains a vCard
 * file on every plan, Free included. The standalone vCard 4.0 export on the
 * Import & export page stays Pro (premiumExportEnabled).
 *
 * Drives the real generateDataExport against a Prisma stub for a Free user
 * (no subscription) and unzips the result. No network, no database.
 */

const stub = {
  contact: {
    findMany: async () => [
      {
        fullName: "Ada Lovelace",
        firstName: "Ada",
        lastName: "Lovelace",
        phoneticFirstName: null,
        phoneticLastName: null,
        nickname: null,
        email: "ada@example.invalid",
        emailAddresses: [],
        phone: null,
        phoneNumbers: [],
        company: "Analytical Engines",
        phoneticCompany: null,
        jobTitle: null,
        website: null,
        birthday: null,
        address: null,
        postalAddresses: [],
        notes: null,
        emailEntries: [{ label: "home", value: "ada@example.invalid", isPrimary: true }],
        phoneEntries: [],
        addressEntries: [],
        websiteEntries: [],
      },
    ],
  },
  activityEvent: { findMany: async () => [] },
  // Free: no active subscription at all.
  subscription: { findFirst: async () => null },
  user: {
    findUniqueOrThrow: async () => ({
      email: "free@example.invalid",
      name: "Free User",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      emailVerified: null,
      lifecycleState: "ACTIVE",
    }),
  },
};

mock.module("~/server/db", { namedExports: { db: stub } });

const { generateDataExport } = await import("../../src/server/data-export/generate-export");

test("a Free user's full data export contains contacts.vcf with their contacts", async () => {
  const zip = new AdmZip(await generateDataExport("free_user"));
  const names = zip.getEntries().map((e) => e.entryName);
  assert.ok(names.includes("contacts.vcf"), `entries: ${names.join(", ")}`);
  assert.ok(names.includes("contacts.csv"));

  const vcf = zip.getEntry("contacts.vcf")!.getData().toString("utf8");
  assert.match(vcf, /BEGIN:VCARD/);
  assert.match(vcf, /FN:Ada Lovelace/);
  assert.match(vcf, /ada@example\.invalid/);
  assert.match(zip.getEntry("account.json")!.getData().toString("utf8"), /"plan": "FREE"/);
});

test("no plan gate on the data export path (request action, cron, generator)", () => {
  for (const file of [
    "src/app/actions/data-export.ts",
    "src/app/api/cron/data-export/route.ts",
    "src/server/data-export/generate-export.ts",
  ]) {
    const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /premiumExportEnabled|assertCanUsePremiumExport/, file);
  }
});

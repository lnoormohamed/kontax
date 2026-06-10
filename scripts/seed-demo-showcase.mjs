// Feature-showcase demo data for Kontax.
//
// Unlike seed-random-contacts.mjs (bulk filler), this creates a small curated
// set of contacts that exercise the *features* of the detail page and list so
// you can eyeball them rendering correctly:
//   - a fully-populated flagship contact (every section filled, favourited)
//   - one contact per SourceType (MANUAL / IMPORT_CSV / SYNC_CARDDAV /
//     SHARED_STATIC / SHARED_LIVE) so SourceBadge variants are visible
//   - an archived contact
//   - a duplicate pair + an OPEN MergeSuggestion (so the Duplicates view lights up)
//   - a History tab populated with a realistic ActivityEvent timeline
//   - a Sharing tab populated with a vCard link, a static share, and a live share
//
// Everything created here is tagged with the label "demo-showcase" so it can be
// removed cleanly with --reset before re-seeding.
//
// Usage:
//   node scripts/seed-demo-showcase.mjs                 # first user in the DB
//   node scripts/seed-demo-showcase.mjs --user=me@x.com # specific user
//   node scripts/seed-demo-showcase.mjs --reset         # wipe showcase data first

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const SHOWCASE_LABEL = "demo-showcase";

const getArg = (name, fallback) => {
  const pref = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(pref));
  if (direct) {
    const value = direct.slice(pref.length);
    return value.length > 0 ? value : fallback;
  }
  return fallback;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const daysAgo = (n) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const hoursAgo = (n) => new Date(Date.now() - n * 60 * 60 * 1000);

const main = async () => {
  const userEmail = getArg("user", undefined) ?? process.env.SEED_USER_EMAIL;
  const user = userEmail
    ? await db.user.findUnique({ where: { email: userEmail.toLowerCase() } })
    : await db.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    console.error("No user found. Pass --user=email or create a user first.");
    process.exitCode = 1;
    return;
  }

  // --- optional reset of prior showcase data -------------------------------
  if (hasFlag("reset")) {
    const prior = await db.contact.findMany({
      where: { userId: user.id, labels: { array_contains: [SHOWCASE_LABEL] } },
      select: { id: true },
    });
    const ids = prior.map((c) => c.id);
    if (ids.length > 0) {
      await db.contactShare.deleteMany({
        where: { ownerUserId: user.id, contactId: { in: ids } },
      });
      await db.mergeSuggestion.deleteMany({
        where: {
          userId: user.id,
          OR: [{ leftContactId: { in: ids } }, { rightContactId: { in: ids } }],
        },
      });
      await db.activityEvent.deleteMany({
        where: { userId: user.id, contactId: { in: ids } },
      });
      await db.contact.deleteMany({ where: { id: { in: ids } } });
    }
    console.log(`Reset: removed ${ids.length} prior showcase contact(s).`);
  }

  const base = (overrides) => ({
    userId: user.id,
    labels: [SHOWCASE_LABEL],
    sourceType: "MANUAL",
    lastMutatedBy: "MANUAL",
    ...overrides,
  });

  // --- 1. Flagship: every section filled, favourited -----------------------
  const flagship = await db.contact.create({
    data: base({
      fullName: "Amara Okafor",
      namePrefix: "Dr",
      firstName: "Amara",
      middleName: "Chidinma",
      lastName: "Okafor",
      nameSuffix: "PhD",
      nickname: "Mara",
      phoneticFirstName: "uh-MAR-uh",
      phoneticLastName: "oh-KAH-for",
      email: "amara@okafor.health",
      emailEntries: [
        { label: "Work", value: "amara@okafor.health" },
        { label: "Personal", value: "mara.okafor@gmail.com" },
      ],
      phone: "+2348031234567",
      phoneEntries: [
        { label: "Mobile", value: "+2348031234567" },
        { label: "Work", value: "+2349087654321" },
      ],
      company: "Orbit Health",
      phoneticCompany: "OR-bit",
      jobTitle: "Chief Medical Officer",
      department: "Clinical Leadership",
      website: "https://orbit.health/team/amara",
      websiteEntries: [
        { label: "Company", value: "https://orbit.health/team/amara" },
        { label: "Portfolio", value: "amaraokafor.md" },
      ],
      birthday: "1984-03-22",
      address: "14 Adetokunbo Ademola Cres, Lagos, Lagos NG",
      addressEntries: [
        {
          label: "Home",
          street: "14 Adetokunbo Ademola Cres",
          city: "Lagos",
          state: "Lagos",
          postcode: "101233",
          country: "Nigeria",
          formatted: "14 Adetokunbo Ademola Cres, Lagos, Lagos, 101233, Nigeria",
        },
        {
          label: "Work",
          street: "Orbit Health, 2 Ozumba Mbadiwe Ave",
          city: "Victoria Island",
          state: "Lagos",
          postcode: "106104",
          country: "Nigeria",
          formatted: "Orbit Health, 2 Ozumba Mbadiwe Ave, Victoria Island, Lagos, 106104, Nigeria",
        },
      ],
      significantDates: [
        { label: "Anniversary", value: "2019-09-01" },
        { label: "Other", value: "2008-06-15" },
      ],
      relatedPeople: [
        { label: "Assistant", value: "Tunde Bello" },
        { label: "Partner", value: "Chidi Okafor" },
      ],
      customFields: [{ label: "department", value: "Clinical Leadership" }],
      isFavorite: true,
      notes: "Met at the Lagos HealthTech summit. Prefers WhatsApp. Reviewing Q3 partnership.",
      sourceDetail: "Created in Kontax",
    }),
  });

  // History timeline for the flagship contact
  await db.activityEvent.createMany({
    data: [
      {
        userId: user.id,
        contactId: flagship.id,
        eventType: "CONTACT_CREATED",
        actor: "USER",
        payload: {},
        createdAt: daysAgo(21),
      },
      {
        userId: user.id,
        contactId: flagship.id,
        eventType: "CONTACT_UPDATED",
        actor: "USER",
        payload: {
          diffs: [
            { field: "jobTitle", before: "Medical Director", after: "Chief Medical Officer" },
            { field: "company", before: "Helio Clinics", after: "Orbit Health" },
          ],
        },
        createdAt: daysAgo(14),
      },
      {
        userId: user.id,
        contactId: flagship.id,
        eventType: "CONTACT_UPDATED",
        actor: "USER",
        payload: { diffs: [{ field: "phone", before: null, after: "+2349087654321" }] },
        createdAt: daysAgo(9),
      },
      {
        userId: user.id,
        contactId: flagship.id,
        eventType: "CONTACT_SHARED",
        actor: "USER",
        payload: { shareType: "VCARD_LINK" },
        createdAt: daysAgo(6),
      },
      {
        userId: user.id,
        contactId: flagship.id,
        eventType: "SYNC_PUSHED",
        actor: "SYNC",
        actorDetail: "iCloud · Personal",
        payload: { fields: ["phone", "jobTitle"] },
        createdAt: hoursAgo(20),
      },
      {
        userId: user.id,
        contactId: flagship.id,
        eventType: "CONTACT_UPDATED",
        actor: "USER",
        payload: { diffs: [{ field: "notes", before: "Met at summit.", after: "Met at the Lagos HealthTech summit. Prefers WhatsApp. Reviewing Q3 partnership." }] },
        createdAt: hoursAgo(3),
      },
    ],
  });

  // Sharing tab for the flagship contact
  await db.contactShare.createMany({
    data: [
      {
        ownerUserId: user.id,
        contactId: flagship.id,
        shareType: "VCARD_LINK",
        token: `demo-vcard-${flagship.id.slice(-8)}`,
        status: "ACTIVE",
        downloadCount: 7,
        expiresAt: daysAgo(-30), // expires in 30 days
        createdAt: daysAgo(6),
      },
      {
        ownerUserId: user.id,
        contactId: flagship.id,
        shareType: "STATIC_COPY",
        status: "ACTIVE",
        recipientEmail: "ngozi@family.example",
        snapshot: { fullName: "Amara Okafor", email: "amara@okafor.health" },
        createdAt: daysAgo(4),
      },
      {
        ownerUserId: user.id,
        contactId: flagship.id,
        shareType: "LIVE_SYNC",
        status: "ACTIVE",
        recipientEmail: "tunde@orbit.health",
        lastPushedAt: hoursAgo(20),
        createdAt: daysAgo(3),
      },
    ],
  });

  // --- 2. One contact per source type (SourceBadge variants) ---------------
  const sourceShowcase = [
    {
      fullName: "Marcus Reed",
      jobTitle: "Account Manager",
      company: "Summit Commerce",
      email: "marcus.reed@summit.example",
      phone: "+14155550142",
      birthday: "1990-07-11",
      sourceType: "IMPORT_CSV",
      sourceDetail: "Google Contacts.csv",
      lastMutatedBy: "IMPORT_CSV",
    },
    {
      fullName: "Sofia Ferrari",
      jobTitle: "Designer",
      company: "Cove Creative",
      email: "sofia@cove.example",
      phone: "+390612345678",
      birthday: "1988-12-02",
      sourceType: "SYNC_CARDDAV",
      sourceDetail: "iCloud · Personal",
      lastMutatedBy: "SYNC_CARDDAV",
    },
    {
      fullName: "Daniel Kim",
      jobTitle: "Founder",
      company: "Nimbus Labs",
      email: "daniel@nimbus.example",
      phone: "+8210987654321",
      sourceType: "SHARED_STATIC",
      sourceDetail: "Shared by ngozi@family.example",
      lastMutatedBy: "SHARED_STATIC",
    },
    {
      fullName: "Priya Nair",
      jobTitle: "Partner",
      company: "Citrine Analytics",
      email: "priya@citrine.example",
      phone: "+919812345678",
      sourceType: "SHARED_LIVE",
      sourceDetail: "Live from tunde@orbit.health",
      lastMutatedBy: "SHARED_LIVE",
    },
  ];
  for (const c of sourceShowcase) {
    await db.contact.create({ data: base(c) });
  }

  // --- 3. Archived contact -------------------------------------------------
  await db.contact.create({
    data: base({
      fullName: "Old Vendor Contact",
      company: "Granite Group",
      email: "billing@granite.example",
      phone: "+14155550199",
      notes: "Contract ended 2025. Kept for records.",
      archivedAt: daysAgo(40),
    }),
  });

  // --- 4. Duplicate pair + OPEN merge suggestion ---------------------------
  const dupA = await db.contact.create({
    data: base({
      fullName: "Jonathan Walker",
      firstName: "Jonathan",
      lastName: "Walker",
      email: "jon.walker@example.com",
      phone: "+14155550111",
      company: "Pioneer Systems",
      jobTitle: "Engineer",
    }),
  });
  const dupB = await db.contact.create({
    data: base({
      fullName: "Jon Walker",
      firstName: "Jon",
      lastName: "Walker",
      email: "jon.walker@example.com",
      phone: "+1 415 555 0111",
      company: "Pioneer Systems",
    }),
  });
  const pairKey = [dupA.id, dupB.id].sort().join(":");
  await db.mergeSuggestion.upsert({
    where: { userId_pairKey: { userId: user.id, pairKey } },
    update: { status: "OPEN" },
    create: {
      userId: user.id,
      leftContactId: dupA.id,
      rightContactId: dupB.id,
      pairKey,
      status: "OPEN",
      confidence: "HIGH",
      score: 95,
      hardMatch: true,
      signals: { email: "exact", phone: "normalized-match", name: "fuzzy" },
      reasons: ["Same email address", "Matching phone number", "Similar name"],
      source: "demo-showcase",
    },
  });

  const total = await db.contact.count({
    where: { userId: user.id, labels: { array_contains: [SHOWCASE_LABEL] } },
  });
  console.log(`Showcase ready for ${user.email}:`);
  console.log(`  • Flagship contact (all sections + History + Sharing): ${flagship.fullName}`);
  console.log(`  • SourceBadge variants: ${sourceShowcase.map((c) => c.fullName).join(", ")}`);
  console.log(`  • 1 archived contact, 1 duplicate pair (OPEN merge suggestion)`);
  console.log(`  • ${total} total contacts tagged "${SHOWCASE_LABEL}"`);
  console.log(`\nOpen the flagship contact to see Details / History / Sharing populated.`);
};

try {
  await main();
} catch (error) {
  console.error("Failed to seed showcase data", error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}

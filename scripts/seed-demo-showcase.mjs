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

import bcrypt from "bcryptjs";

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const SHOWCASE_LABEL = "demo-showcase";
const DEMO_PASSWORD = "demo1234";

// Recipient accounts so the Sharing tab shows real recipients (accepted /
// pending / live) and the owner gets an incoming "Shared with me" item.
const DEMO_ACCOUNTS = [
  { email: "ngozi@family.example", name: "Ngozi Eze" },
  { email: "tunde@orbit.health", name: "Tunde Bello" },
  { email: "chidi@okafor.health", name: "Chidi Okafor" },
];

// Shared books (Family/Team) so the Sharing tab's "Add to a shared book"
// section shows configured books instead of the empty state.
const DEMO_BOOKS = [
  { name: "Okafor Family", type: "FAMILY", memberEmails: ["ngozi@family.example", "chidi@okafor.health"] },
  { name: "Orbit Health Team", type: "TEAM", memberEmails: ["tunde@orbit.health"] },
];

const upsertDemoUser = async ({ email, name }) => {
  const password = await bcrypt.hash(DEMO_PASSWORD, 12);
  return db.user.upsert({
    where: { email },
    update: { name },
    create: { email, name, password },
  });
};

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
    // Demo recipient accounts: deleting them cascades their contacts, owned
    // shares (incl. the incoming "Shared with me" item) and nulls received-share
    // links — a clean slate for re-seeding.
    const removedUsers = await db.user.deleteMany({
      where: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } },
    });
    // Shared books owned by this user (cascades members + address books).
    const removedBooks = await db.group.deleteMany({
      where: { ownerId: user.id, name: { in: DEMO_BOOKS.map((b) => b.name) } },
    });
    console.log(
      `Reset: removed ${ids.length} prior showcase contact(s), ${removedUsers.count} demo account(s), ${removedBooks.count} book(s).`,
    );
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
      isEmergency: true,
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

  // Sync card for the flagship contact — a linked CardDAV account + per-contact
  // link carrying a remote ETag/UID so the Sync section shows real values.
  const syncAccount = await db.syncAccount.upsert({
    where: {
      userId_baseUrl_label: {
        userId: user.id,
        baseUrl: "https://contacts.icloud.com",
        label: "iCloud · Personal",
      },
    },
    update: { status: "ACTIVE", lastSyncedAt: hoursAgo(0.1) },
    create: {
      userId: user.id,
      provider: "CARDDAV",
      status: "ACTIVE",
      label: "iCloud · Personal",
      baseUrl: "https://contacts.icloud.com",
      addressBookDisplayName: "Personal",
      lastSyncedAt: hoursAgo(0.1),
      lastSucceededAt: hoursAgo(0.1),
    },
  });
  await db.syncContactLink.upsert({
    where: {
      syncAccountId_contactId: { syncAccountId: syncAccount.id, contactId: flagship.id },
    },
    update: {},
    create: {
      syncAccountId: syncAccount.id,
      contactId: flagship.id,
      remoteHref: `/Personal/${flagship.id}.vcf`,
      remoteUid: flagship.id,
      remoteETag: '"a1b2c3d4e5f6g7h8i9j0"',
      lastSyncedAt: hoursAgo(0.1),
    },
  });

  // --- Recipient accounts + linked shares ----------------------------------
  const ownerName = user.name?.trim() || user.email;
  const [ngozi, tunde, chidi] = await Promise.all(DEMO_ACCOUNTS.map(upsertDemoUser));
  const byEmail = { [ngozi.email]: ngozi, [tunde.email]: tunde, [chidi.email]: chidi };

  // Shared books (Family/Team) owned by the user, with the owner + a couple of
  // members each — so the Sharing tab shows configured books.
  for (const book of DEMO_BOOKS) {
    const now = new Date();
    const group = await db.group.create({
      data: {
        ownerId: user.id,
        type: book.type,
        name: book.name,
        maxMembers: book.type === "FAMILY" ? 6 : 25,
        members: {
          create: [
            {
              userId: user.id,
              role: "OWNER",
              inviteStatus: "ACCEPTED",
              canEdit: true,
              joinedAt: now,
            },
            ...book.memberEmails
              .map((em) => byEmail[em])
              .filter(Boolean)
              .map((u) => ({
                userId: u.id,
                invitedEmail: u.email,
                role: "MEMBER",
                inviteStatus: "ACCEPTED",
                canEdit: true,
                joinedAt: now,
                invitedByUserId: user.id,
              })),
          ],
        },
        addressBooks: { create: [{ name: book.name, isDefault: true }] },
      },
      include: { addressBooks: true },
    });
    await db.group.update({
      where: { id: group.id },
      data: { defaultAddressBookId: group.addressBooks[0]?.id },
    });
  }

  // A few contacts living in the family shared book (owned by the owner,
  // linked via GroupContact) so the Family badge + Private/Family/All filter
  // have data to show.
  const familyGroup = await db.group.findFirst({
    where: { ownerId: user.id, type: "FAMILY" },
    select: { defaultAddressBookId: true },
  });
  if (familyGroup?.defaultAddressBookId) {
    const sharedFamilyContacts = [
      { fullName: "Grandma Ngozi", firstName: "Ngozi", lastName: "Okafor", phone: "+2348090000001", email: "grandma@okafor.example" },
      { fullName: "Uncle Emeka", firstName: "Emeka", lastName: "Okafor", phone: "+2348090000002", email: "emeka@okafor.example", company: "Okafor & Sons" },
      { fullName: "Dr Adeyemi (family GP)", firstName: "Bisi", lastName: "Adeyemi", phone: "+2348090000003", email: "clinic@adeyemi.example", jobTitle: "General Practitioner" },
    ];
    for (const c of sharedFamilyContacts) {
      const created = await db.contact.create({
        data: {
          userId: user.id,
          labels: [SHOWCASE_LABEL],
          ...c,
          sourceType: "MANUAL",
          sourceDetail: "Okafor Family (family book)",
          lastMutatedBy: "MANUAL",
        },
      });
      await db.groupContact.create({
        data: {
          groupAddressBookId: familyGroup.defaultAddressBookId,
          contactId: created.id,
          addedByUserId: user.id,
        },
      });
    }
  }

  // A few contacts in a team book (Orbit Health Team) so team surfacing shows.
  const teamGroup = await db.group.findFirst({
    where: { ownerId: user.id, type: "TEAM" },
    include: { addressBooks: { take: 1, orderBy: { createdAt: "asc" } } },
  });
  const teamBookId = teamGroup?.addressBooks[0]?.id;
  if (teamBookId) {
    const teamContacts = [
      { fullName: "Acme Corp (Client)", company: "Acme Corp", email: "hello@acme.example", phone: "+14155551000", jobTitle: "Account" },
      { fullName: "Beacon Health (Partner)", company: "Beacon Health", email: "partners@beacon.example", phone: "+14155552000" },
      { fullName: "Caldwell Supplies", company: "Caldwell", email: "orders@caldwell.example", phone: "+14155553000" },
    ];
    for (const c of teamContacts) {
      const created = await db.contact.create({
        data: {
          userId: user.id,
          labels: [SHOWCASE_LABEL],
          ...c,
          sourceType: "MANUAL",
          sourceDetail: `${teamGroup.name} · ${teamGroup.addressBooks[0].name}`,
          lastMutatedBy: "MANUAL",
        },
      });
      await db.groupContact.create({
        data: { groupAddressBookId: teamBookId, contactId: created.id, addedByUserId: user.id },
      });
    }
  }

  const amaraSnapshot = {
    ownerName,
    fullName: "Amara Okafor",
    firstName: "Amara",
    lastName: "Okafor",
    email: "amara@okafor.health",
    phone: "+2348031234567",
    company: "Orbit Health",
    jobTitle: "Chief Medical Officer",
  };

  // Accepted static copy: Ngozi has her own independent copy of Amara.
  const ngoziCopy = await db.contact.create({
    data: {
      userId: ngozi.id,
      fullName: "Amara Okafor",
      firstName: "Amara",
      lastName: "Okafor",
      email: "amara@okafor.health",
      phone: "+2348031234567",
      company: "Orbit Health",
      jobTitle: "Chief Medical Officer",
      sourceType: "SHARED_STATIC",
      sourceDetail: ownerName,
      lastMutatedBy: "SHARED_STATIC",
      lastMutatedByDetail: ownerName,
    },
  });

  // Accepted live copy: Tunde has a linked, read-only mirror of Amara.
  const tundeCopy = await db.contact.create({
    data: {
      userId: tunde.id,
      fullName: "Amara Okafor",
      firstName: "Amara",
      lastName: "Okafor",
      email: "amara@okafor.health",
      phone: "+2348031234567",
      company: "Orbit Health",
      jobTitle: "Chief Medical Officer",
      sourceType: "SHARED_LIVE",
      sourceDetail: ownerName,
      lastMutatedBy: "SHARED_LIVE",
      lastMutatedByDetail: ownerName,
    },
  });

  // Sharing tab for the flagship contact — every recipient state represented.
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
        // accepted static copy → Ngozi
        ownerUserId: user.id,
        contactId: flagship.id,
        shareType: "STATIC_COPY",
        status: "ACTIVE",
        recipientUserId: ngozi.id,
        recipientEmail: ngozi.email,
        recipientContactId: ngoziCopy.id,
        snapshot: amaraSnapshot,
        createdAt: daysAgo(4),
      },
      {
        // pending static copy → Chidi (not accepted yet)
        ownerUserId: user.id,
        contactId: flagship.id,
        shareType: "STATIC_COPY",
        status: "ACTIVE",
        recipientUserId: chidi.id,
        recipientEmail: chidi.email,
        snapshot: amaraSnapshot,
        createdAt: daysAgo(1),
      },
      {
        // live, accepted → Tunde (last synced recently)
        ownerUserId: user.id,
        contactId: flagship.id,
        shareType: "LIVE_SYNC",
        status: "ACTIVE",
        recipientUserId: tunde.id,
        recipientEmail: tunde.email,
        recipientContactId: tundeCopy.id,
        lastPushedAt: hoursAgo(20),
        createdAt: daysAgo(3),
      },
    ],
  });

  // Incoming "Shared with me" for the owner: Ngozi shares a contact back.
  const ngoziOwned = await db.contact.create({
    data: {
      userId: ngozi.id,
      fullName: "Bola Adeyemi",
      firstName: "Bola",
      lastName: "Adeyemi",
      email: "bola@adeyemi.example",
      phone: "+2348022002200",
      company: "Lagdev Partners",
      jobTitle: "Programme Director",
      sourceType: "MANUAL",
      lastMutatedBy: "MANUAL",
    },
  });
  await db.contactShare.create({
    data: {
      ownerUserId: ngozi.id,
      contactId: ngoziOwned.id,
      shareType: "STATIC_COPY",
      status: "ACTIVE",
      recipientUserId: user.id,
      recipientEmail: user.email,
      snapshot: {
        ownerName: ngozi.name,
        fullName: "Bola Adeyemi",
        email: "bola@adeyemi.example",
        phone: "+2348022002200",
        company: "Lagdev Partners",
        jobTitle: "Programme Director",
      },
      createdAt: hoursAgo(5),
    },
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
  console.log(`\nSharing recipients (Amara Okafor → Sharing tab):`);
  console.log(`  • ${ngozi.email} — static copy ACCEPTED`);
  console.log(`  • ${chidi.email} — static copy PENDING`);
  console.log(`  • ${tunde.email} — live share, last synced 20h ago`);
  console.log(`  • Incoming "Shared with me" for ${user.email}: Bola Adeyemi from ${ngozi.name}`);
  console.log(`\nShared books (Sharing tab → "Add to a shared book"):`);
  for (const b of DEMO_BOOKS) console.log(`  • ${b.name} (${b.type}) — ${b.memberEmails.length + 1} members`);
  console.log(`\nDemo accounts (sign in to see the recipient side) — password: ${DEMO_PASSWORD}`);
  for (const a of DEMO_ACCOUNTS) console.log(`  • ${a.email}`);
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

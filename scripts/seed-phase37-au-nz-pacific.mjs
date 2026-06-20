import { createId } from "@paralleldrive/cuid2";
import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const SEED_LABEL = "phase37-au-nz-pacific";

const getArg = (name, fallback = undefined) => {
  const prefix = `--${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const TARGET_EMAIL = getArg("user", process.env.SEED_USER_EMAIL ?? "li@linoormohamed.com");

const buildPairKey = (leftContactId, rightContactId) => [leftContactId, rightContactId].sort().join(":");

const baseContactData = (userId, raw, offset) => ({
  id: createId(),
  userId,
  fullName: raw.fullName,
  firstName: raw.firstName ?? null,
  lastName: raw.lastName ?? null,
  email: raw.email ?? null,
  phone: raw.phone ?? null,
  company: raw.company ?? null,
  jobTitle: raw.jobTitle ?? null,
  notes: raw.notes ?? null,
  labels: [SEED_LABEL, "phase37-phone", `country-${raw.country.toLowerCase()}`],
  sourceType: "MANUAL",
  lastMutatedBy: "MANUAL",
  archivedAt: null,
  createdAt: new Date(Date.now() + offset * 1000),
});

const pairs = [
  {
    country: "AU",
    confidence: "HIGH",
    score: 245,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "normalized-phone", label: "Same phone in local and +61 format", score: 95 },
      { signal: "name-and-company", label: "Same name and company", score: 70 },
    ],
    left: {
      country: "AU",
      fullName: "Noah Carter",
      firstName: "Noah",
      lastName: "Carter",
      phone: "0410 000 083",
      company: "Harbour Freight AU",
      notes: "Local Australian mobile format.",
    },
    right: {
      country: "AU",
      fullName: "Noah Carter",
      firstName: "Noah",
      lastName: "Carter",
      email: "noah.carter.au@kontax-seed.test",
      phone: "+61 410 000 083",
      company: "Harbour Freight AU",
      jobTitle: "Operations Lead",
      notes: "International Australian mobile format.",
    },
  },
  {
    country: "AU",
    confidence: "HIGH",
    score: 235,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "normalized-phone", label: "Same phone in local and +61 format", score: 95 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "AU",
      fullName: "Ava Bennett",
      firstName: "Ava",
      lastName: "Bennett",
      phone: "02 9000 1234",
      company: "Granite Legal AU",
      notes: "Local Australian landline format.",
    },
    right: {
      country: "AU",
      fullName: "Ava Bennett",
      firstName: "Ava",
      lastName: "Bennett",
      email: "ava.bennett.au@kontax-seed.test",
      phone: "+61 2 9000 1234",
      company: "Granite Legal AU",
      jobTitle: "Office Manager",
      notes: "International Australian landline format.",
    },
  },
  {
    country: "NZ",
    confidence: "HIGH",
    score: 245,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "normalized-phone", label: "Same phone in local and +64 format", score: 95 },
      { signal: "name-and-company", label: "Same name and company", score: 70 },
    ],
    left: {
      country: "NZ",
      fullName: "Mia Walker",
      firstName: "Mia",
      lastName: "Walker",
      phone: "021 123 4567",
      company: "Bluefern NZ",
      notes: "Local New Zealand mobile format.",
    },
    right: {
      country: "NZ",
      fullName: "Mia Walker",
      firstName: "Mia",
      lastName: "Walker",
      email: "mia.walker.nz@kontax-seed.test",
      phone: "+64 21 123 4567",
      company: "Bluefern NZ",
      jobTitle: "Success Manager",
      notes: "International New Zealand mobile format.",
    },
  },
  {
    country: "NZ",
    confidence: "HIGH",
    score: 235,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "normalized-phone", label: "Same phone in local and +64 format", score: 95 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "NZ",
      fullName: "Noah Patel",
      firstName: "Noah",
      lastName: "Patel",
      phone: "09 700 1234",
      company: "North Shore Logistics",
      notes: "Local New Zealand landline format.",
    },
    right: {
      country: "NZ",
      fullName: "Noah Patel",
      firstName: "Noah",
      lastName: "Patel",
      email: "noah.patel.nz@kontax-seed.test",
      phone: "+64 9 700 1234",
      company: "North Shore Logistics",
      jobTitle: "Ops Lead",
      notes: "International New Zealand landline format.",
    },
  },
  {
    country: "FJ",
    confidence: "HIGH",
    score: 230,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Fiji mobile in different spacing", score: 90 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "FJ",
      fullName: "Laisa Waqa",
      firstName: "Laisa",
      lastName: "Waqa",
      phone: "+6797012345",
      company: "Coral Pacific",
    },
    right: {
      country: "FJ",
      fullName: "Laisa Waqa",
      firstName: "Laisa",
      lastName: "Waqa",
      email: "laisa.waqa.fj@kontax-seed.test",
      phone: "+679 701 2345",
      company: "Coral Pacific",
      jobTitle: "Regional Buyer",
    },
  },
  {
    country: "PG",
    confidence: "HIGH",
    score: 230,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same PNG mobile in different spacing", score: 90 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "PG",
      fullName: "Mika Dika",
      firstName: "Mika",
      lastName: "Dika",
      phone: "+67571234567",
      company: "Kokoda Supply",
    },
    right: {
      country: "PG",
      fullName: "Mika Dika",
      firstName: "Mika",
      lastName: "Dika",
      email: "mika.dika.pg@kontax-seed.test",
      phone: "+675 7123 4567",
      company: "Kokoda Supply",
      jobTitle: "Account Manager",
    },
  },
  {
    country: "SB",
    confidence: "HIGH",
    score: 228,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Solomon Islands mobile in different spacing", score: 88 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "SB",
      fullName: "Tari Fono",
      firstName: "Tari",
      lastName: "Fono",
      phone: "+6777421234",
      company: "Honiara Marine",
    },
    right: {
      country: "SB",
      fullName: "Tari Fono",
      firstName: "Tari",
      lastName: "Fono",
      email: "tari.fono.sb@kontax-seed.test",
      phone: "+677 742 1234",
      company: "Honiara Marine",
      jobTitle: "Procurement Lead",
    },
  },
  {
    country: "VU",
    confidence: "HIGH",
    score: 228,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Vanuatu mobile in different spacing", score: 88 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "VU",
      fullName: "Jules Tari",
      firstName: "Jules",
      lastName: "Tari",
      phone: "+6785912345",
      company: "Port Vila Retail",
    },
    right: {
      country: "VU",
      fullName: "Jules Tari",
      firstName: "Jules",
      lastName: "Tari",
      email: "jules.tari.vu@kontax-seed.test",
      phone: "+678 591 2345",
      company: "Port Vila Retail",
      jobTitle: "Store Manager",
    },
  },
  {
    country: "WS",
    confidence: "HIGH",
    score: 228,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Samoa mobile in different spacing", score: 88 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "WS",
      fullName: "Mika Tafa",
      firstName: "Mika",
      lastName: "Tafa",
      phone: "+6857212345",
      company: "Upolu Holdings",
    },
    right: {
      country: "WS",
      fullName: "Mika Tafa",
      firstName: "Mika",
      lastName: "Tafa",
      email: "mika.tafa.ws@kontax-seed.test",
      phone: "+685 721 2345",
      company: "Upolu Holdings",
      jobTitle: "Finance Lead",
    },
  },
  {
    country: "TO",
    confidence: "HIGH",
    score: 228,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Tonga mobile in different spacing", score: 88 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "TO",
      fullName: "Sione Mahe",
      firstName: "Sione",
      lastName: "Mahe",
      phone: "+6767712345",
      company: "Nuku Logistics",
    },
    right: {
      country: "TO",
      fullName: "Sione Mahe",
      firstName: "Sione",
      lastName: "Mahe",
      email: "sione.mahe.to@kontax-seed.test",
      phone: "+676 771 2345",
      company: "Nuku Logistics",
      jobTitle: "Branch Manager",
    },
  },
  {
    country: "KI",
    confidence: "HIGH",
    score: 226,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Kiribati mobile in different spacing", score: 86 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "KI",
      fullName: "Teina Bakoa",
      firstName: "Teina",
      lastName: "Bakoa",
      phone: "+6867301234",
      company: "Tarawa Export",
    },
    right: {
      country: "KI",
      fullName: "Teina Bakoa",
      firstName: "Teina",
      lastName: "Bakoa",
      email: "teina.bakoa.ki@kontax-seed.test",
      phone: "+686 730 1234",
      company: "Tarawa Export",
      jobTitle: "Sales Manager",
    },
  },
  {
    country: "TV",
    confidence: "HIGH",
    score: 226,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Tuvalu mobile in different spacing", score: 86 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "TV",
      fullName: "Filo Pene",
      firstName: "Filo",
      lastName: "Pene",
      phone: "+688901234",
      company: "Funafuti Works",
    },
    right: {
      country: "TV",
      fullName: "Filo Pene",
      firstName: "Filo",
      lastName: "Pene",
      email: "filo.pene.tv@kontax-seed.test",
      phone: "+688 901234",
      company: "Funafuti Works",
      jobTitle: "Operations Manager",
    },
  },
  {
    country: "NR",
    confidence: "HIGH",
    score: 226,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Nauru mobile in different spacing", score: 86 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "NR",
      fullName: "Ane Detudamo",
      firstName: "Ane",
      lastName: "Detudamo",
      phone: "+6745551234",
      company: "Anibare Services",
    },
    right: {
      country: "NR",
      fullName: "Ane Detudamo",
      firstName: "Ane",
      lastName: "Detudamo",
      email: "ane.detudamo.nr@kontax-seed.test",
      phone: "+674 555 1234",
      company: "Anibare Services",
      jobTitle: "Customer Lead",
    },
  },
  {
    country: "PW",
    confidence: "HIGH",
    score: 226,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same Palau mobile in different spacing", score: 86 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "PW",
      fullName: "Taro Udui",
      firstName: "Taro",
      lastName: "Udui",
      phone: "+6807701234",
      company: "Koror Wholesale",
    },
    right: {
      country: "PW",
      fullName: "Taro Udui",
      firstName: "Taro",
      lastName: "Udui",
      email: "taro.udui.pw@kontax-seed.test",
      phone: "+680 770 1234",
      company: "Koror Wholesale",
      jobTitle: "Sales Lead",
    },
  },
  {
    country: "NC",
    confidence: "HIGH",
    score: 226,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same New Caledonia mobile in different spacing", score: 86 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "NC",
      fullName: "Nina Kowi",
      firstName: "Nina",
      lastName: "Kowi",
      phone: "+687751234",
      company: "Noumea Retail",
    },
    right: {
      country: "NC",
      fullName: "Nina Kowi",
      firstName: "Nina",
      lastName: "Kowi",
      email: "nina.kowi.nc@kontax-seed.test",
      phone: "+687 75 1234",
      company: "Noumea Retail",
      jobTitle: "Store Lead",
    },
  },
  {
    country: "PF",
    confidence: "HIGH",
    score: 226,
    hardMatch: true,
    contributions: [
      { signal: "exact-name", label: "Same full name", score: 80 },
      { signal: "exact-phone", label: "Same French Polynesia mobile in different spacing", score: 86 },
      { signal: "name-and-company", label: "Same name and company", score: 60 },
    ],
    left: {
      country: "PF",
      fullName: "Moana Teri",
      firstName: "Moana",
      lastName: "Teri",
      phone: "+68987123456",
      company: "Papeete Services",
    },
    right: {
      country: "PF",
      fullName: "Moana Teri",
      firstName: "Moana",
      lastName: "Teri",
      email: "moana.teri.pf@kontax-seed.test",
      phone: "+689 87 12 34 56",
      company: "Papeete Services",
      jobTitle: "Client Success Lead",
    },
  },
];

const main = async () => {
  const user = await db.user.findUnique({
    where: { email: TARGET_EMAIL.toLowerCase() },
    select: { id: true, email: true },
  });

  if (!user) {
    console.error(`User not found: ${TARGET_EMAIL}`);
    process.exitCode = 1;
    return;
  }

  if (hasFlag("reset")) {
    const priorContacts = await db.contact.findMany({
      where: { userId: user.id, labels: { array_contains: [SEED_LABEL] } },
      select: { id: true },
    });
    const priorIds = priorContacts.map((contact) => contact.id);

    await db.mergeSuggestion.deleteMany({
      where: priorIds.length > 0
        ? {
            userId: user.id,
            OR: [{ leftContactId: { in: priorIds } }, { rightContactId: { in: priorIds } }],
          }
        : { userId: user.id, source: "phase37-au-nz-pacific-seed" },
    });

    if (priorIds.length > 0) {
      await db.contact.deleteMany({ where: { id: { in: priorIds } } });
    }
  }

  const createdSuggestions = [];
  let offset = 0;

  for (const pair of pairs) {
    const left = await db.contact.create({
      data: baseContactData(user.id, pair.left, offset++),
      select: { id: true },
    });
    const right = await db.contact.create({
      data: baseContactData(user.id, pair.right, offset++),
      select: { id: true },
    });
    createdSuggestions.push({ pair, leftId: left.id, rightId: right.id });
  }

  for (const row of createdSuggestions) {
    await db.mergeSuggestion.upsert({
      where: {
        userId_pairKey: {
          userId: user.id,
          pairKey: buildPairKey(row.leftId, row.rightId),
        },
      },
      update: {
        status: "OPEN",
        confidence: row.pair.confidence,
        score: row.pair.score,
        hardMatch: row.pair.hardMatch,
        signals: row.pair.contributions,
        reasons: row.pair.contributions.map((entry) => entry.label),
        source: "phase37-au-nz-pacific-seed",
      },
      create: {
        userId: user.id,
        leftContactId: row.leftId,
        rightContactId: row.rightId,
        pairKey: buildPairKey(row.leftId, row.rightId),
        status: "OPEN",
        confidence: row.pair.confidence,
        score: row.pair.score,
        hardMatch: row.pair.hardMatch,
        signals: row.pair.contributions,
        reasons: row.pair.contributions.map((entry) => entry.label),
        source: "phase37-au-nz-pacific-seed",
      },
    });
  }

  const contactCount = await db.contact.count({
    where: { userId: user.id, labels: { array_contains: [SEED_LABEL] } },
  });
  const suggestionCount = await db.mergeSuggestion.count({
    where: { userId: user.id, source: "phase37-au-nz-pacific-seed", status: "OPEN" },
  });

  console.log(
    JSON.stringify(
      {
        user: user.email,
        contacts: contactCount,
        suggestions: suggestionCount,
        pairsSeeded: createdSuggestions.length,
        countriesCovered: [...new Set(pairs.map((pair) => pair.country))],
      },
      null,
      2,
    ),
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

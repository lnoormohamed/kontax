import { createId } from "@paralleldrive/cuid2";
import { PrismaClient } from "../generated/prisma/index.js";

export const getArg = (name, fallback = undefined) => {
  const prefix = `--${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
};

export const hasFlag = (name) => process.argv.includes(`--${name}`);

const buildPairKey = (leftContactId, rightContactId) =>
  [leftContactId, rightContactId].sort().join(":");

const baseContactData = (userId, raw, seedLabel, offset) => ({
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
  labels: [seedLabel, "phase37-phone", `country-${raw.country.toLowerCase()}`],
  sourceType: "MANUAL",
  lastMutatedBy: "MANUAL",
  archivedAt: null,
  createdAt: new Date(Date.now() + offset * 1000),
});

export const makeLocalIntlPair = ({
  country,
  fullName,
  firstName,
  lastName,
  localPhone,
  intlPhone,
  company,
  jobTitle,
  localNote,
  intlNote,
  matchLabel,
  score = 240,
}) => ({
  country,
  confidence: "HIGH",
  score,
  hardMatch: true,
  contributions: [
    { signal: "exact-name", label: "Same full name", score: 80 },
    { signal: "normalized-phone", label: matchLabel, score: 95 },
    { signal: "name-and-company", label: "Same name and company", score: 65 },
  ],
  left: {
    country,
    fullName,
    firstName,
    lastName,
    phone: localPhone,
    company,
    notes: localNote ?? "Local format.",
  },
  right: {
    country,
    fullName,
    firstName,
    lastName,
    email: `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}.${country.toLowerCase()}@kontax-seed.test`,
    phone: intlPhone,
    company,
    jobTitle: jobTitle ?? null,
    notes: intlNote ?? "International format.",
  },
});

export const makeIntlSpacingPair = ({
  country,
  fullName,
  firstName,
  lastName,
  compactPhone,
  spacedPhone,
  company,
  jobTitle,
  score = 226,
}) => ({
  country,
  confidence: "HIGH",
  score,
  hardMatch: true,
  contributions: [
    { signal: "exact-name", label: "Same full name", score: 80 },
    { signal: "exact-phone", label: "Same phone in different formatting", score: 86 },
    { signal: "name-and-company", label: "Same name and company", score: 60 },
  ],
  left: {
    country,
    fullName,
    firstName,
    lastName,
    phone: compactPhone,
    company,
    notes: "Compact international format.",
  },
  right: {
    country,
    fullName,
    firstName,
    lastName,
    email: `${fullName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.|\.$/g, "")}.${country.toLowerCase()}@kontax-seed.test`,
    phone: spacedPhone,
    company,
    jobTitle: jobTitle ?? null,
    notes: "Spaced international format.",
  },
});

export const runPhoneSeed = async ({
  targetEmail,
  seedLabel,
  source,
  pairs,
}) => {
  const db = new PrismaClient();

  try {
    const user = await db.user.findUnique({
      where: { email: targetEmail.toLowerCase() },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new Error(`User not found: ${targetEmail}`);
    }

    if (hasFlag("reset")) {
      const priorContacts = await db.contact.findMany({
        where: { userId: user.id, labels: { array_contains: [seedLabel] } },
        select: { id: true },
      });
      const priorIds = priorContacts.map((contact) => contact.id);

      await db.mergeSuggestion.deleteMany({
        where: priorIds.length > 0
          ? {
              userId: user.id,
              OR: [{ leftContactId: { in: priorIds } }, { rightContactId: { in: priorIds } }],
            }
          : { userId: user.id, source },
      });

      if (priorIds.length > 0) {
        await db.contact.deleteMany({ where: { id: { in: priorIds } } });
      }
    }

    const createdSuggestions = [];
    let offset = 0;

    for (const pair of pairs) {
      const left = await db.contact.create({
        data: baseContactData(user.id, pair.left, seedLabel, offset++),
        select: { id: true },
      });
      const right = await db.contact.create({
        data: baseContactData(user.id, pair.right, seedLabel, offset++),
        select: { id: true },
      });
      createdSuggestions.push({ pair, leftId: left.id, rightId: right.id });
    }

    for (const row of createdSuggestions) {
      const pairKey = buildPairKey(row.leftId, row.rightId);
      await db.mergeSuggestion.upsert({
        where: { userId_pairKey: { userId: user.id, pairKey } },
        update: {
          status: "OPEN",
          confidence: row.pair.confidence,
          score: row.pair.score,
          hardMatch: row.pair.hardMatch,
          signals: row.pair.contributions,
          reasons: row.pair.contributions.map((entry) => entry.label),
          source,
        },
        create: {
          userId: user.id,
          leftContactId: row.leftId,
          rightContactId: row.rightId,
          pairKey,
          status: "OPEN",
          confidence: row.pair.confidence,
          score: row.pair.score,
          hardMatch: row.pair.hardMatch,
          signals: row.pair.contributions,
          reasons: row.pair.contributions.map((entry) => entry.label),
          source,
        },
      });
    }

    const contactCount = await db.contact.count({
      where: { userId: user.id, labels: { array_contains: [seedLabel] } },
    });
    const suggestionCount = await db.mergeSuggestion.count({
      where: { userId: user.id, source, status: "OPEN" },
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
  } finally {
    await db.$disconnect();
  }
};

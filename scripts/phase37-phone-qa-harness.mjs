import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const getArg = (name, fallback = undefined) => {
  const prefix = `--${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const targetEmail = getArg("user", process.env.SEED_USER_EMAIL ?? "li@linoormohamed.com");
const phaseFilter = (getArg("phase", "all") ?? "all").trim().toLowerCase();

const PHASES = [
  {
    id: "P37-02",
    key: "pacific",
    source: "phase37-au-nz-pacific-seed",
    expectedCountries: ["AU", "NZ", "FJ", "PG"],
    minimumSuggestions: 6,
  },
  {
    id: "P37-03",
    key: "nanp",
    source: "phase37-nanp-seed",
    expectedCountries: [
      "US",
      "CA",
      "AG",
      "AI",
      "AS",
      "BB",
      "BM",
      "BS",
      "DM",
      "DO",
      "GD",
      "GU",
      "JM",
      "KN",
      "KY",
      "LC",
      "MP",
      "MS",
      "PR",
      "SX",
      "TC",
      "TT",
      "VC",
      "VG",
      "VI",
    ],
    minimumSuggestions: 25,
  },
  {
    id: "P37-04",
    key: "uk-ie",
    source: "phase37-uk-ireland-seed",
    expectedCountries: ["GB", "IE"],
    minimumSuggestions: 4,
  },
  {
    id: "P37-05",
    key: "western-europe",
    source: "phase37-western-europe-seed",
    expectedCountries: ["FR", "DE", "NL", "BE", "CH", "AT", "LU", "LI"],
    minimumSuggestions: 8,
  },
  {
    id: "P37-06",
    key: "nordics-baltics",
    source: "phase37-nordics-baltics-seed",
    expectedCountries: ["SE", "NO", "DK", "FI", "IS", "EE", "LV", "LT"],
    minimumSuggestions: 8,
  },
  {
    id: "P37-07",
    key: "southern-europe",
    source: "phase37-southern-europe-seed",
    expectedCountries: ["ES", "PT", "IT", "GR", "MT", "CY"],
    minimumSuggestions: 6,
  },
  {
    id: "P37-08",
    key: "central-eastern-europe",
    source: "phase37-central-eastern-europe-seed",
    expectedCountries: ["PL", "CZ", "SK", "RO", "UA", "HR"],
    minimumSuggestions: 6,
  },
  {
    id: "P37-09",
    key: "mena",
    source: "phase37-mena-seed",
    expectedCountries: ["TR", "IL", "SA", "AE", "EG", "MA"],
    minimumSuggestions: 6,
  },
  {
    id: "P37-10",
    key: "sub-saharan-africa",
    source: "phase37-sub-saharan-africa-seed",
    expectedCountries: ["NG", "GH", "KE", "ZA", "TZ", "UG"],
    minimumSuggestions: 6,
  },
  {
    id: "P37-11",
    key: "asia-latam",
    source: "phase37-asia-latam-seed",
    expectedCountries: ["IN", "CN", "JP", "KR", "BR", "MX"],
    minimumSuggestions: 6,
  },
];

const normalizeDigits = (value) => (value ?? "").replace(/\D/g, "");

const startsWithPlus = (value) => (value ?? "").trim().startsWith("+");

const localVariants = (digits) => {
  const variants = new Set();
  if (!digits) {
    return variants;
  }

  variants.add(digits);

  if (digits.startsWith("00") && digits.length > 2) {
    variants.add(digits.slice(2));
  }

  if (digits.startsWith("0") && digits.length > 1) {
    variants.add(digits.slice(1));
  }

  return variants;
};

const areLikelySamePhone = (left, right) => {
  const leftDigits = normalizeDigits(left);
  const rightDigits = normalizeDigits(right);

  if (!leftDigits || !rightDigits) {
    return false;
  }

  if (leftDigits === rightDigits) {
    return true;
  }

  if (startsWithPlus(left) && !startsWithPlus(right)) {
    return [...localVariants(rightDigits)].some((variant) => leftDigits.endsWith(variant));
  }

  if (!startsWithPlus(left) && startsWithPlus(right)) {
    return [...localVariants(leftDigits)].some((variant) => rightDigits.endsWith(variant));
  }

  return false;
};

const choosePreferredVariant = (left, right) => {
  if (!areLikelySamePhone(left, right)) {
    return "distinct";
  }

  if (startsWithPlus(left) && !startsWithPlus(right)) {
    return "left";
  }

  if (!startsWithPlus(left) && startsWithPlus(right)) {
    return "right";
  }

  const leftCompact = (left ?? "").replace(/\s+/g, "");
  const rightCompact = (right ?? "").replace(/\s+/g, "");

  if (leftCompact.length === rightCompact.length) {
    return "either";
  }

  return leftCompact.length > rightCompact.length ? "left" : "right";
};

const getCountryCode = (contact) => {
  const label = (contact.labels ?? []).find((entry) => entry.startsWith("country-"));
  return label ? label.slice("country-".length).toUpperCase() : null;
};

const formatReviewTarget = (phase, suggestion) => ({
  phase: phase.id,
  source: phase.source,
  suggestionId: suggestion.id,
  name: suggestion.leftContact.fullName || suggestion.rightContact.fullName || "Unnamed contact",
  leftPhone: suggestion.leftContact.phone ?? null,
  rightPhone: suggestion.rightContact.phone ?? null,
});

const matchesPhase = (phase) => {
  if (phaseFilter === "all") {
    return true;
  }

  const aliases = [phase.id, phase.key, phase.source].map((entry) => entry.toLowerCase());
  return aliases.includes(phaseFilter);
};

const selectedPhases = PHASES.filter(matchesPhase);

if (selectedPhases.length === 0) {
  console.error(`Unknown phase filter: ${phaseFilter}`);
  process.exit(1);
}

try {
  const user = await db.user.findUnique({
    where: { email: targetEmail.toLowerCase() },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new Error(`User not found: ${targetEmail}`);
  }

  const results = [];

  for (const phase of selectedPhases) {
    const suggestions = await db.mergeSuggestion.findMany({
      where: {
        userId: user.id,
        source: phase.source,
        status: "OPEN",
      },
      orderBy: { score: "desc" },
      select: {
        id: true,
        score: true,
        confidence: true,
        leftContact: {
          select: {
            fullName: true,
            phone: true,
            labels: true,
          },
        },
        rightContact: {
          select: {
            fullName: true,
            phone: true,
            labels: true,
          },
        },
      },
    });

    const seenCountries = new Set();
    const failures = [];
    let equivalentPairs = 0;
    let plusPreferredPairs = 0;
    let localIntlPairs = 0;

    for (const suggestion of suggestions) {
      const leftCountry = getCountryCode(suggestion.leftContact);
      const rightCountry = getCountryCode(suggestion.rightContact);

      if (leftCountry) {
        seenCountries.add(leftCountry);
      }

      if (rightCountry) {
        seenCountries.add(rightCountry);
      }

      const leftPhone = suggestion.leftContact.phone;
      const rightPhone = suggestion.rightContact.phone;
      const equivalent = areLikelySamePhone(leftPhone, rightPhone);
      const preferred = choosePreferredVariant(leftPhone, rightPhone);
      const exactlyOnePlus = startsWithPlus(leftPhone) !== startsWithPlus(rightPhone);

      if (equivalent) {
        equivalentPairs += 1;
      } else {
        failures.push({
          type: "phone-not-equivalent",
          suggestionId: suggestion.id,
          name: suggestion.leftContact.fullName || suggestion.rightContact.fullName || "Unnamed contact",
          leftPhone: leftPhone ?? null,
          rightPhone: rightPhone ?? null,
        });
      }

      if (equivalent && exactlyOnePlus) {
        localIntlPairs += 1;

        const plusSide = startsWithPlus(leftPhone) ? "left" : "right";
        if (preferred === plusSide) {
          plusPreferredPairs += 1;
        } else {
          failures.push({
            type: "plus-not-preferred",
            suggestionId: suggestion.id,
            name: suggestion.leftContact.fullName || suggestion.rightContact.fullName || "Unnamed contact",
            leftPhone: leftPhone ?? null,
            rightPhone: rightPhone ?? null,
            preferred,
            expected: plusSide,
          });
        }
      }
    }

    const missingCountries = phase.expectedCountries.filter((country) => !seenCountries.has(country));
    const phasePassed =
      suggestions.length >= phase.minimumSuggestions &&
      missingCountries.length === 0 &&
      failures.length === 0;

    results.push({
      phase: phase.id,
      source: phase.source,
      passed: phasePassed,
      suggestionCount: suggestions.length,
      minimumSuggestions: phase.minimumSuggestions,
      expectedCountries: phase.expectedCountries,
      seenCountries: [...seenCountries].sort(),
      missingCountries,
      equivalentPairs,
      localIntlPairs,
      plusPreferredPairs,
      failures,
      reviewTargets: suggestions.slice(0, 3).map((suggestion) => formatReviewTarget(phase, suggestion)),
    });
  }

  const summary = {
    user: user.email,
    phaseFilter,
    phasesChecked: results.length,
    passed: results.filter((entry) => entry.passed).length,
    failed: results.filter((entry) => !entry.passed).length,
    generatedAt: new Date().toISOString(),
    results,
  };

  if (hasFlag("json")) {
    console.log(JSON.stringify(summary, null, 2));
    process.exit(0);
  }

  console.log(`Phase 37 phone QA for ${summary.user}`);
  console.log(`Checked ${summary.phasesChecked} phase(s) at ${summary.generatedAt}`);
  console.log("");

  for (const result of results) {
    const status = result.passed ? "PASS" : "FAIL";
    console.log(`${result.phase} ${status}`);
    console.log(`  source: ${result.source}`);
    console.log(
      `  coverage: ${result.suggestionCount}/${result.minimumSuggestions}+ suggestions, countries ${result.seenCountries.join(", ") || "none"}`,
    );
    console.log(
      `  phone pairs: ${result.equivalentPairs} equivalent, ${result.plusPreferredPairs}/${result.localIntlPairs} local-vs-plus pairs prefer +`,
    );

    if (result.missingCountries.length > 0) {
      console.log(`  missing countries: ${result.missingCountries.join(", ")}`);
    }

    if (result.failures.length > 0) {
      console.log("  failures:");
      for (const failure of result.failures.slice(0, 5)) {
        console.log(
          `    - ${failure.type} · ${failure.name} · ${failure.leftPhone ?? "—"} <> ${failure.rightPhone ?? "—"}`,
        );
      }
    }

    if (result.reviewTargets.length > 0) {
      console.log("  review targets:");
      for (const target of result.reviewTargets) {
        console.log(`    - ${target.suggestionId} · ${target.name}`);
      }
    }

    console.log("");
  }

  const failedPhases = results.filter((entry) => !entry.passed).map((entry) => entry.phase);
  if (failedPhases.length > 0) {
    process.exitCode = 1;
    console.log(`Failed phases: ${failedPhases.join(", ")}`);
  } else {
    console.log("All selected Phase 37 QA checks passed.");
  }
} finally {
  await db.$disconnect();
}

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const toLower = (value) => value.toLowerCase();

const firstNames = [
  "Alex",
  "Sam",
  "Jordan",
  "Taylor",
  "Morgan",
  "Casey",
  "Riley",
  "Avery",
  "Quinn",
  "Phoenix",
  "Charlie",
  "Blair",
  "Drew",
  "Skylar",
  "Harper",
  "Parker",
  "Reese",
  "Noah",
  "Liam",
  "Maya",
  "Nina",
  "Ethan",
  "Iris",
  "Owen",
  "Sage",
  "Jules",
  "Kai",
  "Cameron",
  "Finley",
  "Rowan",
  "Emerson",
];

const lastNames = [
  "Walker",
  "Reed",
  "Bell",
  "Brooks",
  "Mason",
  "Chen",
  "Lopez",
  "Patel",
  "Bennett",
  "Foster",
  "Howard",
  "Ramirez",
  "Khan",
  "Griffin",
  "Miller",
  "Santiago",
  "Kim",
  "Morgan",
  "Hart",
  "Wright",
  "Carter",
  "Young",
  "Collins",
  "Cooper",
  "Brooks",
  "Shaw",
  "Vega",
  "Rao",
  "Bauer",
  "Fisher",
];

const companies = [
  "Northwind Labs",
  "Pioneer Systems",
  "Harbor View Co.",
  "Oak & Pine",
  "Helio Studio",
  "Blue Ridge Design",
  "Orbit Health",
  "Summit Commerce",
  "Nimbus Labs",
  "Citrine Analytics",
  "Pioneer Logistics",
  "Urban Stack",
  "North Point Labs",
  "Lumen Media",
  "Aster Mobility",
  "Granite Group",
  "Lark Technologies",
  "Vista Marketing",
  "Sable Financial",
  "Cove Creative",
];

const domains = [
  "example.com",
  "mailbox.test",
  "inbox.dev",
  "contax.io",
  "sample.net",
  "people.app",
];

const locationProfiles = [
  {
    code: "US",
    callingCode: "+1",
    cities: ["Austin", "Seattle", "Denver", "Boston", "Atlanta", "Denver"],
    streets: ["Pine", "Maple", "Oak", "Cedar", "Willow", "Broadway"],
    states: ["Texas", "Colorado", "Massachusetts", "Georgia", "Nevada", "Ohio"],
    localDigits: 10,
    zipFormat: "#####",
  },
  {
    code: "GB",
    callingCode: "+44",
    cities: ["London", "Manchester", "Bristol", "Leeds", "Belfast", "Cardiff"],
    streets: ["King's", "Queen's", "Baker", "West", "High", "Station"],
    states: ["England", "England", "Scotland", "Wales", "Wales", "Northern Ireland"],
    localDigits: 10,
    zipFormat: "AA###",
  },
  {
    code: "CA",
    callingCode: "+1",
    cities: ["Toronto", "Vancouver", "Halifax", "Calgary", "Ottawa", "Quebec"],
    streets: ["Maple", "Lakeside", "Hillside", "Church", "Queen", "King"],
    states: ["Ontario", "British Columbia", "Quebec", "Alberta", "Ontario", "Manitoba"],
    localDigits: 10,
    zipFormat: "A#A #A#",
  },
  {
    code: "AU",
    callingCode: "+61",
    cities: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Canberra"],
    streets: ["Harbour", "Wattle", "Station", "George", "Bourke", "Royal"],
    states: ["NSW", "VIC", "QLD", "WA", "SA", "ACT"],
    localDigits: 9,
    zipFormat: "####",
  },
  {
    code: "DE",
    callingCode: "+49",
    cities: ["Berlin", "Munich", "Hamburg", "Cologne", "Frankfurt", "Leipzig"],
    streets: ["Haupt", "Linden", "Schloss", "Markt", "Bahnhof", "Rosen"],
    states: ["Berlin", "Bavaria", "Hamburg", "North Rhine-Westphalia", "Hesse", "Saxony"],
    localDigits: 11,
    zipFormat: "#####",
  },
  {
    code: "IN",
    callingCode: "+91",
    cities: ["Mumbai", "Bengaluru", "Hyderabad", "Chennai", "Pune", "Jaipur"],
    streets: ["Raj", "Nehru", "Gandhi", "Lake", "Central", "MG"],
    states: ["Maharashtra", "Karnataka", "Telangana", "Tamil Nadu", "Maharashtra", "Rajasthan"],
    localDigits: 10,
    zipFormat: "######",
  },
  {
    code: "BR",
    callingCode: "+55",
    cities: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Curitiba", "Fortaleza"],
    streets: ["Avenida", "Rua", "Praça", "Travessa", "Alameda", "Rodovia"],
    states: ["SP", "RJ", "DF", "BA", "PR", "CE"],
    localDigits: 11,
    zipFormat: "#####-###",
  },
  {
    code: "JP",
    callingCode: "+81",
    cities: ["Tokyo", "Osaka", "Kyoto", "Fukuoka", "Sapporo", "Nagoya"],
    streets: ["Sakura", "Meiji", "Nakamura", "Harbor", "Shin", "Hama"],
    states: ["Tokyo", "Osaka", "Kyoto", "Fukuoka", "Hokkaido", "Aichi"],
    localDigits: 10,
    zipFormat: "###-####",
  },
  {
    code: "FR",
    callingCode: "+33",
    cities: ["Paris", "Lyon", "Marseille", "Lille", "Toulouse", "Nantes"],
    streets: ["Rue", "Boulevard", "Avenue", "Place", "Impasse", "Cours"],
    states: ["Île-de-France", "Auvergne-Rhône-Alpes", "Provence-Alpes-Côte d'Azur", "Hauts-de-France", "Occitanie", "Pays de la Loire"],
    localDigits: 9,
    zipFormat: "#####",
  },
  {
    code: "ZA",
    callingCode: "+27",
    cities: ["Johannesburg", "Cape Town", "Durban", "Pretoria", "Bloemfontein", "Port Elizabeth"],
    streets: ["Long", "Hill", "King", "Beach", "Main", "Nelson"],
    states: ["Gauteng", "Western Cape", "KwaZulu-Natal", "Gauteng", "Free State", "Eastern Cape"],
    localDigits: 9,
    zipFormat: "####",
  },
  {
    code: "NG",
    callingCode: "+234",
    cities: ["Lagos", "Abuja", "Ibadan", "Kano", "Port Harcourt", "Enugu"],
    streets: ["Adetokunbo", "Awolowo", "University", "Broad", "Allen", "Commercial"],
    states: ["Lagos", "FCT", "Oyo", "Kano", "Rivers", "Enugu"],
    localDigits: 10,
    zipFormat: "######",
  },
  {
    code: "ES",
    callingCode: "+34",
    cities: ["Madrid", "Barcelona", "Valencia", "Seville", "Malaga", "Bilbao"],
    streets: ["Calle", "Avenida", "Plaza", "Paseo", "Ronda", "Gran Via"],
    states: ["Madrid", "Catalonia", "Valencian Community", "Andalusia", "Andalusia", "Basque Country"],
    localDigits: 9,
    zipFormat: "#####",
  },
  {
    code: "IT",
    callingCode: "+39",
    cities: ["Rome", "Milan", "Naples", "Florence", "Venice", "Turin"],
    streets: ["Via", "Piazza", "Corso", "Viale", "Strada", "Largo"],
    states: ["Lazio", "Lombardy", "Campania", "Tuscany", "Veneto", "Piedmont"],
    localDigits: 9,
    zipFormat: "#####",
  },
  {
    code: "MX",
    callingCode: "+52",
    cities: ["Mexico City", "Guadalajara", "Monterrey", "Puebla", "Cancun", "Toluca"],
    streets: ["Avenida", "Calle", "Boulevard", "Camino", "Plaza", "Andador"],
    states: ["CDMX", "Jalisco", "Nuevo León", "Puebla", "Quintana Roo", "Estado de México"],
    localDigits: 10,
    zipFormat: "#####",
  },
  {
    code: "CN",
    callingCode: "+86",
    cities: ["Beijing", "Shanghai", "Shenzhen", "Guangzhou", "Chengdu", "Hangzhou"],
    streets: ["Huanxi", "Xintiandi", "Renmin", "Nanjing", "Chaoyang", "Fuxing"],
    states: ["Beijing", "Shanghai", "Guangdong", "Guangdong", "Sichuan", "Zhejiang"],
    localDigits: 11,
    zipFormat: "######",
  },
  {
    code: "KR",
    callingCode: "+82",
    cities: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Ulsan"],
    streets: ["Sejong", "Gangnam", "Myeongdong", "Jung", "Hak", "Yeongdeungpo"],
    states: ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Ulsan"],
    localDigits: 10,
    zipFormat: "#####",
  },
  {
    code: "AR",
    callingCode: "+54",
    cities: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Mar del Plata", "Salta"],
    streets: ["Calle", "Avenida", "Diagonal", "Bulevar", "Pasaje", "Plaza"],
    states: ["Buenos Aires", "Córdoba", "Santa Fe", "Mendoza", "Buenos Aires", "Salta"],
    localDigits: 10,
    zipFormat: "####",
  },
  {
    code: "RU",
    callingCode: "+7",
    cities: ["Moscow", "Saint Petersburg", "Novosibirsk", "Yekaterinburg", "Kazan", "Nizhny Novgorod"],
    streets: ["Leningrad", "Nevsky", "Oktyabrskaya", "Sovetskaya", "Bolshaya", "Krasnaya"],
    states: ["Moscow", "Leningrad", "Novosibirsk", "Sverdlovsk", "Tatarstan", "Nizhny Novgorod"],
    localDigits: 10,
    zipFormat: "######",
  },
  {
    code: "AE",
    callingCode: "+971",
    cities: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Al Ain", "Ras Al Khaimah"],
    streets: ["Sheikh", "King", "Corniche", "Al Habtoor", "Jumeirah", "Airport"],
    states: ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Abu Dhabi", "Ras Al Khaimah"],
    localDigits: 9,
    zipFormat: "#####",
  },
  {
    code: "SA",
    callingCode: "+966",
    cities: ["Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar"],
    streets: ["King", "Tahlia", "Sultan", "Al Faisaliah", "Ibn", "Airport"],
    states: ["Riyadh", "Makkah", "Makkah", "Medina", "Eastern Province", "Eastern Province"],
    localDigits: 9,
    zipFormat: "#####",
  },
  {
    code: "SG",
    callingCode: "+65",
    cities: ["Singapore"],
    streets: ["Orchard", "Marina", "Raffles", "Bukit", "Serangoon", "Tampines"],
    states: ["Central", "Central", "Central", "North-East", "East", "West"],
    localDigits: 8,
    zipFormat: "######",
  },
  {
    code: "SE",
    callingCode: "+46",
    cities: ["Stockholm", "Gothenburg", "Malmö", "Uppsala", "Lund", "Västerås"],
    streets: ["Sveavägen", "Drottninggatan", "Torg", "Kungsgatan", "Långgatan", "Vasagatan"],
    states: ["Stockholm", "Västra Götaland", "Skåne", "Uppsala", "Skåne", "Västmanland"],
    localDigits: 8,
    zipFormat: "#####",
  },
];

const notesPool = [
  "Met at conference.",
  "Prefers email over calls.",
  "Send monthly newsletter.",
  "Family contact; keep updated details.",
  "VIP client contact.",
  "Birthday reminder enabled.",
];

const getArg = (name, fallback) => {
  const pref = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(pref));
  if (direct) {
    const value = direct.slice(pref.length);
    return value.length > 0 ? value : fallback;
  }

  return fallback;
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

const randomBool = (oddsPercent) => Math.random() * 100 < oddsPercent;

const randomDate = () => {
  const start = new Date(1975, 0, 1).getTime();
  const end = new Date(2003, 11, 31).getTime();
  const date = new Date(start + Math.random() * (end - start));
  return date.toISOString().slice(0, 10);
};

const randomStreetNumber = () => String(Math.floor(Math.random() * 9000) + 100);

const generateZipCode = (profile) => {
  const zipLength = profile.zipFormat.replace(/[^0-9A-Za-z#]/g, "").length;
  const characters = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  return Array.from({ length: zipLength }, () =>
    characters[Math.floor(Math.random() * characters.length)],
  ).join("");
};

const generatePhoneForProfile = (profile) =>
  `${profile.callingCode}${String(
    Math.floor(
      Math.pow(10, profile.localDigits - 1) +
        Math.random() * (Math.pow(10, profile.localDigits) - Math.pow(10, profile.localDigits - 1)),
    ),
  )}`;

const slug = (value) =>
  toLower(value)
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 20) || "contact";

const normalizeCount = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
};

const main = async () => {
  const userEmail = getArg("user", undefined) || process.env.SEED_USER_EMAIL;
  const contactCount = normalizeCount(getArg("count", "200"), 200);

  const user = userEmail
    ? await db.user.findUnique({ where: { email: userEmail.toLowerCase() } })
    : await db.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    console.error(
      "No user found. Set --user=email or create a user before running this seed script.",
    );
    process.exitCode = 1;
    return;
  }

  const contacts = Array.from({ length: contactCount }, (_, index) => {
    const profile = randomItem(locationProfiles);
    const firstName = randomItem(firstNames);
    const lastName = randomItem(lastNames);
    const fullName = `${firstName} ${lastName}`;
    const company = randomItem(companies);
    const city = `${randomItem(profile.cities)} ${profile.code}-${index + 1}`;
    const provinceOrRegion = randomItem(profile.states);
    const street = randomItem(profile.streets);
    const zipCode = generateZipCode(profile);
    const baseEmail = `${slug(firstName)}.${slug(lastName)}.${String(index + 1).padStart(3, "0")}@${randomItem(
      domains,
    )}`;

    const phone = generatePhoneForProfile(profile);
    const altPhone = generatePhoneForProfile(profile);

    return {
      userId: user.id,
      fullName,
      firstName,
      middleName: randomBool(30) ? randomItem(firstNames) : null,
      lastName,
      namePrefix: randomBool(8) ? "Mr" : null,
      nameSuffix: randomBool(5) ? "Jr" : null,
      nickname: randomBool(25) ? `${firstName} ${String(index + 1).padStart(2, "0")}` : null,
      email: baseEmail,
      emailAddresses: [baseEmail, `${firstName.toLowerCase()}.${index + 101}@${randomItem(domains)}`],
      emailEntries: [
        { label: "primary", value: baseEmail, isPrimary: true },
        { label: "work", value: `${firstName.toLowerCase()}.${index + 101}@${randomItem(domains)}` },
      ],
      phone,
      phoneNumbers: [phone, altPhone],
      phoneEntries: [
        { label: "mobile", value: phone, isPrimary: true },
        { label: "office", value: altPhone },
      ],
      company,
      jobTitle: `Team ${index % 12 === 0 ? "Lead" : "Specialist"}`,
      website: `https://www.${slug(company)}.com/contact/${slug(fullName)}-${index + 1}`,
      websiteEntries: [
        {
          label: "primary",
          value: `https://www.${slug(company)}.com/contact/${slug(fullName)}-${index + 1}`,
        },
      ],
      birthday: randomDate(),
      address: `${randomStreetNumber()} ${street}, ${city}`,
      avatarUrl:
        randomBool(20) ?
          `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(fullName)}` :
          null,
      isFavorite: randomBool(15),
      labels: randomBool(50) ? ["seed", company.toLowerCase().replace(/\s+/g, "-"), "demo"] : ["seed", "demo"],
      postalAddresses: [
        {
          label: "home",
          formatted: `${randomStreetNumber()} ${street} ${randomBool(50) ? "St" : "Rd"}, ${city}, ${provinceOrRegion}`,
          isPrimary: true,
          countryOrRegion: profile.code,
          cityOrTown: city,
          postcode: zipCode,
          streetLine1: `${randomStreetNumber()} ${street} ${randomBool(50) ? "St" : "Rd"}`,
          streetLine2: randomBool(35) ? "Unit 4" : undefined,
          countryOrRegion: profile.code,
        },
      ],
      addressEntries: [
        {
          label: "home",
          formatted: `${randomStreetNumber()} ${street}, ${city}, ${provinceOrRegion}`,
          isPrimary: true,
          cityOrTown: city,
          countryOrRegion: profile.code,
        },
      ],
      significantDates: randomBool(40)
        ? [
            {
              label: "birthday",
              date: randomDate(),
              isPrimary: true,
            },
          ]
        : null,
      relatedPeople: randomBool(20) ? [{ relationship: "colleague", name: `Jordan ${lastName}` }] : null,
      customFields: randomBool(15) ? [{ label: "department", value: randomItem(["Sales", "Engineering", "Marketing", "Support"]) }] : null,
      notes: randomItem(notesPool),
      archivedAt: null,
      syncUid: undefined,
    };
  });

  const created = await db.contact.createMany({
    data: contacts,
    skipDuplicates: true,
  });

  console.log(`Created ${created.count} contacts for ${user.email} (requested ${contactCount}).`);
};

try {
  await main();
} catch (error) {
  console.error("Failed to seed contacts", error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}

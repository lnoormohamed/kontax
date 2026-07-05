import { createId } from "@paralleldrive/cuid2";

import { PrismaClient } from "../generated/prisma/index.js";

const db = new PrismaClient();

const SEED_LABEL = "demo-multilingual";
const DEFAULT_COUNT = 100;

const localeProfiles = [
  {
    key: "pl",
    country: "Poland",
    city: "Łódź",
    state: "Łódzkie",
    postcode: "90-001",
    street: "ul. Piotrkowska",
    callingCode: "+48",
    companySuffixes: ["Studio", "Biuro", "Logistyka", "Doradztwo"],
    jobTitles: ["Kierowniczka projektu", "Analityk produktu", "Koordynatorka operacji"],
    note: "Rozmawia po polsku i chętnie dostaje krótkie wiadomości.",
    firstNames: ["Łukasz", "Małgorzata", "Agnieszka", "Błażej", "Żaneta", "Mikołaj"],
    lastNames: ["Kowalski", "Wróblewska", "Dąbrowski", "Zielińska", "Górski", "Bąk"],
  },
  {
    key: "fr",
    country: "France",
    city: "Lyon",
    state: "Auvergne-Rhône-Alpes",
    postcode: "69002",
    street: "Rue de la République",
    callingCode: "+33",
    companySuffixes: ["Conseil", "Atelier", "Santé", "Numérique"],
    jobTitles: ["Cheffe de projet", "Responsable clientèle", "Directrice des opérations"],
    note: "Préfère les échanges en français et les comptes rendus concis.",
    firstNames: ["Élodie", "Benoît", "Anaïs", "François", "Gaëlle", "Maëlys"],
    lastNames: ["Dubois", "Lefèvre", "Moreau", "Noël", "Bérard", "Poirier"],
  },
  {
    key: "de",
    country: "Germany",
    city: "München",
    state: "Bayern",
    postcode: "80331",
    street: "Schloßstraße",
    callingCode: "+49",
    companySuffixes: ["GmbH", "Beratung", "Technik", "Handel"],
    jobTitles: ["Leiterin Vertrieb", "Produktmanager", "Geschäftsführerin"],
    note: "Spricht Deutsch und mag klare Terminbestätigungen.",
    firstNames: ["Jörg", "Svenja", "Marlene", "Tobias", "Käthe", "Björn"],
    lastNames: ["Schäfer", "Müller", "Groß", "Kühn", "Weiß", "Krüger"],
  },
  {
    key: "pt",
    country: "Brazil",
    city: "São Paulo",
    state: "SP",
    postcode: "01000-000",
    street: "Avenida Paulista",
    callingCode: "+55",
    companySuffixes: ["Saúde", "Comércio", "Ateliê", "Tecnologia"],
    jobTitles: ["Diretora comercial", "Gerente de operações", "Coordenador de produto"],
    note: "Prefere mensagens em português e respostas no mesmo dia.",
    firstNames: ["João", "Marília", "Tainá", "Ângelo", "Cássia", "Luísa"],
    lastNames: ["Silva", "Oliveira", "Araújo", "Pereira", "Gonçalves", "Nóbrega"],
  },
  {
    key: "es",
    country: "Spain",
    city: "Sevilla",
    state: "Andalucía",
    postcode: "41001",
    street: "Calle Sierpes",
    callingCode: "+34",
    companySuffixes: ["Salud", "Diseño", "Logística", "Consultoría"],
    jobTitles: ["Directora de cuentas", "Gerente de producto", "Coordinador regional"],
    note: "Le gusta que las actualizaciones lleguen en español.",
    firstNames: ["Sofía", "Álvaro", "Lucía", "Iñigo", "Noemí", "Raúl"],
    lastNames: ["Muñoz", "Peña", "García", "López", "Ruíz", "Sánchez"],
  },
  {
    key: "cz",
    country: "Czech Republic",
    city: "Brno",
    state: "Jihomoravský kraj",
    postcode: "602 00",
    street: "Česká",
    callingCode: "+420",
    companySuffixes: ["Poradenství", "Doprava", "Vývoj", "Studio"],
    jobTitles: ["Vedoucí projektu", "Produktová manažerka", "Provozní ředitel"],
    note: "Upřednostňuje stručné zprávy v češtině.",
    firstNames: ["Jiří", "Šárka", "Tereza", "Václav", "Zuzana", "Ondřej"],
    lastNames: ["Dvořák", "Černá", "Procházka", "Šimek", "Říha", "Kučera"],
  },
  {
    key: "gr",
    country: "Greece",
    city: "Αθήνα",
    state: "Αττική",
    postcode: "105 52",
    street: "Οδός Αθηνάς",
    callingCode: "+30",
    companySuffixes: ["Logistics", "Foods", "Health", "Partners"],
    jobTitles: ["Διευθύντρια έργου", "Υπεύθυνος προϊόντος", "Διευθυντής λειτουργιών"],
    note: "Προτιμά σύντομα μηνύματα και ελληνικά ονόματα πεδίων.",
    firstNames: ["Νίκη", "Γιώργος", "Ελένη", "Ανδρέας", "Σοφία", "Μάριος"],
    lastNames: ["Παπαδοπούλου", "Νικολάου", "Δημητρίου", "Καραγιάννη", "Βασιλείου", "Χριστοδούλου"],
  },
  {
    key: "tr",
    country: "Turkey",
    city: "İzmir",
    state: "İzmir",
    postcode: "35210",
    street: "Kıbrıs Şehitleri Caddesi",
    callingCode: "+90",
    companySuffixes: ["Ticaret", "Lojistik", "Danışmanlık", "Sağlık"],
    jobTitles: ["Operasyon müdürü", "Ürün yöneticisi", "Bölge koordinatörü"],
    note: "Türkçe iletişimi tercih eder ve numara etiketlerini dikkatle kontrol eder.",
    firstNames: ["Çağla", "İlker", "Özge", "Şebnem", "Yiğit", "Gökçe"],
    lastNames: ["Yılmaz", "Çelik", "Şahin", "Öztürk", "Doğan", "Kara"],
  },
  {
    key: "nordic",
    country: "Iceland",
    city: "Reykjavík",
    state: "Höfuðborgarsvæði",
    postcode: "101",
    street: "Laugavegur",
    callingCode: "+354",
    companySuffixes: ["Studio", "Heilsa", "Ráðgjöf", "Vörur"],
    jobTitles: ["Verkefnastjóri", "Sölustjóri", "Rekstrarstjóri"],
    note: "Mætir vel á símafundi og vill íslensk nöfn sýnd rétt.",
    firstNames: ["Þórunn", "Árni", "Sævar", "Jónína", "Björk", "Guðrún"],
    lastNames: ["Ólafsdóttir", "Jónsson", "Þórarinsson", "Guðmundsdóttir", "Ásmundsson", "Bergþórsdóttir"],
  },
  {
    key: "vn",
    country: "Vietnam",
    city: "Đà Nẵng",
    state: "Đà Nẵng",
    postcode: "550000",
    street: "Đường Bạch Đằng",
    callingCode: "+84",
    companySuffixes: ["Thương mại", "Sáng tạo", "Y tế", "Giải pháp"],
    jobTitles: ["Quản lý vận hành", "Trưởng nhóm sản phẩm", "Giám đốc khách hàng"],
    note: "Thích hiển thị đầy đủ dấu tiếng Việt trong tên liên hệ.",
    firstNames: ["Ngọc", "Hải", "Thảo", "Minh", "Phương", "Tuấn"],
    lastNames: ["Nguyễn", "Trần", "Lê", "Phạm", "Đỗ", "Võ"],
  },
  {
    key: "ru",
    country: "Bulgaria",
    city: "София",
    state: "София-град",
    postcode: "1000",
    street: "бул. Витоша",
    callingCode: "+359",
    companySuffixes: ["Груп", "Логистик", "Здраве", "Студио"],
    jobTitles: ["Ръководител проекти", "Оперативен директор", "Мениджър продукти"],
    note: "Предпочита кирилица в имената и точни телефонни формати.",
    firstNames: ["София", "Алексей", "Елена", "Николай", "Мария", "Ивайло"],
    lastNames: ["Иванова", "Петров", "Георгиева", "Димитров", "Стоянова", "Василев"],
  },
  {
    key: "jp",
    country: "Japan",
    city: "東京",
    state: "東京都",
    postcode: "100-0001",
    street: "銀座通り",
    callingCode: "+81",
    companySuffixes: ["企画", "物流", "商事", "医療"],
    jobTitles: ["営業部長", "プロダクトマネージャー", "運営責任者"],
    note: "日本語表記の氏名と会社名を確認したい連絡先です。",
    firstNames: ["さくら", "蓮", "美咲", "大翔", "陽菜", "悠真"],
    lastNames: ["宮崎", "高橋", "佐々木", "渡辺", "小林", "斎藤"],
  },
];

const getArg = (name, fallback) => {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (!direct) return fallback;
  const value = direct.slice(prefix.length);
  return value.length > 0 ? value : fallback;
};

const hasFlag = (name) => process.argv.includes(`--${name}`);

const normalizeCount = (value, fallback) => {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, 500);
};

const buildLocalNumber = (index) => String(1000000000 + index * 7919).slice(-9);

const formatPhone = (callingCode, index) => {
  const digits = buildLocalNumber(index);
  return `${callingCode} ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
};

const createContactPayload = (userId, index) => {
  const profile = localeProfiles[index % localeProfiles.length];
  const cycle = Math.floor(index / localeProfiles.length);
  const firstName = profile.firstNames[cycle % profile.firstNames.length];
  const lastName = profile.lastNames[Math.floor(cycle / profile.firstNames.length) % profile.lastNames.length];
  const fullName = profile.key === "jp" ? `${lastName} ${firstName}` : `${firstName} ${lastName}`;
  const companyBase = profile.key === "jp" || profile.key === "ru" || profile.key === "gr"
    ? `${profile.city}${profile.companySuffixes[index % profile.companySuffixes.length]}`
    : `${profile.city} ${profile.companySuffixes[index % profile.companySuffixes.length]}`;
  const phone = formatPhone(profile.callingCode, index + 1);
  const email = `demo.multilingual.${String(index + 1).padStart(3, "0")}@kontax-seed.test`;
  const addressLine = `${profile.street} ${10 + ((index * 7) % 89)}`;
  const formattedAddress = `${addressLine}, ${profile.city}, ${profile.state}, ${profile.postcode}, ${profile.country}`;

  return {
    id: createId(),
    syncUid: createId(),
    userId,
    fullName,
    firstName,
    lastName,
    nickname: firstName,
    email,
    phone,
    company: companyBase,
    jobTitle: profile.jobTitles[index % profile.jobTitles.length],
    department: "International demos",
    website: `https://kontax-seed.test/${profile.key}/${String(index + 1).padStart(3, "0")}`,
    birthday: `198${index % 10}-${String((index % 12) + 1).padStart(2, "0")}-${String(((index * 3) % 28) + 1).padStart(2, "0")}`,
    address: formattedAddress,
    isFavorite: index % 11 === 0,
    isEmergency: index % 17 === 0,
    labels: [SEED_LABEL, "demo", "seed", profile.key],
    emailEntries: [
      { label: "Work", value: email },
      { label: "Alt", value: `alt.${String(index + 1).padStart(3, "0")}@kontax-seed.test` },
    ],
    phoneEntries: [
      { label: "Mobile", value: phone },
      { label: "Work", value: formatPhone(profile.callingCode, index + 501) },
    ],
    addressEntries: [
      {
        label: "Primary",
        street: addressLine,
        city: profile.city,
        state: profile.state,
        postcode: profile.postcode,
        country: profile.country,
        formatted: formattedAddress,
      },
    ],
    notes: `${profile.note} Seed batch ${String(index + 1).padStart(3, "0")}.`,
    sourceType: "MANUAL",
    sourceDetail: "Seeded multilingual demo contact",
    lastMutatedBy: "MANUAL",
    lastMutatedByDetail: "seed-multilingual-demo-contacts",
  };
};

const main = async () => {
  const requestedCount = normalizeCount(getArg("count", DEFAULT_COUNT), DEFAULT_COUNT);
  const userEmail = getArg("user", undefined) ?? process.env.SEED_USER_EMAIL;
  const user = userEmail
    ? await db.user.findUnique({ where: { email: userEmail.toLowerCase() } })
    : await db.user.findFirst({ orderBy: { createdAt: "asc" } });

  if (!user) {
    console.error("No user found. Pass --user=email or set SEED_USER_EMAIL.");
    process.exitCode = 1;
    return;
  }

  if (hasFlag("reset")) {
    const prior = await db.contact.findMany({
      where: { userId: user.id, labels: { array_contains: [SEED_LABEL] } },
      select: { id: true },
    });
    const ids = prior.map((contact) => contact.id);
    if (ids.length > 0) {
      await db.contact.deleteMany({ where: { id: { in: ids } } });
    }
    console.log(`Reset: removed ${ids.length} prior multilingual demo contact(s) for ${user.email}.`);
  }

  const contacts = Array.from({ length: requestedCount }, (_, index) => createContactPayload(user.id, index));

  await db.contact.createMany({ data: contacts });

  console.log(`Created ${contacts.length} multilingual demo contact(s) for ${user.email}.`);
  console.log(`Label applied: ${SEED_LABEL}`);
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

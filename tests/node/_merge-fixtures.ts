// P49A-09 — deterministic synthetic contact books for the duplicate-scoring
// equivalence + benchmark tests. Seeded PRNG so every run sees the same data.
import type { MergeCandidateContact } from "../../src/server/contact-merge";

export const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const GIVEN = [
  "John", "Jon", "Johnny", "Jonathan", "Robert", "Rob", "Bob", "Bobby", "Katherine", "Catherine",
  "Kate", "Kathryn", "Elizabeth", "Liz", "Beth", "William", "Will", "Bill", "Michael", "Mike",
  "Micheal", "Sarah", "Sara", "Stephen", "Steven", "Steve", "Mohammed", "Muhammad", "Mohamed",
  "Aleksandr", "Alexander", "Alex", "Olga", "Ivan", "Priya", "Layla", "Leila", "Omar", "Thảo",
  "Hải", "Árni", "Aron", "İlker", "Ilker", "Łukasz", "Lukasz", "Zoë", "Zoe", "Chloé", "Chloe",
  "Geoff", "Jeff", "Philip", "Phillip", "Filip", "Anne", "Ann", "Anna", "Hannah", "Hana", "J.",
  "K.", "M.", "Al", "Li", "Lu", "Wu", "Xu", "Mary", "Marie", "Maria", "Sean", "Shaun", "Shawn",
];

const FAMILY = [
  "Smith", "Smyth", "Smithe", "Johnson", "Jonson", "Reid", "Reed", "Read", "Nguyễn", "Nguyen",
  "Müller", "Mueller", "Muller", "O'Brien", "OBrien", "Hassan", "Hasan", "Khan", "Shah", "Sha",
  "Jónsson", "Jonsson", "Yıldız", "Yildiz", "Wójcik", "Wojcik", "Petrov", "Petrova", "Smirnova",
  "Melnyk", "García", "Garcia", "Garsia", "Kowalski", "Kowalsky", "Schmidt", "Schmitt", "Taylor",
  "Tailor", "Brown", "Browne", "Lee", "Li", "Wong", "Wang", "Van der Berg", "de la Cruz", "MacDonald",
  "McDonald", "Fitzgerald", "Thompson", "Thomson", "Andersen", "Anderson",
];

// Whole-name fixtures lifted from tests/node/merge-suggestion-scoring.test.ts
// plus cross-script / transliterated variants.
const WHOLE_NAMES = [
  "Layla Hassan", "Oksana Melnyk", "Omar Hassan", "Katherine Reid", "Catherine Reid",
  "Thảo Nguyễn", "Hải Nguyễn", "Thao Nguyen", "Jon Smithe", "John Smith", "Árni Jónsson",
  "Aron Jonsson", "Priya Khan", "Priya Shah", "Priya Sha", "张伟", "王芳", "王磊", "محمد الأحمد",
  "فاطمة الزهراء", "محمد الاحمد", "김민준", "이서연", "Иван Петров", "Ольга Смирнова", "Olga Smirnova",
  "陈志强", "陳志強", "Chen Zhi Qiang", "Chen Zhiqiang", "राम शर्मा", "रीमा शर्मा", "タナカ タロウ",
  "たなか たろう", "Tanaka Taro", "Tanaka Tarou", "Ελένη Παπαδοπούλου", "Ελενη Παπαδοπουλου",
  "Νίκος Οικονόμου", "דָּוִד כהן", "דוד כהן", "İlker Yıldız", "Ilker Yildiz", "Łukasz Wójcik",
  "Lukasz Wojcik", "สมชาย ใจดี", "สมหญิง ใจดี", "李娜", "Li Na", "Lina", "Ivan Petrov", "Iwan Petrow",
  "Jon Smith", "J. Smith", "J Smith", "Smith John", "Cher", "Madonna", "", "  ", "Dr. John Smith Jr.",
  "Ivan Wu", "Iwan Wu", "Al B Wu", "Al C Wu", "Olga Xu", "Olha Xu", "Maria Fernanda de la Cruz Fernandez",
  "Christopher Montgomery", "Kristopher Montgomery", "Guðrún Sigurðardóttir", "Gudrun Sigurdardottir",
];

const COMPANIES = [
  null, null, null, "Acme", "acme", "Acme Corp", "Emerald Logistics", "Kyiv Imports", "Kontax Demo",
  "Mumbai Health", "北京科技", "Globex", "Initech", "Umbrella", "Stark Industries", "Wayne Enterprises",
  "Hooli", "Pied Piper", "Vandelay", "Wonka", "Soylent", "Cyberdyne", "Tyrell", "Aperture",
];

const DOMAINS = [
  "gmail.com", "yahoo.com", "outlook.com", "icloud.com", "protonmail.com", "acme-corp.test",
  "kontax-seed.test", "dupe-qa.test", "example.test", "globex.test", "initech.test", "hooli.test",
];

const BIRTHDAYS = [null, null, null, null, "1983-10-16", "1981-10-08", "1990-01-01", "1975-05-05"];

type Rng = () => number;
const pick = <T,>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length)]!;

const typo = (rng: Rng, value: string) => {
  if (value.length < 2) return value + "e";
  const i = Math.floor(rng() * value.length);
  const op = Math.floor(rng() * 4);
  const letters = "aeioustrnlhck";
  const ch = letters[Math.floor(rng() * letters.length)]!;
  if (op === 0) return value.slice(0, i) + value.slice(i + 1); // delete
  if (op === 1) return value.slice(0, i) + ch + value.slice(i); // insert
  if (op === 2) return value.slice(0, i) + ch + value.slice(i + 1); // substitute
  if (i + 1 < value.length) return value.slice(0, i) + value[i + 1] + value[i] + value.slice(i + 2); // swap
  return value;
};

const phoneFormats = (digits: string, rng: Rng) => {
  // digits: 10-digit national significant number
  const f = Math.floor(rng() * 5);
  if (f === 0) return `+44 ${digits.slice(0, 4)} ${digits.slice(4)}`;
  if (f === 1) return `0${digits}`;
  if (f === 2) return `44${digits}`;
  if (f === 3) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
};

const randomDigits = (rng: Rng) => {
  let digits = "7";
  for (let i = 0; i < 9; i += 1) digits += String(Math.floor(rng() * 10));
  return digits;
};

export type SyntheticOptions = {
  count: number;
  seed: number;
  /** Probability a contact is a mutated copy of an earlier one (duplicate). */
  duplicateRate?: number;
  /** Size of the phone-number pool (smaller = more shared phones). */
  phonePool?: number;
  /** Size of the email local-part pool (smaller = more shared emails). */
  emailPool?: number;
  /** Probability to draw a whole-name fixture instead of given+family. */
  wholeNameRate?: number;
  /** Extra given/family tokens to widen the name space (bigger books). */
  nameSpread?: number;
};

export const buildSyntheticContacts = (options: SyntheticOptions): MergeCandidateContact[] => {
  const rng = mulberry32(options.seed);
  const duplicateRate = options.duplicateRate ?? 0.25;
  const phonePoolSize = options.phonePool ?? Math.max(4, Math.floor(options.count / 3));
  const emailPoolSize = options.emailPool ?? Math.max(4, Math.floor(options.count / 3));
  const wholeNameRate = options.wholeNameRate ?? 0.2;
  const spread = options.nameSpread ?? 0;

  const phonePool = Array.from({ length: phonePoolSize }, () => randomDigits(rng));
  const emailPool = Array.from({ length: emailPoolSize }, (_, i) => `person${i}`);
  // Spread the family-name space for large books so name blocks stay realistic.
  const extraFamilies = Array.from({ length: spread }, (_, i) => `${pick(rng, FAMILY)}${String.fromCharCode(97 + (i % 26))}${Math.floor(i / 26)}`);
  const families = [...FAMILY, ...extraFamilies];
  const extraGiven = Array.from({ length: Math.floor(spread / 4) }, (_, i) => `${pick(rng, GIVEN).replace(/\W/g, "")}${String.fromCharCode(97 + (i % 26))}`);
  const givens = [...GIVEN, ...extraGiven];

  const contacts: MergeCandidateContact[] = [];
  const baseTime = Date.UTC(2026, 0, 1);

  for (let i = 0; i < options.count; i += 1) {
    const id = `c${String(i).padStart(5, "0")}`;
    const updatedAt = new Date(baseTime + Math.floor(rng() * 1e10));
    const source = contacts.length > 0 && rng() < duplicateRate ? pick(rng, contacts) : null;

    if (source) {
      // Mutated duplicate of an earlier contact.
      let fullName = source.fullName;
      const nameOp = Math.floor(rng() * 7);
      if (nameOp === 0) fullName = typo(rng, fullName);
      else if (nameOp === 1) fullName = typo(rng, typo(rng, fullName));
      else if (nameOp === 2) {
        const tokens = fullName.split(" ");
        tokens[0] = pick(rng, givens);
        fullName = tokens.join(" ");
      } else if (nameOp === 3) {
        const tokens = fullName.split(" ");
        tokens[0] = `${(tokens[0] ?? "x").charAt(0)}.`;
        fullName = tokens.join(" ");
      } else if (nameOp === 4) fullName = fullName.toUpperCase();
      else if (nameOp === 5) fullName = fullName.split(" ").reverse().join(" ");

      let email = source.email;
      const emailOp = Math.floor(rng() * 5);
      if (emailOp === 0) email = email ? email.toUpperCase() : null;
      else if (emailOp === 1) email = null;
      else if (emailOp === 2) email = `${pick(rng, emailPool)}@${pick(rng, DOMAINS)}`;
      else if (emailOp === 3 && email) email = ` ${email} `;

      let phone = source.phone;
      const phoneOp = Math.floor(rng() * 5);
      if (phoneOp === 0 && phone) {
        const digits = phone.replace(/\D/g, "").slice(-10);
        phone = digits.length === 10 ? phoneFormats(digits, rng) : phone;
      } else if (phoneOp === 1) phone = null;
      else if (phoneOp === 2) phone = phoneFormats(pick(rng, phonePool), rng);

      const companyOp = Math.floor(rng() * 5);
      const company =
        companyOp === 0 ? pick(rng, COMPANIES) : companyOp === 1 ? null : source.company;
      const birthday = rng() < 0.2 ? pick(rng, BIRTHDAYS) : (source.birthday ?? null);

      contacts.push({
        id,
        fullName,
        email,
        phone,
        company,
        birthday,
        importJobId: rng() < 0.3 ? "import-1" : null,
        updatedAt,
      });
      continue;
    }

    const fullName =
      rng() < wholeNameRate
        ? pick(rng, WHOLE_NAMES)
        : rng() < 0.1
          ? `${pick(rng, givens)} ${pick(rng, givens)} ${pick(rng, families)}`
          : `${pick(rng, givens)} ${pick(rng, families)}`;
    const email =
      rng() < 0.6
        ? `${rng() < 0.5 ? pick(rng, emailPool) : fullName.toLowerCase().replace(/[^a-z]+/g, ".") || "x"}@${pick(rng, DOMAINS)}`
        : null;
    const phone = rng() < 0.55 ? phoneFormats(pick(rng, phonePool), rng) : null;

    contacts.push({
      id,
      fullName,
      email,
      phone,
      company: pick(rng, COMPANIES),
      birthday: pick(rng, BIRTHDAYS),
      importJobId: rng() < 0.3 ? "import-1" : null,
      updatedAt,
    });
  }

  return contacts;
};

const SHORT_NAMES = [
  "Ivan Wu", "Iwan Wu", "Al B Wu", "Al C Wu", "Olga Xu", "Olha Xu", "Sven Ek", "Swen Ek", "Bo Yu",
  "Jo Li", "J Li", "Ana Li", "Ann Li", "Tom Ng", "Tim Ng", "Eva Oh", "Eve Oh", "Kai Lo", "Kay Lo",
];

const LONG_NAMES = [
  "Maria Fernanda de la Cruz Fernandez", "Maria Fernanda de la Cruz Fernández", "Johannes Van der Berg",
  "Alexandros Papadopoulos", "Aleksandros Papadopoulos", "Muhammad Abdullah Al-Rashid",
  "Mohammed Abdullah Al Rashid", "Christopher Montgomery", "Kristopher Montgomery",
  "Siobhan Nic Giolla Phadraig", "Bartholomew Fitzwilliam", "Anastasia Kuznetsova Ivanovna",
  "Chen Zhi Qiang Wellington", "Guðrún Sigurðardóttir", "Gudrun Sigurdardottir",
];

// Sound-alike given names more than 2 edits apart with the same surname: at
// one company + corporate domain they score phonetic-name (40) + email-domain
// (15) and are reachable ONLY through the phonetic key. Plus mixed-script names.
const PHONETIC_NAMES = [
  "Katherine Macdonald", "Kathryn Macdonald", "Mohammed Hussain", "Muhamad Hussain",
  "Philip Schmidt", "Phillippe Schmidt", "Jonathan Smith", "Jonothon Smyth", "Stephen Thompson",
  "Steven Thomsen", "Chen 志强", "Chen 志強", "Chen Zhiqiang", "Tanaka タロウ", "Tanaka Taro",
  // Half-romanized: romanized-fuzzy (40) + phonetic-name on the Latin token
  // (25) = 65 with no company or domain in common.
  "Tanaka タロ", "Kim 민준", "Kim 민주",
];

/**
 * Fuzzy-name stress: many 1–2-edit variants of a few short (≤ 10 chars) or
 * long (≥ 9 chars) names — or sound-alike spellings — clustered in a few
 * companies / one corporate email domain, mostly without shared identifiers,
 * so pairs can ONLY be found via the scoped fuzzy blocking keys (deletion
 * neighbourhood / segments) or the phonetic key.
 */
export const buildFuzzyGroupContacts = (
  kind: "short" | "long" | "phonetic",
  count: number,
  seed: number,
): MergeCandidateContact[] => {
  const rng = mulberry32(seed);
  const names = kind === "short" ? SHORT_NAMES : kind === "long" ? LONG_NAMES : PHONETIC_NAMES;
  const companies = kind === "phonetic" ? ["Acme", "Acme", "Globex", null] : ["Acme", "Globex", null];
  const emailRate = kind === "phonetic" ? 0.9 : 0.5;
  const baseTime = Date.UTC(2026, 0, 1);
  return Array.from({ length: count }, (_, i) => {
    let fullName = pick(rng, names);
    const edits = kind === "phonetic" ? 0 : Math.floor(rng() * 3); // 0, 1 or 2 typos
    for (let e = 0; e < edits; e += 1) fullName = typo(rng, fullName);
    const company = pick(rng, companies);
    const email =
      rng() < emailRate ? `${fullName.toLowerCase().replace(/[^a-z]+/g, "")}${i}@${rng() < 0.7 ? "acme-corp.test" : "gmail.com"}` : null;
    return {
      id: `${kind}${String(i).padStart(4, "0")}`,
      fullName,
      email,
      phone: rng() < 0.05 ? "+44 7700 900111" : null,
      company,
      birthday: rng() < 0.15 ? pick(rng, BIRTHDAYS) : null,
      importJobId: rng() < 0.3 ? "import-1" : null,
      updatedAt: new Date(baseTime + i * 1000),
    };
  });
};

/**
 * A benchmark-shaped book: mostly distinct people with a realistic number of
 * duplicates, shared corporate domains, and a few big companies.
 */
export const buildBenchmarkContacts = (count: number, seed = 49_009) =>
  buildSyntheticContacts({
    count,
    seed,
    duplicateRate: 0.08,
    phonePool: count,
    emailPool: count,
    wholeNameRate: 0.05,
    nameSpread: Math.max(0, Math.floor(count / 4)),
  });

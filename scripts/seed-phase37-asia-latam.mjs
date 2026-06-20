import { getArg, makeLocalIntlPair, runPhoneSeed } from "./seed-phase37-phone-helpers.mjs";

const targetEmail = getArg("user", "li@linoormohamed.com");
const seedLabel = "phase37-asia-latam";
const source = "phase37-asia-latam-seed";

const pairs = [
  makeLocalIntlPair({
    country: "IN",
    fullName: "Priya Shah",
    firstName: "Priya",
    lastName: "Shah",
    localPhone: "08123 456789",
    intlPhone: "+91 81234 56789",
    company: "Mumbai Health",
    jobTitle: "Support Lead",
    matchLabel: "Same phone in local and +91 format",
  }),
  makeLocalIntlPair({
    country: "CN",
    fullName: "Li Wei",
    firstName: "Li",
    lastName: "Wei",
    localPhone: "131 2345 6789",
    intlPhone: "+86 131 2345 6789",
    company: "Shanghai Systems",
    jobTitle: "Account Lead",
    matchLabel: "Same phone in local and +86 format",
  }),
  makeLocalIntlPair({
    country: "JP",
    fullName: "Yuki Sato",
    firstName: "Yuki",
    lastName: "Sato",
    localPhone: "090 1234 5678",
    intlPhone: "+81 90 1234 5678",
    company: "Tokyo Advisory",
    jobTitle: "Client Lead",
    matchLabel: "Same phone in local and +81 format",
  }),
  makeLocalIntlPair({
    country: "KR",
    fullName: "Min Seo",
    firstName: "Min",
    lastName: "Seo",
    localPhone: "010 2000 0000",
    intlPhone: "+82 10 2000 0000",
    company: "Seoul Group",
    jobTitle: "Ops Lead",
    matchLabel: "Same phone in local and +82 format",
  }),
  makeLocalIntlPair({
    country: "BR",
    fullName: "Ana Silva",
    firstName: "Ana",
    lastName: "Silva",
    localPhone: "11 96123 4567",
    intlPhone: "+55 11 96123 4567",
    company: "Sao Paulo Works",
    jobTitle: "Sales Lead",
    matchLabel: "Same phone in local and +55 format",
  }),
  makeLocalIntlPair({
    country: "MX",
    fullName: "Diego Ramos",
    firstName: "Diego",
    lastName: "Ramos",
    localPhone: "222 123 4567",
    intlPhone: "+52 222 123 4567",
    company: "Puebla Partners",
    jobTitle: "Customer Lead",
    matchLabel: "Same phone in local and +52 format",
  }),
];

await runPhoneSeed({
  targetEmail,
  seedLabel,
  source,
  pairs,
});

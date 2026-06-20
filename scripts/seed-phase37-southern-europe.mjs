import { getArg, makeLocalIntlPair, runPhoneSeed } from "./seed-phase37-phone-helpers.mjs";

const targetEmail = getArg("user", process.env.SEED_USER_EMAIL ?? "li@linoormohamed.com");

const pairs = [
  makeLocalIntlPair({
    country: "ES",
    fullName: "Lucia Garcia",
    firstName: "Lucia",
    lastName: "Garcia",
    localPhone: "612 34 56 78",
    intlPhone: "+34 612 34 56 78",
    company: "Madrid Health",
    jobTitle: "Support Lead",
    matchLabel: "Same phone in local and +34 format",
  }),
  makeLocalIntlPair({
    country: "PT",
    fullName: "Tiago Silva",
    firstName: "Tiago",
    lastName: "Silva",
    localPhone: "912 345 678",
    intlPhone: "+351 912 345 678",
    company: "Lisbon Advisory",
    jobTitle: "Account Lead",
    matchLabel: "Same phone in local and +351 format",
  }),
  makeLocalIntlPair({
    country: "IT",
    fullName: "Giulia Rossi",
    firstName: "Giulia",
    lastName: "Rossi",
    localPhone: "312 345 6789",
    intlPhone: "+39 312 345 6789",
    company: "Milan Retail",
    jobTitle: "Sales Lead",
    matchLabel: "Same phone in local and +39 format",
  }),
  makeLocalIntlPair({
    country: "GR",
    fullName: "Nikos Papadopoulos",
    firstName: "Nikos",
    lastName: "Papadopoulos",
    localPhone: "691 234 5678",
    intlPhone: "+30 691 234 5678",
    company: "Athens Systems",
    jobTitle: "Ops Lead",
    matchLabel: "Same phone in local and +30 format",
  }),
  makeLocalIntlPair({
    country: "MT",
    fullName: "Mia Borg",
    firstName: "Mia",
    lastName: "Borg",
    localPhone: "9696 1234",
    intlPhone: "+356 9696 1234",
    company: "Valletta Group",
    jobTitle: "Client Lead",
    matchLabel: "Same phone in local and +356 format",
  }),
  makeLocalIntlPair({
    country: "CY",
    fullName: "Eleni Georgiou",
    firstName: "Eleni",
    lastName: "Georgiou",
    localPhone: "96 123456",
    intlPhone: "+357 96 123456",
    company: "Nicosia Partners",
    jobTitle: "Customer Lead",
    matchLabel: "Same phone in local and +357 format",
  }),
];

await runPhoneSeed({
  targetEmail,
  seedLabel: "phase37-southern-europe",
  source: "phase37-southern-europe-seed",
  pairs,
});

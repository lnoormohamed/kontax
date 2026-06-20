import { getArg, makeLocalIntlPair, runPhoneSeed } from "./seed-phase37-phone-helpers.mjs";

const targetEmail = getArg("user", process.env.SEED_USER_EMAIL ?? "li@linoormohamed.com");

const pairs = [
  makeLocalIntlPair({
    country: "PL",
    fullName: "Anna Kowalska",
    firstName: "Anna",
    lastName: "Kowalska",
    localPhone: "512 345 678",
    intlPhone: "+48 512 345 678",
    company: "Warsaw Health",
    jobTitle: "Support Lead",
    matchLabel: "Same phone in local and +48 format",
  }),
  makeLocalIntlPair({
    country: "CZ",
    fullName: "Jan Novak",
    firstName: "Jan",
    lastName: "Novak",
    localPhone: "601 123 456",
    intlPhone: "+420 601 123 456",
    company: "Prague Systems",
    jobTitle: "Account Lead",
    matchLabel: "Same phone in local and +420 format",
  }),
  makeLocalIntlPair({
    country: "SK",
    fullName: "Marek Horvat",
    firstName: "Marek",
    lastName: "Horvat",
    localPhone: "0912 123 456",
    intlPhone: "+421 912 123 456",
    company: "Bratislava Group",
    jobTitle: "Sales Lead",
    matchLabel: "Same phone in local and +421 format",
  }),
  makeLocalIntlPair({
    country: "RO",
    fullName: "Ioana Popescu",
    firstName: "Ioana",
    lastName: "Popescu",
    localPhone: "0712 034 567",
    intlPhone: "+40 712 034 567",
    company: "Bucharest Advisory",
    jobTitle: "Client Lead",
    matchLabel: "Same phone in local and +40 format",
  }),
  makeLocalIntlPair({
    country: "UA",
    fullName: "Oksana Melnyk",
    firstName: "Oksana",
    lastName: "Melnyk",
    localPhone: "050 123 4567",
    intlPhone: "+380 50 123 4567",
    company: "Kyiv Works",
    jobTitle: "Ops Lead",
    matchLabel: "Same phone in local and +380 format",
  }),
  makeLocalIntlPair({
    country: "HR",
    fullName: "Luka Kovac",
    firstName: "Luka",
    lastName: "Kovac",
    localPhone: "092 123 4567",
    intlPhone: "+385 92 123 4567",
    company: "Zagreb Partners",
    jobTitle: "Customer Lead",
    matchLabel: "Same phone in local and +385 format",
  }),
];

await runPhoneSeed({
  targetEmail,
  seedLabel: "phase37-central-eastern-europe",
  source: "phase37-central-eastern-europe-seed",
  pairs,
});

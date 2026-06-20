import { getArg, makeLocalIntlPair, runPhoneSeed } from "./seed-phase37-phone-helpers.mjs";

const targetEmail = getArg("user", process.env.SEED_USER_EMAIL ?? "li@linoormohamed.com");

const pairs = [
  makeLocalIntlPair({
    country: "TR",
    fullName: "Ayse Demir",
    firstName: "Ayse",
    lastName: "Demir",
    localPhone: "0501 234 5678",
    intlPhone: "+90 501 234 5678",
    company: "Istanbul Health",
    jobTitle: "Support Lead",
    matchLabel: "Same phone in local and +90 format",
  }),
  makeLocalIntlPair({
    country: "IL",
    fullName: "Noa Cohen",
    firstName: "Noa",
    lastName: "Cohen",
    localPhone: "050 234 5678",
    intlPhone: "+972 50 234 5678",
    company: "Tel Aviv Systems",
    jobTitle: "Account Lead",
    matchLabel: "Same phone in local and +972 format",
  }),
  makeLocalIntlPair({
    country: "SA",
    fullName: "Faisal Al Saud",
    firstName: "Faisal",
    lastName: "Al Saud",
    localPhone: "051 234 5678",
    intlPhone: "+966 51 234 5678",
    company: "Riyadh Group",
    jobTitle: "Sales Lead",
    matchLabel: "Same phone in local and +966 format",
  }),
  makeLocalIntlPair({
    country: "AE",
    fullName: "Layla Hassan",
    firstName: "Layla",
    lastName: "Hassan",
    localPhone: "050 123 4567",
    intlPhone: "+971 50 123 4567",
    company: "Dubai Advisory",
    jobTitle: "Client Lead",
    matchLabel: "Same phone in local and +971 format",
  }),
  makeLocalIntlPair({
    country: "EG",
    fullName: "Omar Nasser",
    firstName: "Omar",
    lastName: "Nasser",
    localPhone: "0100 123 4567",
    intlPhone: "+20 100 123 4567",
    company: "Cairo Works",
    jobTitle: "Ops Lead",
    matchLabel: "Same phone in local and +20 format",
  }),
  makeLocalIntlPair({
    country: "MA",
    fullName: "Sara El Idrissi",
    firstName: "Sara",
    lastName: "El Idrissi",
    localPhone: "0650 123 456",
    intlPhone: "+212 650 123 456",
    company: "Casablanca Partners",
    jobTitle: "Customer Lead",
    matchLabel: "Same phone in local and +212 format",
  }),
];

await runPhoneSeed({
  targetEmail,
  seedLabel: "phase37-mena",
  source: "phase37-mena-seed",
  pairs,
});

import { getArg, makeLocalIntlPair, runPhoneSeed } from "./seed-phase37-phone-helpers.mjs";

const targetEmail = getArg("user", process.env.SEED_USER_EMAIL ?? "li@linoormohamed.com");

const pairs = [
  makeLocalIntlPair({
    country: "NG",
    fullName: "Ngozi Okafor",
    firstName: "Ngozi",
    lastName: "Okafor",
    localPhone: "0802 123 4567",
    intlPhone: "+234 802 123 4567",
    company: "Lagos Health",
    jobTitle: "Support Lead",
    matchLabel: "Same phone in local and +234 format",
  }),
  makeLocalIntlPair({
    country: "GH",
    fullName: "Kwame Mensah",
    firstName: "Kwame",
    lastName: "Mensah",
    localPhone: "023 123 4567",
    intlPhone: "+233 23 123 4567",
    company: "Accra Systems",
    jobTitle: "Account Lead",
    matchLabel: "Same phone in local and +233 format",
  }),
  makeLocalIntlPair({
    country: "KE",
    fullName: "Amina Wanjiku",
    firstName: "Amina",
    lastName: "Wanjiku",
    localPhone: "0712 123456",
    intlPhone: "+254 712 123456",
    company: "Nairobi Group",
    jobTitle: "Sales Lead",
    matchLabel: "Same phone in local and +254 format",
  }),
  makeLocalIntlPair({
    country: "ZA",
    fullName: "Sipho Dlamini",
    firstName: "Sipho",
    lastName: "Dlamini",
    localPhone: "071 123 4567",
    intlPhone: "+27 71 123 4567",
    company: "Johannesburg Advisory",
    jobTitle: "Client Lead",
    matchLabel: "Same phone in local and +27 format",
  }),
  makeLocalIntlPair({
    country: "TZ",
    fullName: "Neema Mushi",
    firstName: "Neema",
    lastName: "Mushi",
    localPhone: "0621 234 567",
    intlPhone: "+255 621 234 567",
    company: "Dar Works",
    jobTitle: "Ops Lead",
    matchLabel: "Same phone in local and +255 format",
  }),
  makeLocalIntlPair({
    country: "UG",
    fullName: "David Okello",
    firstName: "David",
    lastName: "Okello",
    localPhone: "0712 345678",
    intlPhone: "+256 712 345678",
    company: "Kampala Partners",
    jobTitle: "Customer Lead",
    matchLabel: "Same phone in local and +256 format",
  }),
];

await runPhoneSeed({
  targetEmail,
  seedLabel: "phase37-sub-saharan-africa",
  source: "phase37-sub-saharan-africa-seed",
  pairs,
});

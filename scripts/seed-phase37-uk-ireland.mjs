import { getArg, makeLocalIntlPair, runPhoneSeed } from "./seed-phase37-phone-helpers.mjs";

const targetEmail = getArg("user", process.env.SEED_USER_EMAIL ?? "li@linoormohamed.com");

const pairs = [
  makeLocalIntlPair({
    country: "GB",
    fullName: "Alisha Noormohamed",
    firstName: "Alisha",
    lastName: "Noormohamed",
    localPhone: "07700 900111",
    intlPhone: "+44 7700 900111",
    company: "Orbit Health",
    jobTitle: "Partnerships Lead",
    matchLabel: "Same phone in local and +44 format",
  }),
  makeLocalIntlPair({
    country: "GB",
    fullName: "Eastbourne Borough Council",
    firstName: "Eastbourne",
    lastName: "Council",
    localPhone: "01323 410051",
    intlPhone: "+44 1323 410051",
    company: "Eastbourne Borough Council",
    jobTitle: "Main Office",
    matchLabel: "Same phone in local and +44 format",
    score: 236,
  }),
  makeLocalIntlPair({
    country: "IE",
    fullName: "Aoife Brennan",
    firstName: "Aoife",
    lastName: "Brennan",
    localPhone: "085 012 3456",
    intlPhone: "+353 85 012 3456",
    company: "Dublin Care",
    jobTitle: "Client Success",
    matchLabel: "Same phone in local and +353 format",
  }),
  makeLocalIntlPair({
    country: "IE",
    fullName: "Seamus Doyle",
    firstName: "Seamus",
    lastName: "Doyle",
    localPhone: "022 12345",
    intlPhone: "+353 22 12345",
    company: "Munster Advisory",
    jobTitle: "Office Lead",
    matchLabel: "Same phone in local and +353 format",
    score: 232,
  }),
];

await runPhoneSeed({
  targetEmail,
  seedLabel: "phase37-uk-ireland",
  source: "phase37-uk-ireland-seed",
  pairs,
});

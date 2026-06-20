import { getArg, makeIntlSpacingPair, makeLocalIntlPair, runPhoneSeed } from "./seed-phase37-phone-helpers.mjs";

const targetEmail = getArg("user", process.env.SEED_USER_EMAIL ?? "li@linoormohamed.com");

const pairs = [
  makeLocalIntlPair({
    country: "US",
    fullName: "Mason Brooks",
    firstName: "Mason",
    lastName: "Brooks",
    localPhone: "201 555 0123",
    intlPhone: "+1 201 555 0123",
    company: "Hudson Systems",
    jobTitle: "Support Lead",
    matchLabel: "Same phone in local and +1 format",
  }),
  makeLocalIntlPair({
    country: "CA",
    fullName: "Sophie Tremblay",
    firstName: "Sophie",
    lastName: "Tremblay",
    localPhone: "506 234 5678",
    intlPhone: "+1 506 234 5678",
    company: "Maple Ops",
    jobTitle: "Account Manager",
    matchLabel: "Same phone in local and +1 format",
  }),
  makeIntlSpacingPair({ country: "AG", fullName: "Janelle Joseph", firstName: "Janelle", lastName: "Joseph", compactPhone: "+12684641234", spacedPhone: "+1 268 464 1234", company: "Antigua Trade", jobTitle: "Sales Lead" }),
  makeIntlSpacingPair({ country: "AI", fullName: "Kemar Hodge", firstName: "Kemar", lastName: "Hodge", compactPhone: "+12642351234", spacedPhone: "+1 264 235 1234", company: "Anguilla Services", jobTitle: "Branch Lead" }),
  makeIntlSpacingPair({ country: "AS", fullName: "Lia Taito", firstName: "Lia", lastName: "Taito", compactPhone: "+16847331234", spacedPhone: "+1 684 733 1234", company: "Pago Retail", jobTitle: "Store Lead" }),
  makeIntlSpacingPair({ country: "BB", fullName: "Andre Clarke", firstName: "Andre", lastName: "Clarke", compactPhone: "+12462501234", spacedPhone: "+1 246 250 1234", company: "Barbados Finance", jobTitle: "Client Lead" }),
  makeIntlSpacingPair({ country: "BM", fullName: "Nia Bean", firstName: "Nia", lastName: "Bean", compactPhone: "+14413701234", spacedPhone: "+1 441 370 1234", company: "Hamilton Advisors", jobTitle: "Operations Lead" }),
  makeIntlSpacingPair({ country: "BS", fullName: "Micah Rolle", firstName: "Micah", lastName: "Rolle", compactPhone: "+12423591234", spacedPhone: "+1 242 359 1234", company: "Nassau Holdings", jobTitle: "Customer Lead" }),
  makeIntlSpacingPair({ country: "DM", fullName: "Asha Baptiste", firstName: "Asha", lastName: "Baptiste", compactPhone: "+17672251234", spacedPhone: "+1 767 225 1234", company: "Roseau Group", jobTitle: "Success Lead" }),
  makeIntlSpacingPair({ country: "DO", fullName: "Rafael Cruz", firstName: "Rafael", lastName: "Cruz", compactPhone: "+18092345678", spacedPhone: "+1 809 234 5678", company: "Santo Domingo Trade", jobTitle: "Ops Lead" }),
  makeIntlSpacingPair({ country: "GD", fullName: "Tia Noel", firstName: "Tia", lastName: "Noel", compactPhone: "+14734031234", spacedPhone: "+1 473 403 1234", company: "Grenada Foods", jobTitle: "Buyer" }),
  makeIntlSpacingPair({ country: "GU", fullName: "Elena Santos", firstName: "Elena", lastName: "Santos", compactPhone: "+16713001234", spacedPhone: "+1 671 300 1234", company: "Guam Logistics", jobTitle: "Sales Lead" }),
  makeIntlSpacingPair({ country: "JM", fullName: "Devon Reid", firstName: "Devon", lastName: "Reid", compactPhone: "+18762101234", spacedPhone: "+1 876 210 1234", company: "Kingston Works", jobTitle: "Branch Lead" }),
  makeIntlSpacingPair({ country: "KN", fullName: "Maya Liburd", firstName: "Maya", lastName: "Liburd", compactPhone: "+18697652917", spacedPhone: "+1 869 765 2917", company: "Basseterre Group", jobTitle: "Regional Lead" }),
  makeIntlSpacingPair({ country: "KY", fullName: "Owen Ebanks", firstName: "Owen", lastName: "Ebanks", compactPhone: "+13453231234", spacedPhone: "+1 345 323 1234", company: "Cayman Legal", jobTitle: "Client Success" }),
  makeIntlSpacingPair({ country: "LC", fullName: "Nadia Felix", firstName: "Nadia", lastName: "Felix", compactPhone: "+17582845678", spacedPhone: "+1 758 284 5678", company: "Castries Supply", jobTitle: "Support Lead" }),
  makeIntlSpacingPair({ country: "MP", fullName: "Tino Guerrero", firstName: "Tino", lastName: "Guerrero", compactPhone: "+16702345678", spacedPhone: "+1 670 234 5678", company: "Saipan Retail", jobTitle: "Store Lead" }),
  makeIntlSpacingPair({ country: "MS", fullName: "Kira Allen", firstName: "Kira", lastName: "Allen", compactPhone: "+16644923456", spacedPhone: "+1 664 492 3456", company: "Montserrat Services", jobTitle: "Office Lead" }),
  makeIntlSpacingPair({ country: "PR", fullName: "Lucia Rivera", firstName: "Lucia", lastName: "Rivera", compactPhone: "+17872345678", spacedPhone: "+1 787 234 5678", company: "San Juan Partners", jobTitle: "Account Lead" }),
  makeIntlSpacingPair({ country: "SX", fullName: "Jordan Richardson", firstName: "Jordan", lastName: "Richardson", compactPhone: "+17215205678", spacedPhone: "+1 721 520 5678", company: "Philipsburg Travel", jobTitle: "Sales Lead" }),
  makeIntlSpacingPair({ country: "TC", fullName: "Ari Forbes", firstName: "Ari", lastName: "Forbes", compactPhone: "+16492311234", spacedPhone: "+1 649 231 1234", company: "Turks Commerce", jobTitle: "Operations Lead" }),
  makeIntlSpacingPair({ country: "TT", fullName: "Priya Khan", firstName: "Priya", lastName: "Khan", compactPhone: "+18682911234", spacedPhone: "+1 868 291 1234", company: "Port of Spain Group", jobTitle: "Finance Lead" }),
  makeIntlSpacingPair({ country: "VC", fullName: "Milan Lewis", firstName: "Milan", lastName: "Lewis", compactPhone: "+17844301234", spacedPhone: "+1 784 430 1234", company: "Kingstown Imports", jobTitle: "Customer Lead" }),
  makeIntlSpacingPair({ country: "VG", fullName: "Cara Smith", firstName: "Cara", lastName: "Smith", compactPhone: "+12843001234", spacedPhone: "+1 284 300 1234", company: "Tortola Advisory", jobTitle: "Success Lead" }),
  makeIntlSpacingPair({ country: "VI", fullName: "Noel Francis", firstName: "Noel", lastName: "Francis", compactPhone: "+13406421234", spacedPhone: "+1 340 642 1234", company: "Charlotte Amalie Works", jobTitle: "Service Lead" }),
];

await runPhoneSeed({
  targetEmail,
  seedLabel: "phase37-nanp",
  source: "phase37-nanp-seed",
  pairs,
});

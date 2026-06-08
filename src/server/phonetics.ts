import { normalizePhoneticValue, toPhoneticValue } from "~/lib/phonetics";

type PhoneticFieldInput = {
  firstName?: string | null;
  lastName?: string | null;
  company?: string | null;
  phoneticFirstName?: string | null;
  phoneticLastName?: string | null;
  phoneticCompany?: string | null;
};

export const applyAutoFilledPhoneticFields = (
  input: PhoneticFieldInput,
  autoFillEnabled: boolean,
) => {
  const phoneticFirstName = normalizePhoneticValue(input.phoneticFirstName);
  const phoneticLastName = normalizePhoneticValue(input.phoneticLastName);
  const phoneticCompany = normalizePhoneticValue(input.phoneticCompany);

  if (!autoFillEnabled) {
    return {
      phoneticFirstName,
      phoneticLastName,
      phoneticCompany,
    };
  }

  return {
    phoneticFirstName: phoneticFirstName ?? toPhoneticValue(input.firstName),
    phoneticLastName: phoneticLastName ?? toPhoneticValue(input.lastName),
    phoneticCompany: phoneticCompany ?? toPhoneticValue(input.company),
  };
};

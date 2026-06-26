type StoredDateValue = string | null | undefined;

export type ContactDateEventInput = {
  birthday?: StoredDateValue;
  significantDates?: Array<{ label?: string | null; date?: StoredDateValue }> | null;
};

export type UpcomingContactDate = {
  key: string;
  label: string;
  value: string;
  daysUntil: number;
};

export function parseStoredAnnualDate(
  value: string,
): { month: number; day: number } | null {
  const full = /^(\d{4})-?(\d{2})-?(\d{2})$/.exec(value);
  if (full) {
    return { month: Number(full[2]), day: Number(full[3]) };
  }

  const yearless = /^--(\d{2})-?(\d{2})$/.exec(value);
  if (yearless) {
    return { month: Number(yearless[1]), day: Number(yearless[2]) };
  }

  return null;
}

export function daysUntilAnnualDate(
  month: number,
  day: number,
  now = new Date(),
): number {
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const year = now.getUTCFullYear();
  let next = Date.UTC(year, month - 1, day);
  if (next < todayUtc) {
    next = Date.UTC(year + 1, month - 1, day);
  }
  return Math.round((next - todayUtc) / 86_400_000);
}

export function buildUpcomingContactDates(
  input: ContactDateEventInput,
  options?: { now?: Date; limit?: number },
): UpcomingContactDate[] {
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 3;
  const dates: UpcomingContactDate[] = [];

  const pushIfValid = (key: string, label: string, value: string) => {
    const parsed = parseStoredAnnualDate(value);
    if (!parsed) return;
    dates.push({
      key,
      label,
      value,
      daysUntil: daysUntilAnnualDate(parsed.month, parsed.day, now),
    });
  };

  if (input.birthday) {
    pushIfValid("birthday", "Birthday", input.birthday);
  }

  (input.significantDates ?? []).forEach((entry, index) => {
    const date = entry?.date?.trim();
    if (!date) return;
    const label = entry.label?.trim() || "Significant date";
    pushIfValid(`significant-${index}`, label, date);
  });

  return dates
    .sort((left, right) => {
      if (left.daysUntil !== right.daysUntil) {
        return left.daysUntil - right.daysUntil;
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, limit);
}

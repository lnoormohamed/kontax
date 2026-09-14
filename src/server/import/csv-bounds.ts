// P48-11 item 4: shared bounds for CSV import bodies. A CSV import runs a
// classifier + dedupe pass over every row before billing is checked, so an
// unbounded body is both a memory and a CPU amplifier. These caps are applied
// at the API/action boundary (not inside parseCsvContacts) so the parser
// itself stays untouched — see roadmap/build-phase/p48-11-import-export-hardening.md.

/** Matches the `.max()` bound on the `csvText` (and CSV file) request field. */
export const MAX_CSV_TEXT_LENGTH = 10_000_000; // ~10 MB of CSV text

/** Row cap (header + data rows) enforced before the full parse runs. */
export const MAX_CSV_ROWS = 50_000;

/**
 * Cheap upper bound on the number of CSV rows (header + data) in `csvText`,
 * counting line breaks rather than running the full quote-aware row parser.
 * A quoted field containing an embedded newline makes this count *higher*
 * than the real row count, never lower — so it's safe to use as a fast
 * pre-parse gate: passing this check never lets an over-cap file through.
 */
export function approximateCsvRowCount(csvText: string): number {
  let rows = 1;
  for (let i = 0; i < csvText.length; i += 1) {
    if (csvText.charCodeAt(i) === 10 /* \n */) rows += 1;
  }
  return rows;
}

export const csvRowCountExceedsCap = (csvText: string, max: number = MAX_CSV_ROWS): boolean =>
  approximateCsvRowCount(csvText) - 1 > max; // -1: header row doesn't count as data

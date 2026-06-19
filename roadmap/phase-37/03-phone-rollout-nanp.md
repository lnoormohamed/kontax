# P37-03 — Phase 2 rollout: NANP

**Status:** Ready after `P37-01`.
Shared ruleset rollout for the North American Numbering Plan.

---

## 1. Objective

Support the NANP as one coherent family so local and international forms normalize
reliably without relying on last-10-digit heuristics as merge truth.

---

## 2. Countries and territories in scope

- United States
- Canada
- Bahamas
- Barbados
- Antigua and Barbuda
- Dominica
- Dominican Republic
- Grenada
- Jamaica
- Saint Kitts and Nevis
- Saint Lucia
- Saint Vincent and the Grenadines
- Trinidad and Tobago
- Belize
- Bermuda
- Cayman Islands
- Turks and Caicos Islands
- British Virgin Islands
- US Virgin Islands
- Puerto Rico
- Anguilla
- Montserrat
- Sint Maarten
- Guam
- Northern Mariana Islands
- American Samoa

---

## 3. Rules to support

- calling code `+1`
- 10-digit local national forms
- 11-digit `1xxxxxxxxxx` forms
- common formatted forms:
  - `(415) 555-2671`
  - `415-555-2671`
  - `1 415 555 2671`
  - `+1 415 555 2671`
- shared NANP display formatting
- keep type inference conservative unless there is a trustworthy source

---

## 4. Technical scope

Files expected to change:
- [src/lib/phone-country-rules.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-country-rules.ts)
- [src/lib/phone-normalization.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/phone-normalization.ts)
- [src/lib/duplicate-signals.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/lib/duplicate-signals.ts)
- [src/server/contact-merge.ts](/Users/lnoormohamed/ChatGPT/Kontax/src/server/contact-merge.ts)

---

## 5. Test cases

Required:
- `4155552671` == `+1 415 555 2671`
- `(415) 555-2671` == `+1 415 555 2671`
- `14155552671` == `+1 415 555 2671`
- `+1 647 555 0100` == local Canadian form
- two different NANP numbers do not collapse incorrectly

Merge-specific:
- duplicate cards should not show two NANP formats as separate kept numbers
- exact canonical NANP match should promote strong duplicate confidence

---

## 6. Acceptance criteria

This ticket is done when:
- NANP local and international forms collapse consistently
- merge logic no longer depends on trailing-10 alone for canonical identity
- US and Canada seeded examples are validated on staging


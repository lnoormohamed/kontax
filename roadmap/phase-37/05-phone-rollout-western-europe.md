# P37-05 — Phase 4 rollout: Western Europe

**Status:** Ready after `P37-01`.
Large business-contact phase covering major Western European markets.

---

## 1. Countries in scope

- Germany
- France
- Netherlands
- Belgium
- Luxembourg
- Switzerland
- Austria
- Monaco
- Liechtenstein

---

## 2. Objective

Bring consistent canonicalization and display behavior to Western Europe, where local
domestic forms, mobile prefixes, and landline presentation vary significantly.

---

## 3. Rules to support

- local-to-international canonicalization by country
- national length metadata
- display formatting preferences
- mobile vs landline prefix hints where stable enough
- conservative fallback where certainty is weak

Priority subcases:
- Germany local mobile vs `+49`
- France `06/07` vs `+33`
- Netherlands mobile local vs `+31`
- Belgium and Switzerland display normalization

---

## 4. Test cases

- German local mobile == `+49` mobile
- French local `06/07` == `+33 6/7`
- Dutch local mobile == `+31` mobile
- visually similar but distinct Western European numbers do not collapse

---

## 5. Acceptance criteria

This ticket is done when:
- seeded DE/FR/NL cases normalize correctly
- merge review does not show separate kept values for same-number format variants
- no obvious false same-number collapses appear in staging QA


# P37-08 — Phase 7 rollout: Central Europe, Eastern Europe, and Balkans

**Status:** Ready after `P37-01`.
Broad regional coverage phase focused on consistent metadata and safe canonicalization.

---

## 1. Countries in scope

- Poland
- Czechia
- Slovakia
- Hungary
- Slovenia
- Croatia
- Bosnia and Herzegovina
- Serbia
- Montenegro
- Kosovo
- North Macedonia
- Albania
- Romania
- Bulgaria
- Moldova
- Ukraine
- Belarus
- Russia

---

## 2. Objective

Cover the larger Central/Eastern European and Balkan imports without overfitting the
normalizer to brittle prefix assumptions.

---

## 3. Rules to support

- country-specific national lengths
- local-to-international canonicalization
- display grouping preferences
- mobile/fixed prefix hints only where stable and documented

---

## 4. Test cases

- local mobile == international mobile in representative countries
- local landline == international landline in representative countries
- nearby-country numbers do not collide on fallback heuristics

---

## 5. Acceptance criteria

This ticket is done when:
- at least six representative country examples are validated on staging
- no obvious same-number formatting bugs remain in the region’s seeded data


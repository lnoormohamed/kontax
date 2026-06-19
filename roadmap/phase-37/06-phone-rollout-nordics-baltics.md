# P37-06 — Phase 5 rollout: Nordics and Baltics

**Status:** Ready after `P37-01`.
Focused regional phase for relatively compact but varied numbering plans.

---

## 1. Countries in scope

- Denmark
- Sweden
- Norway
- Finland
- Iceland
- Estonia
- Latvia
- Lithuania

---

## 2. Objective

Extend European coverage with metadata-driven formatting and canonicalization while
keeping type inference conservative.

---

## 3. Rules to support

- national lengths by country
- display formatting per country
- mobile / landline hints only where stable enough
- same-number collapse across plain, spaced, and international forms

---

## 4. Test cases

- local Nordic mobile == international mobile
- local Baltic mobile == international mobile
- different numbers with similar endings do not collapse
- spaced and unspaced forms normalize to the same canonical value

---

## 5. Acceptance criteria

This ticket is done when:
- Nordic and Baltic seeded examples behave consistently
- no region-specific local/international format variants survive merge as duplicates


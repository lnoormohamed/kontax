# P37-09 — Phase 8 rollout: Middle East and North Africa

**Status:** Ready after `P37-01`.
Metadata-heavy phase due to wide variation in local dialing patterns and prefix usage.

---

## 1. Countries in scope

- Turkey
- Israel
- Palestine
- Jordan
- Lebanon
- Syria
- Iraq
- Iran
- Saudi Arabia
- United Arab Emirates
- Qatar
- Bahrain
- Kuwait
- Oman
- Yemen
- Egypt
- Libya
- Tunisia
- Algeria
- Morocco
- Western Sahara
- Mauritania

---

## 2. Objective

Provide stable local/international canonicalization for MENA numbers while keeping
type inference conservative where numbering rules are less predictable.

---

## 3. Rules to support

- local trunk handling where used
- national lengths by country
- mobile/fixed prefix hints where stable
- display formatting by country
- ambiguity-safe fallback behavior

---

## 4. Test cases

- UAE local mobile == `+971` mobile
- Saudi local mobile == `+966` mobile
- Egypt local mobile == `+20` mobile
- MENA local landline examples normalize correctly in representative countries

---

## 5. Acceptance criteria

This ticket is done when:
- seeded MENA examples stop showing obvious same-number duplication bugs
- canonical local/international collapse works in the representative test set


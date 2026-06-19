# P37-12 — Cross-phase QA harness: seeded examples, duplicate refresh, and regression coverage

**Status:** Must run alongside every country-phase rollout.
This ticket is not a one-off implementation; it is the QA system for all P37 phases.

---

## 1. Objective

Create a repeatable QA harness so each phone-country rollout phase can be verified
quickly and consistently on staging.

---

## 2. Scope

This ticket covers:
- seeded duplicate datasets
- same-number local/international pairs
- different-number mobile/landline pairs
- duplicate-suggestion refresh flow
- merge review checks
- quick-merge checks
- regression notes per phase

---

## 3. Deliverables

### 3.1 Seed strategy

Maintain or extend seeded data so each phase has:
- same person, same number, different formats
- same person, different number, partial details
- company-only examples
- country-specific local and international variants

### 3.2 Refresh flow

After each phase:
- reseed target account if needed
- refresh duplicate suggestions
- confirm suggestion confidence still makes sense

### 3.3 Regression checklist

Each phase should verify:
- duplicate card
- merge review
- merged contact result
- stored primary phone
- stored additional numbers
- no false `Both kept` for equivalent numbers

### 3.4 Results capture

Store phase-by-phase outcomes in runbook or QA notes so regressions can be tracked
over time.

---

## 4. Required test categories

1. Same number, different format
- local
- international
- spaced
- unspaced

2. Same person, different real numbers
- mobile vs landline
- home vs work

3. Company-only contacts
- same number
- different number
- missing email / name edge cases

4. UI behavior
- quick merge preview
- merge review
- merged contact output

---

## 5. Acceptance criteria

`P37-12` is healthy when:
- every P37 phase has a seeded QA set
- every phase has at least one verified merge-review pass on staging
- regressions are logged and traceable by phase
- the duplicate/merge experience can be spot-checked quickly after each rollout


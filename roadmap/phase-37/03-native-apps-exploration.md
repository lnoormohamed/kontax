# P37 · Part 3 — Native Apps & Proprietary Protocol (Exploration, P40+)

**Status:** Strategic exploration. Not a phase, not ticketed. A track to revisit once
the Part 1 data model is proven and there's real demand for fidelity CardDAV can't
deliver. This document exists to capture the *why*, the *what-if*, and the paths —
not to commit.

---

## 1. The question this answers

CardDAV projection (Part 2) gets us ~90% of the way, but hits hard walls:

- iOS auto-links cards across accounts and we can't stop it.
- "Private" can't be enforced once data is on a device.
- Inbound edits lose layer/book attribution and must be inferred.

**Native apps speaking a proprietary protocol** are the only thing that removes these
walls — because the contact lives in *our* app, on *our* data model, end to end.

---

## 2. The key realisation: format and apps are one bet

A richer format that carries book membership, private/shared layers, and source
attribution is **worthless until something reads it**. CardDAV works because Apple,
Google, and Fastmail implement it. A Kontax format reads to nothing — until we build
the reader. So:

> A custom format is not a separate project from native apps. It *requires* them.
> They are one bet: **native Kontax apps speaking a rich Kontax sync protocol.**

This also means "build our own format" should not be confused with "build an open
standard" (Part 4). The format here is **proprietary and app-coupled** — its only job
is to let our apps and backend speak the full data model losslessly.

---

## 3. What native apps unlock

| CardDAV wall | Removed by native app? | How |
|---|---|---|
| iOS auto-links work + personal cards | ✅ | We're not in the system phonebook; no auto-link |
| No field-level privacy on-device | ✅ | Our app enforces shared/private layers |
| Flat vCard loses book/layer attribution | ✅ | Protocol carries `bookId` + layer natively |
| Same-type field collision precedence | ✅ | Full control of the data model end to end |
| Three-way conflict, no field merge | ✅ | Field-level merge in our own protocol |

This is the genuine moat. Multi-book contacts with *enforced* privacy projection does
not exist in the market — it would be the reason to choose Kontax over Apple/Google
Contacts.

---

## 4. The reality check (why this is P40+, not now)

1. **Scope is company-defining.** iOS + Android apps + a sync protocol + backend
   reconciliation is a multi-quarter-to-multi-year build with permanent maintenance
   cost. It is an initiative, not a feature.
2. **It does not replace CardDAV — it adds a tier.** Most users won't install the app
   on day one; they still want contacts in their existing phonebook. So:
   - **CardDAV stays** = the universal bridge (with its known limits).
   - **Native app** = the premium, full-fidelity path.
   Two tiers, not a migration.
3. **Build-vs-buy on the hard parts.** Offline-first sync, conflict resolution, and
   cross-device merge are notoriously hard. Worth evaluating CRDT libraries / existing
   sync engines (e.g. local-first frameworks) before writing a protocol from scratch.
4. **Distribution cost.** App Store + Play Store review, native release cadence, push
   infrastructure, crash reporting, device matrix. Ongoing, not one-time.

---

## 5. Possible paths (decreasing scope)

| Path | What it is | Cost | When it makes sense |
|---|---|---|---|
| **A. Full native + proprietary sync** | iOS + Android, offline-first, full data model. | Highest | Strong demand + funding; fidelity is the headline selling point. |
| **B. Native app, CardDAV underneath** | Native UI for the Kontax model, but sync still via CardDAV to our own server. Privacy enforced in-app. | Medium | Want the UX/auto-link fix without a new protocol. Partial moat. |
| **C. PWA-first (already underway)** | Lean on the existing mobile PWA ([`mobile-pwa-design-spec`]); add install + push. | Lowest | Validate demand before committing to native. **Likely the right first step.** |
| **D. Thin companion app** | Native shell that wraps the PWA + handles contact-store integration only where it adds value. | Low–medium | Bridge between C and A. |

**Recommended sequencing:** prove demand with **C** (PWA) → if fidelity is the blocker
users actually hit, move to **B** → only commit to **A** with clear signal and
resourcing.

---

## 6. What we'd need before committing

- **Demand signal:** are users actually hitting the CardDAV walls, or is projection
  enough? (Instrument Part 2 — count mis-routed edits, auto-link complaints, support
  tickets.)
- **The data model proven** (Part 1 shipped and stable). The protocol serialises *that*
  model — building the protocol first would be backwards.
- **A sync-engine decision** (build vs adopt a local-first framework).
- **A resourcing plan** — native is not a side-quest.

---

## 7. Why the foundation work is not wasted

Whichever path we take, it sits on the **Part 1 data model**: multi-book membership,
shared/private layers, per-member policy. The proprietary protocol is just a *lossless
serialisation* of that model; the native app is just a *native client* of it. Nothing
in Parts 1–2 is thrown away — the app rides on the same core with zero rework.

---

## 8. Open questions to revisit

1. Is fidelity (the CardDAV walls) actually the thing limiting growth, or is it
   acquisition / onboarding / price? (Don't build apps to solve a problem users don't
   have.)
2. iOS-first or Android-first or both? (Contacts fidelity pain is sharpest on iOS.)
3. Build the sync engine or adopt a local-first framework?
4. Does the premium tier justify the maintenance cost, or is it a checkbox feature?

---

*This is a thinking document. No tickets, no schema, no commitment. Revisit after Part 1
ships and Part 2 is instrumented.*

[`mobile-pwa-design-spec`]: ../mobile-pwa-design-spec.md

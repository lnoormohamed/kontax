# P37 · Part 4 — Open Standard (Positioning Exploration, P45+)

**Status:** Strategic exploration — the furthest-out and least-committed of the four.
Captures *whether*, *why*, and *under what conditions* Kontax would publish an open
standard for rich, multi-book, privacy-aware contacts. This is a positioning and
ecosystem decision, not an engineering one.

---

## 1. First, separate "our format" from "an open standard"

These get conflated constantly. They are different things with different goals:

| | **Proprietary format** (Part 3) | **Open standard** (this doc) |
|---|---|---|
| Goal | Let *our* apps speak the full model losslessly | Let *other* vendors adopt it |
| Value driver | Product fidelity / moat | Interoperability / ecosystem / positioning |
| Adoption | We control both ends | Depends on third parties choosing it |
| Timeline | Ship with the native app | Years; RFC-style; political |
| Risk if it fails | We just iterate internally | Wasted standards effort, no adopters |

**The engineering need (rich protocol) is solved by Part 3.** An open standard is a
*separate, later* strategic move — only worth it if interoperability becomes
commercially interesting.

---

## 2. Why an open standard is hard

1. **A standard with no adopters is just a spec.** vCard/CardDAV won because the
   incumbents implemented them. For a Kontax standard to matter, *other* contact apps,
   CRMs, or platforms must choose to implement it. That's a multi-year ecosystem play
   with no guaranteed payoff.
2. **Incumbents have no incentive to adopt.** Apple and Google benefit from lock-in to
   their own contact stores. They are unlikely to implement a standard that makes
   contacts portable away from them.
3. **Standards work is slow and political.** RFC processes, working groups, reference
   implementations, conformance tests. It's a different discipline from shipping
   product.
4. **You give away the moat.** If the rich-contact model is Kontax's differentiator,
   open-standardising it hands it to competitors. The open-standard play only makes
   sense once the *model* is no longer the moat — execution, network, or data is.

---

## 3. When it *would* make sense

An open standard becomes strategically interesting only under specific conditions:

| Condition | Why it changes the calculus |
|---|---|
| **Partners ask for it** | A CRM / identity / B2B partner wants to exchange rich contacts with Kontax. Interop becomes a sales lever. |
| **The model is proven and copied anyway** | Competitors are cloning multi-book privacy. Standardising it makes Kontax the *reference implementation* — positioning, not protection. |
| **Privacy/portability regulation** | Data-portability law (GDPR-style) favours open formats. Being the open option becomes a compliance/marketing edge. |
| **Ecosystem flywheel** | Enough third-party tools want to read Kontax data that an open format grows the pie faster than lock-in. |

If none of these are true, there is no reason to do this.

---

## 4. What it could look like (if we ever did)

Not a commitment — just to make the idea concrete:

- **An extension to vCard, not a replacement.** Add `X-KONTAX-BOOK`, `X-KONTAX-LAYER`
  (shared/private), `X-KONTAX-SOURCE` properties so existing vCard tooling degrades
  gracefully (ignores unknown X-props) while Kontax-aware clients get the rich model.
  Backwards-compatible standards spread far faster than greenfield ones.
- **A companion sync-protocol profile** layered on CardDAV (book-as-collection,
  layer-as-property) so it rides existing CardDAV servers.
- **A reference implementation + conformance suite** published openly. Without these, a
  spec is ignored.
- **A neutral name** — a Kontax-branded standard is a harder sell to competitors than a
  vendor-neutral one with Kontax as the originator.

---

## 5. The strategic recommendation

**Do nothing here until a partner or market force creates the need.** Specifically:

1. Ship Part 1 (model) and Part 2 (CardDAV projection).
2. If Part 3 (native apps) happens, define the proprietary protocol as a clean,
   *documentable* extension of vCard — so that *if* the open-standard moment arrives,
   the proprietary format can be published with minimal rework. **Design it as if it
   might one day be opened, without committing to open it.**
3. Watch for the §3 conditions. Revisit only when one is real.

The cheapest insurance: keep the proprietary format **clean and vCard-compatible** (X-
properties, not a new wire format). That preserves the open-standard option for free,
without paying the standards-process cost speculatively.

---

## 6. Open questions to revisit (much later)

1. Is interoperability ever a revenue lever for Kontax, or is the value in being the
   best closed experience?
2. Would partners actually implement a Kontax-originated standard, or only a
   vendor-neutral one?
3. Does open-standardising the model strengthen positioning or just arm competitors?
4. Is there a regulatory tailwind (data portability) that makes "the open option" a
   marketing edge?

---

*This is the most speculative of the four documents. Its practical takeaway for today is
narrow: when Part 3's proprietary format is designed, keep it a clean vCard extension so
the open-standard door stays open at zero extra cost. Everything else here waits for a
real-world trigger.*

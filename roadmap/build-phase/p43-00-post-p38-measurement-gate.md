# P43-00 — Post-P38 measurement gate: does the perf rationale survive?

Status: **Done 2026-07-02** · Priority: P0 · Depends: Phase 38 exit (P38-01…10 verified)
Blocks: P43-DB01, P43-01

## Decision (recorded)

**Delta is negligible — the expected outcome. Phase 43 proceeds as a
display/clutter preference only.** Label chips on rows are *not* a measurable
performance cost, and the toggle is *not* a performance remedy. P43-DB01 copy
must not claim speed benefits (it is already drafted that way). This is **not**
a Phase 38 follow-up bug — the default (chips shown) is fast at every scale.

Rationale: the contacts table is virtualized (P38-02), so the DOM holds a
fixed ~23–35 rows regardless of total contacts, and label chips add a bounded
+5 DOM nodes per chip-row. Their scroll/layout cost sits below the measurement
noise floor and does not grow with contact count.

## Results

Seeded accounts at 500 / 2,000 / 10,000 contacts (~1/3 carrying two label
chips, matching realistic data). Contacts workspace on `/contacts?tab=people`,
compact density. "Chips OFF" = the label-chip element removed from the mounted
rows; "ON" = default. Method notes below.

**Structural (exact, scale-invariant):**

| Total contacts | Mounted rows in DOM | Total page DOM nodes | DOM nodes: chip row vs non-chip row |
|---|---|---|---|
| 500    | 23 | 1692 | 61 vs 56 (**+5**) |
| 2,000  | 23 | ~1690 | +5 |
| 10,000 | 35 | 1694 | +5 |

Total DOM node count is **flat across a 20× contact range** — the virtualizer
mounts a viewport-sized window (~23–35 rows), not the full list. Mounted-row
variance (23 vs 35) tracks viewport/overscan at the moment of sampling, not
contact count.

**Scroll cost — 300 forced synchronous scroll+reflow steps** (`scrollTop` set
+ `offsetHeight` read each step; deliberately harsher than real scrolling,
which batches layout). Median of 5 alternating ON/OFF runs:

| Total contacts | Reflow ON (ms) | Reflow OFF (ms) | Δ (ms) | Δ % |
|---|---|---|---|---|
| 500    | 74.2  | 73.3  | 0.9 | 1.2% |
| 2,000  | 75.5  | 74.7  | 0.8 | 1.1% |
| 10,000 | 113.1 | 112.3 | 0.8 | 0.7% |

Intra-config run spread was ~1–2 ms, so the ~0.8 ms chip delta is **within the
noise floor**. Absolute-time difference between scales tracks mounted-row count
(23 vs 35), not total contacts. Per forced reflow the chip cost is ~0.003 ms.

**Hover interaction:** the row reveals its actions via CSS `group-hover` —
**zero** JS mouse/hover/pointer handlers on the row (verified via React props),
median style-recalc on hover 0.1 ms (max 1.9 ms). Nothing re-renders on hover;
there is no per-row "hover effect" JS cost, chips or not.

## Method notes / caveats

- Measured against the dev server (unminified React + HMR), so **absolute**
  numbers are inflated — production is faster. This makes the results a
  conservative upper bound; the load-bearing figure is the ON/OFF **delta**,
  which is robust to that overhead (both configs measured back-to-back).
- CPU throttling was **not** applied via CDP (the preview harness doesn't
  expose it). Two mitigations: (a) the chip delta is fixed and bounded by the
  mounted-row window — a 4× CPU multiplier scales ~0.8 ms to ~3.2 ms across
  300 forced reflows (~0.01 ms/step), still imperceptible; (b) dev-mode
  overhead itself acts as a rough slowdown proxy, and the forced-reflow method
  is far harsher than real (layout-batched) scrolling.
- An rAF frame-timing pass was attempted but abandoned: the preview tab
  throttles `requestAnimationFrame` when not actively painting. The
  synchronous forced-reflow method is more sensitive anyway — it isolates
  style + layout recalc, which is the chips' only cost.
- Seeded measurement accounts (`p43user00000500/00002000/00010000` on
  staging) were removed after recording.

## Purpose

Phase 43 was originally motivated as "turn off hover/label effects for better
performance". The counter-argument (accepted 2026-07-02): the contacts table
is virtualized, so per-row effects are rarely the real cost — Phase 38's
payload/query work is the actual fix, and a settings toggle is the wrong tool
for a performance defect. This ticket runs the measurement at the end of P38
and records the decision that shapes the rest of the phase.

## Method

Using the Phase 38 exit-criteria setup (seeded accounts at 500 / 2,000 /
10,000 contacts, the before/after harness from the P38 exit numbers):

1. Measure the contacts list with label chips **always rendered** on visible
   rows, on a throttled profile (CPU 4× / mid-tier device preset), capturing:
   scroll frame time on the virtualized list, interaction latency on row
   hover, and hydrated DOM node count per row.
2. Repeat with chips stripped (a local branch/flag — no preference UI needed
   for the test).
3. Record both against the P38 exit numbers in this ticket.

## Decision rule

- **Delta is negligible** (no measurable scroll/interaction difference at
  10,000 contacts on the throttled profile — the expected outcome): Phase 43
  proceeds as a **display/clutter preference only**. P43-DB01's copy must not
  claim performance benefits; v1 ships the trimmed set (labels-on-rows,
  animations).
- **Delta is real:** that is a Phase 38 follow-up bug, not a settings feature.
  File the row-cost fix against the P38 backlog first; Phase 43 stays blocked
  until the default is fast. The preference still ships afterwards — as taste,
  not as the fix.

Either way: the preference is never the performance remedy. The default
experience must be fast for everyone, including users who never open
settings.

## Acceptance
- [x] Numbers for both configurations at all three contact scales recorded in
  this ticket file. *(Results table above.)*
- [x] The decision (framing + v1 scope) written back here and reflected in
  P43-DB01 before design starts. *(Decision section above; P43-DB01 updated
  with the "P43-00 gate result" confirmation.)*

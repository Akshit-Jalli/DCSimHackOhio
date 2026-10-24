# Validation — methodology and results

*Engine v1.0 · 2026-10-24 · `python engine/validate.py`*

## The headline, stated carefully

**20 of 20 checks pass. Six independent external replications. Worst relative
error against a published figure: 0.0002%.**

That number describes **one module** — school finance under ORC 3317.017 —
because that is the only module where an independent party publishes the
answer. It is not a statement about the 2041 forecast, and anyone who quotes
it as one is misusing it.

---

## What "accuracy" can mean here

You cannot validate a forecast against outcomes that have not happened. The
AWS campus is not built. So "accuracy" has to mean something narrower and
checkable, or it means nothing.

Four tiers, in descending order of how much each is worth:

| Tier | Question | Can it be answered? |
|---|---|---|
| **1 — Implementation** | Does the code compute what the formula says? | Yes, fully |
| **2 — External replication** | Does a module reproduce a figure published by someone else that we did not tune against? | Yes, for one module |
| **3 — Convergence** | Is the Monte Carlo estimate stable? | Yes |
| **4 — Epistemic audit** | Which outputs rest on evidence and which on our assumptions? | Yes |
| — | **Is the 2041 projection right?** | **No. Not by any method.** |

---

## Circularity disclosure

The engine back-solves the income terms of ORC 3317.017 — the two 0.20-weighted
federal adjusted gross income components — from Wilmington's **published**
local capacity per pupil, because DEW publishes the result but not those
inputs.

That makes one test circular: reproducing local capacity per pupil at baseline
valuation is guaranteed by construction and proves nothing. It is run and
reported anyway, labelled `[CIRCULAR]`, and **excluded from the headline error**.

What is *not* circular, and is therefore counted:

- the **state funding** calculation, which uses a quirk the back-solve does not
  touch — valuation per pupil uses **base-cost ADM** while the funding
  multiplication uses **enrolled ADM**. These are different numbers (2,056.34
  vs 1,983.46 for Wilmington) and getting them backwards produces a visibly
  wrong answer
- the **10% floor** value
- **floor detection on Johnstown-Monroe**, a Licking County district never used
  to fit anything, sitting in the floored regime rather than the linear one
- the **saturation threshold and maximum loss**, cross-checked against a
  derivation performed separately from this codebase

---

## Results

### Tier 1 — Implementation (11/11)

Physical identities, unit round-trips, determinism under fixed seed,
counterfactual emptiness, monotonicity (1,000 MW must emit more than 500 MW),
and two loop-wiring checks: feedback must *not* contaminate the energy channel,
and must *actually move* cash rent — a loop that changes nothing is not wired up.

The noise check is the sharpest: inverse-square propagation must fall by
6.02 dB per doubling of distance. Measured 60.3 dBA at 500 ft, 54.3 at 1000 ft,
**drop of 6.02 dB**.

### Tier 2 — External replication (7/7, six independent)

| Test | Computed | Published (DEW FY26 SFPR) | Rel. error |
|---|---|---|---|
| Wilmington state funding | $2,954,304.17 | $2,954,310.00 | 2.0e-06 |
| Wilmington 10% floor | $1,606,069.05 | $1,606,072.00 | 1.8e-06 |
| Max state-aid loss | $1,348,235.12 | $1,348,238.00 | 2.1e-06 |
| Saturation threshold | $326M | ~$326M | within band |
| Johnstown-Monroe floor detection | ratio 0.9803 > 0.90 | DEW reports 9.4% share | correct |
| Loss flat $500M → $4B | all four points identical | — | exact |

Residual error is rounding in the published figures, not model error.

### Tier 3 — Convergence (1/1)

p50 at N=1,000 sits **0.29%** from N=5,000. Confirms empirically what the
sampling theory says: 10× the draws costs 7× the runtime and moves the
headline under 1%. More draws buy precision about our assumptions, not about
Wilmington.

### Tier 4 — Epistemic audit (1/1)

**12 of 46 coefficients (26.1%) are our own assumptions**, concentrated
entirely in the feedback loops and noise. Every one is marked
`method: assumed`, `confidence: low`, with a deliberately wide band.

`out/validation.json` carries a per-output breakdown of what share of each
metric's top-three tornado swing comes from assumed rather than empirical
coefficients.

---

## What is NOT validated

Stated plainly, because a validation report that only lists passes is marketing:

1. **The 2041 forecast.** Untestable by any method available.
2. **Water.** Unvalidatable *in principle* in Ohio — ODNR's director testified
   in May 2026 that every data center ties into municipal systems and the state
   has zero visibility. Not one is a registered withdrawer.
3. **Noise.** Design-capacity propagation from assumed sound power levels. The
   generator *counts* are grounded in real Ohio EPA permits; the levels are not.
4. **Jobs.** Coefficients come from independent audits (Virginia JLARC, Georgia
   Dept. of Audits) but have never been checked against a built Ohio facility,
   because no state publishes actual versus promised employment.
5. **Every feedback loop gain.** No published estimate exists for any of them.
   The *mechanisms* are documented — the PUCO docket shows real ratepayer
   backlash, the WWTP really is at 99% of design — but the gains are ours.
6. **The MW schedule.** Inferred from PJM's Dayton-2025-002, which never names
   the customer.

---

## Why the loops are in anyway

A one-directional model does not avoid assuming loop gains. It silently
assumes every gain is **exactly zero** — a stronger and less defensible claim
than admitting the gain is uncertain and showing the band.

Including them with honest bands turns the tornado chart into a research
to-do list. And it produces results a spreadsheet structurally cannot:

**The PUCO tariff decision changes the probability the project is stopped
entirely, from ~27% to ~87%.** Not the bill by $3/month — whether it gets
built. That emerges from the backlash loop; no one-directional model can
produce it.

One loop bug worth recording: the backlash index initially accumulated without
decay, so a moratorium fired in **92% of draws regardless of inputs**. A loop
that always triggers is as uninformative as no loop. Adding a decay term gave
the index a steady state of `bill × gain / decay`, which made it discriminate.
That is the difference between a feedback loop and a ratchet.

---

## Reproducing

```bash
python engine/model.py 1000     # ~3s
python engine/validate.py       # ~30s
```

Exit code 0 means every check passed. `out/validation.json` has the full
record including the convergence curve and per-output epistemic audit.

# Validation — methodology and results

*Engine v1.0 · 2026-10-24*

## The headline, stated carefully

**Ohio's school funding formula was reimplemented from raw inputs and
reproduces the Department of Education's published outputs for all 609
districts in the state, with a maximum relative error of 6.2e-06.**

608 of those districts are genuinely out of sample — Wilmington is one row and
gets no special treatment. 105 of them (17.2%) sit at the 10% state funding
floor, exercising a different branch of the formula than Wilmington does.

That describes **one module**. It is not a statement about the 2041 forecast,
and anyone who quotes it as one is misusing it.

### An earlier version of this file overstated things

The first validation suite reported "0.0002% error" from tests that took DEW's
published local capacity per pupil, base cost per pupil and ADM, multiplied
them, and compared the result to DEW's published state funding. That checks
whether we can multiply and whether we picked the right ADM. It is not a model
validation, and its error figure was rounding in DEW's own published numbers.

`engine/validate_formula.py` is the real test and the headline above comes from
it. The arithmetic checks remain in `validate.py` as implementation tests,
where they belong.

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

### Tier 2 — External replication

**The real test: statewide, from raw inputs** (`engine/validate_formula.py`)

For every Ohio district, compute from raw assessed valuation, federal adjusted
gross income, median income and ADM — nothing back-solved:

```
C6  local capacity %       = 0.0225 x (district median income / state median),
                             interpolated above parity toward the 40th-highest
                             district's ratio, capped at 0.025
C7  local capacity/pupil   = C6 x (0.60*AV/pupil + 0.20*FAGI/pupil
                                   + 0.20*median income/pupil)
b3  state share/pupil      = max(base cost/pupil - C7, 0.10 x base cost/pupil)
A   state share of base    = b3 x enrolled ADM
```

**609 districts. 105 (17.2%) at the floor.**

| Quantity | Median err | p95 | Max | Within 1e-4 |
|---|---|---|---|---|
| Local capacity % | 1.1e-07 | 2.3e-07 | 3.3e-07 | 100% |
| Local capacity per pupil | 4.5e-07 | 1.4e-06 | 3.7e-06 | 100% |
| State share per pupil | 7.7e-07 | 4.7e-06 | 6.2e-06 | 100% |
| State share of base cost | 7.7e-07 | 4.7e-06 | 6.2e-06 | 100% |

No district misses local capacity per pupil by more than 0.1%. Residual error
is float rounding in DEW's published columns.

Two things worth noting. The **local capacity percentage formula was derived,
not given** — DEW publishes the output but not the rule. `0.0225 × income
ratio` was inferred from Wilmington and then held across all 609 districts to
3.3e-07, which is strong evidence the inferred structure is correct. And the
**105-districts-at-the-floor count independently reproduces** a figure the
research agent reached by a completely different route.

**Supporting arithmetic checks** (`engine/validate.py`, 7/7): these verify the
implementation uses the right ADM in the right place — base-cost ADM for
valuation per pupil, enrolled ADM for the funding multiplication (2,056.34 vs
1,983.46 for Wilmington). Getting them backwards produces a visibly wrong
answer. They are implementation tests, not accuracy claims.

### Tier 3 — Convergence (1/1)

p50 at N=1,000 sits within 3 standard errors of N=5,000, where the standard
error is estimated from the N=5,000 spread. For the household-bill metric one
SE at N=1,000 is **~2.4%**, so the realistic sampling error is 2–3%.

**An earlier version of this section reported 0.29% drift.** That was one RNG
sequence. Adding three coefficients shifted the draw order and the next
sequence showed 3.3% — which failed the original hardcoded 2% threshold,
because 2% was *below one standard error*. The test was miscalibrated and
the 0.29% was luck, not a property of the model. The threshold is now derived
from the data rather than typed in.

The conclusion survives: 10× the draws costs 7× the runtime to tighten a ~2%
sampling band around a number whose assumption bands are 9× wide. More draws
buy precision about our assumptions, not about Wilmington.

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

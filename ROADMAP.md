# Engine roadmap

*Updated 2026-10-24, after v1.0 shipped*

## Status

| Gate | State |
|---|---|
| **A — Make it a simulation** (3 feedback loops) | ✅ Done |
| **B — Emit what the other lanes need** (geo, ledgers, upstream, noise) | ✅ Done |
| **C — Know how wrong we are** (validation) | ✅ Done, then redone properly |
| **D — The lever sweep** | ❌ **Not built. The roadmap missed it.** |
| **E — Backtest negative result** | ❌ Not written up |

---

## Gate D — The lever sweep *(the real remaining gap)*

PLAN.md §1 promises: *"You set the deal terms — abatement percentage, PILOT
share, cooling type, water source, noise setbacks — and watch fifteen years of
consequences diverge."*

The engine cannot currently do that. It runs **one** scenario with two tariff
arms. `scenarios/aws_wilmington.json` declares six levers and **nothing
consumes them**. Lane C's lever panel has no function to call.

This is the difference between a calculator and a negotiation tool, and it is
the single most load-bearing thing still missing.

What it needs:

1. **A callable API.** `main()` writes a file. Lane C needs
   `run_scenario(overrides) -> results` it can call per lever change.
2. **A sweep driver** over the declared lever space.
3. **A Pareto frontier** — given weights on outcomes a town cares about
   (school funding, jobs, bills, farmland), which deals are non-dominated.
   This is the "here is the best deal available to you" result, and it is a
   grid search, not RL.

**Feasibility:** the full lever space is 4 × 3 × 4 × 3 × 2 × 4 = **1,152
combinations**. At 1,000 draws that is ~19 minutes — too slow to be
interactive, fine as a precompute. At 200 draws it is ~4 minutes. Precompute
the sweep to JSON and have the frontend read it; the demo then feels instant
because the answer is already sitting there. **Vectorisation is not required**
if we precompute.

## Gate E — Write up the backtest as a negative result

We tried to use Licking County as a calibration arm and the naive version
does not work. Shown empirically, not assumed:

- statewide median assessed valuation growth TY22→TY24 was **27.6%**, so
  Johnstown-Monroe's +52.4% is mostly reappraisal, not data centers
- **every** Licking County district grew 32–52%; the county floor is 32.1%
- the statewide top 10 by growth is mostly rural ag districts in Mercer,
  Crawford and Putnam counties with no data centers at all
- if campuses are 100% abated, their value never enters taxable AV, so the
  fiscal channel may have nothing to detect by construction

PLAN.md §5 still claims Johnstown-Monroe is "already a measured case, not a
forecast." **That claim is wrong and needs correcting.**

"We tried to backtest, here is why the obvious version fails, here is what a
real one needs" is a stronger slide than a backtest nobody checked.

---

## Definition of done for v1.0 *(original, now historical)*

The engine is "finished" when it (a) implements the mechanism the pitch claims
it implements, (b) emits everything Lane B and Lane C need, and (c) can state
its own accuracy with a straight face.

Three gates, in this order, because each unblocks the next.

---

## Gate A — Make it a simulation

**The problem:** v0.8 is one-directional. MW in, numbers out. PLAN.md says
feedback loops are "what makes it a simulation and not a spreadsheet" and
there are none. This is a credibility gap, not a feature gap — it is the one
place where the code contradicts the pitch.

Three loops, all grounded in Wilmington-specific evidence:

| Loop | Mechanism | Why it's defensible here |
|---|---|---|
| **Land speculation** | Campus → land value premium → cash rent up → marginal farms exit → more land available | Clinton is 92.3% farmland with the state's best corn yields; rent is already *below* state average, so margins are thin |
| **Political backlash** | Bill delta → backlash index → moratorium probability → caps further MW | Real precedent: PUCO 25-0958 drew hundreds of ratepayer comments plus formal opposition resolutions from Logan, Greene and Champaign counties and five municipalities |
| **Sewer constraint** | MW → sanitary load → headroom falls → expansion cost or hard MW cap | WWTP runs at 2.97 of 3.0 MGD design. The binding municipal constraint is real and measured |

## Gate B — Emit what the other lanes need

- **`ledgers`** — four household archetypes with annual dollar deltas and
  component breakdowns. Cheap to build, and it is the emotional hook.
- **`geo`** — campus footprint, noise contours, burden arcs, transmission
  corridor. This is what deck.gl consumes.
- **Upstream chain** — gas burn → Utica well equivalents → burden counties.
  The geographic export of harm is the project's differentiator and it is
  currently absent from the code entirely.
- **Noise** — simplified ISO 9613-2 point-source propagation. Full ISO is
  paywalled and overkill; inverse-square plus ground attenuation gives a
  defensible contour.

## Gate C — Know how wrong we are

A validation suite that reports a number, plus an honest statement of what
that number does and does not cover. See `VALIDATION.md` for methodology and
results.

---

## Explicitly out of scope for v1.0

- **MODFLOW groundwater modeling.** Multi-day setup, and Wilmington is 100%
  surface water with zero wells. Wrong channel entirely.
- **Hourly marginal emissions (8,760 steps).** Conflicts with an annual
  timestep. EPA AVERT is the upgrade path if someone has a spare afternoon.
- **RL / learned policy.** The lever sweep is a 30-line grid search that
  delivers what a judge thinks RL would give them, fully interpretable.
- **Vectorization.** 10k draws run in 22s. Only worth doing if the Pareto
  sweep becomes the bottleneck.

## Known limits that will survive v1.0

These are not bugs and will not be fixed, because the data does not exist:

1. **Water cannot be validated in Ohio.** ODNR has zero data center
   visibility; not one is a registered withdrawer.
2. **Noise and emissions are design capacity, not measured output.**
3. **The MW schedule is inferred.** PJM's Dayton-2025-002 never names the
   customer.
4. **`residual_bill_share_under_tariff` is our own guess** with a 9× band.
   It is the top tornado driver, which is the model correctly reporting that
   we don't know.

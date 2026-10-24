# Engine roadmap — v0.8 to v1.0

*2026-10-24*

## Definition of done for v1.0

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

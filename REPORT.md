# Engine report — Wilmington data center impact simulator

*Generated 2026-10-24 by `engine/report.py` from `out/*.json`. Numbers here are read from the output files, not typed.*

## 1. Key performance indicators — the AWS deal as proposed

500 MW IT load ramping 2028–2030, $4B capex, 471.6 acres at 1488 S US 68, 100% real-property CRA for 30 years with a 30% PILOT, air-cooled, AES Ohio service. Median of Monte Carlo draws, final year 2041, all deltas against a no-project counterfactual run under common random numbers.

| KPI | Tariff approved | Tariff rejected | Unit |
|---|---:|---:|---|
| Facility energy, 2041 | 3,689 | 3,631 | GWh/yr |
| Marginal CO2, 2041 | 3,242 | 3,191 | kt/yr |
| Marginal CO2, cumulative to 2041 | 41,494 | 40,885 | kt |
| Direct site water, 2041 | 25.3 | 24.5 | Mgal/yr |
| Indirect generation water, 2041 | 4,282 | 4,217 | Mgal/yr |
| Household electric bill delta | 1.15 | 4.78 | $/month |
| School state-aid delta vs no project | 0 | 0 | $/yr |
| PILOT + compensation to district | 5,880,592 | 5,880,592 | $/yr |
| Local property tax to district | 0 | 0 | $/yr |
| School total revenue delta, 2041 | 5,880,592 | 5,880,592 | $/yr |
| School total revenue, cumulative 2026–41 | 82,328,288 | 82,328,288 | $ |
| Household bill, cumulative 2026–41 | 176 | 737 | $ |
| Construction employment (direct) | 4,539 | 4,539 | job-years |
| Permanent employment, 2041 | 186 | 179 | FTE |
| Population response | 14 | 12 | persons |
| Farmland converted | 472 | 472 | acres |
| Farms exited by 2041 (of 788) | 73 | 66 | farms |
| Cash rent delta | 28.90 | 28.12 | $/acre |
| Noise at setback | 60.3 | 60.1 | dBA |
| Sewer load vs plant design | 1.027 | 1.026 | ratio |
| Moratorium probability | 0.27 | 0.86 | fraction |
| Utica well-equivalents, 2041 | 6.4 | 6.2 | wells |

**Reading the two columns.** PUCO case 25-0958-EL-AIR is open and contested. If the AES data center tariff survives as written, AWS pays 100% of transmission network upgrades and the residential bill effect is small. If it is rejected, costs socialise and the Meeks et al. investor-owned-utility estimate applies. The moratorium probability row is the one a spreadsheet cannot produce: it is emergent from the backlash feedback loop, and the tariff decision moves it by a factor of three.

**Why the tariff-rejected column shows *less* energy, *fewer* jobs and *fewer* farms lost.** That is not a sign error. When the tariff fails, the moratorium fires in most draws and caps MW before full build-out, so the median draw has less capacity online in 2041. Higher bills lead to less data center — the political loop closing. A one-directional model would show the rejected column identical to the approved one on every physical row.

Construction employment is **direct** job-years. Multiply by roughly 1.8 for total including indirect and induced, which is the figure most economic-impact studies quote.

## 2. The school-funding finding

State aid loss is linear in campus value until the 10% floor binds at roughly **$326M of market value**, then flat forever at **$1,348,235/yr**. A $4B campus is twelve times past that threshold. The loss is identical at $0.5B, $1B, $2B and $4B.

Under the proposed 100% abatement, taxable value does not rise and this channel never fires — the district's revenue is the PILOT and compensation agreement instead. Both arms are in the sweep as `property_abatement_pct` and `abatement_years`. When an abatement expires inside the horizon, the $1.35M state-aid loss lands — but so does the local property tax on the full assessed value, which is several times larger. **Expiry is a net gain for the district.** That is why the sweep's schools-first recommendation is 0% abatement, and why the as-proposed deal is dominated: the PILOT is worth less to the district than the tax it replaces.

## 3. Lever sweep and Pareto frontier

**1,152 lever combinations**, 200 draws each, over abatement %, abatement years, PILOT %, cooling, tariff outcome and MW. Eight objectives: cumulative school revenue, permanent jobs, construction jobs (maximise); cumulative household bill, direct water, farms lost, cumulative CO2, moratorium probability (minimise).

**What the first run of this sweep got wrong, and why it matters.** It ranked every town priority at 100% abatement and evaporative cooling. That was three missing channels: no local property-tax revenue (so abatement looked free for schools — backwards by ~$9M/yr), no energy penalty on air cooling (so cooling was a no-op on six objectives), and bills that scaled by fraction-of-contract rather than absolute MW (so a 1,000 MW facility hit ratepayers like a 500 MW one). Plus a snapshot metric a 10-year abatement could game, and ties resolved by list order. All five are fixed; ties now resolve toward the actual AWS deal. **A known gap remains: PILOT % has no modelled cost to the developer, so the sweep will always prefer the highest PILOT.** Treat that lever as a floor on what to ask for, not a recommendation.

**222 of 1,152 settings (19.3%) are Pareto-optimal** — no other setting beats them on every objective at once.

**The AWS deal as proposed is Pareto-dominated by 32 other settings.** The nearest changes only `property_abatement_pct`: 0% abatement for 30 years, 30% PILOT, air cooled, tariff approved, 500 MW. It is identical on jobs, bills, water, farms, CO2 and moratorium probability, and gives the district **$142,565,842 instead of $82,328,288** over the horizon — the local property tax on un-abated value exceeds the PILOT.

**The caveat that belongs next to that sentence, not in a footnote:** the model has no deal-viability constraint. It assumes the campus is built regardless of terms. A town that demands 0% abatement may get no data center at all, and the sweep cannot see that. What the frontier establishes is the *shape* of the trade-off space and the *price* of the abatement in district revenue; it does not establish that AWS would accept the alternative. That is exactly the question a negotiation puts to the developer, and the tool's job is to arm the town with the number.

### Best deal by town priority

Weights are illustrative framings for the demo, not survey data.

| Priority | Abatement | PILOT | Cooling | Tariff | MW | Levers changed | School cum. $ | Perm. FTE | Bill cum. $ | Water Mgal | Farms lost |
|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| schools first | 0% / 30yr | 30% | air cooled | approved | 1000 | 2/6 (36 tied) | $290,006,976 | 371 | $348 | 51 | 142 |
| jobs first | 100% / 30yr | 30% | air cooled | approved | 1000 | 1/6 (144 tied) | $150,656,576 | 371 | $348 | 51 | 142 |
| farmland first | 100% / 30yr | 30% | air cooled | approved | 100 | 1/6 (96 tied) | $27,665,658 | 37 | $35 | 5 | 15 |
| ratepayers first | 100% / 30yr | 30% | air cooled | approved | 100 | 1/6 (144 tied) | $27,665,658 | 37 | $35 | 5 | 15 |
| climate first | 100% / 30yr | 30% | air cooled | approved | 100 | 1/6 (96 tied) | $27,665,658 | 37 | $35 | 5 | 15 |
| balanced | 100% / 30yr | 50% | air cooled | approved | 100 | 2/6 (2 tied) | $36,776,096 | 37 | $35 | 5 | 15 |

## 4. Accuracy — what is verified, and against what

You cannot validate a forecast against outcomes that have not happened. The claims below are scoped to what can be checked.

### 4a. External replication — Ohio school funding formula, statewide

The fiscal module was reimplemented from **raw** assessed valuation, federal adjusted gross income, median income and ADM for **609 Ohio districts** and compared to the Department of Education's published outputs. Nothing back-solved; Wilmington is one row with no special treatment. **105 districts (17.2%) sit at the 10% floor**, exercising a branch Wilmington never touches.

| Quantity | Median rel. err | p95 | Max | Within 1e-4 |
|---|---:|---:|---:|---:|
| Local capacity % | 1.1e-07 | 2.3e-07 | 3.3e-07 | 100% |
| Local capacity per pupil | 4.5e-07 | 1.4e-06 | 3.7e-06 | 100% |
| State share per pupil | 7.7e-07 | 4.7e-06 | 6.2e-06 | 100% |
| State share of base cost | 7.7e-07 | 4.7e-06 | 6.2e-06 | 100% |

Residual error is float rounding in DEW's published columns. The local-capacity-percentage rule is not published; it was inferred from one district and held across all 609 to 3.3e-07.

### 4b. Implementation, convergence and epistemic audit

| Tier | Passed | What it establishes |
|---|---:|---|
| 1 | 12/12 | Code computes what the formula says: identities, unit round-trips, determinism, monotonicity, loop wiring, cooling penalty |
| 2 | 7/7 | Arithmetic against published intermediates (implementation checks, not accuracy claims) |
| 3 | 1/1 | Monte Carlo p50 at N=1,000 within 3 standard errors of N=5,000 (threshold derived from the data; realistic N=1,000 error is 2–3%) |
| 4 | 1/1 | Assumption-driven coefficients are a minority of the set |

**26.0% of coefficients are our own assumptions**, all marked `method: assumed`, `confidence: low`, concentrated in the feedback loops and noise. Per-output: physical and jobs outputs are 0% assumption-driven; backlash and cash rent are 100%. The model reports this rather than hiding it.

## 5. What is not validated

1. **The 2041 forecast.** Untestable by any method.
2. **Water.** Unvalidatable in Ohio by construction — ODNR has zero data center visibility; not one is a registered withdrawer.
3. **The Licking County backtest.** Attempted and the naive version fails: statewide median assessed valuation growth TY22→TY24 was 27.6%, every Licking district grew 32–52% from reappraisal, and rural ag counties with no data center fill the statewide top ten. If campuses are 100% abated their value never entered taxable AV. A real backtest needs within-county controls and parcel-level isolation.
4. **Noise.** Design-capacity propagation from assumed sound power levels.
5. **Jobs.** Coefficients from independent legislative audits, never checked against a built Ohio facility.
6. **Every feedback-loop gain.** The mechanisms are documented; the gains are ours.
7. **The MW schedule.** Inferred from PJM Dayton-2025-002, which never names the customer.
8. **The ~6 MG/yr site water claim.** A developer figure 25–40× below LBNL norms; the single largest unverified sensitivity.

## 6. Reproduce

```bash
python engine/model.py              # ~3s, writes out/results.json
python engine/validate.py           # ~30s, 21 checks
python engine/validate_formula.py   # needs data/raw/TRAD_FL2.xlsx from education.ohio.gov
python engine/sweep.py 200          # ~4 min, 1,152 points, writes out/sweep.json
python engine/report.py             # regenerates this file
```

Callable from code:

```python
from engine.api import run_scenario
r = run_scenario({"property_abatement_pct": 50, "cooling": "evaporative"})
r["kpis"]["household_bill_delta_usd_month"]
```
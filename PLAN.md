# Data Center Impact Simulator — Project Plan

*Last updated 2026-10-24*

---

## 1. What we're building

A **negotiation tool for towns that haven't signed yet.**

You play the decision-maker for Wilmington, Ohio. You set the deal terms — abatement percentage, PILOT share to the school district, cooling type, water source, noise setbacks — and watch fifteen years of consequences diverge. Every number on screen is clickable and shows its formula, its source, and its uncertainty band.

The framing matters. This is **not** "data centers are bad." It's a decision tool a real board of trustees could open before a rezoning vote. Judges reward "someone could use this Monday."

---

## 2. The town: Wilmington, Ohio

Clinton County, southwest Ohio. Population ~12,500.

**Why it's the right pick:**

- **No data center yet.** This is a genuine forecast, not a retrospective. That was the original premise, and most candidate towns had already been built on.
- **DHL walked out in 2008–09.** The town has already run the experiment of betting its economy on one large employer. A data center is that same bet placed again — one big employer, this time with roughly 50 permanent jobs instead of thousands.
- **Wilmington Air Park** is the obvious siting candidate: existing industrial land, existing power, a port authority that wants tenants.
- **Economically weaker** than the central-Ohio corridor, so impacts are larger in relative terms and the "we need jobs at any cost" dynamic is real rather than hypothetical.
- **Prime farmland** in the county, which makes conversion a stronger argument than it would be on marginal land.

### This is not hypothetical — there is a live proposal and a vote in ten days

**Amazon Data Services, ~$4B, 471 acres at 1488 S US 68, Wilmington.** Nine buildings, 1,920,299 sq ft. At least 100 permanent jobs against $8M payroll. A **30-year CRA under Mega-Project designation** plus a TIF, $1.5M upfront to the City, $350K–$1.85M to the Port Authority.

**The MW figure nobody publishes, but PJM does.** Transmission need `Dayton-2025-002` describes a customer request near Clinton Substation ramping:

| Date | MW |
|---|---|
| Jan 2028 | 35 |
| Apr 2028 | 100 |
| Jan 2029 | 300 |
| Jan 2030 | **500** |

PJM never names the customer, so the AWS link is strong inference rather than documentation — flag it as such. Two companion needs exist nearby: `Dayton-2025-001` (Fayette, 1.5 GW by 2031) and `Dayton-2026-001` (Stuart, 1,300 MW by 2032).

**Political status as of 2026-10-24:**

- Feb 2026 — ~546 acres annexed 7-0, rezoned light industrial 5-2
- Jul 2026 — a federal judge's order forced council to reconsider three 2025 ordinances; litigation ongoing
- Sept 2026 — council passed Cosler Farm rezoning and data-centers-as-permitted-use, both 5-2
- Sept 2026 — **Ohio Supreme Court blocked** a citizen initiative from the ballot
- **Nov 3, 2026 — four rezoning referendums on the ballot.** These cover a *second* project (Ardent Companies, reportedly terminated), not AWS. Data centers are on the ballot in **18 Ohio communities** this November

This makes "someone could use this Monday" literally true, and it raises the bar on neutrality — see §10.

---

## 3. How the engine works

### Three input files, not one

This is the architectural decision that matters most.

| File | Size | Where it comes from |
|---|---|---|
| `scenario.json` | ~25 fields | The user sets these in the UI — MW, PUE, cooling type, phases, abatement %, PILOT share, setbacks |
| `baseline.json` | ~60 fields | Pulled per town from public APIs — school district finance, water system capacity, cash rent, grid emission rate |
| `coefficients.yaml` | ~80 numbers | **Hand-sourced, each with a citation** — water gal/MWh by cooling type, construction FTE per $100M, jobs per MW, chiller dBA at 100ft |

**Only the middle one is really a download.** `coefficients.yaml` is judgment you source and defend. It is where the project's credibility actually lives, and it needs a named owner rather than whoever finishes first.

### What comes out

`results.json`, keyed by year, every metric carrying its own provenance:

```json
{ "facility_mwh": { "value": 2737500, "unit": "MWh",
    "formula": "it_load_mw * pue * 8760 * utilization",
    "source": "c_pue_hyperscale", "low": 2.4e6, "high": 2.9e6,
    "method": "physical", "confidence": "high" } }
```

Plus two siblings outside the year loop:

- **`geo`** — campus footprint, noise contours, drawdown cone, burden arcs. Straight into deck.gl.
- **`ledgers`** — four household archetypes with annual dollar deltas.

**The counterfactual ships in the same payload**, same shape, no data center. Everything interesting is a delta, and "with vs. without" beats "before vs. after" every time.

### Why system dynamics and not ML or RL

We considered both seriously. Neither fits.

**XGBoost needs training data we don't have.** Maybe thirty US towns have had a hyperscale data center built *and* measured downstream effects on school finance, cash rent and residential bills — inconsistently measured and wildly confounded. That's n≈30 against roughly 100 candidate features. We would be fitting noise and could not defend a single prediction. Worse, it is a black box, which destroys the provenance advantage that is our entire pitch.

**RL is a consumer of simulators, not a substitute for one.** You cannot train an agent until the engine exists and runs fast. Compute is not the barrier — a NumPy model with 15 annual steps runs in about a millisecond, so millions of rollouts are cheap. The barrier is sequencing.

**So: a deterministic causal system-dynamics model.**

1. **State variables** — MW online, acres converted, assessed value, aquifer head, enrollment
2. **Transfer functions** — mostly linear, some with real thresholds (water system capacity, substation headroom, noise distance decay)
3. **Feedback loops** — this is what makes it a simulation and not a spreadsheet. Data center → land speculation → cash rent up → marginal farms exit → more land available. Bills up → political backlash → moratorium probability up.
4. **Monte Carlo** — sample each coefficient from its `[low, high]`, run 1,000 times, emit percentile bands
5. **Tornado sensitivity** — which coefficients drive the variance. Tells us where to spend remaining research hours, and makes a good slide.

### Where ML does earn a place

Three narrow slots, none of them the core engine:

- **Gradient boosting on siting** — "where does the next one go?" has real labels and real features. Powers a "which town is next" feature.
- **LLM for extraction, never prediction** — parsing PUCO filings and zoning minutes into structured numbers. Good Bedrock use case.
- **A lever optimizer** — search the lever space for the Pareto frontier given a town's preference weights. Delivers what a judge *thinks* RL would give them, in about 30 lines of grid search, fully interpretable.

---

## 4. The causal spine

The upstream/downstream chain is the differentiator, because almost nobody models it geographically.

```
MW contracted → grid interconnection + PJM capacity market
   → capacity prices rise across 13 states → every ratepayer's bill
   → new gas generation + delayed coal retirements
      → Utica/Marcellus gas demand
         → drilling, water use, brine disposal in eastern Ohio counties
   → transformer + turbine orders → multi-year lead times
      → a municipal utility's own upgrade slips
   → transmission corridor → eminent domain across farmland
```

**The story: Wilmington's data center exports its environmental burden to counties that get zero tax base.** Visualized as arcs flying out of the site. That is the screenshot.

One correction already banked: the burden does **not** spread by distance. There were zero constrained LDAs in the last two PJM auctions, so cost spreads through the capacity market across all 13 PJM states, not to adjacent counties. Model it as service-territory and cost allocation, not geography.

---

## 5. How we know it's right

Two arms, which is why we kept the Licking County research after switching towns.

**Calibration arm — Licking County (New Albany, Johnstown-Monroe).** It already happened and it is measured. Johnstown-Monroe's assessed valuation went $467.5M → $712.6M in two years and the district is already pinned at the 10% state funding floor. We tune coefficients against the real outcome.

**Forecast arm — Wilmington.** It has not happened. We run the tuned engine forward.

**The methodological catch:** a +52% valuation jump is not all data center. Ohio's reappraisal cycle lifted every district. The fix is **within-county controls** — compare treated districts against untreated districts in the same county, on the same reappraisal cycle, under the same state formula. A difference-in-differences that costs one extra query against a file we are already downloading.

### Say out loud what we cannot validate

This is where credibility is won, and most teams skip it:

- **Water — unvalidatable in Ohio.** ODNR's director testified in May 2026 that every data center in the state ties into municipal systems, so the state has *zero* visibility and not one is a registered withdrawer. We can model it but we cannot check it.
- **Noise and emissions — design capacity only.** Permits say 158 generators exist, not what they emit in operation.
- **Jobs and housing — confounded.** County-level data cannot isolate one campus.

A slide saying "here is what we validated, here is what nobody can validate and why" beats one implying everything was checked.

---

## 6. Who does what

Three lanes. Lock the JSON contract in hour zero and nobody blocks anybody.

### Lane A — Spine (data + model)

- **Short:** one parcel, one chain end to end. MW → MWh → marginal emissions → capacity cost → household bill delta. Hardcode the rest. Emit a valid `results.json`.
- **Long:** all channels live. Every output carries formula, source, uncertainty. Backtest against Licking County.

### Lane B — Face (map + time)

- **Short:** deck.gl + MapLibre, real Clinton County tiles, extruded campus footprint, 2026→2041 timeline slider driven by mock data.
- **Long:** burden arcs, transmission corridor, noise contours, counterfactual A/B toggle, 60fps demo path.

### Lane C — Story (levers + ledgers + pitch)

- **Short:** policy lever panel wired to recompute, with/without toggle, four household cards.
- **Long:** click any number → formula, source and uncertainty. Exported community impact brief. Pitch deck and rehearsed three-minute script.

**Three rules:** nobody edits another lane's files; from Gate 2 onward you always have something demoable; Lane A is riskiest, so whoever finishes first helps A.

---

## 7. Checkpoints

| Gate | When | Must be true |
|---|---|---|
| **0** | Hour 0 | JSON contract agreed, `fixtures/mock_results.json` committed. B and C build against the mock from minute one |
| **1** | H+5 | A emits one real `results.json`; B renders mock data on a real map; C's levers mutate state. Swap the mock for A's real file |
| **2** | H+12 | Thin slice end to end. **First demoable state — record a screen capture as insurance** |
| **3** | H+20 | A has 6+ channels, B has arcs and contours, C has provenance. **Schema freezes** |
| **4** | H+28 | Feature freeze. Polish, bugs and pitch only. Record the final backup video |
| — | Last 3h | Rehearse the demo three times out loud, on the actual demo machine and network |

Scale the hours to the actual window — these are relative.

---

## 8. Where things stand

### Verified and usable now

- **PJM capacity prices:** $28.92 → $269.92 → $329.17 → $333.44 → $325.00 per MW-day across the 2024/25 through 2028/29 auctions
- **Data centers account for 38.2%** of 2028/29 capacity charges, per PJM's own market monitor
- **eGRID RFCW non-baseload CO2: 1,757.4 lb/MWh** — use this, not the 911.4 average, because new load is marginal load
- **Microsoft Americas WUE: 0.34–0.38 L/kWh** — the only clean primary series any hyperscaler publishes
- **Ohio school funding formula** (ORC 3317.017) decoded, including the two dampers: valuation uses the *lower* of the three-year average and current value, and districts past the floor get Transitional Aid Guarantee backfill. It is a ramp, not a cliff
- **Ohio's exemption cost $1.5–1.6B in 2025** against $136M projected; DeWine paused new approvals
- **AWS New Albany:** 15-year 100% abatement, and both school districts get a combined **$125,000**
- **Retail rate effect is causal and measured** (Meeks et al., MIT CEEPR 2026, staggered DiD 2010–2024): residential **+2.1%**, all customers +2.7%. Critically, this splits by ownership — **IOU +5.2% residential, public utilities smaller, cooperatives no effect at all**
- **Load factor 0.55** (Muller, NBER w35100) — answers the utilization gap in our schema
- **PUE 1.4 (2023) → 1.15–1.35 (2028)**; site WUE ~0.36 L/kWh → 0.45–0.48; **indirect generation water 4.52 L/kWh**, about 12× the direct figure (LBNL 2024)
- **Ohio is the 3rd-highest state** for data center air-pollution and GHG damages; planned Ohio facilities add just over **$2B, roughly +40%** (Muller 2026)

### Wilmington specifics, verified

- **Electric: AES Ohio** (investor-owned, formerly Dayton Power & Light). **PJM DAY zone.** Clinton Substation on East Dalton Rd is the interconnection point — 345 kV ring bus, local distribution at 69 kV. No 138 kV nearby
- **$589.8M of committed transmission upgrades**, including a 27-mile Clinton–Fayette 345 kV line at $187M (OPSB approved, in service Jan 2030)
- **Water: PWSID OH1401211, 100% surface water, zero wells.** Caesar Creek Lake plus two Burtonville reservoirs. Plant rated 4.0 MGD against 2.2–2.8 MGD average
- **The city buys 7 MGD from ODNR whether it uses it or not** and has never sold half of it. A 30-year stranded sunk cost it is motivated to defray — this is a major narrative lever
- **Wastewater is the binding constraint**, not water: 3.0 MGD design against a 2.97 MGD mean monthly average, 99% of capacity. Peak day 10.9 MGD against 6.25 rated (severe infiltration)
- **AWS's claimed water draw is ~6 MG/year** (97% outside-air cooling) — but this comes from the Port Authority, a **party to the project**, and it sits **25–40× below** LBNL-derived norms of ~1,350–2,280 gal/day/MW. Plausible for a genuinely air-cooled Ohio design, but it is **the single biggest unverified sensitivity in the model**. Do not repeat it as fact. AWS separately funds ~$25M of trunk sewer, water main and a 1-MG tower
- **DHL collapse, quantified:** ATSG headcount 10,150 (end 2007) → 2,020 (end 2009), net −8,130. Air-park-wide "over 8,000 jobs" → ~750 by 2010. **Clinton County unemployment 5.6% (May 2008) → 19.7% peak (Jan 2010).** Today ~5,200 FTE at the air park and ~4% unemployment
- **Gas: CenterPoint/Vectren**, pending sale to National Fuel Gas. **No verified interstate pipeline crosses Clinton County** and no gas generation is planned — do not assert either
- **Air Park** is the only FAA Part 139 certified airport outside the federal funding system, so no federal land-use restrictions or environmental review timelines. A genuine speed-to-market differentiator, even though AWS is not siting there

### Jobs coefficients, and the mistake almost everyone makes

**Only ~20% of headline capex is construction.** Virginia JLARC Report 598 (independent legislative audit, Dec 2024) breaks a data center down as **19.6% building and site, 68.2% equipment**. So AWS's $4B is roughly **$800M of actual construction**. Multiplying $4B by a jobs-per-dollar coefficient inflates the answer fivefold, and it is the single most common error in these analyses.

| Coefficient | Value | Source |
|---|---|---|
| Construction jobs | 4.75 direct / 8.5 total per $1M construction output | GA Dept. of Audits / UGA Carl Vinson, Dec 2025 |
| → for Wilmington | ~1,630 direct job-**years** per $1B headline capex ⇒ **~6,500 job-years over 5+ years** | derived |
| Construction duration | 12–18 months per building, 5+ years per campus | JLARC 598 |
| **Permanent jobs** | **0.40/MW central** (40 per 100 MW); 0.25–0.36 low | JLARC, Meta/AWS bottom-up |
| → at 500 MW | **~200 permanent**, against the Port Authority's claimed 100+ | derived |
| Peak construction : permanent | **~8:1 median** (range 4:1 to 16:1 across Meta's 28 US sites) | derived |
| Self-reported headcount haircut | **×0.5** — JLARC halved operator figures because operators count contractors | JLARC 598 |

**The binding constraint on schedule is transformers and grid interconnection, not civil works.** Model delay on the power side.

**Ohio's own credibility gap:** UVA Weldon Cooper / Joyce Foundation puts Ohio at ~22,300 construction but only **~4,500 permanent** jobs. The Ohio Chamber claims **17,300 permanent** — 3.8× higher. The two agree on construction and diverge violently on permanent. That gap is a finding in itself.

**Do not use:** PwC / Data Center Coalition's 7.5 multiplier (its job count is NAICS 518210, which includes web hosting and the self-employed), the Ohio Chamber (lobby, internally inconsistent), NetChoice, or JLL's 1.0–1.5 jobs/MW. Brookings is methodologically sound but discloses Amazon, Google, Meta and Microsoft as donors — cite the disclosure.

### The DHL collapse, quantified — and what it implies

| Measure | 2007 peak | Trough | Now |
|---|---|---|---|
| **QCEW covered employment** | **26,712** | **15,308** (2013) | still ~29% below peak |
| CBP private, all industry | — | **−48.9%** | — |
| LAUS employed | 23,415 | 15,299 (2013) | 21,093 |
| Unemployment | 4.8% | **19.7%** (Jan 2010) | 4.0% |
| Population | 42,656 (2008) | 41,805 (2014) | regained peak only in 2025 |

**The job base fell 43–49%. Population fell 2.0%.** Use QCEW covered employment, not LAUS — it is the better measure and it shows a deeper shock than the headline unemployment rate suggests. Seventeen years on, covered employment is still roughly 29% below its peak.

The hub itself is now sized: **NAICS 492 (couriers) ran 5,000–9,999 employees across 5–9 establishments through 2008, collapsing to 173 by 2010.** Transportation overall fell from 10,534 to 1,638, **−84.5%**.

**Expect the same asymmetry on the upside: a job boom will not mechanically add population.** This contradicts the standard economic-impact assumption and is a hard constraint on the model.

Two traps: per-capita income *rose* through the collapse because transfer payments masked it, so income is useless as a shock detector. And there is a **LAUS re-benchmark artifact** between Dec 2015 and Jan 2016 (+16.7% labor force in one month on flat population) — any pre/post-2016 comparison has to account for it.

### Housing is tight, but model it on the commute shed, not the town

Wilmington has **5,943 housing units against 5,567 households — 376 vacant, 6.3%**, and Clinton County permitted **zero multifamily units in every year checked**. Single-family permits ran 264 (2005) → 21 (2009 trough) → 102 (2025). Wilmington is also markedly **poorer than its own county**: $57,199 median household income against $70,407.

**But a tight local housing market does not mean a housing crunch.** LODES shows **62.9% of Clinton County jobs are already held by in-commuters**, drawn from 320 distinct home counties across the Cincinnati–Dayton–Columbus triangle:

| Home county | Share of Clinton jobs |
|---|---|
| Clinton | 37.1% |
| **Highland** | **12.2%** |
| Warren | 8.0% |
| Greene | 5.9% |
| Fayette | 5.0% |
| Montgomery | 3.9% |

A construction labor influx gets absorbed across an eleven-county shed rather than concentrating in a town of 12,620. **Model labor supply and housing demand on the shed.** Our earlier read — that 6.3% vacancy means housing cannot respond — was too strong.

### ⚠ The AWS parcel is in no current Census geography

The site was **annexed into Wilmington on 2025-08-07**, but Census shows Wilmington city at **12.942 sq mi in 2020, 2023 and 2024 — unchanged**. The annexation is absent from every published boundary vintage.

**So ACS 2020–2024, LODES 2023 and the Building Permits place file all describe a Wilmington that does not contain the project site.** That makes the pre/post baseline clean, which is useful — but any attempt to read the project's effects out of "Wilmington city" geography will silently miss them. 471 acres is +5.7% land area; **watch for ~13.68 sq mi in the next gazetteer** as your confirmation.

Two related traps: the **Air Park is inside Wilmington city limits, not Union Township** (Ohio cities are their own MCDs, so the township polygon explicitly excludes the city). And **CBP changed regimes in 2018** — pre-2018 files use `empflag` suppression classes with `emp=0`, 2018+ use noise infusion. Parsing both the same way **silently zeroes out the entire DHL hub**.

### ★ The school-funding loss saturates — and the saturation point is tiny

This is the strongest finding in the project, and it inverts the intuition everyone brings to the room.

Wilmington City Schools (IRN 045112) sits at an **18.395% state share**, above the 10% statutory floor. The formula was replicated exactly against the DEW workbook — local capacity per pupil recomputed to $6,607.84, matching to the penny, and state share to within $7.

| Quantity | Value |
|---|---|
| Local capacity per pupil, today | $6,607.84 |
| Floor binds at | $7,287.58 (= 0.90 × $8,097.31 base cost) |
| **Headroom** | **$679.74 per pupil** |
| Market value needed to exhaust it | **~$326M** |
| A $4B campus | ~$1.4B assessed = **12× past the floor** |
| **State aid loss** | **Caps at $1,348,238/yr** |

**That capped loss is identical at $0.5B, $1B, $2B and $4B.** Past roughly $326M of market value, the marginal data center dollar costs the district nothing further in state aid. "Bigger is worse for schools" is false beyond a threshold this town crossed long before AWS showed up.

This is exactly the kind of saturating non-linearity a glass-box model exists to surface, and no spreadsheet-and-vibes analysis will find it.

**But run both arms.** Ordinance O-25-73 grants a **100% real-property exemption for 30 years with a 30% PILOT**. Under a 100% exemption, taxable AV may rise by roughly **zero** — in which case the state-aid loss channel never fires at all, and the district instead receives the PILOT plus the ~$1M/yr compensation agreement its board approved on 2025-11-19. Both arms are defensible; the model should show both.

Also note Wilmington is already carrying a **$3,068,240 Temporary Transitional Aid Guarantee**, which may absorb part of any formula drop. Do not assume a clean 1:1 loss.

### Clinton County fiscal baseline

**Amazon already owns the parcel.** `PARCELID 285130201000000`, AMAZON DATA SERVICES INC, 1488 S US 68, **471.609 acres**, appraised **$6,092,700**, taxable $1,492,190, **still flagged CAUV**, current tax **$17,339.93/yr**. That is your "before" number, and it is a real one.

| District | IRN | Capacity AV | State share |
|---|---|---|---|
| **Wilmington City** | 045112 | $705,499,007 | **18.395%** |
| Blanchester Local | 046383 | $250,910,033 | 46.570% |
| Clinton-Massie Local | 046391 | $420,379,640 | 26.551% |
| East Clinton Local | 046409 | $224,918,170 | 53.478% |

**Tax base composition is the key input.** Clinton County's 2024 taxable base is **62.0% residential, 22.5% agricultural, 13.3% commercial, 2.3% industrial**. Commercial-and-industrial combined is only 15.6%, against 17.8% in Licking and 23.5% in Franklin. The base is **5.2× smaller than Licking's** and unusually agricultural, which makes a single data center an enormous *relative* shock.

Population has been **flat for fifteen years** (42,040 → 42,301). Unemployment is 3.1%, *below* Ohio — this is not a distressed labor market. The real gap is education: **BA+ attainment 19.3% against Ohio's 32.4%**.

### Corrections to earlier assumptions

- **Capacity% range was wrong.** Observed statewide range is **0.012541–0.025000** (n=609), not 0.0225–0.025
- **105 of 611 Ohio districts are already at the 10% floor.** The "lower of 3-year average and most recent" rule verified at 611/611 districts
- **The within-county DiD is contaminated.** Blanchester spans four counties, Clinton-Massie two, East Clinton three — and neighbouring counties revalue in different years. Restrict to Clinton-only parcels or add county×year fixed effects
- **Reappraisal: Clinton was TY2023, triennial update TY2026, next reappraisal 2030 — not 2029.** ODT moved 16 counties back a year in Jan 2026, so **2026 values hold for four years, TY2026–2029. Hard-code 4, not 3**
- The 2023 reappraisal moved Clinton's taxable value **+36.1%** against Ohio's +17.4%, with agricultural up **58.9%**
- **The county auditor is not a blocked source here.** Clinton's ArcGIS endpoint is live and freely queryable — 27,200 parcels, 82 fields including `Has_CAUV`, `Has_Abatement` and `Taxable_Total_100`. **Trap:** on all 54 abated parcels `Taxable == Appraised`, so the abatement flag is a marker only and cannot be used to compute abated value

### Agriculture: the prime-farmland claim holds, and is stronger than we thought

- **Clinton County has the highest average corn yields of any Ohio county** — 201.8 bu/ac over 11 years against Ohio's 177.3, ranked **#1 of 52**
- **76.2% prime farmland** against Ohio's 55.3%; **93.6% Class I–III** soils against 67.2%
- **92.3% of county land area is in farms**, third of 88 counties
- **Irrigated: 50 acres, 0.02%.** Irrigation competition is conclusively not a channel

**One tension to respect:** agronomically top-tier, but price signals are mid-pack — cash rent $170/ac sits *below* Ohio's $188, ranked 36th of 83. Safe framing is **"highest average corn yields of any Ohio county, 96% of soils prime or locally important."** Do not claim top-tier land prices. Use ~$13,000/ac market value (OSU Extension), not the Census of Agriculture's $8,247.

### Known corrections to earlier assumptions

- PJM Data Miner **cannot** supply capacity auction results or the interconnection queue. Use pjm.com XLSX
- The AEP Ohio data center tariff is **under appeal** at the Ohio Supreme Court, not settled
- The USGS NWIS groundwater endpoint is **dead**. Use the OGC API
- "Millions of gallons a day" is **wrong at our scale** — a 100 MW site is 0.27–0.87 Mgal/day
- Ohio row crops are effectively 100% rainfed, so irrigation competition is not a credible channel. Model land conversion and domestic-well drawdown instead

---

## 9. Open decisions

1. ~~**Air Park or greenfield?**~~ **Resolved by reality.** The real AWS proposal is greenfield on US 68, not the Air Park. 471 acres. Model that parcel.

2. **Who owns `coefficients.yaml`?** It has no shortcut and it decides whether a judge believes us. It needs a name next to it.

3. ~~**Utility structure.**~~ **Resolved: AES Ohio, investor-owned.** Not municipal, not a co-op, not AEP. So the Meeks IOU coefficient applies — **+5.2% residential, roughly $7/month**. Wilmington is in PJM's **DAY zone**, not AEP, so the AEP Schedule DCT tariff is irrelevant. AES Ohio has its own data center tariff in a settled rate case (PUCO 25-0958-EL-AIR) but **the terms are unverified** — model it as DCT-like and label the assumption rather than asserting AES's numbers.

4. **Which constraint do we model as binding — water or sewer?** The city's water plant has 1.2–1.8 MGD of headroom, but the **wastewater plant is running at 99% of design capacity**. AWS's own water draw is tiny. Our instinct to make this a water story was wrong; the real municipal chokepoint is sewer. Decide whether to model both or lead with sewer.

5. **AWS usage.** Serverless and static only — S3 and CloudFront for hosting, Lambda for the precomputed lever sweep, Bedrock for PDF extraction. **No VPCs, no containers, no RDS.** Deploy to us-east-1 and close the pitch with our own footprint: this simulation about data centers ran on a data center, in Loudoun County, on the same grid we are modeling.

---

## 10. Neutrality, and why it's now load-bearing

We are modeling a live, contested decision with a vote ten days out and litigation in progress. That raises the stakes on something we were already doing for credibility reasons.

**The glass box is the neutrality mechanism.** Every number showing its formula, source and uncertainty is what separates this from advocacy in either direction. Keep it.

**Our findings already cut both ways, and that is the proof.**

- Against the opposition framing: the city has been buying **7 MGD it has never half-used** for thirty years. A large water customer is something it has wanted for a long time. And the real municipal chokepoint is **sewer**, which AWS is paying ~$25M toward
- Against the developer framing: **a 30-year CRA for at least 100 permanent jobs on a $4B investment**, and the Meeks evidence says AES being investor-owned puts residential ratepayers in the worst bucket, around **+5.2%**
- Against the developer framing: Ohio's independent estimate is **~4,500 permanent data center jobs statewide** against the Ohio Chamber's **17,300** — a 3.8× gap, and the audit precedent says halve self-reported headcounts
- Against both: the MW figure is inferred from a PJM transmission need that never names the customer, and the **water figure is a developer claim 25–40× below independent norms**

The water number is the cleanest illustration of why the glass box matters. We initially treated ~6 MG/year as a finding that cut against the opposition. It is not a finding — it is an unverified claim from a party to the project, and it is far outside the range anyone else reports. Showing it **with its uncertainty band and its provenance** is the honest move, and it happens to be the most interesting cell in the whole model.

If the tool only ever confirms one side, it is propaganda with a chart on it. Showing a result that disappoints whoever is demoing it is the strongest credibility signal available.

**One practical note.** A hackathon demo is not campaign material, but given the Nov 3 vote, do not publish this publicly framed as a verdict on the referendums. Frame it as a method, demonstrated on a real case.

---

## Related

- **Data Source Guide** — where every dataset lives, auth, formats, gotchas, cleaning rules: https://claude.ai/artifact/XGwED8Vp2QiWfzMLdazHm2

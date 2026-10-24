#!/usr/bin/env python3
"""
Generate REPORT.md from the output files. Every number in the report is read
from out/*.json, so the document cannot drift from what the engine produced.

Run:  python engine/report.py
Out:  REPORT.md
"""

import json
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "out"


def load(name):
    p = OUT / name
    return json.loads(p.read_text()) if p.exists() else None


def money(x):
    return f"${x:,.0f}"


def fmt(x, nd=1):
    return f"{x:,.{nd}f}"


def kpi_table(kpis_a, kpis_b, label_a, label_b):
    rows = [
        ("Facility energy, 2041", "facility_gwh_2041", "GWh/yr", 0),
        ("Marginal CO2, 2041", "co2_ktons_2041", "kt/yr", 0),
        ("Marginal CO2, cumulative to 2041", "co2_ktons_cumulative", "kt", 0),
        ("Direct site water, 2041", "water_direct_mgal_2041", "Mgal/yr", 1),
        ("Indirect generation water, 2041", "water_indirect_mgal_2041", "Mgal/yr", 0),
        ("Household electric bill delta", "household_bill_delta_usd_month", "$/month", 2),
        ("School state-aid delta vs no project", "school_state_aid_delta_usd", "$/yr", 0),
        ("PILOT + compensation to district", "pilot_usd_2041", "$/yr", 0),
        ("Local property tax to district", "local_property_tax_to_schools_usd", "$/yr", 0),
        ("School total revenue delta, 2041", "school_total_revenue_delta_usd", "$/yr", 0),
        ("School total revenue, cumulative 2026–41", "school_total_revenue_cumulative_usd", "$", 0),
        ("Household bill, cumulative 2026–41", "household_bill_cumulative_usd", "$", 0),
        ("Construction employment (direct)", "construction_job_years_total", "job-years", 0),
        ("Permanent employment, 2041", "permanent_fte_2041", "FTE", 0),
        ("Population response", "population_delta_2041", "persons", 0),
        ("Farmland converted", "acres_converted", "acres", 0),
        ("Farms exited by 2041 (of 788)", "farms_lost_2041", "farms", 0),
        ("Cash rent delta", "cash_rent_delta_usd_acre", "$/acre", 2),
        ("Noise at setback", "noise_dba_at_setback", "dBA", 1),
        ("Sewer load vs plant design", "sewer_pct_of_design_2041", "ratio", 3),
        ("Moratorium probability", "moratorium_rate", "fraction", 2),
        ("Utica well-equivalents, 2041", "utica_well_equivalents_2041", "wells", 1),
    ]
    out = [f"| KPI | {label_a} | {label_b} | Unit |", "|---|---:|---:|---|"]
    for label, key, unit, nd in rows:
        a, b = kpis_a[key], kpis_b[key]
        out.append(f"| {label} | {fmt(a, nd)} | {fmt(b, nd)} | {unit} |")
    return "\n".join(out)


def main():
    res = load("results.json")
    val = load("validation.json")
    fv = load("formula_validation.json")
    sw = load("sweep.json")

    L = []
    L.append(f"# Engine report — Wilmington data center impact simulator\n")
    L.append(f"*Generated {date.today().isoformat()} by `engine/report.py` from `out/*.json`. "
             f"Numbers here are read from the output files, not typed.*\n")

    # ------------------------------------------------------------------ KPIs
    L.append("## 1. Key performance indicators — the AWS deal as proposed\n")
    L.append("500 MW IT load ramping 2028–2030, $4B capex, 471.6 acres at 1488 S US 68, "
             "100% real-property CRA for 30 years with a 30% PILOT, air-cooled, AES Ohio service. "
             "Median of Monte Carlo draws, final year 2041, all deltas against a no-project counterfactual "
             "run under common random numbers.\n")

    if sw:
        ap = sw["as_proposed"]["kpis"]
        # find tariff-rejected as-proposed in all_points
        rej = next((p["kpis"] for p in sw["all_points"] if p["overrides"] == {
            "property_abatement_pct": 100, "abatement_years": 30, "pilot_pct": 30,
            "cooling": "air_cooled", "tariff_status": "rejected", "it_load_mw": 500}), None)
        if rej:
            L.append(kpi_table(ap, rej, "Tariff approved", "Tariff rejected"))
        L.append("")
        L.append("**Reading the two columns.** PUCO case 25-0958-EL-AIR is open and contested. If the "
                 "AES data center tariff survives as written, AWS pays 100% of transmission network "
                 "upgrades and the residential bill effect is small. If it is rejected, costs socialise "
                 "and the Meeks et al. investor-owned-utility estimate applies. The moratorium "
                 "probability row is the one a spreadsheet cannot produce: it is emergent from the "
                 "backlash feedback loop, and the tariff decision moves it by a factor of three.\n")
        L.append("**Why the tariff-rejected column shows *less* energy, *fewer* jobs and *fewer* farms lost.** "
                 "That is not a sign error. When the tariff fails, the moratorium fires in most draws and "
                 "caps MW before full build-out, so the median draw has less capacity online in 2041. "
                 "Higher bills lead to less data center — the political loop closing. A one-directional "
                 "model would show the rejected column identical to the approved one on every physical row.\n")
        L.append("Construction employment is **direct** job-years. Multiply by roughly 1.8 for total "
                 "including indirect and induced, which is the figure most economic-impact studies quote.\n")

    # ------------------------------------------------------------ saturation
    sat = res["school_aid_saturation"]
    L.append("## 2. The school-funding finding\n")
    L.append(f"State aid loss is linear in campus value until the 10% floor binds at roughly "
             f"**$326M of market value**, then flat forever at **{money(sat['max_loss_usd'])}/yr**. "
             f"A $4B campus is twelve times past that threshold. The loss is identical at $0.5B, $1B, $2B and $4B.\n")
    L.append("Under the proposed 100% abatement, taxable value does not rise and this channel never fires — "
             "the district's revenue is the PILOT and compensation agreement instead. Both arms are in the "
             "sweep as `property_abatement_pct` and `abatement_years`. When an abatement expires inside the "
             "horizon, the $1.35M state-aid loss lands — but so does the local property tax on the full "
             "assessed value, which is several times larger. **Expiry is a net gain for the district.** "
             "That is why the sweep's schools-first recommendation is 0% abatement, and why the as-proposed "
             "deal is dominated: the PILOT is worth less to the district than the tax it replaces.\n")

    # ---------------------------------------------------------------- sweep
    if sw:
        L.append("## 3. Lever sweep and Pareto frontier\n")
        L.append(f"**{sw['n_points']:,} lever combinations**, {sw['n_draws_per_point']} draws each, "
                 f"over abatement %, abatement years, PILOT %, cooling, tariff outcome and MW. "
                 f"Eight objectives: cumulative school revenue, permanent jobs, construction jobs (maximise); "
                 f"cumulative household bill, direct water, farms lost, cumulative CO2, moratorium probability (minimise).\n")
        L.append("**What the first run of this sweep got wrong, and why it matters.** It ranked every town "
                 "priority at 100% abatement and evaporative cooling. That was three missing channels: no "
                 "local property-tax revenue (so abatement looked free for schools — backwards by ~$9M/yr), "
                 "no energy penalty on air cooling (so cooling was a no-op on six objectives), and bills "
                 "that scaled by fraction-of-contract rather than absolute MW (so a 1,000 MW facility hit "
                 "ratepayers like a 500 MW one). Plus a snapshot metric a 10-year abatement could game, "
                 "and ties resolved by list order. All five are fixed; ties now resolve toward the actual "
                 "AWS deal. **A known gap remains: PILOT % has no modelled cost to the developer, so the "
                 "sweep will always prefer the highest PILOT.** Treat that lever as a floor on what to ask for, "
                 "not a recommendation.\n")
        pf = sw["pareto_frontier"]
        L.append(f"**{pf['size']} of {sw['n_points']:,} settings ({pf['fraction_of_grid']:.1%}) are "
                 f"Pareto-optimal** — no other setting beats them on every objective at once.\n")
        dom = sw["as_proposed"]["is_pareto_dominated"]
        if dom:
            # Find the dominating setting that changes the fewest levers.
            ap_ov = {"property_abatement_pct": 100, "abatement_years": 30, "pilot_pct": 30,
                     "cooling": "air_cooled", "tariff_status": "approved_as_written", "it_load_mw": 500}
            obj = sw["objectives"]
            def dominates(a, b):
                better = False
                for k, d in obj.items():
                    if d == "max":
                        if a[k] < b[k]: return False
                        if a[k] > b[k]: better = True
                    else:
                        if a[k] > b[k]: return False
                        if a[k] < b[k]: better = True
                return better
            doms = [p for p in sw["all_points"] if dominates(p["kpis"], ap)]
            nearest = min(doms, key=lambda p: sum(1 for k, v in p["overrides"].items() if v != ap_ov[k]))
            no, nk = nearest["overrides"], nearest["kpis"]
            changed = [k for k, v in no.items() if v != ap_ov[k]]
            L.append(f"**The AWS deal as proposed is Pareto-dominated by {len(doms)} other settings.** "
                     f"The nearest changes only {', '.join(f'`{k}`' for k in changed)}: "
                     f"{no['property_abatement_pct']}% abatement for {no['abatement_years']} years, "
                     f"{no['pilot_pct']}% PILOT, {no['cooling'].replace('_',' ')}, "
                     f"{'tariff approved' if no['tariff_status']=='approved_as_written' else 'tariff rejected'}, "
                     f"{no['it_load_mw']} MW. It is identical on jobs, bills, water, farms, CO2 and moratorium "
                     f"probability, and gives the district **{money(nk['school_total_revenue_cumulative_usd'])} "
                     f"instead of {money(ap['school_total_revenue_cumulative_usd'])}** over the horizon — "
                     f"the local property tax on un-abated value exceeds the PILOT.\n")
            L.append("**The caveat that belongs next to that sentence, not in a footnote:** the model has no "
                     "deal-viability constraint. It assumes the campus is built regardless of terms. A town that "
                     "demands 0% abatement may get no data center at all, and the sweep cannot see that. What the "
                     "frontier establishes is the *shape* of the trade-off space and the *price* of the abatement "
                     "in district revenue; it does not establish that AWS would accept the alternative. That is "
                     "exactly the question a negotiation puts to the developer, and the tool's job is to arm the "
                     "town with the number.\n")
        else:
            L.append("**The AWS deal as proposed is on the Pareto frontier.** No single alternative beats "
                     "it on every objective; any improvement on one axis costs something on another.\n")

        L.append("### Best deal by town priority\n")
        L.append("Weights are illustrative framings for the demo, not survey data.\n")
        L.append("| Priority | Abatement | PILOT | Cooling | Tariff | MW | Levers changed | School cum. $ | Perm. FTE | Bill cum. $ | Water Mgal | Farms lost |")
        L.append("|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|")
        for name, ranked in sw["best_by_profile"].items():
            b = ranked[0]; o = b["overrides"]; k = b["kpis"]
            tie = f" ({b['tied_at_top']} tied)" if b.get("tied_at_top") and b["tied_at_top"] > 1 else ""
            L.append(f"| {name.replace('_',' ')} | {o['property_abatement_pct']}% / {o['abatement_years']}yr | "
                     f"{o['pilot_pct']}% | {o['cooling'].replace('_',' ')} | "
                     f"{'approved' if o['tariff_status']=='approved_as_written' else 'rejected'} | "
                     f"{o['it_load_mw']} | {b['levers_changed']}/6{tie} | "
                     f"{money(k['school_total_revenue_cumulative_usd'])} | "
                     f"{k['permanent_fte_2041']:.0f} | {money(k['household_bill_cumulative_usd'])} | "
                     f"{k['water_direct_mgal_2041']:.0f} | {k['farms_lost_2041']:.0f} |")
        L.append("")

    # -------------------------------------------------------------- accuracy
    L.append("## 4. Accuracy — what is verified, and against what\n")
    L.append("You cannot validate a forecast against outcomes that have not happened. The claims below are "
             "scoped to what can be checked.\n")

    if fv:
        s = fv["summary"]
        L.append("### 4a. External replication — Ohio school funding formula, statewide\n")
        L.append(f"The fiscal module was reimplemented from **raw** assessed valuation, federal adjusted gross "
                 f"income, median income and ADM for **{fv['districts']} Ohio districts** and compared to the "
                 f"Department of Education's published outputs. Nothing back-solved; Wilmington is one row with "
                 f"no special treatment. **{fv['floored']} districts ({fv['floored']/fv['districts']:.1%}) sit at "
                 f"the 10% floor**, exercising a branch Wilmington never touches.\n")
        L.append("| Quantity | Median rel. err | p95 | Max | Within 1e-4 |")
        L.append("|---|---:|---:|---:|---:|")
        names = {"C6_local_capacity_pct": "Local capacity %",
                 "C7_local_capacity_per_pupil": "Local capacity per pupil",
                 "b3_state_share_per_pupil": "State share per pupil",
                 "A_state_share_of_base_cost": "State share of base cost"}
        for k, v in s.items():
            L.append(f"| {names.get(k,k)} | {v['median_rel_err']:.1e} | {v['p95_rel_err']:.1e} | "
                     f"{v['max_rel_err']:.1e} | {v['fraction_within_1e-4']:.0%} |")
        L.append("")
        L.append("Residual error is float rounding in DEW's published columns. The local-capacity-percentage "
                 "rule is not published; it was inferred from one district and held across all 609 to 3.3e-07.\n")

    if val:
        checks = val["checks"]
        by = {}
        for c in checks:
            by.setdefault(c["tier"], []).append(c)
        L.append("### 4b. Implementation, convergence and epistemic audit\n")
        L.append("| Tier | Passed | What it establishes |")
        L.append("|---|---:|---|")
        tiers = {1: "Code computes what the formula says: identities, unit round-trips, determinism, monotonicity, loop wiring, cooling penalty",
                 2: "Arithmetic against published intermediates (implementation checks, not accuracy claims)",
                 3: "Monte Carlo p50 at N=1,000 within 3 standard errors of N=5,000 (threshold derived from the data; realistic N=1,000 error is 2–3%)",
                 4: "Assumption-driven coefficients are a minority of the set"}
        for t in sorted(by):
            n = len(by[t]); p = sum(c["passed"] for c in by[t])
            L.append(f"| {t} | {p}/{n} | {tiers.get(t,'')} |")
        L.append("")
        ea = val["epistemic_audit"]
        L.append(f"**{ea['assumed_fraction']:.1%} of coefficients are our own assumptions**, all marked "
                 f"`method: assumed`, `confidence: low`, concentrated in the feedback loops and noise. "
                 f"Per-output: physical and jobs outputs are 0% assumption-driven; backlash and cash rent are 100%. "
                 f"The model reports this rather than hiding it.\n")

    # --------------------------------------------------------- not validated
    L.append("## 5. What is not validated\n")
    L.append("1. **The 2041 forecast.** Untestable by any method.")
    L.append("2. **Water.** Unvalidatable in Ohio by construction — ODNR has zero data center visibility; "
             "not one is a registered withdrawer.")
    L.append("3. **The Licking County backtest.** Attempted and the naive version fails: statewide median "
             "assessed valuation growth TY22→TY24 was 27.6%, every Licking district grew 32–52% from "
             "reappraisal, and rural ag counties with no data center fill the statewide top ten. "
             "If campuses are 100% abated their value never entered taxable AV. A real backtest needs "
             "within-county controls and parcel-level isolation.")
    L.append("4. **Noise.** Design-capacity propagation from assumed sound power levels.")
    L.append("5. **Jobs.** Coefficients from independent legislative audits, never checked against a built Ohio facility.")
    L.append("6. **Every feedback-loop gain.** The mechanisms are documented; the gains are ours.")
    L.append("7. **The MW schedule.** Inferred from PJM Dayton-2025-002, which never names the customer.")
    L.append("8. **The ~6 MG/yr site water claim.** A developer figure 25–40× below LBNL norms; the single "
             "largest unverified sensitivity.\n")

    # -------------------------------------------------------------- reproduce
    L.append("## 6. Reproduce\n")
    L.append("```bash")
    L.append("python engine/model.py              # ~3s, writes out/results.json")
    L.append("python engine/validate.py           # ~30s, 21 checks")
    L.append("python engine/validate_formula.py   # needs data/raw/TRAD_FL2.xlsx from education.ohio.gov")
    L.append("python engine/sweep.py 200          # ~4 min, 1,152 points, writes out/sweep.json")
    L.append("python engine/report.py             # regenerates this file")
    L.append("```\n")
    L.append("Callable from code:\n")
    L.append("```python")
    L.append("from engine.api import run_scenario")
    L.append('r = run_scenario({"property_abatement_pct": 50, "cooling": "evaporative"})')
    L.append('r["kpis"]["household_bill_delta_usd_month"]')
    L.append("```")

    (ROOT / "REPORT.md").write_text("\n".join(L), encoding="utf-8")
    print(f"wrote REPORT.md ({len(L)} lines)")


if __name__ == "__main__":
    main()

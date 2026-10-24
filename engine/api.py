#!/usr/bin/env python3
"""
Callable API for the engine. This is what Lane C's lever panel calls.

    from engine.api import run_scenario
    r = run_scenario({"property_abatement_pct": 50, "cooling": "evaporative"})
    r["kpis"]["household_bill_delta_usd_month"]

Overrides are lever names from scenarios/aws_wilmington.json["levers"].
Anything not overridden is the as-proposed AWS deal. Returns a dict, never
writes a file. Loads baseline and coefficients once per process.
"""

import copy
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from model import load_inputs, monte_carlo, assemble

_CACHE = {}

LEVER_HOME = {
    "property_abatement_pct": "policy",
    "abatement_years": "policy",
    "pilot_pct": "policy",
    "noise_setback_ft": "policy",
    "cooling": "facility",
    "it_load_mw": "facility",
    "tariff_status": None,          # engine flag, not a scenario field
}


def _inputs():
    if "base" not in _CACHE:
        _CACHE["base"], _CACHE["coef"], _CACHE["scen"] = load_inputs()
    return _CACHE["base"], _CACHE["coef"], _CACHE["scen"]


def apply_overrides(scen, overrides):
    s = copy.deepcopy(scen)
    for k, v in (overrides or {}).items():
        home = LEVER_HOME.get(k, "MISSING")
        if home == "MISSING":
            raise KeyError(f"unknown lever {k!r}; known: {sorted(LEVER_HOME)}")
        if home is None:
            continue
        s[home][k] = v

    # it_load_mw rescales the phase schedule AND capex proportionally. The
    # first sweep left capex fixed at $4B for every MW setting, so PILOT and
    # construction jobs did not move with facility size.
    if "it_load_mw" in (overrides or {}):
        factor = overrides["it_load_mw"] / scen["facility"]["it_load_mw"]
        for ph in s["facility"]["phases"]:
            ph["mw_online"] = round(ph["mw_online"] * factor, 1)
        s["facility"]["capex_usd"] = scen["facility"]["capex_usd"] * factor
    return s


def extract_kpis(years, meta, n_draws):
    """The headline numbers, flat, one row per scenario. What the sweep
    ranks on and what the report tabulates."""
    final = years[-1]
    v = lambda k: final[k]["value"]
    d = lambda k: final[k]["delta"]
    mor = [m["moratorium_year"] for m in meta if m["moratorium_year"]]

    school_delta = d("school_state_funding_usd")
    pilot = v("pilot_received_usd")
    local_tax = v("local_property_tax_to_schools_usd")

    # Cumulative versions. The first sweep ranked on 2041 snapshots, which
    # let "100% abatement for 10 years" game the school metric: by 2041 the
    # abatement has expired so it looks like 0%, but it also banked a decade
    # of PILOT. Summing over the horizon measures the deal, not the endpoint.
    cum_school = sum(y["school_state_funding_usd"]["delta"]
                     + y["pilot_received_usd"]["value"]
                     + y["local_property_tax_to_schools_usd"]["value"] for y in years)
    cum_bill = sum(y["household_bill_delta_usd_month"]["value"] * 12.0 for y in years)

    return {
        # energy / emissions
        "facility_gwh_2041": v("facility_mwh") / 1000.0,
        "co2_ktons_2041": v("marginal_co2_tons") / 1000.0,
        "co2_ktons_cumulative": sum(y["marginal_co2_tons"]["value"] for y in years) / 1000.0,
        # water
        "water_direct_mgal_2041": v("water_direct_mgal"),
        "water_indirect_mgal_2041": v("water_indirect_mgal"),
        # ratepayer
        "household_bill_delta_usd_month": v("household_bill_delta_usd_month"),
        # fiscal
        "school_state_aid_delta_usd": school_delta,
        "pilot_usd_2041": pilot,
        "local_property_tax_to_schools_usd": local_tax,
        "school_total_revenue_delta_usd": school_delta + pilot + local_tax,
        "school_total_revenue_cumulative_usd": cum_school,
        "household_bill_cumulative_usd": cum_bill,
        # jobs
        "construction_job_years_total": sum(y["construction_fte_years"]["value"] for y in years),
        "permanent_fte_2041": v("permanent_fte"),
        "population_delta_2041": v("population_delta"),
        # land
        "acres_converted": v("acres_converted"),
        "farms_lost_2041": 788.0 - v("farms_remaining"),
        "cash_rent_delta_usd_acre": v("cash_rent_usd_per_acre") - 170.0,
        # nuisance / constraint
        "noise_dba_at_setback": v("noise_dba_at_setback"),
        "sewer_pct_of_design_2041": v("sewer_pct_of_design"),
        # feedback
        "moratorium_rate": len(mor) / n_draws,
        "backlash_index_2041": v("backlash_index"),
        # upstream
        "utica_well_equivalents_2041": v("utica_well_equivalents"),
    }


def run_scenario(overrides=None, n_draws=200, counterfactual=None, loops_on=True):
    """Run one lever setting. Returns {"overrides", "kpis", "years", "feedback"}.

    counterfactual: pass a precomputed list from a prior call to skip
    recomputing it (it is identical across lever settings under CRN).
    """
    base, coef, scen = _inputs()
    overrides = overrides or {}
    s = apply_overrides(scen, overrides)
    tariff_holds = overrides.get("tariff_status", "approved_as_written") == "approved_as_written"

    if counterfactual is None:
        proj, counter, meta = monte_carlo(base, coef, s, tariff_holds, loops_on, n=n_draws)
    else:
        proj, _, meta = monte_carlo(base, coef, s, tariff_holds, loops_on, n=n_draws,
                                    with_counterfactual=False)
        counter = counterfactual

    years = assemble(proj, counter)
    return {
        "overrides": overrides,
        "n_draws": n_draws,
        "kpis": extract_kpis(years, meta, n_draws),
        "years": years,
        "counterfactual": counter,
    }


if __name__ == "__main__":
    import json
    r = run_scenario({}, n_draws=200)
    print(json.dumps(r["kpis"], indent=2))

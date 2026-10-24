#!/usr/bin/env python3
"""
Data center impact engine — Wilmington, Ohio.  v1.0

A deterministic causal system-dynamics model, not a machine-learning model.
Annual timestep, 15-year horizon, Monte Carlo over coefficient uncertainty.

Design rules:
  - Every output carries value / unit / formula / source / low / high.
  - The counterfactual runs in the same call and ships in the same payload.
  - Coefficients come from data/coefficients.yaml and are sampled, never
    hardcoded here. If you find yourself typing a number into this file, it
    belongs in the yaml with a source.
  - Feedback loops are stateful: this is what separates a simulation from a
    spreadsheet. A one-directional model silently asserts every loop gain is
    zero, which is a stronger claim than admitting we don't know the gain.

Run:  python engine/model.py [n_draws]
Out:  out/results.json
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
import yaml

ROOT = Path(__file__).resolve().parent.parent
N_DRAWS = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
SEED = 20261024

# On N_DRAWS, with the measurement rather than the intuition:
#
#   N        runtime   p50 bill delta   sampling SE of p50
#   1,000      3 s        ~$1.18            ~2.4%
#   10,000    22 s        ~$1.18            ~0.7%
#
# An earlier version of this comment reported 0.29% drift at N=1,000. That
# was one RNG sequence; adding coefficients shifted the draws and the next
# sequence showed 3.3%. The realistic figure is 2-3%, and it is sequence
# dependent. More draws shrink SAMPLING error as 1/sqrt(N) but do nothing
# about the dominant error, which is that 15 of 50 coefficient bands are
# frank guesses. 10x the draws costs 7x the runtime to tighten a 2% band
# around a number whose assumptions carry 9x bands. Default is 1,000.
#
# What actually matters for a lever sweep is COMMON RANDOM NUMBERS: every
# arm re-seeds identically, so differences between arms are signal rather
# than sampling noise. That beats raising N, and it is already in place.
#
# If the Pareto sweep ever becomes the bottleneck, the fix is vectorising
# this loop in NumPy, not cutting draws.

L_PER_MGAL = 3.785e6
FT_PER_M = 3.28084


# --------------------------------------------------------------------------
# provenance
# --------------------------------------------------------------------------

def Q(value, unit, formula, source, low=None, high=None,
      method="physical", confidence="medium", note=None):
    q = {"value": value, "unit": unit, "formula": formula,
         "source": source, "method": method, "confidence": confidence}
    if low is not None:
        q["low"], q["high"] = low, high
    if note:
        q["note"] = note
    return q


def band(samples, unit, formula, source, method="empirical",
         confidence="medium", note=None):
    a = np.asarray(samples, dtype=float)
    return Q(float(np.percentile(a, 50)), unit, formula, source,
             low=float(np.percentile(a, 10)), high=float(np.percentile(a, 90)),
             method=method, confidence=confidence, note=note)


# --------------------------------------------------------------------------
# inputs
# --------------------------------------------------------------------------

def load_inputs(scenario_name="aws_wilmington"):
    base = json.loads((ROOT / "data" / "baseline_wilmington.json").read_text())
    coef = yaml.safe_load((ROOT / "data" / "coefficients.yaml").read_text())
    scen = json.loads((ROOT / "scenarios" / f"{scenario_name}.json").read_text())
    return base, coef, scen


def nominal(coef):
    return {k: v["value"] for k, v in coef.items()
            if isinstance(v, dict) and "value" in v}


def sample(coef, rng):
    """One coefficient draw. Uniform over [low, high] — we have ranges, not
    distributions, and inventing a shape would be false precision."""
    out = {}
    for k, v in coef.items():
        if not isinstance(v, dict) or "value" not in v:
            continue
        val = v["value"]
        if isinstance(val, bool) or val is None or not isinstance(val, (int, float)):
            out[k] = val
            continue
        lo, hi = v.get("low", val), v.get("high", val)
        out[k] = float(rng.uniform(lo, hi)) if hi > lo else float(val)
    return out


def scheduled_mw(scen, year):
    mw = 0.0
    for ph in scen["facility"]["phases"]:
        if year >= ph["year"]:
            mw = max(mw, float(ph["mw_online"]))
    return mw


# --------------------------------------------------------------------------
# channels
# --------------------------------------------------------------------------

def energy_mwh(mw, c, cooling="air_cooled"):
    """The identity everyone gets wrong by assuming 100% utilization.

    Air cooling trades water for energy. The first sweep showed cooling as a
    no-op on six of seven objectives because this penalty was documented in
    the coefficient file but never applied here.
    """
    pue = c["pue_new_hyperscale"]
    if cooling == "air_cooled":
        pue *= 1.0 + c["air_cooled_pue_penalty"]
    elif cooling == "hybrid":
        pue *= 1.0 + 0.5 * c["air_cooled_pue_penalty"]
    return mw * pue * 8760.0 * c["load_factor"]


def wue_for(scen, c):
    """Water use effectiveness switches on cooling choice — one of the
    largest single levers in the model."""
    cooling = scen["facility"]["cooling"]
    if cooling == "evaporative":
        return c["water_l_per_kwh_evaporative"]
    if cooling == "hybrid":
        return 0.5 * (c["water_l_per_kwh_evaporative"] + c["water_l_per_kwh_closed_loop"])
    return c["water_l_per_kwh_closed_loop"]


def bill_delta(mw, scen, c, tariff_holds):
    """Residential bill impact.

    The AES tariff assigns 100% of transmission network upgrade cost to the
    customer. If it survives the PUCO order as written, the Meeks IOU estimate
    becomes an UPPER bound rather than a central case, because most utilities
    in that 2010-2024 sample had no such tariff.
    """
    if mw <= 0:
        return 0.0
    # Scale by ABSOLUTE size against a reference facility, not by fraction of
    # contract. The first sweep used mw / contract, which is 1.0 at full build
    # for any contract — so a 1,000 MW facility hit ratepayers exactly like a
    # 500 MW one and the MW lever was free.
    scale = mw / c["bill_reference_mw"]
    monthly = c["household_bill_delta_iou"]
    if tariff_holds:
        monthly *= c["residual_bill_share_under_tariff"]
    return monthly * scale


def school_finance(campus_market_value, base, c, abatement_pct):
    """Ohio ORC 3317.017, implemented exactly.

    Two quirks that are easy to get wrong and both matter:
      - AV per pupil uses BASE COST enrolled ADM
      - the funding multiplication uses ENROLLED ADM
    They are different numbers.

    Returns (state_funding, local_capacity_per_pupil, floor_binds).
    """
    sd = base["school_district"]
    cap_av = sd["capacity_av_usd"]["value"]
    bc_adm = sd["base_cost_enrolled_adm"]["value"]
    adm = sd["enrolled_adm"]["value"]
    cap_pct = sd["capacity_pct"]["value"]
    bcpp = sd["base_cost_per_pupil_usd"]["value"]
    lcpp_now = sd["local_capacity_per_pupil_usd"]["value"]

    # Back out the income terms (0.20 FAGI local + 0.20 FAGI median) from the
    # published local capacity. They do not move with the data center.
    income_terms = lcpp_now / cap_pct - 0.60 * (cap_av / bc_adm)

    taxable_added = campus_market_value * c["ohio_assessment_ratio"] * (1.0 - abatement_pct / 100.0)
    lcpp = cap_pct * (0.60 * ((cap_av + taxable_added) / bc_adm) + income_terms)

    uncapped = (bcpp - lcpp) * adm
    floor = c["school_state_aid_floor"] * bcpp * adm
    return max(uncapped, floor), lcpp, uncapped < floor


def construction_fte(scen, year, c):
    """THE error this guards against: only ~20% of headline capex is
    construction. Multiplying $4B by a jobs coefficient inflates ~5x."""
    ph = scen["facility"]["phases"]
    first, last = ph[0]["year"], ph[-1]["year"]
    if not (first - 2 <= year <= last):
        return 0.0
    span = max(last - (first - 2), 1)
    spend_musd = scen["facility"]["capex_usd"] * c["capex_construction_share"] / 1e6
    return spend_musd * c["construction_jobs_per_musd_construction"] / span


def noise_dba(mw, scen, c):
    """Simplified ISO 9613-2 point-source propagation.

    Lp = Lw + 10*log10(N) - 20*log10(r) - 8 - A_ground

    Full ISO 9613-2 is paywalled and its extra terms (meteorology, barriers,
    foliage) need site plans we do not have. Inverse-square plus ground
    attenuation is defensible for a contour, not for a permit.
    """
    if mw <= 0:
        return 0.0
    setback_m = scen["policy"].get("noise_setback_ft", 500) / FT_PER_M
    n_chillers = max(1, int(mw / 10))          # order-of-magnitude scaling
    lw = c["chiller_sound_power_dba"] + 10 * math.log10(n_chillers)
    return lw - 20 * math.log10(max(setback_m, 1.0)) - 8 - c["ground_attenuation_db"]


def noise_radius_m(target_dba, mw, scen, c):
    """Invert the propagation model to get a contour radius."""
    if mw <= 0:
        return 0.0
    n_chillers = max(1, int(mw / 10))
    lw = c["chiller_sound_power_dba"] + 10 * math.log10(n_chillers)
    excess = lw - 8 - c["ground_attenuation_db"] - target_dba
    return 10 ** (excess / 20.0)


def upstream(mwh, c):
    """Gas burn and its well-equivalent. PJM marginal units are predominantly
    gas, so marginal load pulls through to the Utica."""
    mmbtu = mwh * 1000.0 * c["marginal_heat_rate_btu_per_kwh"] / 1e6
    mcf = mmbtu * 1e6 / c["gas_btu_per_mcf"]
    return mcf, mcf / c["utica_well_lifetime_mcf"]


# --------------------------------------------------------------------------
# one full run, with feedback
# --------------------------------------------------------------------------

def run_once(base, scen, c, with_project=True, tariff_holds=True, loops_on=True):
    years = list(range(scen["horizon"]["start_year"], scen["horizon"]["end_year"] + 1))
    rows = []

    # --- persistent state: this is what makes it a simulation -------------
    backlash = 0.0
    moratorium_year = None
    mw_capped_at = None
    land_index = 1.0
    farms = base["agriculture"]["county_farms"]["value"]
    sewer_used = base["wastewater"]["mean_monthly_avg_mgd"]["value"]
    sewer_design = base["wastewater"]["wwtp_design_mgd"]["value"]

    rent0 = base["agriculture"]["cash_rent_usd_per_acre"]["value"]
    prev_rent = rent0
    full_mw = scen["facility"]["it_load_mw"]

    for y in years:
        mw = scheduled_mw(scen, y) if with_project else 0.0

        # LOOP 2: political backlash caps further expansion.
        if loops_on and moratorium_year is not None:
            mw = min(mw, mw_capped_at)

        mwh = energy_mwh(mw, c, scen["facility"]["cooling"])
        wue = wue_for(scen, c)
        market_value = scen["facility"]["capex_usd"] if (with_project and mw > 0) else 0.0

        # Abatement expires. Before this, abatement_years was a declared lever
        # that nothing read, so a 10-year and a 30-year CRA produced identical
        # output. With the AWS ramp starting 2028, a 10-year term expires 2038
        # inside the horizon and the full taxable value then hits the formula.
        abate = 0
        if with_project and mw > 0:
            first_year = scen["facility"]["phases"][0]["year"]
            if (y - first_year) < scen["policy"]["abatement_years"]:
                abate = scen["policy"]["property_abatement_pct"]

        state_funding, lcpp, floor_binds = school_finance(market_value, base, c, abate)
        bill = bill_delta(mw, scen, c, tariff_holds) if with_project else 0.0

        # --- LOOP 1: land speculation -> cash rent -> farm exit ------------
        # Farms respond to a CHANGE in rent, not to its level. The first
        # version applied the exit rate to the full rent rise every year,
        # which compounded a one-time adjustment into perpetual exit and
        # produced a median of 241 farms left out of 788 — a 70% wipeout
        # from one 471-acre campus. That is indefensible and it shipped
        # because nobody looked at the magnitude.
        #
        # Still a simplification: the land premium is applied county-wide,
        # which overstates the footprint of a single site. Confidence low.
        rent = rent0
        farms_lost = 0.0
        if loops_on and mw > 0:
            land_index = 1.0 + c["land_value_premium_pct_per_100mw"] * (mw / 100.0)
            rent = rent0 * (1.0 + (land_index - 1.0) * c["cash_rent_passthrough"])
            rent_change_pct = (rent - prev_rent) / rent0 * 100.0
            farms_lost = farms * c["farm_exit_rate_per_rent_pct"] * max(rent_change_pct, 0.0)
            farms = max(farms - farms_lost, 0.0)
        prev_rent = rent

        # --- LOOP 3: sewer headroom ---------------------------------------
        sanitary_mgd = mw * c["sanitary_gal_per_mw_day"] / 1e6
        sewer_total = sewer_used + sanitary_mgd
        sewer_pct = sewer_total / sewer_design

        # --- LOOP 2 accumulation -------------------------------------------
        # Decay matters. Without it the index is an unbounded cumulative sum
        # and a moratorium fires in ~92% of draws regardless of inputs, which
        # is as uninformative as having no loop. With decay the index settles
        # at (bill * gain / decay), so the loop DISCRIMINATES: it fires when
        # bills rise enough to sustain opposition, not merely because the
        # simulation ran long enough.
        if loops_on and with_project:
            pressure = bill * c["backlash_index_per_usd_bill"]
            if sewer_pct > 1.0:
                pressure += (sewer_pct - 1.0)
            backlash = backlash * (1.0 - c["backlash_decay_per_year"]) + pressure
            if backlash >= c["moratorium_threshold"] and moratorium_year is None:
                moratorium_year, mw_capped_at = y, mw

        # Three district revenue channels, which the first sweep showed must
        # all be present or abatement looks free:
        #   local_tax  — the un-abated share of full property tax, times the
        #                district's share of millage
        #   pilot      — a payment in lieu of the ABATED share only; no
        #                abatement means nothing is in lieu of anything
        #   comp       — the fixed compensation agreement
        pilot = 0.0
        local_tax_schools = 0.0
        if with_project and mw > 0:
            site = scen["site"]
            eff_rate = site["pre_project_annual_tax_usd"] / site["pre_project_taxable_usd"]
            full_tax = market_value * c["ohio_assessment_ratio"] * eff_rate
            abated_frac = abate / 100.0
            local_tax_schools = full_tax * (1.0 - abated_frac) * c["school_share_of_property_tax"]
            pilot = full_tax * abated_frac * scen["policy"]["pilot_pct"] / 100.0
            pilot += scen["policy"]["school_compensation_agreement_usd_per_year"]

        constr = construction_fte(scen, y, c) if with_project else 0.0
        perm = mw * c["permanent_jobs_per_mw"]
        mcf, wells = upstream(mwh, c) if mwh > 0 else (0.0, 0.0)

        rows.append({
            "year": y,
            "mw_online": mw,
            "mw_scheduled": scheduled_mw(scen, y) if with_project else 0.0,
            "facility_mwh": mwh,
            "marginal_co2_tons": mwh * c["marginal_co2_lb_per_mwh"] / 2000.0,
            "water_direct_mgal": mwh * wue * 1000.0 / L_PER_MGAL,
            "water_indirect_mgal": mwh * c["water_indirect_l_per_kwh"] * 1000.0 / L_PER_MGAL,
            "household_bill_delta_usd_month": bill,
            "school_state_funding_usd": state_funding,
            "local_capacity_per_pupil_usd": lcpp,
            "floor_binds": floor_binds,
            "pilot_received_usd": pilot,
            "local_property_tax_to_schools_usd": local_tax_schools,
            "acres_converted": scen["site"]["acres"] if (with_project and mw > 0) else 0.0,
            "cash_rent_usd_per_acre": rent,
            "farms_remaining": farms,
            "construction_fte_years": constr,
            "permanent_fte": perm,
            "population_delta": perm * c["population_response_to_jobs"],
            "noise_dba_at_setback": noise_dba(mw, scen, c) if with_project else 0.0,
            "sewer_pct_of_design": sewer_pct,
            "backlash_index": backlash,
            "upstream_gas_mcf": mcf,
            "utica_well_equivalents": wells,
        })

    return rows, {"moratorium_year": moratorium_year, "mw_capped_at": mw_capped_at}


# --------------------------------------------------------------------------
# monte carlo + assembly
# --------------------------------------------------------------------------

METRICS = {
    "facility_mwh": ("MWh", "mw * pue * 8760 * load_factor", "pue_new_hyperscale, load_factor"),
    "marginal_co2_tons": ("short tons CO2", "mwh * 1757.4 lb/MWh / 2000", "eGRID2023rev2 RFCW non-baseload"),
    "water_direct_mgal": ("Mgal/yr", "mwh * wue(cooling) / 3.785e6", "water_l_per_kwh_* by cooling type"),
    "water_indirect_mgal": ("Mgal/yr", "mwh * 4.52 L/kWh / 3.785e6", "LBNL 2024 indirect intensity"),
    "household_bill_delta_usd_month": ("USD/month", "meeks_iou * residual_share * mw_share", "Meeks et al. 2026 + AES tariff"),
    "school_state_funding_usd": ("USD/yr", "max((bcpp - lcpp) * adm, 0.10 * bcpp * adm)", "ORC 3317.017 + DEW FY26 SFPR"),
    "pilot_received_usd": ("USD/yr", "full_tax * abated_frac * pilot_pct + compensation", "Ordinance O-25-73"),
    "local_property_tax_to_schools_usd": ("USD/yr", "full_tax * (1 - abated_frac) * school_share", "parcel effective rate + school_share_of_property_tax"),
    "construction_fte_years": ("FTE-years", "capex * 0.196 * 4.75 / span", "JLARC 598 + GA/UGA multipliers"),
    "permanent_fte": ("FTE", "mw * permanent_jobs_per_mw", "JLARC / bottom-up"),
    "population_delta": ("persons", "permanent_fte * population_response", "DHL natural experiment"),
    "cash_rent_usd_per_acre": ("USD/acre", "rent0 * (1 + land_premium * passthrough)", "LOOP 1 — assumed gains"),
    "farms_remaining": ("farms", "farms * (1 - exit_rate * rent_rise)", "LOOP 1 — assumed gains"),
    "noise_dba_at_setback": ("dBA", "Lw + 10log10(N) - 20log10(r) - 8 - A_ground", "simplified ISO 9613-2"),
    "sewer_pct_of_design": ("fraction", "(baseline + mw * gal/MW/day) / design", "EPA ECHO DMRs + assumed sanitary load"),
    "backlash_index": ("index", "cumulative bill delta * gain + sewer overage", "LOOP 2 — assumed gains"),
    "upstream_gas_mcf": ("Mcf", "mwh * heat_rate / gas_btu", "marginal_heat_rate_btu_per_kwh"),
    "utica_well_equivalents": ("wells", "mcf / well_lifetime_mcf", "utica_well_lifetime_mcf"),
    "acres_converted": ("acres", "site acres once any MW is online", "Clinton County Auditor parcel 285130201000000"),
}

ASSUMPTION_DRIVEN = {"cash_rent_usd_per_acre", "farms_remaining", "backlash_index",
                     "noise_dba_at_setback", "sewer_pct_of_design"}


def monte_carlo(base, coef, scen, tariff_holds=True, loops_on=True, n=None,
                with_counterfactual=True):
    """Common random numbers: the rng is re-seeded identically on every call,
    so the counterfactual is byte-identical across lever settings. The sweep
    computes it once and passes with_counterfactual=False thereafter."""
    rng = np.random.default_rng(SEED)
    proj, counter, meta = [], [], []
    for _ in range(n or N_DRAWS):
        c = sample(coef, rng)
        p, m = run_once(base, scen, c, True, tariff_holds, loops_on)
        proj.append(p); meta.append(m)
        if with_counterfactual:
            q, _ = run_once(base, scen, c, False, tariff_holds, loops_on)
            counter.append(q)
    return proj, counter, meta


def assemble(proj, counter):
    out = []
    for i, _ in enumerate(proj[0]):
        rec = {"year": proj[0][i]["year"], "mw_online": proj[0][i]["mw_online"]}
        for m, (unit, formula, src) in METRICS.items():
            w = [d[i][m] for d in proj]
            wo = [d[i][m] for d in counter]
            conf = "low" if m in ASSUMPTION_DRIVEN else "medium"
            rec[m] = band(w, unit, formula, src, confidence=conf)
            rec[m]["counterfactual"] = float(np.percentile(wo, 50))
            rec[m]["delta"] = float(np.percentile([a - b for a, b in zip(w, wo)], 50))
        rec["floor_binds"] = proj[0][i]["floor_binds"]
        out.append(rec)
    return out


# --------------------------------------------------------------------------
# geo, ledgers, saturation, tornado
# --------------------------------------------------------------------------

def geo(base, scen, coef):
    """Payload for deck.gl.

    COORDINATES ARE APPROXIMATE. Real parcel geometry is available free from
    the Clinton County Auditor ArcGIS FeatureServer (27,200 parcels, 82
    fields) — swap it in before anything goes on a slide claiming precision.
    """
    c = nominal(coef)
    site = [-83.825, 39.425]
    mw = scen["facility"]["it_load_mw"]
    acres = scen["site"]["acres"]
    side_deg = math.sqrt(acres * 4046.86) / 111_000.0
    h = side_deg / 2

    return {
        "_warning": "All coordinates approximate. Replace with Clinton County Auditor parcel geometry.",
        "site_centroid": site,
        "campus_footprint": {
            "type": "Polygon",
            "_approximate": True,
            "coordinates": [[[site[0] - h, site[1] - h], [site[0] + h, site[1] - h],
                             [site[0] + h, site[1] + h], [site[0] - h, site[1] + h],
                             [site[0] - h, site[1] - h]]],
        },
        "noise_contours": [
            {"dba": d, "radius_m": round(noise_radius_m(d, mw, scen, c), 1), "_approximate": True}
            for d in (65, 60, 55, 50)
        ],
        "transmission_corridor": {
            "type": "LineString", "_approximate": True,
            "name": "Clinton-Fayette 345 kV, 27 mi, $187M, in service 2030",
            "coordinates": [[-83.78, 39.44], [-83.56, 39.65]],
        },
        "burden_arcs": [
            {"to": [-81.00, 39.97], "county": "Belmont", "kind": "utica_gas", "_approximate": True},
            {"to": [-81.05, 39.72], "county": "Monroe", "kind": "utica_gas", "_approximate": True},
            {"to": [-81.09, 40.29], "county": "Harrison", "kind": "utica_gas", "_approximate": True},
        ],
        "burden_note": (
            "Capacity-market cost does NOT spread by distance. There were zero "
            "constrained LDAs in the 2027/28 and 2028/29 PJM auctions, so the "
            "AEP and DAY zones paid the RTO-wide price and the cost is borne "
            "across all 13 PJM states. The arcs above show the GAS supply chain, "
            "not the ratepayer burden."
        ),
    }


def ledgers(years, base, scen, coef):
    """Five household archetypes. Numbers plus faces."""
    c = nominal(coef)
    final = years[-1]
    bill_yr = final["household_bill_delta_usd_month"]["value"] * 12.0
    rent = final["cash_rent_usd_per_acre"]["value"]
    rent0 = base["agriculture"]["cash_rent_usd_per_acre"]["value"]
    adm = base["school_district"]["enrolled_adm"]["value"]
    per_pupil = final["school_state_funding_usd"]["delta"] / adm
    comp_per_pupil = scen["policy"]["school_compensation_agreement_usd_per_year"] / adm

    return [
        {"archetype": "cash_rent_farmer", "label": "Rents 400 acres nearby",
         "annual_delta_usd": round(-(rent - rent0) * 400, 2),
         "components": {"cash_rent_increase": round(-(rent - rent0) * 400, 2)},
         "note": "A renter pays the premium. A landowner collects it — opposite sign.",
         "confidence": "low"},
        {"archetype": "landowning_farmer", "label": "Owns 400 acres nearby",
         "annual_delta_usd": round((rent - rent0) * 400, 2),
         "components": {"cash_rent_income": round((rent - rent0) * 400, 2)},
         "note": "The farm community is not one interest. This split is the point.",
         "confidence": "low"},
        {"archetype": "fixed_income_retiree", "label": "Fixed income, owns in town",
         "annual_delta_usd": round(-bill_yr, 2),
         "components": {"electric_bill": round(-bill_yr, 2)},
         "note": "No wage exposure, so bears cost without the job upside.",
         "confidence": "medium"},
        {"archetype": "construction_worker", "label": "Trades, works the build",
         "annual_delta_usd": round(c["construction_wage_usd_per_year"] - bill_yr, 2),
         "components": {"wages_during_build": c["construction_wage_usd_per_year"],
                        "electric_bill": round(-bill_yr, 2)},
         "note": "Temporary. 12-18 months per building, then it ends. Wage is a placeholder range pending a BLS OES cite.",
         "confidence": "low"},
        {"archetype": "in_commuter", "label": "Takes a permanent job, lives in Highland County",
         "annual_delta_usd": 0.0,
         "components": {},
         "note": ("62.9% of Clinton County jobs are already held by in-commuters. "
                  "This worker's wage leaves the county and they pay no Wilmington "
                  "electric bill — the benefit exports, the cost does not."),
         "confidence": "medium"},
        {"archetype": "school_family", "label": "Two children in Wilmington City Schools",
         "annual_delta_usd": round((per_pupil + comp_per_pupil) * 2, 2),
         "components": {"per_pupil_state_funding_delta": round(per_pupil, 2),
                        "per_pupil_compensation_agreement": round(comp_per_pupil, 2)},
         "note": ("Under the 100% CRA the state-aid channel never fires, so the first "
                  "component is zero by construction. The district's revenue comes from "
                  "the ~$1M/yr compensation agreement its board approved 2025-11-19, "
                  "shown as the second component. An earlier version omitted it and "
                  "reported $0, which was wrong."),
         "confidence": "medium"},
    ]


def saturation_curve(base, coef):
    c = nominal(coef)
    baseline, _, _ = school_finance(0.0, base, c, 0)
    pts = []
    for mv in [0, 50e6, 100e6, 150e6, 200e6, 250e6, 300e6, 326e6,
               400e6, 500e6, 1e9, 2e9, 4e9]:
        f, lcpp, binds = school_finance(mv, base, c, 0)
        pts.append({"market_value_usd": mv, "state_funding_usd": round(f, 2),
                    "loss_usd": round(baseline - f, 2),
                    "local_capacity_per_pupil_usd": round(lcpp, 2),
                    "floor_binds": binds})
    return {"baseline_state_funding_usd": round(baseline, 2),
            "max_loss_usd": max(p["loss_usd"] for p in pts),
            "note": "Linear to the threshold, then FLAT. Identical at $1B, $2B and $4B.",
            "points": pts}


def tornado(base, coef, scen, target="household_bill_delta_usd_month", year=2035):
    nom = nominal(coef)
    idx = year - scen["horizon"]["start_year"]

    def tgt(cc):
        return run_once(base, scen, cc, True, True, True)[0][idx][target]

    base_val, res = tgt(nom), []
    for k, v in coef.items():
        if not isinstance(v, dict) or "low" not in v:
            continue
        if not isinstance(v.get("value"), (int, float)) or isinstance(v.get("value"), bool):
            continue
        lo_c, hi_c = dict(nom), dict(nom)
        lo_c[k], hi_c[k] = v["low"], v["high"]
        lo, hi = tgt(lo_c), tgt(hi_c)
        if abs(hi - lo) > 1e-9:
            res.append({"coefficient": k, "low_result": lo, "high_result": hi,
                        "swing": abs(hi - lo), "confidence": v.get("confidence", "unknown"),
                        "method": v.get("method", "unknown")})
    res.sort(key=lambda r: r["swing"], reverse=True)
    return {"target": target, "year": year, "nominal": base_val, "drivers": res[:12]}


# --------------------------------------------------------------------------

def main():
    base, coef, scen = load_inputs()
    proj, counter, meta = monte_carlo(base, coef, scen, tariff_holds=True)
    proj_nt, counter_nt, _ = monte_carlo(base, coef, scen, tariff_holds=False)
    proj_nl, counter_nl, _ = monte_carlo(base, coef, scen, tariff_holds=True, loops_on=False)

    years_main = assemble(proj, counter)
    mor = [m["moratorium_year"] for m in meta if m["moratorium_year"]]

    results = {
        "scenario_id": scen["scenario_id"],
        "label": scen["label"],
        "engine_version": "1.0",
        "n_draws": N_DRAWS,
        "horizon": scen["horizon"],
        "arms": {
            "tariff_approved_loops_on": years_main,
            "tariff_rejected_loops_on": assemble(proj_nt, counter_nt),
            "tariff_approved_loops_off": assemble(proj_nl, counter_nl),
        },
        "feedback": {
            "moratorium_triggered_in_draws": len(mor),
            "moratorium_rate": len(mor) / N_DRAWS,
            "median_moratorium_year": (float(np.median(mor)) if mor else None),
            "note": ("A moratorium is an emergent outcome of Loop 2, not an input. "
                     "Its rate across draws is how often the assumed backlash gains "
                     "are strong enough to stop expansion."),
        },
        "geo": geo(base, scen, coef),
        "ledgers": ledgers(years_main, base, scen, coef),
        "school_aid_saturation": saturation_curve(base, coef),
        "tornado": tornado(base, coef, scen),
        "tornado_by_target": {
            t: tornado(base, coef, scen, target=t)
            for t in ("permanent_fte", "water_indirect_mgal",
                      "backlash_index", "cash_rent_usd_per_acre")
        },
        "caveats": [
            "Ordinance O-25-73 is NOT confirmed passed. Terms held at first reading.",
            "AES tariff PUCO 25-0958-EL-AIR is OPEN and CONTESTED. Both arms shown.",
            "MW schedule from PJM Dayton-2025-002, which never names the customer.",
            "The ~6 MG/yr water claim is a developer figure 25-40x below LBNL norms.",
            "All feedback-loop gains are OUR ASSUMPTIONS with wide bands. See ROADMAP.md.",
            "Geo coordinates are approximate pending Clinton County parcel geometry.",
        ],
    }

    out = ROOT / "out"
    out.mkdir(exist_ok=True)
    (out / "results.json").write_text(json.dumps(results, indent=2))

    y = years_main[-1]
    y_nt = results["arms"]["tariff_rejected_loops_on"][-1]
    print(f"engine v1.0 — wrote out/results.json ({N_DRAWS} draws x 3 arms x counterfactuals)")
    print(f"  2041 permanent FTE          {y['permanent_fte']['value']:>12,.0f}")
    print(f"  2041 facility GWh           {y['facility_mwh']['value']/1000:>12,.0f}")
    print(f"  2041 marginal CO2 ktons     {y['marginal_co2_tons']['value']/1000:>12,.0f}")
    print(f"  2041 indirect water Mgal    {y['water_indirect_mgal']['value']:>12,.0f}")
    print(f"  2041 Utica well equivalents {y['utica_well_equivalents']['value']:>12,.1f}")
    print(f"  2041 noise dBA at setback   {y['noise_dba_at_setback']['value']:>12,.1f}")
    print(f"  bill delta, tariff holds    {y['household_bill_delta_usd_month']['value']:>12,.2f} USD/mo")
    print(f"  bill delta, tariff fails    {y_nt['household_bill_delta_usd_month']['value']:>12,.2f} USD/mo")
    print(f"  school aid max loss         {results['school_aid_saturation']['max_loss_usd']:>12,.0f} USD/yr")
    print(f"  moratorium rate             {results['feedback']['moratorium_rate']:>12.1%}")
    print("  top sensitivity drivers:")
    for d in results["tornado"]["drivers"][:4]:
        print(f"    {d['coefficient']:<40} swing {d['swing']:>7,.2f}  ({d['confidence']}/{d['method']})")


if __name__ == "__main__":
    sys.exit(main())

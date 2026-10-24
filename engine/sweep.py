#!/usr/bin/env python3
"""
Lever sweep and Pareto frontier. This is what turns a calculator into a
negotiation tool: "here is every deal on the table, here are the ones that
are not dominated, and here is the best one for a town that cares about X."

It is a grid search. Not RL, not ML. Every point is a full engine run and
every number is traceable. The frontier is the set of lever settings no
other setting beats on every objective at once.

Run:  python engine/sweep.py [n_draws_per_point]
Out:  out/sweep.json
"""

import itertools
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from api import run_scenario, _inputs

ROOT = Path(__file__).resolve().parent.parent
N_PER_POINT = int(sys.argv[1]) if len(sys.argv) > 1 else 200

# Objectives a town weighs. Direction says which way is better.
#
# Lessons from the first sweep, which picked 100% abatement and evaporative
# cooling for every priority:
#   - school revenue and bills are CUMULATIVE over the horizon, not 2041
#     snapshots, so a 10-year abatement cannot game the endpoint
#   - direct water is an objective, so evaporative cooling's 550 Mgal/yr
#     has a visible cost instead of being a free CO2 win
#   - PILOT % still has no modelled cost to the developer, so max PILOT is
#     free. That is a known gap, listed in the report.
OBJECTIVES = {
    "school_total_revenue_cumulative_usd": "max",
    "permanent_fte_2041": "max",
    "construction_job_years_total": "max",
    "household_bill_cumulative_usd": "min",
    "water_direct_mgal_2041": "min",
    "farms_lost_2041": "min",
    "co2_ktons_cumulative": "min",
    "moratorium_rate": "min",
}

# The actual AWS deal. Ties in a profile ranking resolve toward this — a
# negotiation tool should recommend the smallest change from the status
# quo, not whichever option happens to sit last in a list.
AS_PROPOSED = {"property_abatement_pct": 100, "abatement_years": 30, "pilot_pct": 30,
               "cooling": "air_cooled", "tariff_status": "approved_as_written", "it_load_mw": 500}

# Archetypal town priorities, as weights over the objectives above. These
# are illustrative framings for the demo, not survey data. A real deployment
# would let the board set them.
PROFILES = {
    "schools_first":    {"school_total_revenue_cumulative_usd": 1.0, "household_bill_cumulative_usd": 0.2},
    "jobs_first":       {"permanent_fte_2041": 1.0, "construction_job_years_total": 0.5},
    "farmland_first":   {"farms_lost_2041": 1.0, "water_direct_mgal_2041": 0.3},
    "ratepayers_first": {"household_bill_cumulative_usd": 1.0, "moratorium_rate": 0.3},
    "climate_first":    {"co2_ktons_cumulative": 1.0, "water_direct_mgal_2041": 0.5},
    "balanced":         {k: 1.0 for k in OBJECTIVES},
}


def lever_grid(scen):
    levers = {k: v for k, v in scen["levers"].items() if not k.startswith("_")}
    keys = list(levers)
    for combo in itertools.product(*(levers[k] for k in keys)):
        yield dict(zip(keys, combo))


def dominates(a, b):
    """a dominates b if a is at least as good on every objective and strictly
    better on at least one."""
    better_somewhere = False
    for k, direction in OBJECTIVES.items():
        if direction == "max":
            if a[k] < b[k]:
                return False
            if a[k] > b[k]:
                better_somewhere = True
        else:
            if a[k] > b[k]:
                return False
            if a[k] < b[k]:
                better_somewhere = True
    return better_somewhere


def pareto_frontier(points):
    front = []
    for i, p in enumerate(points):
        if not any(dominates(q["kpis"], p["kpis"]) for j, q in enumerate(points) if j != i):
            front.append(i)
    return front


def normalise(points):
    """Map every objective to [0, 1] with 1 = best, so profile weights are
    comparable across units."""
    norm = []
    ranges = {}
    for k, direction in OBJECTIVES.items():
        vals = [p["kpis"][k] for p in points]
        lo, hi = min(vals), max(vals)
        ranges[k] = (lo, hi)
    for p in points:
        row = {}
        for k, direction in OBJECTIVES.items():
            lo, hi = ranges[k]
            x = (p["kpis"][k] - lo) / (hi - lo) if hi > lo else 0.5
            row[k] = x if direction == "max" else 1.0 - x
        norm.append(row)
    return norm, ranges


def distance_from_proposed(ov):
    return sum(1 for k, v in AS_PROPOSED.items() if ov.get(k) != v)


def best_for_profile(points, norm, weights):
    scores = []
    for i, row in enumerate(norm):
        s = sum(w * row[k] for k, w in weights.items())
        scores.append((-round(s, 6), distance_from_proposed(points[i]["overrides"]), i))
    scores.sort()
    top = scores[0][0]
    n_tied = sum(1 for s in scores if s[0] == top)
    return [{"rank": r + 1, "score": round(-s, 4), "levers_changed": dist,
             "tied_at_top": n_tied if r == 0 else None,
             "overrides": points[i]["overrides"], "kpis": points[i]["kpis"]}
            for r, (s, dist, i) in enumerate(scores[:5])]


def main():
    base, coef, scen = _inputs()
    grid = list(lever_grid(scen))
    print(f"sweep: {len(grid)} lever combinations x {N_PER_POINT} draws")

    # Counterfactual once. Under common random numbers it is identical for
    # every lever setting, so recomputing it per point would be pure waste.
    t0 = time.time()
    seed_run = run_scenario({}, n_draws=N_PER_POINT)
    cf = seed_run["counterfactual"]
    print(f"  counterfactual computed once ({time.time()-t0:.1f}s)")

    points = []
    t0 = time.time()
    for i, ov in enumerate(grid):
        r = run_scenario(ov, n_draws=N_PER_POINT, counterfactual=cf)
        points.append({"overrides": ov, "kpis": r["kpis"]})
        if (i + 1) % 100 == 0:
            el = time.time() - t0
            print(f"  {i+1}/{len(grid)}  {el:.0f}s elapsed, ~{el/(i+1)*(len(grid)-i-1):.0f}s left")
    print(f"  sweep done in {time.time()-t0:.0f}s")

    front_idx = pareto_frontier(points)
    norm, ranges = normalise(points)
    profiles = {name: best_for_profile(points, norm, w) for name, w in PROFILES.items()}

    as_proposed = next(p for p in points if p["overrides"] == AS_PROPOSED)
    as_proposed_dominated = any(dominates(q["kpis"], as_proposed["kpis"]) for q in points
                                if q is not as_proposed)

    out = {
        "n_points": len(points),
        "n_draws_per_point": N_PER_POINT,
        "objectives": OBJECTIVES,
        "objective_ranges": {k: {"min": v[0], "max": v[1]} for k, v in ranges.items()},
        "pareto_frontier": {
            "size": len(front_idx),
            "fraction_of_grid": len(front_idx) / len(points),
            "points": [points[i] for i in front_idx],
        },
        "as_proposed": {
            "kpis": as_proposed["kpis"],
            "is_pareto_dominated": as_proposed_dominated,
            "note": ("If dominated, some other lever setting beats the actual AWS deal "
                     "on every objective at once — a strictly better deal exists."),
        },
        "best_by_profile": profiles,
        "profiles_note": ("Profile weights are illustrative framings for the demo, not "
                          "survey data. A real deployment lets the board set them."),
        "all_points": points,
    }
    (ROOT / "out").mkdir(exist_ok=True)
    (ROOT / "out" / "sweep.json").write_text(json.dumps(out, indent=2))

    print(f"\nPareto frontier: {len(front_idx)} of {len(points)} settings are non-dominated")
    print(f"As-proposed AWS deal is {'DOMINATED — a strictly better deal exists' if as_proposed_dominated else 'on the frontier'}")
    print("\nBest deal by town priority (ties resolve toward the as-proposed deal):")
    for name, ranked in profiles.items():
        b = ranked[0]
        o = b["overrides"]
        tie = f"  [{b['tied_at_top']} tied]" if b["tied_at_top"] and b["tied_at_top"] > 1 else ""
        print(f"  {name:<17} abate {o['property_abatement_pct']:>3}%/{o['abatement_years']:>2}yr  "
              f"PILOT {o['pilot_pct']:>2}%  {o['cooling']:<11} {o['tariff_status']:<20} {o['it_load_mw']:>4}MW"
              f"  changed {b['levers_changed']}/6{tie}")
    print("\nwrote out/sweep.json")


if __name__ == "__main__":
    sys.exit(main())

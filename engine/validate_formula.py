#!/usr/bin/env python3
"""
The real external validation: recompute Ohio's school funding formula from
RAW INPUTS for every district in the state and compare to DEW's published
answers.

WHY THIS EXISTS
---------------
`validate.py` Tier 2 checks arithmetic. It takes DEW's published local
capacity per pupil, base cost per pupil and ADM, multiplies them, and gets
DEW's published state funding. That tests whether we can multiply and whether
we picked the right ADM. It is not a model validation, and its 0.0002% error
is rounding in DEW's own figures.

This file is the actual test. For all 611 districts it computes, from raw
assessed valuation, federal adjusted gross income, median income and ADM:

    C6  local capacity percentage  = 0.0225 x (district median / state median),
                                     interpolated above parity toward the
                                     40th-highest district's ratio, capped 0.025
    C7  local capacity per pupil   = C6 x (0.60*AV/pupil + 0.20*FAGI/pupil
                                           + 0.20*median income/pupil)
    b3  state share per pupil      = max(base cost/pupil - C7, 0.10 * base cost/pupil)
    A   state share of base cost   = b3 x enrolled ADM

and compares each against the published column. Nothing is back-solved.
Wilmington is 1 of 611 rows and gets no special treatment, so 610 districts
are genuinely out of sample — including the ~105 sitting at the 10% floor,
which exercise a different branch than Wilmington does.

DATA
----
Needs the DEW FY2026 SFPR Final #2 workbook (TRAD_FL2_Foundation_Payment.xlsx)
from education.ohio.gov. Point WORKBOOK at it or pass a path as argv[1].
Skips cleanly if absent so the rest of the suite still runs.

Run:  python engine/validate_formula.py [path/to/workbook.xlsx]
Out:  out/formula_validation.json
"""

import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

DEFAULT_PATHS = [
    ROOT / "data" / "raw" / "TRAD_FL2.xlsx",
    Path("C:/Users/pawan/AppData/Local/Temp/claude/"
         "c--Users-pawan-OneDrive-Desktop-datacenterhackohio/"
         "bb4645c5-8c78-4713-8d0b-17ba646db2e8/scratchpad/dew/TRAD_FL2.xlsx"),
]

STATE_AID_FLOOR = 0.10
BASE_RATE = 0.0225          # local capacity % at income parity
MAX_RATE = 0.0250           # statutory ceiling


def find_workbook():
    if len(sys.argv) > 1:
        p = Path(sys.argv[1])
        return p if p.exists() else None
    for p in DEFAULT_PATHS:
        if p.exists():
            return p
    return None


def load(path):
    import openpyxl
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)

    def sheet(name):
        ws = wb[name]
        ws.reset_dimensions()
        it = ws.iter_rows(min_row=1, values_only=True)
        hdr = None
        for r in it:
            if r and sum(1 for x in r if x is not None) > 3:
                hdr = r
                break
        rows = {}
        for r in it:
            if r and r[0]:
                rows[str(r[0]).strip().zfill(6)] = r
        return hdr, rows

    return sheet("Local Capacity"), sheet("Detailed SFPR")


def local_capacity_pct(ratio, ratio_40th):
    """C6. At or below income parity the rate scales linearly with the
    district's income ratio. Above parity it interpolates toward the ceiling,
    reaching it at the 40th-highest district's ratio."""
    if ratio <= 1.0:
        return BASE_RATE * ratio
    frac = min((ratio - 1.0) / (ratio_40th - 1.0), 1.0)
    return BASE_RATE + (MAX_RATE - BASE_RATE) * frac


def main():
    path = find_workbook()
    if not path:
        print("DEW workbook not found — skipping statewide formula validation.")
        print("Get TRAD_FL2_Foundation_Payment.xlsx from education.ohio.gov")
        print("and place it at data/raw/TRAD_FL2.xlsx, or pass a path.")
        return 0

    print(f"workbook: {path.name}\n")
    (lc_hdr, lc), (sf_hdr, sf) = load(path)

    errs = {"C6_local_capacity_pct": [], "C7_local_capacity_per_pupil": [],
            "b3_state_share_per_pupil": [], "A_state_share_of_base_cost": []}
    floored_n = 0
    worst = []
    n = 0

    for irn, lr in lc.items():
        sr = sf.get(irn)
        if not sr:
            continue
        try:
            V1, I1, I5, I6, I7, A1 = lr[3], lr[7], lr[11], lr[12], lr[13], lr[14]
            ratio_40th = lr[19]
            pub_C6, pub_C7 = lr[20], lr[21]
            adm, pub_b1, pub_b2, pub_b3 = sr[6], sr[8], sr[9], sr[10]
            pub_A = sr[39]
            if None in (V1, I1, I5, I6, I7, A1, adm, pub_b2) or not A1 or not adm:
                continue
        except (IndexError, TypeError):
            continue

        # --- compute from raw inputs -------------------------------------
        C1 = V1 / A1                      # assessed valuation per pupil
        C2 = I1 / A1                      # federal AGI per pupil
        C3 = (I5 * I6) / A1               # median income x returns, per pupil
        C4 = I5 / I7                      # district median / statewide median
        C6 = local_capacity_pct(C4, ratio_40th)
        C7 = C6 * (0.60 * C1 + 0.20 * C2 + 0.20 * C3)

        b3 = max(pub_b2 - C7, STATE_AID_FLOOR * pub_b2)
        if pub_b2 - C7 < STATE_AID_FLOOR * pub_b2:
            floored_n += 1
        A = b3 * adm

        n += 1

        def rec(key, got, want):
            if want is None or want == 0:
                return
            e = abs(got - want) / abs(want)
            errs[key].append(e)
            if key == "C7_local_capacity_per_pupil" and e > 1e-3:
                worst.append({"irn": irn, "district": lr[1], "computed": round(got, 2),
                              "published": round(want, 2), "rel_err": e})

        rec("C6_local_capacity_pct", C6, pub_C6)
        rec("C7_local_capacity_per_pupil", C7, pub_C7)
        rec("b3_state_share_per_pupil", b3, pub_b3)
        rec("A_state_share_of_base_cost", A, pub_A)

    print(f"districts validated: {n}")
    print(f"  of which at the 10% floor: {floored_n} ({floored_n/n:.1%})\n")

    summary = {}
    print(f"{'quantity':<34} {'median':>10} {'p95':>10} {'max':>10} {'<=1e-4':>9}")
    print("-" * 78)
    for k, v in errs.items():
        if not v:
            continue
        v = sorted(v)
        med = statistics.median(v)
        p95 = v[int(0.95 * len(v))]
        mx = v[-1]
        frac = sum(1 for x in v if x <= 1e-4) / len(v)
        summary[k] = {"n": len(v), "median_rel_err": med, "p95_rel_err": p95,
                      "max_rel_err": mx, "fraction_within_1e-4": frac}
        print(f"{k:<34} {med:>10.2e} {p95:>10.2e} {mx:>10.2e} {frac:>8.1%}")

    print()
    if worst:
        worst.sort(key=lambda w: -w["rel_err"])
        print(f"districts where local capacity per pupil misses by >0.1%: {len(worst)}")
        for w in worst[:8]:
            print(f"  {w['district'][:34]:<36} computed {w['computed']:>10,.2f} "
                  f"published {w['published']:>10,.2f}  ({w['rel_err']:.2%})")
    else:
        print("no district misses local capacity per pupil by more than 0.1%")

    out = {"workbook": path.name, "districts": n, "floored": floored_n,
           "summary": summary, "worst_outliers": worst[:25],
           "note": ("Computed from raw valuation, income and ADM. Nothing "
                    "back-solved. Wilmington is 1 of %d rows and gets no "
                    "special treatment." % n)}
    (ROOT / "out").mkdir(exist_ok=True)
    (ROOT / "out" / "formula_validation.json").write_text(json.dumps(out, indent=2))
    print("\nwrote out/formula_validation.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())

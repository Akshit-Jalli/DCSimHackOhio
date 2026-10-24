// PLACEHOLDER ENGINE.
// These are rough demo formulas so the frontend has numbers to show.
// Replace runSimulation() with a call to the real engine when it's ready:
//   const res = await fetch("/api/simulate", { method: "POST", body: JSON.stringify(input) });
//   return res.json();
import type { Metric, SimInput, YearResult } from "./types";
import { activeMW } from "./presets";

// Placeholder local facts (data team should replace)
const WATER_SYSTEM_CAPACITY_MGD = 5; // Wilmington water system, placeholder
const STUDENTS = 2800; // Wilmington City Schools enrollment, placeholder
const MWH_PER_HOME = 10.5; // average US home per year
const MILLS = 0.065; // property tax rate, placeholder

// Liters of water per kWh by cooling type
const WUE: Record<string, number> = { closed_loop_air: 0.1, hybrid: 0.8, evaporative: 1.8 };

function m(value: number, unit: string, spread = 0.15): Metric {
  return { value, unit, low: value * (1 - spread), high: value * (1 + spread) };
}

export function runSimulation(
  input: SimInput,
  ctx: { nearestResidenceM: number }
): YearResult[] {
  const f = input.facility;
  const p = input.policy;
  const capexPerMW = f.capex_usd / Math.max(1, f.it_load_mw);
  const out: YearResult[] = [];

  for (let year = input.horizon.start_year; year <= input.horizon.end_year; year++) {
    const mw = activeMW(f.phases, year);

    // Energy
    const mwh = mw * f.pue * 8760 * 0.85;

    // Water
    const litersPerYear = mw * 8760 * 0.85 * 1000 * (WUE[f.cooling] ?? 0.5);
    const mgd = litersPerYear / 3.785 / 365 / 1e6;
    const pctCap = (mgd / WATER_SYSTEM_CAPACITY_MGD) * 100;
    const rateDelta = f.water_source === "municipal" ? pctCap * 0.3 : 0;

    // Taxes and schools
    const assessed = mw * capexPerMW * 0.35 * 0.5;
    const tax = assessed * MILLS;
    const abated = year < input.horizon.start_year + 1 + p.abatement_years;
    const forgone = abated ? tax * (p.property_abatement_pct / 100) : 0;
    const pilot = mw > 0 && abated ? p.pilot_annual_usd : 0;
    const schoolGain = (tax - forgone) * 0.6 + pilot * (p.pilot_school_share_pct / 100);
    const stateAidClawback = assessed * 0.02 * 0.6; // state aid drops as local value rises
    const perPupil = (schoolGain - stateAidClawback) / STUDENTS;

    // Jobs: construction while a phase is being built (2 years before it opens)
    let construction = 0;
    let prev = 0;
    for (const ph of f.phases) {
      if (year >= ph.year - 2 && year < ph.year) construction += (ph.mw - prev) * 4;
      prev = ph.mw;
    }

    // Noise: louder for bigger sites, drops 6 dB each time distance doubles
    const srcAt100m = mw > 0 ? 60 + 10 * Math.log10(mw / 100) : 0;
    const d = Math.max(30, ctx.nearestResidenceM);
    const dba = mw > 0 ? srcAt100m - 20 * Math.log10(d / 100) : 0;
    const loudRadius = mw > 0 ? Math.max(0, 100 * Math.pow(10, (srcAt100m - 55) / 20)) : 0;

    out.push({
      year,
      active_mw: mw,
      energy: {
        facility_mwh: m(mwh, "MWh"),
        homes_equivalent: m(mwh / MWH_PER_HOME, "homes"),
      },
      ratepayer: { household_bill_delta_usd_month: m(mw * 0.012, "$/month", 0.4) },
      fiscal: {
        property_tax_forgone_usd: m(forgone, "$"),
        pilot_received_usd: m(pilot, "$", 0),
        net_per_pupil_delta_usd: m(perPupil, "$/student", 0.3),
      },
      water: {
        withdrawal_mgd: m(mgd, "MGD", 0.3),
        pct_of_system_capacity: m(pctCap, "%", 0.3),
        residential_rate_delta_pct: m(rateDelta, "%", 0.5),
      },
      land: { acres_converted: m(mw > 0 ? input.site.acres : 0, "acres", 0) },
      jobs: {
        construction_fte: m(construction, "jobs", 0.3),
        permanent_fte: m(mw * 0.2, "jobs", 0.3),
      },
      nuisance: {
        noise_dba_at_nearest_residence: m(dba, "dBA", 0.1),
        loud_radius_m: m(loudRadius, "m", 0.2),
      },
    });
  }
  return out;
}

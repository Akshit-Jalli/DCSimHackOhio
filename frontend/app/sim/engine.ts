// REAL ENGINE — a faithful TypeScript port of engine/model.py::run_once.
//
// Same coefficients (lib/data/coefficients.json, exported from
// data/coefficients.yaml), same baseline (lib/data/baseline.json), same
// equations, same feedback loops. The parity test in sim/engine.parity.mjs
// asserts this reproduces the Python row-for-row to 1e-9 on the nominal path.
//
// Two entry points:
//   runSimulationNominal(input, ctx) — deterministic, nominal coefficients,
//                                      no bands. What the parity test checks.
//   runSimulation(input, ctx)        — 40-draw Monte Carlo over each
//                                      coefficient's [low, high] with a seeded
//                                      PRNG; value = p50, low = p10, high = p90.
//                                      What Scene.tsx calls.
//
// Contract reconciliation (their SimInput vs the Python scenario):
//   cooling      "closed_loop_air" -> Python "air_cooled"
//   grid_cost_allocation containing "tariff" -> tariff_holds = true
//   PILOT        their pilot_annual_usd x pilot_school_share_pct is used as-is.
//                If policy.pilot_pct is present (parity test only), the Python
//                percent-of-abated-tax formula is used instead.
//   noise        ctx.nearestResidenceM replaces the fixed noise_setback_ft —
//                it is the real distance from the placed lot to a building.
//   water_source "onsite_wells" draws nothing from the city system.
//   acres, capex, phases come from the input, not the Wilmington scenario.
//
// What is still Wilmington-specific: the BASELINE (school district, water
// plant, farms, parcel tax rate). "Any town" needs a baseline per town.

import coefficientsJson from "../../lib/data/coefficients.json";
import baselineJson from "../../lib/data/baseline.json";
import type { Metric, SimInput, YearResult } from "./types";

// ------------------------------------------------------------------ inputs

type CoefEntry = { value: unknown; low?: number; high?: number; [k: string]: unknown };
type Coefs = Record<string, number>;

const COEF = coefficientsJson as unknown as Record<string, CoefEntry>;
const BASE = baselineJson as unknown as Baseline;

type V = { value: number };
export type Baseline = {
  school_district: {
    capacity_av_usd: V; base_cost_enrolled_adm: V; enrolled_adm: V;
    capacity_pct: V; base_cost_per_pupil_usd: V; local_capacity_per_pupil_usd: V;
  };
  agriculture: { county_farms: V; cash_rent_usd_per_acre: V };
  wastewater: { wwtp_design_mgd: V; mean_monthly_avg_mgd: V };
  water: { wtp_capacity_mgd: V };
  site_parcel: { current_annual_tax_usd: number; taxable_usd: number };
};
export const WILMINGTON_BASELINE: Baseline = BASE;

function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export function nominalCoefs(): Coefs {
  const c: Coefs = {};
  for (const [k, v] of Object.entries(COEF)) {
    if (v && typeof v === "object" && isNum(v.value)) c[k] = v.value;
  }
  return c;
}

function sampleCoefs(rng: () => number, overrides: Partial<Coefs> = {}): Coefs {
  const c: Coefs = {};
  for (const [k, v] of Object.entries(COEF)) {
    if (!v || typeof v !== "object" || !isNum(v.value)) continue;
    const lo = isNum(v.low) ? v.low : v.value;
    const hi = isNum(v.high) ? v.high : v.value;
    c[k] = hi > lo ? lo + rng() * (hi - lo) : v.value;
  }
  return applyOverrides(c, overrides); // an explicit override is a chosen value, not a sampled one
}

/** Copy `base` with every defined override on top. `undefined` means "no override", never "set to undefined". */
function applyOverrides(base: Coefs, overrides: Partial<Coefs>): Coefs {
  const c: Coefs = { ...base };
  for (const [k, v] of Object.entries(overrides)) if (typeof v === "number" && Number.isFinite(v)) c[k] = v;
  return c;
}

// mulberry32 — tiny seeded PRNG so useMemo is stable and tests reproduce.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------- the model

export type EngineInput = SimInput & {
  policy: SimInput["policy"] & { pilot_pct?: number; school_compensation_usd?: number };
};
export type Ctx = { nearestResidenceM: number };

export type Extra = {
  school_state_funding_usd: number;
  local_property_tax_to_schools_usd: number;
  property_tax_full_usd: number;
  water_direct_mgal: number;
  water_indirect_mgal: number;
  marginal_co2_tons: number;
  farms_remaining: number;
  cash_rent_usd_per_acre: number;
  sewer_pct_of_design: number;
  backlash_index: number;
  upstream_gas_mcf: number;
  utica_well_equivalents: number;
  floor_binds: boolean;
};
export type YearRow = YearResult & { extra: Extra };
export type RunMeta = { moratorium_year: number | null; mw_capped_at: number | null };

const L_PER_MGAL = 3.785e6;

function pyCooling(c: SimInput["facility"]["cooling"]): "air_cooled" | "hybrid" | "evaporative" {
  return c === "closed_loop_air" ? "air_cooled" : c;
}

function scheduledMW(phases: { year: number; mw: number }[], year: number): number {
  let mw = 0;
  for (const ph of phases) if (year >= ph.year) mw = Math.max(mw, ph.mw);
  return mw;
}

function energyMWh(mw: number, c: Coefs, cooling: ReturnType<typeof pyCooling>): number {
  let pue = c.pue_new_hyperscale;
  if (cooling === "air_cooled") pue *= 1 + c.air_cooled_pue_penalty;
  else if (cooling === "hybrid") pue *= 1 + 0.5 * c.air_cooled_pue_penalty;
  return mw * pue * 8760 * c.load_factor;
}

function wueFor(cooling: ReturnType<typeof pyCooling>, c: Coefs): number {
  if (cooling === "evaporative") return c.water_l_per_kwh_evaporative;
  if (cooling === "hybrid") return 0.5 * (c.water_l_per_kwh_evaporative + c.water_l_per_kwh_closed_loop);
  return c.water_l_per_kwh_closed_loop;
}

function billDelta(mw: number, c: Coefs, tariffHolds: boolean): number {
  if (mw <= 0) return 0;
  const scale = mw / c.bill_reference_mw;
  let monthly = c.household_bill_delta_iou;
  if (tariffHolds) monthly *= c.residual_bill_share_under_tariff;
  return monthly * scale;
}

// Ohio ORC 3317.017. AV/pupil uses BASE COST ADM; funding uses ENROLLED ADM.
function schoolFinance(campusMarketValue: number, c: Coefs, abatementPct: number, base: Baseline = BASE) {
  const sd = base.school_district;
  const capAv = sd.capacity_av_usd.value;
  const bcAdm = sd.base_cost_enrolled_adm.value;
  const adm = sd.enrolled_adm.value;
  const capPct = sd.capacity_pct.value;
  const bcpp = sd.base_cost_per_pupil_usd.value;
  const lcppNow = sd.local_capacity_per_pupil_usd.value;
  const incomeTerms = lcppNow / capPct - 0.6 * (capAv / bcAdm);
  const taxableAdded = campusMarketValue * c.ohio_assessment_ratio * (1 - abatementPct / 100);
  const lcpp = capPct * (0.6 * ((capAv + taxableAdded) / bcAdm) + incomeTerms);
  const uncapped = (bcpp - lcpp) * adm;
  const floor = c.school_state_aid_floor * bcpp * adm;
  return { funding: Math.max(uncapped, floor), lcpp, floorBinds: uncapped < floor };
}

function constructionFTE(input: EngineInput, year: number, c: Coefs): number {
  const ph = input.facility.phases;
  const first = ph[0].year, last = ph[ph.length - 1].year;
  if (!(first - 2 <= year && year <= last)) return 0;
  const span = Math.max(last - (first - 2), 1);
  const spendMusd = (input.facility.capex_usd * c.capex_construction_share) / 1e6;
  return (spendMusd * c.construction_jobs_per_musd_construction) / span;
}

// Simplified ISO 9613-2: Lw + 10log10(N) - 20log10(r) - 8 - A_ground
function noiseDba(mw: number, distM: number, c: Coefs): number {
  if (mw <= 0) return 0;
  const n = Math.max(1, Math.floor(mw / 10));
  const lw = c.chiller_sound_power_dba + 10 * Math.log10(n);
  return lw - 20 * Math.log10(Math.max(distM, 1)) - 8 - c.ground_attenuation_db;
}
function noiseRadiusM(targetDba: number, mw: number, c: Coefs): number {
  if (mw <= 0) return 0;
  const n = Math.max(1, Math.floor(mw / 10));
  const lw = c.chiller_sound_power_dba + 10 * Math.log10(n);
  return Math.pow(10, (lw - 8 - c.ground_attenuation_db - targetDba) / 20);
}

function upstream(mwh: number, c: Coefs) {
  const mmbtu = (mwh * 1000 * c.marginal_heat_rate_btu_per_kwh) / 1e6;
  const mcf = (mmbtu * 1e6) / c.gas_btu_per_mcf;
  return { mcf, wells: mcf / c.utica_well_lifetime_mcf };
}

const m = (value: number, unit: string): Metric => ({ value, unit });

/** One deterministic run with a given coefficient set. Mirrors run_once. */
export function runOnce(input: EngineInput, ctx: Ctx, c: Coefs, loopsOn = true, base: Baseline = BASE): { rows: YearRow[]; meta: RunMeta } {
  const cooling = pyCooling(input.facility.cooling);
  const tariffHolds = /tariff/i.test(input.policy.grid_cost_allocation ?? "");
  const municipal = input.facility.water_source !== "onsite_wells";
  const phases = input.facility.phases;
  const site = base.site_parcel;
  const effRate = site.current_annual_tax_usd / site.taxable_usd;
  const adm = base.school_district.enrolled_adm.value;
  const baselineFunding = schoolFinance(0, c, 0, base).funding;

  // persistent state — this is what makes it a simulation
  let backlash = 0;
  let moratoriumYear: number | null = null;
  let mwCappedAt: number | null = null;
  let farms = base.agriculture.county_farms.value;
  const sewerUsed = base.wastewater.mean_monthly_avg_mgd.value;
  const sewerDesign = base.wastewater.wwtp_design_mgd.value;
  const rent0 = base.agriculture.cash_rent_usd_per_acre.value;
  let prevRent = rent0;

  const rows: YearRow[] = [];
  for (let y = input.horizon.start_year; y <= input.horizon.end_year; y++) {
    let mw = scheduledMW(phases, y);
    if (loopsOn && moratoriumYear !== null && mwCappedAt !== null) mw = Math.min(mw, mwCappedAt);

    const mwh = energyMWh(mw, c, cooling);
    const wue = wueFor(cooling, c);
    const marketValue = mw > 0 ? input.facility.capex_usd : 0;

    let abate = 0;
    if (mw > 0 && y - phases[0].year < input.policy.abatement_years) abate = input.policy.property_abatement_pct;

    const sf = schoolFinance(marketValue, c, abate, base);
    const bill = billDelta(mw, c, tariffHolds);

    // LOOP 1 — land speculation -> cash rent -> farm exit (change-driven)
    let rent = rent0;
    if (loopsOn && mw > 0) {
      const landIndex = 1 + c.land_value_premium_pct_per_100mw * (mw / 100);
      rent = rent0 * (1 + (landIndex - 1) * c.cash_rent_passthrough);
      const rentChangePct = ((rent - prevRent) / rent0) * 100;
      const lost = farms * c.farm_exit_rate_per_rent_pct * Math.max(rentChangePct, 0);
      farms = Math.max(farms - lost, 0);
    }
    prevRent = rent;

    // LOOP 3 — sewer headroom
    const sanitaryMgd = (mw * c.sanitary_gal_per_mw_day) / 1e6;
    const sewerPct = (sewerUsed + sanitaryMgd) / sewerDesign;

    // LOOP 2 — backlash with decay -> moratorium
    if (loopsOn) {
      let pressure = bill * c.backlash_index_per_usd_bill;
      if (sewerPct > 1) pressure += sewerPct - 1;
      backlash = backlash * (1 - c.backlash_decay_per_year) + pressure;
      if (backlash >= c.moratorium_threshold && moratoriumYear === null) {
        moratoriumYear = y;
        mwCappedAt = mw;
      }
    }

    // fiscal — three district revenue channels
    let pilot = 0, localTax = 0, fullTax = 0, forgone = 0;
    if (mw > 0) {
      fullTax = marketValue * c.ohio_assessment_ratio * effRate;
      const abatedFrac = abate / 100;
      forgone = fullTax * abatedFrac;
      localTax = fullTax * (1 - abatedFrac) * c.school_share_of_property_tax;
      if (isNum(input.policy.pilot_pct)) {
        // Python scenario parameterisation (parity path)
        pilot = (fullTax * abatedFrac * input.policy.pilot_pct) / 100 + (input.policy.school_compensation_usd ?? 0);
      } else {
        // Frontend parameterisation: fixed annual PILOT, a share to schools
        pilot = abatedFrac > 0 ? input.policy.pilot_annual_usd * (input.policy.pilot_school_share_pct / 100) : 0;
      }
    }

    const constr = constructionFTE(input, y, c);
    const perm = mw * c.permanent_jobs_per_mw;
    const up = mwh > 0 ? upstream(mwh, c) : { mcf: 0, wells: 0 };

    const waterDirectMgal = (mwh * wue * 1000) / L_PER_MGAL;
    const withdrawalMgd = waterDirectMgal / 365;
    const pctCap = municipal ? (withdrawalMgd / base.water.wtp_capacity_mgd.value) * 100 : 0;
    const rateDelta = municipal ? pctCap * c.water_rate_passthrough_pct_per_pct_capacity : 0;

    const schoolDelta = sf.funding - baselineFunding;
    const dba = noiseDba(mw, ctx.nearestResidenceM, c);

    rows.push({
      year: y,
      active_mw: mw,
      energy: { facility_mwh: m(mwh, "MWh"), homes_equivalent: m(mwh / c.mwh_per_home, "homes") },
      ratepayer: { household_bill_delta_usd_month: m(bill, "$/month") },
      fiscal: {
        property_tax_forgone_usd: m(forgone, "$"),
        pilot_received_usd: m(pilot, "$"),
        net_per_pupil_delta_usd: m((schoolDelta + localTax + pilot) / adm, "$/student"),
      },
      water: {
        withdrawal_mgd: m(withdrawalMgd, "MGD"),
        pct_of_system_capacity: m(pctCap, "%"),
        residential_rate_delta_pct: m(rateDelta, "%"),
      },
      land: { acres_converted: m(mw > 0 ? input.site.acres : 0, "acres") },
      jobs: { construction_fte: m(constr, "jobs"), permanent_fte: m(perm, "jobs") },
      nuisance: {
        noise_dba_at_nearest_residence: m(dba, "dBA"),
        loud_radius_m: m(noiseRadiusM(55, mw, c), "m"),
      },
      extra: {
        school_state_funding_usd: sf.funding,
        local_property_tax_to_schools_usd: localTax,
        property_tax_full_usd: fullTax,
        water_direct_mgal: waterDirectMgal,
        water_indirect_mgal: (mwh * c.water_indirect_l_per_kwh * 1000) / L_PER_MGAL,
        marginal_co2_tons: (mwh * c.marginal_co2_lb_per_mwh) / 2000,
        farms_remaining: farms,
        cash_rent_usd_per_acre: rent,
        sewer_pct_of_design: sewerPct,
        backlash_index: backlash,
        upstream_gas_mcf: up.mcf,
        utica_well_equivalents: up.wells,
        floor_binds: sf.floorBinds,
      },
    });
  }
  return { rows, meta: { moratorium_year: moratoriumYear, mw_capped_at: mwCappedAt } };
}

/** Deterministic nominal run. This is what the parity test checks. */
export function runSimulationNominal(input: EngineInput, ctx: Ctx, opts: SimOptions = {}): YearRow[] {
  return runOnce(input, ctx, applyOverrides(nominalCoefs(), opts.coefOverrides ?? {}), true, opts.baseline ?? BASE).rows;
}

// numpy's default 'linear' percentile
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const N_DRAWS = 40;
const SEED = 20261024;

type MetricPath = [keyof YearResult, string];
const METRIC_PATHS: MetricPath[] = [
  ["energy", "facility_mwh"], ["energy", "homes_equivalent"],
  ["ratepayer", "household_bill_delta_usd_month"],
  ["fiscal", "property_tax_forgone_usd"], ["fiscal", "pilot_received_usd"], ["fiscal", "net_per_pupil_delta_usd"],
  ["water", "withdrawal_mgd"], ["water", "pct_of_system_capacity"], ["water", "residential_rate_delta_pct"],
  ["land", "acres_converted"],
  ["jobs", "construction_fte"], ["jobs", "permanent_fte"],
  ["nuisance", "noise_dba_at_nearest_residence"], ["nuisance", "loud_radius_m"],
];

/** Collapse Monte Carlo draws onto the nominal rows: value = p50, low = p10, high = p90. */
function bandRows(nominal: YearRow[], draws: YearRow[][]): YearRow[] {
  return nominal.map((row, yi) => {
    const out = structuredClone(row) as YearRow;
    for (const [group, key] of METRIC_PATHS) {
      const vals = draws.map((d) => ((d[yi][group] as Record<string, Metric>)[key]).value).sort((a, b) => a - b);
      const target = (out[group] as Record<string, Metric>)[key];
      target.value = percentile(vals, 50);
      target.low = percentile(vals, 10);
      target.high = percentile(vals, 90);
    }
    // active_mw can differ across draws when a moratorium caps it
    const mws = draws.map((d) => d[yi].active_mw).sort((a, b) => a - b);
    out.active_mw = percentile(mws, 50);
    return out;
  });
}

export type SimOutput = { rows: YearRow[]; moratoriumRate: number; builtBy: number | null };

/** Town profile and user overrides. Omit either to run on Wilmington with the published coefficients. */
export type SimOptions = { baseline?: Baseline; coefOverrides?: Partial<Coefs> };

/**
 * What Scene.tsx calls. One set of Monte Carlo draws gives both the banded
 * rows and the probability a moratorium fires. Common random numbers: the
 * PRNG is re-seeded identically every call, so two settings differ by
 * signal, not sampling noise.
 */
export function simulate(input: EngineInput, ctx: Ctx, opts: SimOptions = {}): SimOutput {
  const base = opts.baseline ?? BASE;
  const ov = opts.coefOverrides ?? {};
  const rng = mulberry32(SEED);
  const draws: { rows: YearRow[]; meta: RunMeta }[] = [];
  for (let i = 0; i < N_DRAWS; i++) draws.push(runOnce(input, ctx, sampleCoefs(rng, ov), true, base));
  const nominal = runOnce(input, ctx, applyOverrides(nominalCoefs(), ov), true, base).rows;
  const rows = bandRows(nominal, draws.map((d) => d.rows));
  const moratoriumRate = draws.filter((d) => d.meta.moratorium_year !== null).length / N_DRAWS;
  const ph = input.facility.phases;
  return { rows, moratoriumRate, builtBy: ph.length ? ph[ph.length - 1].year : null };
}

/** Same signature as fakeEngine.runSimulation; kept for the parity test and callers that only want rows. */
export function runSimulation(input: EngineInput, ctx: Ctx, opts: SimOptions = {}): YearRow[] {
  return simulate(input, ctx, opts).rows;
}

/** Probability a moratorium fires, across the Monte Carlo draws. */
export function moratoriumRate(input: EngineInput, ctx: Ctx, opts: SimOptions = {}): number {
  return simulate(input, ctx, opts).moratoriumRate;
}

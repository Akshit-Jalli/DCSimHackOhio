#!/usr/bin/env node
// Parity test: the TypeScript engine must reproduce engine/model.py row-for-row.
//
// Compiles app/sim/engine.ts with the project's own tsc into a temp dir, loads
// the Python-generated vectors in lib/data/parity_*.json (nominal coefficients,
// loops on, tariff holds), builds the equivalent SimInput, runs the nominal
// path, and diffs every field. Exits 1 on any relative error above TOL.
//
// Run:  node app/sim/engine.parity.mjs      (from frontend/)

import { execSync } from "node:child_process";
import { readFileSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const TOL = 1e-9;
const FRONT = process.cwd();
const OUT = path.join(FRONT, ".parity_build");

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
execSync(
  `npx tsc app/sim/engine.ts --outDir "${OUT}" --module commonjs --target es2020 ` +
  `--esModuleInterop --resolveJsonModule --skipLibCheck --rootDir .`,
  { stdio: "inherit" }
);
const require = createRequire(import.meta.url);
const E = require(path.join(OUT, "app", "sim", "engine.js"));

// Python row key -> accessor into the TS YearRow
const FIELDS = {
  mw_online: (r) => r.active_mw,
  facility_mwh: (r) => r.energy.facility_mwh.value,
  household_bill_delta_usd_month: (r) => r.ratepayer.household_bill_delta_usd_month.value,
  pilot_received_usd: (r) => r.fiscal.pilot_received_usd.value,
  construction_fte_years: (r) => r.jobs.construction_fte.value,
  permanent_fte: (r) => r.jobs.permanent_fte.value,
  acres_converted: (r) => r.land.acres_converted.value,
  noise_dba_at_setback: (r) => r.nuisance.noise_dba_at_nearest_residence.value,
  school_state_funding_usd: (r) => r.extra.school_state_funding_usd,
  local_property_tax_to_schools_usd: (r) => r.extra.local_property_tax_to_schools_usd,
  water_direct_mgal: (r) => r.extra.water_direct_mgal,
  water_indirect_mgal: (r) => r.extra.water_indirect_mgal,
  marginal_co2_tons: (r) => r.extra.marginal_co2_tons,
  farms_remaining: (r) => r.extra.farms_remaining,
  cash_rent_usd_per_acre: (r) => r.extra.cash_rent_usd_per_acre,
  sewer_pct_of_design: (r) => r.extra.sewer_pct_of_design,
  backlash_index: (r) => r.extra.backlash_index,
  upstream_gas_mcf: (r) => r.extra.upstream_gas_mcf,
  utica_well_equivalents: (r) => r.extra.utica_well_equivalents,
};

function toSimInput(scen) {
  const cool = { air_cooled: "closed_loop_air", hybrid: "hybrid", evaporative: "evaporative" }[scen.facility.cooling];
  return {
    site: {
      fips_county: scen.site.county_fips, lat: 0, lon: 0, acres: scen.site.acres,
      prior_land_use: scen.site.prior_land_use, cauv_enrolled: scen.site.cauv_enrolled,
    },
    facility: {
      it_load_mw: scen.facility.it_load_mw, pue: scen.facility.pue, cooling: cool,
      water_source: scen.facility.water_source, capex_usd: scen.facility.capex_usd,
      phases: scen.facility.phases.map((p) => ({ year: p.year, mw: p.mw_online })),
      backup_gen_count: scen.facility.backup_gen_count, backup_gen_mw_each: scen.facility.backup_gen_mw_each,
    },
    policy: {
      property_abatement_pct: scen.policy.property_abatement_pct,
      abatement_years: scen.policy.abatement_years,
      pilot_annual_usd: 0, pilot_school_share_pct: 0,                // unused on parity path
      pilot_pct: scen.policy.pilot_pct,                               // Python parameterisation
      school_compensation_usd: scen.policy.school_compensation_agreement_usd_per_year,
      sales_tax_exemption: scen.policy.sales_tax_exemption,
      noise_setback_ft: 500,
      grid_cost_allocation: "aes_dc_tariff",                          // -> tariff holds
    },
    horizon: scen.horizon,
  };
}

let worst = 0, failures = 0, checks = 0;
for (const name of ["parity_asproposed", "parity_250mw_evap"]) {
  const vec = JSON.parse(readFileSync(path.join(FRONT, "lib", "data", `${name}.json`), "utf8"));
  const input = toSimInput(vec.scenario);
  const ctx = { nearestResidenceM: 500 / 3.28084 };   // Python's noise_setback_ft = 500
  const { rows, meta } = E.runOnce(input, ctx, E.nominalCoefs());

  console.log(`\n=== ${name}  overrides=${JSON.stringify(vec.overrides)} ===`);
  if (rows.length !== vec.rows.length) { console.log(`  ROW COUNT ${rows.length} vs ${vec.rows.length}`); failures++; }
  const perField = {};
  for (let i = 0; i < Math.min(rows.length, vec.rows.length); i++) {
    for (const [k, get] of Object.entries(FIELDS)) {
      const want = vec.rows[i][k], got = get(rows[i]);
      const err = want === 0 ? Math.abs(got) : Math.abs(got - want) / Math.abs(want);
      perField[k] = Math.max(perField[k] ?? 0, err);
      checks++;
      if (!(err <= TOL)) { failures++; if (failures <= 8) console.log(`  MISMATCH ${vec.rows[i].year} ${k}: py=${want} ts=${got} err=${err.toExponential(2)}`); }
    }
  }
  for (const [k, e] of Object.entries(perField)) {
    if (!(e <= worst)) worst = e;
    console.log(`  ${!(e <= TOL) ? "FAIL" : "ok  "} ${k.padEnd(36)} max rel err ${e.toExponential(2)}`);
  }
  const mOk = meta.moratorium_year === vec.meta.moratorium_year && meta.mw_capped_at === vec.meta.mw_capped_at;
  console.log(`  ${mOk ? "ok  " : "FAIL"} moratorium meta  ts=${JSON.stringify(meta)} py=${JSON.stringify(vec.meta)}`);
  if (!mOk) failures++;
}

// Monte Carlo sanity: bands are ordered and nominal lies inside them.
{
  const vec = JSON.parse(readFileSync(path.join(FRONT, "lib", "data", "parity_asproposed.json"), "utf8"));
  const input = toSimInput(vec.scenario), ctx = { nearestResidenceM: 500 / 3.28084 };
  const mc = E.runSimulation(input, ctx), nom = E.runSimulationNominal(input, ctx);
  const last = mc[mc.length - 1], lastNom = nom[nom.length - 1];
  const b = last.ratepayer.household_bill_delta_usd_month, bn = lastNom.ratepayer.household_bill_delta_usd_month.value;
  const ordered = b.low <= b.value && b.value <= b.high;
  const inside = b.low <= bn && bn <= b.high;
  console.log(`\n=== monte carlo ===\n  2041 bill p10/p50/p90 = ${b.low.toFixed(3)}/${b.value.toFixed(3)}/${b.high.toFixed(3)}, nominal ${bn.toFixed(3)}`);
  console.log(`  ${ordered ? "ok  " : "FAIL"} bands ordered   ${inside ? "ok  " : "FAIL"} nominal inside band`);
  if (!ordered || !inside) failures++;
  const rate = E.moratoriumRate(input, ctx);
  console.log(`  moratorium rate over ${40} draws: ${(rate * 100).toFixed(0)}%  (python at 1000 draws: ~27%)`);
}

rmSync(OUT, { recursive: true, force: true });
console.log(`\n${checks} field comparisons, worst rel err ${worst.toExponential(2)}, ${failures} failures`);
process.exit(failures ? 1 : 0);

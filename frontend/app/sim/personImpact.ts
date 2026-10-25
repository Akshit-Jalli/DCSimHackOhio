// How this year's engine row lands on one household. Nothing here is a new
// model: every number is the town-level output (bill delta, jobs, rent, noise)
// read through one person's electricity use, income, job, acres and address.
// Jobs are a lottery with the right odds: 99 permanent jobs in a 5,600-person
// workforce means most residents don't get one, and the card says so.
import { noiseDba, type YearRow } from "./engine";
import type { YearResult } from "./types";
import type { Person } from "./population";

export const TOWN_WORKFORCE = 5600; // Wilmington, OH: ~12.5k people, ~45% in the labor force (ACS); other towns use this too for now
const ELIGIBLE_SHARE = 0.45; // share of the workforce in sectors a data center hires from (ops techs, electricians, IT, security, facilities)
const CONSTRUCTION_SHARE = 0.07; // construction share of the local workforce
const REGIONAL_POOL = 6; // crews come from the whole region: about 6x the town's own construction workforce
const PERMANENT_WAGE = 72000; // data center technician: BLS OES median for computer/network support and facilities trades, rounded
const WATER_BILL_MO = 55; // typical residential water + sewer bill in a small Ohio city, $/mo (approximate)

export type Line = { label: string; usd: number; note?: string }; // usd per year: + money in, - money out

export type PersonImpact = {
  lines: Line[];
  netUsdYr: number;
  bill: { deltaMo: number; deltaYr: number; pctIncome: number };
  job: { kind: "construction" | "permanent" | null; text: string; odds: string };
  schools: { perPupilUsd: number; kids: number } | null;
  noise: { dba: number; word: string; distanceM: number } | null;
  farm: { rentPerAcreDelta: number; rentDeltaYr: number; farmsLost: number } | null;
  headline: string;
};

export function noiseWord(dba: number) {
  if (dba < 45) return "a quiet neighborhood at night";
  if (dba < 55) return "a quiet office";
  if (dba < 65) return "normal conversation";
  if (dba < 75) return "a busy road";
  return "heavy traffic";
}

const usd = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");

export function personImpact(
  p: Person,
  args: {
    row: YearResult | null; // this month's (interpolated) town-level row; null before a data center is confirmed
    ledger: YearRow | null; // this year's exact row, for the farm ledger
    baseLedger: YearRow | null; // the first year, for "since 2026"
    site: { pos: [number, number]; lotSize: number; mw: number } | null;
    c: Record<string, number>;
    year: number;
  }
): PersonImpact {
  const { row, ledger, baseLedger, site, c } = args;
  const empty: PersonImpact = {
    lines: [],
    netUsdYr: 0,
    bill: { deltaMo: 0, deltaYr: 0, pctIncome: 0 },
    job: { kind: null, text: "", odds: "" },
    schools: p.kidsInSchool ? { perPupilUsd: 0, kids: p.kidsInSchool } : null,
    noise: null,
    farm: p.farmAcresRented ? { rentPerAcreDelta: 0, rentDeltaYr: 0, farmsLost: 0 } : null,
    headline: "No data center yet. Place one and confirm it to see how the deal lands on this household.",
  };
  if (!row) return empty;

  const lines: Line[] = [];

  // Electricity: the engine's effect is for an average home; scale by this home's use.
  const avgKwh = ((c.mwh_per_home ?? 10.5) * 1000) / 12;
  const deltaMo = row.ratepayer.household_bill_delta_usd_month.value * (p.kwhPerMonth / avgKwh);
  const deltaYr = deltaMo * 12;
  const pctIncome = p.income > 0 ? (deltaYr / p.income) * 100 : 0;
  if (Math.abs(deltaYr) >= 1) lines.push({ label: "Electricity bill", usd: -deltaYr, note: `${usd(deltaMo)}/mo on ${p.kwhPerMonth.toLocaleString("en-US")} kWh` });

  // Water rates
  const waterYr = (row.water.residential_rate_delta_pct.value / 100) * WATER_BILL_MO * 12;
  if (waterYr >= 1) lines.push({ label: "Water bill", usd: -waterYr, note: `+${row.water.residential_rate_delta_pct.value.toFixed(1)}% on the rate` });

  // Jobs: a lottery with the real odds
  const perm = row.jobs.permanent_fte.value;
  const constr = row.jobs.construction_fte.value;
  const eligible = ["tech", "manufacturing", "logistics", "construction", "service", "public"].includes(p.occupation.sector) && p.age < 62;
  const pPerm = perm / (TOWN_WORKFORCE * ELIGIBLE_SHARE);
  const gotPerm = eligible && perm > 0 && p.ticket < pPerm;
  const pConstr = constr / (TOWN_WORKFORCE * CONSTRUCTION_SHARE * REGIONAL_POOL);
  const gotConstr = !gotPerm && p.occupation.sector === "construction" && constr > 0 && p.ticket < pConstr;
  let job: PersonImpact["job"] = { kind: null, text: "", odds: "" };
  if (gotPerm) {
    const gain = Math.max(0, PERMANENT_WAGE - p.income);
    job = { kind: "permanent", text: `Hired at the data center at about ${usd(PERMANENT_WAGE)}/yr`, odds: `${Math.round(perm)} jobs for ~${Math.round(TOWN_WORKFORCE * ELIGIBLE_SHARE).toLocaleString("en-US")} eligible workers` };
    lines.push({ label: "Data center job", usd: gain, note: gain > 0 ? `up from ${usd(p.income)}` : "about the same pay as before" });
  } else if (gotConstr) {
    const wage = c.construction_wage_usd_per_year ?? 75000;
    const gain = Math.max(0, wage - p.income);
    job = { kind: "construction", text: `On the construction crew this year at about ${usd(wage)}/yr`, odds: `${Math.round(constr)} crew jobs drawn from the whole region` };
    lines.push({ label: "Construction work", usd: gain, note: "build years only" });
  } else if (eligible || p.occupation.sector === "construction") {
    job = { kind: null, text: "Did not get one of the jobs", odds: perm > 0 ? `${Math.round(perm)} permanent jobs for ~${Math.round(TOWN_WORKFORCE * ELIGIBLE_SHARE).toLocaleString("en-US")} eligible workers: about ${(pPerm * 100).toFixed(1)}% odds` : "no permanent jobs yet" };
  } else {
    job = { kind: null, text: "Not in a field the data center hires from", odds: "" };
  }

  // Farm: renters feel the land loop through cash rent
  let farm: PersonImpact["farm"] = null;
  if (p.farmAcresRented > 0 && ledger && baseLedger) {
    const perAcre = ledger.extra.cash_rent_usd_per_acre - baseLedger.extra.cash_rent_usd_per_acre;
    const rentYr = perAcre * p.farmAcresRented;
    farm = { rentPerAcreDelta: perAcre, rentDeltaYr: rentYr, farmsLost: Math.max(0, Math.round(baseLedger.extra.farms_remaining - ledger.extra.farms_remaining)) };
    if (Math.abs(rentYr) >= 1) lines.push({ label: "Cash rent on cropland", usd: -rentYr, note: `${usd(perAcre)}/acre more on ${p.farmAcresRented} acres` });
  }

  // Schools: not household cash, shown separately
  const schools = p.kidsInSchool ? { perPupilUsd: row.fiscal.net_per_pupil_delta_usd.value, kids: p.kidsInSchool } : null;

  // Noise at this home
  let noise: PersonImpact["noise"] = null;
  if (site && site.mw > 0) {
    const d = Math.max(1, Math.hypot(p.home[0] - site.pos[0], p.home[1] - site.pos[1]) - site.lotSize / 2);
    const dba = noiseDba(site.mw, d, c);
    noise = { dba, word: noiseWord(dba), distanceM: d };
  }

  const net = lines.reduce((s, l) => s + l.usd, 0);

  let headline: string;
  if (gotPerm) headline = `Got one of the ${Math.round(perm)} permanent jobs.`;
  else if (gotConstr) headline = "On the construction crew this year.";
  else if (noise && noise.dba >= 55) headline = `Lives inside the loud zone: ${Math.round(noise.dba)} dBA at home, like ${noise.word}.`;
  else if (farm && Math.abs(farm.rentDeltaYr) >= 100) headline = `Cash rent is up ${usd(farm.rentPerAcreDelta)}/acre: ${usd(farm.rentDeltaYr)} a year on ${p.farmAcresRented} acres.`;
  else if (deltaYr >= 1) headline = `Pays about ${usd(deltaYr)}/yr more for electricity, ${pctIncome.toFixed(2)}% of household income.`;
  else headline = "Little direct effect on this household so far.";

  return { lines, netUsdYr: net, bill: { deltaMo, deltaYr, pctIncome }, job, schools, noise, farm, headline };
}

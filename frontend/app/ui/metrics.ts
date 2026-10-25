// One list of what the model reports, shared by the side panel (small) and the
// analytics view (large). Label, trust tier, format and running-total rule live
// here once so the two views can never disagree about what a number means.
import type { Metric, YearResult } from "../sim/types";
import type { YearRow } from "../sim/engine";

export function fmt(n: number, digits = 0) {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e4) return (n / 1e3).toFixed(0) + "k";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function money(n: number) {
  return (n < 0 ? "-$" : "$") + fmt(Math.abs(n));
}

export const signed = (f: (n: number) => string) => (n: number) => (n >= 0 ? "+" : "") + f(n);

// How much to trust each number. Mirrors the onboarding's Solid / Estimated / Assumed.
export type Tier = "solid" | "estimated" | "assumed";
export const TIER: Record<Tier, { color: string; text: string }> = {
  solid: { color: "#43a047", text: "Solid: physics, published data, or a deal term you set." },
  estimated: { color: "#f9a825", text: "Estimated: from a national study or an independent audit, applied here." },
  assumed: { color: "#e53935", text: "Assumed: our judgment. The range on this number is wide." },
};

// Section identity. `color` is the tag/accent the app already uses; `mark` is
// the same hue stepped dark enough to draw a 2px line on a light surface
// (yellow at 1.9:1 is not legible as a line; amber at 4.2:1 is).
export type SectionId = "water" | "electricity" | "schools" | "noise" | "land";
export const SECTIONS: Record<SectionId, { title: string; color: string; mark: string }> = {
  water: { title: "Water", color: "#1e88e5", mark: "#1e88e5" },
  electricity: { title: "Electricity", color: "#f9a825", mark: "#b26a00" },
  schools: { title: "Schools and taxes", color: "#8e24aa", mark: "#8e24aa" },
  noise: { title: "Noise", color: "#e53935", mark: "#e53935" },
  land: { title: "Land and jobs", color: "#43a047", mark: "#2e7d32" },
};
export const SECTION_ORDER: SectionId[] = ["water", "electricity", "schools", "noise", "land"];

// "Per year" shows the rate in the current year. "Total so far" shows the running
// sum through the current month — the long-term picture, which the rate hides.
export type ViewMode = "year" | "total";

// A flow can be summed over time; `scale` converts the displayed rate to a
// per-year amount first (per day × 365, per month × 12). Stocks have no total.
export type Total = { scale: number; label: string; format: (n: number) => string };

export type MetricDef = {
  id: string;
  section: SectionId;
  label: string;
  tier: Tier;
  lessonKey: string; // the id lessons use in highlightMetric (content/lessons/*.json)
  pick: (r: YearResult) => Metric; // the banded metric: value = p50, low = p10, high = p90
  format: (n: number) => string;
  total?: Total;
  about: string; // one or two sentences on where the number comes from
};

export const METRICS: MetricDef[] = [
  // Water
  { id: "water_mgd", lessonKey: "water.daily", section: "water", label: "Water used per day", tier: "estimated", pick: (r) => r.water.withdrawal_mgd, format: (n) => `${fmt(n, 2)} M gal`, total: { scale: 365, label: "Water used so far", format: (n) => `${fmt(n)} M gal` }, about: "Evaporative cooling consumes water on site; air cooling almost none. The source is the city system or wells on the site." },
  { id: "water_pct", lessonKey: "water.share", section: "water", label: "Share of city system", tier: "estimated", pick: (r) => r.water.pct_of_system_capacity, format: (n) => `${fmt(n, 1)}%`, about: "Daily withdrawal against the city water system's design capacity." },
  { id: "water_rate", lessonKey: "water.rates", section: "water", label: "Home water rates", tier: "assumed", pick: (r) => r.water.residential_rate_delta_pct, format: (n) => `+${fmt(n, 1)}%`, about: "Our assumption: residential rates rise with the share of system capacity consumed. A real figure needs this town's rate study." },
  // Electricity
  { id: "mwh", lessonKey: "power.mwh", section: "electricity", label: "Power used per year", tier: "solid", pick: (r) => r.energy.facility_mwh, format: (n) => `${fmt(n)} MWh`, total: { scale: 1, label: "Power used so far", format: (n) => `${fmt(n)} MWh` }, about: "IT load × PUE × utilization × hours in the year. Air cooling adds a PUE penalty." },
  { id: "homes", lessonKey: "power.homes", section: "electricity", label: "Same as # of homes", tier: "solid", pick: (r) => r.energy.homes_equivalent, format: (n) => fmt(n), about: "Annual energy divided by an average US home's 10.5 MWh a year." },
  { id: "bill", lessonKey: "power.bill", section: "electricity", label: "Household bill", tier: "estimated", pick: (r) => r.ratepayer.household_bill_delta_usd_month, format: (n) => `+$${fmt(n, 2)}/mo`, total: { scale: 12, label: "Paid per household so far", format: (n) => `+$${fmt(n)}` }, about: "From a national study of towns that got data centers: about +5.2% where the utility is investor-owned, no effect at co-ops. A large-load tariff moves most of it onto the data center." },
  // Schools and taxes
  { id: "tax_forgone", lessonKey: "money.tax_forgiven", section: "schools", label: "Property tax forgiven", tier: "solid", pick: (r) => r.fiscal.property_tax_forgone_usd, format: money, total: { scale: 1, label: "Tax forgiven so far", format: money }, about: "Full property tax on the campus × the abatement %, for the abatement years." },
  { id: "pilot", lessonKey: "money.pilot", section: "schools", label: "Payment to town (PILOT)", tier: "solid", pick: (r) => r.fiscal.pilot_received_usd, format: money, total: { scale: 1, label: "PILOT received so far", format: money }, about: "Payment in lieu of taxes: the fixed annual sum in the deal, part of it earmarked for schools." },
  { id: "per_pupil", lessonKey: "money.per_student", section: "schools", label: "Per student", tier: "estimated", pick: (r) => r.fiscal.net_per_pupil_delta_usd, format: signed(money), total: { scale: 1, label: "Per student so far", format: signed(money) }, about: "Net school revenue per pupil: local tax and PILOT share gained, minus state aid lost as the tax base grows under Ohio's funding formula." },
  // Noise
  { id: "noise", lessonKey: "noise.nearest_home", section: "noise", label: "At the nearest home", tier: "assumed", pick: (r) => r.nuisance.noise_dba_at_nearest_residence, format: (n) => `${fmt(n)} dBA`, about: "Fan and generator noise, attenuated over the distance to the nearest home. 55 dBA is a quiet office; 65 is normal conversation." },
  // Land and jobs
  { id: "acres", lessonKey: "land.acres", section: "land", label: "Farmland converted", tier: "solid", pick: (r) => r.land.acres_converted, format: (n) => `${fmt(n)} acres`, about: "The site's acres, out of farming from the first year of construction." },
  { id: "construction", lessonKey: "jobs.construction", section: "land", label: "Construction jobs", tier: "estimated", pick: (r) => r.jobs.construction_fte, format: (n) => fmt(Math.round(n)), total: { scale: 1, label: "Construction work so far", format: (n) => `${fmt(Math.round(n))} job-yrs` }, about: "Only about a fifth of a data center's price is construction. Jobs arrive in waves with each phase and end." },
  { id: "permanent", lessonKey: "jobs.permanent", section: "land", label: "Permanent jobs", tier: "estimated", pick: (r) => r.jobs.permanent_fte, format: (n) => fmt(Math.round(n)), about: "Independent legislative audits put this near 0.4 per MW." },
];

// Internal ledgers the engine keeps on the nominal run. No Monte Carlo band;
// the analytics view shows them because they are the mechanisms behind the
// numbers above. The side panel does not.
export type DeepDef = {
  id: string;
  section: SectionId;
  label: string;
  get: (r: YearRow) => number;
  format: (n: number) => string;
  total?: Total;
  about: string;
};

export const DEEP: DeepDef[] = [
  { id: "state_aid", section: "schools", label: "State aid to the district", get: (r) => r.extra.school_state_funding_usd, format: money, about: "Ohio's formula (ORC 3317.017) sends less state aid as local property value per pupil grows. This is the whole district's aid, with the campus on the rolls." },
  { id: "local_tax_schools", section: "schools", label: "Local property tax to schools", get: (r) => r.extra.local_property_tax_to_schools_usd, format: money, total: { scale: 1, label: "Local tax to schools so far", format: money }, about: "The schools' share of the property tax the campus actually pays after abatement." },
  { id: "tax_full", section: "schools", label: "Property tax if un-abated", get: (r) => r.extra.property_tax_full_usd, format: money, about: "What the campus would owe with no abatement: the ceiling the deal negotiates down from." },
  { id: "co2", section: "electricity", label: "Marginal CO₂ per year", get: (r) => r.extra.marginal_co2_tons, format: (n) => `${fmt(n)} t`, total: { scale: 1, label: "CO₂ so far", format: (n) => `${fmt(n)} t` }, about: "Emissions from the extra generation the regional grid runs to serve this load, at the grid's marginal rate." },
  { id: "water_indirect", section: "water", label: "Power-plant water per day", get: (r) => r.extra.water_indirect_mgal / 365, format: (n) => `${fmt(n, 2)} M gal`, total: { scale: 365, label: "Power-plant water so far", format: (n) => `${fmt(n)} M gal` }, about: "Cooling water consumed upstream to generate its electricity (4.5 L per kWh). With evaporative cooling that is about twelve times the site's own use; with air cooling, far more, because the site itself uses almost none." },
  { id: "sewer", section: "water", label: "Sewer plant load", get: (r) => r.extra.sewer_pct_of_design * 100, format: (n) => `${fmt(n)}% of design`, about: "The wastewater plant's flow against its design. Past 100% the model caps new hookups, which caps the build-out." },
  { id: "farms", section: "land", label: "Farms left in the county", get: (r) => r.extra.farms_remaining, format: (n) => fmt(Math.round(n)), about: "Land speculation raises cash rent; a share of renting farmers exit when rent jumps. Change-driven, so it settles once rents stop rising." },
  { id: "rent", section: "land", label: "Farm cash rent", get: (r) => r.extra.cash_rent_usd_per_acre, format: (n) => `$${fmt(n)}/acre`, about: "County cash rent per acre, pushed up by land speculation around the site." },
  { id: "backlash", section: "noise", label: "Opposition index", get: (r) => r.extra.backlash_index, format: (n) => n.toFixed(2), about: "Builds with household bills and decays each year. If it crosses the threshold, a moratorium stops further expansion." },
];

export type Band = { p50: number[]; lo: number[]; hi: number[] };

export function cumulative(series: number[]): number[] {
  let s = 0;
  return series.map((v) => (s += v));
}

/** Yearly series for a metric, with its p10/p90 band. In total mode the band is the
 *  running sum of yearly p10/p90, which is approximate (and conservative). */
export function metricSeries(results: YearResult[], d: MetricDef, mode: ViewMode): Band {
  const ms = results.map(d.pick);
  let p50 = ms.map((m) => m.value);
  let lo = ms.map((m) => m.low ?? m.value);
  let hi = ms.map((m) => m.high ?? m.value);
  if (mode === "total" && d.total) {
    const s = d.total.scale;
    p50 = cumulative(p50.map((v) => v * s));
    lo = cumulative(lo.map((v) => v * s));
    hi = cumulative(hi.map((v) => v * s));
  }
  return { p50, lo, hi };
}

export function deepSeries(results: YearRow[], d: DeepDef, mode: ViewMode): number[] {
  const s = results.map(d.get);
  return mode === "total" && d.total ? cumulative(s.map((v) => v * d.total!.scale)) : s;
}

// A Town Profile is the town-specific data the engine actually reads — nothing
// more. Of the ~136 values in the Wilmington baseline, the model consumes 13
// (plus the site's own tax figures) and five coefficients that are really
// place data (grid emission rate, utility ownership, tariff, school millage
// share, regional wage). Everything else is report context.
//
// Every value carries provenance: where it came from, how much to trust it,
// and how it arrived (api, ai_search, upload, manual, default). A value that
// fell back to a default is still a value — the run proceeds — but it widens
// the result band and the UI marks it.
//
// Flow: pick a town -> autofill what public data can -> user confirms or
// edits the rest -> profileToBaseline() + profileToCoefOverrides() feed
// simulate(). Wilmington is the preloaded sample.

import baselineJson from "../../lib/data/baseline.json";
import coefficientsJson from "../../lib/data/coefficients.json";
import type { Baseline } from "./engine";

export type Confidence = "high" | "medium" | "low";
export type Origin = "api" | "ai_search" | "upload" | "manual" | "default";
export type Ownership = "iou" | "coop" | "municipal";

export type PV = {
  value: number;
  source: string;
  confidence: Confidence;
  origin: Origin;
  note?: string;
  /** optional range when the value is itself uncertain (defaults, estimates) */
  low?: number;
  high?: number;
};

export type TownProfile = {
  place_name: string;
  slug: string;
  state: string;
  county_fips: string;
  school: {
    district_name: string;
    irn: string;
    capacity_av_usd: PV;
    base_cost_enrolled_adm: PV;
    enrolled_adm: PV;
    capacity_pct: PV;
    base_cost_per_pupil_usd: PV;
    local_capacity_per_pupil_usd: PV;
  };
  agriculture: { county_farms: PV; cash_rent_usd_per_acre: PV };
  wastewater: { wwtp_design_mgd: PV; mean_monthly_avg_mgd: PV };
  water: { wtp_capacity_mgd: PV };
  site: { taxable_usd: PV; annual_tax_usd: PV };
  grid: {
    egrid_subregion: string;
    marginal_co2_lb_per_mwh: PV;
    utility_name: string;
    ownership: Ownership;
    has_large_load_tariff: boolean;
  };
  place_coefficients: {
    school_share_of_property_tax: PV;
    construction_wage_usd_per_year: PV;
  };
};

// ------------------------------------------------------------ field catalogue
// What the checklist UI shows. Tier follows the intake plan:
//   required    – blocks the run until present
//   defaultable – runs on a labelled fallback, marked lower confidence
export type FieldDef = {
  key: string; // dotted path into TownProfile
  label: string;
  unit: string;
  group: "Schools" | "Farmland" | "Sewer and water" | "Site parcel" | "Grid" | "Place coefficients";
  tier: "required" | "defaultable";
  feeds: string;
  bestSource: string;
  min?: number;
  max?: number;
};

export const FIELDS: FieldDef[] = [
  { key: "school.capacity_av_usd", label: "District capacity assessed valuation", unit: "$", group: "Schools", tier: "required", feeds: "state aid formula", bestSource: "Ohio DEW SFPR workbook, Local Capacity sheet [V1]" },
  { key: "school.base_cost_enrolled_adm", label: "Base-cost enrolled ADM", unit: "students", group: "Schools", tier: "required", feeds: "valuation per pupil", bestSource: "DEW SFPR, Local Capacity [A1]" },
  { key: "school.enrolled_adm", label: "Enrolled ADM", unit: "students", group: "Schools", tier: "required", feeds: "funding multiplication", bestSource: "DEW SFPR, Detailed SFPR [a]" },
  { key: "school.capacity_pct", label: "Local capacity percentage", unit: "fraction", group: "Schools", tier: "required", feeds: "state aid formula", bestSource: "DEW SFPR, Local Capacity [C6]", min: 0.0125, max: 0.025 },
  { key: "school.base_cost_per_pupil_usd", label: "Base cost per pupil", unit: "$", group: "Schools", tier: "required", feeds: "state aid formula", bestSource: "DEW SFPR, Detailed SFPR [b2]" },
  { key: "school.local_capacity_per_pupil_usd", label: "Local capacity per pupil", unit: "$", group: "Schools", tier: "required", feeds: "state aid formula", bestSource: "DEW SFPR, Detailed SFPR [b1]" },
  { key: "agriculture.county_farms", label: "Farms in the county", unit: "farms", group: "Farmland", tier: "required", feeds: "farm exit loop", bestSource: "USDA Census of Agriculture county profile" },
  { key: "agriculture.cash_rent_usd_per_acre", label: "Cropland cash rent", unit: "$/acre", group: "Farmland", tier: "defaultable", feeds: "land and rent loop", bestSource: "USDA NASS Quick Stats (state average fallback)" },
  { key: "wastewater.wwtp_design_mgd", label: "Sewer plant design flow", unit: "MGD", group: "Sewer and water", tier: "required", feeds: "sewer constraint", bestSource: "NPDES permit; EPA ECHO facility record" },
  { key: "wastewater.mean_monthly_avg_mgd", label: "Sewer plant average flow", unit: "MGD", group: "Sewer and water", tier: "required", feeds: "sewer constraint", bestSource: "EPA ECHO discharge monitoring reports, 24-month mean" },
  { key: "water.wtp_capacity_mgd", label: "Water plant capacity", unit: "MGD", group: "Sewer and water", tier: "defaultable", feeds: "share of city system", bestSource: "EPA SDWIS; utility annual report" },
  { key: "site.taxable_usd", label: "Site taxable value today", unit: "$", group: "Site parcel", tier: "defaultable", feeds: "effective tax rate", bestSource: "County auditor parcel record" },
  { key: "site.annual_tax_usd", label: "Site annual tax today", unit: "$", group: "Site parcel", tier: "defaultable", feeds: "effective tax rate", bestSource: "County auditor tax bill" },
  { key: "grid.marginal_co2_lb_per_mwh", label: "Marginal grid CO₂ rate", unit: "lb/MWh", group: "Grid", tier: "required", feeds: "emissions", bestSource: "EPA eGRID non-baseload rate for the subregion" },
  { key: "place_coefficients.school_share_of_property_tax", label: "Schools' share of property tax", unit: "fraction", group: "Place coefficients", tier: "defaultable", feeds: "local tax to schools", bestSource: "County auditor millage abstract", min: 0.3, max: 0.9 },
  { key: "place_coefficients.construction_wage_usd_per_year", label: "Construction wage", unit: "$/yr", group: "Place coefficients", tier: "defaultable", feeds: "household ledger", bestSource: "BLS OES, metro or nonmetro area" },
];

export function getPV(p: TownProfile, key: string): PV {
  const [g, k] = key.split(".");
  return (p as unknown as Record<string, Record<string, PV>>)[g][k];
}
export function setPV(p: TownProfile, key: string, pv: PV): TownProfile {
  const [g, k] = key.split(".");
  const next = structuredClone(p) as unknown as Record<string, Record<string, PV>>;
  next[g][k] = pv;
  return next as unknown as TownProfile;
}

// ------------------------------------------------------------ Wilmington
type V = { value: number; source?: string; confidence?: Confidence; note?: string; low?: number; high?: number };
const B = baselineJson as unknown as {
  school_district: Record<string, V | string>;
  agriculture: Record<string, V>;
  wastewater: Record<string, V>;
  water: Record<string, V>;
  site_parcel: { taxable_usd: number; current_annual_tax_usd: number };
  electric: Record<string, V | string>;
};
type CoefEntry = { value: number; low?: number; high?: number; source?: string; confidence?: Confidence };
const C = coefficientsJson as unknown as Record<string, CoefEntry>;

const api = (v: V, fallbackSource: string): PV => ({
  value: v.value,
  source: v.source ?? fallbackSource,
  confidence: v.confidence ?? "high",
  origin: "api",
  note: v.note,
  low: v.low,
  high: v.high,
});
const coefPV = (k: string, origin: Origin = "default"): PV => ({
  value: C[k].value,
  low: C[k].low,
  high: C[k].high,
  source: C[k].source ?? k,
  confidence: C[k].confidence ?? "medium",
  origin,
});

export const WILMINGTON: TownProfile = {
  place_name: "Wilmington, Ohio",
  slug: "wilmington-oh",
  state: "OH",
  county_fips: "39027",
  school: {
    district_name: "Wilmington City School District",
    irn: "045112",
    capacity_av_usd: api(B.school_district.capacity_av_usd as V, "DEW FY26 SFPR"),
    base_cost_enrolled_adm: api(B.school_district.base_cost_enrolled_adm as V, "DEW FY26 SFPR"),
    enrolled_adm: api(B.school_district.enrolled_adm as V, "DEW FY26 SFPR"),
    capacity_pct: api(B.school_district.capacity_pct as V, "DEW FY26 SFPR"),
    base_cost_per_pupil_usd: api(B.school_district.base_cost_per_pupil_usd as V, "DEW FY26 SFPR"),
    local_capacity_per_pupil_usd: api(B.school_district.local_capacity_per_pupil_usd as V, "DEW FY26 SFPR"),
  },
  agriculture: {
    county_farms: api(B.agriculture.county_farms, "2022 Census of Agriculture"),
    cash_rent_usd_per_acre: api(B.agriculture.cash_rent_usd_per_acre, "USDA NASS"),
  },
  wastewater: {
    wwtp_design_mgd: api(B.wastewater.wwtp_design_mgd, "NPDES permit"),
    mean_monthly_avg_mgd: api(B.wastewater.mean_monthly_avg_mgd, "EPA ECHO DMRs"),
  },
  water: { wtp_capacity_mgd: api(B.water.wtp_capacity_mgd, "Wilmington water utility") },
  site: {
    taxable_usd: { value: B.site_parcel.taxable_usd, source: "Clinton County Auditor parcel 285130201000000", confidence: "high", origin: "api" },
    annual_tax_usd: { value: B.site_parcel.current_annual_tax_usd, source: "Clinton County Auditor parcel 285130201000000", confidence: "high", origin: "api" },
  },
  grid: {
    egrid_subregion: "RFCW",
    marginal_co2_lb_per_mwh: coefPV("marginal_co2_lb_per_mwh", "api"),
    utility_name: "AES Ohio",
    ownership: "iou",
    has_large_load_tariff: true,
  },
  place_coefficients: {
    school_share_of_property_tax: coefPV("school_share_of_property_tax"),
    construction_wage_usd_per_year: coefPV("construction_wage_usd_per_year"),
  },
};

// ------------------------------------------------------------ adapters

/** The engine's Baseline shape, from a profile. */
export function profileToBaseline(p: TownProfile): Baseline {
  const v = (pv: PV) => ({ value: pv.value });
  return {
    school_district: {
      capacity_av_usd: v(p.school.capacity_av_usd),
      base_cost_enrolled_adm: v(p.school.base_cost_enrolled_adm),
      enrolled_adm: v(p.school.enrolled_adm),
      capacity_pct: v(p.school.capacity_pct),
      base_cost_per_pupil_usd: v(p.school.base_cost_per_pupil_usd),
      local_capacity_per_pupil_usd: v(p.school.local_capacity_per_pupil_usd),
    },
    agriculture: { county_farms: v(p.agriculture.county_farms), cash_rent_usd_per_acre: v(p.agriculture.cash_rent_usd_per_acre) },
    wastewater: { wwtp_design_mgd: v(p.wastewater.wwtp_design_mgd), mean_monthly_avg_mgd: v(p.wastewater.mean_monthly_avg_mgd) },
    water: { wtp_capacity_mgd: v(p.water.wtp_capacity_mgd) },
    site_parcel: { current_annual_tax_usd: p.site.annual_tax_usd.value, taxable_usd: p.site.taxable_usd.value },
  };
}

/**
 * Place-specific coefficient overrides. Utility ownership picks the bill
 * coefficient: Meeks et al. find +5.2% for investor-owned, no measurable
 * effect for cooperatives, and "smaller" for public utilities with no point
 * estimate — the municipal figure here is half the IOU one and is marked low.
 */
export function profileToCoefOverrides(p: TownProfile): Record<string, number> {
  const iou = C.household_bill_delta_iou.value;
  const bill = p.grid.ownership === "iou" ? iou : p.grid.ownership === "coop" ? 0 : iou * 0.5;
  return {
    marginal_co2_lb_per_mwh: p.grid.marginal_co2_lb_per_mwh.value,
    household_bill_delta_iou: bill,
    school_share_of_property_tax: p.place_coefficients.school_share_of_property_tax.value,
    construction_wage_usd_per_year: p.place_coefficients.construction_wage_usd_per_year.value,
  };
}

/** Required fields that are still on a default or missing. Drives the run gate and the results banner. */
export function profileGaps(p: TownProfile): { key: string; label: string; tier: FieldDef["tier"]; origin: Origin; confidence: Confidence }[] {
  return FIELDS.flatMap((f) => {
    const pv = getPV(p, f.key);
    const weak = pv.origin === "default" || pv.confidence === "low" || !Number.isFinite(pv.value);
    return weak ? [{ key: f.key, label: f.label, tier: f.tier, origin: pv.origin, confidence: pv.confidence }] : [];
  });
}

/** A profile for a town we have no data for: Wilmington's numbers, every one marked default. */
export function defaultProfileFor(name: string, slug: string, state: string, countyFips: string): TownProfile {
  let p = structuredClone(WILMINGTON) as TownProfile;
  p.place_name = name; p.slug = slug; p.state = state; p.county_fips = countyFips;
  p.school.district_name = "(unknown — using Wilmington City SD)"; p.school.irn = "";
  p.grid.utility_name = "(unknown — assuming investor-owned)";
  for (const f of FIELDS) {
    const pv = getPV(p, f.key);
    p = setPV(p, f.key, { ...pv, origin: "default", confidence: "low", source: `Wilmington default — ${pv.source}` });
  }
  return p;
}

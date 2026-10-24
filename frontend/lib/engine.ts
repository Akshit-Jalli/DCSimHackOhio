// Data layer for the engine output. The sweep already contains every lever
// combination, so the UI is a LOOKUP, not a computation — no backend needed.
//
// Source files are published by engine/sweep.py and engine/model.py to
// frontend/public/data/. Regenerate with `python engine/sweep.py 200` then
// copy out/sweep.json and out/results.json here (minified).

export type Cooling = "air_cooled" | "hybrid" | "evaporative";
export type TariffStatus = "approved_as_written" | "rejected";

export type Overrides = {
  property_abatement_pct: number;
  abatement_years: number;
  pilot_pct: number;
  cooling: Cooling;
  tariff_status: TariffStatus;
  it_load_mw: number;
};

export const LEVER_KEYS = [
  "property_abatement_pct",
  "abatement_years",
  "pilot_pct",
  "cooling",
  "tariff_status",
  "it_load_mw",
] as const satisfies readonly (keyof Overrides)[];

export type LeverKey = (typeof LEVER_KEYS)[number];

// Mirrors engine/sweep.py AS_PROPOSED. The actual AWS deal.
export const AS_PROPOSED: Overrides = {
  property_abatement_pct: 100,
  abatement_years: 30,
  pilot_pct: 30,
  cooling: "air_cooled",
  tariff_status: "approved_as_written",
  it_load_mw: 500,
};

export type Kpis = {
  facility_gwh_2041: number;
  co2_ktons_2041: number;
  co2_ktons_cumulative: number;
  water_direct_mgal_2041: number;
  water_indirect_mgal_2041: number;
  household_bill_delta_usd_month: number;
  school_state_aid_delta_usd: number;
  pilot_usd_2041: number;
  local_property_tax_to_schools_usd: number;
  school_total_revenue_delta_usd: number;
  school_total_revenue_cumulative_usd: number;
  household_bill_cumulative_usd: number;
  construction_job_years_total: number;
  permanent_fte_2041: number;
  population_delta_2041: number;
  acres_converted: number;
  farms_lost_2041: number;
  cash_rent_delta_usd_acre: number;
  noise_dba_at_setback: number;
  sewer_pct_of_design_2041: number;
  moratorium_rate: number;
  backlash_index_2041: number;
  utica_well_equivalents_2041: number;
};

export type SweepPoint = { overrides: Overrides; kpis: Kpis };

export type ProfilePick = {
  rank: number;
  score: number;
  levers_changed: number;
  tied_at_top: number | null;
  overrides: Overrides;
  kpis: Kpis;
};

export type Sweep = {
  n_points: number;
  n_draws_per_point: number;
  objectives: Record<string, "max" | "min">;
  pareto_frontier: { size: number; fraction_of_grid: number; points: SweepPoint[] };
  as_proposed: { kpis: Kpis; is_pareto_dominated: boolean; note: string };
  best_by_profile: Record<string, ProfilePick[]>;
  profiles_note: string;
  all_points: SweepPoint[];
};

// ---------------------------------------------------------------- lookup

export function keyOf(o: Overrides): string {
  return LEVER_KEYS.map((k) => String(o[k])).join("|");
}

export type SweepIndex = {
  sweep: Sweep;
  byKey: Map<string, SweepPoint>;
  frontierKeys: Set<string>;
  options: { [K in LeverKey]: Overrides[K][] };
};

export function indexSweep(sweep: Sweep): SweepIndex {
  const byKey = new Map<string, SweepPoint>();
  for (const p of sweep.all_points) byKey.set(keyOf(p.overrides), p);

  const frontierKeys = new Set(sweep.pareto_frontier.points.map((p) => keyOf(p.overrides)));

  // Lever options are DERIVED from the sweep so the UI cannot offer a
  // combination that was never computed.
  const options = {} as SweepIndex["options"];
  for (const k of LEVER_KEYS) {
    const vals = Array.from(new Set(sweep.all_points.map((p) => p.overrides[k])));
    vals.sort((a, b) => (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b))));
    (options as Record<string, unknown[]>)[k] = vals;
  }
  return { sweep, byKey, frontierKeys, options };
}

export async function loadSweep(): Promise<SweepIndex> {
  const res = await fetch("/data/sweep.json");
  if (!res.ok) throw new Error(`sweep.json: ${res.status}`);
  return indexSweep((await res.json()) as Sweep);
}

// ------------------------------------------------------------- formatting

export const money = (x: number) =>
  (x < 0 ? "-" : "") + "$" + Math.abs(Math.round(x)).toLocaleString("en-US");

export const num = (x: number, nd = 0) =>
  x.toLocaleString("en-US", { minimumFractionDigits: nd, maximumFractionDigits: nd });

export const pct = (x: number) => `${Math.round(x * 100)}%`;

export const LEVER_LABELS: Record<LeverKey, string> = {
  property_abatement_pct: "Property tax abatement",
  abatement_years: "Abatement term",
  pilot_pct: "PILOT share",
  cooling: "Cooling",
  tariff_status: "AES tariff (PUCO 25-0958)",
  it_load_mw: "Campus size",
};

export function formatLeverValue(k: LeverKey, v: Overrides[LeverKey]): string {
  switch (k) {
    case "property_abatement_pct":
    case "pilot_pct":
      return `${v}%`;
    case "abatement_years":
      return `${v} yr`;
    case "it_load_mw":
      return `${v} MW`;
    case "cooling":
      return String(v).replace("_", " ");
    case "tariff_status":
      return v === "approved_as_written" ? "approved as written" : "rejected";
  }
}

export const PROFILE_LABELS: Record<string, string> = {
  schools_first: "Schools first",
  jobs_first: "Jobs first",
  farmland_first: "Farmland first",
  ratepayers_first: "Ratepayers first",
  climate_first: "Climate first",
  balanced: "Balanced",
};

// Shapes of the engine's input and output, matching the team's JSON spec.
// When the real engine is ready, it should accept SimInput and return YearResult[].

export type Cooling = "closed_loop_air" | "hybrid" | "evaporative";
export type WaterSource = "municipal" | "onsite_wells";

export type Phase = { year: number; mw: number };

export type SimInput = {
  site: {
    fips_county: string;
    lat: number;
    lon: number;
    acres: number;
    prior_land_use: string;
    cauv_enrolled: boolean;
  };
  facility: {
    it_load_mw: number;
    pue: number;
    cooling: Cooling;
    water_source: WaterSource;
    capex_usd: number;
    phases: Phase[];
    backup_gen_count: number;
    backup_gen_mw_each: number;
  };
  policy: {
    property_abatement_pct: number;
    abatement_years: number;
    pilot_annual_usd: number;
    pilot_school_share_pct: number;
    sales_tax_exemption: boolean;
    noise_setback_ft: number;
    grid_cost_allocation: string;
  };
  horizon: { start_year: number; end_year: number };
};

// One number with its unit and a low/high range
export type Metric = { value: number; unit: string; low?: number; high?: number };

export type YearResult = {
  year: number;
  active_mw: number;
  energy: { facility_mwh: Metric; homes_equivalent: Metric };
  ratepayer: { household_bill_delta_usd_month: Metric };
  fiscal: {
    property_tax_forgone_usd: Metric;
    pilot_received_usd: Metric;
    net_per_pupil_delta_usd: Metric;
  };
  water: {
    withdrawal_mgd: Metric;
    pct_of_system_capacity: Metric;
    residential_rate_delta_pct: Metric;
  };
  land: { acres_converted: Metric };
  jobs: { construction_fte: Metric; permanent_fte: Metric };
  nuisance: {
    noise_dba_at_nearest_residence: Metric;
    loud_radius_m: Metric; // distance from the site edge where noise drops to 55 dBA
  };
};

"use client";
import { money, num, pct, type Kpis as KpiData, type SweepPoint } from "../lib/engine";

type Row = { label: string; key: keyof KpiData; fmt: (x: number) => string; unit?: string };

const ROWS: Row[] = [
  { label: "Household electric bill", key: "household_bill_delta_usd_month", fmt: (x) => `+${num(x, 2)}`, unit: "$/mo" },
  { label: "District revenue, 15 yr", key: "school_total_revenue_cumulative_usd", fmt: money },
  { label: "Permanent jobs, 2041", key: "permanent_fte_2041", fmt: (x) => num(x), unit: "FTE" },
  { label: "Construction (direct)", key: "construction_job_years_total", fmt: (x) => num(x), unit: "job-yrs" },
  { label: "Facility energy, 2041", key: "facility_gwh_2041", fmt: (x) => num(x), unit: "GWh/yr" },
  { label: "CO₂, cumulative", key: "co2_ktons_cumulative", fmt: (x) => num(x), unit: "kt" },
  { label: "Site water", key: "water_direct_mgal_2041", fmt: (x) => num(x), unit: "Mgal/yr" },
  { label: "Upstream water", key: "water_indirect_mgal_2041", fmt: (x) => num(x), unit: "Mgal/yr" },
  { label: "Farms exited", key: "farms_lost_2041", fmt: (x) => num(x), unit: "of 788" },
  { label: "Noise at setback", key: "noise_dba_at_setback", fmt: (x) => num(x, 1), unit: "dBA" },
  { label: "Moratorium probability", key: "moratorium_rate", fmt: pct },
];

type Props = {
  point: SweepPoint | undefined;
  onFrontier: boolean;
  isProposed: boolean;
  baseline: KpiData; // the as-proposed KPIs, for deltas
};

export default function Kpis({ point, onFrontier, isProposed, baseline }: Props) {
  if (!point) {
    return <p className="text-sm text-neutral-500">That combination was not in the sweep.</p>;
  }
  const k = point.kpis;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Outcomes, median of {`${num(200)}`} draws
        </h2>
        <span
          className={
            "rounded px-2 py-0.5 text-[11px] font-medium " +
            (onFrontier ? "bg-emerald-900/60 text-emerald-300" : "bg-amber-900/60 text-amber-300")
          }
          title={
            onFrontier
              ? "No other lever setting beats this one on every objective at once."
              : "Some other lever setting is at least as good on every objective and better on at least one."
          }
        >
          {onFrontier ? "Pareto-optimal" : "Dominated"}
        </span>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {ROWS.map((r) => {
            const v = k[r.key];
            const b = baseline[r.key];
            const d = v - b;
            const showDelta = !isProposed && Math.abs(d) > 1e-9;
            return (
              <tr key={r.key} className="border-t border-neutral-800">
                <td className="py-1 pr-2 text-neutral-300">{r.label}</td>
                <td className="py-1 text-right font-mono tabular-nums text-neutral-100">
                  {r.fmt(v)}
                  {r.unit && <span className="ml-1 text-[11px] text-neutral-500">{r.unit}</span>}
                </td>
                <td className="w-16 py-1 text-right font-mono text-[11px] tabular-nums">
                  {showDelta && (
                    <span className={d > 0 ? "text-neutral-400" : "text-neutral-400"}>
                      {d > 0 ? "+" : ""}
                      {r.key.endsWith("_usd") || r.key.includes("usd_month")
                        ? money(d)
                        : r.key === "moratorium_rate"
                        ? pct(d)
                        : num(d, r.key === "noise_dba_at_setback" ? 1 : 0)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-[11px] leading-snug text-neutral-500">
        Deltas are against the deal as proposed. Every number traces to{" "}
        <code className="text-neutral-400">data/coefficients.yaml</code> with a source; the model has no
        deal-viability constraint and cannot tell you whether AWS would accept an alternative.
      </p>
    </section>
  );
}

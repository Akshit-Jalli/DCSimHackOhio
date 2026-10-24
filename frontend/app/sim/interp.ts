// The engine steps once a year (that is the model, and what the parity test
// checks against the Python). The UI scrubs in months. Values between two
// annual states are blended linearly so the panel moves as time passes.
//
// This is a DISPLAY convenience, not a model claim: a phase that the engine
// opens in January 2029 will read as ramping through 2028. The year bar says
// so. Anything that must be the engine's literal annual value (the noise
// radius, landmark labels) keeps using the annual row.
import type { Metric, YearResult } from "./types";

const GROUPS = ["energy", "ratepayer", "fiscal", "water", "land", "jobs", "nuisance"] as const;

function lerpMetric(a: Metric, b: Metric, f: number): Metric {
  const m: Metric = { value: a.value + (b.value - a.value) * f, unit: a.unit };
  if (a.low !== undefined && b.low !== undefined) m.low = a.low + (b.low - a.low) * f;
  if (a.high !== undefined && b.high !== undefined) m.high = a.high + (b.high - a.high) * f;
  return m;
}

/** t is a fractional index into results: 0 = first year, 1.5 = halfway through the second. */
export function interpResult(results: YearResult[], t: number): YearResult {
  const n = results.length;
  const i = Math.max(0, Math.min(n - 1, Math.floor(t)));
  const j = Math.min(n - 1, i + 1);
  const f = Math.max(0, Math.min(1, t - i));
  const a = results[i];
  if (i === j || f === 0) return a;
  const b = results[j];
  const out: Record<string, unknown> = {
    year: a.year,
    active_mw: a.active_mw + (b.active_mw - a.active_mw) * f,
  };
  for (const g of GROUPS) {
    const ga = a[g] as unknown as Record<string, Metric>;
    const gb = b[g] as unknown as Record<string, Metric>;
    const go: Record<string, Metric> = {};
    for (const k of Object.keys(ga)) go[k] = lerpMetric(ga[k], gb[k], f);
    out[g] = go;
  }
  return out as unknown as YearResult;
}

/** Interpolate one series of numbers at fractional index t. */
export function interpSeries(series: number[], t: number): number {
  const n = series.length;
  if (n === 0) return 0;
  const i = Math.max(0, Math.min(n - 1, Math.floor(t)));
  const j = Math.min(n - 1, i + 1);
  const f = Math.max(0, Math.min(1, t - i));
  return series[i] + (series[j] - series[i]) * f;
}

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function monthLabel(startYear: number, month: number): string {
  return `${MONTHS[((month % 12) + 12) % 12]} ${startYear + Math.floor(month / 12)}`;
}

/** 0 at the start of January, 1 at the start of July, back to 0 by the next January. */
export function nightFromMonth(month: number): number {
  return 0.5 - 0.5 * Math.cos((2 * Math.PI * (month % 12)) / 12);
}

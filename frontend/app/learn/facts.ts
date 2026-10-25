import type { Lesson } from "./content";

// Facts that follow straight from the data center's size (MW, acres). No fake-engine numbers here.
// Outside numbers (electricity per home, football field size, ...) come from the lesson file with sources.

export const HOURS_PER_YEAR = 8760;
const FALLBACK_HOME_MWH = 10.5; // only if a lesson forgets to give one

export type Facts = { mw: number; mwh: number; homes: number; homeMWh: number; acres: number; fields: number | null };

const num = (v: number | string | undefined) => (typeof v === "number" ? v : undefined);

// If it runs at full power all year: MW x 8,760 hours = MWh; MWh / (MWh one home uses) = homes
export function factsFor(mw: number, acres: number, lesson: Lesson): Facts {
  const homeMWh = num(lesson.facts?.homeMWhPerYear?.value) ?? FALLBACK_HOME_MWH;
  const fieldAcres = num(lesson.facts?.footballFieldAcres?.value);
  const mwh = mw * HOURS_PER_YEAR;
  return { mw, mwh, homes: mwh / homeMWh, homeMWh, acres, fields: fieldAcres ? acres / fieldAcres : null };
}

// Rounded so it reads easily: 50,057 -> "50,000", 242 -> "240", 60.5 -> "60"
export function about(n: number) {
  if (n < 10) return String(Math.round(n));
  if (n < 100) return String(Math.round(n / 5) * 5);
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return (Math.round(n / p) * p).toLocaleString("en-US");
}

// Values lesson text can use: {mw}, {mwh}, {homes}, {homeMWh}, {acres}, {fields}, and every lesson fact by key
export function factVars(f: Facts, lesson: Lesson): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(lesson.facts ?? {})) vars[k] = typeof v.value === "number" ? v.value.toLocaleString("en-US") : v.value;
  return {
    ...vars,
    mw: f.mw.toLocaleString("en-US"),
    mwh: Math.round(f.mwh).toLocaleString("en-US"),
    homes: about(f.homes),
    homeMWh: f.homeMWh.toLocaleString("en-US"),
    acres: f.acres.toLocaleString("en-US"),
    ...(f.fields != null ? { fields: about(f.fields) } : {}),
  };
}

// "Hi {name}!" -> "Hi Maya!" (unknown {words} are left as they are)
export function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

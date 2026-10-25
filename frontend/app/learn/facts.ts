import type { Lesson } from "./content";

// Facts that follow straight from the data center's size (MW). No fake-engine numbers here.
// The one outside number (electricity per home) comes from the lesson file with its source.

export const HOURS_PER_YEAR = 8760;
const FALLBACK_HOME_MWH = 10.5; // only if a lesson forgets to give one

export type Facts = { mw: number; mwh: number; homes: number; homeMWh: number };

// If it runs at full power all year: MW x 8,760 hours = MWh; MWh / (MWh one home uses) = homes
export function factsFor(mw: number, lesson: Lesson): Facts {
  const homeMWh = lesson.facts?.homeMWhPerYear?.value ?? FALLBACK_HOME_MWH;
  const mwh = mw * HOURS_PER_YEAR;
  return { mw, mwh, homes: mwh / homeMWh, homeMWh };
}

// Two significant figures, easier to read: 50,057 -> "50,000"
export function about(n: number) {
  if (n < 100) return String(Math.round(n));
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return (Math.round(n / p) * p).toLocaleString("en-US");
}

// Values lesson text can use: {mw}, {mwh}, {homes}, {homeMWh}
export function factVars(f: Facts): Record<string, string> {
  return {
    mw: f.mw.toLocaleString("en-US"),
    mwh: Math.round(f.mwh).toLocaleString("en-US"),
    homes: about(f.homes),
    homeMWh: f.homeMWh.toLocaleString("en-US"),
  };
}

// "Hi {name}!" -> "Hi Maya!" (unknown {words} are left as they are)
export function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

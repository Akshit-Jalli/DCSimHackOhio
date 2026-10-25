import type { Lesson } from "./content";

// Facts that follow straight from the data center's size (MW, acres). No fake-engine numbers here.
// Outside numbers (electricity per home, football field size, ...) come from the lesson file with sources.

export const HOURS_PER_YEAR = 8760;
const FALLBACK_HOME_MWH = 10.5; // only if a lesson forgets to give one

export type Facts = {
  mw: number;
  mwh: number;
  homes: number;
  homeMWh: number;
  acres: number;
  fields: number | null;
  // Water it would evaporate if all its heat left by evaporating water (null if the lesson lacks the facts)
  kWhPerGallon: number | null;
  gallonsPerDay: number | null;
  bathtubs: number | null;
  people: number | null;
};

const num = (v: number | string | undefined) => (typeof v === "number" ? v : undefined);

// If it runs at full power all year: MW x 8,760 hours = MWh; MWh / (MWh one home uses) = homes
export function factsFor(mw: number, acres: number, lesson: Lesson): Facts {
  const homeMWh = num(lesson.facts?.homeMWhPerYear?.value) ?? FALLBACK_HOME_MWH;
  const fieldAcres = num(lesson.facts?.footballFieldAcres?.value);
  const mwh = mw * HOURS_PER_YEAR;
  // Heat one gallon carries away when it evaporates: kJ per kg x kg per gallon (1 liter of water ~ 1 kg) / 3,600 kJ per kWh
  const evapKJ = num(lesson.facts?.evaporationKJPerKg?.value);
  const litersPerGallon = num(lesson.facts?.litersPerGallon?.value);
  const kWhPerGallon = evapKJ && litersPerGallon ? (evapKJ * litersPerGallon) / 3600 : null;
  // All of its power ends up as heat: MW x 1,000 kWh per hour x 24 hours / kWh per gallon
  const gallonsPerDay = kWhPerGallon ? (mw * 1000 * 24) / kWhPerGallon : null;
  const bath = num(lesson.facts?.bathtubGallons?.value);
  const perPerson = num(lesson.facts?.homeGallonsPerPersonDay?.value);
  return {
    mw,
    mwh,
    homes: mwh / homeMWh,
    homeMWh,
    acres,
    fields: fieldAcres ? acres / fieldAcres : null,
    kWhPerGallon,
    gallonsPerDay,
    bathtubs: gallonsPerDay && bath ? gallonsPerDay / bath : null,
    people: gallonsPerDay && perPerson ? gallonsPerDay / perPerson : null,
  };
}

// Rounded so it reads easily: 50,057 -> "50,000", 242 -> "240", 60.5 -> "60"
export function about(n: number) {
  if (n < 10) return String(Math.round(n));
  if (n < 100) return String(Math.round(n / 5) * 5);
  const p = 10 ** (Math.floor(Math.log10(n)) - 1);
  return (Math.round(n / p) * p).toLocaleString("en-US");
}

// Values lesson text can use: {mw}, {mwh}, {homes}, {homeMWh}, {acres}, {fields}, {kWhPerGallon}, {gallonsPerDay},
// {bathtubs}, {people}, and every lesson fact by key
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
    ...(f.kWhPerGallon != null ? { kWhPerGallon: f.kWhPerGallon.toFixed(2) } : {}),
    ...(f.gallonsPerDay != null ? { gallonsPerDay: about(f.gallonsPerDay) } : {}),
    ...(f.bathtubs != null ? { bathtubs: about(f.bathtubs) } : {}),
    ...(f.people != null ? { people: about(f.people) } : {}),
  };
}

// "Hi {name}!" -> "Hi Maya!" (unknown {words} are left as they are)
export function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

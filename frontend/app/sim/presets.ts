import type { Cooling, Phase, WaterSource } from "./types";

export type Preset = {
  id: string;
  name: string;
  blurb: string;
  mw: number; // final IT load
  tiles: number; // lot is tiles x tiles (each tile = 20 acres)
  phases: Phase[];
  cooling: Cooling;
};

export const PRESETS: Preset[] = [
  {
    id: "enterprise",
    name: "Enterprise",
    blurb: "60 MW · 80 acres",
    mw: 60,
    tiles: 2,
    phases: [{ year: 2027, mw: 60 }],
    cooling: "closed_loop_air",
  },
  {
    id: "hyperscale",
    name: "Hyperscale",
    blurb: "250 MW · 320 acres",
    mw: 250,
    tiles: 4,
    phases: [
      { year: 2027, mw: 60 },
      { year: 2029, mw: 150 },
      { year: 2031, mw: 250 },
    ],
    cooling: "closed_loop_air",
  },
  {
    id: "ai",
    name: "AI Campus",
    blurb: "1,000 MW · 720 acres",
    mw: 1000,
    tiles: 6,
    phases: [
      { year: 2028, mw: 300 },
      { year: 2030, mw: 600 },
      { year: 2033, mw: 1000 },
    ],
    cooling: "evaporative",
  },
];

// Settings the user can change in the panel
export type Settings = {
  presetId: string;
  mw: number;
  cooling: Cooling;
  waterSource: WaterSource;
  abatementPct: number;
};

export function defaultSettings(p: Preset): Settings {
  return {
    presetId: p.id,
    mw: p.mw,
    cooling: p.cooling,
    waterSource: "municipal",
    abatementPct: 100,
  };
}

// Scale the build-out phases so the last phase matches the chosen size
export function scaledPhases(p: Preset, mw: number): Phase[] {
  const k = mw / p.mw;
  return p.phases.map((ph) => ({ year: ph.year, mw: Math.round(ph.mw * k) }));
}

// How much of the data center is running in a given year
export function activeMW(phases: Phase[], year: number) {
  let mw = 0;
  for (const ph of phases) if (ph.year <= year) mw = ph.mw;
  return mw;
}

export const YEAR_START = 2026;
export const YEAR_END = 2041;

import type { FlyTarget, LandmarkKind } from "../lessonControl";

// Lesson content types. Lessons are JSON files in content/lessons/<id>.json, listed in content/modules.json.

export type Band = "K-2" | "3-5" | "6-8" | "9-12";
export const BANDS: Band[] = ["K-2", "3-5", "6-8", "9-12"];

// Any text can be one string for everyone, or one string per grade band
export type Text = string | Partial<Record<Band, string>>;

// The text for a grade band. A missing band uses the nearest band (the younger one first: simpler words).
export function textFor(t: Text | undefined, band: Band): string {
  if (t == null) return "";
  if (typeof t === "string") return t;
  if (t[band]) return t[band]!;
  const i = BANDS.indexOf(band);
  for (let d = 1; d < BANDS.length; d++) {
    for (const j of [i - d, i + d]) {
      const b = BANDS[j];
      if (b && t[b]) return t[b]!;
    }
  }
  return "";
}

export type Mood = "happy" | "thinking" | "wow";

// Numbers worked out from the data center's size (see facts.ts). Text can use them as {mw}, {mwh}, {homes}.
export type FactKey = "mw" | "mwh" | "homes";

// Every step: who sees it (default everyone) and the guide's face
type Common = { bands?: Band[]; mood?: Mood };

// The guide says something. Optional camera move and pin highlight while talking.
export type TalkStep = Common & { type: "talk"; text: Text; fly?: FlyTarget; landmark?: LandmarkKind };

// Fly the camera to something and point at it: a pin, a row in the impacts panel and/or a fact card
export type LookStep = Common & {
  type: "look";
  text: Text;
  target: FlyTarget;
  landmark?: LandmarkKind; // pin to highlight (default: the target, if it's a pin kind)
  highlight?: string; // impacts panel row, e.g. "power.homes" (app/metricKeys.ts)
  fact?: FactKey; // big number card at the top of the screen
  lockCamera?: boolean;
};

export type Choice = { id: string; text: Text };

// Multiple choice guess, saved so a later "check" step can compare
export type PredictStep = Common & { type: "predict"; id: string; text: Text; choices: Choice[] };

// The student has to do something in the 3D scene before Next works
export type DoStep = Common & {
  type: "do";
  text: Text;
  doneText?: Text; // shown once it's done (default "Nice work! ✅")
  fly?: FlyTarget;
} & (
    | {
        action: "place"; // drop a data center on the map
        preset?: string; // which one (default "enterprise")
        suggest?: { x: number; z: number; bands?: Band[] }; // glowing "Build here!" spot (default for K-2 and 3-5)
      }
    | { action: "year"; atLeast: number } // move the year slider to this year or later
  );

// Compare a prediction to the answer
export type CheckStep = Common & {
  type: "check";
  prediction: string; // id of the predict step
  answer: string; // id of the right choice
  text: { right: Text; wrong: Text }; // can use {choice} for what they picked
  fact?: FactKey;
};

// Vote (pick one) or short written answer, saved for the "My work" page
export type ReflectStep = Common & {
  type: "reflect";
  id: string;
  kind: "vote" | "short";
  text: Text;
  choices?: Choice[]; // for "vote"
  placeholder?: Text; // for "short"
};

export type Step = TalkStep | LookStep | PredictStep | DoStep | CheckStep | ReflectStep;

// content/modules.json: the level select. A module is playable once content/lessons/<id>.json exists.
export type ModuleInfo = {
  id: string;
  icon: string;
  title: Text;
  blurb: Text;
  teacher?: {
    goal: Text;
    minutes?: Text;
    standards?: Partial<Record<Band, string[]>>;
  };
};

// content/guides.json: names and colors live in data; the drawings are in Guide.tsx (by id)
export type GuideInfo = { id: string; name: string; color: string; tagline: string };

export type Lesson = {
  id: string;
  title: Text;
  startYear?: number;
  showImpacts?: Band[]; // bands that see the numbers panel once something is placed (default 6-8, 9-12)
  // Numbers used by the facts, each with its source
  facts?: { homeMWhPerYear?: { value: number; source: string } };
  steps: Step[];
};

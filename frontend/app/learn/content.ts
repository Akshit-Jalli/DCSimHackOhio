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

// The guide says something. Optional camera move and pin highlight while talking.
export type TalkStep = { type: "talk"; text: Text; mood?: Mood; fly?: FlyTarget; landmark?: LandmarkKind };

// Fly the camera to something and point at it (a pin and/or a number in the impacts panel)
export type LookStep = {
  type: "look";
  text: Text;
  mood?: Mood;
  target: FlyTarget;
  landmark?: LandmarkKind; // pin to highlight (default: the target, if it's a pin kind)
  highlight?: string; // impacts panel row, e.g. "power.homes" (METRIC_KEYS in app/ui/Panels.tsx)
  lockCamera?: boolean;
};

// predict / do / check / reflect come in the next step
export type Step = TalkStep | LookStep;

export type Lesson = {
  id: string;
  title: Text;
  startYear?: number;
  steps: Step[];
};

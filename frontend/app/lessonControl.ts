import type { YearResult } from "./sim/types";

// How a lesson drives the 3D scene. Without it, Scene works as the normal simulator (/simulate).

// Landmark pins a lesson can point at (the nearest one to the data center, or to the map center)
export type LandmarkKind =
  | "school"
  | "college"
  | "hospital"
  | "fire"
  | "police"
  | "cityhall"
  | "water" // water plant
  | "water_tower"
  | "substation";

export type FlyTarget =
  | "home" // the starting overview of town
  | "datacenter" // close-up of the placed data center (map center if none yet)
  | "loudzone" // higher view of the data center and its red loud zone
  | LandmarkKind
  | { x: number; z: number; dist?: number }; // any spot in scene meters (x east, z south)

export type LessonControl = {
  fly?: { id: number; target: FlyTarget }; // change id to fly again
  lockCamera?: boolean; // student can't move the camera
  presets?: string[]; // data centers the student may place ([] = no build menu); default all
  showYear?: boolean; // year slider (only appears once something is placed); default true
  showImpacts?: boolean; // impacts panel; default true
  showSettings?: boolean; // settings panel; default true
  startYear?: number;
  highlightMetric?: string | null; // impacts row key, see METRIC_KEYS in ui/Panels.tsx
  highlightLandmark?: LandmarkKind | null; // pin gets bigger, shows its name, pulses
  onEvent?: (e: SceneEvent) => void;
};

export type SceneEvent =
  | { type: "loaded" } // map is built
  | { type: "placed"; preset: string; mw: number; x: number; z: number } // student dropped a data center
  | { type: "removed" }
  | { type: "year"; year: number }
  | { type: "results"; year: number; result: YearResult | null } // numbers for the year on screen
  | { type: "flown" }; // camera finished a flight

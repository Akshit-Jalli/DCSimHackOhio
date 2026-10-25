// Checks lesson content for mistakes before anyone sees them.
//   npm run check-lessons
//   npm run check-lessons -- some/other/content   (check another folder)
// Errors (exit code 1) break a lesson; warnings are worth a look (missing grade-band text, very long text).
import fs from "node:fs";
import path from "node:path";
import { BANDS, type Band, type Lesson, type ModuleInfo, type Step, type Text } from "../app/learn/content.ts";
import { METRIC_KEYS } from "../app/metricKeys.ts";
import { PRESETS, YEAR_END, YEAR_START } from "../app/sim/presets.ts";

const DIR = path.resolve(process.argv[2] ?? "content");
const MAP_HALF = 7125; // app/mapConfig.tsx
const GUIDE_DRAWINGS = ["volt", "drip", "bit", "fern"]; // app/learn/Guide.tsx
const LANDMARKS = ["school", "college", "hospital", "fire", "police", "cityhall", "water", "water_tower", "substation"];
const FLY_WORDS = ["home", "datacenter", "loudzone", ...LANDMARKS];
const FACTS = ["mw", "mwh", "homes"];
const PLACEHOLDERS = ["name", "guide", "mw", "mwh", "homes", "homeMWh"];
const LONG = { "K-2": 130, "3-5": 170, "6-8": 220, "9-12": 240 }; // characters before the bubble gets crowded

let errors = 0;
let warnings = 0;
const error = (where: string, msg: string) => {
  errors++;
  console.log(`  ✗ ${where}: ${msg}`);
};
const warn = (where: string, msg: string) => {
  warnings++;
  console.log(`  ! ${where}: ${msg}`);
};

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    error(path.relative(process.cwd(), file), `not valid JSON (${(e as Error).message})`);
    return null;
  }
}

// A text for the bands that will see it: present, known band names, placeholders and **bold** OK.
// bubble = shown in the speech bubble (so length matters)
function checkText(where: string, t: Text | undefined, bands: Band[], extraVars: string[] = [], bubble = true) {
  if (t == null || t === "") return error(where, "text is missing");
  if (typeof t === "object") {
    for (const k of Object.keys(t)) if (!BANDS.includes(k as Band)) error(where, `"${k}" is not a grade band (use ${BANDS.join(", ")})`);
    const missing = bands.filter((b) => !t[b]);
    if (missing.length === bands.length) return error(where, "no text for any grade band that sees this step");
    if (missing.length) warn(where, `no text for ${missing.join(", ")} (will use the nearest band's text)`);
  }
  const all = typeof t === "string" ? bands.map((b) => [b, t] as const) : bands.filter((b) => t[b]).map((b) => [b, t[b]!] as const);
  for (const [b, s] of all) {
    for (const m of s.matchAll(/\{(\w+)\}/g)) {
      if (![...PLACEHOLDERS, ...extraVars].includes(m[1])) error(where, `unknown placeholder {${m[1]}} (${b})`);
    }
    if ((s.match(/\*\*/g) ?? []).length % 2) error(where, `unmatched ** in "${s.slice(0, 40)}…" (${b})`);
    if (bubble && s.length > LONG[b]) warn(where, `${b} text is ${s.length} characters (aim for under ${LONG[b]})`);
  }
}

function checkFly(where: string, f: unknown) {
  if (f == null) return;
  if (typeof f === "string") {
    if (!FLY_WORDS.includes(f)) error(where, `unknown camera target "${f}" (use ${FLY_WORDS.join(", ")} or { "x", "z" })`);
  } else if (typeof f === "object" && typeof (f as { x: unknown }).x === "number" && typeof (f as { z: unknown }).z === "number") {
    const { x, z } = f as { x: number; z: number };
    if (Math.abs(x) > MAP_HALF || Math.abs(z) > MAP_HALF) error(where, `camera target ${x},${z} is off the map (±${MAP_HALF} m)`);
  } else error(where, "camera target must be a word or { \"x\": meters east, \"z\": meters south }");
}

function checkLesson(file: string, moduleIds: string[]) {
  const id = path.basename(file, ".json");
  const lesson = readJson<Lesson>(file);
  if (!lesson) return;
  const L = `lessons/${id}.json`;
  if (lesson.id !== id) error(L, `"id" is "${lesson.id}" but the file is named ${id}.json`);
  if (!moduleIds.includes(id)) error(L, `not listed in modules.json, so nobody can open it`);
  checkText(`${L} title`, lesson.title, BANDS, [], false);
  if (!Array.isArray(lesson.steps) || !lesson.steps.length) return error(L, "has no steps");
  if (lesson.startYear != null && (lesson.startYear < YEAR_START || lesson.startYear > YEAR_END)) error(L, `startYear must be ${YEAR_START}-${YEAR_END}`);

  const usesHomes = JSON.stringify(lesson.steps).match(/\{(homes|homeMWh)\}|"fact":\s*"homes"/);
  if (usesHomes && !(lesson.facts?.homeMWhPerYear?.value && lesson.facts.homeMWhPerYear.source)) {
    error(L, `uses the homes fact, so "facts.homeMWhPerYear" needs a "value" and a "source"`);
  }

  // ids must be unique across predict and reflect steps
  const ids = new Map<string, number>();
  lesson.steps.forEach((s, i) => {
    if ((s.type === "predict" || s.type === "reflect") && s.id) {
      if (ids.has(s.id)) error(`${L} step ${i + 1}`, `id "${s.id}" is also used by step ${ids.get(s.id)! + 1}`);
      ids.set(s.id, i);
    }
  });

  lesson.steps.forEach((s: Step, i) => {
    const W = `${L} step ${i + 1} (${s.type})`;
    const bands = (s.bands ?? BANDS) as Band[];
    for (const b of bands) if (!BANDS.includes(b)) error(W, `"${b}" in "bands" is not a grade band`);
    if (s.mood && !["happy", "thinking", "wow"].includes(s.mood)) error(W, `mood must be happy, thinking or wow`);
    switch (s.type) {
      case "talk":
        checkText(W, s.text, bands);
        checkFly(W, s.fly);
        if (s.landmark && !LANDMARKS.includes(s.landmark)) error(W, `unknown landmark "${s.landmark}"`);
        break;
      case "look":
        checkText(W, s.text, bands);
        if (s.target == null) error(W, `needs a "target"`);
        checkFly(W, s.target);
        if (s.landmark && !LANDMARKS.includes(s.landmark)) error(W, `unknown landmark "${s.landmark}"`);
        if (s.highlight && !METRIC_KEYS.includes(s.highlight)) error(W, `unknown highlight "${s.highlight}" (see app/metricKeys.ts)`);
        if (s.fact && !FACTS.includes(s.fact)) error(W, `unknown fact "${s.fact}" (use ${FACTS.join(", ")})`);
        break;
      case "predict":
        if (!s.id) error(W, `needs an "id"`);
        checkText(W, s.text, bands);
        if (!Array.isArray(s.choices) || s.choices.length < 2) error(W, "needs at least 2 choices");
        else {
          const cids = s.choices.map((c) => c.id);
          if (new Set(cids).size !== cids.length) error(W, "two choices have the same id");
          s.choices.forEach((c, j) => checkText(`${W} choice ${j + 1}`, c.text, bands));
        }
        break;
      case "do":
        checkText(W, s.text, bands);
        if (s.doneText) checkText(`${W} doneText`, s.doneText, bands);
        checkFly(W, s.fly);
        if (s.action === "place") {
          if (s.preset && !PRESETS.some((p) => p.id === s.preset)) error(W, `unknown preset "${s.preset}" (use ${PRESETS.map((p) => p.id).join(", ")})`);
          if (s.suggest && (Math.abs(s.suggest.x) > MAP_HALF || Math.abs(s.suggest.z) > MAP_HALF)) error(W, "suggested spot is off the map");
        } else if (s.action === "year") {
          if (typeof s.atLeast !== "number" || s.atLeast < YEAR_START || s.atLeast > YEAR_END) error(W, `"atLeast" must be a year ${YEAR_START}-${YEAR_END}`);
          const placeBefore = lesson.steps.slice(0, i).some((p) => p.type === "do" && p.action === "place");
          if (!placeBefore) error(W, "the year slider only appears after a data center is placed; add a place step before this");
        } else error(W, `"action" must be "place" or "year"`);
        break;
      case "check": {
        const pi = lesson.steps.findIndex((p) => p.type === "predict" && p.id === s.prediction);
        const pred = lesson.steps[pi];
        if (pi < 0 || pred.type !== "predict") error(W, `prediction "${s.prediction}" doesn't match any predict step`);
        else {
          if (pi > i) error(W, `its prediction "${s.prediction}" comes later (step ${pi + 1})`);
          const predBands = (pred.bands ?? BANDS) as Band[];
          const unseen = bands.filter((b) => !predBands.includes(b));
          if (unseen.length) error(W, `${unseen.join(", ")} see this check but not its prediction`);
          if (!pred.choices?.some((c) => c.id === s.answer)) error(W, `answer "${s.answer}" isn't one of the prediction's choices`);
        }
        if (!s.text?.right || !s.text?.wrong) error(W, `needs "text": { "right": …, "wrong": … }`);
        else {
          checkText(`${W} right`, s.text.right, bands, ["choice"]);
          checkText(`${W} wrong`, s.text.wrong, bands, ["choice"]);
        }
        if (s.fact && !FACTS.includes(s.fact)) error(W, `unknown fact "${s.fact}"`);
        break;
      }
      case "reflect":
        if (!s.id) error(W, `needs an "id"`);
        checkText(W, s.text, bands);
        if (s.kind === "vote") {
          if (!Array.isArray(s.choices) || s.choices.length < 2) error(W, "a vote needs at least 2 choices");
          else s.choices.forEach((c, j) => checkText(`${W} choice ${j + 1}`, c.text, bands));
        } else if (s.kind === "short") {
          if (s.placeholder) checkText(`${W} placeholder`, s.placeholder, bands);
        } else error(W, `"kind" must be "vote" or "short"`);
        break;
      default:
        error(W, `unknown step type "${(s as { type: string }).type}" (use talk, look, predict, do, check, reflect)`);
    }
  });

  // Every band gets a lesson with at least a few steps
  for (const b of BANDS) {
    const n = lesson.steps.filter((s) => !s.bands || s.bands.includes(b)).length;
    if (n < 3) warn(L, `${b} only sees ${n} step(s)`);
  }
}

// ---------- run ----------
console.log(`Checking ${path.relative(process.cwd(), DIR) || "."} …`);
const modules = readJson<ModuleInfo[]>(path.join(DIR, "modules.json")) ?? [];
const moduleIds = modules.map((m) => m.id);
if (new Set(moduleIds).size !== moduleIds.length) error("modules.json", "two modules have the same id");
for (const m of modules) {
  const W = `modules.json ${m.id}`;
  if (!m.icon) warn(W, "no icon");
  checkText(`${W} title`, m.title, BANDS, [], false);
  checkText(`${W} blurb`, m.blurb, BANDS, [], false);
  if (m.teacher) {
    checkText(`${W} teacher goal`, m.teacher.goal, BANDS, [], false);
    for (const b of Object.keys(m.teacher.standards ?? {})) if (!BANDS.includes(b as Band)) error(W, `standards: "${b}" is not a grade band`);
  }
}

const guides = readJson<{ id: string; name: string; color: string; tagline: string }[]>(path.join(DIR, "guides.json")) ?? [];
for (const g of guides) {
  if (!GUIDE_DRAWINGS.includes(g.id)) error(`guides.json ${g.id}`, `no drawing for "${g.id}" (drawings: ${GUIDE_DRAWINGS.join(", ")})`);
  if (!g.name || !g.color || !g.tagline) error(`guides.json ${g.id}`, "needs name, color and tagline");
}

const lessonFiles = fs.readdirSync(path.join(DIR, "lessons")).filter((f) => f.endsWith(".json"));
for (const f of lessonFiles) checkLesson(path.join(DIR, "lessons", f), moduleIds);

console.log(`\n${lessonFiles.length} lesson(s), ${modules.length} module(s), ${guides.length} guide(s): ${errors} error(s), ${warnings} warning(s)`);
if (errors) process.exitCode = 1;

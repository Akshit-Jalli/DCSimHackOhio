// Server only: reads lesson content from frontend/content/. Sync reads run once at build time
// (Next includes them in the static page), so teammates add lessons without touching code.
import fs from "node:fs";
import path from "node:path";
import type { GuideInfo, Lesson, ModuleInfo } from "./content";

const DIR = path.join(process.cwd(), "content");
const readJson = <T,>(...parts: string[]): T => JSON.parse(fs.readFileSync(path.join(DIR, ...parts), "utf8"));

export function readModules(): ModuleInfo[] {
  return readJson("modules.json");
}

export function readGuides(): GuideInfo[] {
  return readJson("guides.json");
}

export function readLesson(id: string): Lesson | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return readJson("lessons", `${id}.json`);
  } catch {
    return null;
  }
}

// Module ids that have a lesson file (the rest show "Coming soon")
export function playableModules(): string[] {
  return readModules().filter((m) => fs.existsSync(path.join(DIR, "lessons", `${m.id}.json`))).map((m) => m.id);
}

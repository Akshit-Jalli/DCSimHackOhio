// Server only: reads lesson content from frontend/content/. Sync reads run once at build time
// (Next includes them in the static page), so teammates add lessons without touching code.
import fs from "node:fs";
import path from "node:path";
import type { Lesson, Text } from "./content";

const DIR = path.join(process.cwd(), "content");

export type ModuleInfo = { id: string; title: Text };

export function readModules(): ModuleInfo[] {
  return JSON.parse(fs.readFileSync(path.join(DIR, "modules.json"), "utf8"));
}

export function readLesson(id: string): Lesson | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, "lessons", `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

"use client";
import { useSyncExternalStore } from "react";
import { BANDS, type Band } from "./content";

// Student profile and progress, saved in this browser only (no accounts, nothing sent anywhere).
// If storage is blocked (private window, school lockdown) it lives in memory until the page closes.

const KEY = "dcsim-learn-v1";

export type ModuleProgress = { step: number; done: boolean; answers?: Record<string, string> };
export type Profile = { name: string; band: Band; guide: string; modules: Record<string, ModuleProgress> };

let memory: string | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return memory;
  }
}

function writeRaw(value: string | null) {
  memory = value;
  try {
    if (value == null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, value);
  } catch {
    // storage blocked: memory only
  }
  listeners.forEach((l) => l());
}

// Only accept data that looks right (old or hand-edited saves start fresh)
function parse(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw);
    if (typeof p?.name !== "string" || !BANDS.includes(p.band) || typeof p.guide !== "string") return null;
    return { name: p.name, band: p.band, guide: p.guide, modules: typeof p.modules === "object" && p.modules ? p.modules : {} };
  } catch {
    return null;
  }
}

// Same object until the saved text changes (useSyncExternalStore needs that)
let lastRaw: string | null | undefined;
let lastProfile: Profile | null = null;
function snapshot() {
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastProfile = parse(raw);
  }
  return lastProfile;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange); // another tab changed it
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

// undefined = not known yet (server render / first paint), null = no student yet
export function useProfile(): Profile | null | undefined {
  return useSyncExternalStore(subscribe, snapshot, () => undefined);
}

export function saveProfile(p: Profile | null) {
  writeRaw(p ? JSON.stringify(p) : null);
}

export function updateModule(id: string, patch: Partial<ModuleProgress>) {
  const p = snapshot();
  if (!p) return;
  const prev = p.modules[id] ?? { step: 0, done: false };
  saveProfile({ ...p, modules: { ...p.modules, [id]: { ...prev, ...patch } } });
}

// A prediction, vote or short answer (shown later on the "My work" page)
export function saveAnswer(moduleId: string, key: string, value: string) {
  const p = snapshot();
  if (!p) return;
  const prev = p.modules[moduleId] ?? { step: 0, done: false };
  updateModule(moduleId, { answers: { ...prev.answers, [key]: value.slice(0, 500) } });
}

// Keep only a sensible first name: trimmed, single spaces, max 20 characters
export function cleanName(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, 20);
}

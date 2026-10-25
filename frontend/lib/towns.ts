// Server-only: find a US town, download its map data from Overture, shrink it, cache it on disk.
// Used by the API routes (app/api/town/...) and by scripts/precache.ts.
// Plain TypeScript only (no enums, no relative imports) so Node can run it directly.
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

// Must match MAP_HALF in app/mapConfig.tsx (50 tiles x 285 m / 2)
const MAP_HALF_M = 7125;
const M_PER_DEG_LAT = 110540;

// Our file name -> Overture download type
export const LAYERS = {
  buildings: "building",
  landcover: "land_cover",
  roads: "segment",
  water: "water",
  places: "place",
  infrastructure: "infrastructure",
} as const;
export type LayerName = keyof typeof LAYERS;
export const LAYER_NAMES = Object.keys(LAYERS) as LayerName[];

export const TOWNS_DIR = path.join(process.cwd(), "data", "towns");

// A search result the user can pick
export type TownPick = {
  name: string; // "New Albany"
  state: string; // "OH"
  county: string | null; // "Franklin County"
  lat: number;
  lon: number;
};

// Saved as data/towns/<slug>/town.json once everything is downloaded.
// lat/lon = center of the 3D map. townLat/townLon = the town's own point (differs for an off-center area;
// missing in caches made before areas existed = same as lat/lon).
export type Town = TownPick & {
  slug: string;
  townLat?: number;
  townLon?: number;
  bbox: [number, number, number, number]; // west, south, east, north
  countyFips: string | null; // county under the map center
  createdAt: string;
};

export type LatLon = { lat: number; lon: number };

// How far an area's center may be from the town (the picker enforces the same limit)
export const MAX_AREA_OFFSET_M = 40000;
// Closer than this to the town's point = the town's default map (plain slug, e.g. the demo towns)
const SAME_CENTER_M = 250;

export function distanceM(a: LatLon, b: LatLon) {
  const x = (b.lon - a.lon) * 111320 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  const y = (b.lat - a.lat) * M_PER_DEG_LAT;
  return Math.hypot(x, y);
}

export type TownStatus =
  | { state: "ready"; town: Town }
  | { state: "loading"; done: LayerName[]; total: number }
  | { state: "error"; error: string }
  | { state: "missing" };

// Survives Next dev hot reloads (module code re-runs, globalThis does not)
type Job = { done: LayerName[]; error: string | null; promise: Promise<Town> };
const g = globalThis as typeof globalThis & {
  __townJobs?: Map<string, Job>;
  __searchCache?: Map<string, TownPick[]>;
  __nominatimNext?: number;
};
const jobs = (g.__townJobs ??= new Map());
const searchCache = (g.__searchCache ??= new Map());

export function slugify(name: string, state: string) {
  return `${name}-${state}`.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function isValidSlug(slug: string) {
  return /^[a-z0-9-]{1,80}$/.test(slug);
}

// The map box around a center point, in degrees
export function bboxAround(lat: number, lon: number): Town["bbox"] {
  const dLat = MAP_HALF_M / M_PER_DEG_LAT;
  const dLon = MAP_HALF_M / (111320 * Math.cos((lat * Math.PI) / 180));
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return [r(lon - dLon), r(lat - dLat), r(lon + dLon), r(lat + dLat)];
}

// ---------- Town search (Nominatim) ----------
// Usage policy: real User-Agent with a contact, max 1 request/second, cache results.
// https://operations.osmfoundation.org/policies/nominatim/

function userAgent() {
  const contact = process.env.NOMINATIM_CONTACT;
  if (!contact) throw new Error("Set NOMINATIM_CONTACT in frontend/.env.local (your email) to use town search.");
  return `Neighbor-HackOhio/0.1 (${contact})`;
}

// Wait so requests are at least 1.1 s apart (shared by every caller in this process)
async function nominatimSlot() {
  const now = Date.now();
  const at = Math.max(now, g.__nominatimNext ?? 0);
  g.__nominatimNext = at + 1100;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

// "settlement" still lets counties through (e.g. "Athens, OH" -> Athens County), so filter
const TOWN_TYPES = new Set(["city", "town", "village", "hamlet", "municipality", "borough"]);

export async function searchTowns(query: string): Promise<TownPick[]> {
  const q = query.trim().replace(/\s+/g, " ").slice(0, 100);
  const key = q.toLowerCase();
  if (q.length < 3) return [];
  const cached = searchCache.get(key);
  if (cached) return cached;

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    q,
    countrycodes: "us",
    featureType: "settlement",
    addressdetails: "1",
    format: "jsonv2",
    limit: "5",
  }).toString();

  const headers = { "User-Agent": userAgent() };
  await nominatimSlot();
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Town search failed (${res.status})`);
  const rows = (await res.json()) as {
    name: string;
    addresstype: string;
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }[];

  const picks: TownPick[] = [];
  for (const r of rows) {
    const state = r.address?.["ISO3166-2-lvl4"]?.replace("US-", "");
    if (!state || !r.name || !TOWN_TYPES.has(r.addresstype)) continue;
    if (picks.some((p) => p.name === r.name && p.state === state)) continue; // same town twice
    picks.push({
      name: r.name,
      state,
      county: r.address?.county ?? null,
      lat: Number(r.lat),
      lon: Number(r.lon),
    });
  }
  searchCache.set(key, picks);
  return picks;
}

// ---------- County FIPS (FCC Census API) ----------

async function countyFips(lat: number, lon: number): Promise<string | null> {
  try {
    const res = await fetch(`https://geo.fcc.gov/api/census/area?lat=${lat}&lon=${lon}&format=json`);
    const data = (await res.json()) as { results?: { county_fips?: string }[] };
    return data.results?.[0]?.county_fips ?? null;
  } catch {
    return null;
  }
}

// ---------- Overture download ----------

function runPython(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const py = spawn(process.env.PYTHON || "python", args, { windowsHide: true });
    let err = "";
    py.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    const timer = setTimeout(() => py.kill(), 5 * 60 * 1000);
    py.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(`Could not start Python: ${e.message}`));
    });
    py.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`overturemaps exited with ${code}: ${err.trim().split(/\r|\n/).pop()}`));
    });
  });
}

const exists = (p: string) => fs.access(p).then(() => true, () => false);

// Download one layer into <dir>/raw/<overture type>.geojson (skipped if already there)
async function downloadLayer(dir: string, layer: LayerName, bbox: Town["bbox"]) {
  const type = LAYERS[layer];
  const out = path.join(dir, "raw", `${type}.geojson`);
  if (await exists(out)) return out;
  const part = path.join(dir, "raw", `${type}.part.geojson`);
  await runPython(["-m", "overturemaps", "download", `--bbox=${bbox.join(",")}`, "-f", "geojson", `--type=${type}`, "-o", part]);
  await fs.rename(part, out);
  await fs.rm(`${part}.state`, { force: true });
  return out;
}

// ---------- Shrinking ----------
// Keep only the fields the map uses and round coordinates to 6 decimals (~10 cm).

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Overture properties, shape varies by layer
type Props = Record<string, any>;
type Feature = { geometry: { type: string; coordinates: unknown } | null; properties: Props | null };

function roundCoords(c: unknown): unknown {
  if (typeof c === "number") return Math.round(c * 1e6) / 1e6;
  return (c as unknown[]).map(roundCoords);
}

// Rough footprint size (degrees², good enough for sorting biggest first)
function roughArea(geom: Feature["geometry"]) {
  if (!geom) return 0;
  const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? (geom.coordinates as unknown[]) : [];
  let total = 0;
  for (const poly of polys as number[][][][]) {
    const ring = poly[0];
    let a = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
    total += Math.abs(a / 2);
  }
  return total;
}

const KEEP: Record<LayerName, (p: Props) => Props | null> = {
  buildings: (p) => ({ height: p.height, num_floors: p.num_floors }),
  landcover: (p) => {
    let c = p.cartography;
    if (typeof c === "string") {
      try { c = JSON.parse(c); } catch { c = null; }
    }
    if (c && c.max_zoom != null && c.max_zoom < 13) return null; // low-detail copy for zoomed-out maps
    return { subtype: p.subtype };
  },
  roads: (p) => ({ subtype: p.subtype, class: p.class }),
  water: (p) => ({ subtype: p.subtype, class: p.class }),
  places: (p) => ({
    name: p.names?.primary,
    basic_category: p.basic_category,
    taxonomy: p.taxonomy,
    confidence: p.confidence,
    operating_status: p.operating_status,
  }),
  infrastructure: (p) => ({ subtype: p.subtype, class: p.class, name: p.names?.primary }),
};

async function shrinkLayer(rawFile: string, outFile: string, layer: LayerName) {
  const data = JSON.parse(await fs.readFile(rawFile, "utf8")) as { features: Feature[] };
  let features = [];
  for (const f of data.features) {
    if (!f.geometry) continue;
    const props = KEEP[layer](f.properties || {});
    if (!props) continue;
    for (const k in props) if (props[k] == null) delete props[k];
    features.push({ type: "Feature", properties: props, geometry: { type: f.geometry.type, coordinates: roundCoords(f.geometry.coordinates) } });
  }
  // Biggest buildings first, so the map can draw the first N and skip tiny sheds
  if (layer === "buildings") {
    features = features
      .map((f) => ({ f, a: roughArea(f.geometry) }))
      .sort((x, y) => y.a - x.a)
      .map((x) => x.f);
  }
  await fs.writeFile(outFile, JSON.stringify({ type: "FeatureCollection", features }), "utf8");
}

// ---------- Cache ----------

export function townDir(slug: string) {
  return path.join(TOWNS_DIR, slug);
}

export async function readTown(slug: string): Promise<Town | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(townDir(slug), "town.json"), "utf8"));
  } catch {
    return null;
  }
}

// Every town that's fully downloaded, A-Z
export async function listTowns(): Promise<Town[]> {
  const names = await fs.readdir(TOWNS_DIR).catch(() => [] as string[]);
  const towns = await Promise.all(names.filter(isValidSlug).map(readTown));
  return towns.filter((t): t is Town => !!t).sort((a, b) => a.name.localeCompare(b.name));
}

export async function townStatus(slug: string): Promise<TownStatus> {
  const job = jobs.get(slug);
  if (job?.error) return { state: "error", error: job.error };
  if (job && !(await exists(path.join(townDir(slug), "town.json")))) {
    return { state: "loading", done: job.done, total: LAYER_NAMES.length };
  }
  const town = await readTown(slug);
  return town ? { state: "ready", town } : { state: "missing" };
}

// Which map to load: the town's default (center = town point, slug "athens-oh") or an area around
// another center (snapped to 0.001°, ~100 m, so the same spot reuses its cache: "athens-oh-39332n82071w").
function areaOf(pick: TownPick, center?: LatLon): { slug: string; center: LatLon } {
  const base = slugify(pick.name, pick.state);
  if (!center || distanceM(pick, center) < SAME_CENTER_M) return { slug: base, center: { lat: pick.lat, lon: pick.lon } };
  const lat = Math.round(center.lat * 1000);
  const lon = Math.round(center.lon * 1000);
  const tag = `${Math.abs(lat)}${lat < 0 ? "s" : "n"}${Math.abs(lon)}${lon < 0 ? "w" : "e"}`;
  return { slug: `${base}-${tag}`, center: { lat: lat / 1000, lon: lon / 1000 } };
}

// Start downloading a town or an area of it (or reuse the cache / a download already running). Returns its slug.
// town.json is written last, so a folder without it is an unfinished download that will resume.
export function loadTown(pick: TownPick, areaCenter?: LatLon): { slug: string; promise: Promise<Town> } {
  if (areaCenter && distanceM(pick, areaCenter) > MAX_AREA_OFFSET_M + 1000) {
    throw new Error(`That area is more than ${MAX_AREA_OFFSET_M / 1000} km from ${pick.name}.`);
  }
  const { slug, center } = areaOf(pick, areaCenter);
  const running = jobs.get(slug);
  if (running && !running.error) return { slug, promise: running.promise };

  const job: Job = { done: [], error: null, promise: null as unknown as Promise<Town> };
  job.promise = (async () => {
    const cached = await readTown(slug);
    if (cached) return cached;

    const dir = townDir(slug);
    await fs.mkdir(path.join(dir, "raw"), { recursive: true });
    const bbox = bboxAround(center.lat, center.lon);
    // County under the map center, so an area that crosses a county line sends the right county to the engine
    const fipsPromise = countyFips(center.lat, center.lon);

    await Promise.all(
      LAYER_NAMES.map(async (layer) => {
        const raw = await downloadLayer(dir, layer, bbox);
        await shrinkLayer(raw, path.join(dir, `${layer}.geojson`), layer);
        job.done.push(layer);
      })
    );

    const town: Town = {
      slug,
      name: pick.name,
      state: pick.state,
      county: pick.county,
      lat: center.lat,
      lon: center.lon,
      townLat: pick.lat,
      townLon: pick.lon,
      bbox,
      countyFips: await fipsPromise,
      createdAt: new Date().toISOString(),
    };
    await fs.writeFile(path.join(dir, "town.json"), JSON.stringify(town, null, 2), "utf8");
    return town;
  })();
  job.promise.catch((e: Error) => (job.error = e.message));
  jobs.set(slug, job);
  return { slug, promise: job.promise };
}

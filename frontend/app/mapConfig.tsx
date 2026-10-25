import * as THREE from "three";

// Center of the map. Set by setTown() before the map mounts (default: downtown Wilmington)
export let LAT0 = 39.43611;
export let LON0 = -83.81389;
const M_PER_DEG_LAT = 110540;
let M_PER_DEG_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
let dataUrl = (layer: string) => `/api/town/wilmington-oh/${layer}`;

// What the app needs to know about the current town (from /api/town/<slug>).
// lat/lon = map center; townLat/townLon = the town's own point (set when this is an off-center area).
export type TownInfo = {
  slug: string;
  name: string;
  state: string;
  county: string | null;
  countyFips: string | null;
  lat: number;
  lon: number;
  townLat?: number;
  townLon?: number;
};

// "4.2 km NE" from the town's point to this map's center, or "" if it's the town's own map
export function areaOffsetText(t: { lat: number; lon: number; townLat?: number; townLon?: number }) {
  if (t.townLat == null || t.townLon == null) return "";
  const east = (t.lon - t.townLon) * 111320 * Math.cos((t.townLat * Math.PI) / 180);
  const north = (t.lat - t.townLat) * M_PER_DEG_LAT;
  const d = Math.hypot(east, north);
  if (d < 250) return "";
  const dirs = ["E", "NE", "N", "NW", "W", "SW", "S", "SE"];
  const dir = dirs[Math.round(Math.atan2(north, east) / (Math.PI / 4) + 8) % 8];
  return `${(d / 1000).toFixed(1)} km ${dir}`;
}

// The 3D map's square around a center, as [south, west], [north, east] (same math as bboxAround in lib/towns.ts)
export function squareAround(lat: number, lon: number): [[number, number], [number, number]] {
  const dLat = MAP_HALF / M_PER_DEG_LAT;
  const dLon = MAP_HALF / (111320 * Math.cos((lat * Math.PI) / 180));
  return [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]];
}

// Switch the map to a town. Call before rendering the scene.
// fromPublic: read the old committed Wilmington files in public/ instead of the town cache.
export function setTown(town: TownInfo, fromPublic = false) {
  dataUrl = fromPublic ? (layer) => `/${layer}.geojson` : (layer) => `/api/town/${town.slug}/${layer}`;
  LAT0 = town.lat;
  LON0 = town.lon;
  M_PER_DEG_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);
}

// URL of one of the current town's data files (buildings, roads, ...)
export function layerUrl(layer: "buildings" | "landcover" | "roads" | "water" | "places" | "infrastructure") {
  return dataUrl(layer);
}

// Grid and map size
export const TILE = 285; // meters per tile (20 acres)
export const GRID = 50; // map is 50 x 50 tiles
export const MAP_SIZE = TILE * GRID; // about 14.25 km
export const MAP_HALF = MAP_SIZE / 2;

// Make heights taller than real so the town stands out (footprints stay real)
export const HEIGHT_SCALE = 3;

// Convert [longitude, latitude] to meters east (x) and north (y) of the center
export function toXY([lon, lat]: number[]) {
  return new THREE.Vector2(
    (lon - LON0) * M_PER_DEG_LON,
    (lat - LAT0) * M_PER_DEG_LAT
  );
}

// Map edges: anything past these gets trimmed off
export const CLIP = [
  new THREE.Plane(new THREE.Vector3(-1, 0, 0), MAP_HALF),
  new THREE.Plane(new THREE.Vector3(1, 0, 0), MAP_HALF),
  new THREE.Plane(new THREE.Vector3(0, 0, -1), MAP_HALF),
  new THREE.Plane(new THREE.Vector3(0, 0, 1), MAP_HALF),
];

// Which tile a 3D point (x, z) is in. Returns -1 if off the map.
export function tileOf(x: number, z: number) {
  const ix = Math.floor((x + MAP_HALF) / TILE);
  const iz = Math.floor((z + MAP_HALF) / TILE);
  if (ix < 0 || iz < 0 || ix >= GRID || iz >= GRID) return -1;
  return iz * GRID + ix;
}

// Convert scene meters (x east, z south) back to [latitude, longitude]
export function toLatLon(x: number, z: number): [number, number] {
  return [LAT0 + -z / M_PER_DEG_LAT, LON0 + x / M_PER_DEG_LON];
}

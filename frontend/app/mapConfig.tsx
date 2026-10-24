import * as THREE from "three";

// Center of the map (downtown Wilmington)
export const LAT0 = 39.43611;
export const LON0 = -83.81389;
const M_PER_DEG_LAT = 110540;
const M_PER_DEG_LON = 111320 * Math.cos((LAT0 * Math.PI) / 180);

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

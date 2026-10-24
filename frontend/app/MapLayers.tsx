"use client";
import { useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { night } from "./night";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CLIP, GRID, MAP_HALF, TILE, toXY } from "./mapConfig";

// Colors for each type of land
const LAND_COLORS: Record<string, string> = {
  crop: "#ddd09a",
  grass: "#a9d07a",
  forest: "#5f8f48",
  shrub: "#8db86a",
  wetland: "#7fb8a8",
  urban: "#ddd7cc",
  barren: "#d6c7a3",
};

// Each land type sits at its own height so they don't flicker
const LAND_Y: Record<string, number> = {
  crop: 0.3,
  barren: 0.6,
  grass: 0.9,
  shrub: 1.2,
  wetland: 1.5,
  forest: 1.8,
  urban: 2.1,
};

// Road widths in meters (slightly wider than real so they read from far away)
const ROAD_WIDTH: Record<string, number> = {
  motorway: 24,
  trunk: 20,
  primary: 16,
  secondary: 14,
  tertiary: 12,
  residential: 8,
  unclassified: 8,
  living_street: 6,
  service: 5,
};

// Turn any polygon type into a list of polygons (each is a list of rings)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function polygonsOf(g: any): number[][][][] {
  if (!g) return [];
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

// Build a flat shape, including holes (like a field with a pond in it)
function shapeFrom(rings: THREE.Vector2[][]) {
  const s = new THREE.Shape(rings[0]);
  for (const hole of rings.slice(1)) s.holes.push(new THREE.Path(hole));
  return s;
}

// Is a point inside a ring?
function inRing(px: number, py: number, ring: THREE.Vector2[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

// Mark every tile whose center is inside this polygon as "can't build here"
function markTiles(rings: THREE.Vector2[][], blocked: Uint8Array) {
  const outer = rings[0];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of outer) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  const ix0 = Math.max(0, Math.ceil((minX + MAP_HALF) / TILE - 0.5));
  const ix1 = Math.min(GRID - 1, Math.floor((maxX + MAP_HALF) / TILE - 0.5));
  const iz0 = Math.max(0, Math.ceil((-maxY + MAP_HALF) / TILE - 0.5));
  const iz1 = Math.min(GRID - 1, Math.floor((-minY + MAP_HALF) / TILE - 0.5));
  for (let iz = iz0; iz <= iz1; iz++) {
    for (let ix = ix0; ix <= ix1; ix++) {
      const cx = -MAP_HALF + (ix + 0.5) * TILE;
      const cy = MAP_HALF - (iz + 0.5) * TILE; // north is -z
      if (inRing(cx, cy, outer) && !rings.slice(1).some((h) => inRing(cx, cy, h))) {
        blocked[iz * GRID + ix] = 1;
      }
    }
  }
}

// Small random number generator with a fixed seed, so trees land in the same spots every load
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Scatter tree spots inside forest/shrub areas. Returns [x, z, size, x, z, size, ...]
function scatterTrees(areas: { rings: THREE.Vector2[][]; spacing: number }[]) {
  const rand = seeded(42);
  const out: number[] = [];
  for (const { rings, spacing } of areas) {
    const outer = rings[0];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of outer) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    minX = Math.max(minX, -MAP_HALF); maxX = Math.min(maxX, MAP_HALF);
    minY = Math.max(minY, -MAP_HALF); maxY = Math.min(maxY, MAP_HALF);
    for (let gx = minX; gx < maxX; gx += spacing) {
      for (let gy = minY; gy < maxY; gy += spacing) {
        const x = gx + (rand() - 0.5) * spacing * 0.9;
        const y = gy + (rand() - 0.5) * spacing * 0.9;
        if (!inRing(x, y, outer) || rings.slice(1).some((h) => inRing(x, y, h))) continue;
        out.push(x, -y, 0.75 + rand() * 0.6);
      }
    }
  }
  return new Float32Array(out);
}

// Turn lines (roads, creeks) into flat strips with a width
function ribbons(lines: { pts: THREE.Vector2[]; w: number }[]) {
  const out: number[] = [];
  for (const { pts, w } of lines) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      const nx = (-dy / len) * (w / 2);
      const ny = (dx / len) * (w / 2);
      out.push(
        a.x + nx, a.y + ny, 0, a.x - nx, a.y - ny, 0, b.x + nx, b.y + ny, 0,
        b.x + nx, b.y + ny, 0, a.x - nx, a.y - ny, 0, b.x - nx, b.y - ny, 0
      );
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(out, 3));
  geo.computeVertexNormals();
  return geo;
}

// Lay a shape flat on the ground
function flat(geo: THREE.BufferGeometry) {
  geo.rotateX(-Math.PI / 2);
  return geo;
}

type Layer = { geo: THREE.BufferGeometry; color: string; y: number; glow?: boolean };

export default function MapLayers({
  onLoaded,
  onTrees,
}: {
  onLoaded: (blocked: Uint8Array) => void;
  onTrees: (trees: Float32Array) => void;
}) {
  const [layers, setLayers] = useState<Layer[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/landcover.geojson").then((r) => r.json()),
      fetch("/water.geojson").then((r) => r.json()),
      fetch("/roads.geojson").then((r) => r.json()),
    ]).then(([land, water, roads]) => {
      const result: Layer[] = [];
      const blocked = new Uint8Array(GRID * GRID); // tiles where you can't build

      // ---- Land cover: one merged shape per land type ----
      const byType: Record<string, THREE.BufferGeometry[]> = {};
      const treeAreas: { rings: THREE.Vector2[][]; spacing: number }[] = [];
      for (const f of land.features) {
        const p = f.properties || {};
        // Skip the low-detail copies meant for zoomed-out maps
        let c = p.cartography;
        if (typeof c === "string") {
          try { c = JSON.parse(c); } catch { c = null; }
        }
        if (c && c.max_zoom != null && c.max_zoom < 13) continue;

        const type = p.subtype;
        if (!LAND_COLORS[type]) continue;
        for (const poly of polygonsOf(f.geometry)) {
          const rings = poly.map((r) => r.map(toXY));
          (byType[type] ||= []).push(new THREE.ShapeGeometry(shapeFrom(rings)));
          if (type === "urban") markTiles(rings, blocked);
          if (type === "forest") treeAreas.push({ rings, spacing: 70 });
          if (type === "shrub") treeAreas.push({ rings, spacing: 170 });
        }
      }
      for (const type in byType) {
        const merged = mergeGeometries(byType[type]);
        if (merged) result.push({ geo: flat(merged), color: LAND_COLORS[type], y: LAND_Y[type] });
      }

      // ---- Water: lakes/ponds as shapes, creeks/rivers as strips ----
      const waterShapes: THREE.BufferGeometry[] = [];
      const waterLines: { pts: THREE.Vector2[]; w: number }[] = [];
      for (const f of water.features) {
        const g = f.geometry;
        if (!g) continue;
        if (g.type === "LineString") {
          const sub = f.properties?.subtype;
          waterLines.push({ pts: g.coordinates.map(toXY), w: sub === "river" ? 15 : 6 });
        } else {
          for (const poly of polygonsOf(g)) {
            const rings = poly.map((r) => r.map(toXY));
            waterShapes.push(new THREE.ShapeGeometry(shapeFrom(rings)));
            markTiles(rings, blocked);
          }
        }
      }
      if (waterShapes.length) {
        const merged = mergeGeometries(waterShapes);
        if (merged) result.push({ geo: flat(merged), color: "#5aa9d6", y: 2.6 });
      }
      result.push({ geo: flat(ribbons(waterLines)), color: "#5aa9d6", y: 2.6 });

      // ---- Roads and railroads ----
      const roadLines: { pts: THREE.Vector2[]; w: number }[] = [];
      const railLines: { pts: THREE.Vector2[]; w: number }[] = [];
      for (const f of roads.features) {
        const g = f.geometry;
        if (!g || g.type !== "LineString") continue;
        const p = f.properties || {};
        const pts = g.coordinates.map(toXY);
        if (p.subtype === "rail") railLines.push({ pts, w: 4 });
        else if (p.subtype === "road" && ROAD_WIDTH[p.class]) {
          roadLines.push({ pts, w: ROAD_WIDTH[p.class] });
        }
      }
      result.push({ geo: flat(ribbons(roadLines)), color: "#85827c", y: 3.0, glow: true });
      result.push({ geo: flat(ribbons(railLines)), color: "#6d5a4b", y: 3.2 });

      setLayers(result);
      onLoaded(blocked);
      onTrees(scatterTrees(treeAreas));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One material per layer; roads get a warm streetlight glow at night
  const materials = useMemo(
    () =>
      layers.map(
        (l) =>
          new THREE.MeshLambertMaterial({
            color: l.color,
            side: THREE.DoubleSide,
            clippingPlanes: CLIP,
            emissive: l.glow ? "#ffb85c" : "#000000",
            emissiveIntensity: 0,
          })
      ),
    [layers]
  );
  useFrame(() => {
    layers.forEach((l, i) => {
      if (l.glow) materials[i].emissiveIntensity = night.t * 0.55;
    });
  });

  return (
    <>
      {layers.map((l, i) => (
        <mesh key={i} geometry={l.geo} material={materials[i]} position={[0, l.y, 0]} receiveShadow />
      ))}
    </>
  );
}

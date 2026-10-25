"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Badge, Label } from "./labels";
import { CLIP, HEIGHT_SCALE, MAP_HALF, layerUrl, toXY } from "./mapConfig";
import type { YearResult } from "./sim/types";

// Key places, picked from the town's places data (Overture).
// The data is noisy (clinics tagged "hospital", college departments tagged "college"),
// so some kinds also check the name. cats = Overture basic_category ([] = any category).
type Kind = "school" | "college" | "hospital" | "fire" | "police" | "cityhall" | "water";
const RULES: { kind: Kind; cats: string[]; name?: RegExp; notName?: RegExp }[] = [
  { kind: "school", cats: ["elementary_school", "middle_school", "high_school"], notName: /education service|board of education|district|\bpto\b|\bpta\b|booster/i },
  { kind: "hospital", cats: ["hospital"], name: /hospital|medical center|regional/i, notName: /physician|home health|primary care|clinic|associates|practice|animal|veterinar|\bpet\b/i },
  { kind: "fire", cats: ["fire_station"] },
  { kind: "police", cats: ["police_station"] },
  { kind: "cityhall", cats: ["city_hall", "town_hall"] },
  { kind: "cityhall", cats: ["government_office", "government_department"], name: /city hall|town hall|village hall|municipal building/i },
  { kind: "water", cats: ["water_utility_provider"], name: /water/i, notName: /billing|fountain/i },
  { kind: "water", cats: [], name: /water (treatment|plant|works|reclamation)|wastewater|water pollution control|sewage treatment/i },
];
// A college place that can name its pin on its own (not a department, program or building)
const COLLEGE_NAME = /college|university|campus/i;
const NOT_COLLEGE_NAME = /program|department|athletic|extension|heritage|\bhall\b|\bdr\.? /i;

// Pins of the same kind closer than "merge" meters become one (e.g. 70 Ohio University departments). At most "max" per kind.
const LIMITS: Record<Kind, { merge: number; max: number }> = {
  school: { merge: 150, max: 12 },
  college: { merge: 800, max: 4 },
  hospital: { merge: 500, max: 4 },
  fire: { merge: 300, max: 6 },
  police: { merge: 300, max: 4 },
  cityhall: { merge: 300, max: 2 },
  water: { merge: 300, max: 3 },
};

type Place = { kind: Kind; name: string; xz: [number, number] };
type Found = Place & { conf: number };

// "... College" / "... University" names that two or more places start with, most common first, e.g.
// "Wilmington College Equine Program" + "Wilmington College Athletic Training" -> "Wilmington College"
function sharedCollegeNames(names: string[]): string[] {
  const words = (n: string) => n.split(/\s+/).map((w) => w.replace(/[,.]+$/, ""));
  const counts = new Map<string, number>();
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = words(names[i]);
      const b = words(names[j]);
      let k = 0;
      while (k < a.length && k < b.length && a[k].toLowerCase() === b[k].toLowerCase()) k++;
      while (k > 0 && !/^(college|university|institute)$/i.test(a[k - 1])) k--;
      if (k < 2) continue; // "College" alone is not a name
      const p = a.slice(0, k).join(" ");
      counts.set(p, (counts.get(p) ?? 0) + 1);
    }
  }
  return [...counts.keys()].sort((a, b) => counts.get(b)! - counts.get(a)! || b.length - a.length);
}

// Campuses are often listed only as their departments. Each shared name gets one pin, placed on the
// member with the most college places around it (the main campus, not an outlying farm), and it absorbs
// unnamed departments nearby ("Center for Sport Sciences"). The rest use their own name if it looks like a college.
function mergeColleges(list: Found[]): Found[] {
  const { merge } = LIMITS.college;
  const near = (a: Found, b: Found) => Math.hypot(a.xz[0] - b.xz[0], a.xz[1] - b.xz[1]) < merge;
  const used = new Set<Found>();
  const out: Found[] = [];
  for (const shared of sharedCollegeNames(list.map((c) => c.name))) {
    const members = list.filter((c) => !used.has(c) && c.name.toLowerCase().includes(shared.toLowerCase()));
    if (!members.length) continue;
    const crowd = (c: Found) => list.filter((o) => near(o, c)).length;
    const pin = members.reduce((best, c) => (crowd(c) > crowd(best) || (crowd(c) === crowd(best) && c.conf > best.conf) ? c : best));
    for (const c of list) if (members.includes(c) || near(c, pin)) used.add(c);
    out.push({ ...pin, name: shared, conf: Math.max(...members.map((c) => c.conf)) });
  }
  for (const c of list) {
    if (!used.has(c) && COLLEGE_NAME.test(c.name) && !NOT_COLLEGE_NAME.test(c.name)) out.push(c);
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- GeoJSON features
function pickPlaces(features: any[]): Place[] {
  const found: Found[] = [];
  const colleges: Found[] = [];
  for (const f of features) {
    const p = f.properties || {};
    const g = f.geometry;
    if (!g || g.type !== "Point") continue;
    if (/closed/.test(p.operating_status || "") || (p.confidence ?? 1) < 0.5) continue;
    const name: string = p.name ?? p.names?.primary ?? ""; // public/ fallback file has the raw "names"
    const cat: string = p.basic_category ?? "";
    if (!name || /cemetery/i.test(name)) continue;
    const xz = scenePos(g.coordinates[0], g.coordinates[1]);
    if (Math.abs(xz[0]) > MAP_HALF || Math.abs(xz[1]) > MAP_HALF) continue;
    if (cat === "college_university") {
      colleges.push({ kind: "college", name, xz, conf: p.confidence ?? 0 });
      continue;
    }
    const rule = RULES.find((r) => (!r.cats.length || r.cats.includes(cat)) && (!r.name || r.name.test(name)) && !r.notName?.test(name));
    if (rule) found.push({ kind: rule.kind, name, xz, conf: p.confidence ?? 0 });
  }
  found.push(...mergeColleges(colleges));
  // Most confident first, then skip near-duplicates and extras
  found.sort((a, b) => b.conf - a.conf);
  const kept: Place[] = [];
  for (const c of found) {
    const { merge, max } = LIMITS[c.kind];
    const same = kept.filter((k) => k.kind === c.kind);
    if (same.length >= max) continue;
    if (same.some((k) => Math.hypot(k.xz[0] - c.xz[0], k.xz[1] - c.xz[1]) < merge)) continue;
    kept.push({ kind: c.kind, name: c.name, xz: c.xz });
  }
  return kept;
}

const ICON: Record<Kind | "tower" | "substation", string> = {
  school: "🏫",
  college: "🎓",
  hospital: "🏥",
  fire: "🚒",
  police: "🚓",
  cityhall: "🏛️",
  water: "💧",
  tower: "💧",
  substation: "⚡",
};

// Scene coordinates (x east, z south) for a lon/lat
function scenePos(lon: number, lat: number): [number, number] {
  const v = toXY([lon, lat]);
  return [v.x, -v.y];
}

// ---------- 3D pieces ----------
const towerMat = {
  tank: new THREE.MeshStandardMaterial({ color: "#e8f0f5", metalness: 0.2, roughness: 0.5 }),
  legs: new THREE.MeshStandardMaterial({ color: "#9aa8b3" }),
  pylon: new THREE.MeshStandardMaterial({ color: "#8a939b" }),
  sub: new THREE.MeshStandardMaterial({ color: "#7b848c" }),
  subPad: new THREE.MeshLambertMaterial({ color: "#b9bcbf", clippingPlanes: CLIP }),
};
const unitBox = new THREE.BoxGeometry(1, 1, 1);

function WaterTower({ x, z }: { x: number; z: number }) {
  const legH = 30 * (HEIGHT_SCALE / 2);
  const r = 11;
  return (
    <group position={[x, 0, z]}>
      {[0, 1, 2, 3].map((i) => {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
        return (
          <mesh key={i} position={[Math.cos(a) * r * 0.6, legH / 2, Math.sin(a) * r * 0.6]} castShadow material={towerMat.legs}>
            <cylinderGeometry args={[1.2, 1.6, legH, 6]} />
          </mesh>
        );
      })}
      <mesh position={[0, legH / 2, 0]} castShadow material={towerMat.legs}>
        <cylinderGeometry args={[2, 2, legH, 8]} />
      </mesh>
      <mesh position={[0, legH + r * 0.6, 0]} castShadow material={towerMat.tank} scale={[1, 0.8, 1]}>
        <sphereGeometry args={[r, 20, 14]} />
      </mesh>
    </group>
  );
}

function Pylons({ points }: { points: [number, number][] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const h = 32;
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    points.forEach(([x, z], i) => {
      o.position.set(x, h / 2, z);
      o.scale.set(3, h, 3);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [points]);
  if (!points.length) return null;
  return <instancedMesh ref={ref} args={[unitBox, towerMat.pylon, points.length]} castShadow />;
}

function Lines({ lines, y, color, dashed = false, width = 1 }: { lines: [number, number][][]; y: number; color: string; dashed?: boolean; width?: number }) {
  const obj = useMemo(() => {
    const group = new THREE.Group();
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 40, gapSize: 25, linewidth: width })
      : new THREE.LineBasicMaterial({ color, linewidth: width, clippingPlanes: CLIP });
    for (const l of lines) {
      const g = new THREE.BufferGeometry().setFromPoints(l.map(([x, z]) => new THREE.Vector3(x, y, z)));
      const line = new THREE.Line(g, mat);
      if (dashed) line.computeLineDistances();
      group.add(line);
    }
    return group;
  }, [lines, y, color, dashed, width]);
  return <primitive object={obj} />;
}

// Bold dashed orange strip on the ground (the new power line to the grid)
const dashMat = new THREE.MeshStandardMaterial({ color: "#ff9800", emissive: "#ff9800", emissiveIntensity: 0.4 });
function DashedStrip({ from, to }: { from: [number, number]; to: [number, number] }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dash = 45;
  const gap = 30;
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const count = Math.max(1, Math.floor(len / (dash + gap)));
  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const o = new THREE.Object3D();
    const ang = Math.atan2(to[1] - from[1], to[0] - from[0]);
    for (let i = 0; i < count; i++) {
      const t = ((i + 0.5) * (dash + gap)) / len;
      o.position.set(from[0] + (to[0] - from[0]) * t, 7, from[1] + (to[1] - from[1]) * t);
      o.rotation.set(0, -ang, 0);
      o.scale.set(dash, 3, 10);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.computeBoundingSphere();
  }, [from, to, count, len]);
  return <instancedMesh key={count} ref={ref} args={[unitBox, dashMat, count]} />;
}

// ---------- Main ----------
export default function Landmarks({
  site,
  r,
  onLabels,
  badges = true,
}: {
  onLabels: (labels: Label[]) => void;
  // where the data center is and how loud it is (null = nothing placed)
  site: { pos: [number, number]; half: number; noiseRadius: number } | null;
  r: YearResult | null;
  badges?: boolean; // number badges on pins ($/student, % of supply, loud zone); off in lessons
}) {
  const [infra, setInfra] = useState<{
    towers: [number, number][];
    subs: { c: [number, number]; ring: THREE.Vector2[] }[];
    powerLines: [number, number][][];
    pylons: [number, number][];
  } | null>(null);

  useEffect(() => {
    fetch(layerUrl("infrastructure"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        const inMap = ([x, z]: [number, number]) => Math.abs(x) < MAP_HALF && Math.abs(z) < MAP_HALF;
        const towers: [number, number][] = [];
        const subs: { c: [number, number]; ring: THREE.Vector2[] }[] = [];
        const powerLines: [number, number][][] = [];
        const pylons: [number, number][] = [];
        for (const f of data.features) {
          const p = f.properties || {};
          const g = f.geometry;
          if (!g) continue;
          if (p.class === "water_tower" && g.type === "Point") {
            const s = scenePos(g.coordinates[0], g.coordinates[1]);
            if (inMap(s)) towers.push(s);
          } else if (p.class === "substation" && g.type === "Polygon") {
            const ring: THREE.Vector2[] = g.coordinates[0].map(toXY);
            const cx = ring.reduce((a, v) => a + v.x, 0) / ring.length;
            const cy = ring.reduce((a, v) => a + v.y, 0) / ring.length;
            if (inMap([cx, -cy])) subs.push({ c: [cx, -cy], ring });
          } else if (p.class === "power_line" && g.type === "LineString") {
            powerLines.push(g.coordinates.map((c: number[]) => scenePos(c[0], c[1])));
          } else if (p.class === "power_tower" && g.type === "Point") {
            const s = scenePos(g.coordinates[0], g.coordinates[1]);
            if (inMap(s)) pylons.push(s);
          }
        }
        setInfra({ towers, subs, powerLines, pylons });
      });
  }, []);

  // Schools, hospital, fire, police, city hall, water plant
  const [places, setPlaces] = useState<Place[]>([]);
  useEffect(() => {
    fetch(layerUrl("places"))
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setPlaces(pickPlaces(data.features)))
      .catch(() => {});
  }, []);

  // Nearest substation to the data center = where it would hook into the grid
  const hookup = useMemo(() => {
    if (!site || !infra || !infra.subs.length) return null;
    let best = infra.subs[0];
    let bestD = Infinity;
    for (const s of infra.subs) {
      const d = Math.hypot(s.c[0] - site.pos[0], s.c[1] - site.pos[1]);
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    return { sub: best, km: Math.max(0, bestD - site.half) / 1000 };
  }, [site, infra]);

  const inLoudZone = (x: number, z: number) =>
    !!site && site.noiseRadius > site.half && Math.hypot(x - site.pos[0], z - site.pos[1]) < site.noiseRadius;

  function badgeFor(kind: Kind, x: number, z: number): Badge {
    if (!badges) return null;
    if (!site || !r || r.active_mw === 0) return null;
    if (inLoudZone(x, z)) return { text: `🔊 Loud zone`, tone: "bad" };
    if (kind === "school") {
      const v = r.fiscal.net_per_pupil_delta_usd.value;
      const k = Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.round(Math.abs(v)).toString();
      return { text: `${v < 0 ? "−" : "+"}$${k}/student`, tone: v < 0 ? "bad" : "good" };
    }
    if (kind === "water") {
      const pct = r.water.pct_of_system_capacity.value;
      return { text: `${pct.toFixed(1)}% of supply`, tone: pct > 15 ? "bad" : pct > 5 ? "warn" : "info" };
    }
    return null;
  }

  // Build the label list and hand it to the HTML layer
  useEffect(() => {
    const out: Label[] = places.map((p, i) => ({
      id: `p${i}`,
      x: p.xz[0],
      y: 70,
      z: p.xz[1],
      icon: ICON[p.kind],
      kind: p.kind,
      name: p.name,
      badge: badgeFor(p.kind, p.xz[0], p.xz[1]),
    }));
    infra?.towers.forEach(([x, z], i) =>
      out.push({ id: `t${i}`, x, y: 95, z, icon: ICON.tower, kind: "water_tower", name: "Water tower", badge: badges && inLoudZone(x, z) ? { text: "🔊 Loud zone", tone: "bad" } : null, small: true })
    );
    infra?.subs.forEach((s, i) =>
      out.push({
        id: `s${i}`,
        x: s.c[0],
        y: 45,
        z: s.c[1],
        icon: ICON.substation,
        kind: "substation",
        name: "Power substation",
        badge: badges && hookup && hookup.sub === s && site && r && r.active_mw > 0 ? { text: `New line: ${hookup.km.toFixed(1)} km`, tone: "warn" } : null,
        small: true,
      })
    );
    onLabels(out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, infra, site, r, hookup]);

  return (
    <group>
      {/* Power grid */}
      {infra && <Lines lines={infra.powerLines} y={30} color="#4a4f55" />}
      {infra && <Pylons points={infra.pylons} />}
      {infra?.subs.map((s, i) => (
        <group key={i}>
          <mesh position={[0, 3.4, 0]} rotation={[-Math.PI / 2, 0, 0]} material={towerMat.subPad}>
            <shapeGeometry args={[new THREE.Shape(s.ring)]} />
          </mesh>
          {[-8, 0, 8].map((dx) => (
            <mesh key={dx} geometry={unitBox} material={towerMat.sub} position={[s.c[0] + dx, 9, s.c[1]]} scale={[5, 12, 5]} castShadow />
          ))}
        </group>
      ))}

      {/* Water towers */}
      {infra?.towers.map(([x, z], i) => <WaterTower key={i} x={x} z={z} />)}

      {/* New power line from the data center to the grid */}
      {site && hookup && r && r.active_mw > 0 && <DashedStrip from={site.pos} to={hookup.sub.c} />}
    </group>
  );
}

"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Badge, Label } from "./labels";
import { CLIP, HEIGHT_SCALE, MAP_HALF, layerUrl, toXY } from "./mapConfig";
import type { YearResult } from "./sim/types";

// Key places in Wilmington (picked by hand from the Overture places data)
type Kind = "school" | "college" | "hospital" | "fire" | "cityhall" | "water";
const PLACES: { kind: Kind; name: string; lon: number; lat: number }[] = [
  { kind: "school", name: "Wilmington Middle & High School", lon: -83.8391, lat: 39.4492 },
  { kind: "school", name: "Roy E. Holmes Elementary", lon: -83.8485, lat: 39.4323 },
  { kind: "school", name: "J. Warren Killam Elementary", lon: -83.8268, lat: 39.4406 },
  { kind: "school", name: "East End Elementary", lon: -83.8153, lat: 39.4469 },
  { kind: "school", name: "Denver Place Elementary", lon: -83.823, lat: 39.4549 },
  { kind: "college", name: "Wilmington College", lon: -83.8194, lat: 39.4443 },
  { kind: "college", name: "Laurel Oaks Career Campus", lon: -83.7893, lat: 39.4279 },
  { kind: "college", name: "Southern State Community College", lon: -83.8194, lat: 39.4196 },
  { kind: "hospital", name: "Clinton Memorial Hospital", lon: -83.84, lat: 39.4441 },
  { kind: "fire", name: "Wilmington Fire Department", lon: -83.8279, lat: 39.4441 },
  { kind: "cityhall", name: "City Hall", lon: -83.8289, lat: 39.4463 },
  { kind: "water", name: "Wilmington Water Treatment", lon: -83.8088, lat: 39.4549 },
];

const ICON: Record<Kind | "tower" | "substation", string> = {
  school: "🏫",
  college: "🎓",
  hospital: "🏥",
  fire: "🚒",
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
}: {
  onLabels: (labels: Label[]) => void;
  // where the data center is and how loud it is (null = nothing placed)
  site: { pos: [number, number]; half: number; noiseRadius: number } | null;
  r: YearResult | null;
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

  const places = useMemo(() => PLACES.map((p) => ({ ...p, xz: scenePos(p.lon, p.lat) })), []);

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
      name: p.name,
      badge: badgeFor(p.kind, p.xz[0], p.xz[1]),
    }));
    infra?.towers.forEach(([x, z], i) =>
      out.push({ id: `t${i}`, x, y: 95, z, icon: ICON.tower, name: "Water tower", badge: inLoudZone(x, z) ? { text: "🔊 Loud zone", tone: "bad" } : null, small: true })
    );
    infra?.subs.forEach((s, i) =>
      out.push({
        id: `s${i}`,
        x: s.c[0],
        y: 45,
        z: s.c[1],
        icon: ICON.substation,
        name: "Power substation",
        badge: hookup && hookup.sub === s && site && r && r.active_mw > 0 ? { text: `New line: ${hookup.km.toFixed(1)} km`, tone: "warn" } : null,
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

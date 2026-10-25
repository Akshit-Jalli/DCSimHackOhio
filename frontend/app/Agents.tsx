"use client";
// The town's residents, walking its real streets. One InstancedMesh of blocky
// figures (scaled up like the buildings so they read from the overview), a
// second invisible one with fat hit spheres so they are clickable. Walkers
// random-walk the road graph and hug the right-hand shoulder. At night most
// of them go home; night-shift workers stay out.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { night } from "./night";
import { setLabelPos } from "./labels";
import { buildGraph, nearestSeg, nextSeg, type RoadLine } from "./roads";
import type { Person } from "./sim/population";

export const RESIDENT_LABEL_ID = "resident";
const FIGURE_SCALE = 3.4; // a 2.7 m figure becomes ~9 m, a bit more than the x3 building heights so they read from above
const SPEED = 9; // scene m/s: brisk, so walking is visible from 2 km up
const HIT_R = 12; // meters: generous click target
const TMP = new THREE.Object3D(); // scratch transform for writing instance matrices

function figureGeometry() {
  const body = new THREE.BoxGeometry(1.5, 2.2, 0.9);
  body.translate(0, 1.1, 0);
  const head = new THREE.BoxGeometry(1.1, 1.0, 1.0);
  head.translate(0, 2.75, 0);
  const g = mergeGeometries([body, head]);
  return g ?? body;
}

export default function Agents({
  roads,
  people,
  selectedId,
  onPick,
  onPositions,
}: {
  roads: RoadLine[];
  people: Person[];
  selectedId: number | null;
  onPick: (id: number | null) => void;
  onPositions?: (live: Float32Array) => void; // called once with the live [x, z] per walker array (updated every frame)
}) {
  const n = people.length;
  const graph = useMemo(() => buildGraph(roads), [roads]);
  const geometry = useMemo(() => figureGeometry(), []);
  const material = useMemo(() => new THREE.MeshLambertMaterial({ flatShading: true }), []);
  const hitGeo = useMemo(() => new THREE.SphereGeometry(HIT_R, 6, 4), []);
  const hitMat = useMemo(() => new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), []);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const hits = useRef<THREE.InstancedMesh>(null);

  // Per-walker state lives in typed arrays; React never sees it.
  const st = useRef<{ seg: Int32Array; t: Float32Array; dir: Int8Array; speed: Float32Array; vis: Float32Array; rnd: Float32Array; pos: Float32Array } | null>(null);
  useEffect(() => {
    if (graph.segs.length === 0 || n === 0) {
      st.current = null;
      return;
    }
    const seg = new Int32Array(n);
    const t = new Float32Array(n);
    const dir = new Int8Array(n);
    const speed = new Float32Array(n);
    const vis = new Float32Array(n);
    const rnd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const p = people[i];
      seg[i] = nearestSeg(graph, p.home[0], p.home[1]);
      t[i] = p.ticket; // spread them along their first street
      dir[i] = p.ticket < 0.5 ? 1 : -1;
      speed[i] = SPEED * (0.8 + 0.4 * ((p.id * 7919) % 100) / 100);
      vis[i] = 1;
      rnd[i] = (p.ticket * 9301 + 49297) % 1; // separate stream for turns
    }
    const pos = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) {
      const sg = graph.segs[seg[i]];
      pos[i * 2] = sg.ax + (sg.bx - sg.ax) * t[i];
      pos[i * 2 + 1] = sg.az + (sg.bz - sg.az) * t[i];
    }
    st.current = { seg, t, dir, speed, vis, rnd, pos };
    onPositions?.(pos);
    // colors once
    const m = mesh.current;
    if (m) {
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        c.set(people[i].color);
        m.setColorAt(i, c);
      }
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }, [graph, people, n, onPositions]);

  useFrame((state, dt) => {
    const s = st.current;
    const m = mesh.current;
    const h = hits.current;
    if (!s || !m || !h) return;
    const step = Math.min(dt, 0.05);
    const time = state.clock.elapsedTime;
    const nightT = night.t;
    for (let i = 0; i < n; i++) {
      const p = people[i];
      let si = s.seg[i];
      let seg = graph.segs[si];
      const sel = selectedId === i;
      // advance along the segment (a selected resident stops to talk)
      if (!sel) s.t[i] += (s.dir[i] * s.speed[i] * step) / Math.max(1, seg.len);
      if (s.t[i] >= 1 || s.t[i] <= 0) {
        const node = s.t[i] >= 1 ? seg.b : seg.a;
        s.rnd[i] = (s.rnd[i] * 9301 + 49297) % 233280 / 233280;
        const ni = nextSeg(graph, node, si, s.rnd[i]);
        const nseg = graph.segs[ni];
        if (ni === si) {
          s.dir[i] = -s.dir[i]; // dead end: turn around
          s.t[i] = s.t[i] >= 1 ? 1 : 0;
        } else {
          s.dir[i] = nseg.a === node ? 1 : -1;
          s.t[i] = s.dir[i] === 1 ? 0 : 1;
          s.seg[i] = ni;
          si = ni;
          seg = nseg;
        }
      }
      const tt = s.t[i];
      const x = seg.ax + (seg.bx - seg.ax) * tt;
      const z = seg.az + (seg.bz - seg.az) * tt;
      // walk on the right-hand shoulder of the direction of travel
      const dx = (seg.bx - seg.ax) * s.dir[i];
      const dz = (seg.bz - seg.az) * s.dir[i];
      const L = Math.max(1, Math.hypot(dx, dz));
      const off = seg.w / 2 + 3;
      const ox = (-dz / L) * off;
      const oz = (dx / L) * off;
      // who is out: by day everyone; at night a third, plus night-shift workers
      const outAtNight = p.worksNights || i % 3 === 0;
      const target = nightT > 0.5 && !outAtNight ? 0 : 1;
      s.vis[i] += (target - s.vis[i]) * Math.min(1, step * 2);
      const scale = FIGURE_SCALE * Math.max(s.vis[i], sel ? 1 : 0) * (sel ? 1.4 : 1);
      s.pos[i * 2] = x + ox;
      s.pos[i * 2 + 1] = z + oz;
      const bob = Math.sin(time * 9 + i) * 0.25;
      TMP.position.set(x + ox, 3.2 + bob, z + oz);
      TMP.rotation.set(0, Math.atan2(dx, dz), 0);
      TMP.scale.setScalar(scale);
      TMP.updateMatrix();
      m.setMatrixAt(i, TMP.matrix);
      // hit sphere: fixed size, hidden with the walker
      TMP.scale.setScalar(s.vis[i] > 0.3 ? 1 : 0);
      TMP.position.y = 3.2 + 4;
      TMP.updateMatrix();
      h.setMatrixAt(i, TMP.matrix);
      if (sel) setLabelPos(RESIDENT_LABEL_ID, x + ox, 3.2 + 3.2 * scale + 4, z + oz);
    }
    m.instanceMatrix.needsUpdate = true;
    h.instanceMatrix.needsUpdate = true;
  });

  const pick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) onPick(e.instanceId);
  };

  if (n === 0 || graph.segs.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={mesh} args={[geometry, material, n]} castShadow frustumCulled={false} />
      <instancedMesh
        ref={hits}
        args={[hitGeo, hitMat, n]}
        frustumCulled={false}
        onClick={pick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "";
        }}
      />
    </group>
  );
}

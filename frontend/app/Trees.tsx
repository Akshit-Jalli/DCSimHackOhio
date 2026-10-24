"use client";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

// Low-poly trees for forest areas, drawn as one batch so thousands stay fast
const GREENS = ["#4f8a3c", "#5c9a45", "#3f7a34", "#6aa64f", "#477f3a", "#73ad55"];
const BASE_R = 15; // canopy radius in meters before random size

export default function Trees({
  points,
  lot,
}: {
  points: Float32Array; // [x, z, size, ...]
  lot: { center: [number, number]; half: number } | null; // trees here get cleared
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = points.length / 3;

  const geometry = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 0);
    g.scale(1, 1.35, 1);
    return g;
  }, []);
  const material = useMemo(() => new THREE.MeshLambertMaterial({ flatShading: true }), []);

  // Colors only need setting once
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      c.set(GREENS[i % GREENS.length]);
      mesh.setColorAt(i, c);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [count]);

  // Positions: redo when the data center moves, so trees under it disappear
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const tmp = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const x = points[i * 3];
      const z = points[i * 3 + 1];
      const r = BASE_R * points[i * 3 + 2];
      const cleared =
        lot && Math.abs(x - lot.center[0]) < lot.half + r && Math.abs(z - lot.center[1]) < lot.half + r;
      tmp.position.set(x, r * 1.35 + 2, z);
      tmp.rotation.set(0, (i * 1.7) % Math.PI, 0);
      tmp.scale.setScalar(cleared ? 0 : r);
      tmp.updateMatrix();
      mesh.setMatrixAt(i, tmp.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [points, count, lot]);

  if (count === 0) return null;
  return <instancedMesh ref={ref} args={[geometry, material, count]} castShadow receiveShadow />;
}

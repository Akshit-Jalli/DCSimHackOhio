"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { HEIGHT_SCALE, TILE } from "./mapConfig";
import { night } from "./night";

// One data hall slot (building + its concrete pad), meters
const HALL_W = 220;
const HALL_D = 120;
const MW_PER_HALL = 62.5;
const LOT_Y = 3.8;

// The building inside each slot
const BLD_W = 180;
const BLD_D = 88;
const BLD_H = 15 * HEIGHT_SCALE;
const PAD_H = 1.5;

// Roof fans: 3 rows x 6
const FAN_ROWS = 3;
const FAN_COLS = 6;
const FAN_R = 8;

// Shared shapes and colors so every hall reuses the same ones (keeps it fast)
const geo = {
  box: new THREE.BoxGeometry(1, 1, 1),
  fanHousing: new THREE.CylinderGeometry(FAN_R, FAN_R, 3, 20),
  fanHole: new THREE.CylinderGeometry(FAN_R * 0.8, FAN_R * 0.8, 0.6, 20),
  blade: new THREE.BoxGeometry(FAN_R * 1.5, 0.4, 2.2),
  trunk: new THREE.CylinderGeometry(1.2, 1.6, 8, 6),
  leaves: new THREE.IcosahedronGeometry(7, 0),
  beacon: new THREE.SphereGeometry(2.2, 10, 8),
  ring: new THREE.RingGeometry(0.85, 1, 64),
};
const mat = {
  pad: new THREE.MeshStandardMaterial({ color: "#e4e1da" }),
  wall: new THREE.MeshStandardMaterial({ color: "#f4f2ee" }),
  roof: new THREE.MeshStandardMaterial({ color: "#fbfaf8" }),
  glass: new THREE.MeshStandardMaterial({
    color: "#1b2c52",
    emissive: "#2f5fb3",
    emissiveIntensity: 0.35,
    roughness: 0.2,
    metalness: 0.3,
  }),
  frame: new THREE.MeshStandardMaterial({ color: "#8b9096" }),
  fanHousing: new THREE.MeshStandardMaterial({ color: "#a3a8ad", metalness: 0.4, roughness: 0.5 }),
  fanHole: new THREE.MeshStandardMaterial({ color: "#3d4247" }),
  blade: new THREE.MeshStandardMaterial({ color: "#c9cdd1" }),
  trunk: new THREE.MeshStandardMaterial({ color: "#7a5a3a" }),
  leaves: new THREE.MeshStandardMaterial({ color: "#6fa54a", flatShading: true }),
  fence: new THREE.MeshStandardMaterial({ color: "#f5f5f5" }),
  // Red warning lights on the roof (blink at night)
  beacon: new THREE.MeshStandardMaterial({ color: "#7a1010", emissive: "#ff2a2a", emissiveIntensity: 0.2 }),
  // Construction
  dirt: new THREE.MeshStandardMaterial({ color: "#b89f7a" }),
  steel: new THREE.MeshStandardMaterial({ color: "#8d99a6", metalness: 0.5, roughness: 0.5 }),
  crane: new THREE.MeshStandardMaterial({ color: "#f9b417" }),
  weight: new THREE.MeshStandardMaterial({ color: "#5d6670" }),
  dust: new THREE.MeshBasicMaterial({ color: "#d8c8a8", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
};

// Grows its children up from the ground with a little overshoot, like a game building appearing
function PopIn({ delay = 0, children }: { delay?: number; children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  const t = useRef(-delay);
  useFrame((_, dt) => {
    if (!ref.current || t.current >= 1) return;
    t.current = Math.min(1, t.current + dt / 0.55);
    const x = Math.max(0, t.current);
    const c1 = 1.7;
    const k = 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); // ease out back
    ref.current.scale.set(1, Math.max(0.001, k), 1);
  });
  return (
    <group ref={ref} scale={[1, 0.001, 1]}>
      {children}
    </group>
  );
}

// A box placed by center and size
function Block({
  p,
  s,
  m,
  shadow = true,
}: {
  p: [number, number, number];
  s: [number, number, number];
  m: THREE.Material;
  shadow?: boolean;
}) {
  return <mesh geometry={geo.box} material={m} position={p} scale={s} castShadow={shadow} receiveShadow />;
}

// Fan positions on the roof
const FAN_SPOTS: [number, number][] = (() => {
  const out: [number, number][] = [];
  for (let r = 0; r < FAN_ROWS; r++) {
    for (let c = 0; c < FAN_COLS; c++) {
      out.push([
        (c - (FAN_COLS - 1) / 2) * ((BLD_W - 40) / (FAN_COLS - 1)),
        (r - (FAN_ROWS - 1) / 2) * ((BLD_D - 34) / (FAN_ROWS - 1)),
      ]);
    }
  }
  return out;
})();

// Roof fans: housings are still, blades spin
function RoofFans({ y, speed }: { y: number; speed: number }) {
  const housings = useRef<THREE.InstancedMesh>(null);
  const holes = useRef<THREE.InstancedMesh>(null);
  const blades = useRef<THREE.InstancedMesh>(null);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const angle = useRef(Math.random() * Math.PI);

  useLayoutEffect(() => {
    FAN_SPOTS.forEach(([x, z], i) => {
      tmp.rotation.set(0, 0, 0);
      tmp.position.set(x, y + 1.5, z);
      tmp.updateMatrix();
      housings.current?.setMatrixAt(i, tmp.matrix);
      tmp.position.set(x, y + 3.1, z);
      tmp.updateMatrix();
      holes.current?.setMatrixAt(i, tmp.matrix);
    });
    if (housings.current) housings.current.instanceMatrix.needsUpdate = true;
    if (holes.current) holes.current.instanceMatrix.needsUpdate = true;
  }, [tmp, y]);

  useFrame((_, dt) => {
    if (!blades.current) return;
    angle.current += dt * speed;
    FAN_SPOTS.forEach(([x, z], i) => {
      // two blades per fan, crossed
      for (let k = 0; k < 2; k++) {
        tmp.position.set(x, y + 3.6, z);
        tmp.rotation.set(0, angle.current + (k * Math.PI) / 2, 0);
        tmp.updateMatrix();
        blades.current!.setMatrixAt(i * 2 + k, tmp.matrix);
      }
    });
    blades.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={housings} args={[geo.fanHousing, mat.fanHousing, FAN_SPOTS.length]} castShadow />
      <instancedMesh ref={holes} args={[geo.fanHole, mat.fanHole, FAN_SPOTS.length]} />
      <instancedMesh ref={blades} args={[geo.blade, mat.blade, FAN_SPOTS.length * 2]} />
    </>
  );
}

function Tree({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, LOT_Y + PAD_H, z]}>
      <mesh geometry={geo.trunk} material={mat.trunk} position={[0, 4, 0]} castShadow />
      <mesh geometry={geo.leaves} material={mat.leaves} position={[0, 12, 0]} castShadow />
    </group>
  );
}

// One data hall: concrete pad, white building, blue window band, roof fans, trees
function Hall({ fanSpeed }: { fanSpeed: number }) {
  const base = LOT_Y + PAD_H;
  const winY = base + BLD_H * 0.32;
  const winH = BLD_H * 0.3;
  const mullions = 7;

  return (
    <group>
      {/* Pad */}
      <Block p={[0, LOT_Y + PAD_H / 2, 0]} s={[HALL_W, PAD_H, HALL_D]} m={mat.pad} shadow={false} />

      {/* Building and roof */}
      <Block p={[0, base + BLD_H / 2, 0]} s={[BLD_W, BLD_H, BLD_D]} m={mat.wall} />
      <Block p={[0, base + BLD_H + 0.75, 0]} s={[BLD_W + 2, 1.5, BLD_D + 2]} m={mat.roof} />

      {/* Window band on the long sides, with frames */}
      {[1, -1].map((side) => (
        <group key={side} position={[0, 0, (side * BLD_D) / 2]}>
          <Block p={[0, winY, side * 0.6]} s={[BLD_W - 16, winH, 1]} m={mat.glass} shadow={false} />
          {Array.from({ length: mullions }).map((_, i) => (
            <Block
              key={i}
              p={[(i - (mullions - 1) / 2) * ((BLD_W - 16) / (mullions - 1)), winY, side * 1.1]}
              s={[3, winH + 2, 1]}
              m={mat.frame}
              shadow={false}
            />
          ))}
        </group>
      ))}

      {/* Window band on the short sides */}
      {[1, -1].map((side) => (
        <Block key={side} p={[(side * BLD_W) / 2 + side * 0.6, winY, 0]} s={[1, winH, BLD_D - 20]} m={mat.glass} shadow={false} />
      ))}

      <RoofFans y={base + BLD_H + 1.5} speed={fanSpeed} />

      {/* Warning lights on two roof corners */}
      <mesh geometry={geo.beacon} material={mat.beacon} position={[-BLD_W / 2 + 4, base + BLD_H + 4, -BLD_D / 2 + 4]} />
      <mesh geometry={geo.beacon} material={mat.beacon} position={[BLD_W / 2 - 4, base + BLD_H + 4, BLD_D / 2 - 4]} />

      <Tree x={-HALL_W / 2 + 10} z={HALL_D / 2 - 12} />
      <Tree x={HALL_W / 2 - 10} z={-HALL_D / 2 + 12} />
    </group>
  );
}

// A hall that's still being built: dirt pad, steel frame, half a wall, and a tower crane
function ConstructionSite({ seed }: { seed: number }) {
  const jib = useRef<THREE.Group>(null);
  const base = LOT_Y + PAD_H;
  const frameH = BLD_H * 0.75;
  const cols = 6;
  const rows = 3;
  const mastH = BLD_H * 2.6;
  useFrame((state) => {
    if (jib.current) jib.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.25 + seed) * 1.2;
  });
  return (
    <group>
      <Block p={[0, LOT_Y + PAD_H / 2, 0]} s={[HALL_W, PAD_H, HALL_D]} m={mat.dirt} shadow={false} />
      {/* Floor slab */}
      <Block p={[0, base + 1, 0]} s={[BLD_W, 2, BLD_D]} m={mat.pad} shadow={false} />
      {/* Columns */}
      {Array.from({ length: cols * rows }).map((_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = (c / (cols - 1) - 0.5) * BLD_W;
        const z = (r / (rows - 1) - 0.5) * BLD_D;
        return <Block key={i} p={[x, base + frameH / 2, z]} s={[3, frameH, 3]} m={mat.steel} />;
      })}
      {/* Top beams */}
      {[-1, 0, 1].map((r) => (
        <Block key={r} p={[0, base + frameH, (r * BLD_D) / 2]} s={[BLD_W, 3, 3]} m={mat.steel} />
      ))}
      {[-1, 1].map((c) => (
        <Block key={c} p={[(c * BLD_W) / 2, base + frameH, 0]} s={[3, 3, BLD_D]} m={mat.steel} />
      ))}
      {/* One wall going up */}
      <Block p={[-BLD_W / 4, base + frameH * 0.3, BLD_D / 2]} s={[BLD_W / 2, frameH * 0.6, 2]} m={mat.wall} />
      {/* Tower crane */}
      <group position={[BLD_W / 2 + 14, base, -BLD_D / 2 + 6]}>
        <Block p={[0, mastH / 2, 0]} s={[5, mastH, 5]} m={mat.crane} />
        <group ref={jib} position={[0, mastH, 0]}>
          <Block p={[-55, 2, 0]} s={[120, 4, 4]} m={mat.crane} />
          <Block p={[22, 2, 0]} s={[34, 4, 4]} m={mat.crane} />
          <Block p={[34, -3, 0]} s={[10, 8, 8]} m={mat.weight} />
          <Block p={[0, 7, 0]} s={[6, 10, 6]} m={mat.crane} />
          {/* Hook cable */}
          <Block p={[-95, -mastH * 0.3, 0]} s={[0.8, mastH * 0.6, 0.8]} m={mat.weight} shadow={false} />
        </group>
      </group>
    </group>
  );
}

// Lay out hall slots in rows inside the lot, as many as fit
function hallSpots(size: number) {
  const gapX = 50;
  const gapZ = 40;
  const cols = Math.max(1, Math.floor((size - 60) / (HALL_W + gapX)));
  const rows = Math.max(1, Math.floor((size - 60) / (HALL_D + gapZ)));
  const spots: [number, number][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      spots.push([
        (c - (cols - 1) / 2) * (HALL_W + gapX),
        (r - (rows - 1) / 2) * (HALL_D + gapZ),
      ]);
    }
  }
  // Fill from the middle outward so a small build-out sits in the center
  return spots.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));
}

function Fence({ size }: { size: number }) {
  const h = 8;
  const t = 6;
  const half = size / 2;
  const sides: [number, number, number, number][] = [
    [0, -half, size, t],
    [0, half, size, t],
    [-half, 0, t, size],
    [half, 0, t, size],
  ];
  return (
    <>
      {sides.map(([x, z, w, d], i) => (
        <Block key={i} p={[x, LOT_Y + h / 2, z]} s={[w, h, d]} m={mat.fence} />
      ))}
    </>
  );
}

export default function DataCenter({
  pos,
  tiles,
  activeMW,
  plannedMW,
  dragging,
  valid,
  noiseRadius,
  onGrab,
}: {
  pos: [number, number];
  tiles: number;
  activeMW: number;
  plannedMW: number; // includes the phase under construction this year
  dragging: boolean;
  valid: boolean;
  noiseRadius: number; // from the lot center
  onGrab: (e: ThreeEvent<PointerEvent>) => void;
}) {
  const size = tiles * TILE;
  const spots = useMemo(() => hallSpots(size), [size]);
  const halls = activeMW > 0 ? Math.min(spots.length, Math.ceil(activeMW / MW_PER_HALL)) : 0;
  const planned = Math.max(halls, Math.min(spots.length, Math.ceil(plannedMW / MW_PER_HALL)));

  // Drop-and-bounce plus a dust ring when you let go
  const bounce = useRef<THREE.Group>(null);
  const dust = useRef<THREE.Mesh>(null);
  const dropT = useRef(1);
  const wasDragging = useRef(dragging);
  useEffect(() => {
    if (wasDragging.current && !dragging) dropT.current = 0;
    wasDragging.current = dragging;
  }, [dragging]);

  // Blue glow over the site at night
  const glow = useRef<THREE.PointLight>(null);

  useFrame((state, dt) => {
    // Night: windows glow, warning lights blink
    const n = night.t;
    mat.glass.emissiveIntensity = 0.35 + n * 2.4;
    const blink = Math.sin(state.clock.elapsedTime * 3) > 0.55 ? 1 : 0;
    mat.beacon.emissiveIntensity = 0.2 + n * (blink ? 4 : 0.3);
    if (glow.current) glow.current.intensity = n * 2.2;

    // Drop animation
    if (dropT.current < 1) {
      dropT.current = Math.min(1, dropT.current + dt / 0.7);
      const t = dropT.current;
      // ease out bounce
      const b = (x: number) => {
        const n1 = 7.5625, d1 = 2.75;
        if (x < 1 / d1) return n1 * x * x;
        if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
        if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
        return n1 * (x -= 2.625 / d1) * x + 0.984375;
      };
      if (bounce.current) bounce.current.position.y = (1 - b(t)) * 70;
      if (dust.current) {
        const k = Math.max(0, (t - 0.3) / 0.7);
        dust.current.scale.setScalar((size / 2) * (1 + k * 0.6));
        mat.dust.opacity = k > 0 ? 0.55 * (1 - k) : 0;
      }
    }
  });

  return (
    <group position={[pos[0], 0, pos[1]]}>
      <pointLight ref={glow} position={[0, 220, 0]} color="#4aa3ff" distance={size * 2.4} decay={0} intensity={0} />
      <mesh ref={dust} geometry={geo.ring} material={mat.dust} rotation={[-Math.PI / 2, 0, 0]} position={[0, 6, 0]} />
      <group ref={bounce}>
      {/* The draggable part: lot, fence, halls */}
      <group
        onPointerDown={onGrab}
        onPointerOver={() => (document.body.style.cursor = "grab")}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <mesh position={[0, LOT_Y, 0]} receiveShadow>
          <boxGeometry args={[size, 0.6, size]} />
          <meshStandardMaterial color="#b5cf7a" />
        </mesh>
        <Fence size={size} />
        {spots.slice(0, planned).map(([x, z], i) => (
          <group key={(i < halls ? "h" : "c") + i} position={[x, 0, z]}>
            {i < halls ? (
              <PopIn delay={(i % 8) * 0.06}>
                <Hall fanSpeed={dragging ? 0 : 6} />
              </PopIn>
            ) : (
              <PopIn>
                <ConstructionSite seed={i} />
              </PopIn>
            )}
          </group>
        ))}
      </group>
      </group>

      {/* Green/red placement preview while dragging */}
      {dragging && (
        <mesh position={[0, LOT_Y + 0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[size, size]} />
          <meshBasicMaterial color={valid ? "#43a047" : "#e53935"} transparent opacity={0.5} />
        </mesh>
      )}

      {/* Loud zone (55 dBA and up) */}
      {!dragging && noiseRadius > size / 2 && (
        <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 4.2, 0]}>
          <mesh>
            <circleGeometry args={[noiseRadius, 128]} />
            <meshBasicMaterial color="#e53935" transparent opacity={0.1} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0.1]}>
            <ringGeometry args={[noiseRadius - 12, noiseRadius, 128]} />
            <meshBasicMaterial color="#e53935" transparent opacity={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  );
}

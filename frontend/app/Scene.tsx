"use client";
import { useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";

const TILE = 285; // meters per tile (20 acres)
const DC_SIZE = TILE * 4; // data center is 4 x 4 tiles
const MAP_W = TILE * 50; // map width in meters (east-west)
const MAP_H = TILE * 50; // map height in meters (north-south)

// Snap a position to the nearest grid line and keep the data center on the map
function snap(v: number, half: number) {
  const maxI = Math.floor((half - DC_SIZE / 2) / TILE);
  const i = Math.max(-maxI, Math.min(maxI, Math.round(v / TILE)));
  return i * TILE;
}

export default function Scene() {
  const [pos, setPos] = useState<[number, number]>([0, 0]);
  const [dragging, setDragging] = useState(false);

  function onGroundMove(e: ThreeEvent<PointerEvent>) {
    if (!dragging) return;
    setPos([snap(e.point.x, MAP_W / 2), snap(e.point.z, MAP_H / 2)]);
  }

  return (
    <div
      style={{ width: "100vw", height: "100vh" }}
      onPointerUp={() => setDragging(false)}
    >
      <Canvas camera={{ position: [3000, 3000, 3000], far: 50000 }}>
        {/* Sky color and fog at the edges */}
        <color attach="background" args={["#bfe3ff"]} />
        <fog attach="fog" args={["#bfe3ff", 8000, 20000]} />

        <ambientLight intensity={0.5} />
        <directionalLight position={[5000, 8000, 3000]} intensity={1.2} />

        {/* Ground */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerMove={onGroundMove}>
          <planeGeometry args={[MAP_W, MAP_H]} />
          <meshStandardMaterial color="#7cb342" />
        </mesh>

        {/* Tile grid */}
        <gridHelper args={[TILE * 50, 50]} position={[0, 1, 0]} />

        {/* Data center (drag me) */}
        <mesh
          position={[pos[0], 10, pos[1]]}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDragging(true);
          }}
        >
          <boxGeometry args={[DC_SIZE, 20, DC_SIZE]} />
          <meshStandardMaterial color={dragging ? "#ffb74d" : "#90a4ae"} />
        </mesh>

        {/* Camera controls turn off while dragging */}
        <OrbitControls enabled={!dragging} />
      </Canvas>
    </div>
  );
}
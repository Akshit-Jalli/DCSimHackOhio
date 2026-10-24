"use client";
import { useLayoutEffect, useState } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// Floating labels drawn as normal HTML on top of the 3D view.
// A projector inside the Canvas moves each label to its 3D spot every frame.

export type Badge = { text: string; tone: "bad" | "warn" | "good" | "info" } | null;
export type Label = { id: string; x: number; y: number; z: number; icon: string; name: string; badge: Badge; small?: boolean };

const registry = new Map<string, { el: HTMLDivElement; pos: THREE.Vector3 }>();

const TONE = {
  bad: "#e53935",
  warn: "#fb8c00",
  good: "#43a047",
  info: "#1e88e5",
};

// Goes inside <Canvas>
export function LabelProjector() {
  const v = new THREE.Vector3();
  useFrame(({ camera, size }) => {
    registry.forEach(({ el, pos }) => {
      v.copy(pos).project(camera);
      if (v.z > 1 || Math.abs(v.x) > 1.2 || Math.abs(v.y) > 1.2) {
        el.style.visibility = "hidden";
        return;
      }
      const x = ((v.x + 1) / 2) * size.width;
      const y = ((1 - v.y) / 2) * size.height;
      el.style.visibility = "visible";
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    });
  });
  return null;
}

function Pin({ label }: { label: Label }) {
  const [hover, setHover] = useState(false);
  const { badge, small } = label;
  const ref = (el: HTMLDivElement | null) => {
    if (el) registry.set(label.id, { el, pos: new THREE.Vector3(label.x, label.y, label.z) });
    else registry.delete(label.id);
  };
  useLayoutEffect(() => {
    registry.get(label.id)?.pos.set(label.x, label.y, label.z);
  }, [label.id, label.x, label.y, label.z]);

  return (
    <div ref={ref} style={{ position: "absolute", left: 0, top: 0, visibility: "hidden", display: "flex", flexDirection: "column", alignItems: "center", willChange: "transform" }}>
      {badge && (
        <div style={{ background: TONE[badge.tone], color: "white", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 8, marginBottom: 3, whiteSpace: "nowrap", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
          {badge.text}
        </div>
      )}
      <div
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        style={{
          pointerEvents: "auto",
          display: "flex",
          alignItems: "center",
          gap: 5,
          background: "rgba(255,255,255,0.93)",
          border: badge ? `2px solid ${TONE[badge.tone]}` : "1px solid rgba(255,255,255,0.9)",
          borderRadius: 999,
          padding: hover ? "3px 10px 3px 5px" : small ? 2 : 3,
          boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
          fontSize: small ? 13 : 16,
          lineHeight: 1,
          cursor: "default",
        }}
      >
        <span>{label.icon}</span>
        {hover && <span style={{ fontSize: 12, fontWeight: 700, color: "#263238", whiteSpace: "nowrap" }}>{label.name}</span>}
      </div>
      <div style={{ width: 2, height: small ? 10 : 16, background: "rgba(255,255,255,0.95)", boxShadow: "0 1px 2px rgba(0,0,0,0.3)" }} />
    </div>
  );
}

// Goes outside <Canvas>, on top of it
export function LabelLayer({ labels }: { labels: Label[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 5, fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
      {labels.map((l) => (
        <Pin key={l.id} label={l} />
      ))}
    </div>
  );
}

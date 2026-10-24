"use client";
import { useEffect, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CLIP, GRID, HEIGHT_SCALE, layerUrl, tileOf, toXY } from "./mapConfig";
import { night } from "./night";

// Wall and roof colors by building size: homes, mid-size (shops, churches), big (warehouses, plants)
const HOME_WALL = new THREE.Color("#f5efe3");
const HOME_ROOFS = ["#b9735b", "#8c7b6b", "#6f7c86", "#a3664f"].map((c) => new THREE.Color(c));
const MID_WALL = new THREE.Color("#ece7df");
const MID_ROOF = new THREE.Color("#9aa3ab");
const BIG_WALL = new THREE.Color("#e2e6e9");
const BIG_ROOF = new THREE.Color("#c9ced3");

// Paint one building: top faces get the roof color, sides get the wall color
function paint(geo: THREE.BufferGeometry, wall: THREE.Color, roof: THREE.Color) {
  const normals = geo.getAttribute("normal");
  const colors = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const c = normals.getZ(i) > 0.5 ? roof : wall; // +z is up before the geometry is laid flat
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

export default function Buildings({
  onLoaded,
  noiseCenter,
  noiseRadius,
  lot,
}: {
  // counts = buildings per tile, centroids = [x0, z0, x1, z1, ...] for every building
  onLoaded: (counts: Int32Array, centroids: Float32Array) => void;
  noiseCenter: [number, number] | null;
  noiseRadius: number;
  lot: { center: [number, number]; half: number } | null; // buildings under the lot get removed
}) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Material that tints buildings red when they're inside the loud zone
  const { material, uniforms } = useMemo(() => {
    const uniforms = {
      uNoiseCenter: { value: new THREE.Vector2() },
      uNoiseRadius: { value: 0 },
      uLotCenter: { value: new THREE.Vector2() },
      uLotHalf: { value: 0 },
      uNight: { value: 0 },
    };
    const material = new THREE.MeshStandardMaterial({ vertexColors: true, clippingPlanes: CLIP });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying float vUp;")
        .replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvUp = objectNormal.y;"
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nvarying vec3 vWPos;\nvarying float vUp;\nuniform float uNight;\nuniform vec2 uNoiseCenter;\nuniform float uNoiseRadius;\nuniform vec2 uLotCenter;\nuniform float uLotHalf;"
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>
          vec2 dl = abs(vWPos.xz - uLotCenter);
          if (uLotHalf > 0.0 && dl.x < uLotHalf && dl.y < uLotHalf) discard;
          if (uNoiseRadius > 0.0 && distance(vWPos.xz, uNoiseCenter) < uNoiseRadius) {
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.22, 0.18), 0.8);
          }`
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
          // Night: rows of lit windows on the walls (about 1 in 2 lit)
          if (uNight > 0.0 && vUp < 0.5) {
            float floorH = ${(3.5 * HEIGHT_SCALE).toFixed(1)};
            float fy = fract(vWPos.y / floorH);
            float u = (vWPos.x + vWPos.z) / 7.0;
            float along = fract(u);
            float win = step(0.35, fy) * step(fy, 0.7) * step(0.25, along) * step(along, 0.75);
            vec2 cell = floor(vec2(u, vWPos.y / floorH));
            float lit = step(0.5, fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453));
            totalEmissiveRadiance += vec3(1.0, 0.5, 0.14) * win * lit * uNight * 1.3;
          }`
        );
    };
    material.customProgramCacheKey = () => "buildings-noise";
    return { material, uniforms };
  }, []);

  useFrame(() => {
    uniforms.uNight.value = night.t;
  });

  useEffect(() => {
    if (noiseCenter) uniforms.uNoiseCenter.value.set(noiseCenter[0], noiseCenter[1]);
    uniforms.uNoiseRadius.value = noiseCenter ? noiseRadius : 0;
    if (lot) uniforms.uLotCenter.value.set(lot.center[0], lot.center[1]);
    uniforms.uLotHalf.value = lot ? lot.half : 0;
  }, [noiseCenter, noiseRadius, lot, uniforms]);

  useEffect(() => {
    fetch(layerUrl("buildings"))
      .then((r) => r.json())
      .then((data) => {
        const parts: THREE.BufferGeometry[] = [];
        const counts = new Int32Array(GRID * GRID); // buildings per tile
        const centroids: number[] = [];

        for (const f of data.features) {
          const g = f.geometry;
          if (!g) continue;
          const polygons =
            g.type === "Polygon" ? [g.coordinates]
            : g.type === "MultiPolygon" ? g.coordinates
            : [];

          // Real height if the data has it, otherwise floors x 3.5 m, otherwise 6 m
          const p = f.properties || {};
          const realHeight = p.height ?? (p.num_floors ? p.num_floors * 3.5 : 6);
          const height = realHeight * HEIGHT_SCALE;

          for (const poly of polygons) {
            const ring: THREE.Vector2[] = poly[0].map(toXY);
            let cx = 0;
            let cy = 0;
            for (const v of ring) {
              cx += v.x;
              cy += v.y;
            }
            cx /= ring.length;
            cy /= ring.length;
            centroids.push(cx, -cy); // scene z is south
            const t = tileOf(cx, -cy);
            if (t >= 0) counts[t]++;
            const geo = new THREE.ExtrudeGeometry(new THREE.Shape(ring), {
              depth: height,
              bevelEnabled: false,
            });
            const area = Math.abs(THREE.ShapeUtils.area(ring));
            if (area < 300) paint(geo, HOME_WALL, HOME_ROOFS[parts.length % HOME_ROOFS.length]);
            else if (area < 2500) paint(geo, MID_WALL, MID_ROOF);
            else paint(geo, BIG_WALL, BIG_ROOF);
            parts.push(geo);
          }
        }

        // Combine all buildings into one object so it runs fast
        const merged = mergeGeometries(parts);
        merged.rotateX(-Math.PI / 2);
        setGeometry(merged);
        onLoaded(counts, new Float32Array(centroids));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!geometry) return null;

  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}

"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import * as THREE from "three";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { MapControls, GizmoHelper, GizmoViewcube } from "@react-three/drei";
import Buildings from "./Buildings";
import MapLayers from "./MapLayers";
import DataCenter from "./DataCenter";
import Trees from "./Trees";
import Landmarks from "./Landmarks";
import { LabelLayer, LabelProjector, type Label } from "./labels";
import { night, lerp } from "./night";
import { TILE, GRID, MAP_HALF, MAP_SIZE, toLatLon, type TownInfo } from "./mapConfig";
import {
  PRESETS,
  YEAR_END,
  YEAR_START,
  activeMW,
  defaultSettings,
  scaledPhases,
  type Preset,
  type Settings,
} from "./sim/presets";
import type { SimInput } from "./sim/types";
import { runSimulation } from "./sim/fakeEngine";
import { BuildMenu, ImpactsPanel, SettingsPanel, YearBar, panel } from "./ui/Panels";
import { LoadingScreen } from "./ui/LoadingScreen";

const MAX_BUILDINGS_PER_TILE = 8; // more than this = part of town, can't build

// Where "Reset view" flies the camera, and where the intro starts
const HOME_POS = new THREE.Vector3(1000, 1400, 2200);
const HOME_TARGET = new THREE.Vector3(0, 0, 0);
const INTRO_POS = new THREE.Vector3(-3500, 6500, 5500);

// Sky colors (fog matches the horizon so the map edges melt into the haze)
const SKY_TOP = "#5e9fdc";
const SKY_HORIZON = "#e9eef0";
const SKY_BELOW = "#d8dccf";
const NIGHT_TOP = "#0a1430";
const NIGHT_HORIZON = "#2b3a63";
const NIGHT_BELOW = "#151b2b";

// Gradient sky dome, drawn behind everything
function Sky() {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
        fog: false,
        uniforms: {
          top: { value: new THREE.Color(SKY_TOP) },
          horizon: { value: new THREE.Color(SKY_HORIZON) },
          below: { value: new THREE.Color(SKY_BELOW) },
          nTop: { value: new THREE.Color(NIGHT_TOP) },
          nHorizon: { value: new THREE.Color(NIGHT_HORIZON) },
          nBelow: { value: new THREE.Color(NIGHT_BELOW) },
          uNight: { value: 0 },
        },
        vertexShader: `
          varying float vH;
          void main() {
            vH = normalize(position).y;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 top; uniform vec3 horizon; uniform vec3 below;
          uniform vec3 nTop; uniform vec3 nHorizon; uniform vec3 nBelow;
          uniform float uNight;
          varying float vH;
          void main() {
            vec3 t = mix(top, nTop, uNight);
            vec3 h = mix(horizon, nHorizon, uNight);
            vec3 b = mix(below, nBelow, uNight);
            vec3 c = vH > 0.0
              ? mix(h, t, pow(smoothstep(0.0, 0.6, vH), 0.8))
              : mix(h, b, smoothstep(0.0, -0.2, vH));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    []
  );
  useFrame(() => {
    material.uniforms.uNight.value = night.t;
  });
  return (
    <mesh renderOrder={-1000} material={material} frustumCulled={false}>
      <sphereGeometry args={[40000, 32, 16]} />
    </mesh>
  );
}

// Stars that fade in at night
function Stars() {
  const { geometry, material } = useMemo(() => {
    const pts: number[] = [];
    for (let i = 0; i < 1500; i++) {
      const a = Math.random() * Math.PI * 2;
      const h = 0.08 + Math.random() * 0.92;
      const r = Math.sqrt(1 - h * h);
      pts.push(Math.cos(a) * r * 35000, h * 35000, Math.sin(a) * r * 35000);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const m = new THREE.PointsMaterial({ color: "#ffffff", size: 2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthTest: false, depthWrite: false });
    return { geometry: g, material: m };
  }, []);
  useFrame(() => {
    material.opacity = night.t;
  });
  return <points geometry={geometry} material={material} renderOrder={-999} frustumCulled={false} />;
}

// Puffy low-poly clouds drifting across the map
function Clouds() {
  const group = useRef<THREE.Group>(null);
  const clouds = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshLambertMaterial({ color: "#ffffff", flatShading: true, transparent: true, opacity: 0.92 });
    const list: { x: number; z: number; y: number; puffs: [number, number, number, number][] }[] = [];
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 11; i++) {
      const puffs: [number, number, number, number][] = [];
      const n = 3 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        puffs.push([(k - n / 2) * 150 + rand() * 60, rand() * 40, rand() * 120 - 60, 110 + rand() * 90]);
      }
      list.push({ x: rand() * MAP_SIZE - MAP_HALF, z: rand() * MAP_SIZE - MAP_HALF, y: 1300 + rand() * 500, puffs });
    }
    return { geo, mat, list };
  }, []);
  useFrame((_, dt) => {
    if (!group.current) return;
    group.current.children.forEach((c) => {
      c.position.x += dt * 30;
      if (c.position.x > MAP_HALF + 1500) c.position.x = -MAP_HALF - 1500;
    });
    clouds.mat.opacity = lerp(0.92, 0.35, night.t);
  });
  return (
    <group ref={group}>
      {clouds.list.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          {c.puffs.map(([x, y, z, r], k) => (
            <mesh key={k} geometry={clouds.geo} material={clouds.mat} position={[x, y, z]} scale={[r, r * 0.55, r * 0.8]} castShadow />
          ))}
        </group>
      ))}
    </group>
  );
}

// Fades lights and haze between day and night
function NightController({
  hemi,
  sun,
}: {
  hemi: RefObject<THREE.HemisphereLight | null>;
  sun: RefObject<THREE.DirectionalLight | null>;
}) {
  const scene = useThree((s) => s.scene);
  const dayFog = useMemo(() => new THREE.Color(SKY_HORIZON), []);
  const nightFog = useMemo(() => new THREE.Color(NIGHT_HORIZON), []);
  const daySky = useMemo(() => new THREE.Color("#e6f1ff"), []);
  const nightSky = useMemo(() => new THREE.Color("#5a6fa8"), []);
  const daySun = useMemo(() => new THREE.Color("#fff1dc"), []);
  const moon = useMemo(() => new THREE.Color("#9fb4ff"), []);
  useFrame((_, dt) => {
    const step = dt / 1.4;
    night.t = night.target > night.t ? Math.min(night.target, night.t + step) : Math.max(night.target, night.t - step);
    const t = night.t * night.t * (3 - 2 * night.t); // smooth
    if (scene.fog) (scene.fog as THREE.Fog).color.lerpColors(dayFog, nightFog, t);
    if (hemi.current) {
      hemi.current.intensity = lerp(0.85, 0.3, t);
      hemi.current.color.lerpColors(daySky, nightSky, t);
    }
    if (sun.current) {
      sun.current.intensity = lerp(1.15, 0.3, t);
      sun.current.color.lerpColors(daySun, moon, t);
    }
  });
  return null;
}

// Thick "game board" under the map so it reads as a diorama, not a flat sheet
function Board() {
  return (
    <>
      <mesh position={[0, -40.5, 0]} receiveShadow>
        <boxGeometry args={[MAP_SIZE, 80, MAP_SIZE]} />
        <meshLambertMaterial color="#8a6b4c" />
      </mesh>
      <mesh position={[0, -180.5, 0]}>
        <boxGeometry args={[MAP_SIZE, 200, MAP_SIZE]} />
        <meshLambertMaterial color="#6d5a49" />
      </mesh>
    </>
  );
}

type Controls = { target: THREE.Vector3; update: () => void };

// Snap the lot center to the grid and keep the whole lot on the map
function snap(v: number, tiles: number) {
  const maxI = Math.floor((MAP_HALF - (tiles * TILE) / 2) / TILE);
  const i = Math.max(-maxI, Math.min(maxI, Math.round(v / TILE)));
  return i * TILE;
}

// Smoothly flies the camera home whenever flyId changes (first flight is the slower intro)
function CameraFlyer({ flyId }: { flyId: number }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const t = useRef(1);
  const lastId = useRef(0);
  const fromPos = useRef(new THREE.Vector3());
  const fromTarget = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    if (flyId !== lastId.current) {
      lastId.current = flyId;
      fromPos.current.copy(camera.position);
      if (controls) fromTarget.current.copy(controls.target);
      t.current = 0;
    }
    if (t.current >= 1) return;
    t.current = Math.min(1, t.current + dt / (lastId.current === 1 ? 2.6 : 1.2));
    const k = t.current < 0.5 ? 4 * t.current ** 3 : 1 - Math.pow(-2 * t.current + 2, 3) / 2; // ease in-out
    camera.position.lerpVectors(fromPos.current, HOME_POS, k);
    if (controls) {
      controls.target.lerpVectors(fromTarget.current, HOME_TARGET, k);
      controls.update();
    }
  });
  return null;
}

// Updates the compass and scale bar every frame
function Hud({
  compassRef,
  barRef,
  labelRef,
}: {
  compassRef: RefObject<HTMLDivElement | null>;
  barRef: RefObject<HTMLDivElement | null>;
  labelRef: RefObject<HTMLSpanElement | null>;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as Controls | null;
  const size = useThree((s) => s.size);

  useFrame(() => {
    const target = controls?.target ?? HOME_TARGET;

    // Compass: rotate the N arrow based on which way the camera faces
    const az = Math.atan2(camera.position.x - target.x, camera.position.z - target.z);
    if (compassRef.current) compassRef.current.style.transform = `rotate(${az}rad)`;

    // Scale bar: meters per pixel at the center of the screen
    const d = camera.position.distanceTo(target);
    const fov = ((camera as THREE.PerspectiveCamera).fov * Math.PI) / 180;
    const mpp = (2 * d * Math.tan(fov / 2)) / size.height;
    const raw = mpp * 120;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const nice = [1, 2, 5, 10].map((n) => n * pow).filter((n) => n <= raw).pop() ?? pow;
    if (barRef.current) barRef.current.style.width = `${nice / mpp}px`;
    if (labelRef.current) {
      labelRef.current.textContent = nice >= 1000 ? `${nice / 1000} km` : `${nice} m`;
    }
  });
  return null;
}

// townMenu: the town name / search dropdown shown in the header (from TownApp)
export default function Scene({ town, townMenu }: { town: TownInfo; townMenu: ReactNode }) {
  // What's placed
  const [settings, setSettings] = useState<Settings | null>(null);
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [lastValid, setLastValid] = useState<[number, number] | null>(null);
  const [dragging, setDragging] = useState(false);

  // Map data
  const [counts, setCounts] = useState<Int32Array | null>(null);
  const [centroids, setCentroids] = useState<Float32Array | null>(null);
  const [landBlocked, setLandBlocked] = useState<Uint8Array | null>(null);

  // Time
  const [year, setYear] = useState(2031);
  const [playing, setPlaying] = useState(false);

  const [flyId, setFlyId] = useState(0);
  const [trees, setTrees] = useState<Float32Array | null>(null);
  const [isNight, setIsNight] = useState(false);
  const [labels, setLabels] = useState<Label[]>([]);
  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const sunRef = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    night.target = isNight ? 1 : 0;
  }, [isNight]);
  const compassRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  const loading = !counts || !landBlocked;

  // Intro: fly in from high up once the map has loaded
  useEffect(() => {
    if (!loading) setFlyId((n) => (n === 0 ? 1 : n));
  }, [loading]);
  const preset: Preset | null = settings ? PRESETS.find((p) => p.id === settings.presetId) ?? null : null;
  const tiles = preset?.tiles ?? 4;
  const lotSize = tiles * TILE;

  // Play button: step through the years
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setYear((y) => (y >= YEAR_END ? YEAR_START : y + 1)), 700);
    return () => clearInterval(id);
  }, [playing]);

  // Can we build here? Every tile under the lot must be clear of town and water
  const valid = useMemo(() => {
    if (!pos || !counts || !landBlocked) return true;
    const ix0 = Math.round((pos[0] - lotSize / 2 + MAP_HALF) / TILE);
    const iz0 = Math.round((pos[1] - lotSize / 2 + MAP_HALF) / TILE);
    for (let iz = iz0; iz < iz0 + tiles; iz++) {
      for (let ix = ix0; ix < ix0 + tiles; ix++) {
        const t = iz * GRID + ix;
        if (landBlocked[t] || counts[t] >= MAX_BUILDINGS_PER_TILE) return false;
      }
    }
    return true;
  }, [pos, counts, landBlocked, tiles, lotSize]);

  // Distance from the lot edge to the nearest building
  const nearestResidenceM = useMemo(() => {
    if (!pos || !centroids) return 1000;
    let best = Infinity;
    for (let i = 0; i < centroids.length; i += 2) {
      const d = Math.hypot(centroids[i] - pos[0], centroids[i + 1] - pos[1]) - lotSize / 2;
      if (d > 0 && d < best) best = d;
    }
    return isFinite(best) ? best : 1000;
  }, [pos, centroids, lotSize]);

  // Engine input in the team's JSON format
  const input: SimInput | null = useMemo(() => {
    if (!settings || !preset || !pos) return null;
    const [lat, lon] = toLatLon(pos[0], pos[1]);
    const mw = settings.mw;
    return {
      site: {
        fips_county: town.countyFips ?? "",
        lat,
        lon,
        acres: tiles * tiles * 20,
        prior_land_use: "cropland",
        cauv_enrolled: true,
      },
      facility: {
        it_load_mw: mw,
        pue: 1.25,
        cooling: settings.cooling,
        water_source: settings.waterSource,
        capex_usd: mw * 9.6e6,
        phases: scaledPhases(preset, mw),
        backup_gen_count: Math.ceil((mw * 1.2) / 2.5),
        backup_gen_mw_each: 2.5,
      },
      policy: {
        property_abatement_pct: settings.abatementPct,
        abatement_years: 15,
        pilot_annual_usd: 1.2e6,
        pilot_school_share_pct: 40,
        sales_tax_exemption: true,
        noise_setback_ft: 500,
        grid_cost_allocation: "aep_dc_tariff",
      },
      horizon: { start_year: YEAR_START, end_year: YEAR_END },
    };
  }, [settings, preset, pos, tiles, town.countyFips]);

  const results = useMemo(
    () => (input ? runSimulation(input, { nearestResidenceM }) : null),
    [input, nearestResidenceM]
  );
  const r = results?.find((x) => x.year === year) ?? null;
  const running = input ? activeMW(input.facility.phases, year) : 0;
  // A phase is "under construction" for the 2 years before it opens
  const planned = useMemo(() => {
    if (!input) return 0;
    const next = input.facility.phases.find((ph) => ph.year > year && ph.year - 2 <= year);
    return next ? next.mw : running;
  }, [input, year, running]);

  // Loud zone radius from the lot center, and how many buildings are in it
  const noiseRadius = r ? lotSize / 2 + r.nuisance.loud_radius_m.value : 0;
  const homesInZone = useMemo(() => {
    if (!pos || !centroids || noiseRadius <= 0) return 0;
    let n = 0;
    for (let i = 0; i < centroids.length; i += 2) {
      if (Math.hypot(centroids[i] - pos[0], centroids[i + 1] - pos[1]) < noiseRadius) n++;
    }
    return n;
  }, [pos, centroids, noiseRadius]);

  function onGroundMove(e: ThreeEvent<PointerEvent>) {
    if (!dragging) return;
    setPos([snap(e.point.x, tiles), snap(e.point.z, tiles)]);
  }

  // Start dragging a new data center from the build menu
  function startFromMenu(p: Preset, e: ReactPointerEvent) {
    e.preventDefault();
    if (!settings || settings.presetId !== p.id) {
      setSettings(defaultSettings(p));
      setPos(null);
      setLastValid(null);
    }
    setPlaying(false);
    setDragging(true);
    document.body.style.cursor = "grabbing";
  }

  // When you let go: keep it if the spot is allowed, otherwise snap back (or cancel)
  function endDrag() {
    if (!dragging) return;
    setDragging(false);
    document.body.style.cursor = "";
    if (pos && valid) setLastValid(pos);
    else if (lastValid) setPos(lastValid);
    else {
      setPos(null);
      setSettings(null);
    }
  }

  function remove() {
    setSettings(null);
    setPos(null);
    setLastValid(null);
  }

  const placed = !!(settings && preset && pos && !dragging);
  const site = useMemo(
    () => (placed && pos ? { pos, half: lotSize / 2, noiseRadius } : null),
    [placed, pos, lotSize, noiseRadius]
  );

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }} onPointerUp={endDrag}>
      <Canvas
        shadows
        camera={{ position: INTRO_POS.toArray(), near: 10, far: 50000, fov: 45 }}
        gl={{ logarithmicDepthBuffer: true }}
        onCreated={({ gl }) => {
          gl.localClippingEnabled = true; // lets us trim everything at the map edge
        }}
      >
        {/* Sky and haze at the edges */}
        <Sky />
        <Stars />
        <Clouds />
        <NightController hemi={hemiRef} sun={sunRef} />
        <fog attach="fog" args={[SKY_HORIZON, 7000, 19000]} />

        {/* Lighting: soft sky light plus a warm sun with shadows */}
        <hemisphereLight ref={hemiRef} args={["#e6f1ff", "#8a7a5c", 0.85]} />
        <directionalLight
          ref={sunRef}
          position={[3000, 6000, 2000]}
          color="#fff1dc"
          intensity={1.15}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-camera-left={-4500}
          shadow-camera-right={4500}
          shadow-camera-top={4500}
          shadow-camera-bottom={-4500}
          shadow-camera-near={10}
          shadow-camera-far={15000}
          shadow-bias={-0.0005}
          shadow-normalBias={2}
        />

        {/* Board and ground */}
        <Board />
        <mesh rotation={[-Math.PI / 2, 0, 0]} onPointerMove={onGroundMove} receiveShadow>
          <planeGeometry args={[MAP_SIZE, MAP_SIZE]} />
          <meshLambertMaterial color="#a9d07a" />
        </mesh>

        {/* Fields, forest, water, roads */}
        <MapLayers onLoaded={setLandBlocked} onTrees={setTrees} />
        {trees && <Trees points={trees} lot={settings && pos ? { center: pos, half: lotSize / 2 } : null} />}

        {/* Tile grid only shows while dragging */}
        {dragging && <gridHelper args={[MAP_SIZE, GRID]} position={[0, 3.6, 0]} />}

        {/* Real buildings (turn red inside the loud zone) */}
        <Buildings
          onLoaded={(c, cents) => {
            setCounts(c);
            setCentroids(cents);
          }}
          noiseCenter={placed && pos ? pos : null}
          noiseRadius={noiseRadius}
          lot={settings && pos ? { center: pos, half: lotSize / 2 } : null}
        />

        {/* Schools, hospital, water towers, power grid, with floating labels */}
        <Landmarks site={site} r={placed ? r : null} onLabels={setLabels} />
        <LabelProjector />

        {/* The data center */}
        {settings && pos && (
          <DataCenter
            pos={pos}
            tiles={tiles}
            activeMW={dragging ? settings.mw : running}
            plannedMW={dragging ? settings.mw : planned}
            dragging={dragging}
            valid={valid}
            noiseRadius={noiseRadius}
            onGrab={(e) => {
              e.stopPropagation();
              setDragging(true);
              document.body.style.cursor = "grabbing";
            }}
          />
        )}

        {/* Map controls: left drag = move, right drag = rotate/tilt, scroll = zoom */}
        <MapControls
          makeDefault
          enabled={!dragging}
          minDistance={150}
          maxDistance={9000}
          maxPolarAngle={Math.PI / 2.2}
        />

        {/* View cube in the top right */}
        <GizmoHelper alignment="top-right" margin={[90, 90]}>
          <GizmoViewcube
            faces={["E", "W", "Top", "Bottom", "S", "N"]}
            color="#ffffff"
            textColor="#37474f"
            strokeColor="#b0bec5"
            opacity={0.95}
          />
        </GizmoHelper>

        <CameraFlyer flyId={flyId} />
        <Hud compassRef={compassRef} barRef={barRef} labelRef={labelRef} />
      </Canvas>

      {/* Floating labels */}
      <LabelLayer labels={labels} />

      {/* Soft darkening at the screen edges */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1, background: isNight ? "radial-gradient(ellipse at center, transparent 45%, rgba(5,10,30,0.45) 100%)" : "radial-gradient(ellipse at center, transparent 55%, rgba(20,40,60,0.22) 100%)", transition: "background 1s" }} />

      {/* App header and reset view */}
      <div style={{ position: "absolute", top: 16, left: 16, display: "flex", gap: 10, alignItems: "stretch", zIndex: 12 }}>
        <div style={{ ...panel, position: "relative", padding: "8px 14px 8px 8px", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "linear-gradient(135deg, #1e88e5, #43a047)", color: "white", fontWeight: 800, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 0.5 }}>
            DC
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>DCSim</div>
            {townMenu}
          </div>
        </div>
        <button
          onClick={() => setFlyId((n) => n + 1)}
          style={{ ...panel, position: "relative", padding: "0 14px", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
        >
          <span style={{ fontSize: 15 }}>⟲</span> Reset view
        </button>
        <button
          onClick={() => setIsNight((v) => !v)}
          style={{ ...panel, position: "relative", padding: "0 14px", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: isNight ? "rgba(30,40,70,0.85)" : panel.background, color: isNight ? "#e3ecff" : panel.color }}
        >
          <span style={{ fontSize: 15 }}>{isNight ? "☀" : "☾"}</span> {isNight ? "Day" : "Night"}
        </button>
      </div>

      {/* Hints at the top */}
      {dragging && !valid && (
        <div style={{ ...panel, top: 16, left: "50%", transform: "translateX(-50%)", padding: "10px 16px", color: "#c62828", fontWeight: 600, pointerEvents: "none" }}>
          Can&apos;t build here: too close to town or water
        </div>
      )}
      {!settings && !loading && (
        <div style={{ ...panel, top: 16, left: "50%", transform: "translateX(-50%)", padding: "10px 16px", fontWeight: 600, pointerEvents: "none" }}>
          Drag a data center from the bar below onto the map
        </div>
      )}

      {/* Left: impacts */}
      {placed && r && results && <ImpactsPanel results={results} year={year} homesInZone={homesInZone} otherTown={town.slug !== "wilmington-oh"} />}

      {/* Right: settings */}
      {placed && settings && preset && (
        <SettingsPanel preset={preset} settings={settings} onChange={setSettings} onRemove={remove} />
      )}

      {/* Bottom: year slider and build menu */}
      <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, zIndex: 10 }}>
        {placed && <YearBar year={year} setYear={setYear} playing={playing} setPlaying={setPlaying} activeMW={running} />}
        <BuildMenu activeId={settings?.presetId ?? null} onStartDrag={startFromMenu} />
      </div>

      {/* Scale bar and compass */}
      <div style={{ ...panel, right: 16, bottom: 16, padding: "10px 14px", display: "flex", alignItems: "center", gap: 14, fontSize: 13, pointerEvents: "none" }}>
        <div>
          <div ref={barRef} style={{ height: 6, width: 100, borderLeft: "2px solid #333", borderRight: "2px solid #333", borderBottom: "2px solid #333" }} />
          <span ref={labelRef} style={{ fontWeight: 600 }}>1 km</span>
        </div>
        <div ref={compassRef} style={{ display: "flex", flexDirection: "column", alignItems: "center", fontWeight: 700 }}>
          <span style={{ fontSize: 11, lineHeight: 1 }}>N</span>
          <span style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: "12px solid #d32f2f" }} />
        </div>
      </div>

      {/* Loading screen (fades out once the map is built) */}
      <LoadingScreen visible={loading} title={`Loading ${town.name}, ${town.state}`} />
    </div>
  );
}

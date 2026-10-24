"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { PRESETS, YEAR_END, YEAR_START, type Preset, type Settings } from "../sim/presets";
import type { Cooling, WaterSource, YearResult } from "../sim/types";

export const panel: CSSProperties = {
  position: "absolute",
  background: "rgba(255,255,255,0.8)",
  backdropFilter: "blur(14px) saturate(160%)",
  WebkitBackdropFilter: "blur(14px) saturate(160%)",
  border: "1px solid rgba(255,255,255,0.7)",
  borderRadius: 16,
  boxShadow: "0 8px 30px rgba(20,40,60,0.18)",
  color: "#263238",
  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
  zIndex: 10,
};

const label: CSSProperties = { fontSize: 12, color: "#607d8b", marginBottom: 4 };

function fmt(n: number, digits = 0) {
  if (!isFinite(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e9) return (n / 1e9).toFixed(1) + "B";
  if (abs >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (abs >= 1e4) return (n / 1e3).toFixed(0) + "k";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function money(n: number) {
  return (n < 0 ? "-$" : "$") + fmt(Math.abs(n));
}

// ---------------- Build menu (bottom bar) ----------------

export function BuildMenu({
  activeId,
  onStartDrag,
}: {
  activeId: string | null;
  onStartDrag: (p: Preset, e: ReactPointerEvent) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      {PRESETS.map((p) => (
        <button
          key={p.id}
          onPointerDown={(e) => onStartDrag(p, e)}
          style={{
            ...panel,
            position: "relative",
            width: 150,
            padding: "10px 12px",
            border: activeId === p.id ? "2px solid #1e88e5" : "1px solid rgba(255,255,255,0.7)",
            cursor: "grab",
            textAlign: "left",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            {Array.from({ length: Math.min(4, Math.ceil(p.mw / 250)) }).map((_, i) => (
              <span key={i} style={{ width: 22, height: 12, background: "#8a95a1", borderRadius: 2 }} />
            ))}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: "#607d8b" }}>{p.blurb}</div>
        </button>
      ))}
    </div>
  );
}

// ---------------- Year slider ----------------

export function YearBar({
  year,
  setYear,
  playing,
  setPlaying,
  activeMW,
}: {
  year: number;
  setYear: (y: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  activeMW: number;
}) {
  return (
    <div style={{ ...panel, position: "relative", padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, width: 470 }}>
      <button
        onClick={() => setPlaying(!playing)}
        style={{ width: 34, height: 34, borderRadius: 17, border: "none", background: "#1e88e5", color: "white", fontWeight: 700, cursor: "pointer" }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div style={{ flex: 1 }}>
        <input
          type="range"
          min={YEAR_START}
          max={YEAR_END}
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          style={{ width: "100%" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#90a4ae" }}>
          <span>{YEAR_START}</span>
          <span>{YEAR_END}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 80 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{year}</div>
        <div style={{ fontSize: 11, color: "#607d8b" }}>{fmt(activeMW)} MW running</div>
      </div>
    </div>
  );
}

// ---------------- Settings panel (right) ----------------

export function SettingsPanel({
  preset,
  settings,
  onChange,
  onRemove,
}: {
  preset: Preset;
  settings: Settings;
  onChange: (s: Settings) => void;
  onRemove: () => void;
}) {
  const maxMW = Math.round((preset.mw * 1.5) / 10) * 10;
  const field: CSSProperties = { marginBottom: 14 };
  const select: CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cfd8dc", background: "white" };

  return (
    <div style={{ ...panel, top: 190, right: 16, width: 260, padding: 16 }}>
      <div style={{ fontSize: 12, color: "#607d8b" }}>Data center</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 14 }}>{preset.name}</div>

      <div style={field}>
        <div style={label}>Size: <b>{settings.mw} MW</b></div>
        <input
          type="range"
          min={10}
          max={maxMW}
          step={10}
          value={settings.mw}
          onChange={(e) => onChange({ ...settings, mw: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </div>

      <div style={field}>
        <div style={label}>Cooling</div>
        <select
          value={settings.cooling}
          onChange={(e) => onChange({ ...settings, cooling: e.target.value as Cooling })}
          style={select}
        >
          <option value="closed_loop_air">Closed-loop air (least water)</option>
          <option value="hybrid">Hybrid</option>
          <option value="evaporative">Evaporative (most water)</option>
        </select>
      </div>

      <div style={field}>
        <div style={label}>Water source</div>
        <select
          value={settings.waterSource}
          onChange={(e) => onChange({ ...settings, waterSource: e.target.value as WaterSource })}
          style={select}
        >
          <option value="municipal">City water system</option>
          <option value="onsite_wells">Its own wells</option>
        </select>
      </div>

      <div style={field}>
        <div style={label}>Property tax break: <b>{settings.abatementPct}%</b></div>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={settings.abatementPct}
          onChange={(e) => onChange({ ...settings, abatementPct: Number(e.target.value) })}
          style={{ width: "100%" }}
        />
      </div>

      <button
        onClick={onRemove}
        style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px solid #e53935", background: "white", color: "#e53935", fontWeight: 600, cursor: "pointer" }}
      >
        Remove
      </button>
    </div>
  );
}

// ---------------- Impacts panel (left) ----------------

function Section({ title, color, children }: { title: string; color: string; children: ReactNode }) {
  return (
    <div style={{ borderLeft: `4px solid ${color}`, paddingLeft: 10, marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

// Number that counts smoothly to its new value
function AnimatedNumber({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 450);
      const k = 1 - Math.pow(1 - t, 3);
      const v = a + (value - a) * k;
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}

// Tiny trend line across all years, with a dot on the current year
function Sparkline({ series, index, color }: { series: number[]; index: number; color: string }) {
  const w = 54;
  const h = 16;
  const min = Math.min(0, ...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const x = (i: number) => (i / Math.max(1, series.length - 1)) * w;
  const y = (v: number) => h - 1 - ((v - min) / span) * (h - 2);
  const d = series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ flexShrink: 0, overflow: "visible" }} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} strokeOpacity={0.55} />
      <circle cx={x(index)} cy={y(series[index] ?? 0)} r={2.6} fill={color} />
    </svg>
  );
}

type Getter = (r: YearResult) => number;

function Row({
  label,
  get,
  format,
  results,
  index,
  color,
}: {
  label: string;
  get: Getter;
  format: (n: number) => string;
  results: YearResult[];
  index: number;
  color: string;
}) {
  const series = useMemo(() => results.map(get), [results, get]);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 3 }}>
      <span style={{ color: "#546e7a", flex: 1 }}>{label}</span>
      <Sparkline series={series} index={index} color={color} />
      <span style={{ fontWeight: 700, whiteSpace: "nowrap", minWidth: 74, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        <AnimatedNumber value={series[index] ?? 0} format={format} />
      </span>
    </div>
  );
}

// Getters live outside the component so the trend lines don't recompute every render
const G = {
  water: (r: YearResult) => r.water.withdrawal_mgd.value,
  waterPct: (r: YearResult) => r.water.pct_of_system_capacity.value,
  waterRate: (r: YearResult) => r.water.residential_rate_delta_pct.value,
  mwh: (r: YearResult) => r.energy.facility_mwh.value,
  homes: (r: YearResult) => r.energy.homes_equivalent.value,
  bill: (r: YearResult) => r.ratepayer.household_bill_delta_usd_month.value,
  taxForgone: (r: YearResult) => r.fiscal.property_tax_forgone_usd.value,
  pilot: (r: YearResult) => r.fiscal.pilot_received_usd.value,
  perPupil: (r: YearResult) => r.fiscal.net_per_pupil_delta_usd.value,
  noise: (r: YearResult) => r.nuisance.noise_dba_at_nearest_residence.value,
  acres: (r: YearResult) => r.land.acres_converted.value,
  construction: (r: YearResult) => r.jobs.construction_fte.value,
  permanent: (r: YearResult) => r.jobs.permanent_fte.value,
};

export function ImpactsPanel({
  results,
  year,
  homesInZone,
  otherTown,
}: {
  results: YearResult[];
  year: number;
  homesInZone: number;
  otherTown: boolean; // fake engine only knows Wilmington's water/schools/taxes
}) {
  const index = Math.max(0, results.findIndex((x) => x.year === year));
  const r = results[index];
  const rowProps = { results, index };
  return (
    <div style={{ ...panel, top: 78, left: 16, width: 330, padding: 16, maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Impacts in {r.year}</div>
        <div style={{ fontSize: 12, color: "#607d8b" }}>{fmt(r.active_mw)} MW</div>
      </div>
      <div style={{ fontSize: 11, color: "#ef6c00", background: "#fff3e0", borderRadius: 6, padding: "4px 8px", margin: "8px 0 14px" }}>
        {otherTown ? "Demo numbers (Wilmington defaults). Engine not connected yet." : "Demo numbers. Engine not connected yet."}
      </div>

      {r.active_mw === 0 ? (
        <div style={{ fontSize: 13, color: "#546e7a", marginBottom: 14 }}>Not running yet. Drag the year slider forward.</div>
      ) : null}

      <Section title="Water" color="#1e88e5">
        <Row {...rowProps} color="#1e88e5" label="Water used per day" get={G.water} format={(n) => `${fmt(n, 2)} M gal`} />
        <Row {...rowProps} color="#1e88e5" label="Share of city system" get={G.waterPct} format={(n) => `${fmt(n, 1)}%`} />
        <Row {...rowProps} color="#1e88e5" label="Home water rates" get={G.waterRate} format={(n) => `+${fmt(n, 1)}%`} />
      </Section>

      <Section title="Electricity" color="#f9a825">
        <Row {...rowProps} color="#f9a825" label="Power used per year" get={G.mwh} format={(n) => `${fmt(n)} MWh`} />
        <Row {...rowProps} color="#f9a825" label="Same as # of homes" get={G.homes} format={(n) => fmt(n)} />
        <Row {...rowProps} color="#f9a825" label="Household bill" get={G.bill} format={(n) => `+$${fmt(n, 2)}/mo`} />
      </Section>

      <Section title="Schools and taxes" color="#8e24aa">
        <Row {...rowProps} color="#8e24aa" label="Property tax forgiven" get={G.taxForgone} format={money} />
        <Row {...rowProps} color="#8e24aa" label="Payment to town (PILOT)" get={G.pilot} format={money} />
        <Row {...rowProps} color="#8e24aa" label="Per student" get={G.perPupil} format={(n) => (n >= 0 ? "+" : "") + money(n)} />
      </Section>

      <Section title="Noise" color="#e53935">
        <Row {...rowProps} color="#e53935" label="At the nearest home" get={G.noise} format={(n) => `${fmt(n)} dBA`} />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
          <span style={{ color: "#546e7a" }}>Buildings in the loud zone</span>
          <span style={{ fontWeight: 700 }}>
            <AnimatedNumber value={homesInZone} format={(n) => fmt(Math.round(n))} />
          </span>
        </div>
      </Section>

      <Section title="Land and jobs" color="#43a047">
        <Row {...rowProps} color="#43a047" label="Farmland converted" get={G.acres} format={(n) => `${fmt(n)} acres`} />
        <Row {...rowProps} color="#43a047" label="Construction jobs" get={G.construction} format={(n) => fmt(Math.round(n))} />
        <Row {...rowProps} color="#43a047" label="Permanent jobs" get={G.permanent} format={(n) => fmt(Math.round(n))} />
      </Section>
    </div>
  );
}

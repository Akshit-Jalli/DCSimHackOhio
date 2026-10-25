"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { PRESETS, YEAR_END, YEAR_START, type AdvancedCoef, type Preset, type Settings } from "../sim/presets";
import type { Cooling, WaterSource, YearResult } from "../sim/types";
import { interpResult, interpSeries, monthLabel } from "../sim/interp";
import coefficientsJson from "../../lib/data/coefficients.json";
import { METRICS, SECTIONS, SECTION_ORDER, TIER, fmt, money, metricSeries, type MetricDef, type Tier, type ViewMode } from "./metrics";
export type { ViewMode } from "./metrics";

export const MONTHS_TOTAL = (YEAR_END - YEAR_START + 1) * 12;

const stepTag: CSSProperties = { fontSize: 11, color: "#607d8b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" };

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
const hint: CSSProperties = { fontSize: 11, color: "#90a4ae", marginTop: 4, lineHeight: 1.35 };


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
  month,
  setMonth,
  playing,
  setPlaying,
  status,
}: {
  month: number; // 0 .. MONTHS_TOTAL-1
  setMonth: (m: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  status: string;
}) {
  const atEnd = month >= MONTHS_TOTAL - 1;
  return (
    <div style={{ ...panel, position: "relative", padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, width: 520 }}>
      <button
        onClick={() => {
          if (!playing && atEnd) setMonth(0);
          setPlaying(!playing);
        }}
        style={{ width: 36, height: 36, borderRadius: 18, border: "none", background: "#1e88e5", color: "white", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
        aria-label={playing ? "Pause" : atEnd ? "Replay" : "Play"}
        title={playing ? "Pause" : atEnd ? "Replay from the start" : "Play"}
      >
        {playing ? "❚❚" : atEnd ? "↺" : "▶"}
      </button>
      <div style={{ flex: 1 }}>
        <input
          type="range"
          min={0}
          max={MONTHS_TOTAL - 1}
          value={month}
          onChange={(e) => {
            setPlaying(false);
            setMonth(Number(e.target.value));
          }}
          style={{ width: "100%" }}
          aria-label="Month"
        />
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#90a4ae" }}>
          <span>{YEAR_START}</span>
          <span title="The model steps once a year. Months in between are interpolated for display.">model steps yearly · months interpolate</span>
          <span>{YEAR_END}</span>
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 110 }}>
        <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{monthLabel(YEAR_START, month)}</div>
        <div style={{ fontSize: 11, color: "#607d8b" }}>{status}</div>
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
    <div style={{ ...panel, top: 190, right: 16, width: 270, padding: 16, maxHeight: "calc(100vh - 300px)", overflowY: "auto" }}>
      <div style={stepTag}>2 · Deal terms</div>
      <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{preset.name}</div>
      <div style={{ fontSize: 12, color: "#607d8b", marginBottom: 14 }}>Change anything. The impacts update as you do.</div>

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
        <div style={hint}>More megawatts: more jobs, more power, more of everything in the impacts.</div>
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
        <div style={hint}>Evaporative uses water. Air cooling uses more electricity instead. There is no free option.</div>
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
        <div style={hint}>City water counts against the plant&apos;s capacity and can push up home water rates.</div>
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
        <div style={hint}>What the developer asks for. It is also what the schools give up.</div>
      </div>

      <div style={field}>
        <div style={label}>Tax break lasts</div>
        <select
          value={settings.abatementYears}
          onChange={(e) => onChange({ ...settings, abatementYears: Number(e.target.value) })}
          style={select}
        >
          <option value={10}>10 years</option>
          <option value={15}>15 years</option>
          <option value={30}>30 years</option>
        </select>
        <div style={hint}>When it ends, the full tax lands. Watch the schools section that year.</div>
      </div>

      <div style={field}>
        <div style={label}>Who pays for the grid upgrades</div>
        <select
          value={settings.tariffHolds ? "dc" : "everyone"}
          onChange={(e) => onChange({ ...settings, tariffHolds: e.target.value === "dc" })}
          style={select}
          title="Whether a large-load tariff makes the data center pay for its own transmission upgrades, or the cost is spread across every customer"
        >
          <option value="dc">The data center (large-load tariff)</option>
          <option value="everyone">Everyone&apos;s bills (no tariff)</option>
        </select>
        <div style={hint}>The biggest lever on your electric bill. A tariff puts the cost on the data center.</div>
      </div>

      <Advanced settings={settings} onChange={onChange} />

      <button
        onClick={onRemove}
        style={{ width: "100%", padding: "8px 0", borderRadius: 8, border: "1px solid #e53935", background: "white", color: "#e53935", fontWeight: 600, cursor: "pointer" }}
      >
        Remove
      </button>
    </div>
  );
}

// ---------------- Advanced (inside the settings panel) ----------------
// Facility and deal fields that used to be hardcoded, plus a few engine
// coefficients the user can override within their published range. Every
// one of these changes the engine; nothing here is cosmetic.

type CoefMeta = { value: number; low?: number; high?: number; unit?: string; confidence?: string; source?: string };
const COEFS = coefficientsJson as unknown as Record<string, CoefMeta>;

const ADV_COEFS: { key: AdvancedCoef; label: string; why: string; step: number; fmt: (n: number) => string }[] = [
  { key: "load_factor", label: "Utilization", why: "Energy against design capacity. 1.0 means every rack runs flat out all year.", step: 0.01, fmt: (n) => `${Math.round(n * 100)}%` },
  { key: "permanent_jobs_per_mw", label: "Permanent jobs per MW", why: "Independent audits put this near 0.4; developer claims run higher.", step: 0.01, fmt: (n) => n.toFixed(2) },
  { key: "capex_construction_share", label: "Share of capex that is construction", why: "Only about a fifth of a data center's price is building. The rest is equipment.", step: 0.01, fmt: (n) => `${Math.round(n * 100)}%` },
  { key: "water_l_per_kwh_evaporative", label: "Water per kWh, evaporative", why: "Only matters with evaporative cooling.", step: 0.01, fmt: (n) => `${n.toFixed(2)} L` },
  { key: "residual_bill_share_under_tariff", label: "Bill effect that survives a tariff", why: "Our assumption with the widest range in the model. Top driver of the bill result.", step: 0.01, fmt: (n) => `${Math.round(n * 100)}%` },
];

function Advanced({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  const [open, setOpen] = useState(false);
  const field: CSSProperties = { marginBottom: 12 };
  const num: CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cfd8dc", background: "white", fontSize: 13 };
  const setOv = (k: AdvancedCoef, v: number | undefined) => {
    const overrides = { ...settings.overrides };
    if (v === undefined) delete overrides[k];
    else overrides[k] = v;
    onChange({ ...settings, overrides });
  };
  const nOverrides = Object.keys(settings.overrides).length;
  return (
    <div style={{ marginBottom: 14, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: 0, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#546e7a", textTransform: "uppercase", letterSpacing: 0.5 }}>Advanced {nOverrides > 0 && <span style={{ color: "#1e88e5" }}>· {nOverrides} changed</span>}</span>
        <span style={{ color: "#90a4ae" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={field}>
            <div style={label}>PUE: <b>{settings.pue.toFixed(2)}</b></div>
            <input type="range" min={1.05} max={1.8} step={0.01} value={settings.pue} onChange={(e) => onChange({ ...settings, pue: Number(e.target.value) })} style={{ width: "100%" }} />
            <div style={hint}>Total power ÷ IT power. Hyperscale runs 1.1–1.3; older sites 1.5+.</div>
          </div>
          <div style={field}>
            <div style={label}>Cost per MW</div>
            <input type="number" min={2e6} max={20e6} step={1e5} value={settings.capexPerMw} onChange={(e) => onChange({ ...settings, capexPerMw: Number(e.target.value) })} style={num} />
            <div style={hint}>Headline capex is MW × this. Drives construction jobs and the tax base.</div>
          </div>
          <div style={field}>
            <div style={label}>PILOT payment, $/yr</div>
            <input type="number" min={0} step={1e5} value={settings.pilotAnnualUsd} onChange={(e) => onChange({ ...settings, pilotAnnualUsd: Number(e.target.value) })} style={num} />
            <div style={hint}>What the developer pays in lieu of the abated tax.</div>
          </div>
          <div style={field}>
            <div style={label}>Share of PILOT to schools: <b>{settings.pilotSchoolSharePct}%</b></div>
            <input type="range" min={0} max={100} step={5} value={settings.pilotSchoolSharePct} onChange={(e) => onChange({ ...settings, pilotSchoolSharePct: Number(e.target.value) })} style={{ width: "100%" }} />
          </div>

          <div style={{ ...label, marginTop: 14, marginBottom: 8 }}>Engine coefficients <span style={{ color: "#90a4ae" }}>— within their published range</span></div>
          {ADV_COEFS.map(({ key, label: l, why, step, fmt: f }) => {
            const m = COEFS[key];
            const lo = m.low ?? m.value, hi = m.high ?? m.value;
            const cur = settings.overrides[key] ?? m.value;
            const changed = settings.overrides[key] !== undefined;
            return (
              <div key={key} style={field}>
                <div style={{ ...label, display: "flex", justifyContent: "space-between" }}>
                  <span>{l}: <b style={{ color: changed ? "#1e88e5" : undefined }}>{f(cur)}</b></span>
                  {changed && <button type="button" onClick={() => setOv(key, undefined)} style={{ border: "none", background: "transparent", color: "#1e88e5", fontSize: 11, cursor: "pointer" }}>reset</button>}
                </div>
                <input type="range" min={lo} max={hi} step={step} value={cur} onChange={(e) => setOv(key, Number(e.target.value))} style={{ width: "100%" }} disabled={lo === hi} />
                <div style={hint}>{why} Published {f(m.value)}, range {f(lo)}–{f(hi)}.</div>
              </div>
            );
          })}
        </div>
      )}
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

// Tiny trend line across all years, with a dot at the current (fractional) point in time
function Sparkline({ series, t, color }: { series: number[]; t: number; color: string }) {
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
      <circle cx={x(t)} cy={y(interpSeries(series, t))} r={2.6} fill={color} />
    </svg>
  );
}

function Dot({ tier }: { tier: Tier }) {
  return (
    <span
      title={TIER[tier].text}
      aria-label={tier}
      style={{ width: 7, height: 7, borderRadius: 4, background: TIER[tier].color, flexShrink: 0, display: "inline-block" }}
    />
  );
}

// One metric row: trust dot, label, sparkline across all years, animated value at
// the current month. In "total" mode flows show their running sum; stocks show
// the current level and are marked "now".
function Row({ def, results, t, mode }: { def: MetricDef; results: YearResult[]; t: number; mode: ViewMode }) {
  const useTotal = mode === "total" && !!def.total;
  const series = useMemo(() => metricSeries(results, def, useTotal ? "total" : "year").p50, [results, def, useTotal]);
  const fmtFn = useTotal && def.total ? def.total.format : def.format;
  const text = useTotal && def.total ? def.total.label : def.label;
  const now = mode === "total" && !def.total; // a stock, not a flow: same number in both modes
  const color = SECTIONS[def.section].color;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 3, opacity: now ? 0.75 : 1 }}>
      <Dot tier={def.tier} />
      <span style={{ color: "#546e7a", flex: 1 }} title={def.about}>
        {text}
        {now && <span style={{ fontSize: 10, color: "#90a4ae", marginLeft: 5 }}>now</span>}
      </span>
      <Sparkline series={series} t={t} color={color} />
      <span style={{ fontWeight: 700, whiteSpace: "nowrap", minWidth: 74, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        <AnimatedNumber value={interpSeries(series, t)} format={fmtFn} />
      </span>
    </div>
  );
}

const B = ({ children }: { children: ReactNode }) => <b style={{ color: "#263238" }}>{children}</b>;

function noiseWord(dba: number) {
  if (dba < 45) return "a quiet neighborhood at night";
  if (dba < 55) return "a quiet office";
  if (dba < 65) return "normal conversation";
  if (dba < 75) return "a busy road";
  return "loud — like heavy traffic";
}

// One paragraph that says what the town gets and gives up. This is the answer the
// numbers below support.
function Verdict({ results, builtBy, moratoriumRate, settings }: { results: YearResult[]; builtBy: number | null; moratoriumRate: number; settings: Settings }) {
  const last = results[results.length - 1];
  const sum = (g: (r: YearResult) => number) => results.reduce((s, r) => s + g(r), 0);
  const perm = Math.round(last.jobs.permanent_fte.value);
  const constr = Math.round(sum((r) => r.jobs.construction_fte.value));
  const pilot = sum((r) => r.fiscal.pilot_received_usd.value);
  const forgone = sum((r) => r.fiscal.property_tax_forgone_usd.value);
  const perPupilNow = last.fiscal.net_per_pupil_delta_usd.value;
  const billYr = last.ratepayer.household_bill_delta_usd_month.value * 12;
  const billCum = sum((r) => r.ratepayer.household_bill_delta_usd_month.value * 12);
  const acres = Math.round(last.land.acres_converted.value);
  const noise = last.nuisance.noise_dba_at_nearest_residence.value;
  return (
    <div style={{ fontSize: 13, lineHeight: 1.5, color: "#455a64", background: "rgba(30,136,229,0.07)", border: "1px solid rgba(30,136,229,0.18)", borderRadius: 10, padding: "10px 12px", margin: "10px 0 12px" }}>
      <div style={{ ...stepTag, color: "#1e88e5", marginBottom: 4 }}>By {YEAR_END}, built as set{builtBy ? ` and fully open by ${builtBy}` : ""}</div>
      The town gets <B>{fmt(perm)} permanent jobs</B> and <B>{fmt(constr)} job-years of construction</B>.
      Schools receive <B>{money(pilot)}</B> in payments while the tax break forgives <B>{money(forgone)}</B>; per student that nets to <B>{perPupilNow >= 0 ? "+" : ""}{money(perPupilNow)}/yr</B>
      {settings.abatementYears <= YEAR_END - YEAR_START ? " once the break expires" : ""}.
      Each household pays about <B>${fmt(billYr)}/yr</B> more for electricity, <B>{money(billCum)}</B> over the run.
      <B>{fmt(acres)} acres</B> of land become data center. At the nearest home it sounds like <B>{noiseWord(noise)}</B> ({fmt(noise)} dBA).
      {moratoriumRate >= 0.1 && (
        <>
          {" "}In <B>{Math.round(moratoriumRate * 100)}%</B> of runs, local opposition over bills stops it from expanding further.
        </>
      )}
      <div style={{ fontSize: 11, color: "#90a4ae", marginTop: 6 }}>Every number is the change from having no data center. Dots show how solid each one is — hover them.</div>
    </div>
  );
}

// Getters live outside the component so the trend lines don't recompute every render
export function ImpactsPanel({
  results,
  t,
  timeLabel,
  status,
  homesInZone,
  otherTown,
  moratoriumRate,
  builtBy,
  settings,
  onOpenAnalytics,
}: {
  results: YearResult[];
  t: number; // fractional index into results (months / 12)
  timeLabel: string;
  status: string;
  homesInZone: number;
  otherTown: boolean; // the engine's baseline (schools, water plant, taxes) is Wilmington's
  moratoriumRate: number; // share of Monte Carlo runs in which opposition stops expansion
  builtBy: number | null;
  settings: Settings;
  onOpenAnalytics?: () => void;
}) {
  const r = useMemo(() => interpResult(results, t), [results, t]);
  const [mode, setMode] = useState<ViewMode>("year");
  const tab = (m: ViewMode, text: string) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid " + (mode === m ? "#1e88e5" : "#cfd8dc"), background: mode === m ? "#1e88e5" : "white", color: mode === m ? "white" : "#546e7a", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
    >
      {text}
    </button>
  );
  return (
    <div style={{ ...panel, top: 78, left: 16, width: 340, padding: 16, maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div style={stepTag}>3 · Impacts</div>
          <div style={{ fontSize: 18, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>{timeLabel}</div>
        </div>
        <div style={{ fontSize: 12, color: "#607d8b", textAlign: "right", paddingBottom: 3 }}>{status}</div>
      </div>

      <Verdict results={results} builtBy={builtBy} moratoriumRate={moratoriumRate} settings={settings} />

      {otherTown && (
        <div style={{ fontSize: 11, color: "#ef6c00", background: "#fff3e0", borderRadius: 6, padding: "4px 8px", margin: "0 0 10px" }}>
          Baseline is Wilmington, Ohio&apos;s. School, water and tax figures use its numbers until this town has its own.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
        {tab("year", "This year")}
        {tab("total", "Total so far")}
        <span style={{ fontSize: 11, color: "#90a4ae", marginLeft: 4, flex: 1 }}>{mode === "total" ? "running sums through " + timeLabel : "rates in " + timeLabel}</span>
        {onOpenAnalytics && (
          <button type="button" onClick={onOpenAnalytics} title="Full-size charts for every number, with ranges and a table" style={{ padding: "3px 9px", borderRadius: 6, border: "1px solid #cfd8dc", background: "white", color: "#1e88e5", fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
            Analytics ↗
          </button>
        )}
      </div>

      {r.active_mw < 0.5 && mode === "year" ? (
        <div style={{ fontSize: 13, color: "#546e7a", margin: "0 0 12px" }}>Nothing running yet — press play, or drag the timeline.</div>
      ) : null}

      {SECTION_ORDER.map((sid) => (
        <Section key={sid} title={SECTIONS[sid].title} color={SECTIONS[sid].color}>
          {METRICS.filter((d) => d.section === sid).map((d) => (
            <Row key={d.id} def={d} results={results} t={t} mode={mode} />
          ))}
          {sid === "noise" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <Dot tier="assumed" />
              <span style={{ color: "#546e7a", flex: 1 }}>Buildings in the loud zone</span>
              <span style={{ fontWeight: 700 }}>
                <AnimatedNumber value={homesInZone} format={(n) => fmt(Math.round(n))} />
              </span>
            </div>
          )}
        </Section>
      ))}
    </div>
  );
}

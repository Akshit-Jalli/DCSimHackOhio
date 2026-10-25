"use client";
// Full-screen analytics: every number the side panel shows small, drawn large
// over the whole horizon with its p10–p90 band, plus the engine's internal
// ledgers (state aid, sewer load, farms, opposition) that explain them. One
// time control scopes every chart; a table view and CSV copy keep every value
// reachable without hovering.
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { N_DRAWS, type YearRow } from "../sim/engine";
import { YEAR_START, type Preset, type Settings } from "../sim/presets";
import { interpSeries, monthLabel } from "../sim/interp";
import { YearBar, panel } from "./Panels";
import { DEEP, METRICS, SECTIONS, SECTION_ORDER, TIER, deepSeries, fmt, metricSeries, type Band, type DeepDef, type MetricDef, type SectionId, type ViewMode } from "./metrics";
import coefficientsJson from "../../lib/data/coefficients.json";

type View = ViewMode | "table";

const INK = "#263238";
const INK2 = "#546e7a";
const MUTED = "#90a4ae";
const GRID = "#e3e8eb";
const SURFACE = "#ffffff";

const COOLING: Record<string, string> = { closed_loop_air: "air-cooled", hybrid: "hybrid cooling", evaporative: "evaporative cooling" };
const WATER: Record<string, string> = { municipal: "city water", onsite_wells: "on-site wells" };
const MORATORIUM_THRESHOLD = (coefficientsJson as unknown as Record<string, { value: number }>).moratorium_threshold?.value;

// ---------------- sizing ----------------

function useWidth<T extends HTMLElement>(fallback: number): [React.RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cw = entries[0]?.contentRect.width;
      if (cw && Math.abs(cw - w) > 0.5) setW(cw);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [w]);
  return [ref, w];
}

// ---------------- scales ----------------

function niceTicks(min: number, max: number, n = 4): number[] {
  if (!isFinite(min) || !isFinite(max)) return [0, 1];
  const span = max - min || Math.abs(max) || 1;
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.abs(v) < step / 1e6 ? 0 : v);
  return out;
}

function tickFmt(v: number, span: number): string {
  if (Math.abs(v) >= 1e4) return fmt(v);
  if (span < 1) return v.toFixed(2);
  if (span < 10) return v.toFixed(1);
  return fmt(v, 0);
}

// ---------------- the chart ----------------

function Chart({
  years,
  band,
  tIdx,
  mark,
  format,
  refLine,
  title,
}: {
  years: number[];
  band: Band; // lo/hi equal to p50 when there is no range
  tIdx: number; // fractional index of the current month
  mark: string;
  format: (n: number) => string;
  refLine?: { value: number; label: string };
  title: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>(340);
  const [hover, setHover] = useState<number | null>(null);
  const n = years.length;
  const H = 170;
  const m = { top: 12, right: 16, bottom: 22, left: 50 };
  const iw = Math.max(40, width - m.left - m.right);
  const ih = H - m.top - m.bottom;

  const hasBand = band.lo.some((v, i) => v !== band.p50[i]) || band.hi.some((v, i) => v !== band.p50[i]);
  const data = [...band.lo, ...band.hi, ...band.p50, ...(refLine ? [refLine.value] : [])];
  const dMin = Math.min(...data);
  const dMax = Math.max(...data);
  // A level that moves a little (farms 788 -> 769, sewer 99% -> 100%) is invisible on
  // a zero-based axis. Lines may start above zero; the axis then says so.
  const zoomed = dMin > 0 && dMax - dMin < 0.25 * dMax && dMax - dMin > 0;
  const ticks = niceTicks(zoomed ? dMin : Math.min(0, dMin), Math.max(zoomed ? dMax : Math.max(0, dMax), zoomed ? dMax : 0));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const span = yMax - yMin || 1;
  const x = (i: number) => m.left + (i / Math.max(1, n - 1)) * iw;
  const y = (v: number) => m.top + ih - ((v - yMin) / span) * ih;

  const line = band.p50.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = hasBand
    ? band.hi.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ") +
      " " +
      [...band.lo].reverse().map((v, j) => `L${x(n - 1 - j).toFixed(1)},${y(v).toFixed(1)}`).join(" ") +
      " Z"
    : null;

  const ti = Math.min(n - 1, Math.max(0, tIdx));
  const tv = interpSeries(band.p50, ti);
  const hi = hover;
  const showEnd = hi === null && n - 1 - ti > 1.2;

  const onMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - m.left) / iw) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  };
  const onKey = (e: ReactKeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const cur = hi ?? Math.round(ti);
      setHover(Math.min(n - 1, Math.max(0, cur + (e.key === "ArrowLeft" ? -1 : 1))));
    } else if (e.key === "Escape") setHover(null);
  };

  const tip = hi !== null ? { year: years[hi], v: band.p50[hi], lo: band.lo[hi], hi: band.hi[hi], px: x(hi) } : null;
  const tipLeft = tip ? Math.min(width - 150, Math.max(0, tip.px - 70)) : 0;

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`${title}, ${years[0]} to ${years[n - 1]}. Now ${format(tv)}.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        style={{ display: "block", outline: "none", touchAction: "none", cursor: "crosshair" }}
      >
        {/* grid + y ticks */}
        {ticks.map((tk) => (
          <g key={tk}>
            <line x1={m.left} x2={m.left + iw} y1={y(tk)} y2={y(tk)} stroke={tk === 0 ? "#cfd8dc" : GRID} strokeWidth={1} />
            <text x={m.left - 6} y={y(tk) + 3} textAnchor="end" fontSize={10} fill={MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
              {tickFmt(tk, span)}
            </text>
          </g>
        ))}
        {zoomed && (
          <text x={m.left} y={m.top - 2} fontSize={9} fill={MUTED}>
            axis from {tickFmt(ticks[0], span)}
          </text>
        )}
        {/* x ticks every 5 years */}
        {years.map((yr, i) =>
          (yr - years[0]) % 5 === 0 ? (
            <text key={yr} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={10} fill={MUTED}>
              {yr}
            </text>
          ) : null
        )}
        {/* band */}
        {area && <path d={area} fill={mark} fillOpacity={0.12} />}
        {/* reference line (a threshold, so dashed on purpose) */}
        {refLine && (
          <g>
            <line x1={m.left} x2={m.left + iw} y1={y(refLine.value)} y2={y(refLine.value)} stroke="#e53935" strokeWidth={1} strokeDasharray="4 3" />
            <text x={m.left + iw} y={y(refLine.value) - 4} textAnchor="end" fontSize={10} fill={INK2}>
              {refLine.label}
            </text>
          </g>
        )}
        {/* line */}
        <path d={line} fill="none" stroke={mark} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {/* end label */}
        {showEnd && (
          <text x={x(n - 1) - 4} y={y(band.p50[n - 1]) - 8} textAnchor="end" fontSize={11} fill={INK2} fontWeight={600}>
            {format(band.p50[n - 1])}
          </text>
        )}
        {/* current month */}
        <line x1={x(ti)} x2={x(ti)} y1={m.top} y2={m.top + ih} stroke={MUTED} strokeWidth={1} />
        <circle cx={x(ti)} cy={y(tv)} r={4.5} fill={mark} stroke={SURFACE} strokeWidth={2} />
        {/* hover crosshair */}
        {tip && (
          <g>
            <line x1={tip.px} x2={tip.px} y1={m.top} y2={m.top + ih} stroke={INK2} strokeWidth={1} />
            <circle cx={tip.px} cy={y(tip.v)} r={4} fill={mark} stroke={SURFACE} strokeWidth={2} />
          </g>
        )}
      </svg>
      {tip && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: tipLeft,
            background: INK,
            color: "white",
            borderRadius: 8,
            padding: "6px 9px",
            fontSize: 12,
            pointerEvents: "none",
            boxShadow: "0 4px 14px rgba(0,0,0,0.18)",
            whiteSpace: "nowrap",
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 14 }}>{format(tip.v)}</div>
          <div style={{ color: "#cfd8dc" }}>
            <span style={{ display: "inline-block", width: 10, height: 2, background: mark, verticalAlign: "middle", marginRight: 6 }} />
            {tip.year}
            {hasBand && (
              <span>
                {" "}· range {format(tip.lo)} – {format(tip.hi)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- cards ----------------

const card: CSSProperties = {
  background: SURFACE,
  border: "1px solid rgba(0,0,0,0.06)",
  borderRadius: 14,
  padding: "14px 16px 12px",
  boxShadow: "0 2px 10px rgba(20,40,60,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
};

function TierChip({ tier }: { tier: keyof typeof TIER }) {
  return (
    <span title={TIER[tier].text} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: INK2 }}>
      <span style={{ width: 7, height: 7, borderRadius: 4, background: TIER[tier].color, display: "inline-block" }} />
      {tier}
    </span>
  );
}

function MetricCard({ def, results, years, tIdx, mode }: { def: MetricDef; results: YearRow[]; years: number[]; tIdx: number; mode: ViewMode }) {
  const useTotal = mode === "total" && !!def.total;
  const band = useMemo(() => metricSeries(results, def, useTotal ? "total" : "year"), [results, def, useTotal]);
  const f = useTotal && def.total ? def.total.format : def.format;
  const label = useTotal && def.total ? def.total.label : def.label;
  const ti = Math.min(years.length - 1, Math.max(0, tIdx));
  const now = interpSeries(band.p50, ti);
  const lo = interpSeries(band.lo, ti);
  const hi = interpSeries(band.hi, ti);
  const sec = SECTIONS[def.section];
  const stock = mode === "total" && !def.total;
  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>
          {label}
          {stock && <span style={{ fontSize: 10, color: MUTED, marginLeft: 6, fontWeight: 400 }}>level now</span>}
        </div>
        <TierChip tier={def.tier} />
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1 }}>{f(now)}</div>
        {(lo !== now || hi !== now) && (
          <div style={{ fontSize: 11, color: INK2 }}>
            range {f(lo)} – {f(hi)}
            {useTotal && <span style={{ color: MUTED }}> · sum of yearly bands, approx.</span>}
          </div>
        )}
      </div>
      <Chart years={years} band={band} tIdx={tIdx} mark={sec.mark} format={f} title={label} />
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{def.about}</div>
    </div>
  );
}

function DeepCard({ def, results, years, tIdx, mode }: { def: DeepDef; results: YearRow[]; years: number[]; tIdx: number; mode: ViewMode }) {
  const useTotal = mode === "total" && !!def.total;
  const s = useMemo(() => deepSeries(results, def, useTotal ? "total" : "year"), [results, def, useTotal]);
  const band = useMemo(() => ({ p50: s, lo: s, hi: s }), [s]);
  const f = useTotal && def.total ? def.total.format : def.format;
  const label = useTotal && def.total ? def.total.label : def.label;
  const ti = Math.min(years.length - 1, Math.max(0, tIdx));
  const now = interpSeries(s, ti);
  const sec = SECTIONS[def.section];
  const refLine = def.id === "backlash" && !useTotal && typeof MORATORIUM_THRESHOLD === "number" ? { value: MORATORIUM_THRESHOLD, label: "moratorium threshold" } : undefined;
  return (
    <div style={{ ...card, background: "#fafbfc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: INK }}>{label}</div>
        <span title="From the engine's nominal run. No Monte Carlo range on this one." style={{ fontSize: 11, color: INK2, border: "1px solid #cfd8dc", borderRadius: 10, padding: "1px 7px" }}>
          ledger · no range
        </span>
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: INK, lineHeight: 1 }}>{f(now)}</div>
      <Chart years={years} band={band} tIdx={tIdx} mark={sec.mark} format={f} refLine={refLine} title={label} />
      <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.4 }}>{def.about}</div>
    </div>
  );
}

// ---------------- table view ----------------

function SectionTable({ sid, results, years }: { sid: SectionId; results: YearRow[]; years: number[] }) {
  const defs = METRICS.filter((d) => d.section === sid);
  const deep = DEEP.filter((d) => d.section === sid);
  const bands = defs.map((d) => metricSeries(results, d, "year"));
  const deeps = deep.map((d) => deepSeries(results, d, "year"));
  const th: CSSProperties = { textAlign: "right", padding: "6px 10px", fontSize: 11, color: INK2, fontWeight: 700, borderBottom: `2px solid ${SECTIONS[sid].color}`, whiteSpace: "nowrap" };
  const td: CSSProperties = { textAlign: "right", padding: "4px 10px", fontSize: 12, color: INK, fontVariantNumeric: "tabular-nums", borderBottom: `1px solid ${GRID}`, whiteSpace: "nowrap" };
  return (
    <div style={{ ...card, padding: 0, overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: "left" }}>{SECTIONS[sid].title}</th>
            {defs.map((d) => (
              <th key={d.id} style={th} title={d.about}>
                {d.label}
                <div style={{ fontSize: 10, color: MUTED, fontWeight: 400 }}>p50 · p10–p90</div>
              </th>
            ))}
            {deep.map((d) => (
              <th key={d.id} style={th} title={d.about}>
                {d.label}
                <div style={{ fontSize: 10, color: MUTED, fontWeight: 400 }}>ledger</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((yr, i) => (
            <tr key={yr}>
              <td style={{ ...td, textAlign: "left", fontWeight: 700 }}>{yr}</td>
              {defs.map((d, k) => (
                <td key={d.id} style={td}>
                  {d.format(bands[k].p50[i])}
                  {(bands[k].lo[i] !== bands[k].p50[i] || bands[k].hi[i] !== bands[k].p50[i]) && (
                    <div style={{ fontSize: 10, color: MUTED }}>
                      {d.format(bands[k].lo[i])} – {d.format(bands[k].hi[i])}
                    </div>
                  )}
                </td>
              ))}
              {deep.map((d, k) => (
                <td key={d.id} style={td}>
                  {d.format(deeps[k][i])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function toCSV(results: YearRow[], years: number[]): string {
  const cols: string[] = ["year", "active_mw"];
  for (const d of METRICS) cols.push(`${d.id}_p50`, `${d.id}_p10`, `${d.id}_p90`);
  for (const d of DEEP) cols.push(d.id);
  const bands = METRICS.map((d) => metricSeries(results, d, "year"));
  const deeps = DEEP.map((d) => deepSeries(results, d, "year"));
  const rows = years.map((yr, i) => {
    const r: (number | string)[] = [yr, results[i].active_mw];
    bands.forEach((b) => r.push(b.p50[i], b.lo[i], b.hi[i]));
    deeps.forEach((s) => r.push(s[i]));
    return r.map((v) => (typeof v === "number" ? (Number.isInteger(v) ? String(v) : v.toPrecision(6)) : v)).join(",");
  });
  return [cols.join(","), ...rows].join("\n");
}

// ---------------- the view ----------------

export function Analytics({
  results,
  t,
  month,
  setMonth,
  playing,
  setPlaying,
  status,
  townName,
  otherTown,
  settings,
  preset,
  moratoriumRate,
  builtBy,
  onClose,
}: {
  results: YearRow[];
  t: number;
  month: number;
  setMonth: (m: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  status: string;
  townName: string;
  otherTown: boolean;
  settings: Settings;
  preset: Preset;
  moratoriumRate: number;
  builtBy: number | null;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>("year");
  const [copied, setCopied] = useState(false);
  const years = useMemo(() => results.map((r) => r.year), [results]);
  const mode: ViewMode = view === "total" ? "total" : "year";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copyCSV() {
    try {
      await navigator.clipboard.writeText(toCSV(results, years));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const tab = (v: View, text: string) => (
    <button
      type="button"
      onClick={() => setView(v)}
      style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid " + (view === v ? "#1e88e5" : "#cfd8dc"), background: view === v ? "#1e88e5" : "white", color: view === v ? "white" : INK2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
    >
      {text}
    </button>
  );
  const chip = (text: string) => (
    <span key={text} style={{ fontSize: 12, color: INK2, background: "white", border: "1px solid #e0e6ea", borderRadius: 999, padding: "3px 10px", whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
  const nOverrides = Object.keys(settings.overrides).length;
  const deal = [
    `${settings.mw} MW · ${preset.name}`,
    COOLING[settings.cooling] ?? settings.cooling,
    WATER[settings.waterSource] ?? settings.waterSource,
    `${settings.abatementPct}% abatement · ${settings.abatementYears} yrs`,
    settings.tariffHolds ? "large-load tariff" : "grid costs socialized",
    `PUE ${settings.pue.toFixed(2)}`,
    ...(nOverrides ? [`${nOverrides} coefficient${nOverrides > 1 ? "s" : ""} overridden`] : []),
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(238,242,245,0.97)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        overflowY: "auto",
        color: INK,
        fontFamily: panel.fontFamily,
      }}
    >
      <div style={{ maxWidth: 1440, margin: "0 auto", padding: "18px 20px 40px" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: INK2, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Analytics</div>
            <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{townName}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>{deal.map(chip)}</div>
            <div style={{ fontSize: 12, color: INK2, marginTop: 8 }}>
              {builtBy ? `Built out by ${builtBy}. ` : ""}
              Opposition halts expansion in <b>{Math.round(moratoriumRate * 100)}%</b> of runs.
              {otherTown && <span style={{ color: "#ef6c00" }}> Baseline values marked as defaults are Wilmington, Ohio&apos;s — see Town data.</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Back to the map (Esc)"
            style={{ ...panel, position: "relative", padding: "8px 14px", border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
          >
            <span style={{ fontSize: 16 }}>×</span> Back to map
          </button>
        </div>

        {/* one control row scopes every chart */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", margin: "16px 0 18px" }}>
          <YearBar month={month} setMonth={setMonth} playing={playing} setPlaying={setPlaying} status={status} />
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {tab("year", "This year")}
            {tab("total", "Total so far")}
            {tab("table", "Table")}
          </div>
          <button type="button" onClick={copyCSV} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cfd8dc", background: "white", color: INK2, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {copied ? "Copied" : "Copy CSV"}
          </button>
          <span style={{ fontSize: 11, color: MUTED }}>
            {view === "table" ? "Yearly values; small text is the p10–p90 range." : view === "total" ? `Running sums through ${monthLabel(YEAR_START, month)}; stocks show their level.` : `Rates in ${monthLabel(YEAR_START, month)}. Shaded band is p10–p90 over ${N_DRAWS} Monte Carlo draws.`}
          </span>
        </div>

        {/* body */}
        {view === "table" ? (
          <div style={{ display: "grid", gap: 14 }}>
            {SECTION_ORDER.map((sid) => (
              <SectionTable key={sid} sid={sid} results={results} years={years} />
            ))}
          </div>
        ) : (
          SECTION_ORDER.map((sid) => (
            <section key={sid} style={{ marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 10px" }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: SECTIONS[sid].color, display: "inline-block" }} />
                <h2 style={{ fontSize: 13, fontWeight: 800, color: INK2, textTransform: "uppercase", letterSpacing: 0.6, margin: 0 }}>{SECTIONS[sid].title}</h2>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14 }}>
                {METRICS.filter((d) => d.section === sid).map((d) => (
                  <MetricCard key={d.id} def={d} results={results} years={years} tIdx={t} mode={mode} />
                ))}
                {DEEP.filter((d) => d.section === sid).map((d) => (
                  <DeepCard key={d.id} def={d} results={results} years={years} tIdx={t} mode={mode} />
                ))}
              </div>
            </section>
          ))
        )}

        <div style={{ fontSize: 11, color: MUTED, lineHeight: 1.5, maxWidth: 820 }}>
          The model steps once a year; months are interpolated for display. The line is the median of the Monte Carlo draws, the band the 10th to 90th
          percentile. Ledger cards come from the single nominal run and carry no band. Trust dots: green solid, amber estimated, red assumed.
        </div>
      </div>
    </div>
  );
}

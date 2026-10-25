"use client";
import { useState } from "react";

// A live worked example of the same energy and emissions formulas the engine uses.
const LOAD_FACTOR = 0.55; // project assumption, see the Source Register
const LB_PER_MWH = 1757.4; // EPA eGRID2023, RFCW subregion, non baseload output emission rate
const TONNE_PER_LB = 0.000453592;

const PRESETS = [
  { name: "Enterprise", mw: 60 },
  { name: "Hyperscale", mw: 250 },
  { name: "AI campus", mw: 1000 },
];

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export default function FormulaDemo() {
  const [mw, setMw] = useState(250);
  const [pue, setPue] = useState(1.2);
  const mwh = mw * pue * 8760 * LOAD_FACTOR;
  const tonnes = mwh * LB_PER_MWH * TONNE_PER_LB;

  const rows = [
    { k: "IT load", v: `${mw} MW`, note: "you set this" },
    { k: "PUE", v: pue.toFixed(2), note: "total power ÷ IT power" },
    { k: "Hours per year", v: "8,760", note: "" },
    { k: "Load factor", v: String(LOAD_FACTOR), note: "planning assumption" },
  ];

  return (
    <div className="grid gap-10 md:grid-cols-2 md:gap-14">
      <div className="flex flex-col gap-7">
        <div>
          <label htmlFor="mw" className="mb-2 block text-sm text-[var(--muted)]">IT load, in megawatts</label>
          <input id="mw" type="range" min={20} max={1000} step={10} value={mw} onChange={(e) => setMw(+e.target.value)} className="w-full" />
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
            {PRESETS.map((pr) => (
              <button
                key={pr.name}
                onClick={() => setMw(pr.mw)}
                className={mw === pr.mw ? "text-[var(--ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-[6px]" : "text-[var(--muted)] hover:text-[var(--ink)]"}
              >
                {pr.name} {pr.mw} MW
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="pue" className="mb-2 block text-sm text-[var(--muted)]">PUE</label>
          <input id="pue" type="range" min={1.05} max={1.6} step={0.01} value={pue} onChange={(e) => setPue(+e.target.value)} className="w-full" />
        </div>
      </div>

      <div>
        <table className="lp-mono w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.k} className="border-b border-[var(--rule)]">
                <td className="py-2 text-[var(--muted)]">{r.k}</td>
                <td className="py-2 text-right tabular-nums">{r.v}</td>
                <td className="hidden py-2 pl-4 text-right text-xs text-[var(--muted)] sm:table-cell">{r.note}</td>
              </tr>
            ))}
            <tr className="border-b border-[var(--ink)]">
              <td className="py-3 font-medium">Energy per year</td>
              <td className="py-3 text-right font-medium tabular-nums" colSpan={2}>{fmt(mwh)} MWh</td>
            </tr>
            <tr className="border-b border-[var(--rule)]">
              <td className="py-2 text-[var(--muted)]">CO₂ rate at the margin</td>
              <td className="py-2 text-right tabular-nums" colSpan={2}>1,757.4 lb/MWh</td>
            </tr>
            <tr className="border-b border-[var(--ink)]">
              <td className="py-3 font-medium">CO₂ per year</td>
              <td className="py-3 text-right font-medium tabular-nums" colSpan={2}>{fmt(tonnes)} t</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-3 text-xs leading-relaxed text-[var(--muted)]">Rate from EPA eGRID2023, RFCW subregion, non baseload output emission rate (tier A). In the simulator each input links to its source.</p>
      </div>
    </div>
  );
}

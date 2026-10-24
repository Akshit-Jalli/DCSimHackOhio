"use client";
import { useEffect, useMemo, useState } from "react";
import Scene from "./Scene";
import Levers from "./Levers";
import Kpis from "./Kpis";
import { AS_PROPOSED, keyOf, loadSweep, type Overrides, type SweepIndex } from "../lib/engine";

export default function Dashboard() {
  const [index, setIndex] = useState<SweepIndex | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levers, setLevers] = useState<Overrides>(AS_PROPOSED);

  useEffect(() => {
    let cancelled = false;
    loadSweep()
      .then((ix) => { if (!cancelled) setIndex(ix); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); });
    return () => { cancelled = true; };
  }, []);

  const key = useMemo(() => keyOf(levers), [levers]);
  const point = index?.byKey.get(key);
  const onFrontier = index?.frontierKeys.has(key) ?? false;
  const isProposed = key === keyOf(AS_PROPOSED);

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Teammate's 3D placement scene, untouched. */}
      <Scene />

      {/* Engine panel overlays the right edge. */}
      <aside className="absolute right-4 top-4 flex max-h-[calc(100vh-2rem)] w-[380px] flex-col gap-5 overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-950/90 p-4 text-neutral-100 shadow-xl backdrop-blur">
        <header className="flex flex-col gap-0.5">
          <h1 className="text-base font-semibold">Wilmington · AWS campus</h1>
          <p className="text-[11px] text-neutral-500">
            1488 S US 68 · 471.6 ac · Clinton County · AES Ohio, PJM DAY zone
          </p>
        </header>

        {error && <p className="text-sm text-red-400">Could not load engine output: {error}</p>}
        {!index && !error && <p className="text-sm text-neutral-500">Loading sweep…</p>}

        {index && (
          <>
            <Levers index={index} value={levers} onChange={setLevers} />
            <Kpis
              point={point}
              onFrontier={onFrontier}
              isProposed={isProposed}
              baseline={index.sweep.as_proposed.kpis}
            />
            {!isProposed && (
              <button
                type="button"
                onClick={() => setLevers(AS_PROPOSED)}
                className="self-start text-xs text-sky-400 hover:underline"
              >
                ← back to the deal as proposed
              </button>
            )}
            <footer className="text-[11px] text-neutral-600">
              {index.sweep.n_points.toLocaleString()} lever combinations · {index.sweep.pareto_frontier.size} Pareto-optimal ·{" "}
              {index.sweep.as_proposed.is_pareto_dominated ? "proposed deal is dominated" : "proposed deal is on the frontier"}
            </footer>
          </>
        )}
      </aside>
    </div>
  );
}

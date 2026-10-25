"use client";
import Image from "next/image";
import { useState } from "react";
import simDay from "@/public/landing/sim-day.jpg";
import ImpactTabs from "./ImpactTabs";
import FormulaDemo from "./FormulaDemo";

const TABS = [
  { key: "map", label: "The map" },
  { key: "impacts", label: "What it measures" },
  { key: "math", label: "Worked example" },
] as const;

export default function ProductViews() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("map");

  return (
    <div>
      <div role="tablist" aria-label="Product views" className="mb-6 flex flex-wrap gap-x-7 gap-y-2 border-b border-[var(--rule)] text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 pb-3 ${tab === t.key ? "border-[var(--ink)] text-[var(--ink)]" : "border-transparent text-[var(--muted)] hover:text-[var(--ink)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "map" && (
        <figure>
          <div className="border border-[var(--rule)] bg-[#e4e2d8]">
            <Image
              src={simDay}
              alt="The simulator showing a 250 MW data center placed on farmland outside Wilmington, with its noise zone, new power line and the impacts panel for 2031"
              placeholder="blur"
              sizes="(max-width: 1280px) 100vw, 1200px"
              className="h-auto w-full"
            />
          </div>
          <figcaption className="lp-mono mt-3 text-xs text-[var(--muted)]">
            Fig. 1. A 250 MW campus outside Wilmington in 2031. The impact numbers in this capture are demo values until the engine is connected.
          </figcaption>
        </figure>
      )}
      {tab === "impacts" && <ImpactTabs />}
      {tab === "math" && <FormulaDemo />}
    </div>
  );
}

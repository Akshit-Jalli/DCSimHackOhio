"use client";
import { useState } from "react";

// What the simulator measures, and how. Keep every claim here backed by the Source Register.
const IMPACTS = [
  {
    key: "water",
    label: "Water",
    question: "Can the town's water and sewer plants handle it?",
    how: "Daily water use depends on the cooling type you pick. The simulator compares it to the town's treatment capacity, including the sewer plant, which is often the tighter limit.",
    source: "Ohio EPA discharge permits and utility capacity records",
  },
  {
    key: "power",
    label: "Power bills",
    question: "What happens to everyone else's electric bill?",
    how: "Applies a published estimate of how large data center load changes residential rates, using the coefficient for investor owned utilities when the local utility is one.",
    source: "Published estimates, graded by tier",
  },
  {
    key: "schools",
    label: "Schools and taxes",
    question: "Do the schools come out ahead?",
    how: "Only real property is taxed, and the servers are not. The simulator runs the abatement and PILOT terms you set through the state school funding formula, year by year, so you see what a district gains and what state aid it loses.",
    source: "State funding formula data and the deal's own terms",
  },
  {
    key: "noise",
    label: "Noise",
    question: "Who lives close enough to hear it?",
    how: "Draws the noise zone around your site and counts the homes inside it, checked against the city's day and night limits and the setback you choose.",
    source: "Local noise ordinance and setback rules",
  },
  {
    key: "land",
    label: "Land",
    question: "What gets paved over?",
    how: "Measures the acres the campus covers on the real map and what was there before: fields, forest, or buildings.",
    source: "Overture Maps buildings and land cover",
  },
  {
    key: "jobs",
    label: "Jobs",
    question: "How many jobs, and for how long?",
    how: "Separates the construction surge from the permanent staff, and shows the ripple effect as a range, because published multipliers vary widely.",
    source: "Industry figures shown as claims, checked against independent studies",
  },
];

export default function ImpactTabs() {
  const [active, setActive] = useState(IMPACTS[0].key);
  const item = IMPACTS.find((x) => x.key === active)!;

  return (
    <div className="grid gap-8 md:grid-cols-[200px_1fr] md:gap-12">
      <div role="tablist" aria-label="Impacts" className="flex flex-wrap gap-x-5 gap-y-2 md:flex-col md:gap-0">
        {IMPACTS.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={x.key === active}
            onClick={() => setActive(x.key)}
            className={`text-left text-sm md:border-b md:border-[var(--rule)] md:py-2.5 ${x.key === active ? "text-[var(--ink)] underline decoration-[var(--accent)] decoration-2 underline-offset-[6px] md:no-underline md:font-medium" : "text-[var(--muted)] hover:text-[var(--ink)]"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="min-h-[240px]">
        <h3 className="lp-serif text-[28px] leading-[1.15] md:text-[34px]">{item.question}</h3>
        <p className="mt-4 max-w-2xl leading-relaxed text-[var(--muted)]">{item.how}</p>
        <p className="lp-mono mt-6 border-t border-[var(--rule)] pt-3 text-xs text-[var(--muted)]">Source: {item.source}</p>
      </div>
    </div>
  );
}

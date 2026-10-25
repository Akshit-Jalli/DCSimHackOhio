"use client";
import type { Band, FactKey } from "./content";
import { about, HOURS_PER_YEAR, type Facts } from "./facts";
import { FONT, INK, MUTED } from "./ui";

const older = (b: Band) => b === "6-8" || b === "9-12";

// Big number at the top of the screen, worked out from the data center's size.
// Older bands also see the math; everyone sees where the per-home number comes from.
export function FactCard({ fact, facts, band, source }: { fact: FactKey; facts: Facts; band: Band; source?: string }) {
  const n = (v: number) => v.toLocaleString("en-US");
  const card =
    fact === "homes"
      ? {
          icon: "🏠",
          big: `≈ ${about(facts.homes)}`,
          label: older(band) ? "homes' worth of electricity, if it runs at full power all year" : "homes' worth of electricity",
          math: `${n(facts.mw)} MW × ${n(HOURS_PER_YEAR)} hours = ${n(Math.round(facts.mwh))} MWh a year ÷ ${n(facts.homeMWh)} MWh per home`,
        }
      : fact === "mwh"
        ? { icon: "⚡", big: `${n(Math.round(facts.mwh))} MWh`, label: "of electricity a year at full power", math: `${n(facts.mw)} MW × ${n(HOURS_PER_YEAR)} hours in a year` }
        : { icon: "⚡", big: `${n(facts.mw)} MW`, label: "of power, day and night", math: "" };

  return (
    <div
      role="status"
      style={{
        position: "fixed",
        top: 18,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 20,
        background: "#ffffff",
        borderRadius: 24,
        padding: "16px 26px",
        boxShadow: "0 10px 30px rgba(20,40,60,0.22)",
        border: "3px solid #ffe082",
        fontFamily: FONT,
        color: INK,
        textAlign: "center",
        maxWidth: "min(620px, calc(100vw - 260px))",
        animation: "dcfact-in 0.35s ease-out",
      }}
    >
      <style>{`@keyframes dcfact-in { from { opacity: 0; transform: translate(-50%, -12px) } to { opacity: 1; transform: translate(-50%, 0) } } @media (prefers-reduced-motion: reduce) { [role=status] { animation: none !important } }`}</style>
      <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>
        {card.icon} {card.big}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color: MUTED, marginTop: 2, textWrap: "balance" }}>{card.label}</div>
      {older(band) && card.math && <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{card.math}</div>}
      {fact === "homes" && source && <div style={{ fontSize: 13, color: MUTED, marginTop: 8, textWrap: "balance" }}>Source: {source}</div>}
    </div>
  );
}

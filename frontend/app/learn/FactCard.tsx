"use client";
import type { Band, FactKey } from "./content";
import { about, HOURS_PER_YEAR, type Facts } from "./facts";
import { FONT, INK, MUTED } from "./ui";

const older = (b: Band) => b === "6-8" || b === "9-12";

// Big number at the top of the screen, worked out from the data center's size.
// Older bands also see the math; everyone sees where the outside numbers come from.
export function FactCard({ fact, facts, band, sources }: { fact: FactKey; facts: Facts; band: Band; sources: string[] }) {
  const n = (v: number) => v.toLocaleString("en-US");
  let card: { icon: string; big: string; label: string; math: string; extra?: string };
  if (fact === "homes") {
    card = {
      icon: "🏠",
      big: `≈ ${about(facts.homes)}`,
      label: older(band) ? "homes' worth of electricity, if it runs at full power all year" : "homes' worth of electricity",
      math: `${n(facts.mw)} MW × ${n(HOURS_PER_YEAR)} hours = ${n(Math.round(facts.mwh))} MWh a year ÷ ${n(facts.homeMWh)} MWh per home`,
    };
  } else if (fact === "water" && facts.gallonsPerDay != null) {
    const extra = [facts.bathtubs != null && `≈ ${about(facts.bathtubs)} bathtubs`, facts.people != null && `home water for ≈ ${about(facts.people)} people`].filter(Boolean).join(" · ");
    card = older(band)
      ? {
          icon: "💧",
          big: `≈ ${about(facts.gallonsPerDay)} gallons a day`,
          label: "of water evaporated, if all its heat left by evaporating water",
          math: `${n(facts.mw)} MW × 24 hours = ${n(facts.mw * 1000 * 24)} kWh of heat a day ÷ ${facts.kWhPerGallon!.toFixed(2)} kWh per gallon evaporated`,
          extra,
        }
      : {
          icon: "🛁",
          big: `≈ ${about(facts.bathtubs ?? 0)} bathtubs`,
          label: "of water evaporated every day, if it cooled only with water",
          math: "",
          extra: facts.people != null ? `That's as much as ≈ ${about(facts.people)} people use at home.` : "",
        };
  } else if (fact === "mwh") {
    card = { icon: "⚡", big: `${n(Math.round(facts.mwh))} MWh`, label: "of electricity a year at full power", math: `${n(facts.mw)} MW × ${n(HOURS_PER_YEAR)} hours in a year` };
  } else {
    card = { icon: "⚡", big: `${n(facts.mw)} MW`, label: "of power, day and night", math: "" };
  }

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
        maxWidth: "min(640px, calc(100vw - 260px))",
        animation: "dcfact-in 0.35s ease-out",
      }}
    >
      <style>{`@keyframes dcfact-in { from { opacity: 0; transform: translate(-50%, -12px) } to { opacity: 1; transform: translate(-50%, 0) } } @media (prefers-reduced-motion: reduce) { [role=status] { animation: none !important } }`}</style>
      <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1.1 }}>
        {card.icon} {card.big}
      </div>
      <div style={{ fontSize: 19, fontWeight: 700, color: MUTED, marginTop: 2, textWrap: "balance" }}>{card.label}</div>
      {card.extra && <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{card.extra}</div>}
      {older(band) && card.math && <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>{card.math}</div>}
      {sources.map((s) => (
        <div key={s} style={{ fontSize: 13, color: MUTED, marginTop: 6, textWrap: "balance" }}>
          Source: {s}
        </div>
      ))}
    </div>
  );
}

"use client";
// One resident's profile and what this year of the deal means for them.
import type { CSSProperties } from "react";
import { panel } from "./Panels";
import type { Person } from "../sim/population";
import type { PersonImpact } from "../sim/personImpact";

const usd = (n: number) => (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
const signed = (n: number) => (n >= 0 ? "+" : "-") + "$" + Math.abs(Math.round(n)).toLocaleString("en-US");

export function ResidentCard({
  person,
  impact,
  year,
  left,
  onClose,
  onAnother,
}: {
  person: Person;
  impact: PersonImpact;
  year: number;
  left: number;
  onClose: () => void;
  onAnother: () => void;
}) {
  const small: CSSProperties = { fontSize: 11, color: "#607d8b" };
  const fact = (k: string, v: string) => (
    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "2px 0" }}>
      <span style={{ color: "#607d8b" }}>{k}</span>
      <span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
    </div>
  );
  const hasDeal = impact.lines.length > 0 || impact.noise || impact.job.text;
  return (
    <div style={{ ...panel, top: 78, left, width: 330, padding: 16, zIndex: 11, maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: person.color, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 800, fontSize: 16 }}>
            {person.name.split(" ").map((w) => w[0]).join("")}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.1 }}>{person.name}</div>
            <div style={small}>
              {person.age} · {person.occupation.label}
            </div>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#607d8b" }}>
          ×
        </button>
      </div>

      {person.traits.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, margin: "10px 0 8px" }}>
          {person.traits.map((t) => (
            <span key={t} style={{ fontSize: 11, color: "#455a64", background: "rgba(0,0,0,0.05)", borderRadius: 999, padding: "2px 8px" }}>
              {t}
            </span>
          ))}
        </div>
      )}

      <div style={{ margin: "6px 0 10px" }}>
        {fact("Household income", `${usd(person.income)}/yr`)}
        {fact("Home", `${person.tenure === "rent" ? "Rents" : "Owns"} · ${person.householdSize} ${person.householdSize === 1 ? "person" : "people"}`)}
        {fact("Electricity use", `${person.kwhPerMonth.toLocaleString("en-US")} kWh/mo`)}
        {impact.noise && fact("Distance to the site", impact.noise.distanceM >= 1000 ? `${(impact.noise.distanceM / 1000).toFixed(1)} km` : `${Math.round(impact.noise.distanceM)} m`)}
      </div>

      <div style={{ borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
        <div style={{ fontSize: 11, color: "#607d8b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{hasDeal ? `For this household in ${year}` : "The deal"}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#263238", margin: "4px 0 8px", lineHeight: 1.35 }}>{impact.headline}</div>

        {impact.lines.map((l) => (
          <div key={l.label} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, padding: "3px 0", borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            <div>
              <div style={{ color: "#37474f" }}>{l.label}</div>
              {l.note && <div style={small}>{l.note}</div>}
            </div>
            <div style={{ fontWeight: 700, color: l.usd >= 0 ? "#2e7d32" : "#c62828", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{signed(l.usd)}/yr</div>
          </div>
        ))}
        {impact.lines.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0 2px", borderTop: "1px solid rgba(0,0,0,0.1)", fontWeight: 800 }}>
            <span>Net this year</span>
            <span style={{ color: impact.netUsdYr >= 0 ? "#2e7d32" : "#c62828", fontVariantNumeric: "tabular-nums" }}>{signed(impact.netUsdYr)}</span>
          </div>
        )}

        {hasDeal && impact.job.text && (
          <div style={{ ...small, marginTop: 8, lineHeight: 1.4 }}>
            <b style={{ color: impact.job.kind ? "#2e7d32" : "#455a64" }}>{impact.job.text}.</b> {impact.job.odds}
          </div>
        )}
        {hasDeal && impact.schools && (
          <div style={{ ...small, marginTop: 6, lineHeight: 1.4 }}>
            Their school: <b style={{ color: impact.schools.perPupilUsd >= 0 ? "#2e7d32" : "#c62828" }}>{signed(impact.schools.perPupilUsd)} per student</b> this year, × {impact.schools.kids} {impact.schools.kids === 1 ? "kid" : "kids"}.
          </div>
        )}
        {impact.noise && (
          <div style={{ ...small, marginTop: 6, lineHeight: 1.4 }}>
            At home it sounds like <b style={{ color: impact.noise.dba >= 55 ? "#c62828" : "#455a64" }}>{impact.noise.word}</b> ({Math.round(impact.noise.dba)} dBA).
          </div>
        )}
        {impact.farm && impact.farm.farmsLost > 0 && (
          <div style={{ ...small, marginTop: 6, lineHeight: 1.4 }}>
            The county has lost <b>{impact.farm.farmsLost}</b> farms since 2026.
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <button type="button" onClick={onAnother} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #cfd8dc", background: "white", color: "#1e88e5", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          Another resident
        </button>
        <span style={{ ...small, textAlign: "right", maxWidth: 170, lineHeight: 1.3 }}>Synthetic resident drawn from county distributions. Not a real person.</span>
      </div>
    </div>
  );
}

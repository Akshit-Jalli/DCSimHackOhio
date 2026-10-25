"use client";
// Make your own resident: pick a job, income, home, household and traits, then
// place them on the map. They walk the streets like everyone else and their
// card reads the same engine row, so you can see the deal land on *you*.
import { useState } from "react";
import type { CSSProperties } from "react";
import { panel } from "./Panels";
import { OCCUPATIONS, TRAIT_OPTIONS, defaultKwh, type CharacterSpec } from "../sim/population";

const SHIRTS = ["#e53935", "#1e88e5", "#43a047", "#fb8c00", "#8e24aa", "#00acc1", "#f4511e", "#3949ab", "#7cb342", "#d81b60", "#546e7a", "#ffb300"];

export function CharacterForm({
  initial,
  picking,
  pickedHome,
  onPickHome,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: CharacterSpec | null; // editing an existing character, or null for a new one
  picking: boolean; // the map is waiting for a click to set the home
  pickedHome: [number, number] | null;
  onPickHome: () => void;
  onSave: (spec: CharacterSpec) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [spec, setSpec] = useState<CharacterSpec>(
    initial ?? {
      name: "",
      age: 34,
      occupationId: "warehouse",
      income: 38000,
      tenure: "rent",
      householdSize: 2,
      kidsInSchool: 0,
      farmAcresRented: 0,
      kwhPerMonth: defaultKwh(2, 38000),
      worksNights: false,
      traits: [],
      color: SHIRTS[1],
      home: null,
    }
  );
  // A building picked on the map wins over whatever the spec had; no state sync needed.
  const home = pickedHome ?? spec.home;

  const occ = OCCUPATIONS.find((o) => o.id === spec.occupationId) ?? OCCUPATIONS[0];
  const set = <K extends keyof CharacterSpec>(k: K, v: CharacterSpec[K]) => setSpec((s) => ({ ...s, [k]: v }));
  const label: CSSProperties = { fontSize: 11, color: "#607d8b", marginBottom: 3 };
  const input: CSSProperties = { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #cfd8dc", background: "white", fontSize: 13, boxSizing: "border-box" };
  const field: CSSProperties = { marginBottom: 10 };
  const ok = spec.name.trim().length > 0;

  return (
    <div style={{ ...panel, top: 78, left: 16, width: 360, padding: 16, zIndex: 12, maxHeight: "calc(100vh - 110px)", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: "#607d8b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>{initial ? "Edit your character" : "Create your character"}</div>
          <div style={{ fontSize: 12, color: "#455a64", marginTop: 2 }}>They live here, walk the streets, and the deal lands on them like everyone else.</div>
        </div>
        <button type="button" onClick={onCancel} aria-label="Close" style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#607d8b" }}>
          ×
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" }}>
        <div style={{ ...field, gridColumn: "1 / -1" }}>
          <div style={label}>Name</div>
          <input autoFocus value={spec.name} onChange={(e) => set("name", e.target.value)} placeholder="Your name" style={input} maxLength={40} />
        </div>
        <div style={field}>
          <div style={label}>Age</div>
          <input type="number" min={16} max={95} value={spec.age} onChange={(e) => set("age", Math.max(16, Math.min(95, Number(e.target.value) || 16)))} style={input} />
        </div>
        <div style={field}>
          <div style={label}>Shirt color</div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", paddingTop: 3 }}>
            {SHIRTS.map((c) => (
              <button key={c} type="button" onClick={() => set("color", c)} aria-label={c} style={{ width: 18, height: 18, borderRadius: 9, background: c, border: spec.color === c ? "3px solid #263238" : "2px solid white", boxShadow: "0 0 0 1px #cfd8dc", cursor: "pointer", padding: 0 }} />
            ))}
          </div>
        </div>
        <div style={{ ...field, gridColumn: "1 / -1" }}>
          <div style={label}>Occupation</div>
          <select
            value={spec.occupationId}
            onChange={(e) => {
              const o = OCCUPATIONS.find((x) => x.id === e.target.value) ?? OCCUPATIONS[0];
              const mid = Math.round((o.income[0] + o.income[1]) / 2 / 500) * 500;
              setSpec((s) => ({ ...s, occupationId: o.id, income: mid, kwhPerMonth: defaultKwh(s.householdSize, mid), farmAcresRented: o.id === "farmer_rent" ? Math.max(80, s.farmAcresRented) : 0 }));
            }}
            style={input}
          >
            {OCCUPATIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <div style={{ fontSize: 11, color: "#90a4ae", marginTop: 3 }}>
            Typical household income for this job here: ${occ.income[0].toLocaleString("en-US")}–${occ.income[1].toLocaleString("en-US")}.
            {["tech", "manufacturing", "logistics", "construction", "service", "public"].includes(occ.sector) ? " A data center hires from this field." : " A data center does not hire from this field."}
          </div>
        </div>
        <div style={field}>
          <div style={label}>Household income, $/yr</div>
          <input type="number" min={0} step={500} value={spec.income} onChange={(e) => set("income", Math.max(0, Number(e.target.value) || 0))} style={input} />
        </div>
        <div style={field}>
          <div style={label}>Home</div>
          <select value={spec.tenure} onChange={(e) => set("tenure", e.target.value as "rent" | "own")} style={input}>
            <option value="rent">Rents</option>
            <option value="own">Owns</option>
          </select>
        </div>
        <div style={field}>
          <div style={label}>People in the household</div>
          <input type="number" min={1} max={8} value={spec.householdSize} onChange={(e) => { const n = Math.max(1, Math.min(8, Number(e.target.value) || 1)); setSpec((s) => ({ ...s, householdSize: n, kwhPerMonth: defaultKwh(n, s.income) })); }} style={input} />
        </div>
        <div style={field}>
          <div style={label}>Kids in the city schools</div>
          <input type="number" min={0} max={6} value={spec.kidsInSchool} onChange={(e) => set("kidsInSchool", Math.max(0, Math.min(6, Number(e.target.value) || 0)))} style={input} />
        </div>
        {occ.id === "farmer_rent" && (
          <div style={{ ...field, gridColumn: "1 / -1" }}>
            <div style={label}>Cropland rented, acres</div>
            <input type="number" min={0} max={2000} step={20} value={spec.farmAcresRented} onChange={(e) => set("farmAcresRented", Math.max(0, Number(e.target.value) || 0))} style={input} />
          </div>
        )}
        <div style={field}>
          <div style={label}>Electricity use, kWh/mo</div>
          <input type="number" min={100} max={5000} step={10} value={spec.kwhPerMonth} onChange={(e) => set("kwhPerMonth", Math.max(100, Number(e.target.value) || 100))} style={input} />
        </div>
        <div style={{ ...field, display: "flex", alignItems: "flex-end", paddingBottom: 6 }}>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={spec.worksNights} onChange={(e) => set("worksNights", e.target.checked)} /> Works nights
          </label>
        </div>
      </div>

      <div style={field}>
        <div style={label}>Traits (pick up to 3)</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {TRAIT_OPTIONS.map((t) => {
            const on = spec.traits.includes(t);
            return (
              <button
                key={t}
                type="button"
                onClick={() => set("traits", on ? spec.traits.filter((x) => x !== t) : spec.traits.length < 3 ? [...spec.traits, t] : spec.traits)}
                style={{ fontSize: 11, borderRadius: 999, padding: "3px 9px", cursor: "pointer", border: on ? "1px solid #1e88e5" : "1px solid #cfd8dc", background: on ? "#e3f2fd" : "white", color: on ? "#0d47a1" : "#455a64" }}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <div style={field}>
        <div style={label}>Where they live</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" onClick={onPickHome} style={{ padding: "6px 12px", borderRadius: 8, border: picking ? "2px solid #1e88e5" : "1px solid #cfd8dc", background: picking ? "#e3f2fd" : "white", color: "#1e88e5", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            {picking ? "Click a building on the map…" : home ? "Pick a different building" : "Pick a building on the map"}
          </button>
          <span style={{ fontSize: 11, color: "#607d8b" }}>{home ? "Home set." : "Or leave it and we pick a house."}</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        <button type="button" disabled={!ok} onClick={() => onSave({ ...spec, home, name: spec.name.trim() })} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: ok ? "#2e7d32" : "#cfd8dc", color: "white", fontWeight: 700, fontSize: 13, cursor: ok ? "pointer" : "not-allowed" }}>
          {initial ? "Save" : "Add to town"}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #e57373", background: "white", color: "#c62828", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            Remove
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: "#90a4ae", marginTop: 8, lineHeight: 1.4 }}>Saved on this computer only. Everything on their card comes from the same engine row as every other resident.</div>
    </div>
  );
}

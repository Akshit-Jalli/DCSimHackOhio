"use client";
// Town Data: the values the engine actually reads for this town, each with
// where it came from and how much to trust it. Autofill asks the server for
// a profile; anything it can't fill stays editable here. Nothing runs on a
// value the user hasn't at least seen.
import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { panel } from "./Panels";
import { FIELDS, getPV, setPV, profileGaps, type Confidence, type Origin, type PV, type TownProfile } from "../sim/townProfile";

const CONF: Record<Confidence, string> = { high: "#43a047", medium: "#f9a825", low: "#e53935" };
const ORIGIN: Record<Origin, { text: string; color: string }> = {
  api: { text: "public data", color: "#1e88e5" },
  ai_search: { text: "AI search · review", color: "#8e24aa" },
  upload: { text: "from upload", color: "#00897b" },
  manual: { text: "entered", color: "#455a64" },
  default: { text: "Wilmington default", color: "#ef6c00" },
};

function fmtVal(v: number, unit: string) {
  if (!Number.isFinite(v)) return "—";
  if (unit === "$" || unit === "$/yr" || unit === "$/acre") return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (unit === "fraction") return v.toFixed(4);
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

type AutofillState = { kind: "idle" } | { kind: "busy" } | { kind: "done"; filled: number } | { kind: "unavailable"; message: string; needs: string[] } | { kind: "error"; message: string };

export function TownPanel({
  profile,
  onChange,
  onClose,
}: {
  profile: TownProfile;
  onChange: (p: TownProfile) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [auto, setAuto] = useState<AutofillState>({ kind: "idle" });
  const gaps = useMemo(() => profileGaps(profile), [profile]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof FIELDS>();
    for (const f of FIELDS) m.set(f.group, [...(m.get(f.group) ?? []), f]);
    return Array.from(m.entries());
  }, []);

  const commit = (key: string) => {
    const n = Number(draft.replace(/[$,\s]/g, ""));
    const pv = getPV(profile, key);
    if (Number.isFinite(n)) onChange(setPV(profile, key, { ...pv, value: n, origin: "manual", confidence: "medium", source: "entered by user" }));
    setEditing(null);
  };

  async function autofill() {
    setAuto({ kind: "busy" });
    try {
      const res = await fetch(`/api/town/${profile.slug}/profile`);
      const body = await res.json();
      if (res.ok && body.state === "ready" && body.profile) {
        onChange(body.profile as TownProfile);
        setAuto({ kind: "done", filled: FIELDS.length - profileGaps(body.profile as TownProfile).length });
      } else {
        setAuto({ kind: "unavailable", message: body.message ?? "No profile for this town yet.", needs: body.needs ?? [] });
      }
    } catch (e) {
      setAuto({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }

  const small: CSSProperties = { fontSize: 11, color: "#607d8b" };

  return (
    <div style={{ ...panel, top: 78, right: 16, width: 440, padding: 16, maxHeight: "calc(100vh - 110px)", overflowY: "auto", zIndex: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 11, color: "#607d8b", fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>Town data</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{profile.place_name}</div>
          <div style={small}>{profile.school.district_name} · {profile.grid.utility_name} ({profile.grid.ownership.toUpperCase()})</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", fontSize: 18, cursor: "pointer", color: "#607d8b" }}>×</button>
      </div>

      <div style={{ fontSize: 12, color: "#455a64", lineHeight: 1.45, marginBottom: 10 }}>
        These are the only town numbers the model reads. Everything else it shows is computed from them and the deal terms.
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <button type="button" onClick={autofill} disabled={auto.kind === "busy"} style={{ padding: "7px 12px", borderRadius: 8, border: "none", background: "#1e88e5", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          {auto.kind === "busy" ? "Looking up…" : "Autofill from public data"}
        </button>
        <span style={small}>
          {gaps.length === 0 ? "All values confirmed for this town." : `${gaps.length} of ${FIELDS.length} are defaults or low confidence — edit them or autofill.`}
        </span>
      </div>
      {auto.kind === "done" && <div style={{ ...small, color: "#2e7d32", marginBottom: 10 }}>Filled {auto.filled} of {FIELDS.length} from public data. Review anything amber or red.</div>}
      {auto.kind === "unavailable" && (
        <div style={{ fontSize: 12, color: "#8d4e00", background: "#fff3e0", borderRadius: 8, padding: "8px 10px", marginBottom: 10, lineHeight: 1.4 }}>
          <b>{auto.message}</b>
          {auto.needs.length > 0 && (
            <div style={{ marginTop: 4 }}>To fill it automatically the server needs: {auto.needs.join(" · ")}. Until then, enter values below.</div>
          )}
        </div>
      )}
      {auto.kind === "error" && <div style={{ ...small, color: "#c62828", marginBottom: 10 }}>Autofill failed: {auto.message}</div>}

      {groups.map(([group, fields]) => (
        <div key={group} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#546e7a", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{group}</div>
          {fields.map((f) => {
            const pv: PV = getPV(profile, f.key);
            const isEditing = editing === f.key;
            return (
              <div key={f.key} style={{ display: "grid", gridTemplateColumns: "7px 1fr auto", gap: 8, alignItems: "start", padding: "5px 0", borderTop: "1px solid rgba(0,0,0,0.05)" }}>
                <span title={`${pv.confidence} confidence`} style={{ width: 7, height: 7, borderRadius: 4, background: CONF[pv.confidence], marginTop: 6 }} />
                <div>
                  <div style={{ fontSize: 13, color: "#37474f" }}>
                    {f.label}
                    {f.tier === "required" && <span style={{ ...small, marginLeft: 6 }}>required</span>}
                  </div>
                  <div style={small}>
                    <span style={{ color: ORIGIN[pv.origin].color, fontWeight: 600 }}>{ORIGIN[pv.origin].text}</span> · {pv.source}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onBlur={() => commit(f.key)}
                      onKeyDown={(e) => { if (e.key === "Enter") commit(f.key); if (e.key === "Escape") setEditing(null); }}
                      style={{ width: 120, padding: "3px 6px", borderRadius: 6, border: "1px solid #1e88e5", fontSize: 13, textAlign: "right" }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setEditing(f.key); setDraft(String(pv.value)); }}
                      title="Click to edit"
                      style={{ border: "none", background: "transparent", fontWeight: 700, fontSize: 13, cursor: "text", fontVariantNumeric: "tabular-nums", color: "#263238" }}
                    >
                      {fmtVal(pv.value, f.unit)} <span style={{ ...small, fontWeight: 400 }}>{f.unit === "$" ? "" : f.unit}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ ...small, lineHeight: 1.4, marginTop: 4 }}>
        Green = public data, amber = estimate, red = default or low confidence. A default still runs; it just widens the result range and is listed in the verdict.
      </div>
    </div>
  );
}

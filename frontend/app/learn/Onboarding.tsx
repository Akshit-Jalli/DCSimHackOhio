"use client";
import { useState } from "react";
import { BANDS, type Band, type GuideInfo } from "./content";
import { Guide } from "./Guide";
import { cleanName, saveProfile } from "./progress";
import { BAND_LABEL, bigButton, INK, MUTED, SkyBackground } from "./ui";

// First visit: first name -> grade band -> pick a guide. Nothing else is asked; it stays on this computer.
export function Onboarding({ guides }: { guides: GuideInfo[] }) {
  const [stage, setStage] = useState<"name" | "band" | "guide">("name");
  const [name, setName] = useState("");
  const [band, setBand] = useState<Band | null>(null);
  const [guide, setGuide] = useState<string | null>(null);
  const clean = cleanName(name);
  const picked = guides.find((g) => g.id === guide);

  function finish() {
    if (!clean || !band || !guide) return;
    saveProfile({ name: clean, band, guide, modules: {} });
  }

  const card = { background: "#fff", borderRadius: 32, padding: "36px 40px", boxShadow: "0 16px 50px rgba(20,60,100,0.18)", width: "min(780px, calc(100vw - 32px))" } as const;
  const title = { fontSize: 36, fontWeight: 800, margin: "0 0 10px", lineHeight: 1.15, textWrap: "balance" } as const;

  return (
    <SkyBackground>
      <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: "32px 16px 140px" }}>
        {/* Which question we're on */}
        <div aria-label="Progress" style={{ display: "flex", gap: 10 }}>
          {["name", "band", "guide"].map((s, i) => (
            <span key={s} style={{ width: 14, height: 14, borderRadius: 7, background: ["name", "band", "guide"].indexOf(stage) >= i ? "#1e88e5" : "#ffffff", border: "2px solid #1e88e5" }} />
          ))}
        </div>

        {stage === "name" && (
          <form
            style={card}
            onSubmit={(e) => {
              e.preventDefault();
              if (clean) setStage("band");
            }}
          >
            <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
              {guides.map((g) => (
                <Guide key={g.id} id={g.id} name={g.name} size={64} />
              ))}
            </div>
            <h1 style={title}>Hi! What&apos;s your first name?</h1>
            <p style={{ fontSize: 19, color: MUTED, margin: "0 0 22px" }}>Just your first name. It stays on this computer.</p>
            <input
              autoFocus
              value={name}
              maxLength={20}
              onChange={(e) => setName(e.target.value)}
              aria-label="First name"
              placeholder="First name"
              autoComplete="off"
              style={{ width: "100%", boxSizing: "border-box", fontSize: 32, fontFamily: "inherit", fontWeight: 700, padding: "14px 20px", borderRadius: 18, border: "3px solid #90caf9", outline: "none", color: INK }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
              <button type="submit" disabled={!clean} style={bigButton("primary", !clean)}>
                Next →
              </button>
            </div>
          </form>
        )}

        {stage === "band" && (
          <div style={card}>
            <h1 style={title}>Nice to meet you, {clean}! What grade are you in?</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginTop: 22 }}>
              {BANDS.map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setBand(b);
                    setStage("guide");
                  }}
                  style={{ minHeight: 96, borderRadius: 22, border: band === b ? "4px solid #1e88e5" : "3px solid #cfd8dc", background: band === b ? "#e3f2fd" : "#fff", cursor: "pointer", fontFamily: "inherit", color: INK, textAlign: "left", padding: "14px 22px" }}
                >
                  <div style={{ fontSize: 28, fontWeight: 800 }}>{BAND_LABEL[b].short}</div>
                  <div style={{ fontSize: 18, color: MUTED, fontWeight: 600 }}>{BAND_LABEL[b].long}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setStage("name")} style={{ ...bigButton("plain"), marginTop: 22 }}>
              ← Back
            </button>
          </div>
        )}

        {stage === "guide" && (
          <div style={card}>
            <h1 style={title}>Pick a guide to explore with</h1>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 22 }}>
              {guides.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGuide(g.id)}
                  aria-pressed={guide === g.id}
                  style={{ borderRadius: 24, border: guide === g.id ? `4px solid ${g.color}` : "3px solid #e0e6eb", background: guide === g.id ? "#fffdf5" : "#fff", cursor: "pointer", fontFamily: "inherit", color: INK, padding: "18px 12px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}
                >
                  <Guide id={g.id} name={g.name} size={104} mood={guide === g.id ? "wow" : "happy"} />
                  <div style={{ fontSize: 26, fontWeight: 800 }}>{g.name}</div>
                  <div style={{ fontSize: 16, color: MUTED, fontWeight: 600, lineHeight: 1.3, textWrap: "balance" }}>{g.tagline}</div>
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 24, flexWrap: "wrap" }}>
              <button onClick={() => setStage("band")} style={bigButton("plain")}>
                ← Back
              </button>
              <div style={{ flex: 1, fontSize: 21, fontWeight: 700, minWidth: 200 }}>
                {picked ? `Hi ${clean}, I'm ${picked.name}! Ready?` : "Tap a guide to choose."}
              </div>
              <button onClick={finish} disabled={!picked} style={bigButton("primary", !picked)}>
                Let&apos;s go! 🚀
              </button>
            </div>
          </div>
        )}
      </main>
    </SkyBackground>
  );
}

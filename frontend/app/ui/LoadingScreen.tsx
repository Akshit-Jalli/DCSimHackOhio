"use client";

const SKY_TOP = "#5e9fdc";
const SKY_HORIZON = "#e9eef0";
const UI_FONT = "var(--font-geist-sans), system-ui, sans-serif";

// Full-screen "DCSim / Loading ..." cover. Optional checklist (download progress), error and buttons.
export function LoadingScreen({
  visible,
  title,
  steps,
  note,
  error,
  actions,
}: {
  visible: boolean;
  title: string;
  steps?: { label: string; done: boolean }[];
  note?: string;
  error?: string | null;
  actions?: { label: string; onClick: () => void }[];
}) {
  return (
    <>
      <style>{`@keyframes dcpulse { 0%, 80%, 100% { opacity: 0.25 } 40% { opacity: 1 } }`}</style>
      <div
        data-loading={visible}
        style={{
          position: "fixed",
          inset: 0,
          background: `linear-gradient(180deg, ${SKY_TOP} 0%, ${SKY_HORIZON} 100%)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          color: "#263238",
          fontFamily: UI_FONT,
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? "auto" : "none",
          transition: "opacity 0.8s",
          zIndex: 30,
        }}
      >
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg, #1e88e5, #43a047)", color: "white", fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}>
          DC
        </div>
        <div style={{ fontSize: 26, fontWeight: 800 }}>DCSim</div>
        <div style={{ fontSize: 14, color: "#455a64", display: "flex", alignItems: "center", gap: 6 }}>
          {title}
          {!error && [0, 1, 2].map((i) => (
            <span key={i} style={{ width: 6, height: 6, borderRadius: 3, background: "#455a64", animation: `dcpulse 1.2s ${i * 0.2}s infinite` }} />
          ))}
        </div>

        {steps && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "6px 18px", fontSize: 13, color: "#455a64" }}>
            {steps.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 6, opacity: s.done ? 1 : 0.55 }}>
                <span style={{ width: 16, textAlign: "center", color: s.done ? "#2e7d32" : "#78909c", fontWeight: 700 }}>{s.done ? "✓" : "…"}</span>
                {s.label}
              </div>
            ))}
          </div>
        )}
        {note && !error && <div style={{ fontSize: 12, color: "#607d8b" }}>{note}</div>}
        {error && (
          <div style={{ maxWidth: 420, fontSize: 13, color: "#b71c1c", background: "rgba(255,255,255,0.8)", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
            {error}
          </div>
        )}
        {actions && actions.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                style={{ border: "none", borderRadius: 10, padding: "8px 14px", background: "rgba(255,255,255,0.85)", color: "#263238", fontWeight: 600, fontSize: 13, cursor: "pointer", boxShadow: "0 4px 14px rgba(20,40,60,0.15)" }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

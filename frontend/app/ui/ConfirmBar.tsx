"use client";
// Build mode ends here. A dropped data center is tentative until the user
// confirms it; until then the build menu stays, the lot can be dragged, and
// no simulation runs. Confirm starts time. Cancel removes it.
import { useEffect } from "react";
import { panel } from "./Panels";

export function ConfirmBar({
  name,
  valid,
  onConfirm,
  onCancel,
}: {
  name: string;
  valid: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return; // typing in Town data, not answering us
      if (e.key === "Enter" && valid) onConfirm();
      else if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [valid, onConfirm, onCancel]);

  const btn = (bg: string, fg: string, border: string) =>
    ({ padding: "7px 14px", borderRadius: 8, border: `1px solid ${border}`, background: bg, color: fg, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }) as const;

  return (
    <div style={{ ...panel, top: 16, left: "50%", transform: "translateX(-50%)", padding: "8px 8px 8px 16px", display: "flex", alignItems: "center", gap: 12, zIndex: 13, whiteSpace: "nowrap" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>{valid ? `Place the ${name} here?` : "Can't build here"}</div>
        <div style={{ fontSize: 11, color: "#607d8b" }}>{valid ? "Drag it to move it. Confirm to start the simulation." : "Too close to town or water. Drag it somewhere clear."}</div>
      </div>
      <button type="button" onClick={onConfirm} disabled={!valid} style={{ ...btn("#2e7d32", "white", "#2e7d32"), opacity: valid ? 1 : 0.45, cursor: valid ? "pointer" : "not-allowed" }} title="Enter">
        <span style={{ fontSize: 15 }}>✓</span> Confirm
      </button>
      <button type="button" onClick={onCancel} style={btn("white", "#c62828", "#e57373")} title="Esc">
        <span style={{ fontSize: 15 }}>✗</span> Cancel
      </button>
    </div>
  );
}

"use client";
import { useEffect } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Band } from "./content";

// Shared look for the learn pages: big buttons, readable text, sky-and-hills background.

export const INK = "#16191d";
export const MUTED = "#4a5560";
export const FONT = "var(--font-lesson), var(--font-geist-sans), system-ui, sans-serif";

export const BAND_LABEL: Record<Band, { short: string; long: string }> = {
  "K-2": { short: "Grades K–2", long: "Kindergarten to 2nd grade" },
  "3-5": { short: "Grades 3–5", long: "3rd to 5th grade" },
  "6-8": { short: "Grades 6–8", long: "6th to 8th grade" },
  "9-12": { short: "Grades 9–12", long: "9th to 12th grade" },
};

export function bigButton(kind: "primary" | "plain" = "primary", disabled = false): CSSProperties {
  return {
    minHeight: 60,
    padding: "0 28px",
    borderRadius: 18,
    border: kind === "primary" ? "none" : "3px solid #cfd8dc",
    background: disabled ? "#b0bec5" : kind === "primary" ? "#1e88e5" : "#ffffff",
    color: kind === "primary" ? "#ffffff" : INK,
    fontFamily: FONT,
    fontSize: 21,
    fontWeight: 800,
    cursor: disabled ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    textDecoration: "none",
    boxShadow: kind === "primary" && !disabled ? "0 4px 0 #1565c0" : "none",
  };
}

// Full-page sky with rolling hills at the bottom
export function SkyBackground({ children }: { children: ReactNode }) {
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: "linear-gradient(180deg, #8fd0ff 0%, #d9f1ff 55%, #f2fbff 100%)", fontFamily: FONT, color: INK, overflow: "hidden" }}>
      <svg aria-hidden viewBox="0 0 1440 260" preserveAspectRatio="none" style={{ position: "absolute", left: 0, bottom: 0, width: "100%", height: 220 }}>
        <path d="M0 150 C 240 70 420 70 640 140 S 1100 220 1440 110 L1440 260 L0 260 Z" fill="#a5d6a7" />
        <path d="M0 200 C 300 140 520 160 760 205 S 1200 240 1440 185 L1440 260 L0 260 Z" fill="#81c784" />
      </svg>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

// Centered popup; closes on Escape or a click outside
export function Modal({ onClose, children, width = 640 }: { onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(10, 30, 50, 0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
        style={{ width: `min(${width}px, 100%)`, maxHeight: "calc(100vh - 32px)", overflowY: "auto", background: "#fff", borderRadius: 28, padding: 32, boxShadow: "0 20px 60px rgba(0,0,0,0.3)", fontFamily: FONT, color: INK }}
      >
        {children}
      </div>
    </div>
  );
}

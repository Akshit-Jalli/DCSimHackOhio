"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { Band } from "./content";

// Bigger text and shorter lines for younger readers. 1ch = width of "0", wider than an average
// Nunito letter, so these give about 32-40 letters per line.
const SIZE: Record<Band, { font: number; width: string }> = {
  "K-2": { font: 28, width: "26ch" },
  "3-5": { font: 25, width: "28ch" },
  "6-8": { font: 22, width: "31ch" },
  "9-12": { font: 21, width: "33ch" },
};
const INK = "#16191d";
const KEY_WORD = "#1565c0"; // **bold** words in lesson text

// "A **data center** is..." -> [{ text: "A ", bold: false }, { text: "data center", bold: true }, ...]
function parse(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((part) =>
    part.startsWith("**") && part.endsWith("**") ? { text: part.slice(2, -2), bold: true } : { text: part, bold: false }
  );
}

// Reveals the text a few letters at a time. Returns how many letters to show and a way to skip.
function useTypewriter(key: string, length: number) {
  const [shown, setShown] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(length); // eslint-disable-line react-hooks/set-state-in-effect -- no animation wanted
      return;
    }
    setShown(0);
    const perSecond = Math.max(55, length / 1.6); // long lines still finish in ~1.6 s
    const start = performance.now();
    const tick = (now: number) => {
      const n = Math.min(length, Math.floor(((now - start) / 1000) * perSecond));
      setShown(n);
      if (n < length) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [key, length]);
  // Stop the animation too, or its next frame would undo the skip
  const skip = () => {
    cancelAnimationFrame(raf.current);
    setShown(length);
  };
  return { shown, done: shown >= length, skip };
}

// Width of the longest rendered line, from the boxes of its letters (spaces at line ends don't count).
// Typewriter letters that aren't shown yet still have boxes, so this always measures the full text.
function widestLine(p: HTMLElement) {
  const lines = new Map<number, { left: number; right: number }>();
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    for (let i = 0; i < n.length; i++) {
      if (/\s/.test(n.data[i])) continue;
      range.setStart(n, i);
      range.setEnd(n, i + 1);
      const r = range.getClientRects()[0];
      if (!r) continue;
      const key = Math.round(r.top);
      const line = lines.get(key);
      if (line) {
        line.left = Math.min(line.left, r.left);
        line.right = Math.max(line.right, r.right);
      } else lines.set(key, { left: r.left, right: r.right });
    }
  }
  return { width: Math.max(0, ...[...lines.values()].map((l) => l.right - l.left)), lines: lines.size };
}

// Trim the space a font keeps above capital letters and below the baseline, so the gap above the
// first line and below the last line match the padding. Fallback: Nunito's measured metrics
// (ascent 1.0em, descent 0.357em, cap height 0.714em at line-height 1.28).
const TRIM_CSS = `
.dc-bubble-text { margin-top: 0; margin-bottom: 0; text-box: trim-both cap alphabetic; }
@supports not (text-box: trim-both cap alphabetic) {
  .dc-bubble-text { margin-top: -0.247em; margin-bottom: -0.318em; }
}`;
const PAD = 24; // same on every side, measured to the letters (cap tops, baseline)

// The guide's game-style dialogue box. The tail points left at the guide.
// Not-yet-typed letters are invisible but still take up space, so lines don't jump while typing.
export function SpeechBubble({
  text,
  band,
  stepKey,
  footer,
  onTyping,
}: {
  text: string;
  band: Band;
  stepKey: string;
  footer: ReactNode;
  onTyping?: (typing: boolean) => void; // lets the guide's mouth move while the text types
}) {
  const parts = parse(text);
  const total = parts.reduce((n, p) => n + p.text.length, 0);
  const { shown, done, skip } = useTypewriter(stepKey + text, total);
  const size = SIZE[band];
  useEffect(() => {
    onTyping?.(!done);
  }, [done, onTyping]);

  // text-wrap: balance makes lines shorter but the box keeps the unbalanced width.
  // Shrink the text box to its longest balanced line (again on resize, text change and font load).
  const textRef = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    const p = textRef.current;
    if (!p) return;
    const fit = () => {
      p.style.width = ""; // let balance lay out within max-width first
      const before = widestLine(p);
      if (before.width <= 0) return;
      p.style.width = `${before.width}px`;
      // Rounding can push a word to a new line in some browsers; give it 1px back if so
      if (widestLine(p).lines > before.lines) p.style.width = `${before.width + 1}px`;
    };
    fit();
    document.fonts?.ready.then(fit);
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [text, band]);

  // Where each part starts in the whole text
  const starts = parts.map((_, i) => parts.slice(0, i).reduce((n, p) => n + p.text.length, 0));
  const rendered = parts.map((p, i) => {
    const visible = p.text.slice(0, Math.max(0, shown - starts[i]));
    const hidden = p.text.slice(visible.length);
    const style: CSSProperties = p.bold ? { color: KEY_WORD, fontWeight: 800 } : {};
    return (
      <span key={i} style={style}>
        {visible}
        {hidden && <span style={{ visibility: "hidden" }}>{hidden}</span>}
      </span>
    );
  });

  return (
    <div
      onClick={() => !done && skip()}
      style={{
        position: "relative",
        background: "#ffffff",
        borderRadius: 28,
        padding: PAD,
        boxShadow: "0 10px 30px rgba(20, 40, 60, 0.22), 0 2px 6px rgba(20, 40, 60, 0.12)",
        border: "3px solid #e3eaf2",
        color: INK,
        fontFamily: "var(--font-lesson), var(--font-geist-sans), system-ui, sans-serif",
        cursor: done ? "default" : "pointer",
      }}
    >
      {/* Tail pointing at the guide */}
      <svg width="26" height="30" viewBox="0 0 26 30" aria-hidden style={{ position: "absolute", left: -23, bottom: 26 }}>
        <path d="M26 2 L2 22 Q0 24 3 25 L26 28 Z" fill="#ffffff" stroke="#e3eaf2" strokeWidth="3" strokeLinejoin="round" />
        <rect x="23" y="0" width="6" height="30" fill="#ffffff" />
      </svg>

      {/* Screen readers get the whole sentence at once */}
      <p style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)", margin: 0 }}>{parts.map((p) => p.text).join("")}</p>
      <style>{TRIM_CSS}</style>
      <p
        ref={textRef}
        aria-hidden
        className="dc-bubble-text"
        style={{
          marginLeft: "auto", // centered if the buttons make the bubble wider than the text
          marginRight: "auto",
          maxWidth: size.width,
          fontSize: size.font,
          fontWeight: 600,
          lineHeight: 1.28,
          textWrap: "balance",
          letterSpacing: 0.1,
        }}
      >
        {rendered}
      </p>
      <div style={{ marginTop: PAD }}>{footer}</div>
    </div>
  );
}

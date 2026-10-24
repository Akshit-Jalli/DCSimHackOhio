"use client";
import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { Town, TownPick } from "@/lib/towns";
import { panel } from "./Panels";

const row: CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", border: "none", background: "transparent", padding: "7px 8px", borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 13, color: "#263238" };
const heading: CSSProperties = { fontSize: 11, fontWeight: 700, color: "#78909c", textTransform: "uppercase", letterSpacing: 0.5, margin: "10px 8px 4px" };
const hint: CSSProperties = { fontSize: 12, color: "#78909c", padding: "4px 8px" };

// One clickable row in the list
function Choice({ left, right, rightColor, onClick }: { left: string; right: string | null; rightColor?: string; onClick: () => void }) {
  return (
    <button
      style={row}
      onClick={onClick}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,136,229,0.08)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <span>{left}</span>
      <span style={{ fontSize: 11, color: rightColor ?? "#78909c" }}>{right}</span>
    </button>
  );
}

// Town name in the header. Click it to search for another US town.
// Search waits 600 ms after typing stops (Nominatim allows 1 request/second; the server also limits and caches).
export function TownSearch({ current, onPick }: { current: string; onPick: (t: TownPick) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<TownPick[] | null>(null);
  const [cached, setCached] = useState<Town[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef(0);
  const seq = useRef(0); // ignore answers to older searches

  function show() {
    setOpen(true);
    fetch("/api/town")
      .then((r) => r.json())
      .then((d) => setCached(d.towns ?? []))
      .catch(() => {});
  }

  function close() {
    setOpen(false);
    setQ("");
    setResults(null);
    setError(null);
    setSearching(false);
    clearTimeout(timer.current);
    seq.current++;
  }

  function onType(value: string) {
    setQ(value);
    setError(null);
    clearTimeout(timer.current);
    seq.current++;
    const query = value.trim();
    if (query.length < 3) {
      setResults(null);
      setSearching(false);
      return;
    }
    timer.current = window.setTimeout(async () => {
      const id = ++seq.current;
      setSearching(true);
      try {
        const res = await fetch(`/api/town/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (id !== seq.current) return;
        if (!res.ok) throw new Error(data.error || "Search failed");
        setResults(data.results);
      } catch (e) {
        if (id === seq.current) setError((e as Error).message);
      } finally {
        if (id === seq.current) setSearching(false);
      }
    }, 600);
  }

  function pick(t: TownPick) {
    close();
    onPick(t);
  }

  const text = q.trim().toLowerCase();
  const ready = cached.filter((t) => !text || `${t.name}, ${t.state}`.toLowerCase().includes(text));
  const isCached = (t: TownPick) => cached.some((c) => c.name === t.name && c.state === t.state);
  const firstChoice = results?.[0] ?? ready[0];

  return (
    <>
      <button
        onClick={() => (open ? close() : show())}
        title="Change town"
        style={{ border: "none", background: "transparent", padding: 0, fontSize: 11, color: "#607d8b", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
      >
        {current} <span style={{ fontSize: 8 }}>▼</span>
      </button>

      {open && (
        <>
          {/* Click anywhere else to close */}
          <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 19 }} />
          <div style={{ ...panel, top: "calc(100% + 8px)", left: 0, width: 320, padding: 10, zIndex: 20 }}>
            <input
              autoFocus
              value={q}
              onChange={(e) => onType(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") close();
                if (e.key === "Enter" && firstChoice) pick(firstChoice);
              }}
              placeholder="Type a US town, e.g. Athens, OH"
              style={{ width: "100%", boxSizing: "border-box", border: "1px solid #cfd8dc", borderRadius: 8, padding: "8px 10px", fontSize: 14, outline: "none", background: "white", color: "#263238" }}
            />

            <div style={{ maxHeight: 320, overflowY: "auto" }}>
              {ready.length > 0 && (
                <>
                  <div style={heading}>Ready (opens instantly)</div>
                  {ready.map((t) => (
                    <Choice key={t.slug} left={`${t.name}, ${t.state}`} right={t.county} onClick={() => pick(t)} />
                  ))}
                </>
              )}

              {text.length >= 3 && (
                <>
                  <div style={heading}>Search{searching && "…"}</div>
                  {error && <div style={{ ...hint, color: "#c62828" }}>{error}</div>}
                  {results && results.length === 0 && !searching && <div style={hint}>No US towns found</div>}
                  {results?.map((t) => (
                    <Choice
                      key={`${t.name}-${t.state}-${t.lat}`}
                      left={`${t.name}, ${t.state}`}
                      right={isCached(t) ? "ready" : t.county}
                      rightColor={isCached(t) ? "#2e7d32" : undefined}
                      onClick={() => pick(t)}
                    />
                  ))}
                </>
              )}
              {text.length > 0 && text.length < 3 && <div style={{ ...hint, paddingTop: 8 }}>Keep typing…</div>}
            </div>
            <div style={{ fontSize: 10, color: "#90a4ae", padding: "8px 8px 0" }}>
              US towns only · New towns take ~15 s to download · © OpenStreetMap contributors, Overture Maps
            </div>
          </div>
        </>
      )}
    </>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLon, Town, TownPick } from "@/lib/towns";
import { areaOffsetText, squareAround } from "../mapConfig";
import { panel } from "./Panels";

// Same limit as MAX_AREA_OFFSET_M in lib/towns.ts (the server checks it too)
const MAX_OFFSET_M = 40000;

// OpenStreetMap's standard tiles: fine for light use like a hackathon demo, with attribution shown,
// no pre-fetching or bulk downloads. https://operations.osmfoundation.org/policies/tiles/
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Meters east/north from a to b
function offsetM(a: LatLon, b: LatLon) {
  return {
    east: (b.lon - a.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180),
    north: (b.lat - a.lat) * 110540,
  };
}

// Keep a center within MAX_OFFSET_M of the town
function clamp(town: LatLon, c: LatLon): LatLon {
  const { east, north } = offsetM(town, c);
  const d = Math.hypot(east, north);
  if (d <= MAX_OFFSET_M) return c;
  const k = MAX_OFFSET_M / d;
  return {
    lat: town.lat + (north * k) / 110540,
    lon: town.lon + (east * k) / (111320 * Math.cos((town.lat * Math.PI) / 180)),
  };
}

// Flat map with a draggable square the size of the 3D map. Generate loads that square in 3D.
// Dashed squares are areas of this town that are already downloaded (click to open instantly).
export function RegionPicker({
  town,
  start,
  onGenerate,
  onOpen,
  onCancel,
}: {
  town: TownPick;
  start?: LatLon; // where the square starts (default: town center)
  onGenerate: (center: LatLon) => void;
  onOpen: (t: Town) => void;
  onCancel: () => void;
}) {
  const divRef = useRef<HTMLDivElement>(null);
  const first = start ?? { lat: town.lat, lon: town.lon };
  const centerRef = useRef<LatLon>(first); // for the Leaflet handlers
  const [center, setCenter] = useState<LatLon>(first); // for the text below
  const [regions, setRegions] = useState<Town[]>([]);

  useEffect(() => {
    let map: Leaflet.Map | null = null;
    let cancelled = false;
    const home = { lat: town.lat, lon: town.lon };

    Promise.all([
      import("leaflet"),
      fetch("/api/town")
        .then((r) => r.json())
        .then((d) => (d.towns as Town[]).filter((t) => t.name === town.name && t.state === town.state))
        .catch(() => [] as Town[]),
    ]).then(([L, mine]) => {
      if (cancelled || !divRef.current) return;
      setRegions(mine);
      const m = L.map(divRef.current, { minZoom: 8, maxZoom: 16 });
      map = m;
      L.tileLayer(TILES, { maxZoom: 16, attribution: ATTRIBUTION }).addTo(m);

      // How far the square may go, and the town's own point
      L.circle([home.lat, home.lon], { radius: MAX_OFFSET_M, color: "#546e7a", weight: 1, dashArray: "4 8", fill: false, interactive: false }).addTo(m);
      L.circleMarker([home.lat, home.lon], { radius: 5, color: "#263238", weight: 2, fillColor: "#ffffff", fillOpacity: 1 })
        .bindTooltip(`${town.name} center`)
        .addTo(m);

      // Already downloaded areas
      for (const t of mine) {
        const [w, s, e, n] = t.bbox;
        L.rectangle([[s, w], [n, e]], { color: "#2e7d32", weight: 2, dashArray: "6 6", fillOpacity: 0.04, bubblingMouseEvents: false })
          .bindTooltip(`Ready: ${areaOffsetText(t) || "town center"} (click to open)`)
          .on("click", () => onOpen(t))
          .addTo(m);
      }

      // The square
      const rect = L.rectangle(squareAround(centerRef.current.lat, centerRef.current.lon), {
        color: "#1e88e5",
        weight: 3,
        fillOpacity: 0.15,
        bubblingMouseEvents: false,
      }).addTo(m);
      m.fitBounds(rect.getBounds(), { padding: [80, 80] });

      const moveTo = (c: LatLon) => {
        const next = clamp(home, c);
        centerRef.current = next;
        rect.setBounds(squareAround(next.lat, next.lon));
        setCenter(next);
      };

      // Drag the square (move it by how far the mouse moved), or click the map to jump it there
      const setCursor = (c: string) => (rect.getElement() as SVGElement | undefined)?.style.setProperty("cursor", c);
      rect.on("mousedown", (e: Leaflet.LeafletMouseEvent) => {
        const grab = e.latlng;
        const from = centerRef.current;
        m.dragging.disable();
        setCursor("grabbing");
        const move = (ev: Leaflet.LeafletMouseEvent) =>
          moveTo({ lat: from.lat + ev.latlng.lat - grab.lat, lon: from.lon + ev.latlng.lng - grab.lng });
        const up = () => {
          m.off("mousemove", move);
          document.removeEventListener("mouseup", up);
          m.dragging.enable();
          setCursor("grab");
        };
        m.on("mousemove", move);
        document.addEventListener("mouseup", up);
      });
      setCursor("grab");
      m.on("click", (e: Leaflet.LeafletMouseEvent) => moveTo({ lat: e.latlng.lat, lon: e.latlng.lng }));
    });

    return () => {
      cancelled = true;
      map?.remove();
    };
    // Built once per picker; callbacks come from the parent and don't change while it's open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const offset = areaOffsetText({ ...center, townLat: town.lat, townLon: town.lon });
  // A downloaded area with (almost) the same center: open it instead of downloading again
  const ready = regions.find((t) => {
    const o = offsetM(t, center);
    return Math.hypot(o.east, o.north) < 150;
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 25, background: "#e9eef0" }}>
      <div ref={divRef} style={{ position: "absolute", inset: 0 }} />

      <div style={{ ...panel, top: 16, left: 16, width: 330, padding: 16, zIndex: 1000 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Pick the area</div>
        <div style={{ fontSize: 13, color: "#546e7a", margin: "4px 0 12px" }}>
          {town.name}, {town.state}
          {town.county ? ` · ${town.county}` : ""}
        </div>
        <div style={{ fontSize: 13, lineHeight: 1.5, color: "#37474f" }}>
          Drag the blue square, or click the map to move it there. It&apos;s the size of the 3D map (14.25 km).
          <br />
          <span style={{ color: "#2e7d32" }}>Green dashed</span> = already downloaded, click to open.
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, margin: "12px 0" }}>
          {offset ? `${offset} of ${town.name} center` : `Centered on ${town.name}`}
          <span style={{ fontWeight: 400, color: ready ? "#2e7d32" : "#78909c" }}>
            {" · "}
            {ready ? "ready, opens instantly" : "about 15–30 s to download"}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onCancel}
            style={{ flex: 1, border: "1px solid #cfd8dc", borderRadius: 10, padding: "9px 0", background: "white", color: "#263238", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            onClick={() => (ready ? onOpen(ready) : onGenerate(centerRef.current))}
            style={{ flex: 2, border: "none", borderRadius: 10, padding: "9px 0", background: "#1e88e5", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            {ready ? "Open 3D map" : "Generate 3D map"}
          </button>
        </div>
      </div>
    </div>
  );
}

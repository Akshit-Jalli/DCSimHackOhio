"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { LatLon, Town, TownPick } from "@/lib/towns";
import { areaOffsetText, setTown, type TownInfo } from "./mapConfig";
import { DEFAULT_TOWN, loadWilmington } from "./defaultTown";
import Scene from "./Scene";
import Onboarding from "./ui/Onboarding";
import { LoadingScreen } from "./ui/LoadingScreen";
import { RegionPicker } from "./ui/RegionPicker";
import { TownSearch } from "./ui/TownSearch";


const LAYER_LABELS: Record<string, string> = {
  buildings: "Buildings",
  landcover: "Fields & forest",
  roads: "Roads",
  water: "Water",
  places: "Places",
  infrastructure: "Power grid",
};

type Download = { label: string; done: string[]; error: string | null };

// Picks the town (from ?town=<slug>, the search box or the area picker), downloads it if needed, then shows the 3D scene.
// Switching towns remounts the whole scene (key = slug) so nothing from the old town is left over.
// kidMode (Free Build from /learn): only towns that are already downloaded, no search, no area picker.
export default function TownApp({ kidMode = false }: { kidMode?: boolean }) {
  const [town, setTownState] = useState<TownInfo | null>(null);
  const [download, setDownload] = useState<Download | null>(null);
  const [picking, setPicking] = useState<{ town: TownPick; start?: LatLon } | null>(null);
  const job = useRef(0); // bump to cancel the download we're waiting on

  function show(t: TownInfo, fromPublic = false) {
    setTown(t, fromPublic);
    setTownState(t);
    setDownload(null);
    const offset = areaOffsetText(t);
    document.title = `DCSim · ${t.name}, ${t.state}${offset ? ` (${offset})` : ""}`;
    const url = new URL(window.location.href);
    if (t.slug === DEFAULT_TOWN) url.searchParams.delete("town");
    else url.searchParams.set("town", t.slug);
    window.history.replaceState(null, "", url);
  }

  // Wilmington always works: from the cache, or from public/ on a fresh clone
  async function showDefault() {
    job.current++;
    const { town, fromPublic } = await loadWilmington();
    show(town, fromPublic);
  }

  // Wait for a map on the server (start = begin downloading it first), showing progress
  async function open(label: string, slug: string | null, start?: TownPick & { center?: LatLon }) {
    const id = ++job.current;
    setDownload({ label, done: [], error: null });
    try {
      if (start) {
        const res = await fetch("/api/town/load", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(start) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not start the download");
        slug = data.slug as string;
      }
      for (;;) {
        const s = await fetch(`/api/town/${slug}`).then((r) => r.json());
        if (id !== job.current) return; // cancelled
        if (s.state === "ready") return show(s.town);
        if (s.state === "error") throw new Error(s.error);
        if (s.state === "missing") throw new Error(`"${label}" hasn't been downloaded. Search for it to download it.`);
        setDownload({ label, done: s.done, error: null });
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      if (id === job.current) setDownload({ label, done: [], error: (e as Error).message });
    }
  }

  // A downloaded map: open it (instant)
  function openReady(t: Town) {
    setPicking(null);
    if (t.slug !== town?.slug) open(`${t.name}, ${t.state}`, t.slug);
  }

  // The area picker for the current town, starting at the area on screen
  function pickArea() {
    if (!town) return;
    const home = { lat: town.townLat ?? town.lat, lon: town.townLon ?? town.lon };
    setPicking({ town: { name: town.name, state: town.state, county: town.county, ...home }, start: { lat: town.lat, lon: town.lon } });
  }

  function generate(center: LatLon) {
    if (!picking) return;
    const t = picking.town;
    setPicking(null);
    open(`${t.name}, ${t.state}`, null, { ...t, center });
  }

  function cancel() {
    job.current++;
    setDownload(null);
    if (!town) showDefault();
  }

  // First load: the town in the URL, or Wilmington. Runs once; the URL only exists in the browser.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("town");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time start from the URL
    if (slug && slug !== DEFAULT_TOWN) open(slug, slug);
    else showDefault();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = town ? `Back to ${town.name}` : "Go to Wilmington";
  const offset = town ? areaOffsetText(town) : "";
  return (
    <>
      {town && (
        <Scene
          key={town.slug}
          town={town}
          townMenu={
            <TownSearch
              current={`${town.name}, ${town.state}${offset ? ` · ${offset}` : ""}`}
              currentName={town.name}
              onPick={(t) => setPicking({ town: t })}
              onOpen={openReady}
              onPickArea={pickArea}
              kidMode={kidMode}
            />
          }
        />
      )}
      {town && !kidMode && <Onboarding />}
      {kidMode && town && (
        <Link
          href="/learn"
          style={{ position: "fixed", top: 16, right: 16, zIndex: 20, background: "white", color: "#16191d", borderRadius: 16, padding: "14px 22px", fontWeight: 800, fontSize: 18, textDecoration: "none", boxShadow: "0 4px 14px rgba(20,40,60,0.2)", fontFamily: "var(--font-lesson), var(--font-geist-sans), system-ui, sans-serif" }}
        >
          ← Map
        </Link>
      )}
      {picking && !kidMode && (
        <RegionPicker town={picking.town} start={picking.start} onGenerate={generate} onOpen={openReady} onCancel={() => setPicking(null)} />
      )}
      {download ? (
        <LoadingScreen
          visible
          title={download.error ? `Couldn't load ${download.label}` : `Getting ${download.label}`}
          steps={download.error ? undefined : Object.keys(LAYER_LABELS).map((k) => ({ label: LAYER_LABELS[k], done: download.done.includes(k) }))}
          note="New towns take about 15–30 seconds. Downloaded towns open instantly next time."
          error={download.error}
          actions={[{ label: download.error ? back : "Cancel", onClick: cancel }]}
        />
      ) : (
        !town && <LoadingScreen visible title="Loading" />
      )}
    </>
  );
}
